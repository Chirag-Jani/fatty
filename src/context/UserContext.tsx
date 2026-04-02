import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '../types';
import { getUserProfile, saveUserProfile } from '../storage/storage';

type UserContextValue = {
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  setProfile: (p: UserProfile) => Promise<void>;
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const p = await getUserProfile();
    setProfileState(p);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshProfile();
      setLoading(false);
    })();
  }, [refreshProfile]);

  const setProfile = useCallback(async (p: UserProfile) => {
    await saveUserProfile(p);
    setProfileState(p);
  }, []);

  const value = useMemo(
    () => ({ profile, loading, refreshProfile, setProfile }),
    [profile, loading, refreshProfile, setProfile]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
