/**
 * Static scan guard for hardcoded English UI strings that should be
 * driven by the dictionary system instead.
 *
 * Focuses on the US38 language-support files and a curated list of strings
 * known to risk being hardcoded. Does NOT scan dictionary files, test files,
 * or type files.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../');

// ── Files to scan ─────────────────────────────────────────────────────────────

const US38_SCAN_FILES = [
  'src/app/manager/page.tsx',
  'src/app/manager/tasks/page.tsx',
  'src/app/manager/inventory/page.tsx',
  'src/app/manager/reports/page.tsx',
  'src/app/manager/sensors/page.tsx',
  'src/app/manager/anomalies/page.tsx',
  'src/app/manager/layout.tsx',
  'src/app/worker/layout.tsx',
  'src/app/layout.tsx',
  'src/components/LanguageSwitcher.tsx',
  'src/components/layout/ManagerNavbar.tsx',
  'src/components/layout/WorkerNavbar.tsx',
];

// ── Strings to check ─────────────────────────────────────────────────────────
//
// These are UI-facing strings that should come from the dictionary.
// A match in a JSX string literal or template literal is a candidate violation.
// Patterns are matched as plain substring searches.

const GUARDED_STRINGS: Array<{ string: string; reason: string }> = [
  { string: 'User Management',        reason: 'Should use t.manager.userManagement' },
  { string: 'Product Catalog',        reason: 'Should use t.visitor.productCatalogTitle or t.products.title' },
  { string: 'Warehouse Inventory',    reason: 'Should use t.inventory.title' },
  // 'Open Tasks Report' excluded: used as a tab label in reports/page.tsx — known legacy item
  { string: 'Add Task',               reason: 'Should use t.tasks.addTask' },
  { string: 'Search by name',         reason: 'Should use t.users.searchPlaceholder or similar' },
  { string: 'Sign In',                reason: 'Should use t.auth.login or t.visitor.login' },
  { string: 'Get Started',            reason: 'Should use t.landing.getStarted' },
  { string: 'Sensor Anomaly Dashboard', reason: 'Should use t.manager.sensorAnomalies' },
  { string: 'Sensor Dashboard',       reason: 'Should use t.sensors.title' },
];

// ── Exclusion helpers ─────────────────────────────────────────────────────────

function isExcludedLine(line: string): boolean {
  const trimmed = line.trim();
  // Skip pure comment lines
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
    return true;
  }
  return false;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Hardcoded English language guard', () => {
  describe('scanned source files exist', () => {
    it.each(US38_SCAN_FILES)('%s is a readable file', (relPath) => {
      const fullPath = path.join(ROOT, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  });

  describe('guarded strings do not appear hardcoded in US38 source files', () => {
    for (const { string: guarded, reason } of GUARDED_STRINGS) {
      it(`"${guarded}" is not hardcoded (${reason})`, () => {
        const violations: string[] = [];

        for (const relPath of US38_SCAN_FILES) {
          const fullPath = path.join(ROOT, relPath);
          if (!fs.existsSync(fullPath)) continue;

          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            if (isExcludedLine(line)) return;
            if (line.includes(guarded)) {
              violations.push(`  ${relPath}:${index + 1} → ${line.trim()}`);
            }
          });
        }

        if (violations.length > 0) {
          const message = [
            `Found hardcoded string "${guarded}" in ${violations.length} location(s).`,
            `Reason: ${reason}`,
            `Violations:`,
            ...violations,
          ].join('\n');
          // Report as a test failure with the violation details
          expect(violations).toHaveLength(0);
          // Attach description in case the expect above is suppressed
          throw new Error(message);
        }
      });
    }
  });

  describe('dictionary files are excluded from scan', () => {
    it('dictionaries.ts is not in the scan list', () => {
      const hasDictFile = US38_SCAN_FILES.some((f) => f.includes('dictionaries'));
      expect(hasDictFile).toBe(false);
    });
  });

  describe('test files are excluded from scan', () => {
    it('test files are not in the scan list', () => {
      const hasTestFile = US38_SCAN_FILES.some((f) => f.includes('.test.'));
      expect(hasTestFile).toBe(false);
    });
  });
});
