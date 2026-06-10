import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  setAuthTokenGetter,
  User,
  Role,
} from "@workspace/api-client-react";

const TOKEN_KEY = "laplayita.token";
const USER_KEY = "laplayita.user";

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
    const padded =
      normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const json =
      typeof atob !== "undefined"
        ? atob(padded)
        : globalThis.Buffer
          ? globalThis.Buffer.from(padded, "base64").toString("utf-8")
          : "";
    return json ? (JSON.parse(json) as JwtClaims) : null;
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

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    setAuthTokenGetter(() => tokenRef.current);
  }, []);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (storedToken && storedUser) {
          const claims = decodeJwt(storedToken);
          if (isTokenExpired(claims)) {
            await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
          } else {
            const parsed = reconcileUserFromToken(
              JSON.parse(storedUser) as User,
              storedToken,
            );
            tokenRef.current = storedToken;
            setToken(storedToken);
            setUser(parsed);
          }
        }
      } catch (e) {
        console.warn("Failed to restore auth", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (newUser: User, newToken: string) => {
    const reconciled = reconcileUserFromToken(newUser, newToken);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, newToken],
      [USER_KEY, JSON.stringify(reconciled)],
    ]);
    tokenRef.current = newToken;
    setToken(newToken);
    setUser(reconciled);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    tokenRef.current = null;
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token && !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
