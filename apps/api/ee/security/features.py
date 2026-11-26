"""Feature-gate dependencies for boards and Plays (ported from the St. Joseph's fork)."""
from fastapi import Depends, HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.events.database import get_db_session
from src.security.features_utils.dependencies import _check_feature_enabled

async def require_boards_feature(
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
) -> bool:
    """
    Router-level dependency that auto-detects the parameter type and checks
    if the boards feature is enabled AND the org plan is Personal or higher
    (Standard is gated by the feature flag instead).

    Checks in order: board_uuid (path), org_id (path), org_id (query)
    """
    from src.security.features_utils.plan_check import get_org_plan
    from src.security.features_utils.plans import plan_meets_requirement

    path_params = request.path_params
    org_id = None

    if "board_uuid" in path_params:
        from ee.db.boards import Board
        board_uuid = path_params["board_uuid"]
        statement = select(Board).where(Board.board_uuid == board_uuid)
        board = (await db_session.execute(statement)).scalars().first()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        org_id = board.org_id

    if org_id is None and "org_id" in path_params:
        try:
            org_id = int(path_params["org_id"])
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid org_id format")

    if org_id is None:
        org_id_query = request.query_params.get("org_id")
        if org_id_query is not None:
            try:
                org_id = int(org_id_query)
            except (ValueError, TypeError):
                pass

    if org_id is None:
        return True

    # Check feature flag
    await _check_feature_enabled("boards", org_id, db_session)

    # Check plan (Personal+ or OSS)
    current_plan = await get_org_plan(org_id, db_session)
    if not plan_meets_requirement(current_plan, "personal"):
        raise HTTPException(
            status_code=403,
            detail="Boards requires a Personal plan or higher. "
            f"Your organization is currently on the {current_plan.capitalize()} plan.",
        )

    return True


async def require_playgrounds_feature(
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
) -> bool:
    """
    Router-level dependency that auto-detects the parameter type and checks
    if the playgrounds feature is enabled AND the org plan is Personal or higher
    (Standard is gated by the feature flag instead).

    Checks in order: playground_uuid (path), org_id (path), org_id (query)
    """
    from src.security.features_utils.plan_check import get_org_plan
    from src.security.features_utils.plans import plan_meets_requirement

    path_params = request.path_params
    org_id = None

    if "playground_uuid" in path_params:
        from ee.db.playgrounds import Playground
        playground_uuid = path_params["playground_uuid"]
        statement = select(Playground).where(Playground.playground_uuid == playground_uuid)
        playground = (await db_session.execute(statement)).scalars().first()
        if playground:
            org_id = playground.org_id

    if org_id is None and "org_id" in path_params:
        try:
            org_id = int(path_params["org_id"])
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid org_id format")

    if org_id is None:
        org_id_query = request.query_params.get("org_id")
        if org_id_query is not None:
            try:
                org_id = int(org_id_query)
            except (ValueError, TypeError):
                pass

    if org_id is None:
        return True

    # Check feature flag
    await _check_feature_enabled("playgrounds", org_id, db_session)

    # Check plan (Personal+ or non-SaaS mode)
    from src.core.deployment_mode import get_deployment_mode
    if get_deployment_mode() != 'saas':
        return True

