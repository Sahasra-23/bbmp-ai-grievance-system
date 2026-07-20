import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api, { getApiError } from "../api";
import { saveToken, isAuthenticated } from "../auth";
import FormField from "../components/FormField";
import PasswordInput from "../components/PasswordInput";

import { Navigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState(location.state?.authMessage || "");
  const [loading, setLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState(null);

  async function resolveRedirectPath() {
    try {
      const { data: profileData } = await api.get("/me");
      const role = (profileData?.role || "").toLowerCase();
      return role === "admin" ? "/admin" : "/";
    } catch {
      return "/";
    }
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      setRedirectPath(null);
      return;
    }

    let isActive = true;

    resolveRedirectPath().then((nextPath) => {
      if (isActive) {
        setRedirectPath(nextPath);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      const payload = {
        email: form.email.trim(),
        password: form.password,
      };

      const { data } = await api.post("/login", payload);

      if (data.error) {
        setMessage(data.error);
        return;
      }

      if (!data.access_token) {
        setMessage("Login succeeded, but no token was returned by the backend.");
        return;
      }

      saveToken(data.access_token);
      const nextPath = await resolveRedirectPath();
      navigate(nextPath, { replace: true });
    } catch (error) {
      setMessage(getApiError(error, "Unable to login. Please check your email and password."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto grid max-w-5xl items-center gap-8 py-8 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.28em] text-[#0b6f8f] dark:text-cyan-400">Citizen access</p>
        <h1 className="mt-4 font-display text-5xl font-black leading-none text-[#061a3a] dark:text-white">Welcome back.</h1>
        <p className="mt-5 text-slate-600 dark:text-slate-350">Login to file a complaint or review the status and AI category of your earlier reports.</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-civic backdrop-blur sm:p-8 dark:border-slate-800 dark:bg-slate-900/90">
        <div className="space-y-5">
          <FormField label="Email" id="email">
            <input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={updateField}
              className="input"
              placeholder="you@example.com"
            />
          </FormField>

          <FormField label="Password" id="password">
            <PasswordInput
              id="password"
              name="password"
              value={form.password}
              onChange={updateField}
              placeholder="Your password"
            />
          </FormField>
        </div>

        {message ? <div className="mt-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{message}</div> : null}

        <button disabled={loading} className="btn-primary mt-7 w-full" type="submit">
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
          New here? <Link className="font-bold text-[#0b4f92] hover:underline dark:text-cyan-400" to="/register">Create an account</Link>
        </p>
      </form>
    </section>
  );
}
