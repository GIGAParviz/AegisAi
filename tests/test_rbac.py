import pytest

from app.core.security import hash_pass
from app.db.models.user import User, UserRole


@pytest.mark.asyncio
async def test_regular_user_cannot_access_admin(client):
    await client.post(
        "/auth/register",
        json={
            "email": "user@example.com",
            "password": "secret123",
        },
    )

    login_response = await client.post(
        "/auth/login",
        json={
            "email": "user@example.com",
            "password": "secret123",
        },
    )

    access_token = login_response.json()["access_token"]

    response = await client.get(
        "/admin/whoami",
        headers={
            "Authorization": f"Bearer {access_token}",
        },
    )

    assert response.status_code == 403
    
    
@pytest.mark.asyncio
async def test_admin_endpoint_without_token_returns_401(client):
    response = await client.get(
        "/admin/whoami",
    )

    assert response.status_code == 401
    

@pytest.mark.asyncio
async def test_admin_can_access_admin_endpoint(
    client,
    db_session,
):
    admin = User(
        email="admin@example.com",
        hashed_password=hash_pass("secret123"),
        role=UserRole.ADMIN,
    )

    db_session.add(admin)
    await db_session.commit()

    login_response = await client.post(
        "/auth/login",
        json={
            "email": "admin@example.com",
            "password": "secret123",
        },
    )

    assert login_response.status_code == 200

    access_token = login_response.json()["access_token"]

    response = await client.get(
        "/admin/whoami",
        headers={
            "Authorization": f"Bearer {access_token}",
        },
    )

    assert response.status_code == 200