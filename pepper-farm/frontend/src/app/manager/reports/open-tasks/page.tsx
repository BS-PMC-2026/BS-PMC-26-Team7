'use client';

import { useState, useEffect } from 'react';
import { getTasksReportByWorker } from '@/services/tasks';
import { getAllUsers, UserData } from '@/services/users';
import { Task } from '@/types/task';
import { useLanguage } from '@/context/LanguageContext';
import { translateEnum } from '@/i18n/dictionaries';

const PRIORITY_COLORS: Record<string, string> = {
  low:      'bg-gray-100 text-gray-600',
  medium:   'bg-yellow-100 text-yellow-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<string, string> = {
  todo:        'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
};

export default function TasksReportPage() {
  const { t } = useLanguage();
  const tk = t.tasks;
  const [tasks,           setTasks]           = useState<Task[]>([]);
  const [workers,         setWorkers]         = useState<UserData[]>([]);
  const [selectedWorker,  setSelectedWorker]  = useState<number | "">("");
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  const token = typeof window !== "undefined"
    ? localStorage.getItem("token") ?? ""
    : "";

  useEffect(() => {
    getAllUsers(token)
      .then(users => setWorkers(users.filter(u => u.roleName === "Worker")))
      .catch(() => setError(tk.failedToLoadWorkers));
  }, [token, tk.failedToLoadWorkers]);

  const handleSearch = async () => {
    if (!selectedWorker) {
      setError(tk.pleaseSelectWorker);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getTasksReportByWorker(token, Number(selectedWorker));
      setTasks(data);
    } catch {
      setError(tk.failedToLoadReport);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold text-gray-800">{tk.openTasksTitle}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {tk.openTasksSubtitle}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Worker selector */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6 flex items-center gap-4 flex-wrap">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            {tk.selectWorker}
          </label>
          <select
            value={selectedWorker}
            onChange={e => setSelectedWorker(e.target.value === "" ? "" : Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 w-64"
          >
            <option value="">{tk.chooseWorker}</option>
            {workers.map(w => (
              <option key={w.userId} value={w.userId}>
                👤 {w.fullName}
              </option>
            ))}
          </select>
          <button
            onClick={handleSearch}
            disabled={!selectedWorker || loading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
          >
            {loading ? t.common.loading : tk.showReport}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm mb-4">
            {error}
          </div>
        )}

        {tasks.length > 0 && (
          <>
            <p className="text-xs text-gray-400 mb-4" dir="ltr">{tasks.length} {tk.openTasksCount}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse bg-white rounded-xl shadow">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="px-4 py-3 border-b">{tk.titleCol}</th>
                    <th className="px-4 py-3 border-b">{tk.typeCol}</th>
                    <th className="px-4 py-3 border-b">{tk.priorityCol}</th>
                    <th className="px-4 py-3 border-b">{tk.statusCol}</th>
                    <th className="px-4 py-3 border-b">{tk.dueDateCol}</th>
                    <th className="px-4 py-3 border-b">{tk.zoneCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(task => (
                    <tr key={task.id} className="hover:bg-gray-50 border-b">
                      <td className="px-4 py-3 font-medium text-gray-800">{task.title}</td>
                      <td className="px-4 py-3 text-gray-500">{translateEnum(task.taskType, t.enums.taskType)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[task.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                          {translateEnum(task.priority, t.enums.priority)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {translateEnum(task.status, t.enums.taskStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500" dir="ltr">
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500" dir="ltr">
                        {task.zoneCode ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && tasks.length === 0 && selectedWorker && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <p className="text-green-700 font-medium">{tk.noOpenTasks}</p>
          </div>
        )}
      </div>
    </main>
  );
}
