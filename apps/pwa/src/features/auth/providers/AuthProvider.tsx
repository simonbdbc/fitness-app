import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { clearUserLocalState } from "@shared/navigation/userLocalState";
import { reportTechnicalDegradation } from "@shared/observability/technicalDiagnostics";
import {
  authErrorMessage,
  buildAuthUser,
  resolveAuthCapabilities,
  type AuthSession,
  type AuthUser,
} from "../domain/authPolicy";

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
const demoSessionStorageKey = "acrea-fitness-public-demo.session";

export function AuthProvider({ children }: PropsWithChildren) {
  return <DemoAuthProvider>{children}</DemoAuthProvider>;
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé dans AuthProvider");
  }

  return context;
}
