from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.services.clerk_sync_service import disable_user_for_clerk_delete, sync_clerk_user_created_or_updated

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])
settings = get_settings()


@router.post("/clerk")
async def handle_clerk_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    if not settings.clerk_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Clerk webhook secret is not configured",
        )

    payload = await request.body()
    headers = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }

    try:
        from svix.webhooks import Webhook, WebhookVerificationError
    except ModuleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The svix package is required for Clerk webhooks. Install backend requirements first.",
        ) from exc

    try:
        event = Webhook(settings.clerk_webhook_secret).verify(payload, headers)
    except WebhookVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature") from exc

    event_type = event.get("type")
    data = event.get("data") or {}

    if event_type in {"user.created", "user.updated"}:
        user = await sync_clerk_user_created_or_updated(db, data)
        return {"ok": True, "event": event_type, "user_id": user.id if user else None}

    if event_type == "user.deleted":
        user = await disable_user_for_clerk_delete(db, data)
        return {"ok": True, "event": event_type, "user_id": user.id if user else None}

    return {"ok": True, "ignored": True, "event": event_type}
