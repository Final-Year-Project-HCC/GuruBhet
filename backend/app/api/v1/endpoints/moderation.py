from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Path

from app.core.dependencies import CurrentUser, DbSession, RequireStaff
from app.models.user import User
from app.schemas.moderation import BanCreate, BanRead, ReportCreate, ReportRead, ReportResolve

router = APIRouter()


# ── Reports ───────────────────────────────────────────────────────────────────


@router.post("/reports", response_model=ReportRead, status_code=201)
async def file_report(body: ReportCreate, current_user: CurrentUser, db: DbSession):
    """Student or teacher files a report against the other party."""
    ...


@router.get("/reports", response_model=list[ReportRead], dependencies=[RequireStaff])
async def list_reports(db: DbSession, status: str | None = None):
    """Staff: list all reports, filterable by status."""
    ...


@router.patch("/reports/{report_id}", response_model=ReportRead, dependencies=[RequireStaff])
async def resolve_report(
    report_id: Annotated[UUID, Path(..., alias="reportId")], body: ReportResolve, db: DbSession
):
    """Staff: resolve or dismiss a report."""
    ...


# ── Bans ──────────────────────────────────────────────────────────────────────


@router.post("/bans", response_model=BanRead, status_code=201, dependencies=[RequireStaff])
async def ban_user(body: BanCreate, db: DbSession):
    """
    Staff: ban a teacher (or user).
    Sets User.is_banned = True and creates a UserBan audit record.
    Can attach a recording URL as evidence.
    """
    ...


@router.delete("/bans/{ban_id}", status_code=204, dependencies=[RequireStaff])
async def lift_ban(ban_id: Annotated[UUID, Path(..., alias="banId")], db: DbSession):
    """Staff: lift an active ban."""
    ...


@router.get("/bans", response_model=list[BanRead], dependencies=[RequireStaff])
async def list_bans(db: DbSession): ...
