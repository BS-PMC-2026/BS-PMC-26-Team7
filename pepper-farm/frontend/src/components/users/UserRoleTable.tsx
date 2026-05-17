"use client";

import { useState, useEffect, useCallback } from "react";
import { getAllUsers, promoteUser, searchUsers, UserData } from "@/services/users";

const WORKER_ROLE_ID = 3;
const VISITOR_ROLE_ID = 4;

export default function UserRoleTable() {
  const [users,     setUsers]     = useState<UserData[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [message,   setMessage]   = useState<{ text: string; ok: boolean } | null>(null);
  const [promoting, setPromoting] = useState<number | null>(null);

  const token = typeof window !== "undefined"
    ? localStorage.getItem("token") ?? ""
    : "";

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllUsers(token);
      setUsers(data);
    } catch {
      setMessage({ text: "Failed to load users.", ok: false });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (val.trim() === "") {
      loadUsers();
      return;
    }
    try {
      const data = await searchUsers(token, val);
      setUsers(data);
    } catch {
      setMessage({ text: "Search failed.", ok: false });
    }
  };

  const handlePromote = async (userId: number) => {
    const confirmed = window.confirm("Are you sure you want to promote this user to Employee?");
    if (!confirmed) {
      return;
    }
    setPromoting(userId);
    setMessage(null);
    try {
      const updated = await promoteUser(token, userId, WORKER_ROLE_ID);
      setUsers(prev =>
        prev.map(u => u.userId === userId ? { ...u, roleName: updated.roleName } : u)
      );
      setMessage({ text: "User promoted to Worker successfully.", ok: true });
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : "Promotion failed.", ok: false });
    } finally {
      setPromoting(null);
    }
  };

  const handleRevoke = async (userId: number) => {
    const confirmed = window.confirm("Are you sure you want to revoke this employee's permissions?");
    if (!confirmed) {
      return;
    }
  setPromoting(userId);
  setMessage(null);

  try {
    const updated = await promoteUser(token, userId, VISITOR_ROLE_ID);

    setUsers(prev =>
      prev.map(u => u.userId === userId ? { ...u, roleName: updated.roleName } : u)
    );

    setMessage({ text: "Employee role revoked successfully.", ok: true });
  } catch (err: unknown) {
    setMessage({ text: err instanceof Error ? err.message : "Revoke failed.", ok: false });
  } finally {
    setPromoting(null);
  }
};

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        value={search}
        onChange={handleSearch}
        placeholder="Search by name..."
        className="border rounded-lg px-3 py-2 text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-green-400"
      />

      {message && (
        <div className={`rounded-lg px-4 py-2 text-sm ${
          message.ok
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-600"
        }`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading users...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-400">No users found.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="px-4 py-2 border-b">Full Name</th>
              <th className="px-4 py-2 border-b">Email</th>
              <th className="px-4 py-2 border-b">Role</th>
              <th className="px-4 py-2 border-b">Status</th>
              <th className="px-4 py-2 border-b">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.userId} className="hover:bg-gray-50 border-b">
                <td className="px-4 py-2">{user.fullName}</td>
                <td className="px-4 py-2 text-gray-500">{user.email}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.roleName === "FarmManager"
                      ? "bg-purple-100 text-purple-700"
                      : user.roleName === "Worker"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {user.roleName}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className={`text-xs ${user.isActive ? "text-green-600" : "text-red-500"}`}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {user.roleName === "Visitor" && (
                    <button
                      onClick={() => handlePromote(user.userId)}
                      disabled={promoting === user.userId}
                      className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition"
                    >
                      {promoting === user.userId ? "Promoting..." : "Promote to Employee"}
                    </button>
                  )}
                  {user.roleName === "Worker" && (
                    <button
                    onClick={() => handleRevoke(user.userId)}
                    disabled={promoting === user.userId}
                    className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition"
                    >
                      {promoting === user.userId ? "Updating..." : "Revoke Employee"}
                      </button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}