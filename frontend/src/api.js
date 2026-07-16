import axios from "axios";
import { clearToken, getValidToken } from "./auth";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8001";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getValidToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }

    return Promise.reject(error);
  }
);

export function getApiError(error, fallback = "Something went wrong. Please try again.") {
  const detail = error.response?.data?.detail;
  const apiError = error.response?.data?.error;

  if (typeof apiError === "string") {
    return apiError;
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join(", ");
  }

  if (error.code === "ERR_NETWORK") {
    return `Cannot connect to backend at ${BACKEND_URL}. Please check that FastAPI is running on port 8001.`;
  }

  return fallback;
}

export default api;
