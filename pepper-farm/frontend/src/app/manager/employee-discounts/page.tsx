'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getDiscountSetting, updateDiscountSetting, listOverrides,
  setOverride, removeOverride, EmployeeDiscountSetting, ProductOverride,
} from '@/services/employeeDiscountService';
import { getProducts } from '@/services/productService';
import { ProductResponse } from '@/services/productService';
import { useLanguage } from '@/context/LanguageContext';

export default function EmployeeDiscountsPage() {
  const { t } = useLanguage();
  const s = t.store;
  const router = useRouter();

  // Auth guard — FarmManager only
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }
      const payload = JSON.parse(atob(token.split('.')[1]));
      const role = payload.role ?? payload.Role ?? '';
      if (role !== 'FarmManager') { router.push('/login'); }
    } catch { router.push('/login'); }
  }, [router]);

  const [setting,   setSetting]   = useState<EmployeeDiscountSetting | null>(null);
  const [overrides, setOverrides] = useState<ProductOverride[]>([]);
  const [products,  setProducts]  = useState<ProductResponse[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [globalPct, setGlobalPct] = useState(40);
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState('');
  const [err,       setErr]       = useState('');

  // New override form
  const [newProductId,  setNewProductId]  = useState('');
  const [newMode,       setNewMode]       = useState<'use_global'|'excluded'|'custom_percent'>('use_global');
  const [newCustomPct,  setNewCustomPct]  = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [st, ov, prods] = await Promise.all([getDiscountSetting(), listOverrides(), getProducts()]);
      setSetting(st); setGlobalPct(st.globalDiscountPercent);
      setOverrides(ov); setProducts(prods);
    } catch { setErr('Failed to load.'); }
    finally { setLoading(false); }
  }

  async function saveGlobal() {
    setSaving(true); setMsg(''); setErr('');
    try {
      const updated = await updateDiscountSetting(globalPct, setting?.active ?? true);
      setSetting(updated); setMsg('Settings saved.');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed.'); }
    finally { setSaving(false); }
  }

  async function handleAddOverride() {
    if (!newProductId) return;
    try {
      await setOverride(parseInt(newProductId), newMode, newCustomPct ? parseFloat(newCustomPct) : undefined);
      setMsg(s.overrideSaved); setNewProductId(''); setNewMode('use_global'); setNewCustomPct('');
      const ov = await listOverrides(); setOverrides(ov);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed.'); }
  }

  async function handleRemove(id: number) {
    try { await removeOverride(id); setMsg(s.overrideRemoved); const ov = await listOverrides(); setOverrides(ov); }
    catch { setErr('Failed to remove.'); }
  }

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" /></div>;

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">{s.employeeDiscountTitle}</h1>

      {msg && <div className="mb-4 text-sm text-green-700 bg-green-50 rounded p-3">{msg}</div>}
      {err && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded p-3">{err}</div>}

      {/* Global setting */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 mb-6">
        <h2 className="font-semibold mb-3">{s.globalDiscountPct}</h2>
        <p className="text-sm text-gray-500 mb-3">Default employee discount applied to all Workers.</p>
        <div className="flex items-center gap-3">
          <input type="number" value={globalPct} min={0} max={100}
            onChange={e => setGlobalPct(parseFloat(e.target.value))}
            className="w-24 border border-[var(--color-border)] rounded px-3 py-2 text-sm"
            data-testid="global-discount-input" />
          <span className="text-sm text-gray-500">%</span>
          <button onClick={saveGlobal} disabled={saving}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm disabled:opacity-50"
            data-testid="save-global-btn">
            {saving ? 'Saving...' : t.common.save}
          </button>
        </div>
      </div>

      {/* Product overrides */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5">
        <h2 className="font-semibold mb-3">{s.productOverrides}</h2>

        {/* Add override */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <select value={newProductId} onChange={e => setNewProductId(e.target.value)}
            className="border border-[var(--color-border)] rounded px-2 py-2 text-sm col-span-2">
            <option value="">Select product...</option>
            {products.map(p => <option key={p.ProductId} value={p.ProductId}>{p.ProductName}</option>)}
          </select>
          <select value={newMode} onChange={e => setNewMode(e.target.value as typeof newMode)}
            className="border border-[var(--color-border)] rounded px-2 py-2 text-sm">
            <option value="use_global">{s.useGlobal}</option>
            <option value="excluded">{s.excluded}</option>
            <option value="custom_percent">{s.customPercent}</option>
          </select>
          {newMode === 'custom_percent' ? (
            <input type="number" value={newCustomPct} min={0} max={100}
              onChange={e => setNewCustomPct(e.target.value)} placeholder="%"
              className="border border-[var(--color-border)] rounded px-2 py-2 text-sm" />
          ) : <div />}
        </div>
        <button onClick={handleAddOverride} disabled={!newProductId}
          className="mb-4 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm disabled:opacity-50"
          data-testid="add-override-btn">
          + {s.addOverride}
        </button>

        {/* Override list */}
        <div className="space-y-2">
          {overrides.map(o => (
            <div key={o.overrideId} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
              <div>
                <span className="text-sm font-medium">{o.productName || `Product #${o.productId}`}</span>
                <span className="ml-2 text-xs text-gray-500">
                  {o.mode === 'excluded' ? '⛔ Excluded' : o.mode === 'custom_percent' ? `${o.customDiscountPercent}% custom` : 'Uses global'}
                </span>
              </div>
              <button
                onClick={() => handleRemove(o.overrideId)}
                className="text-xs text-red-500 hover:text-red-700"
                data-testid={`remove-override-${o.overrideId}`}
              >
                Remove
              </button>
            </div>
          ))}
          {overrides.length === 0 && <p className="text-sm text-gray-400">No product-specific overrides.</p>}
        </div>
      </div>
    </main>
  );
}
