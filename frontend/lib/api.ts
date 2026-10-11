import axios, { AxiosError } from "axios";
import type {
  AskResponse,
  ChatTurn,
  Holding,
  JournalEntry,
  PortfolioStrategy,
  PortfolioSummary,
  StoredDocument,
} from "./types";
import { clearSessionStore } from "./sessionStore";

// Set NEXT_PUBLIC_API_URL in .env.local (or the deploy environment) to point at the backend
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

const api = axios.create({ baseURL: API_URL });

export function getToken(): string | null {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

export function logout() {
  try {
    localStorage.removeItem("token");
    sessionStorage.clear();
  } catch {}
  clearSessionStore();
  window.location.href = "/";
}

// Automatically add token to every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// An expired or invalid token logs the user out instead of failing silently
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const isAuthCall = error.config?.url?.startsWith("/auth/login") || error.config?.url?.startsWith("/auth/signup");
    if (error.response?.status === 401 && !isAuthCall && typeof window !== "undefined") {
      logout();
    }
    return Promise.reject(error);
  }
);

/** Turns an API error into a message suitable for the user. */
export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return "Cannot reach the server. Make sure the backend is running.";
    const detail = (err.response.data as { detail?: unknown })?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  }
  return fallback;
}

// Auth
export const login = async (email: string, password: string) => {
  const response = await api.post<{ access_token: string }>("/auth/login", { email, password });
  return response.data;
};

export const signup = async (email: string, password: string) => {
  const response = await api.post<{ access_token: string }>("/auth/signup", { email, password });
  return response.data;
};

export const getMe = async () => {
  const response = await api.get("/auth/me");
  return response.data;
};

// Portfolio
export const getPortfolioSummary = async () => {
  const response = await api.get<PortfolioSummary>("/portfolio/summary");
  return response.data;
};

export const getHoldings = async () => {
  const response = await api.get<Holding[]>("/portfolio/holdings");
  return response.data;
};

export const addHolding = async (data: {
  ticker: string;
  quantity: number;
  cost_basis: number | null;
  account_type: string;
}) => {
  const response = await api.post("/portfolio/holdings", data);
  return response.data;
};

export const deleteHolding = async (holdingId: string) => {
  await api.delete(`/portfolio/holdings/${holdingId}`);
};

// Decisions
/** Copilot chat: the backend works out the stock(s), portfolio or retirement route. */
export const askCopilot = async (query: string, history: ChatTurn[] = []) => {
  const response = await api.post<AskResponse>("/decisions/ask", {
    query,
    conversation_history: history,
  });
  return response.data;
};

export const getPortfolioStrategy = async () => {
  const response = await api.get<PortfolioStrategy>("/decisions/portfolio-strategy");
  return response.data;
};

export const getJournal = async () => {
  const response = await api.get<JournalEntry[]>("/decisions/journal");
  return response.data;
};

// Documents
export const listDocuments = async () => {
  const response = await api.get<{ documents: StoredDocument[] }>("/documents/");
  return response.data.documents;
};

export const uploadDocument = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<StoredDocument>("/documents/upload", formData);
  return response.data;
};

export const deleteDocument = async (documentId: string) => {
  await api.delete(`/documents/${documentId}`);
};
