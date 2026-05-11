from __future__ import annotations

import json
import re
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from google import genai
from google.genai import types
from openai import AsyncOpenAI
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Agent,
    AgentActionProposal,
    AgentMessage,
    AgentThread,
    InspirationAsset,
    IntelligenceCard,
    RawArticle,
    Source,
)
from app.schemas import (
    AgentActionProposalOut,
    AgentMessageOut,
    AgentThreadChatRequest,
    AgentThreadCreate,
    AgentThreadOut,
    SourceCreate,
    TaskCreate,
)
from app.services.agent_service import build_agent_preference_sections, get_agent_or_404
from app.services.agent_skill_service import (
    get_default_system_skills_for_role,
    get_skill_catalog_item,
    get_skill_permission_code,
    list_agent_skill_catalog,
    normalize_agent_system_skills,
)
from app.services.auth_service import load_user_permission_codes
from app.services.source_service import create_source, delete_source, get_source_or_404, trigger_source_scrape
from app.services.task_service import create_task

SUPPORTED_WORKBENCH_ROLES = {"writer", "extractor"}
PLACEHOLDER_THREAD_TITLE = "新对话"
CONFIRMATION_ONLY_RE = re.compile(
    r"^\s*(可以|确认|执行|开始|开始吧|好的|好|没问题|同意|继续|ok|okay|yes|y)\s*[。.!！]?\s*$",
    re.IGNORECASE,
)
SMALLTALK_ONLY_RE = re.compile(
    r"^\s*(hi|hello|hey|你好|您好|嗨|哈喽|hello there|早上好|上午好|中午好|下午好|晚上好|在吗|在不在)\s*[。.!！~～]*\s*$",
    re.IGNORECASE,
)
SOURCE_CREATE_TERMS = ["添加", "新增", "创建", "加一个", "订阅"]
SOURCE_SCRAPE_TERMS = ["抓取", "拉取", "采集", "更新", "同步", "scrape", "fetch"]
SOURCE_DELETE_TERMS = ["删除", "移除", "删掉", "取消订阅"]
SOURCE_REFERENCE_TERMS = ["来源", "rss", "feed", "source", "数据源"]
SOURCE_LIST_TERMS = ["信号源管理", "信号源", "来源列表", "数据源", "source management", "source list"]


def _serialize_sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _chunk_text(text: str, size: int = 120) -> list[str]:
    if not text:
        return []
    return [text[idx:idx + size] for idx in range(0, len(text), size)]


def _parse_json_object(raw_text: str) -> dict[str, Any]:
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                parsed = json.loads(text[start:end + 1])
                return parsed if isinstance(parsed, dict) else {}
            except json.JSONDecodeError:
                return {}
    return {}


def _sanitize_int_list(value: Any) -> list[int]:
    if not isinstance(value, list):
        return []
    result: list[int] = []
    for item in value:
        try:
            parsed = int(item)
        except (TypeError, ValueError):
            continue
        if parsed not in result:
            result.append(parsed)
    return result


def _safe_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _guess_source_name(url: str) -> str:
    host_match = re.sub(r"^https?://", "", url).split("/")[0].strip()
    return host_match or "New RSS Source"


def _build_thread_title_from_prompt(prompt: str) -> str:
    cleaned = re.sub(r"\s+", " ", prompt.strip())
    if not cleaned:
        return PLACEHOLDER_THREAD_TITLE
    return cleaned[:48]


def _is_confirmation_only_prompt(prompt: str) -> bool:
    return bool(CONFIRMATION_ONLY_RE.match(prompt or ""))


def _is_smalltalk_prompt(prompt: str) -> bool:
    return bool(SMALLTALK_ONLY_RE.match(prompt or ""))


def _build_smalltalk_reply(agent: Agent) -> str:
    if agent.role == "extractor":
        return "你好，我在。你可以让我查看来源、读取最近文章，或者帮你新增并抓取一个 RSS/Web 来源。"
    return "你好，我在。你可以让我查看最新情报卡片、读取卡片详情，或者直接帮你创建写作任务。"


async def list_agent_threads(db: AsyncSession, owner_user_id: int, agent_id: int) -> list[AgentThreadOut]:
    await get_agent_or_404(agent_id, db, owner_user_id)
    result = await db.execute(
        select(AgentThread)
        .where(
            AgentThread.owner_user_id == owner_user_id,
            AgentThread.agent_id == agent_id,
        )
        .order_by(AgentThread.last_message_at.desc().nullslast(), AgentThread.updated_at.desc())
    )
    return [AgentThreadOut.model_validate(thread) for thread in result.scalars().all()]


async def create_agent_thread(
    db: AsyncSession,
    owner_user_id: int,
    agent_id: int,
    data: AgentThreadCreate,
) -> AgentThreadOut:
    await get_agent_or_404(agent_id, db, owner_user_id)
    title = (data.title or "").strip() or PLACEHOLDER_THREAD_TITLE
    thread = AgentThread(
        owner_user_id=owner_user_id,
        agent_id=agent_id,
        title=title,
    )
    db.add(thread)
    await db.commit()
    await db.refresh(thread)
    return AgentThreadOut.model_validate(thread)


async def clear_agent_thread_context(
    db: AsyncSession,
    owner_user_id: int,
    agent_id: int,
    thread_id: int,
) -> AgentThreadOut:
    thread = await get_agent_thread_or_404(db, owner_user_id, agent_id, thread_id)
    await db.execute(
        delete(AgentActionProposal).where(
            AgentActionProposal.owner_user_id == owner_user_id,
            AgentActionProposal.thread_id == thread_id,
        )
    )
    await db.execute(
        delete(AgentMessage).where(
            AgentMessage.owner_user_id == owner_user_id,
            AgentMessage.thread_id == thread_id,
        )
    )
    thread.last_message_at = None
    thread.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(thread)
    return AgentThreadOut.model_validate(thread)


async def delete_agent_thread(
    db: AsyncSession,
    owner_user_id: int,
    agent_id: int,
    thread_id: int,
) -> dict[str, bool]:
    thread = await get_agent_thread_or_404(db, owner_user_id, agent_id, thread_id)
    await db.execute(
        delete(AgentActionProposal).where(
            AgentActionProposal.owner_user_id == owner_user_id,
            AgentActionProposal.thread_id == thread_id,
        )
    )
    await db.execute(
        delete(AgentMessage).where(
            AgentMessage.owner_user_id == owner_user_id,
            AgentMessage.thread_id == thread_id,
        )
    )
    await db.delete(thread)
    await db.commit()
    return {"ok": True}


async def get_agent_thread_or_404(
    db: AsyncSession,
    owner_user_id: int,
    agent_id: int,
    thread_id: int,
) -> AgentThread:
    result = await db.execute(
        select(AgentThread).where(
            AgentThread.id == thread_id,
            AgentThread.agent_id == agent_id,
            AgentThread.owner_user_id == owner_user_id,
        )
    )
    thread = result.scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")
    return thread


async def list_agent_thread_messages(
    db: AsyncSession,
    owner_user_id: int,
    agent_id: int,
    thread_id: int,
) -> list[AgentMessageOut]:
    await get_agent_thread_or_404(db, owner_user_id, agent_id, thread_id)
    return await _load_thread_messages_out(db, owner_user_id, thread_id)


async def approve_agent_action(
    db: AsyncSession,
    owner_user_id: int,
    agent_id: int,
    thread_id: int,
    action_id: int,
) -> AgentActionProposalOut:
    thread = await get_agent_thread_or_404(db, owner_user_id, agent_id, thread_id)
    action = await _get_action_or_404(db, owner_user_id, thread_id, action_id)
    if action.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending actions can be approved")

    action.status = "approved"
    await db.commit()

    try:
        result_json, tool_message, followup = await _execute_action(db, owner_user_id, thread, action)
        action.status = "executed"
        action.result_json = result_json
        thread.last_message_at = datetime.now(UTC)
        db.add(
            AgentMessage(
                owner_user_id=owner_user_id,
                thread_id=thread.id,
                role="tool",
                content_md=tool_message,
                tool_name=action.action_type,
                tool_payload_json=result_json,
            )
        )
        if followup:
            followup_message = AgentMessage(
                owner_user_id=owner_user_id,
                thread_id=thread.id,
                role="assistant",
                content_md=followup["message"],
            )
            db.add(followup_message)
            await db.flush()
            db.add(
                AgentActionProposal(
                    owner_user_id=owner_user_id,
                    thread_id=thread.id,
                    message_id=followup_message.id,
                    action_type=followup["action_type"],
                    payload_json=followup["payload_json"],
                    status="pending",
                )
            )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        action = await _get_action_or_404(db, owner_user_id, thread_id, action_id)
        action.status = "failed"
        action.result_json = {"error": str(exc)}
        db.add(
            AgentMessage(
                owner_user_id=owner_user_id,
                thread_id=thread_id,
                role="tool",
                content_md=f"动作执行失败：{exc}",
                tool_name=action.action_type,
                tool_payload_json={"error": str(exc)},
            )
        )
        await db.commit()
    await db.refresh(action)
    return AgentActionProposalOut.model_validate(action)


async def reject_agent_action(
    db: AsyncSession,
    owner_user_id: int,
    agent_id: int,
    thread_id: int,
    action_id: int,
) -> AgentActionProposalOut:
    await get_agent_thread_or_404(db, owner_user_id, agent_id, thread_id)
    action = await _get_action_or_404(db, owner_user_id, thread_id, action_id)
    if action.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending actions can be rejected")
    action.status = "rejected"
    action.result_json = {"message": "User rejected this action"}
    db.add(
        AgentMessage(
            owner_user_id=owner_user_id,
            thread_id=thread_id,
            role="tool",
            content_md="已取消该动作。",
            tool_name=action.action_type,
            tool_payload_json={"status": "rejected"},
        )
    )
    await db.commit()
    await db.refresh(action)
    return AgentActionProposalOut.model_validate(action)


async def stream_agent_thread_chat(
    req: AgentThreadChatRequest,
    db: AsyncSession,
    owner_user_id: int,
    agent_id: int,
    thread_id: int,
) -> AsyncGenerator[str, None]:
    agent = await get_agent_or_404(agent_id, db, owner_user_id)
    thread = await get_agent_thread_or_404(db, owner_user_id, agent_id, thread_id)
    _ensure_workbench_agent_supported(agent)
    if not (agent.api_key or "").strip():
        raise HTTPException(status_code=400, detail="当前 Agent 尚未配置 API Key")
    prompt_text = req.prompt.strip()
    is_smalltalk = _is_smalltalk_prompt(prompt_text)

    normalized_skills = normalize_agent_system_skills(
        agent.role,
        list(agent.system_skills or get_default_system_skills_for_role(agent.role)),
    )
    user_permissions = await load_user_permission_codes(db, owner_user_id)

    user_message = AgentMessage(
        owner_user_id=owner_user_id,
        thread_id=thread.id,
        role="user",
        content_md=prompt_text,
    )
    db.add(user_message)
    thread.last_message_at = datetime.now(UTC)
    if thread.title == PLACEHOLDER_THREAD_TITLE and not is_smalltalk:
        thread.title = _build_thread_title_from_prompt(prompt_text)
    await db.commit()
    await db.refresh(user_message)

    pending_actions = await _load_pending_action_proposals_out(db, owner_user_id, thread.id)
    if pending_actions and _is_confirmation_only_prompt(prompt_text):
        assistant_text = "我不会通过文字直接执行高风险动作。请点击下方待确认操作卡片里的确认按钮，我会在执行后把结果显示在这里。"
        db.add(
            AgentMessage(
                owner_user_id=owner_user_id,
                thread_id=thread.id,
                role="assistant",
                content_md=assistant_text,
            )
        )
        thread.last_message_at = datetime.now(UTC)
        await db.commit()
        for proposal in pending_actions:
            yield _serialize_sse("action_proposed", proposal.model_dump(mode="json"))
        for chunk in _chunk_text(assistant_text):
            yield _serialize_sse("chunk", {"text": chunk})
        yield _serialize_sse("done", {})
        return

    if is_smalltalk:
        assistant_text = _build_smalltalk_reply(agent)
        db.add(
            AgentMessage(
                owner_user_id=owner_user_id,
                thread_id=thread.id,
                role="assistant",
                content_md=assistant_text,
            )
        )
        thread.last_message_at = datetime.now(UTC)
        await db.commit()
        for chunk in _chunk_text(assistant_text):
            yield _serialize_sse("chunk", {"text": chunk})
        yield _serialize_sse("done", {})
        return

    history = await _load_conversation_for_prompt(db, owner_user_id, thread.id)

    try:
        read_plan = await _generate_read_plan(agent, history, normalized_skills)
        read_tool_calls = _normalize_tool_calls(
            read_plan.get("read_tool_calls", []),
            allowed_skills=normalized_skills,
            permission_codes=user_permissions,
            require_confirmation=False,
        )
        if _is_source_mutation_intent(req.prompt):
            # Mutating source intents must surface a confirmation card first; avoid
            # "read recent articles" looking like an implicit scrape already ran.
            read_tool_calls = [call for call in read_tool_calls if call["skill"] == "sources.list"]
        read_tool_calls = _apply_read_tool_hints(
            req.prompt,
            read_tool_calls,
            allowed_skills=normalized_skills,
            permission_codes=user_permissions,
        )

        tool_results: list[dict[str, Any]] = []
        for call in read_tool_calls:
            result = await _execute_read_skill(db, owner_user_id, call["skill"], call.get("args") or {})
            result["skill"] = call["skill"]
            tool_results.append(result)
            db.add(
                AgentMessage(
                    owner_user_id=owner_user_id,
                    thread_id=thread.id,
                    role="tool",
                    content_md=result["summary"],
                    tool_name=call["skill"],
                    tool_payload_json=result["payload"],
                )
            )
            yield _serialize_sse(
                "tool_call",
                {
                    "name": call["skill"],
                    "summary": result["summary"],
                    "payload": result["payload"],
                },
            )

        await db.commit()

        history = await _load_conversation_for_prompt(db, owner_user_id, thread.id)
        response_plan = await _generate_response_plan(agent, history, normalized_skills, tool_results)
        assistant_text = str(response_plan.get("assistant_markdown") or "").strip()
        if not assistant_text:
            assistant_text = (
                _build_read_tool_results_reply(tool_results)
                or "我已经读取了相关上下文，但这次没有得到稳定的结构化结果。你可以换一种更具体的说法继续试。"
            )

        action_proposals = _normalize_action_proposals(
            response_plan.get("action_proposals", []),
            agent=agent,
            allowed_skills=normalized_skills,
            permission_codes=user_permissions,
            latest_prompt=req.prompt,
        )
        if not action_proposals:
            fallback_actions, fallback_text = await _infer_fallback_action_proposals(
                db=db,
                owner_user_id=owner_user_id,
                thread_id=thread.id,
                agent=agent,
                allowed_skills=normalized_skills,
                permission_codes=user_permissions,
                latest_prompt=req.prompt,
                tool_results=tool_results,
            )
            if fallback_actions:
                action_proposals = fallback_actions
                assistant_text = fallback_text or "我已准备好待确认操作卡，请点击确认按钮后再执行。"
            elif fallback_text:
                assistant_text = fallback_text

        assistant_message = AgentMessage(
            owner_user_id=owner_user_id,
            thread_id=thread.id,
            role="assistant",
            content_md=assistant_text,
        )
        db.add(assistant_message)
        await db.flush()

        action_proposals_out: list[AgentActionProposalOut] = []
        for action in action_proposals:
            proposal = AgentActionProposal(
                owner_user_id=owner_user_id,
                thread_id=thread.id,
                message_id=assistant_message.id,
                action_type=action["action_type"],
                payload_json=action["payload_json"],
                status="pending",
            )
            db.add(proposal)
            await db.flush()
            action_proposals_out.append(AgentActionProposalOut.model_validate(proposal))

        thread.last_message_at = datetime.now(UTC)
        await db.commit()

        for proposal in action_proposals_out:
            yield _serialize_sse("action_proposed", proposal.model_dump(mode="json"))

        for chunk in _chunk_text(assistant_text):
            yield _serialize_sse("chunk", {"text": chunk})
        yield _serialize_sse("done", {})
    except HTTPException:
        raise
    except Exception as exc:
        yield _serialize_sse("error", {"message": str(exc)})


async def _load_thread_messages_out(
    db: AsyncSession,
    owner_user_id: int,
    thread_id: int,
) -> list[AgentMessageOut]:
    messages_result = await db.execute(
        select(AgentMessage)
        .where(
            AgentMessage.owner_user_id == owner_user_id,
            AgentMessage.thread_id == thread_id,
        )
        .order_by(AgentMessage.created_at.asc(), AgentMessage.id.asc())
    )
    messages = list(messages_result.scalars().all())

    proposals_result = await db.execute(
        select(AgentActionProposal)
        .where(
            AgentActionProposal.owner_user_id == owner_user_id,
            AgentActionProposal.thread_id == thread_id,
        )
        .order_by(AgentActionProposal.created_at.asc(), AgentActionProposal.id.asc())
    )
    proposal_map: dict[int, list[AgentActionProposalOut]] = {}
    for proposal in proposals_result.scalars().all():
        proposal_map.setdefault(proposal.message_id, []).append(AgentActionProposalOut.model_validate(proposal))

    return [
        AgentMessageOut(
            id=message.id,
            thread_id=message.thread_id,
            role=message.role,
            content_md=message.content_md,
            tool_name=message.tool_name,
            tool_payload_json=message.tool_payload_json or {},
            created_at=message.created_at,
            action_proposals=proposal_map.get(message.id, []),
        )
        for message in messages
    ]


async def _load_pending_action_proposals_out(
    db: AsyncSession,
    owner_user_id: int,
    thread_id: int,
) -> list[AgentActionProposalOut]:
    result = await db.execute(
        select(AgentActionProposal)
        .where(
            AgentActionProposal.owner_user_id == owner_user_id,
            AgentActionProposal.thread_id == thread_id,
            AgentActionProposal.status == "pending",
        )
        .order_by(AgentActionProposal.created_at.asc(), AgentActionProposal.id.asc())
    )
    return [AgentActionProposalOut.model_validate(action) for action in result.scalars().all()]


async def _load_conversation_for_prompt(
    db: AsyncSession,
    owner_user_id: int,
    thread_id: int,
) -> list[dict[str, str]]:
    messages = await _load_thread_messages_out(db, owner_user_id, thread_id)
    formatted: list[dict[str, str]] = []
    for message in messages[-12:]:
        formatted.append(
            {
                "role": message.role,
                "content": message.content_md,
                "tool_name": message.tool_name or "",
            }
        )
    return formatted


def _ensure_workbench_agent_supported(agent: Agent) -> None:
    if agent.role not in SUPPORTED_WORKBENCH_ROLES:
        raise HTTPException(status_code=400, detail="当前角色暂不支持工作台对话")


async def _get_action_or_404(
    db: AsyncSession,
    owner_user_id: int,
    thread_id: int,
    action_id: int,
) -> AgentActionProposal:
    result = await db.execute(
        select(AgentActionProposal).where(
            AgentActionProposal.id == action_id,
            AgentActionProposal.thread_id == thread_id,
            AgentActionProposal.owner_user_id == owner_user_id,
        )
    )
    action = result.scalar_one_or_none()
    if action is None:
        raise HTTPException(status_code=404, detail="Action proposal not found")
    return action


def _build_workbench_system_prompt(agent: Agent, objective: str) -> str:
    preference_sections = build_agent_preference_sections(agent)
    sections = [
        "你是 NewsRoom 平台中的受控工作台 Agent。",
        objective,
        "你必须严格遵守已授权的 system skills，不得虚构不存在的工具。",
        "所有会改系统状态的操作必须通过 action proposal 返回，不能直接假装已经执行。",
        "输出必须是严格 JSON，不要使用 Markdown 代码块。",
    ]
    if preference_sections:
        sections.extend(preference_sections)
    return "\n\n".join(section for section in sections if section)


async def _generate_read_plan(
    agent: Agent,
    history: list[dict[str, str]],
    allowed_skills: list[str],
) -> dict[str, Any]:
    read_only_skills = [
        item for item in list_agent_skill_catalog()
        if item["key"] in allowed_skills and not item["requires_confirmation"]
    ]
    prompt = (
        "根据下面对话，决定回答前需要先读取哪些只读 skills。\n"
        "只返回 JSON，格式为:\n"
        "{\"read_tool_calls\":[{\"skill\":\"cards.list\",\"args\":{\"limit\":5}}],\"thread_title\":\"...\"}\n"
        "没有需要读取的工具时返回空数组。\n\n"
        f"可用只读 skills: {json.dumps(read_only_skills, ensure_ascii=False)}\n"
        f"最近对话: {json.dumps(history, ensure_ascii=False)}"
    )
    return await _generate_json(agent, _build_workbench_system_prompt(agent, "你现在负责做只读工具规划。"), prompt)


async def _generate_response_plan(
    agent: Agent,
    history: list[dict[str, str]],
    allowed_skills: list[str],
    tool_results: list[dict[str, Any]],
) -> dict[str, Any]:
    actionable_skills = [
        item for item in list_agent_skill_catalog()
        if item["key"] in allowed_skills and item["requires_confirmation"]
    ]
    prompt = (
        "根据下面的上下文，生成最终回复，并在必要时给出待确认的动作 proposals。\n"
        "只返回 JSON，格式为:\n"
        "{\"assistant_markdown\":\"...\",\"action_proposals\":[{\"action_type\":\"create_article_task\",\"title\":\"...\",\"summary\":\"...\",\"primary_cta_label\":\"创建任务\",\"payload\":{\"task_type\":\"summary\"}}]}\n"
        "如果没有需要确认的动作，action_proposals 返回空数组。\n"
        "如果用户只是询问已读取列表中有哪些项目，可以简洁列出名称或标题；不要复制完整长摘要或正文。\n"
        "当用户想“加来源并抓取”时，优先返回 create_source 动作；如果还需要后续抓取，请在 payload 里带上 follow_up_scrape=true。\n"
        "当用户想删除来源时，返回 delete_source 动作；系统配置、服务器管理、批量设置修改不在工作台支持范围内。\n"
        f"可用确认型 skills: {json.dumps(actionable_skills, ensure_ascii=False)}\n"
        f"最近对话: {json.dumps(history, ensure_ascii=False)}\n"
        f"只读工具结果: {json.dumps(tool_results, ensure_ascii=False)}"
    )
    return await _generate_json(agent, _build_workbench_system_prompt(agent, "你现在负责生成工作台回复和待确认动作。"), prompt)


def _safe_str(value: Any) -> str:
    return str(value or "").strip()


def _tool_result_items(result: dict[str, Any]) -> list[dict[str, Any]]:
    items = (result.get("payload") or {}).get("items") or []
    return [item for item in items if isinstance(item, dict)]


def _format_item_id(item: dict[str, Any]) -> str:
    item_id = _safe_int(item.get("id"))
    return f"#{item_id} " if item_id is not None else ""


def _shorten_for_reply(text: str, limit: int = 90) -> str:
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[:limit].rstrip()}..."


def _format_score(value: Any) -> str | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return f"{float(value):.2f}"


def _join_meta(parts: tuple[Any, ...]) -> str:
    cleaned = [_safe_str(part) for part in parts if _safe_str(part)]
    return f"（{', '.join(cleaned)}）" if cleaned else ""


def _format_active_status(value: Any) -> str:
    if value is True:
        return "启用"
    if value is False:
        return "停用"
    return ""


def _build_items_reply(
    *,
    title: str,
    empty: str,
    items: list[dict[str, Any]],
    name_keys: tuple[str, ...],
    meta_builder: Any | None = None,
) -> str:
    if not items:
        return empty
    lines = [title.format(count=len(items))]
    for item in items[:10]:
        name = next((_safe_str(item.get(key)) for key in name_keys if _safe_str(item.get(key))), "")
        if not name:
            name = _format_item_id(item).strip() or "未命名"
        meta = meta_builder(item) if meta_builder else ""
        lines.append(f"- {_format_item_id(item)}{name}{meta}")
    return "\n".join(lines)


def _build_read_tool_results_reply(tool_results: list[dict[str, Any]]) -> str | None:
    sections: list[str] = []
    for result in tool_results:
        skill = _safe_str(result.get("skill"))
        items = _tool_result_items(result)
        if skill == "cards.list":
            sections.append(
                _build_items_reply(
                    title="我看到了 {count} 张最新情报卡片：",
                    empty="我查看了最新情报卡片，目前列表为空。",
                    items=items,
                    name_keys=("title",),
                    meta_builder=lambda item: _join_meta((
                        item.get("category"),
                        _format_score(item.get("importance_score")),
                    )),
                )
            )
        elif skill == "cards.read":
            sections.append(
                _build_items_reply(
                    title="我读取到了 {count} 张卡片详情：",
                    empty="我没有读取到匹配的卡片详情。",
                    items=items,
                    name_keys=("title",),
                    meta_builder=lambda item: (
                        f"：{_shorten_for_reply(_safe_str(item.get('summary')))}"
                        if _safe_str(item.get("summary"))
                        else ""
                    ),
                )
            )
        elif skill == "sources.list":
            sections.append(
                _build_items_reply(
                    title="我看到了 {count} 个信号源：",
                    empty="我查看了信号源列表，目前还没有配置来源。",
                    items=items,
                    name_keys=("name", "url"),
                    meta_builder=lambda item: _join_meta((
                        item.get("source_type"),
                        _format_active_status(item.get("is_active")),
                    )),
                )
            )
        elif skill == "sources.read_recent_articles":
            source_id = _safe_int((result.get("payload") or {}).get("source_id"))
            sections.append(
                _build_items_reply(
                    title=f"来源 #{source_id} 最近读取到 {{count}} 篇文章：" if source_id is not None else "最近读取到 {count} 篇文章：",
                    empty="我没有读取到这个来源下的最近文章。",
                    items=items,
                    name_keys=("title", "url"),
                )
            )
        elif skill == "vault.inspirations.list":
            sections.append(
                _build_items_reply(
                    title="我看到了 {count} 条灵感模板：",
                    empty="我查看了灵感库，目前没有可用模板。",
                    items=items,
                    name_keys=("title", "hook_text"),
                    meta_builder=lambda item: (
                        f"（{_safe_str(item.get('platform'))}）"
                        if _safe_str(item.get("platform"))
                        else ""
                    ),
                )
            )
        elif _safe_str(result.get("summary")):
            sections.append(_safe_str(result.get("summary")))

    reply = "\n\n".join(section for section in sections if section).strip()
    return reply or None


async def _generate_json(agent: Agent, system_prompt: str, user_prompt: str) -> dict[str, Any]:
    model_ref = agent.model_ref or "gemini-2.5-flash"
    if model_ref.startswith("qwen"):
        client = AsyncOpenAI(
            api_key=agent.api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        )
        response = await client.chat.completions.create(
            model=model_ref,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=1400,
        )
        return _parse_json_object(response.choices[0].message.content or "{}")

    client = genai.Client(api_key=agent.api_key)
    response = await client.aio.models.generate_content(
        model=model_ref,
        contents=f"{system_prompt}\n\n{user_prompt}",
        config=types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=1400,
            response_mime_type="application/json",
        ),
    )
    return _parse_json_object(response.text or "{}")


def _normalize_tool_calls(
    raw_calls: Any,
    *,
    allowed_skills: list[str],
    permission_codes: set[str],
    require_confirmation: bool,
) -> list[dict[str, Any]]:
    if not isinstance(raw_calls, list):
        return []
    allowed = set(allowed_skills)
    normalized: list[dict[str, Any]] = []
    for item in raw_calls[:3]:
        if not isinstance(item, dict):
            continue
        skill = str(item.get("skill") or "").strip()
        if skill not in allowed or not _can_use_skill(
            skill,
            permission_codes=permission_codes,
            require_confirmation=require_confirmation,
        ):
            continue
        normalized.append({"skill": skill, "args": item.get("args") or {}})
    return normalized


def _can_use_skill(
    skill: str,
    *,
    permission_codes: set[str],
    require_confirmation: bool,
) -> bool:
    catalog_item = get_skill_catalog_item(skill)
    if not catalog_item:
        return False
    if bool(catalog_item.get("requires_confirmation")) != require_confirmation:
        return False
    permission_code = get_skill_permission_code(skill)
    return not permission_code or permission_code in permission_codes


def _is_source_list_intent(text: str) -> bool:
    return _contains_any(text, SOURCE_LIST_TERMS) or (
        _contains_any(text, SOURCE_REFERENCE_TERMS)
        and _contains_any(text, ["有哪些", "列表", "查看", "看下", "列出", "管理"])
    )


def _apply_read_tool_hints(
    prompt: str,
    calls: list[dict[str, Any]],
    *,
    allowed_skills: list[str],
    permission_codes: set[str],
) -> list[dict[str, Any]]:
    if (
        _is_source_list_intent(prompt)
        and "sources.list" in allowed_skills
        and _can_use_skill("sources.list", permission_codes=permission_codes, require_confirmation=False)
    ):
        source_call = {"skill": "sources.list", "args": {"limit": 10}}
        other_calls = [call for call in calls if call["skill"] not in {"sources.list", "cards.list"}]
        return [source_call, *other_calls][:3]
    return calls


def _contains_any(text: str, terms: list[str]) -> bool:
    normalized = (text or "").lower()
    return any(term.lower() in normalized for term in terms)


def _is_source_create_intent(text: str) -> bool:
    return _contains_any(text, SOURCE_CREATE_TERMS) and (
        _contains_any(text, SOURCE_REFERENCE_TERMS) or bool(_extract_first_url(text))
    )


def _is_source_scrape_intent(text: str) -> bool:
    return _contains_any(text, SOURCE_SCRAPE_TERMS)


def _is_source_delete_intent(text: str) -> bool:
    return _contains_any(text, SOURCE_DELETE_TERMS)


def _is_source_mutation_intent(text: str) -> bool:
    return _is_source_create_intent(text) or _is_source_scrape_intent(text) or _is_source_delete_intent(text)


def _extract_first_url(text: str) -> str:
    url_match = re.search(r"https?://\S+", text or "")
    return url_match.group(0).rstrip(".,)，。") if url_match else ""


def _extract_source_id_from_text(text: str) -> int | None:
    patterns = [
        r"source[_\s-]*id\s*[=:：]?\s*(\d+)",
        r"来源\s*(?:id|ID|#|编号)?\s*[=:：#]?\s*(\d+)",
        r"#\s*(\d+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text or "", re.IGNORECASE)
        if match:
            return _safe_int(match.group(1))
    return None


def _normalize_lookup_text(text: str) -> str:
    return re.sub(r"[\s\-_:/]+", "", (text or "").lower())


def _source_reference_payload(source: Source) -> dict[str, Any]:
    return {
        "source_id": source.id,
        "source_name": source.name,
        "source_url": source.url,
    }


async def _resolve_source_reference(
    db: AsyncSession,
    owner_user_id: int,
    prompt: str,
    tool_results: list[dict[str, Any]],
) -> dict[str, Any] | None:
    source_id = _extract_source_id_from_text(prompt) or _find_source_id_in_tool_results(prompt, tool_results)
    if source_id is not None:
        source = await get_source_or_404(db, owner_user_id, source_id)
        return _source_reference_payload(source)

    url = _extract_first_url(prompt)
    result = await db.execute(
        select(Source)
        .where(Source.owner_user_id == owner_user_id)
        .order_by(Source.created_at.desc())
    )
    sources = list(result.scalars().all())
    if url:
        for source in sources:
            if source.url.rstrip("/") == url.rstrip("/"):
                return _source_reference_payload(source)

    prompt_lower = (prompt or "").lower()
    normalized_prompt = _normalize_lookup_text(prompt)
    exact_matches = [
        source for source in sources
        if source.name and source.name.lower() in prompt_lower
    ]
    if len(exact_matches) == 1:
        return _source_reference_payload(exact_matches[0])

    normalized_matches = [
        source for source in sources
        if source.name and _normalize_lookup_text(source.name) in normalized_prompt
    ]
    if len(normalized_matches) == 1:
        return _source_reference_payload(normalized_matches[0])

    partial_matches = [
        source for source in sources
        if source.name and (
            source.name.lower() in prompt_lower
            or prompt_lower.strip() in source.name.lower()
        )
    ]
    if len(partial_matches) == 1:
        return _source_reference_payload(partial_matches[0])

    return None


def _extract_source_name_from_text(text: str, url: str) -> str:
    patterns = [
        r"(?:名称|名字|name)\s*(?:用|为|是|=|：|:)\s*([^，。,.；;\n]+)",
        r"(?:叫|命名为)\s*([^，。,.；;\n]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text or "", re.IGNORECASE)
        if match:
            name = match.group(1).strip().strip("\"'“”")
            if name:
                return name
    return _guess_source_name(url)


def _find_source_id_in_tool_results(prompt: str, tool_results: list[dict[str, Any]]) -> int | None:
    prompt_lower = (prompt or "").lower()
    url = _extract_first_url(prompt)
    for result in tool_results:
        items = (result.get("payload") or {}).get("items") or []
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            source_id = _safe_int(item.get("id"))
            if source_id is None:
                continue
            source_url = str(item.get("url") or "")
            source_name = str(item.get("name") or "")
            if url and source_url.rstrip("/") == url.rstrip("/"):
                return source_id
            if source_name and source_name.lower() in prompt_lower:
                return source_id
    return None


async def _find_recent_created_source_id(db: AsyncSession, owner_user_id: int, thread_id: int) -> int | None:
    result = await db.execute(
        select(AgentMessage)
        .where(
            AgentMessage.owner_user_id == owner_user_id,
            AgentMessage.thread_id == thread_id,
            AgentMessage.tool_name == "create_source",
        )
        .order_by(AgentMessage.created_at.desc(), AgentMessage.id.desc())
        .limit(1)
    )
    message = result.scalar_one_or_none()
    if not message:
        return None
    return _safe_int((message.tool_payload_json or {}).get("source_id"))


async def _latest_card_ids(db: AsyncSession, owner_user_id: int, tool_results: list[dict[str, Any]]) -> list[int]:
    for result in tool_results:
        items = (result.get("payload") or {}).get("items") or []
        if not isinstance(items, list):
            continue
        card_ids = [_safe_int(item.get("id")) for item in items if isinstance(item, dict)]
        card_ids = [card_id for card_id in card_ids if card_id is not None]
        if card_ids:
            return card_ids[:2]

    result = await db.execute(
        select(IntelligenceCard.id)
        .where(IntelligenceCard.owner_user_id == owner_user_id)
        .order_by(IntelligenceCard.created_at.desc())
        .limit(2)
    )
    return [card_id for card_id in result.scalars().all()]


async def _infer_fallback_action_proposals(
    *,
    db: AsyncSession,
    owner_user_id: int,
    thread_id: int,
    agent: Agent,
    allowed_skills: list[str],
    permission_codes: set[str],
    latest_prompt: str,
    tool_results: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], str | None]:
    prompt = latest_prompt or ""
    if _contains_any(prompt, ["系统配置", "服务器管理", "用户管理", "角色管理", "权限配置", "环境变量", "重启服务"]):
        return [], "系统配置、服务器管理和权限类操作暂不支持在工作台里执行。你可以到系统管理页面手动处理。"

    raw_actions: list[dict[str, Any]] = []
    if agent.role == "extractor":
        if _is_source_delete_intent(prompt):
            source_ref = (
                await _resolve_source_reference(db, owner_user_id, prompt, tool_results)
                or (
                    _source_reference_payload(await get_source_or_404(db, owner_user_id, recent_source_id))
                    if (recent_source_id := await _find_recent_created_source_id(db, owner_user_id, thread_id))
                    else None
                )
            )
            if source_ref is None:
                return [], "我可以帮你删除来源，但需要先确认是哪一个。你可以直接说来源名称（例如 theverge），也可以让我先列出来源。"
            raw_actions.append(
                {
                    "action_type": "delete_source",
                    "title": f"删除来源：{source_ref['source_name']}",
                    "summary": f"将删除“{source_ref['source_name']}”及其已抓取的原始文章，执行前需要你确认。",
                    "primary_cta_label": "确认删除",
                    "payload": source_ref,
                }
            )
        elif _is_source_scrape_intent(prompt):
            source_ref = (
                await _resolve_source_reference(db, owner_user_id, prompt, tool_results)
                or (
                    _source_reference_payload(await get_source_or_404(db, owner_user_id, recent_source_id))
                    if (recent_source_id := await _find_recent_created_source_id(db, owner_user_id, thread_id))
                    else None
                )
            )
            if source_ref is None:
                return [], "我可以帮你抓取来源，但需要先确认是哪一个。你可以直接说来源名称（例如 theverge），也可以让我先列出来源。"
            raw_actions.append(
                {
                    "action_type": "scrape_source",
                    "title": f"抓取来源：{source_ref['source_name']}",
                    "summary": f"将抓取“{source_ref['source_name']}”并导入最新文章，执行前需要你确认。",
                    "primary_cta_label": "开始抓取",
                    "payload": source_ref,
                }
            )
        elif _is_source_create_intent(prompt):
            url = _extract_first_url(prompt)
            if not url:
                return [], "我可以帮你创建 RSS 来源，但需要先提供完整的来源 URL。"
            raw_actions.append(
                {
                    "action_type": "create_source",
                    "title": f"创建来源：{_extract_source_name_from_text(prompt, url)}",
                    "summary": "将创建一个新的 RSS 来源，执行前需要你确认。",
                    "primary_cta_label": "创建来源",
                    "payload": {
                        "name": _extract_source_name_from_text(prompt, url),
                        "url": url,
                        "source_type": "rss",
                        "follow_up_scrape": _contains_any(prompt, ["抓取", "拉取", "采集"]),
                    },
                }
            )

    if agent.role == "writer" and _contains_any(prompt, ["创建", "生成", "写", "文章", "任务", "摘要"]):
        card_ids = _sanitize_int_list([int(match) for match in re.findall(r"(?:卡片|card|id|ID)\s*[#:=：]?\s*(\d+)", prompt)])
        if not card_ids:
            card_ids = await _latest_card_ids(db, owner_user_id, tool_results)
        if not card_ids:
            return [], "我可以创建写作任务，但需要先选择至少一张情报卡片。请让我查看最新卡片，或直接告诉我 card_id。"
        raw_actions.append(
            {
                "action_type": "create_article_task",
                "title": "创建写作任务",
                "summary": f"基于 {len(card_ids[:2])} 张情报卡片创建摘要任务，执行前需要你确认。",
                "primary_cta_label": "创建任务",
                "payload": {
                    "task_type": "summary",
                    "card_ids": card_ids[:2],
                    "source_task_ids": [],
                    "assigned_writer_id": agent.id,
                },
            }
        )

    normalized = _normalize_action_proposals(
        raw_actions,
        agent=agent,
        allowed_skills=allowed_skills,
        permission_codes=permission_codes,
        latest_prompt=latest_prompt,
    )
    if normalized:
        return normalized, "我已准备好待确认操作卡。请点击卡片里的确认按钮，执行后我会把结果显示在这里。"
    return [], None


def _normalize_action_proposals(
    raw_actions: Any,
    *,
    agent: Agent,
    allowed_skills: list[str],
    permission_codes: set[str],
    latest_prompt: str,
) -> list[dict[str, Any]]:
    if not isinstance(raw_actions, list):
        return []

    allowed = set(allowed_skills)
    normalized: list[dict[str, Any]] = []
    for item in raw_actions[:3]:
        if not isinstance(item, dict):
            continue
        action_type = str(item.get("action_type") or "").strip()
        if action_type not in {"create_source", "scrape_source", "delete_source", "create_article_task"}:
            continue

        skill_key = {
            "create_source": "sources.create",
            "scrape_source": "sources.scrape",
            "delete_source": "sources.delete",
            "create_article_task": "tasks.create_article",
        }[action_type]
        catalog_item = get_skill_catalog_item(skill_key)
        if not catalog_item or skill_key not in allowed:
            continue
        permission_code = get_skill_permission_code(skill_key)
        if permission_code and permission_code not in permission_codes:
            continue

        payload = item.get("payload") or {}
        if not isinstance(payload, dict):
            payload = {}

        if action_type == "create_source":
            payload = _normalize_create_source_payload(payload, latest_prompt)
            primary_cta_label = item.get("primary_cta_label") or "创建来源"
        elif action_type == "scrape_source":
            source_id = _safe_int(payload.get("source_id"))
            if source_id is None:
                continue
            payload = {
                "source_id": source_id,
                "source_name": payload.get("source_name"),
                "source_url": payload.get("source_url"),
            }
            primary_cta_label = item.get("primary_cta_label") or "开始抓取"
        elif action_type == "delete_source":
            source_id = _safe_int(payload.get("source_id"))
            if source_id is None:
                continue
            payload = {
                "source_id": source_id,
                "source_name": payload.get("source_name"),
                "source_url": payload.get("source_url"),
            }
            primary_cta_label = item.get("primary_cta_label") or "确认删除"
        else:
            payload = _normalize_create_task_payload(payload, agent.id)
            if not payload.get("card_ids") and not payload.get("source_task_ids"):
                continue
            primary_cta_label = item.get("primary_cta_label") or "创建任务"

        normalized.append(
            {
                "action_type": action_type,
                "payload_json": {
                    "title": str(item.get("title") or catalog_item["label"]),
                    "summary": str(item.get("summary") or catalog_item["description"]),
                    "requires_confirmation": True,
                    "action_type": action_type,
                    "primary_cta_label": str(primary_cta_label),
                    "payload": payload,
                },
            }
        )
    return normalized


def _normalize_create_source_payload(payload: dict[str, Any], latest_prompt: str) -> dict[str, Any]:
    url = str(payload.get("url") or "").strip()
    if not url:
        url_match = re.search(r"https?://\S+", latest_prompt)
        if url_match:
            url = url_match.group(0).rstrip(".,)")
    source_type = str(payload.get("source_type") or "rss").strip() or "rss"
    extractor_prompt = str(payload.get("extractor_prompt") or "").strip() or None
    follow_up_scrape = bool(payload.get("follow_up_scrape"))
    return {
        "name": str(payload.get("name") or _guess_source_name(url)),
        "url": url,
        "source_type": source_type,
        "extractor_prompt": extractor_prompt,
        "follow_up_scrape": follow_up_scrape,
    }


def _normalize_create_task_payload(payload: dict[str, Any], agent_id: int) -> dict[str, Any]:
    supported_task_types = {"summary", "daily_report", "deep_dive", "social_post", "multi_source_synthesis"}
    task_type = str(payload.get("task_type") or "summary").strip()
    if task_type not in supported_task_types:
        task_type = "summary"
    return {
        "task_type": task_type,
        "title": str(payload.get("title") or "").strip() or None,
        "card_ids": _sanitize_int_list(payload.get("card_ids")),
        "source_task_ids": _sanitize_int_list(payload.get("source_task_ids")),
        "custom_instructions": str(payload.get("custom_instructions") or "").strip() or None,
        "assigned_writer_id": agent_id,
    }


async def _execute_read_skill(
    db: AsyncSession,
    owner_user_id: int,
    skill: str,
    args: dict[str, Any],
) -> dict[str, Any]:
    if skill == "sources.list":
        result = await db.execute(
            select(Source)
            .where(Source.owner_user_id == owner_user_id)
            .order_by(Source.created_at.desc())
            .limit(min(max(_safe_int(args.get("limit")) or 10, 1), 20))
        )
        items = [
            {
                "id": source.id,
                "name": source.name,
                "url": source.url,
                "source_type": source.source_type,
                "is_active": source.is_active,
            }
            for source in result.scalars().all()
        ]
        return {
            "summary": f"已读取 {len(items)} 个来源。",
            "payload": {"items": items},
        }

    if skill == "sources.read_recent_articles":
        source_id = _safe_int(args.get("source_id"))
        if source_id is None:
            raise HTTPException(status_code=400, detail="sources.read_recent_articles 需要 source_id")
        limit = min(max(_safe_int(args.get("limit")) or 5, 1), 10)
        result = await db.execute(
            select(RawArticle)
            .where(
                RawArticle.owner_user_id == owner_user_id,
                RawArticle.source_id == source_id,
            )
            .order_by(RawArticle.fetched_at.desc().nullslast(), RawArticle.id.desc())
            .limit(limit)
        )
        items = [
            {
                "id": article.id,
                "title": article.title,
                "url": article.url,
                "published_at": article.published_at.isoformat() if article.published_at else None,
            }
            for article in result.scalars().all()
        ]
        return {
            "summary": f"已读取来源 #{source_id} 最近 {len(items)} 篇文章。",
            "payload": {"source_id": source_id, "items": items},
        }

    if skill == "cards.list":
        limit = min(max(_safe_int(args.get("limit")) or 8, 1), 20)
        result = await db.execute(
            select(IntelligenceCard)
            .where(IntelligenceCard.owner_user_id == owner_user_id)
            .order_by(IntelligenceCard.created_at.desc())
            .limit(limit)
        )
        items = [
            {
                "id": card.id,
                "title": card.title,
                "summary": card.summary,
                "category": card.category,
                "importance_score": card.importance_score,
            }
            for card in result.scalars().all()
        ]
        return {
            "summary": f"已读取 {len(items)} 张最新情报卡片。",
            "payload": {"items": items},
        }

    if skill == "cards.read":
        card_ids = _sanitize_int_list(args.get("card_ids"))
        if not card_ids:
            raise HTTPException(status_code=400, detail="cards.read 需要 card_ids")
        result = await db.execute(
            select(IntelligenceCard)
            .where(
                IntelligenceCard.owner_user_id == owner_user_id,
                IntelligenceCard.id.in_(card_ids),
            )
            .order_by(IntelligenceCard.created_at.desc())
        )
        items = [
            {
                "id": card.id,
                "title": card.title,
                "summary": card.summary,
                "key_points": list(card.key_points or []),
                "source_urls": list(card.source_urls or []),
            }
            for card in result.scalars().all()
        ]
        return {
            "summary": f"已读取 {len(items)} 张卡片详情。",
            "payload": {"items": items},
        }

    if skill == "vault.inspirations.list":
        limit = min(max(_safe_int(args.get("limit")) or 8, 1), 20)
        result = await db.execute(
            select(InspirationAsset)
            .where(InspirationAsset.owner_user_id == owner_user_id)
            .order_by(InspirationAsset.created_at.desc())
            .limit(limit)
        )
        items = [
            {
                "id": inspiration.id,
                "title": inspiration.title,
                "hook_text": inspiration.hook_text,
                "platform": inspiration.platform,
            }
            for inspiration in result.scalars().all()
        ]
        return {
            "summary": f"已读取 {len(items)} 条灵感模板。",
            "payload": {"items": items},
        }

    raise HTTPException(status_code=400, detail=f"Unsupported read skill: {skill}")


async def _execute_action(
    db: AsyncSession,
    owner_user_id: int,
    thread: AgentThread,
    action: AgentActionProposal,
) -> tuple[dict[str, Any], str, dict[str, Any] | None]:
    payload = dict(action.payload_json or {})
    data = dict(payload.get("payload") or {})
    if action.action_type == "create_source":
        if not data.get("url"):
            raise HTTPException(status_code=400, detail="来源链接不能为空")
        source = await create_source(
            db,
            owner_user_id,
            SourceCreate(
                name=data.get("name") or _guess_source_name(data["url"]),
                url=data["url"],
                source_type=data.get("source_type") or "rss",
                extractor_prompt=data.get("extractor_prompt"),
            ),
        )
        result_json = {
            "source_id": source.id,
            "source_name": source.name,
            "source_url": source.url,
            "redirect_path": "/sources",
        }
        followup = None
        if data.get("follow_up_scrape"):
            followup = {
                "message": f"来源“{source.name}”已创建。如果你现在就想抓取它，请确认下面这个动作。",
                "action_type": "scrape_source",
                "payload_json": {
                    "title": "抓取新来源",
                    "summary": f"立即抓取来源“{source.name}”并导入最新文章。",
                    "requires_confirmation": True,
                    "action_type": "scrape_source",
                    "primary_cta_label": "开始抓取",
                    "payload": {"source_id": source.id},
                },
            }
        return result_json, f"已创建来源：{source.name}（#{source.id}）", followup

    if action.action_type == "scrape_source":
        source_id = _safe_int(data.get("source_id"))
        if source_id is None:
            raise HTTPException(status_code=400, detail="source_id 无效")
        source = await get_source_or_404(db, owner_user_id, source_id)
        result = await trigger_source_scrape(db, owner_user_id, source_id)
        return {
            "source_id": source_id,
            "source_name": source.name,
            "source_url": source.url,
            "job_id": result["job_id"],
            "redirect_path": "/sources",
        }, f"已为来源“{source.name}”（#{source_id}）发起抓取任务。", None

    if action.action_type == "delete_source":
        source_id = _safe_int(data.get("source_id"))
        if source_id is None:
            raise HTTPException(status_code=400, detail="source_id 无效")
        source = await get_source_or_404(db, owner_user_id, source_id)
        source_name = source.name
        source_url = source.url
        await delete_source(db, owner_user_id, source_id)
        return {
            "source_id": source_id,
            "source_name": source_name,
            "source_url": source_url,
            "redirect_path": "/sources",
        }, f"已删除来源：{source_name}（#{source_id}）", None

    if action.action_type == "create_article_task":
        task_payload = TaskCreate(
            task_type=data.get("task_type") or "summary",
            title=data.get("title"),
            card_ids=_sanitize_int_list(data.get("card_ids")),
            source_task_ids=_sanitize_int_list(data.get("source_task_ids")),
            config={
                "assigned_writer_id": _safe_int(data.get("assigned_writer_id")),
                "custom_instructions": data.get("custom_instructions"),
            },
        )
        task = await create_task(db, owner_user_id, task_payload)
        thread.linked_task_id = task.id
        return {
            "task_id": task.id,
            "redirect_path": f"/editor/{task.id}",
        }, f"已创建写作任务 TSK-{task.id}，可以进入编辑器继续加工。", None

    raise HTTPException(status_code=400, detail=f"Unsupported action type: {action.action_type}")
