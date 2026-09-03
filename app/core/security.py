from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from passlib.hash import argon2

from app.core.config import settings


def hash_pass(password: str) -> str:
    return argon2.hash(password)


def verify_pass(password: str, hashed_pass: str) -> bool:
    return argon2.verify(password, hashed_pass)


def create_token(
    subject: str,
    token_type: str,
    exipred_delta: timedelta,
) -> str:
    now = datetime.now(UTC)

    payload = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + exipred_delta,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret,
        settings.jwt_alg,
    )


def create_access_token(subject: str) -> str:
    return create_token(
        subject,
        "access",
        exipred_delta=timedelta(minutes=settings.access_token_expire_min),
    )


def create_refresh_token(subject: str) -> str:
    return create_token(
        subject,
        "refresh",
        exipred_delta=timedelta(
            settings.refresh_token_expire_days,
        ),
    )


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_alg],
    )

