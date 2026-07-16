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
  return `${percent.toFixed(2)}%`;
}

function formatDateTime(value) {
  if (!value) return { date: "N/A", time: "N/A" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "N/A", time: "N/A" };

  return {
    date: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
  };
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
    const nextStatus = statusValues[complaint.id] || complaint.status || "OPEN";

    if (nextStatus === complaint.status) {
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

    if (selectedCategory === complaint.category) {
      setStatusMessageType("error");
      setStatusMessage("Choose a different category before saving.");
      return;
    }

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
      setStatusMessage("Category updated successfully.");
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
    { label: "AI Accepted", value: summary.ai_accepted ?? 0 },
    { label: "AI Corrected", value: summary.ai_corrected ?? 0 },
    { label: "AI Acceptance Rate", value: formatPercent(summary.acceptance_rate) },
    { label: "Latest Complaint", value: summary.latest_complaint?.title || "N/A" },
  ];

  return (
    <section className="space-y-8 py-6">
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
        <div className="rounded-3xl bg-white/80 p-6 font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-[1.75rem] bg-white/90 p-5 shadow-lg shadow-slate-900/8 ring-1 ring-slate-200/80">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">{metric.label}</p>
            <p className="mt-3 font-display text-2xl font-black text-[#061a3a]">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 rounded-[1.75rem] bg-white/90 p-5 shadow-lg shadow-slate-900/8 ring-1 ring-slate-200/80 lg:grid-cols-4">
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
        <div className="rounded-[2rem] border border-dashed border-sky-300 bg-white/75 p-8 text-center shadow-sm">
          <h2 className="font-display text-3xl font-bold text-[#062b57]">No complaints found.</h2>
          <p className="mt-2 text-slate-500">Try a different search or filter, or file a new complaint.</p>
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
            <article key={complaint.id} className="overflow-hidden rounded-[2rem] bg-white/95 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200/80">
              <button
                className="w-full text-left"
                type="button"
                onClick={() => setExpandedId(expanded ? null : complaint.id)}
              >
                <div className="h-2 bg-gradient-to-r from-[#062b57] via-[#0b4f92] to-cyan-300" />
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Complaint #{complaint.id}</p>
                      <h2 className="mt-2 font-display text-3xl font-black leading-tight text-[#061a3a]">{complaint.title}</h2>
                    </div>
                    <StatusBadge status={currentStatus} />
                  </div>

                  <p
                    className="mt-4 leading-7 text-slate-600"
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
                      className="mt-5 h-48 w-full rounded-3xl object-cover ring-1 ring-sky-100"
                      src={complaint.image_url}
                    />
                  ) : null}

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0b6f8f]">Category</p>
                      <p className="mt-2 font-display text-2xl font-black text-[#061a3a]">{complaint.category || "Pending"}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-100">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Confidence</p>
                      <p className="mt-2 font-display text-2xl font-black text-[#061a3a]">{confidence}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
                    <span>Submitted {date}</span>
                    <span>•</span>
                    <span>{time}</span>
                    <span>•</span>
                    <span>Location {complaint.latitude}, {complaint.longitude}</span>
                  </div>
                </div>
              </button>

              {expanded ? (
                <div className="border-t border-slate-100 bg-slate-50/70 p-5 sm:p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                      <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">Full Description</h3>
                      <p className="mt-3 leading-8 text-slate-600">{complaint.description}</p>
                    </div>
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                      <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">Complaint Image</h3>
                      {complaint.image_url ? (
                        <img
                          alt={complaint.title}
                          className="mt-3 max-h-80 w-full rounded-2xl object-cover"
                          src={complaint.image_url}
                        />
                      ) : (
                        <p className="mt-3 text-slate-500">No image available.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Latitude</p>
                      <p className="mt-2 font-display text-2xl font-black text-[#061a3a]">{complaint.latitude}</p>
                    </div>
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Longitude</p>
                      <p className="mt-2 font-display text-2xl font-black text-[#061a3a]">{complaint.longitude}</p>
                    </div>
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">AI Analysis Status</p>
                      <p className="mt-2 font-display text-2xl font-black text-[#061a3a]">{complaint.analysis_status || "PENDING"}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl bg-sky-50 p-5 ring-1 ring-sky-100">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0b6f8f]">Current Category</p>
                      <p className="mt-2 font-display text-2xl font-black text-[#061a3a]">{complaint.category || "Pending"}</p>
                    </div>
                    <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Confidence</p>
                      <p className="mt-2 font-display text-2xl font-black text-[#061a3a]">{confidence}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.75rem] bg-white p-5 ring-1 ring-slate-100">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Is this category correct?</p>
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
                        Save Category
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.75rem] bg-white p-5 ring-1 ring-slate-100">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Update Status</p>
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

                  <div className="mt-4 rounded-[1.75rem] bg-slate-50 p-5 ring-1 ring-slate-100">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Status History</p>
                    <p className="mt-3 text-slate-600">Status history is not tracked yet. Current status: {statusLabel(currentStatus)}.</p>
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

