import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, NotificationItem } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  mustChangePassword: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
  login: (identifier: string, passwordHash?: string) => Promise<void>;
  switchUser: (identifier: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  notificationError: string;
  markNotificationRead: (id: string) => Promise<boolean>;
  markAllNotificationsRead: () => Promise<boolean>;
  completeFirstTimePasswordChange: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [notificationError, setNotificationError] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notificationGeneration = useRef(0);
  const notificationRequest = useRef<Promise<void> | null>(null);

  const invalidateNotifications = useCallback(() => {
    notificationGeneration.current++;
    notificationRequest.current = null;
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (notificationRequest.current) return notificationRequest.current;
    const generation = notificationGeneration.current;
    const request = (async () => {
      try {
        const items = await api.getNotifications();
        if (generation === notificationGeneration.current) setNotifications(items);
      } catch {
        // Preserve the last successful list; the next visible poll retries.
      }
    })();
    notificationRequest.current = request;
    try { await request; }
    finally { if (notificationRequest.current === request) notificationRequest.current = null; }
  }, []);

  const refreshUser = useCallback(async () => {
    invalidateNotifications();
    try {
      const res = await api.getMe();
      setUser(res.user);
      setMustChangePassword(Boolean(res.mustChangePassword));
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [invalidateNotifications]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Instantly handle session expiry without unhandled promise rejections
  useEffect(() => {
    const handleAuthExpired = () => {
      invalidateNotifications();
      setUser(null);
      setMustChangePassword(false);
      setNotifications([]);
      setIsLoading(false);
    };
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, [invalidateNotifications]);

  // Notifications load independently of sign-in/dashboard rendering. Poll only
  // visible tabs, never overlap requests, and refresh when the user returns.
  useEffect(() => {
    if (!user || mustChangePassword) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polling = false;
    const poll = async () => {
      if (stopped || document.hidden || polling) return;
      if (timer) clearTimeout(timer);
      polling = true;
      await refreshNotifications();
      polling = false;
      if (!stopped && !document.hidden) timer = setTimeout(poll, 60000 + Math.random() * 10000);
    };
    const visibility = () => {
      if (timer) clearTimeout(timer);
      if (!document.hidden) void poll();
    };
    void poll();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
      invalidateNotifications();
    };
  }, [user?.id, mustChangePassword, refreshNotifications, invalidateNotifications]);

  const login = async (identifier: string, passwordHash?: string) => {
    invalidateNotifications();
    setNotifications([]);
    setError(null);
    try {
      const res = await api.login(identifier, passwordHash);
      setUser(res.user);
      if (res.mustChangePassword) {
        setMustChangePassword(true);
      } else {
        setMustChangePassword(false);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed.');
      throw err;
    }
  };

  const completeFirstTimePasswordChange = async (newPassword: string) => {
    try {
      await api.changePassword('', newPassword);
      setMustChangePassword(false);
    } catch (err: any) {
      throw err;
    }
  };

  const switchUser = async (identifier: string, password?: string) => {
    invalidateNotifications();
    setNotifications([]);
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.login(identifier, password || '');
      setUser(res.user);
      setMustChangePassword(Boolean(res.mustChangePassword));
    } catch (err: any) {
      setError(err.message || 'Failed to switch user.');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (!window.dispatchEvent(new Event('workspace:before-navigate', { cancelable: true }))) return;
    invalidateNotifications();
    setIsLoading(true);
    try {
      await api.logout();
      history.replaceState(null, '', location.pathname);
      setUser(null);
      setMustChangePassword(false);
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const markNotificationRead = async (id: string) => {
    invalidateNotifications();
    setNotificationError('');
    try { await api.markNotificationRead(id); invalidateNotifications(); setNotifications(prev=>prev.map(n=>n.id===id?{...n,read:true}:n)); return true; }
    catch { setNotificationError('Could not mark this notification as read. Please try again.'); return false; }
  };
  const markAllNotificationsRead = async () => {
    invalidateNotifications();
    setNotificationError('');
    try { await api.markAllNotificationsRead(); invalidateNotifications(); setNotifications(prev=>prev.map(n=>({...n,read:true}))); return true; }
    catch { setNotificationError('Could not mark notifications as read. Please try again.'); return false; }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        mustChangePassword,
        notifications,
        notificationError,
        unreadCount,
        login,
        switchUser,
        logout,
        refreshUser,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        completeFirstTimePasswordChange,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
