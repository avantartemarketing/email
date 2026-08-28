import { createContext, useContext, useEffect } from 'react';
import type { User } from '../types';
import type { DataLayer } from '../data';

export interface AppContextValue {
  data: DataLayer;
  currentUser: User;
  users: User[];
  isAdmin: boolean;
  switchUser: (userId: string) => Promise<void>;
  showToast: (content: string, isError?: boolean) => void;
  userName: (userId: string | undefined) => string;
  /** The record the bar's path ends at — see `useCrumb`. */
  setCrumb: (label: string | null) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppContext.Provider>');
  return value;
}

/**
 * Name the record this screen is showing, for the bar's path.
 *
 * The shell says where you are and the page says its own name once, at full
 * size, below the hairline — so the bar needs the record's name and cannot
 * work it out from a route that only carries an id. A screen with no record of
 * its own (a list) passes nothing and the path stops at the area.
 */
export function useCrumb(label: string | null | undefined): void {
  const { setCrumb } = useApp();
  useEffect(() => {
    setCrumb(label ?? null);
    return () => setCrumb(null);
  }, [label, setCrumb]);
}
