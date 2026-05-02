"""系统配置 API"""
from fastapi import APIRouter
from pydantic import BaseModel
from config import get_settings
import os
import re

router = APIRouter(prefix="/settings", tags=["系统配置"])

ENV_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")


def _update_env(key: str, value: str):
    """写入或更新 .env 文件中的某个 key"""
    line = f'{key}={value}\n'
    if os.path.exists(ENV_FILE):
        content = open(ENV_FILE, encoding="utf-8").read()
        pattern = re.compile(rf'^{re.escape(key)}=.*$', re.MULTILINE)
        if pattern.search(content):
            content = pattern.sub(line.rstrip(), content)
        else:
            content += line
        open(ENV_FILE, 'w', encoding="utf-8").write(content)
    else:
        open(ENV_FILE, 'w', encoding="utf-8").write(line)


class BaiduOCRConfig(BaseModel):
    api_key: str
    secret_key: str


class DeepSeekConfig(BaseModel):
    api_key: str
    base_url: str = "https://api.deepseek.com/v1"
    model: str = "deepseek-chat"


class EmbeddingConfig(BaseModel):
    api_key: str
    base_url: str = "https://api.siliconflow.cn/v1"
    model: str = "BAAI/bge-large-zh-v1.5"


class VisionConfig(BaseModel):
    api_key: str
    base_url: str = "https://api.apimart.ai/v1"
    model: str = "gpt-4o-mini"


@router.get("/ocr")
async def get_ocr_config():
    get_settings.cache_clear()
    s = get_settings()
    return {
        "engine": s.ocr_engine,
        "baidu_configured": bool(s.baidu_ocr_api_key and s.baidu_ocr_secret_key),
        "baidu_api_key_preview": s.baidu_ocr_api_key[:4] + "****" if s.baidu_ocr_api_key else "",
        "deepseek_configured": bool(s.llm_api_key),
        "deepseek_api_key_preview": s.llm_api_key[:4] + "****" if s.llm_api_key else "",
        "deepseek_base_url": s.llm_base_url,
        "deepseek_model": s.llm_model,
        "embedding_configured": bool(s.embedding_api_key),
        "embedding_api_key_preview": s.embedding_api_key[:4] + "****" if s.embedding_api_key else "",
        "embedding_base_url": s.embedding_base_url,
        "embedding_model": s.llm_embedding_model,
        "vision_configured": bool(s.vision_api_key),
        "vision_api_key_preview": s.vision_api_key[:4] + "****" if s.vision_api_key else "",
        "vision_base_url": s.vision_base_url,
        "vision_model": s.vision_model,
    }


@router.post("/ocr/baidu")
async def save_baidu_ocr(config: BaiduOCRConfig):
    """保存百度OCR API Key 到 .env"""
    _update_env("BAIDU_OCR_API_KEY", config.api_key)
    _update_env("BAIDU_OCR_SECRET_KEY", config.secret_key)
    _update_env("OCR_ENGINE", "baidu")
    get_settings.cache_clear()
    return {"status": "ok", "message": "百度OCR配置已保存"}


@router.post("/ocr/deepseek")
async def save_deepseek_config(config: DeepSeekConfig):
    """保存 DeepSeek API Key / Base URL / 模型 到 .env"""
    _update_env("LLM_API_KEY", config.api_key)
    _update_env("LLM_BASE_URL", config.base_url)
    _update_env("LLM_MODEL", config.model)
    get_settings.cache_clear()
    return {"status": "ok", "message": "DeepSeek 配置已保存"}


@router.post("/embedding")
async def save_embedding_config(config: EmbeddingConfig):
    """保存 Embedding API 配置到 .env"""
    _update_env("EMBEDDING_API_KEY", config.api_key)
    _update_env("EMBEDDING_BASE_URL", config.base_url)
    _update_env("LLM_EMBEDDING_MODEL", config.model)
    get_settings.cache_clear()
    return {"status": "ok", "message": "Embedding 配置已保存，请重建向量索引"}


@router.post("/vision")
async def save_vision_config(config: VisionConfig):
    """保存视觉模型 API 配置到 .env"""
    _update_env("VISION_API_KEY", config.api_key)
    _update_env("VISION_BASE_URL", config.base_url)
    _update_env("VISION_MODEL", config.model)
    get_settings.cache_clear()
    return {"status": "ok", "message": "视觉模型配置已保存"}
