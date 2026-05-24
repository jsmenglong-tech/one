import os
import shutil
from datetime import datetime
from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

# SQLite 本地文件，零依赖
DB_PATH = os.path.join(os.path.dirname(__file__), "data", "jzs.db")
DB_BACKUP_DIR = os.path.join(os.path.dirname(__file__), "data", "backups")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
os.makedirs(DB_BACKUP_DIR, exist_ok=True)

DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


# 为每个新建的 SQLite 连接启用外键约束（aiosqlite 通过 sync_engine 暴露事件）
@event.listens_for(engine.sync_engine, "connect")
def _enable_sqlite_fk(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


def _backup_db():
    """启动时备份数据库（保留最近7份）"""
    if not os.path.exists(DB_PATH) or os.path.getsize(DB_PATH) == 0:
        return
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(DB_BACKUP_DIR, f"jzs_{timestamp}.db")
    try:
        shutil.copy2(DB_PATH, backup_path)
        # 只保留最近7份备份
        backups = sorted(
            [f for f in os.listdir(DB_BACKUP_DIR) if f.endswith(".db")],
        )
        for old in backups[:-7]:
            os.remove(os.path.join(DB_BACKUP_DIR, old))
        print(f"[DB] 数据库已备份至: {backup_path}")
    except Exception as e:
        print(f"[DB] 备份失败（不影响运行）: {e}")


async def _enable_wal():
    """启用 WAL 模式，提升数据安全性和并发性能"""
    async with engine.begin() as conn:
        await conn.exec_driver_sql("PRAGMA journal_mode=WAL")
        await conn.exec_driver_sql("PRAGMA synchronous=NORMAL")
        await conn.exec_driver_sql("PRAGMA wal_autocheckpoint=1000")
        await conn.exec_driver_sql("PRAGMA busy_timeout=5000")


async def init_db():
    """创建所有表，并确保数据持久化配置"""
    from models import Chapter, KnowledgePoint, Question, QuestionKnowledgeMap, WrongRecord  # noqa

    # 启动前备份
    _backup_db()

    # 启用 WAL 模式
    await _enable_wal()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 预置章节（仅在空库时初始化）
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        from models import Chapter
        result = await session.execute(select(Chapter))
        if not result.scalars().first():
            default_chapters = [
                Chapter(title="建设工程项目管理", sort_order=1),
                Chapter(title="建设工程质量管理", sort_order=2),
                Chapter(title="建设工程安全管理", sort_order=3),
                Chapter(title="建设工程进度管理", sort_order=4),
                Chapter(title="建设工程成本管理", sort_order=5),
                Chapter(title="建设工程合同管理", sort_order=6),
                Chapter(title="建设工程法规", sort_order=7),
            ]
            session.add_all(default_chapters)
            await session.commit()
