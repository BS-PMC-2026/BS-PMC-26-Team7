"use client";

import { useState, useEffect, useCallback } from "react";
import { getAllUsers, promoteUser, searchUsers, UserData } from "@/services/users";
import { useLanguage } from "@/context/LanguageContext";
import { translateEnum } from "@/i18n/dictionaries";

const WORKER_ROLE_ID  = 3;
const VISITOR_ROLE_ID = 4;

export default function UserRoleTable() {
  const { t } = useLanguage();
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
      setMessage({ text: t.users.failedToLoad, ok: false });
    } finally {
      setLoading(false);
    }
  }, [token, t.users.failedToLoad]);

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
      setMessage({ text: t.users.searchFailed, ok: false });
    }
  };

  const handlePromote = async (userId: number) => {
    const confirmed = window.confirm(t.users.confirmPromote);
    if (!confirmed) return;
    setPromoting(userId);
    setMessage(null);
    try {
      const updated = await promoteUser(token, userId, WORKER_ROLE_ID);
      setUsers(prev => prev.map(u => u.userId === userId ? { ...u, roleName: updated.roleName } : u));
      setMessage({ text: t.users.promotedSuccessfully, ok: true });
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : t.users.promotionFailed, ok: false });
    } finally {
      setPromoting(null);
    }
  };

  const handleRevoke = async (userId: number) => {
    const confirmed = window.confirm(t.users.confirmRevoke);
    if (!confirmed) return;
    setPromoting(userId);
    setMessage(null);
    try {
      const updated = await promoteUser(token, userId, VISITOR_ROLE_ID);
      setUsers(prev => prev.map(u => u.userId === userId ? { ...u, roleName: updated.roleName } : u));
      setMessage({ text: t.users.revokedSuccessfully, ok: true });
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : t.users.revokeFailed, ok: false });
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
        placeholder={t.users.searchPlaceholder}
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
        <p className="text-sm text-gray-400">{t.users.loadingUsers}</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-400">{t.users.noUsersFound}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-4 py-2 border-b">{t.users.fullName}</th>
                <th className="px-4 py-2 border-b">{t.users.email}</th>
                <th className="px-4 py-2 border-b">{t.users.role}</th>
                <th className="px-4 py-2 border-b">{t.users.status}</th>
                <th className="px-4 py-2 border-b">{t.users.action}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.userId} className="hover:bg-gray-50 border-b">
                  <td className="px-4 py-2">{user.fullName}</td>
                  <td className="px-4 py-2 text-gray-500" dir="ltr">{user.email}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.roleName === "FarmManager"
                        ? "bg-purple-100 text-purple-700"
                        : user.roleName === "Worker"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {translateEnum(user.roleName, t.enums.roles)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs ${user.isActive ? "text-green-600" : "text-red-500"}`}>
                      {user.isActive ? t.common.active : t.common.inactive}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {user.roleName === "Visitor" && (
                      <button
                        onClick={() => handlePromote(user.userId)}
                        disabled={promoting === user.userId}
                        className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition"
                      >
                        {promoting === user.userId ? t.users.promoting : t.users.promoteToEmployee}
                      </button>
                    )}
                    {user.roleName === "Worker" && (
                      <button
                        onClick={() => handleRevoke(user.userId)}
                        disabled={promoting === user.userId}
                        className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition"
                      >
                        {promoting === user.userId ? t.users.updating : t.users.revokeEmployee}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
