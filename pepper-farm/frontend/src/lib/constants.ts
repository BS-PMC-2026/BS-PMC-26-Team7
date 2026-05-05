export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const ROLE_ROUTES: Record<string, string> = {
  FarmManager: "/manager",
  Worker:      "/worker",
  Visitor:     "/visitor",
};