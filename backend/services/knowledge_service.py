"""知识点入库服务"""
import hashlib
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models import KnowledgePoint, Chapter
from services.llm_service import split_to_knowledge_points, filter_ads
from services.vector_service import VectorService


def compute_hash(content: str) -> str:
    return hashlib.sha256(content.strip().encode()).hexdigest()


async def add_knowledge_point(
    db: AsyncSession,
    vector_svc: VectorService,
    title: str,
    content: str,
    chapter_id: int | None,
    tags: list,
    difficulty: int,
    source: str | None,
    item_type: str = 'knowledge',
) -> KnowledgePoint | None:
    content_hash = compute_hash(content)

    existing = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.content_hash == content_hash)
    )
    existing_kp = existing.scalar_one_or_none()
    if existing_kp:
        # 如果章节不同，更新章节后返回（不视为重复）
        if chapter_id is not None and existing_kp.chapter_id != chapter_id:
            existing_kp.chapter_id = chapter_id
            await db.flush()
            return existing_kp
        return None

    kp = KnowledgePoint(
        id=str(uuid.uuid4()),
        chapter_id=chapter_id,
        title=title,
        content=content,
        tags=tags,
        difficulty=difficulty,
        source=source,
        content_hash=content_hash,
        item_type=item_type,
    )
    db.add(kp)
    await db.flush()

    await vector_svc.add(kp.id, content)
    return kp


async def import_chapter_content(
    db: AsyncSession,
    vector_svc: VectorService,
    chapter_id: int,
    raw_content: str,
    source: str | None = None,
) -> list[KnowledgePoint]:
    # 第一道防线：正则预过滤广告行
    cleaned_content = filter_ads(raw_content)
    points_data = await split_to_knowledge_points(cleaned_content)
    saved = []
    for p in points_data:
        kp = await add_knowledge_point(
            db=db,
            vector_svc=vector_svc,
            title=p.get("title", ""),
            content=p.get("content", ""),
            chapter_id=chapter_id,
            tags=p.get("tags", []),
            difficulty=p.get("difficulty", 3),
            source=source,
            item_type=p.get("item_type", "knowledge"),
        )
        if kp:
            saved.append(kp)
    await db.commit()
    return saved


async def list_knowledge_points(
    db: AsyncSession,
    chapter_id: int | None = None,
    item_type: str | None = None,
    page: int = 1,
    size: int = 20,
) -> dict:
    query = select(KnowledgePoint)
    if chapter_id:
        query = query.where(KnowledgePoint.chapter_id == chapter_id)
    if item_type:
        query = query.where(KnowledgePoint.item_type == item_type)
    query = query.order_by(KnowledgePoint.created_at.desc())

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    items = (await db.execute(query.offset((page - 1) * size).limit(size))).scalars().all()
    return {"total": total, "page": page, "size": size, "items": items}


async def search_by_vector(
    db: AsyncSession,
    vector_svc: VectorService,
    query_text: str,
    top_k: int = 5,
) -> list[KnowledgePoint]:
    ids = await vector_svc.search(query_text, top_k)
    if not ids:
        return []
    result = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.id.in_(ids))
    )
    return result.scalars().all()
