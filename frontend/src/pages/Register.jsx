import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getApiError } from "../api";
import FormField from "../components/FormField";
import PasswordInput from "../components/PasswordInput";
import { isAuthenticated } from "../auth";
import { Navigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone_number: "", password: "" });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  if (isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function handlePhoneChange(event) {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 10);
    setForm((current) => ({ ...current, phone_number: digits }));
    if (phoneError) {
      setPhoneError("");
    }
  }

  function validatePhoneNumber(value) {
    const cleanedValue = value.trim();

    if (!cleanedValue) {
      return "Phone number is required.";
    }

    if (!/^\d+$/.test(cleanedValue)) {
      return "Phone number must contain only digits.";
    }

    if (cleanedValue.length !== 10) {
      return "Phone number must be exactly 10 digits.";
    }

    if (!/^[6789]/.test(cleanedValue)) {
      return "Phone number must start with 6, 7, 8, or 9.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;

    const phoneValidationError = validatePhoneNumber(form.phone_number);
    if (phoneValidationError) {
      setPhoneError(phoneValidationError);
      return;
    }

    setPhoneError("");
    setLoading(true);
    setMessage("");
    setMessageType("error");

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone_number: form.phone_number.trim(),
        password: form.password,
      };

      if (!payload.name || !payload.email || !payload.phone_number || !payload.password) {
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
        <p className="text-sm font-black uppercase tracking-[0.28em] text-[#0b6f8f] dark:text-cyan-400">Create account</p>
        <h1 className="mt-3 font-display text-5xl font-black leading-none text-[#061a3a] dark:text-white">Join the civic loop.</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-civic backdrop-blur sm:p-8 dark:border-slate-800 dark:bg-slate-900/90">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Full name" id="name">
            <input id="name" name="name" required value={form.name} onChange={updateField} className="input" placeholder="Your name" />
          </FormField>

          <FormField label="Email" id="email">
            <input id="email" name="email" type="email" required value={form.email} onChange={updateField} className="input" placeholder="you@example.com" />
          </FormField>

          <FormField label="Phone Number" id="phone_number">
            <input
              id="phone_number"
              name="phone_number"
              type="tel"
              required
              value={form.phone_number}
              onChange={handlePhoneChange}
              className="input"
              placeholder="9876543210"
              inputMode="numeric"
              autoComplete="tel"
            />
            {phoneError ? <p className="mt-2 text-sm font-semibold text-rose-600">{phoneError}</p> : null}
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

        <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
          Already registered? <Link className="font-bold text-[#0b4f92] hover:underline dark:text-cyan-400" to="/login">Login</Link>
        </p>
      </form>
    </section>
  );
}
