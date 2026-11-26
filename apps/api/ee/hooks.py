"""Own implementation of the EE extension hooks, built from the St. Joseph's fork code.
Presence of this file turns on the extras (see src/core/ee_hooks.py). Payments are intentionally not provided."""


def register_routers(v1_router):
    from fastapi import Depends
    # defined at module level in src/router.py before it calls register_ee_routers
    from src.router import get_non_api_token_user, require_authenticated_user
    from ee.routers import lti as lti_router
    from ee.routers import live_sessions as live_sessions_router
    from ee.routers.boards import boards as boards_router
    from ee.routers.boards import boards_playground
    from ee.routers.playgrounds import playgrounds, playgrounds_generator

    # LTI launch is a public endpoint; its admin endpoints declare their own auth.
    v1_router.include_router(lti_router.router, prefix="/lti", tags=["lti"])
    v1_router.include_router(live_sessions_router.router, prefix="/courses", tags=["live_sessions"])
    v1_router.include_router(boards_router.router, prefix="/boards", tags=["boards"], dependencies=[Depends(get_non_api_token_user)])
    v1_router.include_router(boards_router.internal_router, prefix="/boards", tags=["boards-internal"])
    v1_router.include_router(boards_playground.router, prefix="/boards", tags=["boards", "boards-playground"], dependencies=[Depends(require_authenticated_user)])
    v1_router.include_router(playgrounds.router, prefix="/playgrounds", tags=["playgrounds"], dependencies=[Depends(require_authenticated_user)])
    v1_router.include_router(playgrounds_generator.router, prefix="/playgrounds", tags=["playgrounds", "playgrounds-generator"], dependencies=[Depends(require_authenticated_user)])


def is_license_active() -> bool:
    """Self-hosted deployment owned by St. Joseph's: the extras are enabled."""
    return True


def is_feature_licensed(feature: str) -> bool:
    """Everything except Payments."""
    return feature != "payments"
