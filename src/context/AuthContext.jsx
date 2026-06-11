import { useCallback, useEffect, useState } from "react";

import AuthContext from "./AuthContextCore";

function decodeToken(token) {
  const payload = token?.split(".")[1];
  if (!payload) return null;
  const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
  const paddedPayload = normalizedPayload.padEnd(
    normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
    "=",
  );
  return JSON.parse(atob(paddedPayload));
}

function isExpired(payload) {
  if (!payload?.exp) return false;
  return payload.exp * 1000 <= Date.now();
}

function getStoredUser() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = decodeToken(token);
    if (!payload || isExpired(payload)) {
      localStorage.removeItem("token");
      return null;
    }
    return { token, ...payload };
  } catch {
    localStorage.removeItem("token");
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);

  const login = useCallback((token) => {
    const payload = decodeToken(token);
    if (!payload || isExpired(payload)) return;
    localStorage.setItem("token", token);
    setUser({ token, ...payload });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  useEffect(() => {
    if (!user?.exp) return undefined;
    const remainingMs = user.exp * 1000 - Date.now();
    const timer = window.setTimeout(logout, Math.max(remainingMs, 0));
    return () => window.clearTimeout(timer);
  }, [logout, user?.exp]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== "token") return;
      setUser(getStoredUser());
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
