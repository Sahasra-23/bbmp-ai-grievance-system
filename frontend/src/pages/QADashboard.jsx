import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api, { getApiError } from "../api";

const smokeTestDefinitions = [
  {
    key: "backend",
    label: "Backend API reachable",
    endpoint: "/",
  },
  {
    key: "database",
    label: "Database connection",
    endpoint: "/public/stats",
  },
  {
    key: "ai",
    label: "AI classification",
    endpoint: "/my-complaints",
  },
  {
    key: "complaints",
    label: "Complaint endpoint",
    endpoint: "/my-complaints",
  },
  {
    key: "map",
    label: "Map endpoint",
    endpoint: "/public/complaints",
  },
];

function formatDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "N/A";

  const locale = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function QADashboard() {
  const [isAdmin, setIsAdmin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [smokeResults, setSmokeResults] = useState([]);
  const [smokeRunning, setSmokeRunning] = useState(false);
  const [lastSmokeRun, setLastSmokeRun] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function verifyAdminAccess() {
      setLoading(true);
      setError("");

      try {
        const profileResponse = await api.get("/me");
        if (!isMounted) return;

        const role = (profileResponse?.data?.role || "").toLowerCase();
        if (role !== "admin") {
          setIsAdmin(false);
        }
      } catch (requestError) {
        if (!isMounted) return;
        setError(getApiError(requestError, "Unable to verify admin access."));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    verifyAdminAccess();
    return () => {
      isMounted = false;
    };
  }, []);

  const qaSummary = useMemo(() => {
    const completedResults = smokeResults.filter((check) => check.status !== "Running");
    const totalTests = smokeResults.length || smokeTestDefinitions.length;
    const passedTests = completedResults.filter((check) => check.status === "Pass").length;
    const failedTests = completedResults.filter((check) => check.status === "Fail").length;
    const systemStatus = smokeRunning
      ? "Checking"
      : failedTests > 0
        ? "Unhealthy"
        : lastSmokeRun
          ? "Healthy"
          : "Healthy";

    return {
      systemStatus,
      totalTests,
      passedTests,
      failedTests,
      lastTestRun: lastSmokeRun,
    };
  }, [lastSmokeRun, smokeResults, smokeRunning]);

  const successRate = useMemo(() => {
    if (!qaSummary.totalTests) return 0;
    return Math.round((qaSummary.passedTests / qaSummary.totalTests) * 100);
  }, [qaSummary.passedTests, qaSummary.totalTests]);

  async function runSmokeTest() {
    setSmokeRunning(true);
    setLastSmokeRun("");
    setSmokeResults(
      smokeTestDefinitions.map((check) => ({
        ...check,
        status: "Running",
        message: "Checking...",
      }))
    );

    const results = await Promise.all(
      smokeTestDefinitions.map(async (check) => {
        try {
          const response = await api.get(check.endpoint);
          const data = response?.data;

          if (check.key === "database") {
            const hasStats = data && typeof data.total === "number";
            return {
              ...check,
              status: hasStats ? "Pass" : "Fail",
              message: hasStats ? "Stats endpoint returned database-backed totals." : "Stats response did not include totals.",
            };
          }

          if (check.key === "ai") {
            const complaints = Array.isArray(data) ? data : [];
            const hasClassificationSignal = complaints.some((complaint) =>
              complaint.category ||
              complaint.text_prediction ||
              complaint.image_prediction ||
              complaint.analysis_status
            );

            return {
              ...check,
              status: hasClassificationSignal ? "Pass" : "Fail",
              message: hasClassificationSignal
                ? "Complaint data includes AI classification fields."
                : "No classification result found in existing complaint data.",
            };
          }

          if (check.key === "complaints" || check.key === "map") {
            const isList = Array.isArray(data);
            return {
              ...check,
              status: isList ? "Pass" : "Fail",
              message: isList ? "Endpoint returned a complaint list." : "Endpoint did not return a list.",
            };
          }

          return {
            ...check,
            status: "Pass",
            message: "Backend root endpoint responded successfully.",
          };
        } catch (requestError) {
          return {
            ...check,
            status: "Fail",
            message: getApiError(requestError, "Smoke check failed."),
          };
        }
      })
    );

    setSmokeResults(results);
    setLastSmokeRun(new Date().toISOString());
    setSmokeRunning(false);
  }

  if (!isAdmin && !loading) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/80 bg-white/90 p-8 text-center shadow-civic backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-[#0b6f8f] dark:text-cyan-400">QA dashboard</p>
        <h1 className="mt-3 font-display text-3xl font-black text-[#061a3a] dark:text-white">Loading QA metrics...</h1>
      </section>
    );
  }

  return (
    <section className="space-y-8 py-4">
      <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-civic backdrop-blur sm:p-8 dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-[#0b6f8f] dark:text-cyan-400">QA overview</p>
            <h1 className="mt-3 font-display text-4xl font-black leading-none text-[#061a3a] dark:text-white">Quality assurance dashboard</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              Read-only health summary for automated checks and recent test status.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex items-center justify-center rounded-full bg-[#062b57] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b4f92] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-cyan-600 dark:hover:bg-cyan-700"
              disabled={smokeRunning}
              onClick={runSmokeTest}
              type="button"
            >
              {smokeRunning ? "Running..." : "Run Smoke Test"}
            </button>
            <Link to="/admin" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-[#061a3a] transition hover:border-sky-300 hover:text-[#0b4f92] dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
              Back to Admin Dashboard
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className={`rounded-[1.5rem] border p-5 shadow-sm ${
          qaSummary.systemStatus === "Unhealthy"
            ? "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20"
            : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
        }`}>
          <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${
            qaSummary.systemStatus === "Unhealthy"
              ? "text-rose-700 dark:text-rose-400"
              : "text-emerald-700 dark:text-emerald-400"
          }`}>System Status</p>
          <p className={`mt-3 font-display text-3xl font-black ${
            qaSummary.systemStatus === "Unhealthy"
              ? "text-rose-900 dark:text-rose-300"
              : "text-emerald-900 dark:text-emerald-300"
          }`}>{qaSummary.systemStatus}</p>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Total Tests</p>
          <p className="mt-3 font-display text-3xl font-black text-[#061a3a] dark:text-white">{qaSummary.totalTests}</p>
        </div>
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">Passed Tests</p>
          <p className="mt-3 font-display text-3xl font-black text-emerald-900 dark:text-emerald-300">{qaSummary.passedTests}</p>
        </div>
        <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-5 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/20">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-700 dark:text-rose-400">Failed Tests</p>
          <p className="mt-3 font-display text-3xl font-black text-rose-900 dark:text-rose-300">{qaSummary.failedTests}</p>
        </div>
        <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50 p-5 shadow-sm dark:border-sky-900/40 dark:bg-sky-950/20">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-700 dark:text-sky-400">Last Test Run</p>
          <p className="mt-3 font-display text-2xl font-black text-sky-900 dark:text-sky-300">{formatDateTime(qaSummary.lastTestRun)}</p>
        </div>
        <div className="rounded-[1.5rem] border border-[#0b6f8f]/20 bg-cyan-50 p-5 shadow-sm dark:border-cyan-900/40 dark:bg-cyan-950/20">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0b6f8f] dark:text-cyan-400">Test Success Rate</p>
          <p className="mt-3 font-display text-3xl font-black text-[#061a3a] dark:text-cyan-300">{successRate}%</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 shadow-civic backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-6 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-[#061a3a] dark:text-white">Smoke test results</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {lastSmokeRun ? `Last run: ${formatDateTime(lastSmokeRun)}` : "Run the smoke test to check core service endpoints."}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
              <tr>
                <th className="px-6 py-3 font-semibold">Check</th>
                <th className="px-6 py-3 font-semibold">Endpoint</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {(smokeResults.length > 0 ? smokeResults : smokeTestDefinitions).map((check) => {
                const status = check.status || "Not run";
                const isPass = status === "Pass";
                const isFail = status === "Fail";

                return (
                  <tr key={check.key} className="border-t border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-200">
                    <td className="px-6 py-4 font-semibold">{check.label}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{check.endpoint}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black tracking-[0.14em] ring-1 ${
                        isPass
                          ? "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-900/50"
                          : isFail
                            ? "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:ring-rose-900/50"
                            : "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                      }`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{check.message || "Waiting to run."}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
