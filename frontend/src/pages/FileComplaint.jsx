import { useState } from "react";
import api, { getApiError } from "../api";
import FormField from "../components/FormField";

export default function FileComplaint() {
  const [form, setForm] = useState({ title: "", description: "", latitude: "", longitude: "" });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [prediction, setPrediction] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function validateForm() {
    const title = form.title.trim();
    const description = form.description.trim();
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (title.length < 3) {
      return "Title should be at least 3 characters.";
    }

    if (description.length < 10) {
      return "Description should be at least 10 characters so the AI can classify it.";
    }

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      return "Latitude must be a valid number between -90 and 90.";
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return "Longitude must be a valid number between -180 and 180.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");
    setMessageType("error");
    setPrediction("");

    try {
      const validationError = validateForm();

      if (validationError) {
        setMessage(validationError);
        return;
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      };

      const { data } = await api.post("/complaints", payload);
      setMessageType("success");
      setMessage(data.message || "Complaint created.");
      setPrediction(data.predicted_category || "");
      setForm({ title: "", description: "", latitude: "", longitude: "" });
    } catch (error) {
      setMessage(getApiError(error, "Unable to file complaint. Please check the form and try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid gap-8 py-8 lg:grid-cols-[0.82fr_1.18fr]">
      <aside className="rounded-[2rem] bg-gradient-to-br from-[#062b57] via-[#0b4f92] to-[#0a7ea4] p-7 text-white shadow-civic">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-200">New complaint</p>
        <h1 className="mt-4 font-display text-5xl font-black leading-none">Tell Namma Fix what needs attention.</h1>
        <p className="mt-5 leading-7 text-white/72">Add a clear title, describe the problem, and include latitude and longitude so the backend can store the location and predict the civic category.</p>
      </aside>

      <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-civic backdrop-blur sm:p-8">
        <div className="space-y-5">
          <FormField label="Title" id="title">
            <input id="title" name="title" required value={form.title} onChange={updateField} className="input" placeholder="Pothole near bus stop" />
          </FormField>

          <FormField label="Description" id="description">
            <textarea id="description" name="description" required rows="5" value={form.description} onChange={updateField} className="input resize-none" placeholder="Describe the issue, nearby landmark, and urgency." />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Latitude" id="latitude">
              <input id="latitude" name="latitude" type="number" step="any" required value={form.latitude} onChange={updateField} className="input" placeholder="12.9716" />
            </FormField>

            <FormField label="Longitude" id="longitude">
              <input id="longitude" name="longitude" type="number" step="any" required value={form.longitude} onChange={updateField} className="input" placeholder="77.5946" />
            </FormField>
          </div>
        </div>

        {message ? (
          <div className={`mt-5 rounded-2xl px-4 py-3 text-sm font-bold ${
            messageType === "success" ? "bg-sky-50 text-[#0b6f8f]" : "bg-rose-50 text-rose-700"
          }`}>
            <p>{message}</p>
            {prediction ? <p className="mt-2">AI predicted category: {prediction}</p> : null}
          </div>
        ) : null}

        <button disabled={loading} className="btn-primary mt-7 w-full" type="submit">
          {loading ? "Submitting..." : "Submit complaint"}
        </button>
      </form>
    </section>
  );
}
