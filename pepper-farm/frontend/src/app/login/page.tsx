import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-green-700">🌶️ PepperFarm</h1>
      </div>
      <LoginForm />
    </main>
  );
}