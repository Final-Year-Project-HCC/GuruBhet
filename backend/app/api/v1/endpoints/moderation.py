from uuid import UUID
from fastapi import APIRouter
from app.core.dependencies import DbSession, CurrentUser, RequireStaff
from app.schemas.moderation import ReportCreate, ReportRead, ReportResolve, BanCreate, BanRead

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
async def resolve_report(report_id: UUID, body: ReportUpdate, db: DbSession):
    """Staff: resolve or dismiss a report."""
    ...


# ── Bans ──────────────────────────────────────────────────────────────────────

@router.post("/bans", response_model=BanRead, status_code=201, dependencies=[RequireAdmin])
async def ban_user(body: BanCreate, db: DbSession):
    """
    Admin: ban a teacher (or user).
    Sets User.is_banned = True and creates a UserBan audit record.
    Can attach a recording URL as evidence.
    """
    ...


@router.delete("/bans/{ban_id}", status_code=204, dependencies=[RequireAdmin])
async def lift_ban(ban_id: UUID, db: DbSession):
    """Admin: lift an active ban."""
    ...


@router.get("/bans", response_model=list[BanRead], dependencies=[RequireAdmin])
async def list_bans(db: DbSession):
    ...