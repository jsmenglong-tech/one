"""FastAPI 主入口"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers import knowledge, chapters, questions, export, settings, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="一级建造师知识库系统",
    description="本地优先的一建实务知识管理与出题系统",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chapters.router)
app.include_router(knowledge.router)
app.include_router(questions.router)
app.include_router(export.router)
app.include_router(settings.router)
app.include_router(auth.router)


@app.get("/")
async def root():
    return {"name": "一建知识库系统", "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok"}

