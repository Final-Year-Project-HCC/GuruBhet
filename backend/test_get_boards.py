import asyncio
from uuid import uuid4
from sqlalchemy import select
from app.models.subject import Board, board_study_levels

def test_query():
    stmt = select(Board).where(Board.is_active == True)
    
    study_level_id = uuid4()
    if study_level_id:
        stmt = stmt.join(board_study_levels).where(
            board_study_levels.c.study_level_id == study_level_id,
            board_study_levels.c.is_active == True
        )
    print(stmt)

test_query()
