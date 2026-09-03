import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.models.user import User, UserRole


@pytest.mark.asyncio
async def test_user_roundtrip():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        user = User(
            email="user@example.com",
            hashed_password="fake-hashed-password",
            role=UserRole.USER,
        )

        session.add(user)
        await session.commit()
        await session.refresh(user)

        result = await session.execute(
            select(User).where(User.email == "user@example.com")
        )

        saved_user = result.scalar_one()

        assert saved_user.id is not None
        assert saved_user.email == "user@example.com"
        assert saved_user.hashed_password == "fake-hashed-password"
        assert saved_user.role == UserRole.USER
        assert saved_user.is_active is True
        assert saved_user.created_at is not None

    await engine.dispose()
