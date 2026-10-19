from datetime import UTC, datetime
from typing import Any

import psutil
from fastapi import APIRouter

router = APIRouter(
    tags=["Health"],
)


@router.get("/health")
def salamat_check() -> dict[str, Any]:
    cpu_perc = psutil.cpu_percent()
    memory = psutil.virtual_memory()
    uptime = datetime.now(UTC) - datetime.fromtimestamp(psutil.boot_time(), tz=UTC)

    return {
        "status": "healthy",
        "system": {
            "CPU Percent": cpu_perc,
            "Memory Percent": memory.percent,
            "UpTime": uptime.total_seconds(),
        },
    }
