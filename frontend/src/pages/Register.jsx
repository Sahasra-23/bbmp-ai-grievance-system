import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getApiError } from "../api";
import FormField from "../components/FormField";
import PasswordInput from "../components/PasswordInput";

const roles = ["citizen", "officer", "admin"];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "citizen" });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [loading, setLoading] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");
    setMessageType("error");

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      };

      if (!payload.name || !payload.email || !payload.password || !payload.role) {
        setMessage("Please fill in all fields.");
        return;
      }

      const { data } = await api.post("/register", payload);
      setMessageType("success");
      setMessage(data.message || "Registration successful.");
      window.setTimeout(() => navigate("/login", { state: { authMessage: "Registration successful. Please login." } }), 900);
    } catch (error) {
      const status = error.response?.status;
      const fallback = status === 500
        ? "Unable to register. This email may already exist."
        : "Unable to register. Please check your details and try again.";
      setMessage(getApiError(error, fallback));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl py-8">
      <div className="mb-7 text-center">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-[#0b6f8f]">Create account</p>
        <h1 className="mt-3 font-display text-5xl font-black leading-none text-[#061a3a]">Join the civic loop.</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-civic backdrop-blur sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Full name" id="name">
            <input id="name" name="name" required value={form.name} onChange={updateField} className="input" placeholder="Your name" />
          </FormField>

          <FormField label="Email" id="email">
            <input id="email" name="email" type="email" required value={form.email} onChange={updateField} className="input" placeholder="you@example.com" />
          </FormField>

          <FormField label="Password" id="password">
            <PasswordInput
              id="password"
              name="password"
              minLength="6"
              value={form.password}
              onChange={updateField}
              placeholder="Minimum 6 characters"
            />
          </FormField>

          <FormField label="Role" id="role">
            <select id="role" name="role" value={form.role} onChange={updateField} className="input capitalize">
              {roles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </FormField>
        </div>

        {message ? (
          <div className={`mt-5 rounded-2xl px-4 py-3 text-sm font-bold ${
            messageType === "success" ? "bg-sky-50 text-[#0b6f8f]" : "bg-rose-50 text-rose-700"
          }`}>
            {message}
          </div>
        ) : null}

        <button disabled={loading} className="btn-primary mt-7 w-full" type="submit">
          {loading ? "Creating account..." : "Register"}
        </button>

        <p className="mt-5 text-center text-sm text-slate-500">
          Already registered? <Link className="font-bold text-[#0b4f92] hover:underline" to="/login">Login</Link>
        </p>
      </form>
    </section>
  );
}
