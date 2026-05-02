"""knowledge-pack 导入服务"""
import io
import json
import zipfile
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import Chapter, KnowledgePoint, Question, QuestionKnowledgeMap


async def import_knowledge_pack(db: AsyncSession, zip_bytes: bytes) -> dict:
    """
    解析 knowledge-pack.zip，按 ID 去重合并写入数据库。
    返回导入统计。
    """
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        names = zf.namelist()

        def read_json(filename):
            # 兼容有无 knowledge-pack/ 前缀
            for n in names:
                if n.endswith(filename):
                    return json.loads(zf.read(n).decode("utf-8"))
            return None

        chapters_data = read_json("chapters.json") or []
        knowledge_data = read_json("knowledge.json") or []
        questions_data = read_json("questions.json") or []

    # ── 导入章节（按 id 去重，id 是数据库自增整数，跨库可能冲突，改用 title+parent 匹配）
    # 策略：先建立 old_id → new_id 映射
    old_to_new_chapter: dict[int, int] = {}

    # 查询现有章节（用 title+parent_id 去重）
    existing_chapters = (await db.execute(select(Chapter))).scalars().all()
    chapter_key_map: dict[tuple, int] = {
        (c.title, c.parent_id): c.id for c in existing_chapters
    }

    # 先插入顶级章节（parent_id == null），再插入子章节
    def sort_chapters(clist):
        top = [c for c in clist if c.get("parent_id") is None]
        children = [c for c in clist if c.get("parent_id") is not None]
        return top + children

    new_chapters = 0
    for c in sort_chapters(chapters_data):
        old_pid = c.get("parent_id")
        new_pid = old_to_new_chapter.get(old_pid) if old_pid is not None else None
        key = (c["title"], new_pid)
        if key in chapter_key_map:
            old_to_new_chapter[c["id"]] = chapter_key_map[key]
        else:
            ch = Chapter(
                title=c["title"],
                parent_id=new_pid,
                sort_order=c.get("sort_order", 0),
            )
            db.add(ch)
            await db.flush()
            old_to_new_chapter[c["id"]] = ch.id
            chapter_key_map[key] = ch.id
            new_chapters += 1

    # ── 导入知识点（按 UUID 去重）
    existing_kp_ids = {
        row[0] for row in (await db.execute(select(KnowledgePoint.id))).all()
    }
    new_kps = 0
    for kp in knowledge_data:
        if kp["id"] in existing_kp_ids:
            continue
        old_cid = kp.get("chapter_id")
        new_cid = old_to_new_chapter.get(old_cid) if old_cid is not None else None
        obj = KnowledgePoint(
            id=kp["id"],
            chapter_id=new_cid,
            title=kp.get("title"),
            content=kp["content"],
            tags=kp.get("tags") or [],
            difficulty=kp.get("difficulty", 3),
            source=kp.get("source"),
            item_type=kp.get("item_type", "knowledge"),
            content_hash=None,  # 允许导入时先不校验 hash
        )
        db.add(obj)
        new_kps += 1

    # ── 导入题目（按 UUID 去重）
    existing_q_ids = {
        row[0] for row in (await db.execute(select(Question.id))).all()
    }
    new_qs = 0
    for q in questions_data:
        if q["id"] in existing_q_ids:
            continue
        obj = Question(
            id=q["id"],
            type=q.get("type"),
            question=q["question"],
            options=q.get("options"),
            answer=q["answer"],
            analysis=q.get("analysis"),
            quality_checked=q.get("quality_checked", False),
        )
        db.add(obj)
        new_qs += 1
        for kid in q.get("knowledge_ids", []):
            db.add(QuestionKnowledgeMap(question_id=q["id"], knowledge_id=kid))

    await db.commit()

    return {
        "new_chapters": new_chapters,
        "new_knowledge_points": new_kps,
        "new_questions": new_qs,
    }
