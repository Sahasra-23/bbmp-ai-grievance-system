import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import api from "../api";
import { clearToken, isAuthenticated } from "../auth";

const navLinkClass = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition ${
    isActive
      ? "bg-[#062b57] text-white shadow-lg shadow-slate-900/20 dark:bg-cyan-600"
      : "text-slate-600 hover:bg-sky-50 hover:text-[#062b57] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-cyan-400"
  }`;

function ThemeToggle({ theme, setTheme }) {
  return (
    <button
      onClick={() => setTheme(prev => prev === "dark" ? "light" : "dark")}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 p-2 shadow transition hover:scale-105 active:scale-95 dark:border-slate-700 dark:bg-slate-800/80 text-[#062b57] dark:text-cyan-400"
      type="button"
      title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {theme === "dark" ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentOutlet = useOutlet();
  const authed = isAuthenticated();
  const [profile, setProfile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

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

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!authed) {
        setProfile(null);
        return;
      }

      try {
        const { data } = await api.get("/me");
        if (!cancelled) {
          setProfile(data);
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [authed]);

  function handleLogout() {
    clearToken();
    navigate("/login", { state: { authMessage: "You have been logged out." } });
  }

  const resolvedCount = profile?.summary?.resolved ?? 0;
  const avatarLetter = (profile?.name?.[0] || profile?.email?.[0] || "U").toUpperCase();

  return (
    <div className="min-h-screen bg-[#f4f8ff] text-[#061a3a] dark:bg-[#0b132b] dark:text-slate-100 transition-colors duration-300">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-10%] top-[-12%] h-96 w-96 rounded-full bg-sky-300/25 dark:bg-sky-950/20 blur-3xl" />
        <div className="absolute bottom-[-8%] right-[-6%] h-[28rem] w-[28rem] rounded-full bg-blue-500/15 dark:bg-blue-950/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(6,43,87,0.08)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.03)_1px,transparent_0)] [background-size:28px_28px]" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="group flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#062b57] to-[#0a7ea4] text-lg font-bold text-white shadow-civic transition group-hover:-rotate-6">
            N
          </span>
          <span>
            <span className="block font-display text-2xl font-bold leading-6 dark:text-white">Namma Fix</span>
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0b6f8f] dark:text-cyan-400">Grievance Desk</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle theme={theme} setTheme={setTheme} />
          {authed ? (
            <div className="relative">
              <button
                className="ui-interactive inline-flex items-center gap-3 rounded-full border border-white/80 bg-white/80 px-4 py-2.5 text-sm font-bold text-[#061a3a] shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-200"
                onClick={() => setMenuOpen((current) => !current)}
                type="button"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#062b57] to-[#0a7ea4] text-sm text-white">
                  {avatarLetter}
                </span>
                <span>{profile?.name || "Member"}</span>
              </button>

              {menuOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[22rem] overflow-hidden rounded-[1.75rem] border border-white/80 bg-white p-4 shadow-2xl shadow-slate-950/15 dark:border-slate-800 dark:bg-slate-900">
                  <div className="rounded-[1.4rem] bg-gradient-to-br from-[#062b57] via-[#0b4f92] to-[#0a7ea4] p-4 text-white">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-lg font-black">
                        {avatarLetter}
                      </div>
                      <div>
                        <p className="text-lg font-black">{profile?.name || "Member"}</p>
                        <p className="text-sm text-white/80">{profile?.email || ""}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-cyan-200">{profile?.role || "Citizen"}</p>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                      <span>Member Since</span>
                      <span className="font-bold text-[#061a3a] dark:text-slate-200">
                        {profile?.member_since ? new Date(profile.member_since).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                      <span>Total Complaints Filed</span>
                      <span className="font-bold text-[#061a3a] dark:text-slate-200">{profile?.total_complaints ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                      <span>Resolved Complaints</span>
                      <span className="font-bold text-[#061a3a] dark:text-slate-200">{resolvedCount}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <NavLink className={navLinkClass} to="/complaints/new" onClick={() => setMenuOpen(false)}>
                      File Complaint
                    </NavLink>
                    <NavLink className={navLinkClass} to="/my-complaints" onClick={() => setMenuOpen(false)}>
                      My Complaints
                    </NavLink>
                    <button
                      onClick={handleLogout}
                      className="ui-interactive rounded-full px-4 py-2 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      type="button"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <nav className="flex flex-wrap items-center gap-2 rounded-full border border-white/80 bg-white/75 p-2 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-800/80">
              <NavLink className={navLinkClass} to="/login">
                Login
              </NavLink>
              <NavLink className={navLinkClass} to="/register">
                Register
              </NavLink>
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-12 pt-4">
        <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo(0, 0)}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {currentOutlet}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}




