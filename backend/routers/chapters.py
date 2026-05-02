"""章节 & 科目管理 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import Chapter, KnowledgePoint

router = APIRouter(prefix="/chapters", tags=["章节"])


class ChapterCreate(BaseModel):
    title: str
    parent_id: Optional[int] = None
    sort_order: int = 0


class ChapterUpdate(BaseModel):
    title: str


# ── 科目接口（parent_id IS NULL） ──────────────────────────────────────────────

@router.get("/subjects")
async def list_subjects(db: AsyncSession = Depends(get_db)):
    """列出所有科目（顶级节点）"""
    result = await db.execute(
        select(Chapter)
        .where(Chapter.parent_id == None)
        .order_by(Chapter.sort_order, Chapter.id)
    )
    subjects = result.scalars().all()
    return {"subjects": [{"id": s.id, "title": s.title, "sort_order": s.sort_order} for s in subjects]}


@router.post("/subjects")
async def create_subject(req: ChapterCreate, db: AsyncSession = Depends(get_db)):
    """新建科目"""
    subject = Chapter(title=req.title, parent_id=None, sort_order=req.sort_order)
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return {"id": subject.id, "title": subject.title}


@router.put("/subjects/{subject_id}")
async def update_subject(subject_id: int, req: ChapterUpdate, db: AsyncSession = Depends(get_db)):
    """修改科目名称"""
    result = await db.execute(select(Chapter).where(Chapter.id == subject_id, Chapter.parent_id == None))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="科目不存在")
    subject.title = req.title
    await db.commit()
    return {"id": subject.id, "title": subject.title}


@router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: int, force: bool = False, db: AsyncSession = Depends(get_db)):
    """删除科目（force=true 时级联删除其下所有章节，并解绑知识点）"""
    result = await db.execute(select(Chapter).where(Chapter.id == subject_id, Chapter.parent_id == None))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="科目不存在")

    # 该科目下的所有章节
    children_result = await db.execute(select(Chapter).where(Chapter.parent_id == subject_id))
    children = children_result.scalars().all()

    if children and not force:
        raise HTTPException(
            status_code=409,
            detail=f"该科目下还有 {len(children)} 个章节，请先删除章节或使用强制删除"
        )

    if force:
        for child in children:
            # 解绑知识点
            kps = (await db.execute(
                select(KnowledgePoint).where(KnowledgePoint.chapter_id == child.id)
            )).scalars().all()
            for kp in kps:
                kp.chapter_id = None
            await db.delete(child)

    await db.delete(subject)
    await db.commit()
    return {"status": "ok"}


# ── 章节接口（原有，parent_id 可按科目过滤） ────────────────────────────────────

@router.get("/")
async def list_chapters(subject_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Chapter).order_by(Chapter.sort_order, Chapter.id))
    chapters = result.scalars().all()

    # 统计每个章节的知识点数
    counts_result = await db.execute(
        select(KnowledgePoint.chapter_id, func.count(KnowledgePoint.id))
        .group_by(KnowledgePoint.chapter_id)
    )
    counts = {row[0]: row[1] for row in counts_result.all()}

    def build_tree(chapters, parent_id=None):
        return [
            {
                "id": c.id,
                "title": c.title,
                "parent_id": c.parent_id,
                "sort_order": c.sort_order,
                "knowledge_count": counts.get(c.id, 0),
                "children": build_tree(chapters, c.id),
            }
            for c in chapters if c.parent_id == parent_id
        ]

    tree = build_tree(chapters)

    # 如果指定 subject_id，只返回该科目的子树
    if subject_id is not None:
        for node in tree:
            if node["id"] == subject_id:
                return {"chapters": node["children"]}
        return {"chapters": []}

    return {"chapters": tree}


@router.post("/")
async def create_chapter(req: ChapterCreate, db: AsyncSession = Depends(get_db)):
    chapter = Chapter(title=req.title, parent_id=req.parent_id, sort_order=req.sort_order)
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    return {"id": chapter.id, "title": chapter.title}


@router.put("/{chapter_id}")
async def update_chapter(chapter_id: int, req: ChapterUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="章节不存在")
    chapter.title = req.title
    await db.commit()
    return {"id": chapter.id, "title": chapter.title}


@router.delete("/{chapter_id}")
async def delete_chapter(chapter_id: int, force: bool = False, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="章节不存在")

    # 统计关联知识点
    count_result = await db.execute(
        select(func.count(KnowledgePoint.id)).where(KnowledgePoint.chapter_id == chapter_id)
    )
    kp_count = count_result.scalar() or 0

    if kp_count > 0 and not force:
        raise HTTPException(
            status_code=409,
            detail=f"该章节下还有 {kp_count} 个知识点，请先删除知识点或使用强制删除"
        )

    if force and kp_count > 0:
        kps = (await db.execute(
            select(KnowledgePoint).where(KnowledgePoint.chapter_id == chapter_id)
        )).scalars().all()
        for kp in kps:
            kp.chapter_id = None

    await db.delete(chapter)
    await db.commit()
    return {"status": "ok", "unlinked_knowledge": kp_count if force else 0}
