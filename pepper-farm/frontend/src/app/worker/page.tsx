'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import FarmMap, { type FarmSection } from '@/components/map/FarmMap';
import TaskFilters from '@/components/tasks/TaskFilters';
import TaskList from '@/components/tasks/TaskList';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import { Task, TaskStatus } from '@/types/task';
import { getMyTasks, updateTask } from '@/services/tasks';
import { getAllPlants, PlantData, createPlant } from '@/services/plants';
import { getAllPeppers } from '@/services/peppers';
import { Pepper } from '@/types/pepper';
import { EMPTY_TASK_FILTERS, filterTasks, type TaskFilters as TaskFilterState } from '@/components/tasks/filterTasks';
import { PRIORITY_BADGE_STYLES, PRIORITY_POPUP_STYLES } from '@/components/tasks/taskOptions';

const ZONE_CODE_TO_ID: Record<string, number> = {
  'GH-01': 1,  'GH-02': 2,  'GH-03': 3,  'GH-04': 4,
  'GH-05': 5,  'GH-06': 6,  'GH-07': 7,  'GH-08': 8,
  'NURSERY': 9, 'SHED-MAIN': 10, 'GH-09': 11, 'GH-10': 12,
  'GERM-01': 13, 'GERM-02': 14, 'VIS-CENTER': 15,
  'GERM-03': 16, 'GERM-04': 17, 'FACTORY': 18,
};

export default function WorkerPage() {
  const router = useRouter();
  const [tasks,            setTasks]            = useState<Task[]>([]);
  const [plants,           setPlants]           = useState<PlantData[]>([]);
  const [peppers,          setPeppers]          = useState<Pepper[]>([]);
  const [selectedPepper,   setSelectedPepper]   = useState<number | "">("");
  const [isLoading,        setIsLoading]        = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [mapMessage,       setMapMessage]       = useState<{ text: string; ok: boolean } | null>(null);
  const [saving,           setSaving]           = useState(false);
  const [activeTaskDetail, setActiveTaskDetail] = useState<Task | null>(null);
  const [taskFilters,      setTaskFilters]      = useState<TaskFilterState>(EMPTY_TASK_FILTERS);

  const loadData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [data, plantsData, peppersData] = await Promise.all([
        getMyTasks(token),
        getAllPlants(token),
        getAllPeppers(),
      ]);
      setTasks(data);
      setPlants(plantsData);
      setPeppers(peppersData);
    } catch {
      setError('Failed to load data. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    const token = localStorage.getItem('token') ?? '';
    try {
      const updated = await updateTask(task.id, { status: newStatus }, token);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      setError('Failed to update task status.');
    }
  };

  const handleAssignToZone = async (section: FarmSection) => {
    if (!selectedPepper) {
      setMapMessage({ text: "Please select a pepper first.", ok: false });
      return;
    }
    const token = localStorage.getItem('token') ?? '';
    setSaving(true);
    setMapMessage(null);
    try {
      const zoneId = ZONE_CODE_TO_ID[section.id];
      const pepper = peppers.find(p => p.PepperId === Number(selectedPepper));
      const plantCode = `${pepper?.PepperName?.replace(/\s+/g, '-').toUpperCase() ?? 'PLANT'}-${section.id}-${Date.now()}`;
      await createPlant({
        PlantCode: plantCode,
        PepperId:  Number(selectedPepper),
        ZoneId:    zoneId ?? null,
        Status:    'Growing',
        IsActive:  true,
      });
      setMapMessage({ text: `${pepper?.PepperName} assigned to ${section.name} successfully.`, ok: true });
      setSelectedPepper("");
      const updated = await getAllPlants(token);
      setPlants(updated);
    } catch (err: unknown) {
      setMapMessage({ text: err instanceof Error ? err.message : "Failed to assign.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const filteredTasks = useMemo(() => filterTasks(tasks, taskFilters), [tasks, taskFilters]);

  const openTaskZones = new Set(
    filteredTasks
      .filter((t) => (t.status === 'todo' || t.status === 'in_progress') && t.zoneCode)
      .map((t) => t.zoneCode as string)
  );

  const sectionColors: Record<string, string> = {};
  for (const code of openTaskZones) {
    sectionColors[code] = '#fca5a5';
  }

  const renderPopupExtra = (section: FarmSection) => {
    const zoneTasks = filteredTasks.filter(
      (t) => t.zoneCode === section.id && (t.status === 'todo' || t.status === 'in_progress')
    );
    const hasOpenTask = zoneTasks.length > 0;

    return (
      <div className="mt-3 mb-1 flex flex-col gap-2">
        {hasOpenTask ? (
          <div className="flex flex-col gap-2">
            {zoneTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => setActiveTaskDetail(task)}
                className={`flex items-center gap-2 w-full text-right px-3 py-2 rounded shadow-sm transition-colors ${PRIORITY_POPUP_STYLES[task.priority]}`}
              >
                <span className="font-bold text-base shrink-0">✗</span>
                <span className="text-sm font-semibold truncate flex-1">{task.title}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
            <span className="text-green-500 font-bold text-base">✓</span>
            <span className="text-sm text-green-700">אין משימות פתוחות באזור זה</span>
          </div>
        )}

        {/* Assign pepper */}
        <div className="border-t border-gray-100 pt-2">
          <button
            onClick={() => handleAssignToZone(section)}
            disabled={!selectedPepper || saving}
            className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
          >
            {saving ? "Planting..." : selectedPepper ? "Plant here 🌱" : "Select a pepper first"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <PageHeader
            label="Worker"
            title="My Dashboard"
            subtitle="Your tasks and farm map — red zones have open tasks assigned to you"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">
        {error && <Alert>{error}</Alert>}

        {/* Map */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Farm Map</h2>

          {/* Pepper selector */}
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Select Pepper:
            </label>
            <select
              value={selectedPepper}
              onChange={e => setSelectedPepper(e.target.value === "" ? "" : Number(e.target.value))}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 w-64"
            >
              <option value="">-- Choose a pepper --</option>
              {peppers.map(p => (
                <option key={p.PepperId} value={p.PepperId}>
                  🌶️ {p.PepperName}
                </option>
              ))}
            </select>
            {selectedPepper && (
              <span className="text-sm text-green-600 font-medium">
                ✅ Now click a zone on the map to plant it
              </span>
            )}
          </div>

          {mapMessage && (
            <div className={`rounded-lg px-4 py-2 text-sm mb-4 ${
              mapMessage.ok
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-600"
            }`}>
              {mapMessage.text}
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-gray-400 py-8 text-center">Loading map...</p>
          ) : (
            <FarmMap
              sectionColors={sectionColors}
              renderPopupExtra={renderPopupExtra}
              plants={plants}
            />
          )}
        </div>

        {/* Task list */}
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-4">My Tasks</h2>
          {!isLoading && tasks.length > 0 && (
            <TaskFilters
              className="mb-4"
              priority={taskFilters.priority}
              taskType={taskFilters.taskType}
              totalCount={tasks.length}
              resultCount={filteredTasks.length}
              onPriorityChange={(priority) => setTaskFilters((prev) => ({ ...prev, priority }))}
              onTaskTypeChange={(taskType) => setTaskFilters((prev) => ({ ...prev, taskType }))}
              onClear={() => setTaskFilters(EMPTY_TASK_FILTERS)}
            />
          )}
          {isLoading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No tasks assigned to you.</p>
          ) : filteredTasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No tasks match these filters.</p>
          ) : (
            <TaskList tasks={filteredTasks} onStatusChange={handleStatusChange} />
          )}
        </div>
      </div>

      {/* Task detail sub-popup */}
      {activeTaskDetail && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setActiveTaskDetail(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveTaskDetail(null)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 text-lg"
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pr-8">{activeTaskDetail.title}</h3>
            <div className="flex flex-col gap-3 text-sm">
              {activeTaskDetail.description && (
                <p className="text-gray-600">{activeTaskDetail.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_BADGE_STYLES[activeTaskDetail.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                  {activeTaskDetail.priority}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                  {activeTaskDetail.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex flex-col gap-1 text-xs text-gray-500">
                <span>Type: <span className="text-gray-700 font-medium">{activeTaskDetail.taskType}</span></span>
                {activeTaskDetail.dueDate && (
                  <span>Due: <span className="text-gray-700 font-medium">{new Date(activeTaskDetail.dueDate).toLocaleDateString()}</span></span>
                )}
                {activeTaskDetail.zoneCode && (
                  <span>Zone: <span className="text-gray-700 font-medium">{activeTaskDetail.zoneCode}</span></span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}