import { apiFetch } from "./apiClient";

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
  return apiFetch<RegisterResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function loginUser(data: LoginData): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
