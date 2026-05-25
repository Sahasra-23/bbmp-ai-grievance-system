import { Link } from "react-router-dom";
import { isAuthenticated } from "../auth";

export default function Home() {
  const authed = isAuthenticated();

  return (
    <section className="grid items-center gap-8 py-8 lg:grid-cols-[1.08fr_0.92fr] lg:py-16">
      <div className="space-y-7">
        <div className="inline-flex rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-sm font-bold text-[#0b6f8f] shadow-sm">
          AI-assisted civic complaint routing for Bengaluru
        </div>
        <h1 className="font-display text-5xl font-black leading-[0.98] tracking-tight text-[#061a3a] sm:text-6xl">
          Report civic issues without the paperwork fog.
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-slate-600">
          File complaints with location details, let the backend predict the category, and track your submissions from one tidy dashboard.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to={authed ? "/complaints/new" : "/login"}
            className="rounded-full bg-[#062b57] px-6 py-3 text-sm font-bold text-white shadow-civic transition hover:-translate-y-0.5 hover:bg-[#0b4f92]"
          >
            {authed ? "File a complaint" : "Login to begin"}
          </Link>
          <Link
            to={authed ? "/my-complaints" : "/register"}
            className="rounded-full border border-slate-200 bg-white/80 px-6 py-3 text-sm font-bold text-[#061a3a] transition hover:-translate-y-0.5 hover:border-sky-300 hover:text-[#0b4f92]"
          >
            {authed ? "View complaints" : "Create account"}
          </Link>
        </div>
      </div>

      <div className="relative rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-civic backdrop-blur">
        <div className="absolute -right-5 -top-5 h-24 w-24 rounded-[2rem] bg-sky-300/80" />
        <div className="relative space-y-4">
          {[
            ["Road damage", "OPEN", "Roads"],
            ["Garbage not cleared", "IN REVIEW", "Sanitation"],
            ["Street light issue", "OPEN", "Electrical"],
          ].map(([title, status, category]) => (
            <div key={title} className="rounded-3xl border border-sky-100 bg-[#f8fbff] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-[#061a3a]">{title}</h3>
                  <p className="mt-1 text-sm text-slate-500">AI predicted category: {category}</p>
                </div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black tracking-wide text-[#0b6f8f]">{status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
