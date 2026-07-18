import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { getApiError } from "../api";
import FormField from "../components/FormField";

export default function FileComplaint() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", description: "", latitude: "", longitude: "" });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [submittedComplaint, setSubmittedComplaint] = useState(null);
  const [analysisComplaint, setAnalysisComplaint] = useState(null);

  useEffect(() => {
    if (!submittedComplaint?.complaint_id) {
      return undefined;
    }

    let cancelled = false;
    let pollTimer = null;

    async function pollComplaint() {
      try {
        const { data } = await api.get(`/complaints/${submittedComplaint.complaint_id}`);

        if (cancelled) {
          return;
        }

        setAnalysisComplaint(data);

        if (data.analysis_status === "COMPLETED" || data.analysis_status === "FAILED") {
          if (pollTimer) {
            window.clearInterval(pollTimer);
          }
        }
      } catch {
        // Keep polling silent in the citizen UI.
      }
    }

    pollComplaint();
    pollTimer = window.setInterval(pollComplaint, 3000);

    const redirectTimer = window.setTimeout(() => {
      navigate("/my-complaints", {
        replace: true,
        state: { highlightComplaintId: submittedComplaint.complaint_id },
      });
    }, 2000);

    return () => {
      cancelled = true;
      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
      window.clearTimeout(redirectTimer);
    };
  }, [submittedComplaint?.complaint_id, navigate]);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function updateImage(event) {
    const selectedImage = event.target.files?.[0];
    setImage(selectedImage || null);

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    if (selectedImage) {
      setImagePreview(URL.createObjectURL(selectedImage));
    } else {
      setImagePreview("");
    }
  }

  function validateForm() {
    const title = form.title.trim();
    const description = form.description.trim();
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (title.length < 3) return "Title should be at least 3 characters.";
    if (description.length < 10) return "Description should be at least 10 characters so the AI can classify it.";
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      return "Latitude must be a valid number between -90 and 90.";
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return "Longitude must be a valid number between -180 and 180.";
    }
    if (image && !image.type.startsWith("image/")) return "Please upload a valid image file.";
    if (!image) return "Please upload a complaint image for multimodal classification.";
    if (image.size > 10 * 1024 * 1024) return "Image must be 10 MB or smaller.";
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);

    try {
      const validationError = validateForm();
      if (validationError) {
        window.alert(validationError);
        return;
      }

      const payload = new FormData();
      payload.append("title", form.title.trim());
      payload.append("description", form.description.trim());
      payload.append("latitude", Number(form.latitude));
      payload.append("longitude", Number(form.longitude));
      if (image) {
        payload.append("image", image);
      }

      const { data } = await api.post("/complaints", payload);
      setSubmittedComplaint(data);
      setAnalysisComplaint({
        complaint_id: data.complaint_id,
        analysis_status: "PENDING",
      });
      setForm({ title: "", description: "", latitude: "", longitude: "" });
      setImage(null);
      URL.revokeObjectURL(imagePreview);
      setImagePreview("");
    } catch (error) {
      window.alert(getApiError(error, "Unable to file complaint. Please check the form and try again."));
    } finally {
      setLoading(false);
    }
  }

  const confidenceValue = analysisComplaint?.prediction_confidence;
  const confidenceText = confidenceValue === null || confidenceValue === undefined
    ? "N/A"
    : `${((Number(confidenceValue) <= 1 ? Number(confidenceValue) * 100 : Number(confidenceValue))).toFixed(0)}%`;

  return (
    <section className="grid gap-8 py-8 lg:grid-cols-[0.82fr_1.18fr]">
      <aside className="rounded-[2rem] bg-gradient-to-br from-[#062b57] via-[#0b4f92] to-[#0a7ea4] p-7 text-white shadow-civic">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-200">New complaint</p>
        <h1 className="mt-4 font-display text-5xl font-black leading-none">Tell Namma Fix what needs attention.</h1>
        <p className="mt-5 leading-7 text-white/72">
          Add a clear title, describe the problem, and include latitude and longitude so the backend can store the location and predict the civic category.
        </p>
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

          <FormField label="Complaint image" id="image">
            <input
              id="image"
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required
              onChange={updateImage}
              className="input file:mr-4 file:rounded-full file:border-0 file:bg-sky-50 file:px-4 file:py-2 file:text-sm file:font-bold file:text-[#0b4f92]"
            />
          </FormField>

          {imagePreview ? (
            <div className="overflow-hidden rounded-3xl border border-sky-100 bg-sky-50 p-3">
              <img alt="Selected complaint preview" className="max-h-72 w-full rounded-2xl object-cover" src={imagePreview} />
            </div>
          ) : null}
        </div>

        {submittedComplaint ? (
          <div className="mt-5 rounded-[1.75rem] border border-sky-100 bg-sky-50 p-5 text-[#0b6f8f] shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.22em]">Complaint submitted successfully</p>
            <p className="mt-3 font-display text-3xl font-black text-[#061a3a]">Complaint ID #{submittedComplaint.complaint_id}</p>
            <div className="mt-4 grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-sky-100 sm:grid-cols-2">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">AI Suggested Category</p>
                <p className="mt-2 font-display text-2xl font-black text-[#061a3a]">{analysisComplaint?.category || "Pending"}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Confidence</p>
                <p className="mt-2 font-display text-2xl font-black text-[#061a3a]">{confidenceText}</p>
              </div>
            </div>
          </div>
        ) : null}

        <button disabled={loading} className="btn-primary mt-7 w-full" type="submit">
          {loading ? "Submitting..." : "Submit complaint"}
        </button>
      </form>
    </section>
  );
}
