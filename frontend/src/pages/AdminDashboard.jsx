import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api, { getApiError } from "../api";

function formatDateTime(value) {
  if (!value) return "N/A";
  const dateStr = value.endsWith("Z") ? value : `${value}Z`;
  const date = new Date(dateStr);

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

function getStatusLabel(status) {
  const value = (status || "OPEN").toUpperCase();
  if (value === "WORKING") return "In Progress";
  if (value === "CLOSED") return "Completed";
  return "Pending";
}

function getStatusBadgeClasses(status) {
  const label = getStatusLabel(status);
  if (label === "Completed") {
    return "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-900/50";
  }
  if (label === "In Progress") {
    return "bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:ring-sky-900/50";
  }
  return "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-900/50";
}

export default function AdminDashboard() {
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const [complaintsResponse, statsResponse, profileResponse] = await Promise.all([
          api.get("/public/complaints"),
          api.get("/public/stats"),
          api.get("/me"),
        ]);

        if (!isMounted) return;

        const role = (profileResponse?.data?.role || "").toLowerCase();
        if (role !== "admin") {
          setIsAdmin(false);
          return;
        }

        setComplaints(Array.isArray(complaintsResponse?.data) ? complaintsResponse.data : []);
        setStats(statsResponse?.data || null);
      } catch (requestError) {
        if (!isMounted) return;
        setError(getApiError(requestError, "Unable to load the admin dashboard."));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    const total = complaints.length;
    const pending = complaints.filter((complaint) => (complaint.status || "OPEN").toUpperCase() === "OPEN" || !complaint.status).length;
    const inProgress = complaints.filter((complaint) => (complaint.status || "").toUpperCase() === "WORKING").length;
    const completed = complaints.filter((complaint) => (complaint.status || "").toUpperCase() === "CLOSED").length;

    return {
      total,
      pending,
      inProgress,
      completed,
    };
  }, [complaints]);

  const categoryCounts = useMemo(() => {
    const counts = complaints.reduce((accumulator, complaint) => {
      const category = (complaint.category || "Other").trim() || "Other";
      accumulator[category] = (accumulator[category] || 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(counts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);
  }, [complaints]);

  const topWards = useMemo(() => {
    const counts = complaints.reduce((accumulator, complaint) => {
      const ward = complaint.ward_name || "Unassigned";
      accumulator[ward] = (accumulator[ward] || 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(counts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5);
  }, [complaints]);

  const latestComplaints = useMemo(() => {
    return [...complaints]
      .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime())
      .slice(0, 5);
  }, [complaints]);

  if (!isAdmin && !loading) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/80 bg-white/90 p-8 text-center shadow-civic backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-[#0b6f8f] dark:text-cyan-400">Admin dashboard</p>
        <h1 className="mt-3 font-display text-3xl font-black text-[#061a3a] dark:text-white">Loading dashboard…</h1>
      </section>
    );
  }

  return (
    <section className="space-y-8 py-4">
      <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-civic backdrop-blur sm:p-8 dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-[#0b6f8f] dark:text-cyan-400">Admin overview</p>
            <h1 className="mt-3 font-display text-4xl font-black leading-none text-[#061a3a] dark:text-white">Civic operations dashboard</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              Read-only view of complaint volume, category distribution, ward hotspots, and recent submissions.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/qa" className="inline-flex items-center justify-center rounded-full bg-[#062b57] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b4f92] dark:bg-cyan-600 dark:hover:bg-cyan-700">
              QA Dashboard
            </Link>
            <Link to="/" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-[#061a3a] transition hover:border-sky-300 hover:text-[#0b4f92] dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
              Back to home
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Total complaints</p>
          <p className="mt-3 font-display text-3xl font-black text-[#061a3a] dark:text-white">{stats?.total ?? summary.total}</p>
        </div>
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">Pending</p>
          <p className="mt-3 font-display text-3xl font-black text-amber-900 dark:text-amber-300">{stats?.open ?? summary.pending}</p>
        </div>
        <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50 p-5 shadow-sm dark:border-sky-900/40 dark:bg-sky-950/20">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-700 dark:text-sky-400">In Progress</p>
          <p className="mt-3 font-display text-3xl font-black text-sky-900 dark:text-sky-300">{stats?.in_progress ?? summary.inProgress}</p>
        </div>
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">Completed</p>
          <p className="mt-3 font-display text-3xl font-black text-emerald-900 dark:text-emerald-300">{stats?.completed ?? summary.completed}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-civic backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <h2 className="text-lg font-black text-[#061a3a] dark:text-white">Complaint counts by category</h2>
          <div className="mt-5 space-y-4">
            {categoryCounts.length > 0 ? categoryCounts.map(([category, count]) => (
              <div key={category}>
                <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <span>{category}</span>
                  <span>{count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-[#0b6f8f]"
                    style={{ width: `${Math.max(12, (count / Math.max(complaints.length, 1)) * 100)}%` }}
                  />
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No complaints available yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-civic backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <h2 className="text-lg font-black text-[#061a3a] dark:text-white">Top 5 wards</h2>
          <div className="mt-5 space-y-3">
            {topWards.length > 0 ? topWards.map(([ward, count], index) => (
              <div key={ward} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#062b57] text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <span className="font-semibold text-[#061a3a] dark:text-white">{ward}</span>
                </div>
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{count} complaints</span>
              </div>
            )) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No ward data yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 shadow-civic backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="border-b border-slate-200 p-6 dark:border-slate-800">
          <h2 className="text-lg font-black text-[#061a3a] dark:text-white">Latest complaints</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
              <tr>
                <th className="px-6 py-3 font-semibold">ID</th>
                <th className="px-6 py-3 font-semibold">Title</th>
                <th className="px-6 py-3 font-semibold">Category</th>
                <th className="px-6 py-3 font-semibold">Ward</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {latestComplaints.length > 0 ? latestComplaints.map((complaint) => (
                <tr key={complaint.id} className="border-t border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-200">
                  <td className="px-6 py-4 font-semibold">#{complaint.id}</td>
                  <td className="px-6 py-4">{complaint.title || "Untitled complaint"}</td>
                  <td className="px-6 py-4">{complaint.category || "Other"}</td>
                  <td className="px-6 py-4">{complaint.ward_name || "Unassigned"}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black tracking-[0.14em] ring-1 ${getStatusBadgeClasses(complaint.status)}`}>
                      {getStatusLabel(complaint.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">{formatDateTime(complaint.created_at)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    No complaints available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
