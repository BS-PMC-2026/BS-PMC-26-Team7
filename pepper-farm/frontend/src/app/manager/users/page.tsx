'use client';

import UserRoleTable from "@/components/users/UserRoleTable";
import { useLanguage } from "@/context/LanguageContext";

export default function ManagerUsersPage() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen">
      <div className="border-b border-[var(--color-border)]/60">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t.manager.userManagement}</h1>
          <p className="text-[var(--color-muted-foreground)] text-sm mt-1">{t.manager.userManagementSub}</p>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <UserRoleTable />
      </div>
    </main>
  );
}
