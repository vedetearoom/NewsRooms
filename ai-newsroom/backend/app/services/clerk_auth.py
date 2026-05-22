from datetime import UTC, datetime

import jwt
from fastapi import HTTPException, status
import httpx

from app.config import get_settings

_verified_user_cache: dict[str, tuple[float, dict]] = {}
_VERIFIED_USER_CACHE_TTL_SECONDS = 60
_JWT_CLOCK_SKEW_LEEWAY_SECONDS = 120
_jwks_clients: dict[str, jwt.PyJWKClient] = {}


def _get_api_config() -> tuple[str, str]:
    settings = get_settings()
    base_url = "https://api.clerk.com"
    secret_key = settings.clerk_secret_key
    return base_url, secret_key


def _get_jwks_url() -> str:
    settings = get_settings()
    if settings.clerk_jwks_url:
        return settings.clerk_jwks_url
    if settings.clerk_issuer:
        return f"{settings.clerk_issuer.rstrip('/')}/.well-known/jwks.json"
    return ""


def _verify_token_with_jwks(token: str) -> dict:
    settings = get_settings()
    jwks_url = _get_jwks_url()
    if not jwks_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Clerk JWKS URL not configured",
        )

    try:
        jwks_client = _jwks_clients.setdefault(jwks_url, jwt.PyJWKClient(jwks_url))
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        decode_options = {"verify_aud": False}
        decode_kwargs = {
            "algorithms": ["RS256"],
            "options": decode_options,
            "leeway": _JWT_CLOCK_SKEW_LEEWAY_SECONDS,
        }
        if settings.clerk_issuer:
            decode_kwargs["issuer"] = settings.clerk_issuer.rstrip("/")
        return jwt.decode(token, signing_key.key, **decode_kwargs)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Clerk token has expired",
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Clerk token: {exc}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Failed to verify Clerk token: {exc}",
        )


def _decode_unverified_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            options={"verify_signature": False, "verify_exp": True},
            leeway=_JWT_CLOCK_SKEW_LEEWAY_SECONDS,
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


async def _fetch_user_enrichment(clerk_user_id: str) -> dict:
    now_ts = datetime.now(UTC).timestamp()
    cached = _verified_user_cache.get(clerk_user_id)
    if cached and cached[0] > now_ts:
        return cached[1]

    base_url, secret_key = _get_api_config()
    if not secret_key:
        return {}

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{base_url}/v1/users/{clerk_user_id}",
            headers={
                "Authorization": f"Bearer {secret_key}",
                "Content-Type": "application/json",
            },
        )

    if resp.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Clerk user not found",
        )
    if resp.status_code != 200:
        return {}

    user_data = resp.json()
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
    _verified_user_cache[clerk_user_id] = (now_ts + _VERIFIED_USER_CACHE_TTL_SECONDS, enriched)
    return enriched


async def verify_clerk_token(token: str) -> dict:
    """Verify a Clerk session token and enrich it with Clerk user info when available."""
    if _get_jwks_url():
        payload = _verify_token_with_jwks(token)
    else:
        payload = _decode_unverified_token(token)

    clerk_user_id = payload.get("sub")
    if not clerk_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Clerk token missing 'sub' claim",
        )

    try:
        payload.update(await _fetch_user_enrichment(clerk_user_id))
    except HTTPException:
        raise
    except Exception:
        if not _get_jwks_url():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to verify Clerk user",
            )

    return payload
