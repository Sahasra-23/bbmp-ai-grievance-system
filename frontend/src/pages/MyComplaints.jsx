import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { getApiError } from "../api";

const CATEGORY_OPTIONS = [
  "Roads",
  "Sanitation",
  "Water Supply",
  "Electricity",
  "Drainage",
  "Garbage",
  "Street Light",
  "Traffic",
  "Other",
];

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }
  const numeric = Number(value);
  const percent = numeric <= 1 ? numeric * 100 : numeric;
  return `${percent.toFixed(1).replace(/\.0$/, "")}%`;
}

function formatDateTime(value) {
  if (!value) return { date: "N/A", time: "N/A" };
  const dateStr = value.endsWith('Z') ? value : value + 'Z';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return { date: "N/A", time: "N/A" };

  const locale = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
  return {
    date: new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
  };
}

function formatShortLocation(complaint) {
  if (complaint.address) {
    const parts = complaint.address.split(',').map(p => p.trim());
    const firstPart = parts[0] || '';
    const city = parts.find(p => p.toLowerCase().includes('bengaluru')) || '';
    if (city && firstPart !== city) {
      return `📍 ${firstPart}, ${city}`;
    }
    return `📍 ${firstPart}`;
  }
  if (complaint.ward_name || complaint.ward_number) {
    const parts = [];
    if (complaint.ward_number) parts.push(`Ward ${complaint.ward_number}`);
    if (complaint.ward_name) parts.push(complaint.ward_name);
    return `📍 ${parts.join(" • ")}`;
  }
  if (complaint.latitude && complaint.longitude) {
    return `📍 ${complaint.latitude}, ${complaint.longitude}`;
  }
  return "📍 Location unavailable";
}

function formatWardDisplay(complaint) {
  const parts = [];
  if (complaint.ward_number) parts.push(`Ward ${complaint.ward_number}`);
  if (complaint.ward_name) parts.push(complaint.ward_name);
  return parts.length > 0 ? parts.join(" • ") : null;
}

function aiStatusClasses(status) {
  const value = (status || "PENDING").toUpperCase();
  if (value === "COMPLETED") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (value === "FAILED") return "bg-rose-100 text-rose-800 ring-rose-200";
  return "bg-amber-100 text-amber-800 ring-amber-200";
}

function formatAiStatus(status) {
  const value = (status || "PENDING").toUpperCase();
  if (value === "COMPLETED") return "🟢 COMPLETED";
  if (value === "FAILED") return "🔴 FAILED";
  return "🟡 PENDING";
}

function formatCoordinate(val) {
  if (val === null || val === undefined || val === "") return "N/A";
  const num = Number(val);
  return Number.isFinite(num) ? num.toFixed(6) : val;
}

function statusLabel(status) {
  const value = (status || "OPEN").toUpperCase();
  if (value === "WORKING") return "IN PROGRESS";
  if (value === "CLOSED") return "RESOLVED";
  if (value === "REJECTED") return "REJECTED";
  return "OPEN";
}

function StatusBadge({ status }) {
  const label = statusLabel(status);
  const classes = {
    OPEN: "bg-amber-100 text-amber-800 ring-amber-200",
    "IN PROGRESS": "bg-sky-100 text-sky-800 ring-sky-200",
    RESOLVED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    REJECTED: "bg-rose-100 text-rose-800 ring-rose-200",
  }[label];

  return (
    <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-black tracking-[0.14em] ring-1 ${classes}`}>
      {label}
    </span>
  );
}

function descriptionSnippet(text) {
  if (!text) return "";
  return text.length > 140 ? `${text.slice(0, 140).trim()}...` : text;
}

function normalizeStatusValue(value) {
  const status = (value || "OPEN").toUpperCase();
  if (status === "RESOLVED") return "CLOSED";
  if (status === "IN PROGRESS") return "WORKING";
  return status;
}

function updateResolvedCount(summary, currentStatus, nextStatus) {
  if (!summary) return summary;

  const previous = (currentStatus || "OPEN").toUpperCase();
  const next = (nextStatus || "OPEN").toUpperCase();
  const updated = { ...summary };

  if (previous === "CLOSED") {
    updated.resolved = Math.max((updated.resolved ?? 0) - 1, 0);
  }
  if (next === "CLOSED") {
    updated.resolved = (updated.resolved ?? 0) + 1;
  }

  return updated;
}
export default function MyComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("Newest");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusMessageType, setStatusMessageType] = useState("success");
  const [savingId, setSavingId] = useState(null);
  const [categoryValues, setCategoryValues] = useState({});
  const [statusValues, setStatusValues] = useState({});
  const [insightsOpen, setInsightsOpen] = useState(false);
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [complaintsResponse, profileResponse] = await Promise.all([
        api.get("/my-complaints"),
        api.get("/me"),
      ]);

      const complaintList = Array.isArray(complaintsResponse.data) ? complaintsResponse.data : [];
      setComplaints(complaintList);
      setProfile(profileResponse.data || null);
      setCategoryValues(
        complaintList.reduce((accumulator, complaint) => {
          accumulator[complaint.id] = complaint.category || "Other";
          return accumulator;
        }, {})
      );
      setStatusValues(
        complaintList.reduce((accumulator, complaint) => {
          accumulator[complaint.id] = complaint.status || "OPEN";
          return accumulator;
        }, {})
      );
    } catch (requestError) {
      setError(getApiError(requestError, "Unable to load dashboard."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setExpandedId(null);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const summary = profile?.summary || {};

  const categoryOptions = useMemo(() => {
    const fromData = complaints.map((complaint) => complaint.category).filter(Boolean);
    return ["All", ...new Set([...CATEGORY_OPTIONS, ...fromData])];
  }, [complaints]);

  const visibleComplaints = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = complaints.filter((complaint) => {
      const titleMatch = complaint.title?.toLowerCase().includes(query);
      const categoryMatch =
        categoryFilter === "All" || (complaint.category || "Other") === categoryFilter;
      const statusMatch =
        statusFilter === "All" || statusLabel(complaint.status) === statusFilter;

      return (query === "" || titleMatch) && categoryMatch && statusMatch;
    });

    filtered.sort((left, right) => {
      const leftTime = new Date(left.created_at || 0).getTime();
      const rightTime = new Date(right.created_at || 0).getTime();
      return sortOrder === "Oldest" ? leftTime - rightTime : rightTime - leftTime;
    });

    return filtered;
  }, [complaints, search, categoryFilter, statusFilter, sortOrder]);

  async function handleStatusUpdate(complaint) {
    const nextStatus = normalizeStatusValue(statusValues[complaint.id] || complaint.status || "OPEN");
    const currentStatus = normalizeStatusValue(complaint.status || "OPEN");

    if (nextStatus === currentStatus) {
      setStatusMessageType("error");
      setStatusMessage("Choose a different status before updating.");
      return;
    }

    setSavingId(complaint.id);
    setStatusMessage("");

    try {
      const { data } = await api.patch(`/complaints/${complaint.id}/status`, {
        status: nextStatus,
      });

      setComplaints((current) =>
        current.map((item) => (item.id === complaint.id ? data : item))
      );
      setProfile((currentProfile) =>
        currentProfile
          ? {
              ...currentProfile,
              summary: updateResolvedCount(currentProfile.summary, currentStatus, nextStatus),
            }
          : currentProfile
      );
      setStatusValues((current) => ({
        ...current,
        [complaint.id]: data.status || nextStatus,
      }));
      setStatusMessageType("success");
      setStatusMessage(`Status updated to ${statusLabel(data.status)}.`);
    } catch (requestError) {
      setStatusMessageType("error");
      setStatusMessage(getApiError(requestError, "Unable to update complaint status."));
    } finally {
      setSavingId(null);
    }
  }
  async function handleCategorySave(complaint) {
    const selectedCategory = categoryValues[complaint.id] || complaint.category || "Other";
    const isUnchanged = selectedCategory === complaint.category;

    setSavingId(complaint.id);
    setStatusMessage("");

    try {
      const { data } = await api.patch(`/complaints/${complaint.id}/category`, {
        category: selectedCategory,
      });

      setComplaints((current) =>
        current.map((item) => (item.id === complaint.id ? data : item))
      );
      setStatusMessageType("success");
      setStatusMessage(isUnchanged ? "✓ Category confirmed successfully." : "✓ Category updated successfully.");
    } catch (requestError) {
      setStatusMessageType("error");
      setStatusMessage(getApiError(requestError, "Unable to update complaint category."));
    } finally {
      setSavingId(null);
    }
  }

  const metrics = [
    { label: "Total Complaints", value: summary.total_complaints ?? complaints.length },
    { label: "Pending", value: summary.pending ?? 0 },
    { label: "Resolved", value: summary.resolved ?? 0 },
    { label: "Rejected", value: summary.rejected ?? 0 },
    { label: "Accepted AI Prediction", value: summary.ai_accepted ?? 0 },
    { label: "Corrected Prediction", value: summary.ai_corrected ?? 0 },
    { label: "Prediction Accuracy", value: formatPercent(summary.acceptance_rate) },
    { label: "Latest Complaint", value: summary.latest_complaint?.title || "N/A" },
  ];

  return (
    <section className="page-transition space-y-8 py-6">
      <div className="overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#062b57] via-[#0b4f92] to-[#0a7ea4] p-6 text-white shadow-civic sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.36em] text-cyan-200">Dashboard</p>
            <h1 className="mt-3 font-display text-5xl font-black leading-none sm:text-6xl">My Complaints Dashboard</h1>
            <p className="mt-4 text-sm font-semibold leading-7 text-white/75">
              Track civic requests, review AI categorization, and correct categories when needed.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-black text-[#062b57] shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-cyan-50"
            to="/complaints/new"
          >
            File Complaint
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl bg-white/80 p-6 font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900/80 dark:text-slate-300 dark:ring-slate-850">
          Loading dashboard...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl bg-rose-50 p-6 font-bold text-rose-700 shadow-sm ring-1 ring-rose-100">
          <p>{error}</p>
          <button
            className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-black text-rose-700 transition hover:bg-rose-100"
            onClick={loadDashboard}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      {statusMessage ? (
        <div className={`rounded-3xl p-5 text-sm font-bold shadow-sm ${
          statusMessageType === "success"
            ? "bg-sky-50 text-[#0b6f8f] ring-1 ring-sky-100"
            : "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
        }`}>
          {statusMessage}
        </div>
      ) : null}

      <div className="ui-card overflow-hidden rounded-[1.75rem]">
        <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-sky-50/60 dark:hover:bg-slate-800/60" type="button" onClick={() => setInsightsOpen((current) => !current)}>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#062b57] dark:text-cyan-400">Dashboard Insights</p>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{insightsOpen ? "▲ Hide Insights" : "▼ Show Insights"}</p>
          </div>
        </button>
        <div className={`grid overflow-hidden transition-all duration-300 ease-out ${insightsOpen ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="grid gap-4 border-t border-slate-100 p-5 md:grid-cols-2 xl:grid-cols-4 dark:border-slate-800">
            {metrics.map((metric) => (
              <div key={metric.label} className="ui-card ui-card-hover flex h-full min-h-[110px] flex-col justify-between rounded-[1.5rem] p-5">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">{metric.label}</p>
                <p className="mt-3 break-words font-display text-2xl font-black leading-tight text-[#061a3a] dark:text-white">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-[1.75rem] bg-white/90 p-5 shadow-lg shadow-slate-900/8 ring-1 ring-slate-200/80 lg:grid-cols-4 dark:bg-slate-900/90 dark:ring-slate-800">
        <input
          className="input"
          placeholder="Search by title"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          {categoryOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          {["All", "OPEN", "IN PROGRESS", "RESOLVED", "REJECTED"].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select className="input" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
          {["Newest", "Oldest"].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {!loading && !error && visibleComplaints.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-sky-300 bg-white/75 p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950/20">
          <h2 className="font-display text-3xl font-bold text-[#062b57] dark:text-cyan-400">No complaints found.</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Try a different search or filter, or file a new complaint.</p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {visibleComplaints.map((complaint) => {
          const expanded = expandedId === complaint.id;
          const { date, time } = formatDateTime(complaint.created_at);
          const currentStatus = complaint.status || "OPEN";
          const selectedCategory = categoryValues[complaint.id] || complaint.category || "Other";
          const selectedStatus = statusValues[complaint.id] || complaint.status || "OPEN";
          const confidence = formatPercent(complaint.prediction_confidence);

          return (
            <article key={complaint.id} className="group overflow-hidden rounded-[2rem] bg-white/95 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200/80 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-900/10 dark:bg-slate-900 dark:ring-slate-800 dark:hover:shadow-slate-950/25">
              <button
                className="w-full text-left"
                type="button"
                onClick={() => setExpandedId(expanded ? null : complaint.id)}
              >
                <div className="h-2 bg-gradient-to-r from-[#062b57] via-[#0b4f92] to-cyan-300 transition duration-300 group-hover:brightness-110" />
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Complaint #{complaint.id}</p>
                      <h2 className="mt-2 font-display text-3xl font-black leading-tight text-[#061a3a] dark:text-white">{complaint.title}</h2>
                    </div>
                    <StatusBadge status={currentStatus} />
                  </div>

                  <p
                    className="mt-4 break-words leading-7 text-slate-600 dark:text-slate-300"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {descriptionSnippet(complaint.description)}
                  </p>

                  {complaint.image_url ? (
                    <img
                      alt={complaint.title}
                      className="mt-5 h-48 w-full rounded-3xl object-cover ring-1 ring-sky-100 transition duration-300 group-hover:scale-[1.01] dark:ring-slate-800"
                      src={complaint.image_url}
                    />
                  ) : null}

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100 h-full flex flex-col justify-center dark:bg-slate-950/30 dark:ring-slate-800">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0b6f8f] dark:text-cyan-400">Predicted Category</p>
                      <p className="mt-2 break-words font-display text-2xl font-black leading-tight text-[#061a3a] dark:text-white">{complaint.category || "Pending"}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-100 h-full flex flex-col justify-center dark:bg-slate-950/20 dark:ring-slate-800">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Confidence</p>
                      <p className="mt-2 flex items-center break-words font-display text-2xl font-black leading-tight text-[#061a3a] dark:text-white">{confidence}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>Submitted on {date} at {time}</span>
                      <span>•</span>
                      <span className="break-words" title={complaint.address || ""}>{formatShortLocation(complaint)}</span>
                    </div>
                    {formatWardDisplay(complaint) && (
                      <div className="flex items-center gap-2">
                        <span className="break-words">🏛 {formatWardDisplay(complaint)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {expanded ? (
                <div className="border-t border-slate-100 bg-slate-50/70 p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-950/30">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 h-full flex flex-col dark:bg-slate-900 dark:ring-slate-800">
                      <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Full Description</h3>
                      <p className="mt-3 leading-8 text-slate-600 flex-1 dark:text-slate-300">{complaint.description}</p>
                    </div>
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 h-full flex flex-col dark:bg-slate-900 dark:ring-slate-800">
                      <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Complaint Image</h3>
                      {complaint.image_url ? (
                        <img
                          alt={complaint.title}
                          className="mt-3 h-64 w-full rounded-2xl object-cover"
                          src={complaint.image_url}
                        />
                      ) : (
                        <p className="mt-3 text-slate-500 flex-1 flex items-center justify-center dark:text-slate-400">No image available.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 h-full flex flex-col justify-center text-center dark:bg-slate-900 dark:ring-slate-800">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Latitude</p>
                      <p className="mt-2 font-display text-xl font-black text-[#061a3a] font-mono break-all dark:text-slate-100">{formatCoordinate(complaint.latitude)}</p>
                    </div>
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 h-full flex flex-col justify-center text-center dark:bg-slate-900 dark:ring-slate-800">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Longitude</p>
                      <p className="mt-2 font-display text-xl font-black text-[#061a3a] font-mono break-all dark:text-slate-100">{formatCoordinate(complaint.longitude)}</p>
                    </div>
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 h-full flex flex-col justify-center dark:bg-slate-900 dark:ring-slate-800">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 text-center dark:text-slate-500">AI Analysis Status</p>
                      <div className="mt-3 flex items-center justify-center">
                         <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-black tracking-[0.14em] ring-1 ${aiStatusClasses(complaint.analysis_status)}`}>
                            {formatAiStatus(complaint.analysis_status)}
                         </span>
                      </div>
                    </div>
                  </div>

                  {(complaint.address || formatWardDisplay(complaint)) && (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {complaint.address && (
                        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 h-full flex flex-col dark:bg-slate-900 dark:ring-slate-800">
                          <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Address</h3>
                          <p className="mt-3 leading-8 text-slate-600 whitespace-pre-line flex-1 dark:text-slate-300">
                            {complaint.address.replace(/, /g, ",\n")}
                          </p>
                        </div>
                      )}
                      {formatWardDisplay(complaint) && (
                        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 h-full flex flex-col dark:bg-slate-900 dark:ring-slate-800">
                          <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Ward</h3>
                          <p className="mt-3 leading-8 text-slate-600 flex-1 dark:text-slate-300">{formatWardDisplay(complaint)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl bg-sky-50 p-5 ring-1 ring-sky-100 h-full flex flex-col justify-center dark:bg-slate-950/30 dark:ring-slate-800">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0b6f8f] dark:text-cyan-400">Current Category</p>
                      <p className="mt-2 break-words font-display text-2xl font-black leading-tight text-[#061a3a] dark:text-white">{complaint.category || "Pending"}</p>
                    </div>
                    <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100 h-full flex flex-col justify-center dark:bg-slate-900 dark:ring-slate-800">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Confidence</p>
                      <p className="mt-2 flex items-center break-words font-display text-2xl font-black leading-tight text-[#061a3a] dark:text-white">{confidence}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.75rem] bg-white p-5 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">AI Category Confirmation</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                      <select
                        className="input"
                        value={selectedCategory}
                        onChange={(event) =>
                          setCategoryValues((current) => ({
                            ...current,
                            [complaint.id]: event.target.value,
                          }))
                        }
                      >
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn-primary"
                        disabled={savingId === complaint.id}
                        onClick={() => handleCategorySave(complaint)}
                        type="button"
                      >
                        Confirm Category
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.75rem] bg-white p-5 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Update Status</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                      <select
                        className="input"
                        value={selectedStatus}
                        onChange={(event) =>
                          setStatusValues((current) => ({
                            ...current,
                            [complaint.id]: event.target.value,
                          }))
                        }
                      >
                        {["OPEN", "WORKING", "CLOSED"].map((option) => (
                          <option key={option} value={option}>
                            {option === "WORKING" ? "IN PROGRESS" : option === "CLOSED" ? "RESOLVED" : option}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn-primary"
                        disabled={savingId === complaint.id}
                        onClick={() => handleStatusUpdate(complaint)}
                        type="button"
                      >
                        {savingId === complaint.id ? "Updating..." : "Update Status"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.75rem] bg-slate-50 p-5 ring-1 ring-slate-100 dark:bg-slate-950/20 dark:ring-slate-800">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Status History</p>
                    <p className="mt-3 text-slate-600 dark:text-slate-400">Status history is not tracked yet. Current status: {statusLabel(currentStatus)}.</p>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}




