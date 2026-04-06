import asyncio
from sqlalchemy import select
from app.db.session import async_session_maker
from app.models.subject import Subject

async def test():
    async with async_session_maker() as db:
        stmt = select(Subject).limit(1)
        result = await db.execute(stmt)
        s = result.scalar_one_or_none()
        if s:
            print("Subject found:", s.name)
            print("Board:", s.board.name if s.board else None)
            print("StudyLevel:", s.study_level.name if s.study_level else None)
        else:
            print("No subject found.")

asyncio.run(test())
