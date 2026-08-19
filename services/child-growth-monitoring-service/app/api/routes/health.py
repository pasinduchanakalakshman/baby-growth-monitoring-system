from fastapi import APIRouter, HTTPException, status
from app.core.database import check_db_connection

router = APIRouter()

@router.get("/health")
async def health_check():
    db_connected = check_db_connection()
    
    if not db_connected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "error",
                "service": "child-growth-monitoring-service",
                "database": "disconnected"
            }
        )

    return {
        "status": "ok",
        "service": "child-growth-monitoring-service",
        "database": "connected"
    }
