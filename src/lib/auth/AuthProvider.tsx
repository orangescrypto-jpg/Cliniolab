'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/auth/supabaseClient';
import { signIn, signOut, signUp, type SessionUser } from '@/lib/auth/authService';
import type { UserRole } from '@/types';

interface FullSessionUser extends SessionUser {
  role: UserRole;
  currentStreakDays: number;
  longestStreakDays: number;
}

interface AuthContextValue {
  user: FullSessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<{ needsEmailConfirmation: boolean }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchAppUser(): Promise<FullSessionUser | null> {
  const res = await fetch('/api/auth/sync-user', { method: 'POST' });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    id: data.user.id,
    email: data.user.email,
    displayName: data.user.displayName,
    role: data.user.role,
    currentStreakDays: data.user.currentStreakDays ?? 0,
    longestStreakDays: data.user.longestStreakDays ?? 0,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FullSessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    fetchAppUser()
      .then((u) => {
        setUser(u);
      })
      .finally(() => {
        setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only clear the user on an explicit logout. Other events (e.g. a
      // momentary null session during INITIAL_SESSION, or a failed
      // TOKEN_REFRESHED) must never log the user out on their own.
      if (event === 'SIGNED_OUT') {
        setUser(null);
        return;
      }

      if (!session) {
        // No session yet for a non-logout event (e.g. still initializing).
        // Do nothing and let the existing user state stand.
        return;
      }

      const appUser = await fetchAppUser();
      // Only apply the result if it succeeded; a transient failure here
      // (network blip, cold start) must not wipe out a valid logged-in user.
      if (appUser) {
        setUser(appUser);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await signIn(email, password);
    const appUser = await fetchAppUser();
    setUser(appUser);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const result = await signUp(email, password, displayName);
    if (result.needsEmailConfirmation) {
      // No session yet — user must confirm their email before they can log in.
      return { needsEmailConfirmation: true };
    }
    const appUser = await fetchAppUser();
    setUser(appUser);
    return { needsEmailConfirmation: false };
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
