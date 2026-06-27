import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api"
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
