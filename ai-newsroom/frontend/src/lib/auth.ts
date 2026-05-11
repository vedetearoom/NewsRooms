"use client";

import * as React from "react";

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
  is_active: boolean;
  is_super_admin: boolean;
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

function dispatchAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
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
  window.localStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
  dispatchAuthChanged();
}

export function updateStoredUser(user: AuthUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  dispatchAuthChanged();
}

export function logout() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  dispatchAuthChanged();
}

export function hasPermission(user: AuthUser | null | undefined, permission: string): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return user.permissions.includes(permission);
}

export function useAuthState() {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const sync = () => {
      setUser(getStoredUser());
      setToken(getAuthToken());
      setReady(true);
    };

    sync();
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    user,
    token,
    ready,
    isAuthenticated: Boolean(token),
    hasPermission: (permission: string) => hasPermission(user, permission),
  };
}
