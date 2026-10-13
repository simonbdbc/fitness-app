import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { useAuth } from "@features/auth";
import { AppLoadingScreen } from "@shared/ui";

import {
  type ACREAPillarLevels,
  type ACREAProfileState,
} from "../data/acreaSeed";
import type { ACREALevelEvaluationProtocolVersion } from "../data/acreaLevelEvaluationV4";
import {
  ACREAProfileSyncError,
  loadOrCreateACREAProfile,
  loadLocalACREAProfile,
  saveACREAProfile,
} from "../services/acreaProfileRepository";

type ACREAProfileContextValue = {
  profile: ACREAProfileState;
  isLoading: boolean;
  isRefreshing: boolean;
  applyPillarLevels: (pillarLevels: ACREAPillarLevels) => void;
  applyCompletedLevelTest: (
    pillarLevels: ACREAPillarLevels,
    completedAt: string,
    protocolVersion: ACREALevelEvaluationProtocolVersion,
  ) => Promise<void>;
  saveProfile: (profile: ACREAProfileState) => Promise<void>;
  syncError: string | null;
  weeklyProgramRevision: number;
  notifyWeeklyProgramChanged: () => void;
  refreshProfileFromLocal: () => Promise<void>;
};

const ACREAProfileContext = createContext<ACREAProfileContextValue | null>(
  null,
);

export function ACREAProfileProvider({ children }: PropsWithChildren) {
  return (
    <PersistentACREAProfileProvider>{children}</PersistentACREAProfileProvider>
  );
}

function PersistentACREAProfileProvider({ children }: PropsWithChildren) {
  const { accessToken, isLoading: isAuthLoading, user } = useAuth();
  const [profile, setProfile] = useState<ACREAProfileState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [weeklyProgramRevision, setWeeklyProgramRevision] = useState(0);
  const requestRevisionRef = useRef(0);
  const userId = user?.id ?? null;
  const userName = user
    ? user.name ?? user.username ?? user.email ?? user.id
    : null;

  const commitProfile = useCallback((nextProfile: ACREAProfileState) => {
    setProfile((current) =>
      areProfilesEqual(current, nextProfile) ? current : nextProfile,
    );
  }, []);

  const refreshProfileFromLocal = useCallback(async () => {
    if (!userId) return;
    const localProfile = await loadLocalACREAProfile(userId);
    if (localProfile) commitProfile(localProfile);
  }, [commitProfile, userId]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!userId || !userName) {
      requestRevisionRef.current += 1;
      setProfile(null);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    let active = true;
    const requestRevision = requestRevisionRef.current + 1;
    requestRevisionRef.current = requestRevision;
    setIsLoading(profile?.id !== userId);
    setIsRefreshing(profile?.id === userId);
    setSyncError(null);

    void loadProfileLocalFirst({ id: userId, name: userName })
      .then(async ({ initialProfile, synchronizedProfile }) => {
        if (!active || requestRevisionRef.current !== requestRevision) return;
        if (initialProfile) commitProfile(initialProfile);
        setIsLoading(false);
        setIsRefreshing(Boolean(initialProfile));

        const loadedProfile = await synchronizedProfile;
        if (!active || requestRevisionRef.current !== requestRevision) return;
        commitProfile(loadedProfile);
        setSyncError(null);
      })
      .catch((error: unknown) => {
        if (!active || requestRevisionRef.current !== requestRevision) return;
        if (error instanceof ACREAProfileSyncError) {
          commitProfile(error.profile);
        }
        setSyncError(
          error instanceof Error
            ? error.message
            : "Synchronisation du profil ACREA impossible.",
        );
      })
      .finally(() => {
        if (active && requestRevisionRef.current === requestRevision) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      });
    return () => {
      active = false;
    };
  }, [commitProfile, isAuthLoading, userId, userName]);

  const value = useMemo<ACREAProfileContextValue>(
    () => ({
      profile: profile!,
      isLoading,
      isRefreshing,
      applyPillarLevels: (pillarLevels) => {
        setProfile((currentProfile) => {
          if (!currentProfile) return currentProfile;
          const nextProfile = { ...currentProfile, pillarLevels };
          void saveACREAProfile(nextProfile)
            .then(() => setSyncError(null))
            .catch((error: unknown) =>
              setSyncError(
                error instanceof Error
                  ? error.message
                  : "Synchronisation du profil ACREA impossible.",
              ),
            );
          return nextProfile;
        });
      },
      applyCompletedLevelTest: async (
        pillarLevels,
        completedAt,
        protocolVersion,
      ) => {
        if (!profile) return;
        const nextProfile: ACREAProfileState = {
          ...profile,
          pillarLevels,
          levelTestStatus: "completed",
          levelTestVersion: Math.max(
            profile.levelTestVersion,
            protocolVersion,
          ),
          levelTestCompletedAt: completedAt,
        };
        commitProfile(nextProfile);
        setSyncError(null);
      },
      saveProfile: async (nextProfile) => {
        try {
          await saveACREAProfile(nextProfile);
          commitProfile(nextProfile);
          setSyncError(null);
        } catch (error) {
          if (error instanceof ACREAProfileSyncError) {
            commitProfile(error.profile);
            setSyncError(error.message);
            return;
          }
          setSyncError(
            error instanceof Error
              ? error.message
              : "Synchronisation du profil ACREA impossible.",
          );
          throw error;
        }
      },
      syncError,
      weeklyProgramRevision,
      notifyWeeklyProgramChanged: () =>
        setWeeklyProgramRevision((revision) => revision + 1),
      refreshProfileFromLocal,
    }),
    [
      commitProfile,
      isLoading,
      isRefreshing,
      profile,
      refreshProfileFromLocal,
      syncError,
      weeklyProgramRevision,
    ],
  );

  if (
    isAuthLoading ||
    (accessToken && (!user || profile?.id !== user.id))
  ) {
    return <ProfileLoadingShell />;
  }

  return (
    <ACREAProfileContext.Provider value={value}>
      {children}
    </ACREAProfileContext.Provider>
  );
}

async function loadProfileLocalFirst({ id, name }: { id: string; name: string }) {
  const initialProfile = await loadLocalACREAProfile(id);
  return {
    initialProfile,
    synchronizedProfile: loadOrCreateACREAProfile({ id, name }),
  };
}

function areProfilesEqual(
  left: ACREAProfileState | null,
  right: ACREAProfileState | null,
) {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

function ProfileLoadingShell() {
  return <AppLoadingScreen accessibilityLabel="Chargement du profil" />;
}

export function useACREAProfile() {
  const context = useContext(ACREAProfileContext);

  if (!context) {
    throw new Error(
      "useACREAProfile doit être utilisé dans ACREAProfileProvider",
    );
  }

  return context;
}
