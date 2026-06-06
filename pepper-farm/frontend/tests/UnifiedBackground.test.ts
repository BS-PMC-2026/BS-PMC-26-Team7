import fs from 'fs';
import path from 'path';

const root = process.cwd();

function read(relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

describe('US47 unified app background', () => {
  it('defines the worker-style background as the shared app background utility', () => {
    const css = read('src/app/globals.css');

    expect(css).toContain('--color-background:       #F6F8F4;');
    expect(css).toContain('--background:          #F6F8F4;');
    expect(css).toContain('.app-page-bg');
    expect(css).toContain('background-color: #F6F8F4;');
  });

  it('uses the shared background wrapper in representative route shells', () => {
    const files = [
      'src/app/page.tsx',
      'src/app/login/page.tsx',
      'src/app/register/page.tsx',
      'src/app/manager/layout.tsx',
      'src/app/manager/page.tsx',
      'src/app/worker/layout.tsx',
      'src/app/worker/page.tsx',
      'src/app/worker/products/page.tsx',
      'src/app/visitor/layout.tsx',
      'src/app/visitor/page.tsx',
      'src/app/visitor/products/page.tsx',
      'src/app/visitor/spray-restrictions/page.tsx',
      'src/app/cart/page.tsx',
      'src/app/checkout/page.tsx',
      'src/app/checkout/success/page.tsx',
      'src/app/profile/orders/page.tsx',
      'src/app/unsubscribe/page.tsx',
    ];

    for (const file of files) {
      const source = read(file);
      expect(source.includes('app-page-bg')).toBe(true);
    }
  });

  it('does not leave old page-level min-height background overrides', () => {
    const appDir = path.join(root, 'src/app');
    const oldPageBackground = /min-h-screen[^\n]*(bg-\[#f0fdf4\]|bg-gray-50|bg-\[var\(--color-muted\)\]|bg-\[#F6F8F4\]|bg-\[var\(--color-background\)\])/;

    const visit = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          visit(fullPath);
          continue;
        }
        if (!entry.name.endsWith('.tsx')) continue;
        expect(read(path.relative(root, fullPath))).not.toMatch(oldPageBackground);
      }
    };

    visit(appDir);
  });
});
