"""知识点 API"""
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import KnowledgePoint
from config import get_settings
from services.knowledge_service import (
    add_knowledge_point, import_chapter_content,
    list_knowledge_points
)
from services.vector_service import get_vector_service
from services.ocr_service import (
    extract_text_from_image,
    describe_image_for_card,
)
from services.llm_service import split_to_knowledge_points, consolidate_points, filter_ads

router = APIRouter(prefix="/knowledge", tags=["知识点"])
settings = get_settings()


class KnowledgeAddRequest(BaseModel):
    title: str
    content: str
    chapter_id: Optional[int] = None
    tags: list[str] = []
    difficulty: int = 3
    source: Optional[str] = None
    item_type: str = 'knowledge'


class ChapterImportRequest(BaseModel):
    chapter_id: int
    content: str
    source: Optional[str] = None


@router.post("/add")
async def add_knowledge(req: KnowledgeAddRequest, db: AsyncSession = Depends(get_db)):
    vector_svc = get_vector_service()
    kp = await add_knowledge_point(
        db=db, vector_svc=vector_svc,
        title=req.title, content=req.content,
        chapter_id=req.chapter_id, tags=req.tags,
        difficulty=req.difficulty, source=req.source,
        item_type=req.item_type,
    )
    if kp is None:
        return {"status": "duplicate", "message": "该知识点已存在"}
    await db.commit()
    return {"status": "ok", "id": kp.id, "title": kp.title}


@router.post("/import-chapter")
async def import_chapter(req: ChapterImportRequest, db: AsyncSession = Depends(get_db)):
    vector_svc = get_vector_service()
    saved = await import_chapter_content(
        db=db, vector_svc=vector_svc,
        chapter_id=req.chapter_id,
        raw_content=req.content,
        source=req.source,
    )
    return {
        "status": "ok",
        "imported": len(saved),
        "knowledge_count": sum(1 for kp in saved if kp.item_type == 'knowledge'),
        "example_count": sum(1 for kp in saved if kp.item_type == 'example'),
        "ids": [kp.id for kp in saved]
    }


@router.post("/import-image")
async def import_image(
    chapter_id: int = Form(...),
    source: Optional[str] = Form(None),
    ocr_engine: str = Form('baidu'),  # 保留参数名以兼容前端，实际只支持 baidu
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    image_bytes = await file.read()
    vector_svc = get_vector_service()

    # ── 百度 OCR + DeepSeek 拆分 + DeepSeek 归纳 → 入库单条 ──
    ocr_text_preview = None
    try:
        ocr_text = await extract_text_from_image(image_bytes)
        ocr_text = filter_ads(ocr_text)
        if not ocr_text.strip():
            raise HTTPException(status_code=400, detail="OCR未识别到文字")
        ocr_text_preview = ocr_text[:200] + "..." if len(ocr_text) > 200 else ocr_text
        raw_points = await split_to_knowledge_points(ocr_text)
        if not raw_points:
            raise HTTPException(status_code=400, detail="DeepSeek 未能从 OCR 文本中拆分出知识点")
        consolidated = await consolidate_points(raw_points)
        engine_label = "baidu"
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"识别/归纳失败: {str(e)}")

    # ── 入库（单条记录）──
    from services.knowledge_service import add_knowledge_point
    kp = await add_knowledge_point(
        db=db, vector_svc=vector_svc,
        title=consolidated.get('title', ''),
        content=consolidated.get('content', ''),
        chapter_id=chapter_id,
        tags=consolidated.get('tags', []),
        difficulty=consolidated.get('difficulty', 3),
        source=source or file.filename,
        item_type='knowledge',
    )
    await db.commit()

    if not kp:
        return {"status": "duplicate", "message": "该知识点已存在（内容重复）"}

    content = consolidated.get('content', '')
    resp = {
        "status": "ok",
        "engine": engine_label,
        "imported": 1,
        "knowledge_count": 1,
        "example_count": 0,
        "ids": [kp.id],
        "title": kp.title,
        "content": content,
        "tags": consolidated.get('tags', []),
        "difficulty": consolidated.get('difficulty', 3),
        "raw_points_count": len(raw_points),
        "raw_points": raw_points,
    }
    if ocr_text_preview is not None:
        resp["ocr_text"] = ocr_text_preview
    return resp


@router.get("/list")
async def list_knowledge(
    chapter_id: Optional[int] = None,
    item_type: Optional[str] = None,
    page: int = 1,
    size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    result = await list_knowledge_points(db, chapter_id, item_type, page, size)
    result["items"] = [
        {
            "id": kp.id,
            "title": kp.title,
            "content": kp.content,
            "tags": kp.tags,
            "difficulty": kp.difficulty,
            "chapter_id": kp.chapter_id,
            "source": kp.source,
            "item_type": kp.item_type,
            "created_at": kp.created_at.isoformat() if kp.created_at else None,
        }
        for kp in result["items"]
    ]
    return result


@router.get("/search")
async def search_knowledge(q: str, top_k: int = 20, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import or_
    keyword = f"%{q}%"
    result = await db.execute(
        select(KnowledgePoint)
        .where(
            or_(
                KnowledgePoint.title.like(keyword),
                KnowledgePoint.content.like(keyword),
            )
        )
        .limit(top_k)
    )
    kps = result.scalars().all()
    return {
        "query": q,
        "results": [
            {"id": kp.id, "title": kp.title, "content": kp.content[:200],
             "tags": kp.tags, "difficulty": kp.difficulty, "item_type": kp.item_type}
            for kp in kps
        ],
    }


class ExplainRequest(BaseModel):
    title: str
    content: str


@router.post("/explain")
async def explain_knowledge(req: ExplainRequest):
    """调用 LLM 对知识点进行通俗解释，流式返回 SSE"""
    from fastapi.responses import StreamingResponse
    from services.llm_service import get_client

    prompt = f"""请用通俗易懂的方式解释以下考试知识点。

**输出格式要求（必须严格遵守）**：
- 使用 Markdown 格式输出
- 每个章节用 `## 标题` 作为二级标题
- 列表用 `- ` 开头，每项单独一行
- 每个章节之间必须有空行分隔
- 不要把多个内容挤在一行里

**内容结构**：

## 核心含义
一句话点明这个概念的本质。

## 生活比喻
用生活中的例子类比，帮助理解。如有数据对比，每项单独一行列出。

## 考点与易错点
- 列出 2～3 个常见考点或易混淆的点

## 记忆技巧
给出口诀或联想记忆方法。

知识点标题：{req.title}
知识点内容：{req.content}"""

    async def event_stream():
        try:
            client = get_client()
            stream = await client.chat.completions.create(
                model=settings.llm_model,
                messages=[
                    {"role": "system", "content": "你是一建实务考试辅导专家，善于用通俗语言解释专业概念。"},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    # 用 JSON 编码，避免 delta 中的 \n 被 SSE 协议当作分隔符丢弃
                    yield f"data: {json.dumps(delta, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/rebuild-index")
async def rebuild_index(db: AsyncSession = Depends(get_db)):
    """清空向量索引，重新对所有知识点向量化（用于切换 Embedding 模型后）"""
    from sqlalchemy import select as sa_select
    from services.vector_service import VectorService, DIM, INDEX_FILE, MAP_FILE, FAISS_AVAILABLE
    import os, json
    import numpy as np

    # 清空旧索引文件
    for f in [INDEX_FILE, MAP_FILE]:
        if os.path.exists(f):
            os.remove(f)
    faiss_file = os.path.join(settings.faiss_index_path, "index.faiss")
    if os.path.exists(faiss_file):
        os.remove(faiss_file)

    # 重置单例
    import services.vector_service as vs_module
    vs_module._vector_service = None
    vector_svc = get_vector_service()

    # 遍历所有知识点重建
    result = await db.execute(sa_select(KnowledgePoint))
    all_kps = result.scalars().all()
    ok, fail = 0, 0
    for kp in all_kps:
        try:
            await vector_svc.add(kp.id, kp.content)
            ok += 1
        except Exception:
            fail += 1

    return {"status": "ok", "total": len(all_kps), "indexed": ok, "failed": fail}


@router.post("/add-image-card")
async def add_image_card(
    chapter_id: int = Form(...),
    source: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """上传图片总结卡：AI分析图片生成结构化描述，存为 item_type='image_card' 知识点"""
    image_bytes = await file.read()
    vector_svc = get_vector_service()
    try:
        card = await describe_image_for_card(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"图片总结卡分析失败: {str(e)}")

    kp = await add_knowledge_point(
        db=db, vector_svc=vector_svc,
        title=card.get('title', file.filename),
        content=card.get('content', ''),
        chapter_id=chapter_id,
        tags=card.get('tags', []),
        difficulty=card.get('difficulty', 3),
        source=source or file.filename,
        item_type='image_card',
    )
    if kp is None:
        return {"status": "duplicate", "message": "该图片内容已存在"}
    await db.commit()
    return {
        "status": "ok",
        "id": kp.id,
        "title": kp.title,
        "content_preview": kp.content[:200] + "..." if len(kp.content) > 200 else kp.content,
    }


@router.post("/preview-split")
async def preview_split(req: ChapterImportRequest):
    points = await split_to_knowledge_points(req.content)
    return {"count": len(points), "points": points}


# ── 动态路由放最后，避免拦截 /list /search 等静态路径 ──────────────────────────

class KnowledgeUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    chapter_id: Optional[int] = None
    tags: Optional[list[str]] = None
    difficulty: Optional[int] = None
    source: Optional[str] = None
    item_type: Optional[str] = None


@router.put("/{knowledge_id}")
async def update_knowledge(knowledge_id: str, req: KnowledgeUpdateRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgePoint).where(KnowledgePoint.id == knowledge_id))
    kp = result.scalar_one_or_none()
    if not kp:
        raise HTTPException(status_code=404, detail="知识点不存在")
    if req.title is not None:
        kp.title = req.title
    if req.content is not None:
        kp.content = req.content
    if req.chapter_id is not None:
        kp.chapter_id = req.chapter_id
    if req.tags is not None:
        kp.tags = req.tags
    if req.difficulty is not None:
        kp.difficulty = req.difficulty
    if req.source is not None:
        kp.source = req.source
    if req.item_type is not None:
        kp.item_type = req.item_type
    await db.commit()
    await db.refresh(kp)
    return {"status": "ok", "id": kp.id, "title": kp.title}


class BatchDeleteRequest(BaseModel):
    ids: list[str]


@router.post("/batch-delete")
async def batch_delete_knowledge(req: BatchDeleteRequest, db: AsyncSession = Depends(get_db)):
    """批量删除知识点。返回成功删除的数量。"""
    import logging, traceback
    logger = logging.getLogger("knowledge.batch_delete")
    if not req.ids:
        raise HTTPException(status_code=400, detail="ids 不能为空")
    try:
        result = await db.execute(select(KnowledgePoint).where(KnowledgePoint.id.in_(req.ids)))
        kps = result.scalars().all()
        deleted_ids = []
        for kp in kps:
            await db.delete(kp)
            deleted_ids.append(kp.id)
        await db.commit()
        return {"status": "ok", "deleted_count": len(deleted_ids), "deleted_ids": deleted_ids}
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"[POST /knowledge/batch-delete] 批量删除失败: {e}\n{tb}")
        raise HTTPException(status_code=500, detail=f"批量删除失败: {str(e)}")


@router.delete("/{knowledge_id}")
async def delete_knowledge(knowledge_id: str, db: AsyncSession = Depends(get_db)):
    import logging, traceback
    logger = logging.getLogger("knowledge.delete")
    try:
        result = await db.execute(select(KnowledgePoint).where(KnowledgePoint.id == knowledge_id))
        kp = result.scalar_one_or_none()
        if not kp:
            raise HTTPException(status_code=404, detail="知识点不存在")
        await db.delete(kp)
        await db.commit()
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"[DELETE /knowledge/{knowledge_id}] 删除失败: {e}\n{tb}")
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")

