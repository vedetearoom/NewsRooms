"use client";

import * as React from "react";
import { api } from "@/lib/api";
import { useAuthSafe } from "@/lib/clerk-safe";

const AUTH_TOKEN_KEY = "ai_newsroom_token";
const AUTH_USER_KEY = "ai_newsroom_user";
const AUTH_EVENT = "ai-newsroom-auth-changed";

export interface AuthPermission {
  id?: number;
  code: string;
  name?: string;
  permission_group?: string;
  description?: string | null;
}

export interface AuthRole {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  quota_limits?: Record<string, number | null> | null;
  is_system?: boolean;
  permissions?: AuthPermission[];
  user_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  display_name: string;
  clerk_user_id?: string | null;
  is_active: boolean;
  roles: AuthRole[];
  permissions: string[];
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  access_token: string;
  token_type?: string;
  user: AuthUser;
}

// --- Clerk token cache bridge ---
// Clerk's getToken() is async, but getAuthToken() is called synchronously
// from 6+ places. This module-level cache bridges the gap.

let _cachedToken: string | null = null;
let _tokenGetter: ((forceRefresh?: boolean) => Promise<string | null>) | null = null;
let _tokenFetchPromise: Promise<string | null> | null = null;
let _forceTokenFetchPromise: Promise<string | null> | null = null;

export function clearAuthTokenCache() {
  _cachedToken = null;
}

export function hasClerkTokenGetter(): boolean {
  return Boolean(_tokenGetter);
}

export function registerClerkTokenGetter(getter: ((forceRefresh?: boolean) => Promise<string | null>) | null) {
  _tokenGetter = getter;
}

export async function fetchClerkToken(forceRefresh = false): Promise<string | null> {
  if (!_tokenGetter) return _cachedToken;
  if (forceRefresh && _forceTokenFetchPromise) return _forceTokenFetchPromise;
  if (!forceRefresh && _tokenFetchPromise) return _tokenFetchPromise;

  const promise = (async () => {
    if (forceRefresh) _cachedToken = null;
    try {
      _cachedToken = await _tokenGetter?.(forceRefresh) ?? null;
    } catch {
      _cachedToken = null;
    }
    return _cachedToken;
  })();

  if (forceRefresh) {
    _forceTokenFetchPromise = promise;
    try {
      return await promise;
    } finally {
      _forceTokenFetchPromise = null;
    }
  }

  _tokenFetchPromise = promise;
  try {
    return await promise;
  } finally {
    _tokenFetchPromise = null;
  }
}

export async function getAuthHeader(): Promise<Record<string, string>> {
  let token = getAuthToken();
  if (!token) {
    token = await fetchClerkToken();
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function dispatchAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
}

export function getLocalAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const localToken = getLocalAuthToken();
  if (localToken) return localToken;
  return _cachedToken;
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthToken());
}

export function login(session: AuthSession) {
  if (typeof window === "undefined") return;
  _cachedToken = session.access_token;
  window.localStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
  dispatchAuthChanged();
}

export function updateStoredUser(user: AuthUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  dispatchAuthChanged();
}

export function clearLocalAuthStorage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  dispatchAuthChanged();
}

export function logout() {
  if (typeof window === "undefined") return;
  _cachedToken = null;
  _clerkUser = null;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  dispatchAuthChanged();
}

export function hasPermission(user: AuthUser | null | undefined, permission: string): boolean {
  if (!user) return false;
  return user.permissions.includes(permission);
}

// --- Cached user from backend /api/auth/me ---
let _clerkUser: AuthUser | null = null;
let _clerkUserFetchPromise: Promise<AuthUser> | null = null;

export async function fetchAndCacheMeUser(options?: { throwOnError?: boolean }): Promise<AuthUser | null> {
  if (!_clerkUserFetchPromise) {
    _clerkUserFetchPromise = (async () => {
      try {
        const user = await api.auth.me();
        _clerkUser = user;
        updateStoredUser(user);
        return user;
      } catch (error) {
        _clerkUser = null;
        throw error;
      } finally {
        _clerkUserFetchPromise = null;
      }
    })();
  }

  try {
    return await _clerkUserFetchPromise;
  } catch (error) {
    if (options?.throwOnError) throw error;
    return null;
  }
}

export function useAuthState() {
  const clerkAuth = useAuthSafe();
  const { isSignedIn, isLoaded: clerkLoaded } = clerkAuth;
  const [user, setUser] = React.useState<AuthUser | null>(() => getStoredUser());
  const [ready, setReady] = React.useState(() => Boolean(getStoredUser()));

  React.useEffect(() => {
    if (!clerkLoaded) return;

    if (!isSignedIn && !getAuthToken()) {
      setUser(null);
      setReady(true);
      return;
    }

    // Clerk is signed in or local token exists — fetch the full user from our backend
    let cancelled = false;
    (async () => {
      const meUser = await fetchAndCacheMeUser();
      if (!cancelled) {
        setUser(meUser);
        setReady(true);
      }
    })();

    // Listen for legacy auth events (e.g., admin creates user via local login)
    const sync = () => {
      const stored = getStoredUser();
      if (stored) setUser(stored);
    };
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [isSignedIn, clerkLoaded]);

  return {
    user,
    token: getAuthToken(),
    ready,
    isAuthenticated: Boolean(user) || Boolean(isSignedIn),
    hasPermission: (permission: string) => hasPermission(user, permission),
  };
}
