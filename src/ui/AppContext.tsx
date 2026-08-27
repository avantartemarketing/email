import { createContext, useContext } from 'react';
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
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppContext.Provider>');
  return value;
}
