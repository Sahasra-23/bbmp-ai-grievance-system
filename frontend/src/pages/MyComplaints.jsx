import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getApiError } from "../api";

const STATUS_OPTIONS = ["OPEN", "WORKING", "CLOSED"];
const STATUS_TRANSITIONS = {
  OPEN: ["OPEN", "WORKING", "CLOSED"],
  WORKING: ["WORKING", "CLOSED"],
  CLOSED: ["CLOSED"],
};

function StatusPill({ status }) {
  const label = status || "UNKNOWN";
  const statusClass = {
    OPEN: "bg-sky-100 text-sky-800 ring-sky-200",
    WORKING: "bg-amber-100 text-amber-800 ring-amber-200",
    CLOSED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  }[label] || "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <span className={`rounded-full px-4 py-1.5 text-xs font-black tracking-[0.16em] ring-1 ${statusClass}`}>
      {label}
    </span>
  );
}

function getAllowedStatuses(status) {
  return STATUS_TRANSITIONS[status || "OPEN"] || ["CLOSED"];
}

export default function MyComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusMessageType, setStatusMessageType] = useState("success");
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [selectedStatuses, setSelectedStatuses] = useState({});
  const [updatingComplaintId, setUpdatingComplaintId] = useState(null);

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const { data } = await api.get("/my-complaints");
      const complaintList = Array.isArray(data) ? data : [];
      setComplaints(complaintList);
      setSelectedStatuses(
        complaintList.reduce((statusMap, complaint) => {
          statusMap[complaint.id] = complaint.status || "OPEN";
          return statusMap;
        }, {})
      );
    } catch (error) {
      setMessage(getApiError(error, "Unable to fetch complaints. Please try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setSelectedComplaint(null);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function updateSelectedStatus(complaintId, status) {
    setSelectedStatuses((current) => ({
      ...current,
      [complaintId]: status,
    }));
  }

  async function handleStatusUpdate(complaint) {
    const nextStatus = selectedStatuses[complaint.id] || complaint.status;

    if (nextStatus === complaint.status) {
      setStatusMessageType("error");
      setStatusMessage("Choose a different status before updating.");
      return;
    }

    setUpdatingComplaintId(complaint.id);
    setStatusMessage("");

    try {
      const { data } = await api.patch(`/complaints/${complaint.id}/status`, {
        status: nextStatus,
      });

      setComplaints((currentComplaints) =>
        currentComplaints.map((item) =>
          item.id === complaint.id ? data : item
        )
      );
      setSelectedStatuses((current) => ({
        ...current,
        [complaint.id]: data.status,
      }));
      setSelectedComplaint((current) =>
        current?.id === complaint.id ? data : current
      );
      setStatusMessageType("success");
      setStatusMessage(`Status updated to ${data.status}.`);
    } catch (error) {
      setStatusMessageType("error");
      setStatusMessage(getApiError(error, "Unable to update complaint status."));
    } finally {
      setUpdatingComplaintId(null);
    }
  }

  return (
    <section className="relative py-8">
      <div className="pointer-events-none absolute inset-x-[-6rem] top-0 -z-10 h-72 rounded-[3rem] bg-gradient-to-r from-sky-100 via-white to-cyan-100 blur-3xl" />

      <div className="mb-8 overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#062b57] via-[#0b4f92] to-[#0a7ea4] p-6 text-white shadow-civic sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.36em] text-cyan-200">Dashboard</p>
            <h1 className="mt-3 font-display text-5xl font-black leading-none sm:text-6xl">My complaints</h1>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-white/72">
              Track civic issues, review AI classification, and move each complaint through its status lifecycle.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-black text-[#062b57] shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-cyan-50"
            to="/complaints/new"
          >
            File another complaint
          </Link>
        </div>
      </div>

      {loading ? <div className="rounded-3xl bg-white/80 p-6 font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">Loading complaints...</div> : null}

      {statusMessage ? (
        <div className={`mb-5 rounded-3xl p-5 text-sm font-bold shadow-sm ${
          statusMessageType === "success" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
        }`}>
          {statusMessage}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-3xl bg-rose-50 p-6 font-bold text-rose-700 shadow-sm ring-1 ring-rose-100">
          <p>{message}</p>
          <button
            className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-black text-rose-700 transition hover:bg-rose-100"
            onClick={loadComplaints}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !message && complaints.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-sky-300 bg-white/75 p-8 text-center shadow-sm">
          <h2 className="font-display text-3xl font-bold text-[#062b57]">No complaints yet.</h2>
          <p className="mt-2 text-slate-500">Your submitted complaints will appear here with status and AI category.</p>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {complaints.map((complaint) => {
          const allowedStatuses = getAllowedStatuses(complaint.status);
          const selectedStatus = selectedStatuses[complaint.id] || complaint.status || "OPEN";
          const isClosed = complaint.status === "CLOSED";
          const isUpdating = updatingComplaintId === complaint.id;
          const cannotUpdate = isClosed || isUpdating || selectedStatus === complaint.status;

          return (
            <article
              key={complaint.id}
              className="group relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 text-left shadow-xl shadow-slate-900/10 backdrop-blur transition hover:-translate-y-1 hover:shadow-civic"
            >
              <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-[#0b4f92] via-[#0a7ea4] to-cyan-300" />
              <button
                onClick={() => setSelectedComplaint(complaint)}
                className="block w-full rounded-3xl text-left focus:outline-none focus:ring-4 focus:ring-sky-200"
                type="button"
              >
                <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-slate-400">Complaint #{complaint.id}</p>
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-display text-3xl font-black leading-tight text-[#061a3a]">{complaint.title}</h2>
                  <StatusPill status={complaint.status} />
                </div>
                <p className="mt-4 leading-7 text-slate-600">{complaint.description}</p>
                <div className="mt-5 rounded-2xl bg-sky-50 px-4 py-3 text-sm font-black text-[#0b6f8f] ring-1 ring-sky-100">
                  AI predicted category: {complaint.category || "Not predicted"}
                </div>
              </button>

              <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                <label className="block text-sm font-black uppercase tracking-[0.16em] text-slate-500" htmlFor={`status-${complaint.id}`}>
                  Update status
                </label>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <select
                    id={`status-${complaint.id}`}
                    className="input"
                    disabled={isClosed || isUpdating}
                    onChange={(event) => updateSelectedStatus(complaint.id, event.target.value)}
                    value={selectedStatus}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option
                        disabled={!allowedStatuses.includes(status)}
                        key={status}
                        value={status}
                      >
                        {status}
                      </option>
                    ))}
                  </select>
                  <button
                    className="inline-flex items-center justify-center rounded-2xl bg-[#0b4f92] px-5 py-3 text-sm font-black text-white shadow-lg shadow-sky-900/15 transition hover:-translate-y-0.5 hover:bg-[#062b57] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:bg-[#0b4f92]"
                    disabled={cannotUpdate}
                    onClick={() => handleStatusUpdate(complaint)}
                    type="button"
                  >
                    {isUpdating ? "Updating..." : "Update Status"}
                  </button>
                </div>
                {isClosed ? (
                  <p className="mt-3 text-sm font-semibold text-slate-500">Closed complaints cannot be reopened.</p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {selectedComplaint ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-5 py-8 backdrop-blur-md"
          onClick={() => setSelectedComplaint(null)}
          role="presentation"
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-[2.25rem] border border-white/80 bg-[#f8fbff] p-6 shadow-2xl shadow-slate-950/30 sm:p-8"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="complaint-title"
          >
            <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-[#062b57] via-[#0b4f92] to-cyan-300" />
            <button
              aria-label="Close complaint details"
              className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white text-3xl font-black leading-none text-[#062b57] shadow-lg shadow-slate-900/10 ring-1 ring-slate-200 transition hover:bg-[#062b57] hover:text-white"
              onClick={() => setSelectedComplaint(null)}
              type="button"
            >
              &times;
            </button>

            <p className="text-sm font-black uppercase tracking-[0.32em] text-[#0b6f8f]">Complaint details</p>
            <div className="mt-4 flex flex-col gap-4 pr-20 sm:flex-row sm:items-start sm:justify-between">
              <h2 id="complaint-title" className="font-display text-5xl font-black leading-tight text-[#061a3a]">
                {selectedComplaint.title}
              </h2>
              <StatusPill status={selectedComplaint.status} />
            </div>

            <div className="mt-7 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">Description</h3>
              <p className="mt-3 leading-8 text-slate-600">{selectedComplaint.description}</p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-sky-50 p-6 shadow-sm ring-1 ring-sky-100">
                <h3 className="text-sm font-black uppercase tracking-[0.22em] text-[#0b6f8f]">AI predicted category</h3>
                <p className="mt-3 font-display text-3xl font-black text-[#061a3a]">{selectedComplaint.category || "Not predicted"}</p>
              </div>
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">Complaint ID</h3>
                <p className="mt-3 font-display text-3xl font-black text-[#061a3a]">#{selectedComplaint.id}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
