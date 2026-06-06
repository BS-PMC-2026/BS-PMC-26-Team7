import RegisterForm from "@/components/auth/RegisterForm";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function RegisterPage() {
  return (
    <main className="app-page-bg flex flex-col items-center justify-center relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-green-700">🌶️ PepperFarm</h1>
      </div>
      <RegisterForm />
    </main>
  );
}
