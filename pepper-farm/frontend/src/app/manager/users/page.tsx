'use client';

import UserRoleTable from "@/components/users/UserRoleTable";
import { useLanguage } from "@/context/LanguageContext";

export default function ManagerUsersPage() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold text-gray-800">{t.manager.userManagement}</h1>
          <p className="text-gray-500 text-sm mt-1">{t.manager.userManagementSub}</p>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <UserRoleTable />
      </div>
    </main>
  );
}
