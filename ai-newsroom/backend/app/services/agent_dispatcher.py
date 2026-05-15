from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Agent


async def _resolve_agent(agent: Agent, db: AsyncSession) -> Agent:
    """Resolve api_key from provider for a single agent."""
    if agent.provider_id:
        from app.services.provider_resolution import resolve_agent_api_key
        resolved = await resolve_agent_api_key(agent, db)
        if resolved:
            agent.api_key = resolved
    return agent


class AgentDispatcher:
    """Centralized service to resolve Agent configurations from the Database.

    Prevents duplicate Agent lookups and fallback chains across different workflow stages.
    """

    @staticmethod
    async def get_agent(
        db: AsyncSession,
        agent_id: Optional[int] = None,
        role: Optional[str] = None,
        owner_user_id: Optional[int] = None,
    ) -> Optional[Agent]:
        """Fetch an Agent by explicit ID, or fallback to the top active agent for a given role."""
        agent = None
        if agent_id:
            query = select(Agent).where(Agent.id == agent_id)
            if owner_user_id is not None:
                query = query.where(Agent.owner_user_id == owner_user_id)
            result = await db.execute(query)
            agent = result.scalar_one_or_none()
        elif role:
            query = select(Agent).where(Agent.role.ilike(f"%{role}%"))
            if owner_user_id is not None:
                query = query.where(Agent.owner_user_id == owner_user_id)
            result = await db.execute(
                query.order_by(Agent.is_active.desc(), Agent.is_system.desc()).limit(1)
            )
            agent = result.scalar_one_or_none()

        if agent:
            await _resolve_agent(agent, db)
        return agent

    @staticmethod
    async def get_audio_transcriber_config(db: AsyncSession, owner_user_id: Optional[int] = None) -> dict:
        """Find a valid API key and model config specifically suitable for native audio transcription (Gemini or Qwen)."""
        from app.services.provider_resolution import resolve_agents_api_keys

        # Try 1: Explicit audio API key configured on any active agent
        query0 = (
            select(Agent)
            .where(Agent.audio_api_key.isnot(None))
            .where(Agent.audio_api_key != "")
        )
        if owner_user_id is not None:
            query0 = query0.where(Agent.owner_user_id == owner_user_id)
        result0 = await db.execute(
            query0.order_by(Agent.is_active.desc(), Agent.is_system.desc()).limit(1)
        )
        audio_agent = result0.scalar_one_or_none()
        if audio_agent and audio_agent.audio_api_key:
            model = audio_agent.audio_model_ref or "gemini-2.5-flash"
            provider = "qwen" if "qwen" in model.lower() else "gemini"
            return {"provider": provider, "api_key": audio_agent.audio_api_key, "model_ref": model}

        # Try 2: Active extractor agent with a supported model
        query = select(Agent).where(Agent.role.ilike("%extractor%"))
        if owner_user_id is not None:
            query = query.where(Agent.owner_user_id == owner_user_id)
        result = await db.execute(
            query.order_by(Agent.is_active.desc(), Agent.is_system.desc()).limit(1)
        )
        extractor = result.scalar_one_or_none()
        if extractor:
            await _resolve_agent(extractor, db)
        if extractor and extractor.api_key:
            model = extractor.audio_model_ref or extractor.model_ref
            if model and (model.startswith("gemini") or model.startswith("qwen")):
                provider = "qwen" if "qwen" in model.lower() else "gemini"
                return {"provider": provider, "api_key": extractor.api_key, "model_ref": model}

        # Try 3: Any agent that has a supported model configured with an API key
        query2 = (
            select(Agent)
            .where(Agent.api_key.isnot(None))
        )
        if owner_user_id is not None:
            query2 = query2.where(Agent.owner_user_id == owner_user_id)
        result2 = await db.execute(query2)
        agents = list(result2.scalars().all())
        await resolve_agents_api_keys(db, agents)
        for fallback in agents:
            model = fallback.audio_model_ref or fallback.model_ref
            if model and (model.startswith("gemini") or model.startswith("qwen")):
                provider = "qwen" if "qwen" in model.lower() else "gemini"
                return {"provider": provider, "api_key": fallback.api_key, "model_ref": model}

        raise ValueError(
            "未找到可用的语音转录大模型 API Key。视频转录需要 Gemini 或 Qwen 音频模型支持。"
            "请在「智能体」页面为任意 Agent 配置 Gemini/Qwen API Key，"
            "或将提取器模型设为支持的系列并填入 Key。"
        )
