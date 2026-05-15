"""Centralized registry for OpenAI-compatible LLM providers.

Qwen (DashScope) and DeepSeek both use the OpenAI SDK with different
base_urls. This module avoids duplicating client-creation code across
every service file.
"""

from __future__ import annotations

from dataclasses import dataclass

from openai import AsyncOpenAI


@dataclass(frozen=True)
class OpenAICompatProvider:
    prefix: str  # model name prefix to match, e.g. "qwen", "deepseek"
    base_url: str  # API base URL
    name: str  # short label, e.g. "alibaba", "deepseek"


# Ordered by specificity (longest prefix first avoids false matches)
_REGISTRY: list[OpenAICompatProvider] = [
    OpenAICompatProvider(
        prefix="qwen",
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        name="alibaba",
    ),
    OpenAICompatProvider(
        prefix="deepseek",
        base_url="https://api.deepseek.com/v1",
        name="deepseek",
    ),
]


def match_provider(model_ref: str) -> OpenAICompatProvider | None:
    """Return the matching OpenAI-compatible provider, or None for Gemini."""
    for p in _REGISTRY:
        if model_ref.startswith(p.prefix):
            return p
    return None


def is_openai_compatible(model_ref: str) -> bool:
    return match_provider(model_ref) is not None


def is_deepseek(model_ref: str) -> bool:
    return model_ref.startswith("deepseek")


def get_client(model_ref: str, api_key: str) -> AsyncOpenAI | None:
    """Create an AsyncOpenAI client for the matching provider.
    Returns None if model_ref is not OpenAI-compatible (i.e. it's Gemini)."""
    provider = match_provider(model_ref)
    if provider is None:
        return None
    return AsyncOpenAI(api_key=api_key, base_url=provider.base_url)
