import { apiFetch } from "./apiClient";

export interface UserData {
  userId:   number;
  fullName: string;
  email:    string;
  roleName: string;
  isActive: boolean;
}

export async function getAllUsers(token: string): Promise<UserData[]> {
  return apiFetch<UserData[]>("/api/users", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function promoteUser(token: string, userId: number, roleId: number): Promise<UserData> {
  return apiFetch<UserData>(`/api/users/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ roleId }),
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function searchUsers(token: string, name: string): Promise<UserData[]> {
  return apiFetch<UserData[]>(`/api/users/search?name=${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
