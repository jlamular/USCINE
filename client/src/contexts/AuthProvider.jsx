import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthContext } from './AuthContext';
import { useToast } from '../hooks/useToast';
import { setUnauthorizedHandler } from '../services/api';
import * as authService from '../services/authService';
import { getToken } from '../services/tokenStorage';
import { getTokenExpiryMs } from '../utils/tokenUtils';

const WARNING_BEFORE_EXPIRY_MS = 5 * 60 * 1000;
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.';

export function AuthProvider({ children }) {
  const { showToast } = useToast();

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Logs out and explains why. Does nothing when nobody is logged in, so it can never fire twice.
  const endSession = useCallback(
    (message) => {
      if (!userRef.current) {
        return;
      }

      userRef.current = null;
      authService.logout();
      setUser(null);
      showToast(message, 'info');
    },
    [showToast],
  );

  // 1. When the app loads: restore the session if a still-valid token is stored
  useEffect(() => {
    async function restoreSession() {
      const token = getToken();

      if (!token) {
        setIsLoading(false);
        return;
      }

      const expiryMs = getTokenExpiryMs(token);
      if (expiryMs !== null && expiryMs <= Date.now()) {
        // Already expired: no need to ask the server
        authService.logout();
        showToast(SESSION_EXPIRED_MESSAGE, 'info');
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        if (error.status === 401) {
          authService.logout();
        }
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, [showToast]);

  // 2. While logged in: warn shortly before the token expires, and log out when it does
  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const token = getToken();
    const expiryMs = token ? getTokenExpiryMs(token) : null;

    if (expiryMs === null) {
      return undefined;
    }

    const timers = [];
    const untilExpiry = expiryMs - Date.now();
    const untilWarning = untilExpiry - WARNING_BEFORE_EXPIRY_MS;

    if (untilWarning > 0) {
      timers.push(
        setTimeout(() => {
          showToast('Your session ends in about 5 minutes. Please log in again soon.', 'info');
        }, untilWarning),
      );
    }

    timers.push(setTimeout(() => endSession(SESSION_EXPIRED_MESSAGE), Math.max(untilExpiry, 0)));

    // A laptop that was asleep may have skipped the timers. Check again when the tab becomes visible.
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && expiryMs <= Date.now()) {
        endSession(SESSION_EXPIRED_MESSAGE);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      timers.forEach((timerId) => clearTimeout(timerId));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, endSession, showToast]);

  // 3. Any logged-in request the server answers with 401 also ends the session
  useEffect(() => {
    setUnauthorizedHandler(() => endSession(SESSION_EXPIRED_MESSAGE));

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [endSession]);

  async function login(email, password) {
    const loggedInUser = await authService.login(email, password);
    setUser(loggedInUser);
  }

  async function register(email, password, displayName) {
    const newUser = await authService.register(email, password, displayName);
    setUser(newUser);
  }

  function logout() {
    authService.logout();
    setUser(null);
  }

  async function updateDisplayName(displayName) {
    const updatedUser = await authService.updateDisplayName(displayName);
    setUser(updatedUser);
  }

  const contextValue = {
    user,
    isLoading,
    login,
    register,
    logout,
    updateDisplayName,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}