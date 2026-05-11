from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TaskCreate(BaseModel):
    task_type: str
    title: Optional[str] = None
    card_ids: list[int] = []
    inspiration_ids: list[int] = []
    source_task_ids: list[int] = []
    config: dict = {}
    initial_draft: Optional[str] = None


class TaskOut(BaseModel):
    id: int
    task_type: str
    title: Optional[str] = None
    card_ids: Optional[list] = []
    inspiration_ids: Optional[list] = []
    source_task_ids: Optional[list] = []
    status: str
    config: dict = {}
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class DraftUpdate(BaseModel):
    content: str


class DraftOut(BaseModel):
    id: int
    task_id: int
    content: str
    revised_content: Optional[str] = None
    version: int
    agent: str
    created_at: datetime
    model_config = {"from_attributes": True}


class CritiqueItem(BaseModel):
    target_quote: str
    critique: str
    suggestion: str


class CritiqueOut(BaseModel):
    id: int
    task_id: int
    draft_id: int
    critiques: list = []
    overall_score: Optional[float] = None
    overall_comment: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}
