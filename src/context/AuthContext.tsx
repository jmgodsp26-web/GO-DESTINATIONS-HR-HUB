import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, NotificationItem } from '../types';
import { api, setStoredToken, getStoredToken } from '../services/api';

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
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  completeFirstTimePasswordChange: (newPassword: string) => Promise<void>;
  dismissFirstTimePasswordChange: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const refreshNotifications = useCallback(async () => {
    if (!getStoredToken()) return;
    try {
      const items = await api.getNotifications();
      setNotifications(items);
    } catch {
      // ignore in background
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      setUser(res.user);
      await refreshNotifications();
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshNotifications]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
    } else {
      refreshUser();
    }
  }, [refreshUser]);

  // Instantly handle session expiry without unhandled promise rejections
  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setMustChangePassword(false);
      setNotifications([]);
      setIsLoading(false);
    };
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  // Periodic polling to keep notification counter badge real-time
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      refreshNotifications();
    }, 10000);
    return () => clearInterval(interval);
  }, [user, refreshNotifications]);

  const login = async (identifier: string, passwordHash?: string) => {
    setError(null);
    try {
      const res = await api.login(identifier, passwordHash);
      setUser(res.user);
      if (res.mustChangePassword) {
        setMustChangePassword(true);
      } else {
        setMustChangePassword(false);
      }
      await refreshNotifications();
    } catch (err: any) {
      setError(err.message || 'Login failed.');
      throw err;
    }
  };

  const completeFirstTimePasswordChange = async (newPassword: string) => {
    try {
      await api.changePassword('Welcome2026!', newPassword);
      setMustChangePassword(false);
    } catch (err: any) {
      throw err;
    }
  };

  const dismissFirstTimePasswordChange = () => {
    setMustChangePassword(false);
  };

  const switchUser = async (identifier: string, password?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.login(identifier, password || '');
      setUser(res.user);
      setMustChangePassword(Boolean(res.mustChangePassword));
      await refreshNotifications();
    } catch (err: any) {
      setError(err.message || 'Failed to switch user.');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
      setUser(null);
      setMustChangePassword(false);
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      // ignore
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // ignore
    }
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
        unreadCount,
        login,
        switchUser,
        logout,
        refreshUser,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        completeFirstTimePasswordChange,
        dismissFirstTimePasswordChange,
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
