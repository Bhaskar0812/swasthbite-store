import axios from "axios";
import { useAuthStore } from "store/authStore";

const api = axios.create({
  baseURL: "https://api.swasthbite.in/api/v1",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isLoggingOut = false;

const AUTH_ENDPOINTS = [
  "/store-registration/login",
  "/store-registration/forgot-password",
  "/store-registration/reset-password",
  "/store-registration/register",
  "/auth/login",
];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    const isAuthEndpoint = AUTH_ENDPOINTS.some((ep) => url.includes(ep));

    if (error.response?.status === 401 && !isAuthEndpoint) {
      if (!isLoggingOut) {
        isLoggingOut = true;
        useAuthStore
          .getState()
          .logout()
          .then(() => {
            try {
              const { router } = require("expo-router");
              router.replace("/(auth)/login");
            } catch {}
            isLoggingOut = false;
          })
          .catch(() => {
            isLoggingOut = false;
          });
      }
      return Promise.resolve({ data: { data: null, success: false } });
    }

    console.log(
      "❌ API Error:",
      error.config?.url,
      error.response?.status,
      error.response?.data?.message || error.message,
    );
    return Promise.reject(error);
  },
);

export default api;
