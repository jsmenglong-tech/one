# 一级建造师知识库系统

本地优先的一建实务知识结构化管理 + 智能出题平台。

## 快速启动

### 第一步：配置环境变量
```bash
cp .env.example .env
# 编辑 .env，填入你的 LLM API Key
```

### 第二步：启动所有服务
```bash
docker-compose up -d
```

### 第三步：访问系统
- 前端：http://localhost:3000
- API文档：http://localhost:8000/docs
- 管理后台：http://localhost:3000/admin
- 学习端：http://localhost:3000/study

---

## 不使用Docker（本地开发）

### 后端
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # 填入配置
uvicorn main:app --reload --port 8000
```

### 前端
```bash
cd frontend
npm install
npm run dev
```

> 需要先在本地安装并启动 PostgreSQL，并执行 `backend/db/init.sql`

---

## 主要功能

| 功能 | 接口 |
|------|------|
| 导入章节文本（自动拆知识点）| `POST /knowledge/import-chapter` |
| 上传图片OCR导入 | `POST /knowledge/import-image` |
| 单个知识点入库 | `POST /knowledge/add` |
| 查看知识点列表 | `GET /knowledge/list` |
| 语义搜索知识点 | `GET /knowledge/search?q=xxx` |
| 生成选择/案例题 | `POST /questions/generate` |
| 导出knowledge-pack | `GET /export/knowledge-pack` |

---

## knowledge-pack 结构

```
knowledge-pack/
├── meta.json              # 版本、导出时间、数量统计
├── chapters.json          # 章节树结构
├── knowledge.json         # 全部知识点（UUID稳定）
├── questions.json         # 题库（含知识点关联）
├── embeddings.bin         # FAISS向量索引
└── embeddings_id_map.json # 向量索引ID映射
```

---

## 验收清单

- ✅ 导入章节 → 自动拆知识点（LLM拆分 + 去重）
- ✅ 知识点 → 生成单选/多选/案例题（含质检）
- ✅ 导出 knowledge-pack.zip（可离线使用）
- ✅ UUID稳定（基于内容hash去重，ID不变）
- ✅ 无后端可直接读取知识包JSON
