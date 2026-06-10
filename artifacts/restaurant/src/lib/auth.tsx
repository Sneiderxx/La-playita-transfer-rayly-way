import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Role } from "@workspace/api-client-react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface JwtClaims {
  sub?: string | number;
  role?: Role;
  exp?: number;
  [key: string]: unknown;
}

function decodeJwt(token: string): JwtClaims | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

function isTokenExpired(claims: JwtClaims | null): boolean {
  if (!claims?.exp) return false;
  return claims.exp * 1000 <= Date.now();
}

function reconcileUserFromToken(user: User, token: string): User {
  const claims = decodeJwt(token);
  if (claims?.role && claims.role !== user.role) {
    return { ...user, role: claims.role };
  }
  return user;
}

interface AuthState {
  user: User | null;
  token: string | null;
}

interface AuthContextType extends AuthState {
  login: (user: User, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    try {
      const storedUser = localStorage.getItem("laplayita.user");
      const storedToken = localStorage.getItem("laplayita.token");

      if (storedUser && storedToken) {
        const claims = decodeJwt(storedToken);
        if (isTokenExpired(claims)) {
          localStorage.removeItem("laplayita.user");
          localStorage.removeItem("laplayita.token");
          return { user: null, token: null };
        }
        const parsedUser = reconcileUserFromToken(JSON.parse(storedUser) as User, storedToken);
        setAuthTokenGetter(() => storedToken);
        return { user: parsedUser, token: storedToken };
      }
    } catch (e) {
      console.error("Failed to parse auth state from local storage", e);
    }

    return { user: null, token: null };
  });

  useEffect(() => {
    // Whenever state changes, update custom fetch token
    if (state.token) {
      setAuthTokenGetter(() => state.token);
    } else {
      setAuthTokenGetter(null);
    }
  }, [state.token]);

  const login = (user: User, token: string) => {
    const reconciled = reconcileUserFromToken(user, token);
    localStorage.setItem("laplayita.user", JSON.stringify(reconciled));
    localStorage.setItem("laplayita.token", token);
    setState({ user: reconciled, token });
  };

  const logout = () => {
    localStorage.removeItem("laplayita.user");
    localStorage.removeItem("laplayita.token");
    setState({ user: null, token: null });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, isAuthenticated: !!state.token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
