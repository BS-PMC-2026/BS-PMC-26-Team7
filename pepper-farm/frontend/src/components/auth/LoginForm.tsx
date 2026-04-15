"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, ROLE_ROUTES } from "@/lib/constants";

interface FormData {
  email:    string;
  password: string;
}

export default function LoginForm() {
  const router = useRouter();

  const [form,    setForm]    = useState<FormData>({ email: "", password: "" });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.email || !form.password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail ?? "Login failed.");
        return;
      }

      localStorage.setItem("token",    data.accessToken);
      localStorage.setItem("role",     data.role);
      localStorage.setItem("fullName", data.fullName);

      document.cookie = `token=${data.accessToken}; path=/; max-age=3600`;
      document.cookie = `role=${data.role}; path=/; max-age=3600`;

      const route = ROLE_ROUTES[data.role] ?? "/visitor";
      router.push(route);

    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl shadow p-8 w-full max-w-sm flex flex-col gap-4"
    >
      <h2 className="text-2xl font-bold text-center text-gray-800">Welcome Back</h2>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Email</label>
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="your@email.com"
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Password</label>
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Your password"
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition"
      >
        {loading ? "Logging in..." : "Login"}
      </button>

      <p className="text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <a href="/register" className="text-green-600 hover:underline">Register</a>
      </p>
    </form>
  );
}