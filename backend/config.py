from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    faiss_index_path: str = "./data/faiss_index"
    export_path: str = "./data/exports"

    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"

    # Embedding 独立配置（默认使用硅基流动 BAAI/bge-large-zh-v1.5）
    embedding_api_key: str = ""
    embedding_base_url: str = "https://api.siliconflow.cn/v1"
    llm_embedding_model: str = "BAAI/bge-large-zh-v1.5"

    ocr_engine: str = "baidu"
    baidu_ocr_api_key: str = ""
    baidu_ocr_secret_key: str = ""

    # 图片总结卡专用模型配置（固定 GPT-4o-mini，独立于OCR视觉模型）
    card_api_key: str = ""
    card_base_url: str = "https://api.apimart.ai/v1"
    card_model: str = "gpt-4o-mini"

    # 鉴权配置
    jwt_secret: str = "change-me-in-production-please-use-a-long-random-string"
    jwt_expire_days: int = 7
    admin_username: str = "cumtmenglong"
    admin_password: str = "3220663"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

