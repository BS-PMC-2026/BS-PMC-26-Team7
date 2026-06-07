'use client';

import LoginForm from "@/components/auth/LoginForm";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/context/LanguageContext";

export default function LoginPage() {
  const { locale } = useLanguage();
  return (
    <main className="app-page-bg flex flex-col items-center justify-center relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-green-700">🌶️ {locale === 'he' ? 'הדינרים' : 'Hadinerim'}</h1>
      </div>
      <LoginForm />
    </main>
  );
}
