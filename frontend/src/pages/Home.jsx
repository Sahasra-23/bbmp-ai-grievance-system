import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { isAuthenticated } from "../auth";
import api from "../api";

function formatDateTime(value) {
  if (!value) return "N/A";
  const dateStr = value.endsWith("Z") ? value : value + "Z";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "N/A";

  const locale = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
  const d = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
  const t = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${d} • ${t}`;
}

function getMarkerColor(category) {
  const cat = (category || "").toLowerCase();
  if (cat === "roads") return "#ef4444"; // red
  if (cat === "sanitation") return "#eab308"; // yellow
  if (cat === "water supply") return "#3b82f6"; // blue
  if (["electricity", "electrical", "street light"].includes(cat)) return "#a855f7"; // purple
  return "#9ca3af"; // gray
}

function createCustomIcon(color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32" stroke="white" stroke-width="2">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>`;
  return L.divIcon({
    className: "custom-leaflet-icon",
    html: svg,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

export default function Home() {
  const authed = isAuthenticated();
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState("Just now");
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    function fetchData() {
      api.get("/public/complaints")
        .then(res => {
          setComplaints(res.data);
          setMapLoaded(true);
        })
        .catch(console.error);

      api.get("/public/stats")
        .then(res => {
          setStats(res.data);
          const now = new Date();
          setLastUpdated(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
        })
        .catch(console.error);
    }
    
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-16 py-8 lg:py-16">
      <section className="grid items-center gap-8 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-7">
          <div className="inline-flex rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-sm font-bold text-[#0b6f8f] shadow-sm dark:border-slate-800 dark:bg-slate-850/80 dark:text-cyan-400">
            AI-assisted civic complaint routing for Bengaluru
          </div>
          <h1 className="font-display text-5xl font-black leading-[0.98] tracking-tight text-[#061a3a] sm:text-6xl dark:text-white">
            Report civic issues without the paperwork fog.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            File complaints with location details, let the backend predict the category, and track your submissions from one tidy dashboard.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={authed ? "/complaints/new" : "/login"}
              className="rounded-full bg-[#062b57] px-6 py-3 text-sm font-bold text-white shadow-civic transition-all duration-250 hover:scale-[1.03] hover:shadow-xl hover:bg-[#0b4f92] dark:bg-cyan-600 dark:hover:bg-cyan-700"
            >
              {authed ? "File a complaint" : "Login to begin"}
            </Link>
            <Link
              to={authed ? "/my-complaints" : "/register"}
              className="rounded-full border border-slate-200 bg-white/80 px-6 py-3 text-sm font-bold text-[#061a3a] transition-all duration-250 hover:scale-[1.03] hover:border-sky-300 hover:text-[#0b4f92] dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-cyan-500"
            >
              {authed ? "View complaints" : "Create account"}
            </Link>
          </div>
        </div>

        <div className="flex flex-col space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#061a3a] dark:text-white flex items-center gap-1.5">
                <span>📍</span> Live Bengaluru Complaint Map
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Displaying live citizen complaints across Bengaluru
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold sm:text-right">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 ring-1 ring-emerald-600/10 dark:bg-emerald-950/30 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Data
              </span>
              <span className="text-slate-400 dark:text-slate-500">
                Last updated: {lastUpdated}
              </span>
            </div>
          </div>
          <div className="h-px bg-slate-200/60 dark:bg-slate-800" />
          
          <div className={`relative h-[585px] rounded-[2rem] border border-white/80 bg-white/80 p-3 shadow-civic backdrop-blur transition-opacity duration-500 dark:border-slate-800 dark:bg-slate-900/45 ${mapLoaded ? "opacity-100" : "opacity-50"}`}>
            <div className="h-full w-full overflow-hidden rounded-2xl ring-1 ring-slate-200/80 relative z-0">
              <MapContainer
                center={[12.9716, 77.5946]}
                zoom={11}
                style={{ height: "100%", width: "100%", zIndex: 0 }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
                  {complaints.map((c) => (
                    <Marker
                      key={c.id}
                      position={[c.latitude, c.longitude]}
                      icon={createCustomIcon(getMarkerColor(c.category))}
                    >
                      <Popup className="rounded-xl">
                        <div className="space-y-2 p-1">
                          <h3 className="font-bold text-[#061a3a] m-0 leading-tight">{c.title}</h3>
                          <div className="text-xs space-y-1 text-slate-600">
                            <p className="m-0"><span className="font-semibold">Category:</span> {c.category || "Pending"}</p>
                            <p className="m-0"><span className="font-semibold">Status:</span> {c.status}</p>
                            {c.ward_name && <p className="m-0"><span className="font-semibold">Ward:</span> {c.ward_name}</p>}
                            <p className="m-0"><span className="font-semibold">Submitted:</span> {formatDateTime(c.created_at)}</p>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MarkerClusterGroup>
              </MapContainer>
            </div>
          </div>
        </div>
      </section>

      {stats && (
        <div className="rounded-[2rem] bg-white/90 p-8 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/80 dark:bg-slate-900/80 dark:ring-slate-800">
          <h2 className="text-sm font-black uppercase tracking-[0.24em] text-[#062b57] dark:text-cyan-400 mb-6">Live Complaint Summary</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
            <div className="ui-card p-4 text-center rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-800/80 dark:bg-slate-950/30">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Total</p>
              <p className="mt-2 font-display text-2xl font-black text-[#061a3a] dark:text-white">{stats.total}</p>
            </div>
            <div className="ui-card p-4 text-center rounded-2xl border border-amber-100 bg-amber-50 dark:border-amber-950/30 dark:bg-amber-950/10">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-amber-700 dark:text-amber-400">Open</p>
              <p className="mt-2 font-display text-2xl font-black text-amber-900 dark:text-amber-300">{stats.open}</p>
            </div>
            <div className="ui-card p-4 text-center rounded-2xl border border-sky-100 bg-sky-50 dark:border-sky-950/30 dark:bg-sky-950/10">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-sky-700 dark:text-sky-400">In Progress</p>
              <p className="mt-2 font-display text-2xl font-black text-sky-900 dark:text-sky-300">{stats.in_progress}</p>
            </div>
            <div className="ui-card p-4 text-center rounded-2xl border border-emerald-100 bg-emerald-50 dark:border-emerald-950/30 dark:bg-emerald-950/10">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700 dark:text-emerald-400">Completed</p>
              <p className="mt-2 font-display text-2xl font-black text-emerald-900 dark:text-emerald-300">{stats.completed}</p>
            </div>
            <div className="ui-card p-4 text-center rounded-2xl border border-rose-100 bg-rose-50 dark:border-rose-950/30 dark:bg-rose-950/10">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-rose-700 dark:text-rose-400">Roads</p>
              <p className="mt-2 font-display text-2xl font-black text-rose-900 dark:text-rose-300">{stats.roads}</p>
            </div>
            <div className="ui-card p-4 text-center rounded-2xl border border-yellow-200 bg-yellow-50 dark:border-yellow-950/30 dark:bg-yellow-950/10">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-yellow-700 dark:text-yellow-400">Sanitation</p>
              <p className="mt-2 font-display text-2xl font-black text-yellow-900 dark:text-yellow-300">{stats.sanitation}</p>
            </div>
            <div className="ui-card p-4 text-center rounded-2xl border border-blue-100 bg-blue-50 dark:border-blue-950/30 dark:bg-blue-950/10">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-blue-700 dark:text-blue-400">Water</p>
              <p className="mt-2 font-display text-2xl font-black text-blue-900 dark:text-blue-300">{stats.water_supply}</p>
            </div>
            <div className="ui-card p-4 text-center rounded-2xl border border-purple-100 bg-purple-50 dark:border-purple-950/30 dark:bg-purple-950/10">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-purple-700 dark:text-purple-400">Electrical</p>
              <p className="mt-2 font-display text-2xl font-black text-purple-900 dark:text-purple-300">{stats.electrical}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
