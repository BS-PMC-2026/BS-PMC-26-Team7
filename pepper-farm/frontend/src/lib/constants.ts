export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const API_URL = API_BASE_URL;

export const ROLE_ROUTES: Record<string, string> = {
  FarmManager: "/manager",
  Worker:      "/worker",
  Visitor:     "/visitor",
};