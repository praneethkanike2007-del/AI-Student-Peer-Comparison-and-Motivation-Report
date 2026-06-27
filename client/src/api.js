import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_URL?.trim();
const isLocalFrontend = ["localhost", "127.0.0.1"].includes(window.location.hostname);
// Locally, the Vite preview runs on 4173 while the API runs on 5000.
// In production, set VITE_API_URL to the deployed backend URL plus /api.
export const api = axios.create({
  baseURL: apiBaseUrl || (isLocalFrontend ? "http://localhost:5000/api" : `${window.location.origin}/api`)
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("smartedu_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function saveSession(payload) {
  localStorage.setItem("smartedu_token", payload.token);
  localStorage.setItem("smartedu_user", JSON.stringify(payload.user));
}

export function readUser() {
  const raw = localStorage.getItem("smartedu_user");
  return raw ? JSON.parse(raw) : null;
}

export function clearSession() {
  localStorage.removeItem("smartedu_token");
  localStorage.removeItem("smartedu_user");
}
