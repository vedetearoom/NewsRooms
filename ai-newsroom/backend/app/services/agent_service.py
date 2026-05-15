import json
from collections.abc import AsyncGenerator

from fastapi import HTTPException
from google import genai
from google.genai import types
from openai import AsyncOpenAI
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Agent, InspirationAsset
from app.schemas import AgentChatRequest, AgentCreate, AgentRewriteRequest, AgentUpdate
from app.services.agent_skill_service import get_default_system_skills_for_role, normalize_agent_system_skills
from app.services.plugin_service import build_agent_output, build_agent_outputs
from app.services.quota_service import CUSTOM_AGENTS, ensure_resource_quota
from app.services.writer_agent import TASK_PROMPTS

REWRITE_SYSTEM_PROMPT = (
    "You are an expert editor. Return ONLY the revised text. "
    "NO explanations, NO conversational filler. MUST be strictly under 500 words."
)

CHAT_SYSTEM_PROMPT = (
    "你是一个底层文字处理引擎，绝对禁止输出任何问候语（如你好、以下是）、禁止输出总结语，"
    "直接输出排版严谨的 Markdown 正文。根据提供的参考资料，按照用户的指令生成内容。"
)

CONTEXT_LAB_AGENT_PROMPTS: dict[str, str] = {
    "general_writing": TASK_PROMPTS["multi_source_synthesis"],
    "newsletter": TASK_PROMPTS["newsletter"],
    "deep_dive": TASK_PROMPTS["deep_dive"],
}

DEFAULT_USER_AGENTS: list[dict[str, object]] = [
    {
        "name": "默认提取器",
        "role": "extractor",
        "system_prompt": "You are an expert news analyst. Extract key points and entities from the provided source text.",
        "system_skills": get_default_system_skills_for_role("extractor"),
        "is_system": True,
        "is_active": True,
    },
    {
        "name": "标准写作助手",
        "role": "writer",
        "system_prompt": "You are a professional journalist. Synthesize the provided intelligence cards into a cohesive, neutral, and well-structured article.",
        "system_skills": get_default_system_skills_for_role("writer"),
        "is_system": True,
        "is_active": True,
    },
    {
        "name": "格式与语气审核",
        "role": "reviewer",
        "system_prompt": "You are a strict editorial reviewer. Read the draft text and ensure it adheres to professional journalistic standards. Provide specific quotes to fix if there are overly speculative or biased statements.",
        "is_system": True,
        "is_active": True,
    },
    {
        "name": "默认插画师",
        "role": "illustrator",
        "model_ref": "qwen-image-2.0-pro",
        "system_prompt": "你是一位专业的新闻配图设计师。根据用户提供的文字描述，生成高品质的新闻封面或配图。\n\n## 风格规范\n- 画面风格：极简、专业、现代科技感\n- 主色调：深色背景（黑灰系）配以亮色点缀\n- 构图：干净清晰，主体突出\n- 文字渲染：所有文字必须使用准确的简体中文，字体清晰可辨\n- 整体氛围：高端、专业、有未来感",
        "is_system": True,
        "is_active": True,
    },
]


def get_default_system_prompt(role: str) -> str | None:
    for spec in DEFAULT_USER_AGENTS:
        if spec["role"] != role:
            continue
        default_prompt = spec.get("system_prompt")
        if isinstance(default_prompt, str):
            return default_prompt
        return None
    return None


def build_agent_preference_sections(agent: Agent) -> list[str]:
    sections: list[str] = []
    default_system_prompt = get_default_system_prompt(agent.role)
    has_custom_system_prompt = bool(
        agent.system_prompt
        and (
            not agent.is_system
            or agent.system_prompt != default_system_prompt
        )
    )

    if has_custom_system_prompt:
        sections.append(f"=== WRITER PREFERENCES ===\n{agent.system_prompt}")
    if agent.context_text:
        sections.append(f"=== REFERENCE EXAMPLES ===\n{agent.context_text}")

    return sections


def build_rewrite_system_prompt(agent: Agent) -> str:
    sections = [REWRITE_SYSTEM_PROMPT, *build_agent_preference_sections(agent)]
    return "\n\n".join(section for section in sections if section)


async def ensure_default_agents_for_user(db: AsyncSession, user_id: int) -> None:
    from app.models import User

    # Serialize first-time agent bootstrap per user so concurrent requests
    # don't create duplicate default system agents.
    await db.execute(select(User.id).where(User.id == user_id).with_for_update())

    result = await db.execute(select(Agent).where(Agent.owner_user_id == user_id))
    existing_agents = result.scalars().all()
    existing_roles = {agent.role for agent in existing_agents}

    for agent in existing_agents:
        requested_skills = list(agent.system_skills or [])
        if agent.is_system:
            for skill in get_default_system_skills_for_role(agent.role):
                if skill not in requested_skills:
                    requested_skills.append(skill)
        normalized_skills = normalize_agent_system_skills(agent.role, requested_skills)
        if list(agent.system_skills or []) != normalized_skills:
            agent.system_skills = normalized_skills

    for spec in DEFAULT_USER_AGENTS:
        if spec["role"] in existing_roles:
            continue
        db.add(Agent(owner_user_id=user_id, **spec))

    await db.flush()


async def list_agents(db: AsyncSession, user_id: int):
    await ensure_default_agents_for_user(db, user_id)
    result = await db.execute(
        select(Agent)
        .where(Agent.owner_user_id == user_id)
        .order_by(Agent.created_at.desc())
    )
    agents = list(result.scalars().all())
    from app.services.provider_resolution import resolve_agents_api_keys
    await resolve_agents_api_keys(db, agents)
    return await build_agent_outputs(db, user_id, agents)


async def create_agent_record(agent_in: AgentCreate, db: AsyncSession, user_id: int):
    await ensure_resource_quota(db, user_id, CUSTOM_AGENTS)
    payload = agent_in.model_dump()
    payload["is_system"] = False
    payload["execution_mode"] = "native"
    payload["sandbox_enabled"] = False
    payload["system_skills"] = normalize_agent_system_skills(payload.get("role"), payload.get("system_skills"))
    db_agent = Agent(owner_user_id=user_id, **payload)
    db.add(db_agent)
    await db.commit()
    await db.refresh(db_agent)
    return await build_agent_output(db, user_id, db_agent)


async def get_agent_or_404(agent_id: int, db: AsyncSession, user_id: int) -> Agent:
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.owner_user_id == user_id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.provider_id:
        from app.services.provider_resolution import resolve_agent_api_key
        resolved = await resolve_agent_api_key(agent, db)
        if resolved:
            agent.api_key = resolved
    return agent


async def get_agent_response_or_404(agent_id: int, db: AsyncSession, user_id: int):
    agent = await get_agent_or_404(agent_id, db, user_id)
    return await build_agent_output(db, user_id, agent)


async def update_agent_record(agent_id: int, agent_in: AgentUpdate, db: AsyncSession, user_id: int):
    agent = await get_agent_or_404(agent_id, db, user_id)
    update_data = agent_in.model_dump(exclude_unset=True)
    update_data.pop("execution_mode", None)
    update_data.pop("sandbox_enabled", None)
    if "system_skills" in update_data:
        update_data["system_skills"] = normalize_agent_system_skills(
            update_data.get("role", agent.role),
            update_data.get("system_skills"),
        )
    elif "role" in update_data:
        update_data["system_skills"] = normalize_agent_system_skills(
            update_data["role"],
            list(agent.system_skills or []),
        )
    for key, value in update_data.items():
        setattr(agent, key, value)

    await db.commit()
    await db.refresh(agent)
    return await build_agent_output(db, user_id, agent)


async def delete_agent_record(agent_id: int, db: AsyncSession, user_id: int) -> dict[str, bool]:
    agent = await get_agent_or_404(agent_id, db, user_id)
    if agent.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete a system agent")

    try:
        await db.delete(agent)
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this agent because it is assigned to existing tasks.",
        ) from exc

    return {"ok": True}


async def activate_agent_record(agent_id: int, db: AsyncSession, user_id: int):
    agent = await get_agent_or_404(agent_id, db, user_id)
    await db.execute(
        update(Agent)
        .where(Agent.role == agent.role, Agent.owner_user_id == user_id)
        .values(is_active=False)
    )
    agent.is_active = True
    await db.commit()
    await db.refresh(agent)
    return await build_agent_output(db, user_id, agent)


async def get_active_writer_agent(db: AsyncSession, user_id: int) -> Agent:
    await ensure_default_agents_for_user(db, user_id)
    result = await db.execute(
        select(Agent).where(
            Agent.owner_user_id == user_id,
            Agent.role == "writer",
            Agent.is_active == True,
        )
    )
    agent = result.scalars().first()
    if not agent or not agent.api_key:
        raise HTTPException(status_code=400, detail="Writer agent API key is not configured.")
    return agent


async def rewrite_with_writer(req: AgentRewriteRequest, db: AsyncSession, user_id: int) -> dict[str, str]:
    agent = await get_active_writer_agent(db, user_id)
    model_ref = agent.model_ref or "gemini-2.5-flash"
    system_prompt = build_rewrite_system_prompt(agent)
    user_prompt = f"Instruction: {req.instruction}\n\nText to revise:\n{req.text}"

    if model_ref.startswith("qwen"):
        client = AsyncOpenAI(
            api_key=agent.api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        )
        res = await client.chat.completions.create(
            model=model_ref,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=800,
            temperature=0.7,
        )
        return {"rewritten_text": res.choices[0].message.content or ""}

    client = genai.Client(api_key=agent.api_key)
    res = await client.aio.models.generate_content(
        model=model_ref,
        contents=f"{system_prompt}\n\n{user_prompt}",
        config=types.GenerateContentConfig(
            max_output_tokens=800,
            temperature=0.7,
        ),
    )
    return {"rewritten_text": res.text or ""}


def build_context_lab_system_prompt(agent_type: str | None) -> str:
    mode_prompt = CONTEXT_LAB_AGENT_PROMPTS.get(
        agent_type or "general_writing",
        CONTEXT_LAB_AGENT_PROMPTS["general_writing"],
    )
    return f"{CHAT_SYSTEM_PROMPT}\n\n=== OUTPUT MODE ===\n{mode_prompt}"


async def get_chat_context(req: AgentChatRequest, db: AsyncSession, user_id: int) -> tuple[Agent, str, str]:
    agent_type_str = req.agent_type or "normal"
    
    selected_agent = None
    if agent_type_str.isdigit():
        agent_id = int(agent_type_str)
        result = await db.execute(select(Agent).where(Agent.id == agent_id, Agent.owner_user_id == user_id))
        selected_agent = result.scalar_one_or_none()

    if selected_agent:
        agent = selected_agent
        mode_prompt = selected_agent.system_prompt or ""
        system_prompt = f"{CHAT_SYSTEM_PROMPT}\n\n=== OUTPUT MODE ===\n{mode_prompt}"
    else:
        agent = await get_active_writer_agent(db, user_id)
        if agent_type_str == "normal":
            system_prompt = CHAT_SYSTEM_PROMPT
            preference_sections = build_agent_preference_sections(agent)
            if preference_sections:
                system_prompt += "\n\n" + "\n\n".join(preference_sections)
        else:
            system_prompt = build_context_lab_system_prompt(agent_type_str)
            preference_sections = build_agent_preference_sections(agent)
            if preference_sections:
                system_prompt += "\n\n" + "\n\n".join(preference_sections)

    insp_result = await db.execute(
        select(InspirationAsset).where(
            InspirationAsset.id.in_(req.inspiration_ids),
            InspirationAsset.owner_user_id == user_id,
        )
    )
    inspirations = insp_result.scalars().all()
    if not inspirations:
        raise HTTPException(status_code=404, detail="No inspirations found")

    context_parts: list[str] = []
    strip_transcript = len(inspirations) >= 3
    for insp in inspirations:
        meta = insp.extra_data or {}
        part = f"### [{insp.platform}] {insp.title}\n"
        if insp.hook_text:
            part += f"**Hook:** {insp.hook_text}\n"
        if "original_summary" in meta:
            part += f"**Summary:** {meta['original_summary']}\n"
        if "original_key_points" in meta:
            part += f"**Key Points:** {meta['original_key_points']}\n"
        if not strip_transcript:
            if "transcript" in meta:
                part += f"**Transcript:**\n{meta['transcript']}\n"
            elif "content" in meta:
                part += f"**Content:**\n{meta['content']}\n"
        context_parts.append(part)

    full_context = "\n\n".join(context_parts)
    user_prompt = f"Sources:\n{full_context}\n\nUser Prompt: {req.prompt}"
    return agent, system_prompt, user_prompt


async def stream_chat_with_inspirations(
    req: AgentChatRequest,
    db: AsyncSession,
    user_id: int,
) -> AsyncGenerator[str, None]:
    agent, system_prompt, user_prompt = await get_chat_context(req, db, user_id)
    model_ref = agent.model_ref or "gemini-2.5-flash"

    try:
        if model_ref.startswith("qwen"):
            client = AsyncOpenAI(
                api_key=agent.api_key,
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            )
            stream = await client.chat.completions.create(
                model=model_ref,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                stream=True,
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    text_chunk = chunk.choices[0].delta.content
                    yield f"event: chunk\ndata: {json.dumps({'text': text_chunk})}\n\n"
            yield "event: done\ndata: {}\n\n"
            return

        client = genai.Client(api_key=agent.api_key)
        response_stream = await client.aio.models.generate_content_stream(
            model=model_ref,
            contents=f"{system_prompt}\n\n{user_prompt}",
        )
        async for chunk in response_stream:
            if chunk.text:
                yield f"event: chunk\ndata: {json.dumps({'text': chunk.text})}\n\n"
        yield "event: done\ndata: {}\n\n"
    except Exception as exc:
        yield f"event: error\ndata: {json.dumps({'message': str(exc)})}\n\n"
