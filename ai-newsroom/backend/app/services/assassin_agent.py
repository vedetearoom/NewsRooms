import json
from google import genai
from google.genai import types
from google.genai.types import ThinkingConfig
from app.config import get_settings

CRITIQUE_PROMPT = """You are "The Assassin" — a ruthless editorial critic. Your job is to find every weakness in a draft and demand improvement.

Review the following draft and output STRICTLY as JSON with this exact structure:
{
  "critiques": [
    {
      "target_quote": "exact sentence or phrase from the draft that is weak",
      "critique": "why this is weak (be specific and brutal)",
      "suggestion": "the improved replacement text"
    }
  ],
  "overall_score": 7.5,
  "overall_comment": "One paragraph overall assessment"
}

Rules:
- target_quote MUST be an EXACT substring from the draft (character-for-character match)
- Find 3-8 issues. Focus on: vague claims, missing data, logical gaps, fluff, weak verbs, passive voice
- overall_score: 1-10 scale (10 = perfect, rare)
- Be constructive but unsparing
- Output ONLY valid JSON, no markdown fences, no extra text

Task type: {task_type}

Draft to review:
"""

REVISE_PROMPT = """You are a senior editor. Apply these specific editorial fixes to the draft below.

For each critique, replace the target_quote with the suggestion. Keep everything else unchanged.
Return ONLY the revised full text in Markdown format, nothing else.

Critiques to apply:
{critiques}

Original draft:
{draft}
"""

REVISE_STANDALONE_PROMPT = """You are a senior editor performing a single-pass editorial polish.

Read the draft below. Independently identify weak phrasing, vague claims, passive voice, fluff, and logical gaps, then fix them in-place.

Rules:
- Return ONLY the revised full text in Markdown format, nothing else.
- Preserve all headings, structure, and main arguments.
- Do NOT add new sections or remove existing ones.
- Fix language quality, tighten prose, strengthen verbs, add specificity.
- Keep the same approximate length.

Original draft:
{draft}
"""


class AssassinAgent:
    """Reviews drafts and produces structured critiques using Gemini."""

    def __init__(self, api_key: str = None):
        self.api_key = api_key
        if not api_key:
            raise Exception("Reviewer agent API key is not configured.")
        self.client = genai.Client(api_key=api_key)

    @staticmethod
    def _build_qwen_request_kwargs(*, structured_output: bool = False) -> dict:
        kwargs: dict = {
            "extra_body": {
                # Reviewer flows are non-streaming and often rely on strict JSON/text output.
                # Force-disable mixed thinking mode so Qwen returns directly usable content.
                "enable_thinking": False,
            }
        }
        if structured_output:
            kwargs["response_format"] = {"type": "json_object"}
        return kwargs

    async def review(self, draft_content: str, task_type: str = "daily_report", target_language: str = "en", agent_prompt: str = None, agent_context: str = None, model_ref: str = "gemini-2.5-flash") -> dict:
        base_prompt = agent_prompt if agent_prompt else "You are \"The Assassin\" — a ruthless editorial critic."
        structure_prompt = CRITIQUE_PROMPT.replace("{task_type}", task_type)
        
        prompt = f"{base_prompt}\n\n=== TASK FORMAT REQUIREMENTS ===\n{structure_prompt}"
        
        if agent_context:
            prompt += f"\n\n=== KNOWLEDGE & EXAMPLES ===\n{agent_context}\n=====================\n"

        if target_language == "zh":
            prompt += "\n\nCRITICAL: Review the text strictly in Simplified Chinese. Use a sharp, professional journalistic tone (e.g., use terms like '缺乏事实支撑', '过于啰嗦', '建议删减'). Provide all suggestion text in Simplified Chinese."
        else:
            prompt += "\n\nCRITICAL: Review the text strictly in English."

        from app.services.llm_client import get_client, is_deepseek
        oai_client = get_client(model_ref, self.api_key)
        if oai_client is not None:
            if is_deepseek(model_ref):
                kwargs = {"response_format": {"type": "json_object"}}
            else:
                kwargs = self._build_qwen_request_kwargs(structured_output=True)
            response = await oai_client.chat.completions.create(
                model=model_ref,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": draft_content}
                ],
                temperature=0.3,
                max_tokens=4096,
                **kwargs,
            )
            text = (response.choices[0].message.content or "").strip()
        else:
            response = await self.client.aio.models.generate_content(
                model=model_ref,
                contents=prompt + draft_content,
                config=types.GenerateContentConfig(
                    max_output_tokens=4096,
                    temperature=0.3,
                    response_mime_type="application/json",
                    thinking_config=ThinkingConfig(thinking_budget=0),
                ),
            )
            text = response.text.strip()
        # Try to parse JSON
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
            return {
                "critiques": [],
                "overall_score": 5.0,
                "overall_comment": "Failed to parse critique output.",
            }

    async def revise(self, draft_content: str, critiques: list, agent_prompt: str = None, agent_context: str = None, model_ref: str = "gemini-2.5-flash") -> str:
        critiques_text = json.dumps(critiques, indent=2)
        
        base_prompt = agent_prompt if agent_prompt else "You are a senior editor."
        prompt = f"{base_prompt}\n\n=== TASK FORMAT REQUIREMENTS ===\n{REVISE_PROMPT.format(critiques=critiques_text, draft=draft_content)}"
        
        if agent_context:
            prompt += f"\n\n=== KNOWLEDGE & EXAMPLES ===\n{agent_context}\n=====================\n"

        from app.services.llm_client import get_client
        oai_client = get_client(model_ref, self.api_key)
        if oai_client is not None:
            response = await oai_client.chat.completions.create(
                model=model_ref,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": "Please revise the draft without adding any explanations."}
                ],
                temperature=0.3,
                max_tokens=4096,
                **self._build_qwen_request_kwargs(),
            )
            return (response.choices[0].message.content or "").strip()
        else:
            response = await self.client.aio.models.generate_content(
                model=model_ref,
                contents=prompt,
                config=types.GenerateContentConfig(
                    max_output_tokens=4096,
                    temperature=0.3,
                    thinking_config=ThinkingConfig(thinking_budget=0),
                ),
            )
            return response.text.strip()

    async def revise_standalone(self, draft_content: str, agent_prompt: str = None, agent_context: str = None, model_ref: str = "gemini-2.5-flash", target_language: str = "en") -> str:
        """Independently polish the draft without needing critique results. Used for parallel execution."""
        base_prompt = agent_prompt if agent_prompt else "You are a senior editor."
        prompt = f"{base_prompt}\n\n=== TASK FORMAT REQUIREMENTS ===\n{REVISE_STANDALONE_PROMPT.format(draft=draft_content)}"
        
        if agent_context:
            prompt += f"\n\n=== KNOWLEDGE & EXAMPLES ===\n{agent_context}\n=====================\n"

        if target_language == "zh":
            prompt += "\n\nCRITICAL: The draft is in Simplified Chinese. You MUST output the revised text strictly in Simplified Chinese. Do not mix languages."
        else:
            prompt += "\n\nCRITICAL: Output the revised text strictly in English."

        from app.services.llm_client import get_client
        oai_client = get_client(model_ref, self.api_key)
        if oai_client is not None:
            response = await oai_client.chat.completions.create(
                model=model_ref,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": "Please polish and revise the draft. Return only the revised text."}
                ],
                temperature=0.3,
                max_tokens=4096,
                **self._build_qwen_request_kwargs(),
            )
            return (response.choices[0].message.content or "").strip()
        else:
            response = await self.client.aio.models.generate_content(
                model=model_ref,
                contents=prompt,
                config=types.GenerateContentConfig(
                    max_output_tokens=4096,
                    temperature=0.3,
                    thinking_config=ThinkingConfig(thinking_budget=0),
                ),
            )
            return response.text.strip()
