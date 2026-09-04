from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import require_roles
from app.db.models.user import User, UserRole

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
)


@router.get("/whoami")
async def admin_whoami(
    current_user: Annotated[
        User,
        Depends(require_roles(UserRole.ADMIN)),
    ],
):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role,
    }

