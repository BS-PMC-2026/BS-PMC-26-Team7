import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50">

      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-green-700 mb-2">🌶️ PepperFarm</h1>
        <p className="text-gray-500 text-lg">Farm Management System</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Link
          href="/register"
          className="bg-green-600 text-white text-center py-3 rounded-lg text-lg font-medium hover:bg-green-700 transition"
        >
          Register
        </Link>

        <Link
          href="/login"
          className="border border-green-600 text-green-700 text-center py-3 rounded-lg text-lg font-medium hover:bg-green-50 transition"
        >
          Login
        </Link>
      </div>

    </main>
  );
}