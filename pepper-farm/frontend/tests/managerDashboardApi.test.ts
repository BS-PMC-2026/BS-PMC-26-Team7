import { getManagerDashboardData } from '@/lib/managerDashboardApi';
import { getAnomalySummary, getZoneHealth } from '@/services/anomalies';
import { getInventoryList } from '@/services/inventory';
import { getAllPlants } from '@/services/plants';
import { getLatestSensorReading, getSensors } from '@/services/sensors';
import { getTasks } from '@/services/tasks';
import { getAllUsers } from '@/services/users';

jest.mock('@/services/anomalies', () => ({
  getAnomalySummary: jest.fn(),
  getZoneHealth: jest.fn(),
}));

jest.mock('@/services/inventory', () => ({
  getInventoryList: jest.fn(),
}));

jest.mock('@/services/plants', () => ({
  getAllPlants: jest.fn(),
}));

jest.mock('@/services/sensors', () => ({
  getSensors: jest.fn(),
  getLatestSensorReading: jest.fn(),
}));

jest.mock('@/services/tasks', () => ({
  getTasks: jest.fn(),
}));

jest.mock('@/services/users', () => ({
  getAllUsers: jest.fn(),
}));

const mockTask = {
  id: 1,
  title: 'Inspect GH-01',
  description: null,
  status: 'todo',
  priority: 'high',
  taskType: 'inspection',
  createdByUserId: 1,
  assignedToUserId: 2,
  dueDate: '2026-05-20',
  startedAt: null,
  completedAt: null,
  pepperId: null,
  zoneId: 1,
  zoneCode: 'GH-01',
  anomalyId: null,
  alertInfo: null,
  createdAt: '2026-05-17T00:00:00',
  updatedAt: '2026-05-17T00:00:00',
};

describe('managerDashboardApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getTasks as jest.Mock).mockResolvedValue([mockTask]);
    (getAllUsers as jest.Mock).mockResolvedValue([{ userId: 2, fullName: 'Field Worker', email: 'worker@example.com', roleName: 'Worker', isActive: true }]);
    (getInventoryList as jest.Mock).mockResolvedValue([{ InventoryId: 1, ProductId: 1, ProductName: 'Pepper Box', ItemName: null, DisplayName: 'Pepper Box', Location: null, WarehouseQuantity: 4, AllocatedQuantity: 1, LastUpdatedAt: '2026-05-17T00:00:00' }]);
    (getAllPlants as jest.Mock).mockResolvedValue([{ PlantId: 1, PlantCode: 'P-1', PepperId: 1, ZoneId: 1, Status: 'Growing', IsActive: true }]);
    (getAnomalySummary as jest.Mock).mockResolvedValue({ activeAlerts: 3, highSeverity: 1, affectedZones: 2, latestReadingUtc: '2026-05-17T10:00:00Z' });
    (getZoneHealth as jest.Mock).mockResolvedValue([{ zoneId: 1, zoneName: 'Greenhouse 1', zoneCode: 'GH-01', totalAlerts: 3, highAlerts: 1, health: 'high' }]);
    (getSensors as jest.Mock).mockResolvedValue([
      { SensorId: 10, MacAddress: 'AA', IsActive: true },
      { SensorId: 11, MacAddress: 'BB', IsActive: false },
    ]);
    (getLatestSensorReading as jest.Mock).mockResolvedValue({ ReadingId: 99, SensorId: 10, MacAddress: 'AA', Temperature: 24.5, Humidity: 60, SampleTimeUtc: '2026-05-17T10:00:00' });
  });

  it('combines dashboard data from existing services', async () => {
    const result = await getManagerDashboardData('token-123');

    expect(result.tasks).toEqual([mockTask]);
    expect(result.users[0].fullName).toBe('Field Worker');
    expect(result.inventory[0].DisplayName).toBe('Pepper Box');
    expect(result.plants[0].PlantCode).toBe('P-1');
    expect(result.anomalySummary?.activeAlerts).toBe(3);
    expect(result.zoneHealth[0].zoneCode).toBe('GH-01');
    expect(result.latestReadings[0].Temperature).toBe(24.5);
    expect(getAllUsers).toHaveBeenCalledWith('token-123');
    expect(getAllPlants).toHaveBeenCalledWith('token-123');
    expect(getLatestSensorReading).toHaveBeenCalledWith(10);
    expect(getLatestSensorReading).not.toHaveBeenCalledWith(11);
  });

  it('returns safe empty fallbacks when optional services fail', async () => {
    (getInventoryList as jest.Mock).mockRejectedValueOnce(new Error('inventory unavailable'));
    (getAnomalySummary as jest.Mock).mockRejectedValueOnce(new Error('summary unavailable'));
    (getSensors as jest.Mock).mockRejectedValueOnce(new Error('sensors unavailable'));

    const result = await getManagerDashboardData('token-123');

    expect(result.tasks).toEqual([mockTask]);
    expect(result.inventory).toEqual([]);
    expect(result.anomalySummary).toBeNull();
    expect(result.latestReadings).toEqual([]);
  });
});
