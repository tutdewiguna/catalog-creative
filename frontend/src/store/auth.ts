"use client";

import { create } from "zustand";

import { useUserSession } from "./userSession";

export type AuthRole = "admin" | "user";

export interface AuthProfile {
  name?: string;
  email?: string;
}

interface AuthState {
  token: string | null;
  role: AuthRole | null;
  profile: AuthProfile | null;
  setToken: (token: string | null) => void;
  login: (token: string, role: AuthRole, profile?: AuthProfile | null) => void;
  logout: () => void;
  hydrate: () => void;
}

const STORAGE_TOKEN_KEY = "adm_token";
const STORAGE_ROLE_KEY = "adm_role";
const STORAGE_PROFILE_KEY = "adm_profile";

const getStoredState = (): Pick<AuthState, "token" | "role" | "profile"> => {
  if (typeof window === "undefined") {
    return { token: null, role: null, profile: null };
  }

  try {
    const token = window.localStorage.getItem(STORAGE_TOKEN_KEY);
    const roleRaw = window.localStorage.getItem(STORAGE_ROLE_KEY) as AuthRole | null;
    const profileRaw = window.localStorage.getItem(STORAGE_PROFILE_KEY);
    let profile: AuthProfile | null = null;
    if (profileRaw) {
      profile = JSON.parse(profileRaw) as AuthProfile;
    }
    const role = roleRaw === "admin" || roleRaw === "user" ? roleRaw : null;
    return { token, role, profile };
  } catch (error) {
    console.warn("Failed to read stored auth state", error);
    return { token: null, role: null, profile: null };
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  ...getStoredState(),
  setToken: (token) => {
    if (typeof window !== "undefined") {
      try {
        if (token) {
          window.localStorage.setItem(STORAGE_TOKEN_KEY, token);
        } else {
          window.localStorage.removeItem(STORAGE_TOKEN_KEY);
        }
      } catch {}
    }
    set({ token });
  },
  login: (token, role, profile) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_TOKEN_KEY, token);
        window.localStorage.setItem(STORAGE_ROLE_KEY, role);
        if (profile) {
          window.localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile));
        } else {
          window.localStorage.removeItem(STORAGE_PROFILE_KEY);
        }
      } catch {}
    }
    set({ token, role, profile: profile ?? null });
  },
  logout: () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_TOKEN_KEY);
        window.localStorage.removeItem(STORAGE_ROLE_KEY);
        window.localStorage.removeItem(STORAGE_PROFILE_KEY);
      } catch {}
    }
    try {
      useUserSession.getState().clearSession();
    } catch {}
    set({ token: null, role: null, profile: null });
  },
  hydrate: () => {
    const stored = getStoredState();
    set(stored);
  },
}));