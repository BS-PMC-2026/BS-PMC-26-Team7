import { getAnomalySummary, getZoneHealth } from '@/services/anomalies';
import { getInventoryList } from '@/services/inventory';
import { getAllPlants, PlantData } from '@/services/plants';
import { getLatestSensorReading, getSensors } from '@/services/sensors';
import { getTasks } from '@/services/tasks';
import { getAllUsers, UserData } from '@/services/users';
import { AnomalySummary, ZoneHealth } from '@/types/anomaly';
import { InventoryResponse } from '@/types/inventory';
import { SensorReading } from '@/types/sensor';
import { Task } from '@/types/task';

export interface ManagerDashboardData {
  tasks: Task[];
  users: UserData[];
  inventory: InventoryResponse[];
  plants: PlantData[];
  anomalySummary: AnomalySummary | null;
  zoneHealth: ZoneHealth[];
  latestReadings: SensorReading[];
}

export async function getManagerDashboardData(token: string): Promise<ManagerDashboardData> {
  const [
    tasks,
    users,
    inventory,
    plants,
    anomalySummary,
    zoneHealth,
    sensors,
  ] = await Promise.allSettled([
    getTasks(),
    token ? getAllUsers(token) : Promise.resolve([] as UserData[]),
    getInventoryList(),
    getAllPlants(token),
    getAnomalySummary(),
    getZoneHealth(),
    getSensors(),
  ]);

  const sensorList = sensors.status === 'fulfilled' ? sensors.value : [];
  const readingResults = await Promise.allSettled(
    sensorList
      .filter((sensor) => sensor.IsActive)
      .map((sensor) => getLatestSensorReading(sensor.SensorId)),
  );

  return {
    tasks: tasks.status === 'fulfilled' ? tasks.value : [],
    users: users.status === 'fulfilled' ? users.value : [],
    inventory: inventory.status === 'fulfilled' ? inventory.value : [],
    plants: plants.status === 'fulfilled' ? plants.value : [],
    anomalySummary: anomalySummary.status === 'fulfilled' ? anomalySummary.value : null,
    zoneHealth: zoneHealth.status === 'fulfilled' ? zoneHealth.value : [],
    latestReadings: readingResults
      .filter((result): result is PromiseFulfilledResult<SensorReading | null> => result.status === 'fulfilled')
      .map((result) => result.value)
      .filter((reading): reading is SensorReading => reading !== null),
  };
}
