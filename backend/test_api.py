from fastapi import FastAPI
from fastapi.testclient import TestClient
from uuid import UUID
from typing import Optional

app = FastAPI()

@app.get("/boards")
def list_boards(study_level_id: UUID = None):
    return {"id": study_level_id}

client = TestClient(app)
response = client.get("/boards?study_level_id=123e4567-e89b-12d3-a456-426614174000")
print(response.json())
