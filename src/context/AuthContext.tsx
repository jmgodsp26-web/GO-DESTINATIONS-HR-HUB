import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  completeFirstTimePasswordChange: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const refreshNotifications = useCallback(async () => {
    try {
      const items = await api.getNotifications();
      setNotifications(items);
    } catch {
      // ignore in background
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.getMe();
      setUser(res.user);
      setMustChangePassword(Boolean(res.mustChangePassword));
      if (!res.mustChangePassword) await refreshNotifications();
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshNotifications]);

  useEffect(() => {
    refreshUser();
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
    if (!user || mustChangePassword) return;
    const interval = setInterval(() => {
      refreshNotifications();
    }, 10000);
    return () => clearInterval(interval);
  }, [user, mustChangePassword, refreshNotifications]);

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
      if (!res.mustChangePassword) await refreshNotifications();
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
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.login(identifier, password || '');
      setUser(res.user);
      setMustChangePassword(Boolean(res.mustChangePassword));
      if (!res.mustChangePassword) await refreshNotifications();
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
