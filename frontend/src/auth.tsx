import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

import { apiFetch, setToken, clearToken, getToken } from "@/src/api";

export type Role = "walker" | "partner" | "admin";

export type User = {
  id: string;
  email: string;
  firstName: string;
  role: Role;
  plan: "FREE" | "PREMIUM";
  ccBalance: number;
  consentRGPD?: boolean;
  partnerId?: string;
  partner?: any;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string, firstName: string, consentRGPD: boolean) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch<User>("/auth/me");
      setUser(me);
    } catch {
      await clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    });
    await setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(
    async (email: string, password: string, firstName: string, consentRGPD: boolean) => {
      const data = await apiFetch<{ token: string; user: User }>("/auth/signup", {
        method: "POST",
        auth: false,
        body: { email, password, firstName, consentRGPD },
      });
      await setToken(data.token);
      setUser(data.user);
      return data.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await apiFetch<User>("/auth/me");
      setUser(me);
    } catch {
      // ignore
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const roleHome: Record<Role, string> = {
  walker: "/(walker)/(tabs)/home",
  partner: "/(partner)/(tabs)/validate",
  admin: "/(admin)/(tabs)/dashboard",
};
