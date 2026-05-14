from datetime import UTC, datetime

import jwt
from fastapi import HTTPException, status
import httpx

from app.config import get_settings

_clerk_api_cache: dict = {"base_url": None, "secret_key": None}
_verified_user_cache: dict[str, tuple[float, dict]] = {}
_VERIFIED_USER_CACHE_TTL_SECONDS = 60


def _get_api_config() -> tuple[str, str]:
    settings = get_settings()
    base_url = "https://api.clerk.com"
    secret_key = settings.clerk_secret_key
    return base_url, secret_key


async def verify_clerk_token(token: str) -> dict:
    """Verify a Clerk session token via the Clerk Backend API.

    1. Decode the JWT (without signature verification) to get the ``sub`` claim.
    2. Call GET /v1/users/{user_id} to verify the user exists and is active.
    3. Return the payload with Clerk user info.

    Raises HTTPException(401) on any verification failure.
    """
    # Step 1: Decode JWT without verification to extract claims
    try:
        payload = jwt.decode(
            token,
            options={"verify_signature": False, "verify_exp": True},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Clerk token has expired",
        )
    except jwt.DecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Clerk token format: {exc}",
        )

    clerk_user_id = payload.get("sub")
    if not clerk_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Clerk token missing 'sub' claim",
        )

    now_ts = datetime.now(UTC).timestamp()
    cached = _verified_user_cache.get(clerk_user_id)
    if cached and cached[0] > now_ts:
        payload.update(cached[1])
        return payload

    # Step 2: Verify user via Clerk Backend API
    base_url, secret_key = _get_api_config()
    if not secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Clerk secret key not configured",
        )

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{base_url}/v1/users/{clerk_user_id}",
                headers={
                    "Authorization": f"Bearer {secret_key}",
                    "Content-Type": "application/json",
                },
            )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Failed to verify Clerk user: {exc}",
        )

    if resp.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Clerk user not found",
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Clerk API returned {resp.status_code}",
        )

    user_data = resp.json()

    # Check if user is banned or locked
    if user_data.get("banned"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Clerk account is banned",
        )

    email_addresses = user_data.get("email_addresses") or []
    primary_email_id = user_data.get("primary_email_address_id")
    primary_email = next(
        (
            email.get("email_address")
            for email in email_addresses
            if email.get("id") == primary_email_id and email.get("email_address")
        ),
        None,
    )
    email = primary_email or next(
        (email.get("email_address") for email in email_addresses if email.get("email_address")),
        None,
    )
    name = user_data.get("first_name", "") or user_data.get("username", "")
    if user_data.get("last_name"):
        name = f'{name} {user_data["last_name"]}'.strip()

    enriched = {"email": email, "name": name}
    payload.update(enriched)
    token_exp = payload.get("exp")
    token_ttl = max(0, int(token_exp) - int(now_ts)) if token_exp else _VERIFIED_USER_CACHE_TTL_SECONDS
    cache_ttl = min(_VERIFIED_USER_CACHE_TTL_SECONDS, token_ttl)
    if cache_ttl > 0:
        _verified_user_cache[clerk_user_id] = (now_ts + cache_ttl, enriched)

    return payload
