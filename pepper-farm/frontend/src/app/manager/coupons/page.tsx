'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  listCoupons, createCoupon, updateCoupon, deactivateCoupon,
  Coupon, CouponPayload,
} from '@/services/couponService';
import { useLanguage } from '@/context/LanguageContext';

const emptyPayload = (): CouponPayload => ({
  code: '', description: '', discountType: 'percentage', discountValue: 10,
  active: true, startsAtUtc: null, endsAtUtc: null,
  maxTotalUses: null, maxUsesPerUser: null, minimumOrderAmount: null,
});

function formatUtc(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = iso.endsWith('Z') ? iso : iso + 'Z';
  return new Date(s).toLocaleDateString();
}

export default function CouponsPage() {
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

  const [coupons,  setCoupons]  = useState<Coupon[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState<Coupon | null | undefined>(undefined);
  const [form,     setForm]     = useState<CouponPayload>(emptyPayload());
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState('');
  const [err,      setErr]      = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setCoupons(await listCoupons()); }
    catch { setErr('Failed to load coupons.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm(emptyPayload()); setMsg(''); setErr(''); }
  function openEdit(c: Coupon) {
    setEditing(c);
    setForm({
      code:               c.code,
      description:        c.description ?? '',
      discountType:       c.discountType as 'percentage' | 'fixed_amount',
      discountValue:      c.discountValue,
      active:             c.active,
      startsAtUtc:        c.startsAtUtc,
      endsAtUtc:          c.endsAtUtc,
      maxTotalUses:       c.maxTotalUses,
      maxUsesPerUser:     c.maxUsesPerUser,
      minimumOrderAmount: c.minimumOrderAmount,
    });
    setMsg(''); setErr('');
  }
  function closeForm() { setEditing(undefined); }

  async function handleSave() {
    setSaving(true); setMsg(''); setErr('');
    try {
      if (editing) { await updateCoupon(editing.couponId, form); setMsg(s.couponUpdated); }
      else { await createCoupon(form); setMsg(s.couponCreated); }
      await load();
      closeForm();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed.'); }
    finally { setSaving(false); }
  }

  async function handleDeactivate(id: number) {
    if (!confirm('Deactivate this coupon?')) return;
    try { await deactivateCoupon(id); setMsg(s.couponDeactivated); await load(); }
    catch { setErr('Failed to deactivate.'); }
  }

  const formVisible = editing !== undefined;

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-medium text-[var(--color-primary)] uppercase tracking-wider mb-1">Manager</p>
          <h1 className="text-2xl font-bold text-gray-900">{s.coupons}</h1>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm hover:opacity-90 transition"
          data-testid="new-coupon-btn"
        >
          + {s.newCoupon}
        </button>
      </div>

      {msg && <div className="mb-4 text-sm text-green-700 bg-green-50 rounded-lg p-3 border border-green-200" data-testid="coupon-msg">{msg}</div>}
      {err && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg p-3 border border-red-200" data-testid="coupon-err">{err}</div>}

      {/* Create/Edit form */}
      {formVisible && (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 mb-6" data-testid="coupon-form">
          <h2 className="font-semibold text-gray-900 mb-4">{editing ? s.editCoupon : s.newCoupon}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Code *</label>
              <input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="SAVE10"
                className="w-full border border-[var(--color-border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
                data-testid="coupon-code-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{s.discountType} *</label>
              <select
                value={form.discountType}
                onChange={e => setForm(f => ({ ...f, discountType: e.target.value as 'percentage' | 'fixed_amount' }))}
                className="w-full border border-[var(--color-border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
                data-testid="coupon-type-select"
              >
                <option value="percentage">{s.percentageDiscount}</option>
                <option value="fixed_amount">{s.fixedDiscount}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {s.discountValue} {form.discountType === 'percentage' ? '(%)' : '($)'} *
              </label>
              <input
                type="number"
                value={form.discountValue}
                min={0}
                onChange={e => setForm(f => ({ ...f, discountValue: parseFloat(e.target.value) || 0 }))}
                className="w-full border border-[var(--color-border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
                data-testid="coupon-value-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{s.minOrderAmount}</label>
              <input
                type="number"
                value={form.minimumOrderAmount ?? ''}
                min={0}
                onChange={e => setForm(f => ({ ...f, minimumOrderAmount: e.target.value ? parseFloat(e.target.value) : null }))}
                className="w-full border border-[var(--color-border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
                data-testid="coupon-min-order-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{s.maxUses}</label>
              <input
                type="number"
                value={form.maxTotalUses ?? ''}
                min={1}
                onChange={e => setForm(f => ({ ...f, maxTotalUses: e.target.value ? parseInt(e.target.value, 10) : null }))}
                className="w-full border border-[var(--color-border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
                data-testid="coupon-max-uses-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Expires (UTC)</label>
              <input
                type="datetime-local"
                value={form.endsAtUtc?.slice(0, 16) ?? ''}
                onChange={e => setForm(f => ({ ...f, endsAtUtc: e.target.value ? e.target.value + ':00' : null }))}
                className="w-full border border-[var(--color-border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
                data-testid="coupon-ends-at-input"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="coupon-active"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                data-testid="coupon-active-checkbox"
                className="w-4 h-4"
              />
              <label htmlFor="coupon-active" className="text-sm text-gray-700">{s.activeCoupon}</label>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
              data-testid="save-coupon-btn"
            >
              {saving ? t.common.saving : t.common.save}
            </button>
            <button
              onClick={closeForm}
              className="px-5 py-2 border border-[var(--color-border)] text-gray-600 rounded-lg text-sm hover:bg-gray-50"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Coupon list */}
      {loading ? (
        <p className="text-gray-400 text-sm">{t.common.loading}</p>
      ) : (
        <div className="space-y-2" data-testid="coupons-list">
          {coupons.map(c => (
            <div
              key={c.couponId}
              className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 hover:shadow-sm transition"
              data-testid={`coupon-row-${c.couponId}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className=" font-semibold text-gray-900">{c.code}</span>
                <span className="text-sm text-gray-500">
                  {c.discountType === 'percentage' ? `${c.discountValue}%` : `$${c.discountValue}`} OFF
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {c.active ? t.common.active : t.common.inactive}
                </span>
                <span className="text-xs text-gray-400">
                  Used: {c.currentUseCount}{c.maxTotalUses ? ` / ${c.maxTotalUses}` : ''}
                </span>
                {c.endsAtUtc && (
                  <span className="text-xs text-gray-400">Expires: {formatUtc(c.endsAtUtc)}</span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => openEdit(c)}
                  className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 text-gray-600"
                  data-testid={`edit-coupon-${c.couponId}`}
                >
                  {t.common.edit}
                </button>
                {c.active && (
                  <button
                    onClick={() => handleDeactivate(c.couponId)}
                    className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50"
                    data-testid={`deactivate-coupon-${c.couponId}`}
                  >
                    {t.common.inactive}
                  </button>
                )}
              </div>
            </div>
          ))}
          {coupons.length === 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-white p-8 text-center">
              <p className="text-gray-400 text-sm">{t.common.noData}</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
