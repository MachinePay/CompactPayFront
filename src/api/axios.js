import axios from "axios";

const listeners = [];
export function addApiErrorListener(fn) {
  listeners.push(fn);
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = "Erro inesperado. Tente novamente.";
    if (error.response) {
      if (error.response.status === 401) {
        message = "Sessão expirada. Faça login novamente.";
        localStorage.removeItem("token");
        window.location.href = "/login";
      } else if (error.response.data?.detail) {
        message = error.response.data.detail;
      } else if (typeof error.response.data === "string") {
        message = error.response.data;
      }
    } else if (error.message === "Network Error") {
      message = "Servidor indisponível. Tente novamente mais tarde.";
    }
    listeners.forEach((fn) => fn(message));
    return Promise.reject(error);
  },
);

export default api;
