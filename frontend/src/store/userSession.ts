"use client";

import { create } from "zustand";

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  picture?: string;
  provider?: string;
  provider_id?: string;
  has_password?: boolean;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string;
}

interface UserSessionState {
  token: string | null;
  user: UserProfile | null;
  setSession: (user: UserProfile, token: string) => void;
  clearSession: () => void;
}

const USER_TOKEN_KEY = "catalog_user_token";
const USER_PROFILE_KEY = "catalog_user_profile";

export const useUserSession = create<UserSessionState>((set) => ({
  token: null,
  user: null,
  setSession: (user, token) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(USER_TOKEN_KEY, token);
        window.localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user));
      } catch {
      }
    }
    set({ user, token });
  },
  clearSession: () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(USER_TOKEN_KEY);
        window.localStorage.removeItem(USER_PROFILE_KEY);
      } catch {
      }
    }
    set({ user: null, token: null });
  },
}));

export const hydrateUserSession = () => {
  if (typeof window === "undefined") return;
  try {
    const storedToken = window.localStorage.getItem(USER_TOKEN_KEY);
    const profileRaw = window.localStorage.getItem(USER_PROFILE_KEY);
    if (storedToken && profileRaw) {
      const profile = JSON.parse(profileRaw) as UserProfile;
      useUserSession.setState({ token: storedToken, user: profile });
    }
  } catch {
  }
};
