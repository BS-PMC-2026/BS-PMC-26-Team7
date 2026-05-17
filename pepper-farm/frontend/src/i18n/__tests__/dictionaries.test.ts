import { getDictionary, translateEnum } from '@/i18n/dictionaries';
import type { Locale, Dictionary } from '@/i18n/dictionaries';

const LOCALES: Locale[] = ['en', 'he'];

const REQUIRED_SECTIONS: Array<keyof Dictionary> = [
  'common',
  'nav',
  'auth',
  'enums',
  'manager',
  'tasks',
  'inventory',
  'reports',
  'sensors',
  'anomalies',
];

function getLeafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.keys(obj).flatMap((key) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      return getLeafKeys(val as Record<string, unknown>, fullKey);
    }
    return [fullKey];
  });
}

describe('Dictionaries', () => {
  describe('dictionary existence', () => {
    it.each(LOCALES)('"%s" dictionary exists and is an object', (locale) => {
      const dict = getDictionary(locale);
      expect(dict).toBeDefined();
      expect(typeof dict).toBe('object');
    });
  });

  describe('required top-level sections', () => {
    it.each(LOCALES)('"%s" has all required sections', (locale) => {
      const dict = getDictionary(locale) as unknown as Record<string, unknown>;
      for (const section of REQUIRED_SECTIONS) {
        expect(dict[section]).toBeDefined();
      }
    });
  });

  describe('important keys exist in both languages', () => {
    const importantPaths: string[] = [
      'common.loading',
      'common.save',
      'common.cancel',
      'common.search',
      'nav.dashboard',
      'nav.tasks',
      'nav.inventory',
      'nav.sensors',
      'nav.anomalies',
      'nav.reports',
      'manager.title',
      'manager.userManagement',
      'manager.openTasksReport',
      'tasks.title',
      'tasks.addTask',
      'inventory.title',
      'inventory.addItem',
      'reports.inventoryLabel',
      'sensors.dashboardTitle',
      'anomalies.activeAnomalies',
    ];

    it.each(LOCALES)('"%s" has all important keys defined', (locale) => {
      const dict = getDictionary(locale) as unknown as Record<string, Record<string, unknown>>;
      for (const path of importantPaths) {
        const [section, key] = path.split('.');
        expect(dict[section]).toBeDefined();
        expect(dict[section][key]).toBeDefined();
      }
    });
  });

  describe('key parity between en and he', () => {
    const en = getDictionary('en') as unknown as Record<string, unknown>;
    const he = getDictionary('he') as unknown as Record<string, unknown>;
    const enKeys = getLeafKeys(en);
    const heKeys = getLeafKeys(he);
    const heKeySet = new Set(heKeys);
    const enKeySet = new Set(enKeys);

    it('no key exists in English but is missing in Hebrew', () => {
      const missing = enKeys.filter((k) => !heKeySet.has(k));
      expect(missing).toHaveLength(0);
    });

    it('no key exists in Hebrew but is missing in English', () => {
      const missing = heKeys.filter((k) => !enKeySet.has(k));
      expect(missing).toHaveLength(0);
    });
  });

  describe('Hebrew translations are non-empty strings', () => {
    it('all Hebrew leaf values are non-empty strings', () => {
      const he = getDictionary('he') as unknown as Record<string, unknown>;
      const keys = getLeafKeys(he);
      const parts = getDictionary('he') as unknown as Record<string, Record<string, unknown>>;
      for (const fullKey of keys) {
        const segments = fullKey.split('.');
        let node: unknown = parts;
        for (const seg of segments) {
          node = (node as Record<string, unknown>)[seg];
        }
        expect(typeof node).toBe('string');
        expect((node as string).length).toBeGreaterThan(0);
      }
    });
  });

  describe('translateEnum', () => {
    it('returns translated value when key exists', () => {
      const dict = getDictionary('en');
      const group = dict.enums.taskStatus;
      const firstKey = Object.keys(group)[0];
      expect(translateEnum(firstKey, group)).toBe(group[firstKey]);
    });

    it('returns translated Hebrew value when key exists', () => {
      const dict = getDictionary('he');
      const group = dict.enums.priority;
      const firstKey = Object.keys(group)[0];
      expect(translateEnum(firstKey, group)).toBe(group[firstKey]);
    });

    it('returns original key as fallback when key is unknown', () => {
      const group = { todo: 'To Do', done: 'Done' };
      expect(translateEnum('unknown_status', group)).toBe('unknown_status');
    });

    it('returns original key as fallback for empty group', () => {
      expect(translateEnum('anything', {})).toBe('anything');
    });

    it('enums section has all required sub-groups', () => {
      const dict = getDictionary('en');
      const requiredEnumGroups = [
        'taskStatus',
        'priority',
        'roles',
        'sensorStatus',
        'severity',
        'inventoryType',
        'heatLevel',
        'metric',
        'taskType',
        'stockStatus',
        'userStatus',
      ] as const;
      for (const group of requiredEnumGroups) {
        expect(dict.enums[group]).toBeDefined();
      }
    });
  });
});
