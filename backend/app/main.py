from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.api.routes import router
from app.api.auth_routes import router as auth_router
from app.api.customer_routes import router as customer_router
from app.api.admin_routes import router as admin_router
from app.api.technician_routes import router as technician_router
from app.api.public_routes import router as public_router
from app.models import entities  # noqa: F401

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.app_name,
    version="2.0.0",
    description="Explainable field-service scheduling and recovery API"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(auth_router)
app.include_router(customer_router)
app.include_router(admin_router)
app.include_router(technician_router)
app.include_router(public_router)

@app.get("/")
def root():
    return {"name": "DispatchGrid", "docs": "/docs", "health": "/api/health", "version": "2.0.0"}
