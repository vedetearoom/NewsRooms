import logging
from datetime import datetime, timezone

from sqlalchemy import func, select, update

from app.database import async_session
from app.model_defs.auth import Role, User, user_roles
from app.model_defs.content import IntelligenceCard

logger = logging.getLogger(__name__)

AUTO_PIN_LIMIT = 50


async def refresh_auto_pins():
    """Auto-pin top intelligence cards from super_admin users.

    - Only pins new cards, never unpins existing ones (except eviction when over limit).
    - Sorts by importance_score DESC, created_at DESC.
    - Caps at AUTO_PIN_LIMIT; when over, evicts the lowest-scored card.
    """
    async with async_session() as db:
        # 1. Get all active super_admin user IDs
        admin_query = (
            select(User.id)
            .join(user_roles, user_roles.c.user_id == User.id)
            .join(Role, Role.id == user_roles.c.role_id)
            .where(Role.code == "super_admin", User.is_active == True)
        )
        result = await db.execute(admin_query)
        admin_ids = [row[0] for row in result.fetchall()]
        if not admin_ids:
            return

        # 2. Count currently pinned cards for these admins
        count_query = (
            select(func.count(IntelligenceCard.id))
            .where(
                IntelligenceCard.owner_user_id.in_(admin_ids),
                IntelligenceCard.is_pinned == True,
                IntelligenceCard.content_type == "article",
            )
        )
        current_count = (await db.execute(count_query)).scalar() or 0

        # 3. If under limit, find and pin new cards
        if current_count < AUTO_PIN_LIMIT:
            slots = AUTO_PIN_LIMIT - current_count
            candidates_query = (
                select(IntelligenceCard)
                .where(
                    IntelligenceCard.owner_user_id.in_(admin_ids),
                    IntelligenceCard.is_pinned == False,
                    IntelligenceCard.is_archived == False,
                    IntelligenceCard.content_type == "article",
                )
                .order_by(
                    IntelligenceCard.importance_score.desc(),
                    IntelligenceCard.created_at.desc(),
                )
                .limit(slots)
            )
            result = await db.execute(candidates_query)
            cards_to_pin = result.scalars().all()

            if cards_to_pin:
                now = datetime.now(timezone.utc)
                ids_to_pin = [c.id for c in cards_to_pin]
                await db.execute(
                    update(IntelligenceCard)
                    .where(IntelligenceCard.id.in_(ids_to_pin))
                    .values(
                        is_pinned=True,
                        pinned_by=None,
                        pinned_at=now,
                    )
                )
                await db.commit()
                logger.info("[AutoPin] Pinned %d new cards (total: %d)", len(ids_to_pin), current_count + len(ids_to_pin))

        # 4. If over limit, evict the lowest-scored
        if current_count > AUTO_PIN_LIMIT:
            pinned_query = (
                select(IntelligenceCard)
                .where(
                    IntelligenceCard.owner_user_id.in_(admin_ids),
                    IntelligenceCard.is_pinned == True,
                    IntelligenceCard.content_type == "article",
                )
                .order_by(
                    IntelligenceCard.importance_score.asc(),
                    IntelligenceCard.created_at.asc(),
                )
                .limit(current_count - AUTO_PIN_LIMIT)
            )
            result = await db.execute(pinned_query)
            cards_to_unpin = result.scalars().all()
            if cards_to_unpin:
                ids_to_unpin = [c.id for c in cards_to_unpin]
                await db.execute(
                    update(IntelligenceCard)
                    .where(IntelligenceCard.id.in_(ids_to_unpin))
                    .values(is_pinned=False, pinned_by=None, pinned_at=None)
                )
                await db.commit()
                logger.info("[AutoPin] Evicted %d cards (back to %d)", len(ids_to_unpin), AUTO_PIN_LIMIT)
