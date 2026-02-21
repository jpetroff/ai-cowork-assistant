from fastapi import APIRouter

from routers.health import router as health_router
from routers.workflows import router as workflows_router
from routers.completion import router as completion_router
from routers.embedding import router as embedding_router

routers = [
    health_router,
    workflows_router,
    completion_router,
    embedding_router,
]
