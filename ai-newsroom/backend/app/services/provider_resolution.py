import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model_defs.agents import Agent

logger = logging.getLogger(__name__)


async def resolve_agent_api_key(agent: Agent, db: AsyncSession) -> str | None:
    """Resolve the effective API key for an agent from its provider.

    Priority:
    1. If provider_id is set, load the ModelProvider and return its api_key.
    2. Fall back to agent.api_key (legacy).
    3. Return None if neither is available.
    """
    if agent.provider_id:
        from app.model_defs.providers import ModelProvider

        result = await db.execute(
            select(ModelProvider).where(ModelProvider.id == agent.provider_id)
        )
        provider = result.scalar_one_or_none()
        if provider:
            return provider.api_key

    return getattr(agent, "api_key", None) or None


async def resolve_agents_api_keys(db: AsyncSession, agents: list[Agent]) -> None:
    """Batch-resolve api_key on a list of Agent objects by loading providers.

    Mutates each agent's api_key attribute in-place from the provider,
    so downstream code continues working unchanged.
    """
    from app.model_defs.providers import ModelProvider

    provider_ids = {a.provider_id for a in agents if a.provider_id}
    if not provider_ids:
        return

    result = await db.execute(
        select(ModelProvider).where(ModelProvider.id.in_(provider_ids))
    )
    provider_map = {p.id: p.api_key for p in result.scalars().all()}

    for agent in agents:
        if agent.provider_id and agent.provider_id in provider_map:
            agent.api_key = provider_map[agent.provider_id]
