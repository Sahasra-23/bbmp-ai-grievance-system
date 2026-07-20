import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FormField from "../components/FormField";
import PasswordInput from "../components/PasswordInput";

export default function CreateAdmin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
  }

  return (
    <section className="mx-auto max-w-3xl py-8">
      <div className="mb-7 text-center">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-[#0b6f8f] dark:text-cyan-400">Admin tools</p>
        <h1 className="mt-3 font-display text-5xl font-black leading-none text-[#061a3a] dark:text-white">Create Administrator</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-civic backdrop-blur sm:p-8 dark:border-slate-800 dark:bg-slate-900/90">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Full Name" id="name">
            <input id="name" name="name" required value={form.name} onChange={updateField} className="input" placeholder="Full name" />
          </FormField>

          <FormField label="Email" id="email">
            <input id="email" name="email" type="email" required value={form.email} onChange={updateField} className="input" placeholder="you@example.com" />
          </FormField>

          <FormField label="Password" id="password">
            <PasswordInput id="password" name="password" required value={form.password} onChange={updateField} placeholder="Enter password" />
          </FormField>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button className="btn-primary w-full sm:w-auto" type="submit">
            Create Admin
          </button>
          <button className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-[#061a3a] transition hover:border-sky-300 hover:text-[#0b4f92] dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200" type="button" onClick={() => navigate("/admin")}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
