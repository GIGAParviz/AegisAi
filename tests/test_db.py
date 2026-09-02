import pytest
from sqlalchemy import String, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DummyUser(Base):
    __tablename__ = "test_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))

@pytest.mark.asyncio
async def test_async_database_insert_select_commit():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
    )
    session_factory = async_sessionmaker(
        bind=engine,
        expire_on_commit=False,
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        
    async with session_factory() as session:
        user = DummyUser(name="Amir")
        
        session.add(user)
        await session.commit()
        await session.refresh(user)
        
        
        result = await session.execute(
            select(DummyUser)
            .where(DummyUser.name == "Amir")
        )
        
        saved_user = result.scalar_one()
        
        assert saved_user.name == "Amir"
        assert saved_user.id is not None
    
    await engine.dispose()