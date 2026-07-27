import axios from "axios";

const API_URL = "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
});

// Automatically add token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = async (email: string, password: string) => {
  const response = await api.post("/auth/login", { email, password });
  return response.data;
};

export const getMe = async () => {
  const response = await api.get("/auth/me");
  return response.data;
};

// Portfolio
export const getPortfolioSummary = async () => {
  const response = await api.get("/portfolio/summary");
  return response.data;
};

export const getHoldings = async () => {
  const response = await api.get("/portfolio/holdings");
  return response.data;
};

export const addHolding = async (data: {
  ticker: string;
  quantity: number;
  cost_basis: number;
  account_type: string;
}) => {
  const response = await api.post("/portfolio/holdings", data);
  return response.data;
};

// Decisions
export const submitDecision = async (query: string, ticker: string) => {
  const response = await api.post("/decisions/query", { query, ticker });
  return response.data;
};

export const getJournal = async () => {
  const response = await api.get("/decisions/journal");
  return response.data;
};