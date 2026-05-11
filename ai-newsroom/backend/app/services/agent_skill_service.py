from __future__ import annotations

from copy import deepcopy


SKILL_CATALOG: list[dict] = [
    {
        "key": "sources.list",
        "label": "来源列表",
        "description": "查看当前用户已配置的 RSS / Web 来源。",
        "roles": ["extractor", "writer"],
        "requires_confirmation": False,
        "permission_code": "network.view",
        "parameters": [],
    },
    {
        "key": "sources.create",
        "label": "创建来源",
        "description": "新建一个正式持久的 RSS / Web 来源。",
        "roles": ["extractor"],
        "requires_confirmation": True,
        "permission_code": "network.view",
        "parameters": [
            {"name": "name", "label": "名称", "type": "string", "required": True},
            {"name": "url", "label": "链接", "type": "string", "required": True},
            {"name": "source_type", "label": "类型", "type": "string", "required": False},
            {"name": "extractor_prompt", "label": "提取指令", "type": "string", "required": False},
        ],
    },
    {
        "key": "sources.scrape",
        "label": "抓取来源",
        "description": "对一个已存在的来源发起抓取任务。",
        "roles": ["extractor"],
        "requires_confirmation": True,
        "permission_code": "network.view",
        "parameters": [
            {"name": "source_id", "label": "来源 ID", "type": "integer", "required": True},
        ],
    },
    {
        "key": "sources.delete",
        "label": "删除来源",
        "description": "删除一个已存在的来源及其已抓取的原始文章。",
        "roles": ["extractor"],
        "requires_confirmation": True,
        "permission_code": "network.view",
        "parameters": [
            {"name": "source_id", "label": "来源 ID", "type": "integer", "required": True},
        ],
    },
    {
        "key": "sources.read_recent_articles",
        "label": "查看最近文章",
        "description": "读取某个来源最近抓取到的文章标题和链接。",
        "roles": ["extractor"],
        "requires_confirmation": False,
        "permission_code": "network.view",
        "parameters": [
            {"name": "source_id", "label": "来源 ID", "type": "integer", "required": True},
            {"name": "limit", "label": "数量", "type": "integer", "required": False},
        ],
    },
    {
        "key": "cards.list",
        "label": "查看情报卡片",
        "description": "查看当前 Inbox / 情报卡片列表。",
        "roles": ["writer"],
        "requires_confirmation": False,
        "permission_code": "discover.view",
        "parameters": [
            {"name": "limit", "label": "数量", "type": "integer", "required": False},
        ],
    },
    {
        "key": "cards.read",
        "label": "读取卡片详情",
        "description": "按 ID 读取一组情报卡片详情。",
        "roles": ["writer"],
        "requires_confirmation": False,
        "permission_code": "discover.view",
        "parameters": [
            {"name": "card_ids", "label": "卡片 ID", "type": "integer[]", "required": True},
        ],
    },
    {
        "key": "vault.inspirations.list",
        "label": "查看灵感模板",
        "description": "查看灵感库中可用的模板或素材骨架。",
        "roles": ["writer"],
        "requires_confirmation": False,
        "permission_code": "workspace.view",
        "parameters": [
            {"name": "limit", "label": "数量", "type": "integer", "required": False},
        ],
    },
    {
        "key": "tasks.create_article",
        "label": "创建写作任务",
        "description": "创建一个正式 Task，并交给当前 writer 进入编辑器。",
        "roles": ["writer"],
        "requires_confirmation": True,
        "permission_code": "workspace.view",
        "parameters": [
            {"name": "task_type", "label": "任务类型", "type": "string", "required": True},
            {"name": "card_ids", "label": "卡片 ID", "type": "integer[]", "required": False},
            {"name": "source_task_ids", "label": "来源任务 ID", "type": "integer[]", "required": False},
            {"name": "title", "label": "标题", "type": "string", "required": False},
            {"name": "custom_instructions", "label": "补充指令", "type": "string", "required": False},
        ],
    },
]

DEFAULT_ROLE_SKILLS: dict[str, list[str]] = {
    "extractor": [
        "sources.list",
        "sources.create",
        "sources.scrape",
        "sources.delete",
        "sources.read_recent_articles",
    ],
    "writer": [
        "sources.list",
        "cards.list",
        "cards.read",
        "vault.inspirations.list",
        "tasks.create_article",
    ],
}


def list_agent_skill_catalog() -> list[dict]:
    return deepcopy(SKILL_CATALOG)


def get_default_system_skills_for_role(role: str | None) -> list[str]:
    return list(DEFAULT_ROLE_SKILLS.get(role or "", []))


def get_allowed_skill_keys_for_role(role: str | None) -> set[str]:
    role_value = role or ""
    return {item["key"] for item in SKILL_CATALOG if role_value in item.get("roles", [])}


def normalize_agent_system_skills(role: str | None, system_skills: list[str] | None) -> list[str]:
    allowed = get_allowed_skill_keys_for_role(role)
    requested = system_skills if system_skills is not None else get_default_system_skills_for_role(role)
    deduped: list[str] = []
    for skill in requested:
        if skill in allowed and skill not in deduped:
            deduped.append(skill)
    return deduped


def get_skill_catalog_item(skill_key: str) -> dict | None:
    for item in SKILL_CATALOG:
        if item["key"] == skill_key:
            return deepcopy(item)
    return None


def get_skill_permission_code(skill_key: str) -> str | None:
    item = get_skill_catalog_item(skill_key)
    return item.get("permission_code") if item else None
