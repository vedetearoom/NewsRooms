"""Seed endpoint for demo data — extracted from main.py to keep the entrypoint clean."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.auth_service import require_permission
from app.services.quota_service import ARTICLE_CARDS, TEXT_SOURCES, ensure_resource_quota

router = APIRouter(prefix="/api", tags=["seed"])


@router.post("/seed")
async def seed_demo_data(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("system.manage")),
):
    """Seed the database with demo intelligence cards for testing the UI."""
    from datetime import date
    from app.models import IntelligenceCard, Source

    demo_sources = [
        Source(
            owner_user_id=current_user.id,
            name="TechCrunch AI",
            url="https://techcrunch.com/category/artificial-intelligence/feed/",
            source_type="rss",
        ),
        Source(
            owner_user_id=current_user.id,
            name="The Verge AI",
            url="https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
            source_type="rss",
        ),
        Source(
            owner_user_id=current_user.id,
            name="MIT Tech Review",
            url="https://www.technologyreview.com/feed/",
            source_type="rss",
        ),
        Source(
            owner_user_id=current_user.id,
            name="Ars Technica AI",
            url="https://feeds.arstechnica.com/arstechnica/technology-lab",
            source_type="rss",
        ),
    ]
    demo_cards = [
        IntelligenceCard(
            owner_user_id=current_user.id,
            title="OpenAI Launches GPT-5 with Revolutionary Reasoning",
            summary="OpenAI has unveiled GPT-5, featuring a new architecture that enables multi-step reasoning and real-time web access. The model demonstrates significant improvements in math, coding, and complex analytical tasks, while reducing hallucination rates by 40%.",
            key_points=["40% reduction in hallucinations", "Native web browsing capability", "New pricing tier at $50/month for Pro", "Available via API immediately"],
            source_urls=["https://techcrunch.com/gpt5-launch", "https://openai.com/blog/gpt5"],
            tags=["OpenAI", "GPT-5", "LLM", "Product Launch"],
            category="AI",
            importance_score=0.95,
            published_date=date.today(),
        ),
        IntelligenceCard(
            owner_user_id=current_user.id,
            title="EU AI Act Enforcement Begins: First Fines Issued",
            summary="The European Union has issued its first enforcement actions under the AI Act, fining three companies for deploying high-risk AI systems without proper documentation. This signals a new era of AI regulation with real consequences.",
            key_points=["€15M in total fines across 3 companies", "Violations related to transparency requirements", "Grace period for existing systems ends next month", "Other jurisdictions watching closely"],
            source_urls=["https://reuters.com/eu-ai-act-fines"],
            tags=["EU", "Regulation", "AI Act", "Compliance"],
            category="Policy",
            importance_score=0.88,
            published_date=date.today(),
        ),
        IntelligenceCard(
            owner_user_id=current_user.id,
            title="Anthropic Raises $5B at $60B Valuation",
            summary="Anthropic has closed a $5 billion funding round led by major institutional investors, valuing the company at $60 billion. The funds will be used to scale compute infrastructure and accelerate the development of Claude's next generation.",
            key_points=["$5B raised in Series E", "$60B post-money valuation", "Funds earmarked for compute and safety research", "Revenue reportedly exceeding $2B ARR"],
            source_urls=["https://bloomberg.com/anthropic-funding"],
            tags=["Anthropic", "Funding", "Claude", "Startup"],
            category="Business",
            importance_score=0.85,
            published_date=date.today(),
        ),
        IntelligenceCard(
            owner_user_id=current_user.id,
            title="Google DeepMind Achieves Breakthrough in Protein-Drug Interaction Prediction",
            summary="DeepMind's latest AlphaFold iteration can now predict how proteins interact with potential drug molecules with 92% accuracy, potentially cutting drug discovery timelines from years to months.",
            key_points=["92% accuracy in drug-protein binding prediction", "Partnership with Novartis and Roche", "Could reduce drug development costs by 60%", "Open-source release planned for Q3"],
            source_urls=["https://deepmind.google/alphafold-drug"],
            tags=["DeepMind", "AlphaFold", "Drug Discovery", "Biotech"],
            category="Science",
            importance_score=0.82,
            published_date=date.today(),
        ),
        IntelligenceCard(
            owner_user_id=current_user.id,
            title="NVIDIA Unveils B300 GPU: 3x Performance for AI Training",
            summary="NVIDIA announced the Blackwell B300 GPU architecture with 3x performance improvement for large model training. The chip features 288GB HBM4 memory and new sparsity optimizations that could halve training costs for frontier models.",
            key_points=["3x training throughput vs H100", "288GB HBM4 memory per chip", "New NVLink 6.0 with 3.6TB/s bandwidth", "Shipping Q4 to hyperscalers"],
            source_urls=["https://nvidia.com/b300-launch"],
            tags=["NVIDIA", "GPU", "Hardware", "AI Training"],
            category="Tech",
            importance_score=0.80,
            published_date=date.today(),
        ),
        IntelligenceCard(
            owner_user_id=current_user.id,
            title="AI-Generated Code Now Accounts for 40% of GitHub Commits",
            summary="GitHub's annual report reveals that AI-assisted coding tools now generate approximately 40% of all code committed to the platform, up from 15% last year. Copilot and competing tools are fundamentally changing how software is built.",
            key_points=["40% of commits contain AI-generated code", "Copilot has 25M active users", "Productivity gains averaging 55% for adopters", "Concerns growing about code quality and technical debt"],
            source_urls=["https://github.blog/ai-code-report"],
            tags=["GitHub", "Copilot", "AI Coding", "Developer Tools"],
            category="Tech",
            importance_score=0.75,
            published_date=date.today(),
        ),
        IntelligenceCard(
            owner_user_id=current_user.id,
            title="China's Zhipu AI Releases GLM-5 Rivaling Western Models",
            summary="Chinese AI lab Zhipu has released GLM-5, a large language model that benchmarks competitively with GPT-4.5 and Claude Sonnet on standard evaluations. The model is freely available in China and at significantly lower API pricing globally.",
            key_points=["Matches GPT-4.5 on MMLU and HumanEval", "API pricing 70% lower than Western competitors", "Strong multilingual performance", "Questions remain about safety evaluations"],
            source_urls=["https://scmp.com/zhipu-glm5-launch"],
            tags=["China", "Zhipu", "GLM-5", "Competition"],
            category="AI",
            importance_score=0.72,
            published_date=date.today(),
        ),
        IntelligenceCard(
            owner_user_id=current_user.id,
            title="Major Data Breach Exposes AI Training Dataset Provenance Issues",
            summary="A security researcher has revealed that several major AI companies trained their models on datasets containing sensitive personal information scraped without consent. The disclosure reignites debates about AI training data ethics and copyright.",
            key_points=["Personal data of 50M+ individuals exposed", "Multiple AI labs implicated", "Class-action lawsuit being prepared", "Calls for mandatory data provenance tracking"],
            source_urls=["https://wired.com/ai-training-data-breach"],
            tags=["Security", "Privacy", "Training Data", "Ethics"],
            category="Security",
            importance_score=0.70,
            published_date=date.today(),
        ),
    ]

    await ensure_resource_quota(db, current_user.id, TEXT_SOURCES, increment=len(demo_sources))
    await ensure_resource_quota(db, current_user.id, ARTICLE_CARDS, increment=len(demo_cards), lock=False)
    for source in demo_sources:
        db.add(source)
    for card in demo_cards:
        db.add(card)

    await db.commit()
    return {"ok": True, "sources_added": len(demo_sources), "cards_added": len(demo_cards)}
