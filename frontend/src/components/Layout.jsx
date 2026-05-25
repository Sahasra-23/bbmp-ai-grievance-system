import { useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearToken, isAuthenticated } from "../auth";

const navLinkClass = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition ${
    isActive
      ? "bg-[#062b57] text-white shadow-lg shadow-slate-900/20"
      : "text-slate-600 hover:bg-sky-50 hover:text-[#062b57]"
  }`;

export default function Layout() {
  const navigate = useNavigate();
  const authed = isAuthenticated();

  useEffect(() => {
    function handleExpiredSession() {
      navigate("/login", {
        replace: true,
        state: { authMessage: "Your session expired. Please login again." },
      });
    }

    window.addEventListener("auth:expired", handleExpiredSession);
    return () => window.removeEventListener("auth:expired", handleExpiredSession);
  }, [navigate]);

  function handleLogout() {
    clearToken();
    navigate("/login", { state: { authMessage: "You have been logged out." } });
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#f4f8ff] text-[#061a3a]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-10%] top-[-12%] h-96 w-96 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="absolute bottom-[-8%] right-[-6%] h-[28rem] w-[28rem] rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(6,43,87,0.08)_1px,transparent_0)] [background-size:28px_28px]" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/" className="group flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#062b57] to-[#0a7ea4] text-lg font-bold text-white shadow-civic transition group-hover:-rotate-6">
            N
          </span>
          <span>
            <span className="block font-display text-2xl font-bold leading-6">Namma Fix</span>
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0b6f8f]">Grievance Desk</span>
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-2 rounded-full border border-white/80 bg-white/75 p-2 shadow-lg shadow-slate-900/5 backdrop-blur">
          {authed ? (
            <>
              <NavLink className={navLinkClass} to="/complaints/new">File Complaint</NavLink>
              <NavLink className={navLinkClass} to="/my-complaints">My Complaints</NavLink>
              <button
                onClick={handleLogout}
                className="rounded-full px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink className={navLinkClass} to="/login">Login</NavLink>
              <NavLink className={navLinkClass} to="/register">Register</NavLink>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-12 pt-4">
        <Outlet />
      </main>
    </div>
  );
}
