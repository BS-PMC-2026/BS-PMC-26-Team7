import LoginForm from "@/components/auth/LoginForm";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-green-700">🌶️ PepperFarm</h1>
      </div>
      <LoginForm />
    </main>
  );
}