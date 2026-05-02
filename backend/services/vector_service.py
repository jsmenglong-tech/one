"""FAISS向量库服务 - 知识点去重 + 相似检索
若 faiss 未安装，自动降级为纯numpy内存向量搜索（功能一致，重启后不持久化）
"""
import os
import json
import asyncio
import numpy as np
from config import get_settings
from services.llm_service import get_embedding

settings = get_settings()

INDEX_FILE = os.path.join(settings.faiss_index_path, "index.npy")
MAP_FILE = os.path.join(settings.faiss_index_path, "id_map.json")

# 尝试导入 faiss
try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False

DIM = 1024  # BAAI/bge-large-zh-v1.5


class VectorService:
    def __init__(self):
        os.makedirs(settings.faiss_index_path, exist_ok=True)
        self._lock = asyncio.Lock()
        self._load()

    def _load(self):
        self.id_map: list[str] = []
        if FAISS_AVAILABLE:
            faiss_file = os.path.join(settings.faiss_index_path, "index.faiss")
            if os.path.exists(faiss_file) and os.path.exists(MAP_FILE):
                self.index = faiss.read_index(faiss_file)
                with open(MAP_FILE, "r") as f:
                    self.id_map = json.load(f)
            else:
                self.index = faiss.IndexFlatL2(DIM)
        else:
            # 降级：numpy数组
            if os.path.exists(INDEX_FILE) and os.path.exists(MAP_FILE):
                self.vectors = np.load(INDEX_FILE)
                with open(MAP_FILE, "r") as f:
                    self.id_map = json.load(f)
            else:
                self.vectors = np.zeros((0, DIM), dtype="float32")

    def _save(self):
        with open(MAP_FILE, "w") as f:
            json.dump(self.id_map, f)
        if FAISS_AVAILABLE:
            faiss_file = os.path.join(settings.faiss_index_path, "index.faiss")
            faiss.write_index(self.index, faiss_file)
        else:
            np.save(INDEX_FILE, self.vectors)

    async def add(self, knowledge_id: str, content: str):
        try:
            embedding = await get_embedding(content)
            vec = np.array([embedding], dtype="float32")
            async with self._lock:
                if FAISS_AVAILABLE:
                    self.index.add(vec)
                else:
                    self.vectors = np.vstack([self.vectors, vec]) if len(self.vectors) > 0 else vec
                self.id_map.append(knowledge_id)
                self._save()
        except Exception:
            # LLM未配置时跳过向量存储，不影响主流程
            pass

    async def search(self, query: str, top_k: int = 5) -> list[str]:
        try:
            total = self.index.ntotal if FAISS_AVAILABLE else len(self.vectors)
            if total == 0:
                return []
            embedding = await get_embedding(query)
            vec = np.array([embedding], dtype="float32")
            k = min(top_k, total)

            if FAISS_AVAILABLE:
                _, indices = self.index.search(vec, k)
                idx_list = indices[0].tolist()
            else:
                # 余弦相似度搜索
                norms = np.linalg.norm(self.vectors, axis=1, keepdims=True) + 1e-9
                normed = self.vectors / norms
                q_norm = vec / (np.linalg.norm(vec) + 1e-9)
                scores = normed @ q_norm.T
                idx_list = np.argsort(-scores.flatten())[:k].tolist()

            return [self.id_map[i] for i in idx_list if 0 <= i < len(self.id_map)]
        except Exception:
            return []

    def export_binary(self) -> bytes:
        try:
            if FAISS_AVAILABLE:
                import tempfile
                with tempfile.NamedTemporaryFile(suffix=".faiss", delete=False) as tmp:
                    faiss.write_index(self.index, tmp.name)
                    tmp_name = tmp.name
                with open(tmp_name, "rb") as f:
                    data = f.read()
                os.unlink(tmp_name)
                return data
            else:
                # 导出numpy格式
                import io
                buf = io.BytesIO()
                np.save(buf, self.vectors)
                return buf.getvalue()
        except Exception:
            return b""

    def get_id_map(self) -> list[str]:
        return self.id_map.copy()


_vector_service: VectorService | None = None


def get_vector_service() -> VectorService:
    global _vector_service
    if _vector_service is None:
        _vector_service = VectorService()
    return _vector_service
