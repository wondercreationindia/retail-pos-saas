import { create } from "zustand";
import { User, AuthResponse } from "@workspace/api-client-react";

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (authData: AuthResponse) => void;
  logout: () => void;
}

const getStoredToken = () => typeof localStorage !== 'undefined' ? localStorage.getItem("pos_token") : null;
const getStoredUser = () => {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem("pos_user");
  try { return stored ? JSON.parse(stored) : null; } catch { return null; }
};

export const useAuth = create<AuthState>((set) => ({
  token: getStoredToken(),
  user: getStoredUser(),
  isAuthenticated: !!getStoredToken(),
  login: (authData: AuthResponse) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem("pos_token", authData.token);
      localStorage.setItem("pos_user", JSON.stringify(authData.user));
    }
    set({
      token: authData.token,
      user: authData.user,
      isAuthenticated: true,
    });
  },
  logout: () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem("pos_token");
      localStorage.removeItem("pos_user");
    }
    set({
      token: null,
      user: null,
      isAuthenticated: false,
    });
  },
}));
