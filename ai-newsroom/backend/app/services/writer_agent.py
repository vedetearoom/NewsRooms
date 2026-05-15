from google import genai
from google.genai import types
from google.genai.types import ThinkingConfig
from app.config import get_settings
from typing import AsyncGenerator

TASK_PROMPTS = {
    "daily_report": """You are a senior intelligence analyst writing a daily AI briefing report.

Based on the following intelligence cards, write a comprehensive yet concise daily report in Markdown format.

IMPORTANT: Do NOT include a top-level title (# heading). The title is managed separately. Start directly with the report body.

Structure:
## Executive Summary
(2-3 sentences on the most important developments)

## Key Stories

### 1. [Story Title]
(3-5 paragraphs with analysis, implications, and context)

### 2. [Story Title]
...

## Trends & Signals
(Bullet points on emerging patterns)

## What to Watch
(Forward-looking items)

---

Write with authority. Be analytical, not just descriptive. Include specific data points and quotes where available. Use bold for emphasis on key terms.""",

    "twitter_thread": """You are a tech-savvy social media strategist. Transform the intelligence cards into an engaging Twitter/X thread.

IMPORTANT: Do NOT include a top-level title (# heading). Start directly with the thread content.

Format each tweet as a numbered item (1/, 2/, etc.). Use:
- Hook in the first tweet
- Key facts and data points
- Emoji for visual breaks (sparingly)
- End with a call-to-action

Keep each tweet under 280 characters. Write 8-12 tweets.""",

    "newsletter": """You are an editor writing a weekly newsletter for tech professionals.

IMPORTANT: Do NOT include a top-level title (# heading). The title is managed separately. Start directly with the first section.

Write in a conversational, insightful tone. Structure:
## The Big Story
(Deep dive into the most important development)

## Quick Hits
(Brief coverage of other notable stories)

## Why It Matters
(Analysis connecting the dots)

## One More Thing
(An interesting/surprising tidbit)""",

    "deep_dive": """You are a technology analyst writing an in-depth analysis piece.

IMPORTANT: Do NOT include a top-level title (# heading). The title is managed separately. Start directly with the analysis body.

Pick the most significant topic from the intelligence cards and write a thorough analysis (800-1200 words). Include:
- Context and background
- Technical details explained clearly
- Industry implications
- Potential risks and opportunities
- Expert perspective

Write in a professional but accessible tone.""",

    "summary": """You are an executive assistant preparing a brief summary.

IMPORTANT: Do NOT include a top-level title (# heading). The title is managed separately. Start directly with the summary body.

Create a concise executive summary (300-500 words) of the key intelligence items. Focus on actionable insights and strategic implications. Use bullet points for clarity.""",

    "social_post": """You are a top-tier social media strategist and copywriter.

IMPORTANT: Do NOT include a top-level title (# heading). Start directly with the content.

If the provided intelligence cards contain video extraction data (e.g., Hook Analysis and Template Skeleton), you MUST strictly apply their underlying logical skeleton to reconstruct the text for social media platforms (like Xiaohongshu, Twitter/X, or LinkedIn). Adapt the tone to be engaging, punchy, and highly shareable based on the core narrative arc and hooks provided.""",

    "multi_source_synthesis": """You are an advanced creative synthesis engine. Your goal is to map factual intelligence (The "Flesh") onto designated structural skeletons (The "Bones").

IMPORTANT: Do NOT include a top-level title (# heading). Start directly with the content.

<SYNTHESIS_OBJECTIVE>
You will receive <FACTS> containing facts/data and one or more <SKELETON_TEMPLATE> defining a narrative structure, pacing, and style.
You must discard the original presentation of the FACTS and completely reinvent them to fit seamlessly into the exact structural flow of the SKELETON_TEMPLATE.
Preserve the tone, hook mechanics, and rhetorical devices of the template while replacing its subject matter entirely with the provided facts.
</SYNTHESIS_OBJECTIVE>"""
}


class WriterAgent:
    """Streams long-form content generation using Gemini."""

    def __init__(self, api_key: str = None):
        from app.config import get_settings
        settings = get_settings()
        self.api_key = api_key

        # We don't initialize genai.Client if we only have qwen/deepseek key and no gemini key
        self.gemini_key = self.api_key or settings.gemini_api_key
        self.qwen_key = self.api_key or settings.qwen_api_key
        self.deepseek_key = self.api_key or settings.deepseek_api_key

        if not self.gemini_key and not self.qwen_key and not self.deepseek_key:
            raise Exception("Writer agent API key is not configured for any model.")

        if self.gemini_key:
            self.client = genai.Client(api_key=self.gemini_key)
        else:
            self.client = None

    async def generate(
        self,
        task_type: str,
        cards: list,
        inspirations: list = None,
        config: dict = {},
        agent_prompt: str = None,
        agent_context: str = None,
        model_ref: str = "gemini-2.5-flash",
    ) -> AsyncGenerator[str, None]:
        task_structure_prompt = TASK_PROMPTS.get(task_type, TASK_PROMPTS["daily_report"])
        
        system_prompt = agent_prompt if agent_prompt else task_structure_prompt
        if agent_prompt:
            system_prompt += f"\n\n=== TASK FORMAT REQUIREMENTS ===\n{task_structure_prompt}"
            
        if agent_context:
            system_prompt += f"\n\n=== KNOWLEDGE & EXAMPLES ===\n{agent_context}\n=====================\n"
        
        target_language = config.get("language", "en")
        if target_language == "zh":
            system_prompt += "\n\nCRITICAL: You MUST output the entire response, including all headings and body text, strictly in Simplified Chinese. Do not mix languages."
        else:
            system_prompt += "\n\nCRITICAL: You MUST output the entire response strictly in English."

        # Build context from cards
        context = "\n\n".join([
            f"**{card.title}**\n{card.summary}\n- Key points: {', '.join(card.key_points or [])}\n- Tags: {', '.join(card.tags or [])}\n- Importance: {card.importance_score}"
            for card in cards
        ])

        if not context:
            context = "No intelligence cards provided. Write a general overview based on recent AI developments."

        skeleton_context = ""
        if inspirations:
            skeleton_context = "\n\n".join([
                f"<SKELETON_TEMPLATE platform=\"{insp.platform}\">\n<HOOK>{insp.hook_text}</HOOK>\n<TECHNIQUE>{insp.hook_technique}</TECHNIQUE>\n<STRUCTURE>\n{insp.template_skeleton}\n</STRUCTURE>\n</SKELETON_TEMPLATE>"
                for insp in inspirations if insp.template_skeleton
            ])

        from datetime import date
        user_message = f"Today's date: {date.today().isoformat()}\n\n<FACTS>\n{context}\n</FACTS>"
        if skeleton_context:
            user_message += f"\n\n{skeleton_context}"

        plugin_context = str(config.get("plugin_context_markdown", "") or "").strip()
        if plugin_context:
            user_message += f"\n\n<PLUGIN_CONTEXT>\n{plugin_context}\n</PLUGIN_CONTEXT>"

        plugin_artifacts = config.get("plugin_artifact_manifest") or []
        if plugin_artifacts:
            artifact_lines = "\n".join(f"- {artifact}" for artifact in plugin_artifacts)
            user_message += f"\n\n<PLUGIN_ARTIFACTS>\n{artifact_lines}\n</PLUGIN_ARTIFACTS>"

        if config.get("custom_instructions"):
            user_message += f"\n\nAdditional instructions: {config['custom_instructions']}"

        from app.services.llm_client import get_client
        oai_client = get_client(model_ref, self.api_key)
        if oai_client is not None:
            if not self.api_key:
                raise Exception(f"API key is not configured for model {model_ref}.")
            response = await oai_client.chat.completions.create(
                model=model_ref,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.7,
                stream=True
            )
            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        else:
            if not self.client:
                raise Exception("Gemini API key is not configured.")

            stream = await self.client.aio.models.generate_content_stream(
                model=model_ref,
                contents=f"{system_prompt}\n\n{user_message}",
                config=types.GenerateContentConfig(
                    max_output_tokens=8192,
                    temperature=0.7,
                ),
            )
            async for chunk in stream:
                if chunk.text:
                    yield chunk.text
