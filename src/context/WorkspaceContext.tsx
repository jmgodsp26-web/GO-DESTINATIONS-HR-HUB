import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import type { WorkspaceMode } from '../utils/workspace';

const WorkspaceContext = createContext<WorkspaceMode>('administration');
export const WorkspaceProvider = ({ mode, children }: { mode: WorkspaceMode; children: React.ReactNode }) => (
  <WorkspaceContext.Provider value={mode}>{children}</WorkspaceContext.Provider>
);

// Presentation context only. The authenticated user's identity and role are
// unchanged; every backend route retains its existing authorization checks.
export function useWorkspace() {
  const { user } = useAuth();
  const mode = useContext(WorkspaceContext);
  return { mode: user?.role === 'admin' ? mode : 'personal' as WorkspaceMode,
    isAdministration: user?.role === 'admin' && mode === 'administration' };
}
