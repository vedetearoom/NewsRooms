from typing import Optional, List, Sequence, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete, String
from sqlalchemy.orm.attributes import flag_modified
from datetime import date
from app.models import IntelligenceCard, Task

class CardRepository:
    def __init__(self, db: AsyncSession, owner_user_id: int):
        self.db = db
        self.owner_user_id = owner_user_id

    async def list_cards(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        category: Optional[str] = None,
        tag: Optional[str] = None,
        archived: bool = False
    ) -> Sequence[IntelligenceCard]:
        q = select(IntelligenceCard).where(
            IntelligenceCard.owner_user_id == self.owner_user_id,
            IntelligenceCard.is_archived == archived,
        )
        if date_from:
            q = q.where(IntelligenceCard.published_date >= date_from)
        if date_to:
            q = q.where(IntelligenceCard.published_date <= date_to)
        if category:
            q = q.where(IntelligenceCard.category == category)
        if tag:
            # JSON array stored as text — use LIKE for simple substring matching
            q = q.where(IntelligenceCard.tags.cast(String).contains(tag))
            
        q = q.order_by(IntelligenceCard.importance_score.desc(), IntelligenceCard.created_at.desc())
        result = await self.db.execute(q)
        return result.scalars().all()

    async def today_cards(self) -> Sequence[IntelligenceCard]:
        q = (
            select(IntelligenceCard)
            .where(IntelligenceCard.owner_user_id == self.owner_user_id)
            .where(IntelligenceCard.published_date == date.today())
            .where(IntelligenceCard.is_archived == False)
            .order_by(IntelligenceCard.importance_score.desc())
        )
        result = await self.db.execute(q)
        return result.scalars().all()

    async def list_categories(self) -> List[Tuple[str, int]]:
        result = await self.db.execute(
            select(IntelligenceCard.category, func.count(IntelligenceCard.id))
            .where(IntelligenceCard.owner_user_id == self.owner_user_id)
            .where(IntelligenceCard.category.isnot(None))
            .group_by(IntelligenceCard.category)
        )
        return [{"name": row[0], "count": row[1]} for row in result.all()]

    async def get_by_id(self, card_id: int) -> Optional[IntelligenceCard]:
        result = await self.db.execute(
            select(IntelligenceCard).where(
                IntelligenceCard.id == card_id,
                IntelligenceCard.owner_user_id == self.owner_user_id,
            )
        )
        return result.scalar_one_or_none()

    async def toggle_archive(self, card_id: int, archive_status: bool = True) -> bool:
        card = await self.get_by_id(card_id)
        if not card:
            return False
        card.is_archived = archive_status
        await self.db.commit()
        return True
        
    async def toggle_read(self, card_id: int, read_status: bool = True) -> bool:
        card = await self.get_by_id(card_id)
        if not card:
            return False
        card.is_read = read_status
        await self.db.commit()
        return True

    async def delete(self, card_id: int) -> bool:
        """
        Cascade cleanup: before deleting a card, remove its reference from any Task
        """
        # 1. Clean up task references
        tasks_result = await self.db.execute(
            select(Task).where(Task.owner_user_id == self.owner_user_id)
        )
        all_tasks = tasks_result.scalars().all()
        for task in all_tasks:
            if task.card_ids and card_id in task.card_ids:
                new_ids = [cid for cid in task.card_ids if cid != card_id]
                task.card_ids = new_ids
                flag_modified(task, "card_ids")
        
        # 2. Delete the card
        card = await self.get_by_id(card_id)
        if not card:
            return False
        await self.db.delete(card)
        await self.db.commit()
        return True
