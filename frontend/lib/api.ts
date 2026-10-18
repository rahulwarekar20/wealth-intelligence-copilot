/**
 * Backend API client: one typed function per endpoint (auth, portfolio,
 * copilot questions, strategy, documents), plus token handling and readable
 * error messages. Pages call these functions instead of using axios directly.
 */
import axios, { AxiosError } from "axios";
import type {
  AppAlert,
  AskResponse,
  ChatTurn,
  Holding,
  ImportRow,
  JournalEntry,
  OtherAsset,
  Profile,
  RiskTolerance,
  TrackRecordCall,
  PortfolioStrategy,
  PortfolioSummary,
  StoredDocument,
} from "./types";
import { clearSessionStore } from "./sessionStore";

// Set NEXT_PUBLIC_API_URL in .env.local (or the deploy environment) to point at the backend
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

const api = axios.create({ baseURL: API_URL });

/** The saved login token, or null (also when storage is unavailable). */
export function getToken(): string | null {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

/** Signs out: forgets the token and session data, then returns to the landing page. */
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
/** POST /auth/login — returns { access_token }. */
export const login = async (email: string, password: string) => {
  const response = await api.post<{ access_token: string }>("/auth/login", { email, password });
  return response.data;
};

/** POST /auth/signup — creates the account and returns { access_token }. */
export const signup = async (email: string, password: string) => {
  const response = await api.post<{ access_token: string }>("/auth/signup", { email, password });
  return response.data;
};

/** GET /auth/me — the signed-in user's profile. */
export const getMe = async () => {
  const response = await api.get("/auth/me");
  return response.data;
};

// Portfolio
/** GET /portfolio/summary — holdings with live prices, weights and total value. */
export const getPortfolioSummary = async () => {
  const response = await api.get<PortfolioSummary>("/portfolio/summary");
  return response.data;
};

/** GET /portfolio/holdings — stored holdings without prices. */
export const getHoldings = async () => {
  const response = await api.get<Holding[]>("/portfolio/holdings");
  return response.data;
};

/** POST /portfolio/holdings — adds a holding. */
export const addHolding = async (data: {
  ticker: string;
  quantity: number;
  cost_basis: number | null;
  account_type: string;
}) => {
  const response = await api.post("/portfolio/holdings", data);
  return response.data;
};

/** DELETE /portfolio/holdings/:id — removes a holding. */
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

/** GET /decisions/portfolio-strategy — AI strategy for every position (10–20 s). */
export const getPortfolioStrategy = async () => {
  const response = await api.get<PortfolioStrategy>("/decisions/portfolio-strategy");
  return response.data;
};

/** GET /decisions/journal — past recommendations (audit trail). */
export const getJournal = async () => {
  const response = await api.get<JournalEntry[]>("/decisions/journal");
  return response.data;
};

// Documents
/** GET /documents/ — the user's uploaded documents. */
export const listDocuments = async () => {
  const response = await api.get<{ documents: StoredDocument[] }>("/documents/");
  return response.data.documents;
};

/** POST /documents/upload — uploads a PDF/TXT/CSV file. */
export const uploadDocument = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<StoredDocument>("/documents/upload", formData);
  return response.data;
};

/** DELETE /documents/:id — removes a document. */
export const deleteDocument = async (documentId: string) => {
  await api.delete(`/documents/${documentId}`);
};

/** POST /portfolio/import/preview — holdings read from a brokerage CSV/PDF, not yet saved. */
export const previewImport = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<{ holdings: ImportRow[]; method: "csv" | "ai" }>("/portfolio/import/preview", formData);
  return response.data;
};

/** POST /portfolio/import — saves confirmed holdings; `replace` removes the existing ones first. */
export const confirmImport = async (holdings: ImportRow[], replace: boolean) => {
  const response = await api.post<{ imported: number }>("/portfolio/import", { holdings, replace });
  return response.data;
};

// Profile and other assets
/** GET /profile — risk tolerance, horizon and position limit (defaults until saved). */
export const getProfile = async () => (await api.get<Profile>("/profile")).data;

/** PUT /profile — saves the profile and returns it with the derived limits. */
export const saveProfile = async (data: { risk_tolerance: RiskTolerance; horizon_years: number | null; max_position_pct: number }) =>
  (await api.put<Profile>("/profile", data)).data;

/** GET /assets — other assets and their total. */
export const listAssets = async () => (await api.get<{ assets: OtherAsset[]; total: number }>("/assets")).data;

/** POST /assets — adds an asset. */
export const addAsset = async (data: Omit<OtherAsset, "id">) => (await api.post<OtherAsset>("/assets", data)).data;

/** DELETE /assets/:id — removes an asset. */
export const deleteAsset = async (assetId: string) => {
  await api.delete(`/assets/${assetId}`);
};

// Alerts and track record
/** GET /alerts — newest alerts and unread count; `refresh` runs the market checks if due. */
export const getAlerts = async (refresh = true) =>
  (await api.get<{ alerts: AppAlert[]; unread: number }>("/alerts", { params: { refresh } })).data;

/** POST /alerts/:id/read, or /alerts/read for all of them. */
export const markAlertsRead = async (alertId?: string) => {
  await api.post(alertId ? `/alerts/${alertId}/read` : "/alerts/read");
};

/** GET /decisions/track-record — past calls with the price then and now. */
export const getTrackRecord = async () => (await api.get<{ calls: TrackRecordCall[] }>("/decisions/track-record")).data.calls;
