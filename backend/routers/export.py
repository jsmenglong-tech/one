"""导出 API"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from services.export_service import export_knowledge_pack
from services.import_service import import_knowledge_pack
from services.vector_service import get_vector_service

router = APIRouter(prefix="/export", tags=["导出"])


@router.get("/knowledge-pack")
async def export_pack(
    subject_id: Optional[int] = None,
    chapter_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    导出知识库 knowledge-pack.zip
    - 不传参数：导出全部
    - subject_id：导出指定科目（及其所有章节）
    - chapter_id：导出指定章节
    """
    vector_svc = get_vector_service()
    zip_path = await export_knowledge_pack(db, vector_svc, subject_id=subject_id, chapter_id=chapter_id)

    if chapter_id:
        filename = f"knowledge-pack-chapter{chapter_id}.zip"
    elif subject_id:
        filename = f"knowledge-pack-subject{subject_id}.zip"
    else:
        filename = "knowledge-pack.zip"

    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename=filename,
    )


@router.post("/import-pack")
async def import_pack(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """导入 knowledge-pack.zip，按 ID 去重合并"""
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="请上传 .zip 文件")
    zip_bytes = await file.read()
    try:
        stats = await import_knowledge_pack(db, zip_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败：{str(e)}")
    return {"status": "ok", "stats": stats}

