'use client';

import { ClipboardCheck, ClipboardList } from 'lucide-react';

export default function TasksTabBar({ activeTab, onTabChange }: { activeTab: string; onTabChange: (t: string) => void }) {
  const tabs = [
    { id: 'active', label: 'Active Tasks', icon: <ClipboardList size={14} /> },
    { id: 'history', label: 'History', icon: <ClipboardCheck size={14} /> },
  ];
  return (
    <div className="border-b border-[var(--color-border)]/60">
      <div className="max-w-7xl mx-auto px-6 flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-[var(--color-border)]'
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
