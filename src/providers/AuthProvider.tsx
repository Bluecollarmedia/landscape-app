/**
 * Auth Provider
 *
 * Wraps the app in authentication state powered by Supabase.
 * When Supabase is not configured (no .env), falls through to
 * mock state so the app is explorable.
 *
 * Supports onboarding states:
 *  - unauthenticated → welcome / sign-in
 *  - authenticated, no membership → onboarding
 *  - authenticated, pending request → pending approval
 *  - authenticated, active membership → role-based routing
 */

import React, { createContext, useContext, useEffect, useMemo, useReducer, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AuthState, UserProfile, UserRole } from '@/types';
import type { OnboardingStep } from '@/types/onboarding';

// ── Extended auth state ─────────────────────────────────────────

export type AppState =
  | 'loading'
  | 'unauthenticated'
  | 'onboarding'
  | 'pending_approval'
  | 'declined'
  | 'active';

interface ExtendedAuthState extends AuthState {
  appState: AppState;
  onboardingStep: OnboardingStep;
  pendingCompanyName?: string;
  pendingRequestId?: string;
}

// ── Actions ──────────────────────────────────────────────────────
type AuthAction =
  | { type: 'RESTORE_SESSION'; user: UserProfile; session: AuthState['session'] }
  | { type: 'SIGN_IN'; user: UserProfile; session: AuthState['session'] }
  | { type: 'SIGN_OUT' }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'UPDATE_PROFILE'; user: UserProfile }
  | { type: 'SET_APP_STATE'; appState: AppState; onboardingStep?: OnboardingStep; pendingCompanyName?: string; pendingRequestId?: string }
  | { type: 'SET_DEV_MODE'; user: UserProfile; session: AuthState['session']; appState: AppState; onboardingStep: OnboardingStep };

// ── Reducer ──────────────────────────────────────────────────────
function authReducer(state: ExtendedAuthState, action: AuthAction): ExtendedAuthState {
  switch (action.type) {
    case 'RESTORE_SESSION':
    case 'SIGN_IN':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.user,
        session: action.session,
        appState: 'active',
        onboardingStep: 'ready',
      };
    case 'SIGN_OUT':
      return {
        isLoading: false,
        isAuthenticated: false,
        user: null,
        session: null,
        appState: 'unauthenticated',
        onboardingStep: 'welcome',
        pendingCompanyName: undefined,
        pendingRequestId: undefined,
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    case 'UPDATE_PROFILE':
      return { ...state, user: action.user };
    case 'SET_APP_STATE':
      return {
        ...state,
        appState: action.appState,
        onboardingStep: action.onboardingStep ?? state.onboardingStep,
        pendingCompanyName: action.pendingCompanyName ?? state.pendingCompanyName,
        pendingRequestId: action.pendingRequestId ?? state.pendingRequestId,
      };
    case 'SET_DEV_MODE':
      return {
        isLoading: false,
        isAuthenticated: action.appState !== 'unauthenticated',
        user: action.user,
        session: action.session,
        appState: action.appState,
        onboardingStep: action.onboardingStep,
        pendingCompanyName: action.onboardingStep === 'pending_approval' ? 'Brighton Lawn + Landscape' : undefined,
        pendingRequestId: action.onboardingStep === 'pending_approval' ? 'jr1' : undefined,
      };
    default:
      return state;
  }
}

const initialState: ExtendedAuthState = {
  isLoading: true,
  isAuthenticated: false,
  user: null,
  session: null,
  appState: 'loading',
  onboardingStep: 'welcome',
};

// ── Context ──────────────────────────────────────────────────────
interface AuthContextValue extends ExtendedAuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, role: UserRole, firstName: string, lastName: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchDevRole: (role: UserRole) => void;
  switchDevState: (appState: AppState, onboardingStep?: OnboardingStep) => void;
  setAppState: (appState: AppState, opts?: { onboardingStep?: OnboardingStep; pendingCompanyName?: string; pendingRequestId?: string }) => void;
  updateProfile: (profile: UserProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ── Helper: fetch profile ────────────────────────────────────────
async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    role: data.role as UserRole,
    firstName: data.first_name,
    lastName: data.last_name,
    avatarUrl: data.avatar_url ?? undefined,
    phone: data.phone ?? undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ── Dev mock users (no Supabase) ────────────────────────────────
const DEV_USERS: Record<UserRole, UserProfile> = {
  owner: {
    id: 'owner1', email: 'joey@brightonlawn.com', role: 'owner',
    firstName: 'Joey', lastName: 'Angeloco', activeCompanyId: 'company1',
    avatarUrl: 'https://ui-avatars.com/api/?name=Joey+Angeloco&background=7CB342&color=fff&size=128',
    createdAt: '2024-01-15T10:00:00Z', updatedAt: '2024-01-15T10:00:00Z',
  },
  worker: {
    id: 'worker1', email: 'marcus@brightonlawn.com', role: 'worker',
    firstName: 'Marcus', lastName: 'Rivera', activeCompanyId: 'company1',
    avatarUrl: 'https://ui-avatars.com/api/?name=Marcus+Rivera&background=42A5F5&color=fff&size=128',
    createdAt: '2025-03-01T08:00:00Z', updatedAt: '2025-03-01T08:00:00Z',
  },
  customer: {
    id: 'customer1', email: 'sarah.mitchell@email.com', role: 'customer',
    firstName: 'Sarah', lastName: 'Mitchell', activeCompanyId: 'company1',
    avatarUrl: 'https://ui-avatars.com/api/?name=Sarah+Mitchell&background=AB47BC&color=fff&size=128',
    createdAt: '2026-02-15T10:00:00Z', updatedAt: '2026-02-15T10:00:00Z',
  },
};

const DEV_PENDING_USER: UserProfile = {
  id: 'pending1', email: 'john.smith@gmail.com', role: 'worker',
  firstName: 'John', lastName: 'Smith',
  createdAt: '2026-09-08T09:00:00Z', updatedAt: '2026-09-08T09:00:00Z',
};

const DEV_SESSION = { accessToken: 'dev', refreshToken: 'dev', expiresAt: 0 };

// ── Provider ─────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const defaultRole: UserRole = 'worker';
      dispatch({
        type: 'SIGN_IN',
        user: DEV_USERS[defaultRole],
        session: DEV_SESSION,
      });
      return;
    }

    let mounted = true;

    async function restoreSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          const profile = await fetchProfile(session.user.id);
          if (profile && mounted) {
            dispatch({
              type: 'RESTORE_SESSION',
              user: profile,
              session: {
                accessToken: session.access_token,
                refreshToken: session.refresh_token,
                expiresAt: session.expires_at ?? 0,
              },
            });
            return;
          }
        }
      } catch {
        // Session restore failed
      }

      if (mounted) {
        dispatch({ type: 'SIGN_OUT' });
      }
    }

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          if (mounted) dispatch({ type: 'SIGN_OUT' });
          return;
        }

        if (session.user) {
          const profile = await fetchProfile(session.user.id);
          if (profile && mounted) {
            dispatch({
              type: 'SIGN_IN',
              user: profile,
              session: {
                accessToken: session.access_token,
                refreshToken: session.refresh_token,
                expiresAt: session.expires_at ?? 0,
              },
            });
          }
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Add credentials to .env');
    }
    dispatch({ type: 'SET_LOADING', isLoading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      dispatch({ type: 'SET_LOADING', isLoading: false });
      throw error;
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, role: UserRole, firstName: string, lastName: string) => {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not configured. Add credentials to .env');
      }
      dispatch({ type: 'SET_LOADING', isLoading: true });

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error || !data.user) {
        dispatch({ type: 'SET_LOADING', isLoading: false });
        throw error ?? new Error('Sign up failed');
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        role,
        first_name: firstName,
        last_name: lastName,
      });

      if (profileError) {
        dispatch({ type: 'SET_LOADING', isLoading: false });
        throw profileError;
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    dispatch({ type: 'SIGN_OUT' });
  }, []);

  const switchDevRole = useCallback((role: UserRole) => {
    if (isSupabaseConfigured) return;
    dispatch({
      type: 'SET_DEV_MODE',
      user: DEV_USERS[role],
      session: DEV_SESSION,
      appState: 'active',
      onboardingStep: 'ready',
    });
  }, []);

  const switchDevState = useCallback((appState: AppState, onboardingStep?: OnboardingStep) => {
    if (isSupabaseConfigured) return;
    const step = onboardingStep ?? (appState === 'unauthenticated' ? 'welcome' : appState === 'pending_approval' ? 'pending_approval' : 'ready');
    const user = appState === 'unauthenticated' ? null : appState === 'pending_approval' ? DEV_PENDING_USER : DEV_USERS.worker;
    dispatch({
      type: 'SET_DEV_MODE',
      user: user ?? DEV_USERS.worker,
      session: appState === 'unauthenticated' ? null! : DEV_SESSION,
      appState,
      onboardingStep: step,
    });
    if (appState === 'unauthenticated') {
      dispatch({ type: 'SIGN_OUT' });
    }
  }, []);

  const setAppState = useCallback(
    (appState: AppState, opts?: { onboardingStep?: OnboardingStep; pendingCompanyName?: string; pendingRequestId?: string }) => {
      dispatch({
        type: 'SET_APP_STATE',
        appState,
        onboardingStep: opts?.onboardingStep,
        pendingCompanyName: opts?.pendingCompanyName,
        pendingRequestId: opts?.pendingRequestId,
      });
    },
    [],
  );

  const updateProfile = useCallback((profile: UserProfile) => {
    dispatch({ type: 'UPDATE_PROFILE', user: profile });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signUp, signOut, switchDevRole, switchDevState, setAppState, updateProfile }),
    [state, signIn, signUp, signOut, switchDevRole, switchDevState, setAppState, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
