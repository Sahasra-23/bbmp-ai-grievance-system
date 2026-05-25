import { useState } from "react";

export default function PasswordInput({ id, name, value, onChange, placeholder, minLength }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={showPassword ? "text" : "password"}
        required
        minLength={minLength}
        value={value}
        onChange={onChange}
        className="input pr-14"
        placeholder={placeholder}
      />
      <button
        aria-label={showPassword ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-3 my-auto flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-sky-50 hover:text-[#0b4f92] focus:outline-none focus:ring-4 focus:ring-sky-100"
        onClick={() => setShowPassword((current) => !current)}
        type="button"
      >
        {showPassword ? (
          <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.9 4.2A10.5 10.5 0 0 1 12 4c6 0 9.5 6.5 9.5 8a11.9 11.9 0 0 1-3.1 4.2" />
            <path d="M6.6 6.7C4.1 8.4 2.5 11 2.5 12c0 1.5 3.5 8 9.5 8 1.5 0 2.9-.4 4.1-1" />
          </svg>
        ) : (
          <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M2.5 12S6 4 12 4s9.5 8 9.5 8-3.5 8-9.5 8-9.5-8-9.5-8Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
