import { API_URL } from "@/lib/constants";

export interface UserData {
  userId:   number;
  fullName: string;
  email:    string;
  roleName: string;
  isActive: boolean;
}

export async function getAllUsers(token: string): Promise<UserData[]> {
  const res = await fetch(`${API_URL}/api/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? "Failed to fetch users.");
  return json;
}

export async function promoteUser(token: string, userId: number, roleId: number): Promise<UserData> {
  const res = await fetch(`${API_URL}/api/users/${userId}/role`, {
    method:  "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${token}`,
    },
    body: JSON.stringify({ roleId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? "Failed to promote user.");
  return json;
}

export async function searchUsers(token: string, name: string): Promise<UserData[]> {
  const res = await fetch(`${API_URL}/api/users/search?name=${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? "Failed to search users.");
  return json;
}