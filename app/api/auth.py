from fastapi import APIRouter, Depends, HTTPException, status
from jwt import ExpiredSignatureError, InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_pass,
    verify_pass,
)
from app.db.engine import get_session
from app.db.models.user import User, UserRole
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=UserResponse,
)
async def register(
    payload: RegisterRequest,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(User).where(User.email == payload.email))

    exist_user = result.scalar_one_or_none()

    if exist_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=payload.email,
        hashed_password=hash_pass(payload.password),
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    return UserResponse(
        id=user.id,
        email=user.email,
        role=UserRole.USER,
        is_active=user.is_active,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(User).where(User.email == payload.email))

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not verify_pass(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid credentials",
        )

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )

@router.post(
    "/refresh",
    response_model=TokenResponse,
)
async def refresh(
    payload: RefreshRequest,
):
    try:
        decoded = decode_token(payload.refresh_token)

    except ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired",
        ) from exc

    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        ) from exc

    if decoded.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    subject = decoded.get("sub")

    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )

    return TokenResponse(
        access_token=create_access_token(subject),
        refresh_token=create_refresh_token(subject),
    )
