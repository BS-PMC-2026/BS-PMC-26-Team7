"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/constants";

interface FormData {
  fullName: string;
  email:    string;
  password: string;
}

interface FieldErrors {
  fullName?: string;
  email?:    string;
  password?: string;
}

export default function RegisterForm() {
  const router = useRouter();

  const [form,     setForm]     = useState<FormData>({ fullName: "", email: "", password: "" });
  const [errors,   setErrors]   = useState<FieldErrors>({});
  const [apiError, setApiError] = useState("");
  const [success,  setSuccess]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  const validate = (): boolean => {
    const e: FieldErrors = {};
    if (!form.fullName.trim())
      e.fullName = "Full name is required.";
    if (!form.email.includes("@"))
      e.email = "Valid email is required.";
    if (form.password.length < 6)
      e.password = "Password must be at least 6 characters.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
    setApiError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setApiError(data.detail ?? "Registration failed.");
        return;
      }

      setSuccess(true);

    } catch {
      setApiError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm text-center">
        <div className="text-4xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-green-700 mb-2">Registration Successful!</h2>
        <p className="text-gray-500 mb-6">
          Your account has been created as a <strong>Visitor</strong>.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="bg-green-600 text-white w-full py-2 rounded-lg hover:bg-green-700 transition"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl shadow p-8 w-full max-w-sm flex flex-col gap-4"
    >
      <h2 className="text-2xl font-bold text-center text-gray-800">Create Account</h2>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Full Name</label>
        <input
          name="fullName"
          type="text"
          value={form.fullName}
          onChange={handleChange}
          placeholder="Your full name"
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        {errors.fullName && (
          <span className="text-red-500 text-xs">{errors.fullName}</span>
        )}
      </div>

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
        {errors.email && (
          <span className="text-red-500 text-xs">{errors.email}</span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Password</label>
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Min. 6 characters"
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        {errors.password && (
          <span className="text-red-500 text-xs">{errors.password}</span>
        )}
      </div>

      {apiError && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2 text-sm">
          {apiError}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition"
      >
        {loading ? "Registering..." : "Register"}
      </button>

      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <a href="/login" className="text-green-600 hover:underline">Login</a>
      </p>
    </form>
  );
}