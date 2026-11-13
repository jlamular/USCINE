import { useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import * as authService from '../services/authService';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // When the app loads, restore the session if a token is stored
  useEffect(() => {
    async function restoreSession() {
      if (!authService.hasStoredToken()) {
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
  }, []);

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