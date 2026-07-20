import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../api";
import { isAuthenticated } from "../auth";

export default function AdminProtectedRoute({ children }) {
  const location = useLocation();
  const [accessState, setAccessState] = useState("checking");

  useEffect(() => {
    let isActive = true;

    async function verifyAdmin() {
      if (!isAuthenticated()) {
        setAccessState("unauthenticated");
        return;
      }

      try {
        const { data } = await api.get("/me");
        const role = (data?.role || "").toUpperCase();

        if (isActive) {
          setAccessState(role === "ADMIN" ? "allowed" : "forbidden");
        }
      } catch {
        if (isActive) {
          setAccessState("unauthenticated");
        }
      }
    }

    verifyAdmin();

    return () => {
      isActive = false;
    };
  }, []);

  if (accessState === "checking") {
    return null;
  }

  if (accessState === "unauthenticated") {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
          authMessage: "Please login to continue.",
        }}
      />
    );
  }

  if (accessState === "forbidden") {
    return (
      <Navigate
        to="/"
        replace
        state={{
          authMessage: "Access denied. Administrator privileges required.",
        }}
      />
    );
  }

  return children;
}
