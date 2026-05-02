"""知识库打包导出"""
import os
import json
import zipfile
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import Chapter, KnowledgePoint, Question, QuestionKnowledgeMap
from services.vector_service import VectorService
from config import get_settings

settings = get_settings()


async def export_knowledge_pack(
    db: AsyncSession,
    vector_svc: VectorService,
    subject_id: Optional[int] = None,
    chapter_id: Optional[int] = None,
) -> str:
    # ── 确定需要导出的 chapter_id 集合 ─────────────────────────────────────────
    target_chapter_ids: Optional[set] = None  # None = 全部

    if chapter_id is not None:
        # 只导出指定章节
        target_chapter_ids = {chapter_id}
    elif subject_id is not None:
        # 导出科目下所有章节
        children = (await db.execute(
            select(Chapter).where(Chapter.parent_id == subject_id)
        )).scalars().all()
        target_chapter_ids = {c.id for c in children}

    # ── 查询数据 ───────────────────────────────────────────────────────────────
    all_chapters = (await db.execute(select(Chapter).order_by(Chapter.id))).scalars().all()

    if target_chapter_ids is not None:
        kps = (await db.execute(
            select(KnowledgePoint)
            .where(KnowledgePoint.chapter_id.in_(target_chapter_ids))
            .order_by(KnowledgePoint.created_at)
        )).scalars().all()
        # 只保留相关章节
        export_chapters = [c for c in all_chapters if c.id in target_chapter_ids
                           or (subject_id and c.id == subject_id)]
    else:
        kps = (await db.execute(select(KnowledgePoint).order_by(KnowledgePoint.created_at))).scalars().all()
        export_chapters = all_chapters

    kp_ids = {kp.id for kp in kps}
    maps = (await db.execute(select(QuestionKnowledgeMap))).scalars().all()
    relevant_q_ids = {m.question_id for m in maps if m.knowledge_id in kp_ids}

    if target_chapter_ids is not None:
        questions = (await db.execute(
            select(Question)
            .where(Question.id.in_(relevant_q_ids))
            .order_by(Question.created_at)
        )).scalars().all()
    else:
        questions = (await db.execute(select(Question).order_by(Question.created_at))).scalars().all()

    # ── 构建输出数据 ──────────────────────────────────────────────────────────
    meta = {
        "version": "1.0",
        "exported_at": datetime.utcnow().isoformat(),
        "filter": {
            "subject_id": subject_id,
            "chapter_id": chapter_id,
        },
        "counts": {
            "chapters": len(export_chapters),
            "knowledge_points": len(kps),
            "questions": len(questions),
        },
        "schema_version": "1",
    }

    chapters_data = [
        {"id": c.id, "title": c.title, "parent_id": c.parent_id, "sort_order": c.sort_order}
        for c in export_chapters
    ]

    knowledge_data = [
        {
            "id": kp.id,
            "chapter_id": kp.chapter_id,
            "title": kp.title,
            "content": kp.content,
            "tags": kp.tags or [],
            "difficulty": kp.difficulty,
            "source": kp.source,
            "item_type": kp.item_type,
            "created_at": kp.created_at.isoformat() if kp.created_at else None,
        }
        for kp in kps
    ]

    map_dict: dict[str, list[str]] = {}
    for m in maps:
        map_dict.setdefault(m.question_id, []).append(m.knowledge_id)

    questions_data = [
        {
            "id": q.id,
            "type": q.type,
            "question": q.question,
            "options": q.options,
            "answer": q.answer,
            "analysis": q.analysis,
            "quality_checked": q.quality_checked,
            "knowledge_ids": map_dict.get(q.id, []),
        }
        for q in questions
    ]

    embeddings_binary = vector_svc.export_binary()
    id_map = vector_svc.get_id_map()

    os.makedirs(settings.export_path, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    zip_path = os.path.join(settings.export_path, f"knowledge-pack-{timestamp}.zip")

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("knowledge-pack/meta.json", json.dumps(meta, ensure_ascii=False, indent=2))
        zf.writestr("knowledge-pack/chapters.json", json.dumps(chapters_data, ensure_ascii=False, indent=2))
        zf.writestr("knowledge-pack/knowledge.json", json.dumps(knowledge_data, ensure_ascii=False, indent=2))
        zf.writestr("knowledge-pack/questions.json", json.dumps(questions_data, ensure_ascii=False, indent=2))
        zf.writestr("knowledge-pack/embeddings_id_map.json", json.dumps(id_map, ensure_ascii=False))
        zf.writestr("knowledge-pack/embeddings.bin", embeddings_binary)

    return zip_path
