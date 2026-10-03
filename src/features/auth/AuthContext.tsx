import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import type { Database, UserRole } from '../../types/database.types';
import type { SignupFormData } from '../../types/auth';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: SignupFormData) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper to fetch user profile with graceful retry
  const fetchProfile = useCallback(async (userId: string, currentUser?: User | null) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[EduCamp Auth] Profile fetch notice:', error.message);
      }

      if (data) {
        setProfile(data);
        return;
      }

      // If trigger is still processing or profile missing, synthesize fallback from user metadata
      const meta = currentUser?.user_metadata || {};
      const fallbackProfile: Profile = {
        id: userId,
        full_name: meta.full_name || currentUser?.email?.split('@')[0] || 'Student',
        email: currentUser?.email || null,
        phone_number: meta.phone_number || null,
        role: 'student',
        avatar_url: meta.avatar_url || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setProfile(fallbackProfile);

      // Attempt non-blocking profile creation if profile table is provisioned
      (async () => {
        try {
          await supabase.from('profiles').insert({
            id: userId,
            full_name: fallbackProfile.full_name,
            email: fallbackProfile.email,
            phone_number: fallbackProfile.phone_number,
            role: 'student' as const,
          });
        } catch {
          // Non-blocking fallback
        }
      })();
    } catch (err) {
      console.warn('[EduCamp Auth] Unexpected error fetching profile:', err);
    }
  }, []);

  // Initialize session and set up real-time auth listener
  useEffect(() => {
    let mounted = true;

    // 1. Restore existing session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        fetchProfile(initialSession.user.id, initialSession.user).finally(() => {
          if (mounted) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // 2. Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (event === 'SIGNED_IN' && newSession?.user) {
          await fetchProfile(newSession.user.id, newSession.user);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Login handler
  const login = useCallback(async (identifier: string, password: string) => {
    try {
      const cleanIdentifier = identifier.trim();
      const isEmail = cleanIdentifier.includes('@');

      let authResult;
      if (isEmail) {
        authResult = await supabase.auth.signInWithPassword({
          email: cleanIdentifier,
          password,
        });
      } else {
        // For phone numbers, format if possible, otherwise attempt phone auth
        const formattedPhone = cleanIdentifier.startsWith('+')
          ? cleanIdentifier
          : `+91${cleanIdentifier.replace(/\D/g, '')}`;

        authResult = await supabase.auth.signInWithPassword({
          phone: formattedPhone,
          password,
        });
      }

      if (authResult.error) {
        const msg = authResult.error.message.toLowerCase();
        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
          return { success: false, error: 'Invalid email or password. Please verify your credentials.' };
        }
        if (msg.includes('phone') && !isEmail) {
          return {
            success: false,
            error: 'Mobile-number direct password login requires SMS provider activation. Please log in using your registered email address.',
          };
        }
        return { success: false, error: authResult.error.message };
      }

      if (authResult.data.user) {
        await fetchProfile(authResult.data.user.id, authResult.data.user);
      }

      return { success: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Network error occurred. Please try again.';
      return { success: false, error: errorMsg };
    }
  }, [fetchProfile]);

  // Signup handler
  const signup = useCallback(async (data: SignupFormData) => {
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
        options: {
          data: {
            full_name: data.fullName.trim(),
            phone_number: data.mobileNumber.trim(),
            // Safe default role enforced:
            role: 'student',
            // Storing transient academic intent in metadata without creating premature DB tables
            academic_class_intent: data.selectedClass,
            academic_board_intent: data.selectedBoard,
          },
        },
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          return { success: false, error: 'An account with this email address already exists.' };
        }
        return { success: false, error: error.message };
      }

      if (authData.user) {
        await fetchProfile(authData.user.id, authData.user);
      }

      return { success: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred during account creation.';
      return { success: false, error: errorMsg };
    }
  }, [fetchProfile]);

  // Google OAuth handler
  const loginWithGoogle = useCallback(async () => {
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Google OAuth initialization failed.';
      return { success: false, error: errorMsg };
    }
  }, []);

  // Logout handler
  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[EduCamp Auth] Error during sign out:', err);
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  }, []);

  // Password reset request
  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      // Never reveal whether email exists; return success message
      return { success: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Password reset request failed.';
      return { success: false, error: errorMsg };
    }
  }, []);

  // Update password handler
  const updatePassword = useCallback(async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update password.';
      return { success: false, error: errorMsg };
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id, user);
    }
  }, [user, fetchProfile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      role: profile?.role ?? 'student',
      session,
      isLoading,
      isAuthenticated: !!user,
      login,
      signup,
      loginWithGoogle,
      logout,
      requestPasswordReset,
      updatePassword,
      refreshProfile,
    }),
    [
      user,
      profile,
      session,
      isLoading,
      login,
      signup,
      loginWithGoogle,
      logout,
      requestPasswordReset,
      updatePassword,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
