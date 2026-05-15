from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.model_defs.providers import ModelProvider
from app.model_defs.agents import Agent
from app.schema_defs.providers import (
    ModelProviderCreate,
    ModelProviderUpdate,
    ModelProviderOut,
)
from app.services.auth_service import require_permission

router = APIRouter(prefix="/api/model-providers", tags=["model-providers"])

VALID_PROVIDERS = {"google", "alibaba", "deepseek"}

MODEL_CATALOG = {
    "google": {
        "text": ["gemini-2.5-flash", "gemini-2.5-pro"],
        "image": ["gemini-2.5-flash-image"],
    },
    "alibaba": {
        "text": ["qwen-plus", "qwen-max"],
        "image": ["qwen-image-2.0-pro"],
    },
    "deepseek": {
        "text": ["deepseek-v4-flash", "deepseek-v4-pro"],
    },
}


def _mask_api_key(key: str) -> str:
    if len(key) <= 8:
        return "****"
    return f"{key[:4]}****{key[-4:]}"


def _to_out(provider: ModelProvider) -> ModelProviderOut:
    return ModelProviderOut(
        id=provider.id,
        name=provider.name,
        provider=provider.provider,
        category=provider.category,
        api_key_masked=_mask_api_key(provider.api_key),
        default_model=provider.default_model,
        created_at=provider.created_at,
        updated_at=provider.updated_at,
    )


@router.get("", response_model=list[ModelProviderOut])
async def list_providers(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    result = await db.execute(
        select(ModelProvider)
        .where(ModelProvider.owner_user_id == current_user.id)
        .order_by(ModelProvider.created_at.desc())
    )
    return [_to_out(p) for p in result.scalars().all()]


@router.post("", response_model=ModelProviderOut)
async def create_provider(
    data: ModelProviderCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    if data.provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Provider must be one of: {', '.join(sorted(VALID_PROVIDERS))}")

    provider = ModelProvider(
        owner_user_id=current_user.id,
        name=data.name,
        provider=data.provider,
        category=data.category,
        api_key=data.api_key,
        default_model=data.default_model,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return _to_out(provider)


@router.get("/catalog/models")
async def list_available_models(
    current_user=Depends(require_permission("agents.view")),
):
    return MODEL_CATALOG


@router.get("/{provider_id}", response_model=ModelProviderOut)
async def get_provider(
    provider_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    result = await db.execute(
        select(ModelProvider).where(
            ModelProvider.id == provider_id,
            ModelProvider.owner_user_id == current_user.id,
        )
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return _to_out(provider)


@router.patch("/{provider_id}", response_model=ModelProviderOut)
async def update_provider(
    provider_id: int,
    data: ModelProviderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    result = await db.execute(
        select(ModelProvider).where(
            ModelProvider.id == provider_id,
            ModelProvider.owner_user_id == current_user.id,
        )
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    update_fields = data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(provider, field, value)

    await db.commit()
    await db.refresh(provider)
    return _to_out(provider)


@router.delete("/{provider_id}")
async def delete_provider(
    provider_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    result = await db.execute(
        select(ModelProvider).where(
            ModelProvider.id == provider_id,
            ModelProvider.owner_user_id == current_user.id,
        )
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Check if any agents reference this provider
    agent_result = await db.execute(
        select(Agent).where(Agent.provider_id == provider_id).limit(1)
    )
    if agent_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Cannot delete provider that is referenced by one or more agents",
        )

    await db.delete(provider)
    await db.commit()
    return {"ok": True}
