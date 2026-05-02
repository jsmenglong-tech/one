"""出题 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import asyncio
import random
from database import get_db, AsyncSessionLocal
from models import Question, WrongRecord, QuestionKnowledgeMap, KnowledgePoint, Chapter
from services.question_service import generate_question, list_questions

router = APIRouter(prefix="/questions", tags=["题目"])


class GenerateRequest(BaseModel):
    knowledge_ids: list[str]
    type: str = "single"
    num_questions: Optional[int] = None  # 单选/多选独立控制题目数量，None 时默认等于知识点数


def _format_question(q: Question) -> dict:
    return {
        "id": q.id,
        "type": q.type,
        "question": q.question,
        "options": q.options,
        "answer": q.answer,
        "analysis": q.analysis,
        "quality_checked": q.quality_checked,
    }


@router.post("/generate")
async def generate(req: GenerateRequest, db: AsyncSession = Depends(get_db)):
    """兼容旧接口：仍可用，传多个knowledge_ids时改为每个知识点独立出1题"""
    if req.type not in ("single", "multiple", "case"):
        raise HTTPException(status_code=400, detail="type 必须为 single/multiple/case")
    if len(req.knowledge_ids) <= 1:
        q = await generate_question(db, req.knowledge_ids, req.type)
        return _format_question(q)
    # 多知识点：每个独立出1题，并发执行
    results = await _batch_generate(req.knowledge_ids, req.type)
    return {"batch": True, "items": results}


@router.post("/generate-batch")
async def generate_batch(req: GenerateRequest):
    """批量生成题目。
    - 单选/多选：从知识点池随机抽取 num_questions 次（允许重复），每次独立出一题
    - 案例题：保持原逻辑，每个知识点出1题
    """
    if req.type not in ("single", "multiple", "case"):
        raise HTTPException(status_code=400, detail="type 必须为 single/multiple/case")
    if not req.knowledge_ids:
        raise HTTPException(status_code=400, detail="请至少选择1个知识点")

    if req.type == "case":
        # 案例题：一个知识点对应一道题
        results = await _batch_generate(req.knowledge_ids, req.type)
    else:
        # 单选/多选：从知识点池随机抽取 num_questions 次（允许重复）
        num = req.num_questions if req.num_questions and req.num_questions > 0 else len(req.knowledge_ids)
        sampled_ids = [random.choice(req.knowledge_ids) for _ in range(num)]
        results = await _batch_generate(sampled_ids, req.type)

    return {"total": len(results), "items": results}


async def _generate_one(kid: str, q_type: str) -> dict:
    """为单个知识点独立创建db会话并出题（避免并发session冲突）"""
    async with AsyncSessionLocal() as db:
        try:
            q = await generate_question(db, [kid], q_type)
            return {"success": True, **_format_question(q)}
        except Exception as e:
            return {"success": False, "error": str(e), "knowledge_id": kid}


async def _batch_generate(knowledge_ids: list[str], q_type: str) -> list[dict]:
    tasks = [_generate_one(kid, q_type) for kid in knowledge_ids]
    return await asyncio.gather(*tasks)


@router.get("/list")
async def get_questions(
    type: Optional[str] = None,
    page: int = 1,
    size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    result = await list_questions(db, type, page, size)
    result["items"] = [
        {
            "id": q.id,
            "type": q.type,
            "question": q.question,
            "options": q.options,
            "answer": q.answer,
            "analysis": q.analysis,
            "quality_checked": q.quality_checked,
            "created_at": q.created_at.isoformat() if q.created_at else None,
        }
        for q in result["items"]
    ]
    return result


@router.post("/wrong/{question_id}")
async def record_wrong(question_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WrongRecord).where(WrongRecord.question_id == question_id)
    )
    record = result.scalar_one_or_none()
    if record:
        record.wrong_count += 1
        record.last_wrong_at = datetime.utcnow()
    else:
        db.add(WrongRecord(question_id=question_id))
    await db.commit()
    return {"status": "ok"}


@router.get("/wrong")
async def get_wrong_records(db: AsyncSession = Depends(get_db)):
    # 查询错题记录，同时加载题目及其知识点映射
    result = await db.execute(
        select(WrongRecord)
        .options(
            selectinload(WrongRecord.question)
            .selectinload(Question.knowledge_maps)
            .selectinload(QuestionKnowledgeMap.knowledge)
            .selectinload(KnowledgePoint.chapter)
        )
        .order_by(WrongRecord.wrong_count.desc())
    )
    records = result.scalars().all()

    # 收集所有 chapter id，批量查询 parent（科目）
    chapter_ids = set()
    for r in records:
        if r.question:
            for km in r.question.knowledge_maps:
                if km.knowledge and km.knowledge.chapter_id:
                    chapter_ids.add(km.knowledge.chapter_id)

    # 查询所有相关章节（含父节点）
    chapter_map: dict[int, Chapter] = {}
    if chapter_ids:
        ch_result = await db.execute(select(Chapter))
        for ch in ch_result.scalars().all():
            chapter_map[ch.id] = ch

    def get_subject(chapter_id: Optional[int]):
        """沿 parent_id 找到顶层科目"""
        if chapter_id is None:
            return None, None
        ch = chapter_map.get(chapter_id)
        if ch is None:
            return None, None
        if ch.parent_id is None:
            # 自身就是顶层科目
            return ch.id, ch.title
        parent = chapter_map.get(ch.parent_id)
        if parent is None:
            return ch.id, ch.title
        return parent.id, parent.title

    items = []
    for r in records:
        q = r.question
        if not q:
            continue
        # 取第一个有效知识点的章节/科目
        chapter_id = None
        chapter_title = None
        subject_id = None
        subject_title = None
        for km in q.knowledge_maps:
            if km.knowledge and km.knowledge.chapter_id:
                ch = chapter_map.get(km.knowledge.chapter_id)
                if ch:
                    chapter_id = ch.id
                    chapter_title = ch.title
                    subject_id, subject_title = get_subject(ch.id)
                    break

        items.append({
            "question_id": r.question_id,
            "wrong_count": r.wrong_count,
            "last_wrong_at": r.last_wrong_at.isoformat() if r.last_wrong_at else None,
            "question": {
                "id": q.id,
                "type": q.type,
                "question": q.question,
                "options": q.options,
                "answer": q.answer,
                "analysis": q.analysis,
            },
            "chapter_id": chapter_id,
            "chapter_title": chapter_title,
            "subject_id": subject_id,
            "subject_title": subject_title,
        })

    return {"items": items}
