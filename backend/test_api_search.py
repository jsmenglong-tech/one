import asyncio
import sys
sys.stdout.reconfigure(encoding='utf-8')

async def test():
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import select, or_
    from models import KnowledgePoint

    engine = create_async_engine("sqlite+aiosqlite:///data/jzs.db")
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    q = "施工"
    keyword = f"%{q}%"
    async with Session() as db:
        result = await db.execute(
            select(KnowledgePoint).where(
                or_(
                    KnowledgePoint.title.ilike(keyword),
                    KnowledgePoint.content.ilike(keyword),
                )
            ).limit(5)
        )
        kps = result.scalars().all()
        print(f"ilike搜索'{q}'结果: {len(kps)} 条")
        for kp in kps:
            print(" -", kp.title)

    await engine.dispose()

asyncio.run(test())
