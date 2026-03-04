"""
Health and readiness endpoints for liveness/readiness probes.
"""


def register_health_routes(router):
    from datetime import datetime, timezone
    import logging
    from fastapi import HTTPException

    from database import db

    logger = logging.getLogger(__name__)

    @router.get("/", tags=["Health"])
    async def root():
        return {"message": "Tebbi Medical System API", "version": "1.0.0"}

    @router.get("/health", tags=["Health"])
    async def health_check():
        """Liveness: is the process up."""
        return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

    @router.get("/health/liveness", tags=["Health"])
    async def liveness():
        """Liveness probe (K8s/Docker): process is up."""
        return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

    @router.get("/ready", tags=["Health"])
    async def ready_check():
        """Readiness: can the app serve traffic (e.g. DB reachable). Use in Docker/K8s health checks."""
        try:
            await db.command("ping")
            return {"status": "ready", "database": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
        except Exception as e:
            logger.warning("Readiness check failed: %s", e)
            raise HTTPException(status_code=503, detail="Database unavailable")

    @router.get("/health/readiness", tags=["Health"])
    async def readiness():
        """Readiness probe (K8s/Docker): app can serve traffic (DB reachable)."""
        try:
            await db.command("ping")
            return {"status": "ready", "database": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
        except Exception as e:
            logger.warning("Readiness check failed: %s", e)
            raise HTTPException(status_code=503, detail="Database unavailable")
