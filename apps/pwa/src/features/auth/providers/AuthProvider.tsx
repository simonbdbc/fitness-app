import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { clearUserLocalState } from "@shared/navigation/userLocalState";
import { isSupabaseConfigured } from "@shared/config/clientConfig";
import { getSupabaseClient, supabase } from "@shared/config/supabaseClient";
import { reportTechnicalDegradation } from "@shared/observability/technicalDiagnostics";
import {
  authErrorMessage,
  buildAuthUser,
  resolveAuthCapabilities,
  type AuthSession,
  type AuthUser,
} from "../domain/authPolicy";
import {
  fallbackUserFromSession,
  loadUserFromProfile,
  signOutCurrentSupabaseSession,
  toAuthSession,
} from "../services/supabaseAuthSession";
import { resolveAuthSessionLifecycleAction } from "../services/authSessionLifecycle";

export type { UserAccountType } from "../domain/authPolicy";

export type AuthCredentials = {
  email: string;
  password: string;
};

type AuthContextValue = {
  isConfigured: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  session: AuthSession | null;
  user: AuthUser | null;
  accessToken: string | null;
  canAccessAdminCatalog: boolean;
  canAccessPremiumFeatures: boolean;
  authorizationError: string | null;
  error: string | null;
  notice: string | null;
  signIn: (credentials: AuthCredentials) => Promise<void>;
  signUp: (credentials: AuthCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  clearError: () => void;
  clearNotice: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const demoSessionStorageKey = "acrea-fitness.demo-session";

export function AuthProvider({ children }: PropsWithChildren) {
  if (!isSupabaseConfigured || !supabase) {
    return <DemoAuthProvider>{children}</DemoAuthProvider>;
  }

  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>;
}

function DemoAuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void AsyncStorage.getItem(demoSessionStorageKey)
      .then((storedToken) => {
        if (!cancelled && storedToken) {
          setSession({ accessToken: storedToken, provider: "demo" });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = async () => {
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const nextToken = `demo-${Date.now()}`;
      await AsyncStorage.setItem(demoSessionStorageKey, nextToken);
      setSession({ accessToken: nextToken, provider: "demo" });
      setNotice("Session locale active.");
    } catch (error) {
      reportTechnicalDegradation("demo-auth-sign-in", error);
      setError("Impossible d'ouvrir la session locale.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const signOut = async () => {
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await AsyncStorage.removeItem(demoSessionStorageKey);
      setSession(null);
      await clearUserLocalState("demo-user");
    } catch (error) {
      reportTechnicalDegradation("demo-auth-sign-out", error);
      setError("Impossible de fermer la session locale.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const refreshSession = useCallback(async () => {
    const storedToken = await AsyncStorage.getItem(demoSessionStorageKey);
    if (!storedToken) {
      setSession(null);
      return null;
    }

    setSession({ accessToken: storedToken, provider: "demo" });
    return storedToken;
  }, []);

  const user = useMemo(
    () =>
      session
        ? buildAuthUser({
            id: "demo-user",
            email: "demo@acrea.local",
            name: "Profil démo",
            accountType: "basic",
          })
        : null,
    [session],
  );
  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: false,
      isLoading,
      isSubmitting,
      session,
      user,
      accessToken: session?.accessToken ?? null,
      ...resolveAuthCapabilities(session, user),
      authorizationError: null,
      error,
      notice,
      signIn,
      signUp: signIn,
      signOut,
      refreshSession,
      clearError: () => setError(null),
      clearNotice: () => setNotice(null),
    }),
    [error, isLoading, isSubmitting, notice, refreshSession, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function SupabaseAuthProvider({ children }: PropsWithChildren) {
  const client = getSupabaseClient();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [authorizationError, setAuthorizationError] =
    useState<string | null>(null);
  const mountedRef = useRef(true);
  const userRef = useRef<AuthUser | null>(null);
  const profileRequestRevisionRef = useRef(0);
  const hydratingUserIdRef = useRef<string | null>(null);

  const commitSession = useCallback((nextSession: Session) => {
    const nextAuthSession = toAuthSession(nextSession);
    setSession((current) =>
      current?.provider === nextAuthSession.provider &&
      current.accessToken === nextAuthSession.accessToken
        ? current
        : nextAuthSession,
    );
  }, []);

  const clearSessionState = useCallback(() => {
    profileRequestRevisionRef.current += 1;
    hydratingUserIdRef.current = null;
    userRef.current = null;
    if (mountedRef.current) {
      setSession(null);
      setUser(null);
      setAuthorizationError(null);
    }
  }, []);

  const applySession = useCallback(async (nextSession: Session | null, forceProfileRefresh = false) => {
    if (!nextSession) {
      clearSessionState();
      return null;
    }

    commitSession(nextSession);
    const nextUserId = nextSession.user.id;
    if (
      !forceProfileRefresh &&
      (userRef.current?.id === nextUserId ||
        hydratingUserIdRef.current === nextUserId)
    ) {
      return nextSession.access_token;
    }

    const requestRevision = profileRequestRevisionRef.current + 1;
    profileRequestRevisionRef.current = requestRevision;
    hydratingUserIdRef.current = nextUserId;
    try {
      const nextUser = await loadUserFromProfile(nextSession);
      if (
        mountedRef.current &&
        profileRequestRevisionRef.current === requestRevision
      ) {
        userRef.current = nextUser;
        setUser((current) =>
          areAuthUsersEqual(current, nextUser) ? current : nextUser,
        );
        setAuthorizationError(null);
      }
    } catch (unknownError) {
      const nextUser = fallbackUserFromSession(nextSession);
      if (
        mountedRef.current &&
        profileRequestRevisionRef.current === requestRevision
      ) {
        if (userRef.current?.id !== nextUserId) {
          userRef.current = nextUser;
          setUser((current) =>
            areAuthUsersEqual(current, nextUser) ? current : nextUser,
          );
        }
        setAuthorizationError(
          `Profil utilisateur indisponible. La session active est conservée. ${authErrorMessage(unknownError)}`,
        );
      }
    } finally {
      if (
        profileRequestRevisionRef.current === requestRevision &&
        hydratingUserIdRef.current === nextUserId
      ) {
        hydratingUserIdRef.current = null;
      }
    }
    return nextSession.access_token;
  }, [clearSessionState, commitSession]);

  const applyAuthEvent = useCallback(
    (event: AuthChangeEvent, nextSession: Session | null) => {
      const action = resolveAuthSessionLifecycleAction({
        activeUserId: userRef.current?.id ?? null,
        event,
        hydratingUserId: hydratingUserIdRef.current,
        nextUserId: nextSession?.user.id ?? null,
      });
      if (action === "clear") {
        clearSessionState();
        return Promise.resolve<string | null>(null);
      }
      if (action === "ignore" || !nextSession) {
        return Promise.resolve<string | null>(null);
      }
      if (action === "session-only") {
        commitSession(nextSession);
        return Promise.resolve(nextSession.access_token);
      }

      return applySession(nextSession, action === "refresh-profile");
    },
    [applySession, clearSessionState, commitSession],
  );

  useEffect(() => {
    let isMounted = true;
    mountedRef.current = true;

    void client.auth
      .getSession()
      .then(async ({ data, error: sessionError }) => {
        if (!isMounted) {
          return;
        }

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        await applySession(data.session);
      })
      .catch((unknownError: unknown) => {
        if (isMounted) {
          setError(authErrorMessage(unknownError));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      void applyAuthEvent(event, nextSession).catch((unknownError: unknown) => {
        setError(authErrorMessage(unknownError));
      });
    });

    return () => {
      isMounted = false;
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [applyAuthEvent, applySession, client.auth]);

  const signIn = async ({ email, password }: AuthCredentials) => {
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const { data, error: signInError } =
        await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) {
        throw signInError;
      }

      await applySession(data.session);
    } catch (unknownError) {
      setError(authErrorMessage(unknownError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const signUp = async ({ email, password }: AuthCredentials) => {
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const { data, error: signUpError } = await client.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.session) {
        await applySession(data.session);
      } else {
        setNotice("Compte créé. Vérifie tes emails pour confirmer l'accès.");
      }
    } catch (unknownError) {
      setError(authErrorMessage(unknownError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const signOut = async () => {
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const signedOutUserId = user?.id;
      await signOutCurrentSupabaseSession();
      setSession(null);
      setUser(null);
      await clearUserLocalState(signedOutUserId);
    } catch (unknownError) {
      setError(authErrorMessage(unknownError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const refreshSession = useCallback(async () => {
    const { data, error: sessionError } = await client.auth.getSession();

    if (sessionError) {
      setError(sessionError.message);
      return null;
    }

    return applySession(data.session);
  }, [applySession, client.auth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: true,
      isLoading,
      isSubmitting,
      session,
      user,
      accessToken: session?.accessToken ?? null,
      ...resolveAuthCapabilities(session, user),
      authorizationError,
      error,
      notice,
      signIn,
      signUp,
      signOut,
      refreshSession,
      clearError: () => setError(null),
      clearNotice: () => setNotice(null),
    }),
    [
      authorizationError,
      error,
      isLoading,
      isSubmitting,
      notice,
      refreshSession,
      session,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function areAuthUsersEqual(left: AuthUser | null, right: AuthUser | null) {
  return (
    left?.id === right?.id &&
    left?.email === right?.email &&
    left?.name === right?.name &&
    left?.username === right?.username &&
    left?.accountType === right?.accountType &&
    left?.isAdmin === right?.isAdmin &&
    left?.isPremium === right?.isPremium
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé dans AuthProvider");
  }

  return context;
}
