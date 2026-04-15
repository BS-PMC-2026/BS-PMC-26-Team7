import { API_URL } from "@/lib/constants";

export interface RegisterData {
  fullName: string;
  email:    string;
  password: string;
}

export interface RegisterResponse {
  userId:   number;
  fullName: string;
  email:    string;
  role:     string;
}

export interface LoginData {
  email:    string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType:   string;
  role:        string;
  fullName:    string;
}

export async function registerUser(data: RegisterData): Promise<RegisterResponse> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? "Registration failed.");
  return json;
}

export async function loginUser(data: LoginData): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? "Login failed.");
  return json;
}