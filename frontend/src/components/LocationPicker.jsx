import { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getWardFromCoordinates } from '../utils/wardLookup';
import { reverseGeocode } from '../utils/reverseGeocode';
import FormField from './FormField';

// Fix for default marker icon in leaflet with webpack/vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const defaultCenter = [12.9716, 77.5946];

function LocationMarker({ position, setPosition, onLocationUpdate }) {
  const markerRef = useRef(null);

  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onLocationUpdate(e.latlng.lat, e.latlng.lng);
    },
  });

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latlng = marker.getLatLng();
          setPosition(latlng);
          onLocationUpdate(latlng.lat, latlng.lng);
        }
      },
    }),
    [setPosition, onLocationUpdate],
  );

  return position === null ? null : (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    ></Marker>
  );
}

export default function LocationPicker({ form, setForm }) {
  const [position, setPosition] = useState(
    form.latitude && form.longitude
      ? { lat: Number(form.latitude), lng: Number(form.longitude) }
      : { lat: defaultCenter[0], lng: defaultCenter[1] }
  );

  const [loadingLocation, setLoadingLocation] = useState(false);

  async function handleLocationUpdate(lat, lng) {
    setLoadingLocation(true);
    try {
      const address = await reverseGeocode(lat, lng);
      const wardInfo = await getWardFromCoordinates(lat, lng);

      setForm((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        address: address || "",
        ward_number: wardInfo?.wardNumber || "",
        ward_name: wardInfo?.wardName || "",
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLocation(false);
    }
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-bold text-[#0b6f8f]">Select Location on Map</label>
        <p className="mb-2 text-xs text-slate-500">Click or drag the marker to pinpoint the issue location.</p>
        <div className="h-64 w-full overflow-hidden rounded-2xl border border-sky-100 ring-1 ring-black/5">
          <MapContainer center={position} zoom={13} scrollWheelZoom={false} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker position={position} setPosition={setPosition} onLocationUpdate={handleLocationUpdate} />
          </MapContainer>
        </div>
      </div>

      <FormField label="Address" id="address">
        <input
          id="address"
          name="address"
          value={form.address || ""}
          onChange={updateField}
          className="input"
          placeholder="Loading address..."
          disabled={loadingLocation}
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Ward Number" id="ward_number">
          <input
            id="ward_number"
            name="ward_number"
            value={form.ward_number || ""}
            onChange={updateField}
            className="input"
            placeholder={loadingLocation ? "Detecting..." : "Enter manually if not found"}
            disabled={loadingLocation}
          />
        </FormField>

        <FormField label="Ward Name" id="ward_name">
          <input
            id="ward_name"
            name="ward_name"
            value={form.ward_name || ""}
            onChange={updateField}
            className="input"
            placeholder={loadingLocation ? "Detecting..." : "Enter manually if not found"}
            disabled={loadingLocation}
          />
        </FormField>
      </div>
      
      {!loadingLocation && (!form.ward_number || !form.ward_name) && form.latitude && form.longitude && (
         <p className="text-xs text-rose-500 font-semibold">Unable to determine ward automatically. Please enter ward manually.</p>
      )}

      {/* Hidden inputs to keep form submission and validation working if any rely on it natively */}
      <input type="hidden" name="latitude" value={form.latitude} />
      <input type="hidden" name="longitude" value={form.longitude} />
    </div>
  );
}
