'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  previewCheckout,
  pay,
  luhnCheck,
  CheckoutPreview,
  CheckoutRequest,
} from '@/services/checkoutService';
import {
  createPaypalOrder,
  capturePaypalOrder,
} from '@/services/paypalService';
import { getCart } from '@/services/cartService';
import { useLanguage } from '@/context/LanguageContext';

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: Record<string, unknown>) => { render: (container: HTMLElement | string) => void };
    };
  }
}

function fmt(n: number) {
  return `₪${Number(n).toFixed(2)}`;
}

/** Format a raw digit string as "XXXX XXXX XXXX XXXX" (up to 19 chars with spaces). */
function fmtCardDisplay(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
}

type Tab = 'credit_card' | 'paypal';

interface CardForm {
  cardholderName: string;
  cardNumber:     string;
  expiryMonth:    string;
  expiryYear:     string;
  cvv:            string;
}

interface CardErrors {
  cardholderName?: string;
  cardNumber?:     string;
  expiry?:         string;
  cvv?:            string;
}

/** Real PayPal Sandbox button using the PayPal JS SDK. */
function PayPalPanel({
  couponCode,
  quickProductId,
  quickQty,
  onSuccess,
}: {
  couponCode?: string;
  quickProductId?: string;
  quickQty?: string;
  onSuccess: (orderId: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready,  setReady]  = useState(false);
  const [sdkErr, setSdkErr] = useState<string | null>(null);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? '';
  const currency = process.env.NEXT_PUBLIC_PAYPAL_CURRENCY ?? 'ILS';

  useEffect(() => {
    if (!clientId) {
      setSdkErr('PayPal is not configured (missing NEXT_PUBLIC_PAYPAL_CLIENT_ID).');
      return;
    }
    // Load PayPal JS SDK dynamically
    const scriptId = 'paypal-sdk-script';
    if (document.getElementById(scriptId)) {
      setReady(true);
      return;
    }
    const script = document.createElement('script');
    script.id   = scriptId;
    script.src  = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}`;
    script.onload = () => setReady(true);
    script.onerror = () => setSdkErr('Failed to load PayPal SDK. Check your internet connection.');
    document.body.appendChild(script);
  }, [clientId, currency]);

  useEffect(() => {
    if (!ready || !containerRef.current || !window.paypal) return;
    const items = quickProductId
      ? [{ productId: Number(quickProductId), quantity: Number(quickQty ?? 1) }]
      : undefined;

    window.paypal.Buttons({
      createOrder: async () => {
        const resp = await createPaypalOrder({ couponCode, items });
        return resp.paypalOrderId;
      },
      onApprove: async (data: { orderID: string }) => {
        const result = await capturePaypalOrder({ paypalOrderId: data.orderID, couponCode, items });
        if (result.success && result.orderId) {
          onSuccess(result.orderId);
        } else {
          setSdkErr(result.errors.length > 0 ? result.errors.join(' ') : result.message);
        }
      },
      onError: (err: unknown) => {
        setSdkErr(`PayPal error: ${err instanceof Error ? err.message : String(err)}`);
      },
    }).render(containerRef.current);
  }, [ready, couponCode, quickProductId, quickQty, onSuccess]);

  if (sdkErr) {
    return (
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4" data-testid="paypal-config-error">
          <p className="text-sm font-semibold text-red-700 mb-1">PayPal unavailable</p>
          <p className="text-xs text-red-600">{sdkErr}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
      {!ready && (
        <p className="text-sm text-gray-500 text-center py-4" data-testid="paypal-loading">
          Loading PayPal…
        </p>
      )}
      <div ref={containerRef} data-testid="paypal-button-container" />
    </div>
  );
}


function CheckoutPageInner() {
  const { t } = useLanguage();
  const st = t.store;
  const router = useRouter();
  const params = useSearchParams();

  const [preview, setPreview]   = useState<CheckoutPreview | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [tab, setTab]           = useState<Tab>('credit_card');
  const [submitting, setSubmitting] = useState(false);
  const [globalErr, setGlobalErr]   = useState<string[]>([]);
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalErr,  setPaypalErr]   = useState<string | null>(null);
  const paypalContainerRef           = useRef<HTMLDivElement>(null);

  const [card, setCard] = useState<CardForm>({
    cardholderName: '',
    cardNumber:     '',
    expiryMonth:    '',
    expiryYear:     '',
    cvv:            '',
  });
  const [cardErrs, setCardErrs] = useState<CardErrors>({});

  const couponCode = params?.get('coupon') ?? undefined;

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Build items from single-product quick-buy or from cart
      const productId = params?.get('productId');
      const qty       = params?.get('qty');
      let req: CheckoutRequest;
      if (productId) {
        req = {
          paymentMethod: 'mock_credit_card',
          items: [{ productId: Number(productId), quantity: Number(qty ?? 1) }],
          couponCode,
        };
      } else {
        // Use cart — pass empty items so backend reads from cart
        req = { paymentMethod: 'mock_credit_card', couponCode };
      }
      const prev = await previewCheckout(req);
      setPreview(prev);
      if (!prev.isValid && prev.errors.length > 0) {
        setError(prev.errors.join(', '));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load checkout preview.');
    } finally {
      setLoading(false);
    }
  }, [couponCode, params]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  function validateCard(): boolean {
    const errs: CardErrors = {};
    const now = new Date();
    if (!card.cardholderName.trim()) errs.cardholderName = st.errCardholderRequired;
    const rawNum = card.cardNumber.replace(/\D/g, '');
    if (!rawNum) {
      errs.cardNumber = st.errCardNumberInvalid;
    } else if (rawNum.length !== 16) {
      errs.cardNumber = st.errCardNumberInvalid;  // must be exactly 16 digits
    } else if (!luhnCheck(rawNum)) {
      errs.cardNumber = st.errCardNumberInvalid;
    }
    const mo = parseInt(card.expiryMonth, 10);
    const yr = parseInt(card.expiryYear, 10);
    const fullYear = yr < 100 ? 2000 + yr : yr;
    if (!mo || mo < 1 || mo > 12 || !yr ||
        new Date(fullYear, mo, 1) <= now) {
      errs.expiry = st.errCardExpired;
    }
    if (!/^\d{3,4}$/.test(card.cvv)) errs.cvv = st.errCvvInvalid;
    setCardErrs(errs);
    return Object.keys(errs).length === 0;
  }

  /** Validate a single field on blur (shows error only after user leaves the field). */
  function validateFieldOnBlur(field: keyof CardErrors) {
    const now = new Date();
    const next = { ...cardErrs };
    if (field === 'cardholderName') {
      if (!card.cardholderName.trim()) next.cardholderName = st.errCardholderRequired;
      else delete next.cardholderName;
    }
    if (field === 'cardNumber') {
      const rawNum = card.cardNumber.replace(/\D/g, '');
      if (!rawNum || rawNum.length !== 16 || !luhnCheck(rawNum))
        next.cardNumber = st.errCardNumberInvalid;
      else delete next.cardNumber;
    }
    if (field === 'expiry') {
      const mo = parseInt(card.expiryMonth, 10);
      const yr = parseInt(card.expiryYear, 10);
      const fullYear = yr < 100 ? 2000 + yr : yr;
      if (!mo || mo < 1 || mo > 12 || !yr || new Date(fullYear, mo, 1) <= now)
        next.expiry = st.errCardExpired;
      else delete next.expiry;
    }
    if (field === 'cvv') {
      if (!/^\d{3,4}$/.test(card.cvv)) next.cvv = st.errCvvInvalid;
      else delete next.cvv;
    }
    setCardErrs(next);
  }

  function buildRequest(method: CheckoutRequest['paymentMethod']): CheckoutRequest {
    const productId = params?.get('productId');
    const qty       = params?.get('qty');
    const req: CheckoutRequest = { paymentMethod: method, couponCode };
    if (productId) {
      req.items = [{ productId: Number(productId), quantity: Number(qty ?? 1) }];
    }
    if (method === 'mock_credit_card') {
      req.creditCard = {
        cardholderName: card.cardholderName,
        cardNumber:     card.cardNumber.replace(/\D/g, ''),
        expiryMonth:    parseInt(card.expiryMonth, 10),
        expiryYear:     parseInt(card.expiryYear, 10) < 100
          ? 2000 + parseInt(card.expiryYear, 10)
          : parseInt(card.expiryYear, 10),
        cvv: card.cvv,
      };
    }
    return req;
  }

  async function submitCreditCard() {
    setSubmitting(true);
    setGlobalErr([]);
    try {
      const result = await pay(buildRequest('mock_credit_card'));
      if (result.success && result.orderId) {
        router.push(`/checkout/success?orderId=${result.orderId}`);
      } else {
        setGlobalErr(result.errors.length > 0 ? result.errors : [result.message]);
      }
    } catch (e) {
      setGlobalErr([e instanceof Error ? e.message : 'Payment failed.']);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCardSubmit() {
    if (!validateCard()) return;
    submitCreditCard();
  }

  if (loading) {
    return (
      <div className="app-page-bg flex items-center justify-center">
        <p className="text-sm text-gray-500">{t.common.loading}</p>
      </div>
    );
  }

  if (error && !preview) {
    return (
      <div className="app-page-bg flex items-center justify-center">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="app-page-bg">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back button */}
        <button
          onClick={() => router.push('/cart')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition"
          data-testid="back-to-cart"
        >
          ← {t.common.back ?? 'Back'}
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">{st.checkout}</h1>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Payment form */}
          <div className="flex-1">
            {/* Tabs */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-4">
              <button
                onClick={() => setTab('credit_card')}
                data-testid="tab-credit-card"
                className={`flex-1 py-2.5 text-sm font-medium transition ${
                  tab === 'credit_card'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {st.payWithCard}
              </button>
              <button
                onClick={() => setTab('paypal')}
                data-testid="tab-paypal"
                className={`flex-1 py-2.5 text-sm font-medium transition ${
                  tab === 'paypal'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {st.payWithPaypal}
              </button>
            </div>

            {tab === 'credit_card' && (
              <div className="bg-white rounded-xl border border-[var(--color-border)] p-5 flex flex-col gap-4">
                {/* Cardholder Name */}
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">{st.cardholderName}</label>
                  <input
                    type="text"
                    value={card.cardholderName}
                    onChange={(e) => { setCard({ ...card, cardholderName: e.target.value }); if (cardErrs.cardholderName) setCardErrs(p => ({ ...p, cardholderName: undefined })); }}
                    onBlur={() => validateFieldOnBlur('cardholderName')}
                    data-testid="input-cardholder-name"
                    className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] ${
                      cardErrs.cardholderName ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {cardErrs.cardholderName && (
                    <p className="text-[11px] text-red-500 mt-0.5" data-testid="err-cardholder">{cardErrs.cardholderName}</p>
                  )}
                </div>

                {/* Card Number — auto-formats spaces every 4 digits; validates on blur */}
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">{st.cardNumber}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={card.cardNumber}
                    onChange={(e) => {
                      // Strip all non-digits, re-insert spaces every 4 chars
                      const formatted = fmtCardDisplay(e.target.value);
                      setCard({ ...card, cardNumber: formatted });
                      // Clear existing error while user is editing
                      if (cardErrs.cardNumber) setCardErrs(prev => ({ ...prev, cardNumber: undefined }));
                    }}
                    onBlur={() => validateFieldOnBlur('cardNumber')}
                    maxLength={19}
                    placeholder="4111 1111 1111 1111"
                    data-testid="input-card-number"
                    className={`w-full border rounded-md px-3 py-2 text-sm font-mono tracking-wider focus:outline-none focus:border-[var(--color-primary)] ${
                      cardErrs.cardNumber ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {cardErrs.cardNumber && (
                    <p className="text-[11px] text-red-500 mt-0.5" data-testid="err-card-number">{cardErrs.cardNumber}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5">Test card: 4111 1111 1111 1111</p>
                </div>

                {/* Expiry + CVV */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-700 block mb-1">{st.expiryDate}</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={card.expiryMonth}
                        onChange={(e) => setCard({ ...card, expiryMonth: e.target.value })}
                        placeholder="MM"
                        maxLength={2}
                        data-testid="input-expiry-month"
                        className={`w-full border rounded-md px-2 py-2 text-sm font-mono focus:outline-none focus:border-[var(--color-primary)] ${
                          cardErrs.expiry ? 'border-red-400' : 'border-gray-300'
                        }`}
                      />
                      <input
                        type="text"
                        value={card.expiryYear}
                        onChange={(e) => setCard({ ...card, expiryYear: e.target.value })}
                        placeholder="YY"
                        maxLength={4}
                        data-testid="input-expiry-year"
                        className={`w-full border rounded-md px-2 py-2 text-sm font-mono focus:outline-none focus:border-[var(--color-primary)] ${
                          cardErrs.expiry ? 'border-red-400' : 'border-gray-300'
                        }`}
                      />
                    </div>
                    {cardErrs.expiry && (
                      <p className="text-[11px] text-red-500 mt-0.5" data-testid="err-expiry">{cardErrs.expiry}</p>
                    )}
                  </div>
                  <div className="w-28">
                    <label className="text-xs font-medium text-gray-700 block mb-1">{st.cvv}</label>
                    <input
                      type="text"
                      value={card.cvv}
                      onChange={(e) => setCard({ ...card, cvv: e.target.value })}
                      placeholder="123"
                      maxLength={4}
                      data-testid="input-cvv"
                      className={`w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:border-[var(--color-primary)] ${
                        cardErrs.cvv ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                    {cardErrs.cvv && (
                      <p className="text-[11px] text-red-500 mt-0.5" data-testid="err-cvv">{cardErrs.cvv}</p>
                    )}
                  </div>
                </div>

                {globalErr.length > 0 && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3" data-testid="global-errors">
                    {globalErr.map((e, i) => (
                      <p key={i} className="text-xs text-red-600">{e}</p>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleCardSubmit}
                  disabled={submitting}
                  data-testid="place-order-btn"
                  className="w-full bg-[var(--color-primary)] text-white rounded-lg py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition"
                >
                  {submitting ? st.processing : st.placeOrder}
                </button>
              </div>
            )}

            {tab === 'paypal' && (
              <PayPalPanel
                couponCode={couponCode}
                quickProductId={params?.get('productId') ?? undefined}
                quickQty={params?.get('qty') ?? undefined}
                onSuccess={(orderId) => router.push(`/checkout/success?orderId=${orderId}`)}
              />
            )}
          </div>

          {/* Summary panel */}
          {preview && (
            <div className="w-full lg:w-64 shrink-0">
              <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                <p className="text-sm font-semibold text-gray-900 mb-3">{st.subtotal}</p>
                {preview.items.map((item) => (
                  <div key={item.productId} className="flex justify-between text-xs text-gray-600 mb-1">
                    <span className="truncate max-w-[140px]">{item.productName} × {item.quantity}</span>
                    <span dir="ltr">{fmt(item.lineTotal)}</span>
                  </div>
                ))}

                <div className="border-t border-gray-100 pt-2 mt-2 flex flex-col gap-1 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>{st.subtotal}</span>
                    <span dir="ltr">{fmt(preview.originalSubtotal)}</span>
                  </div>
                  {preview.productDiscountTotal > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>− {st.productDiscount}</span>
                      <span dir="ltr">−{fmt(preview.productDiscountTotal)}</span>
                    </div>
                  )}
                  {preview.employeeDiscountTotal > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span>− {st.employeeDiscount}</span>
                      <span dir="ltr">−{fmt(preview.employeeDiscountTotal)}</span>
                    </div>
                  )}
                  {preview.couponDiscountTotal > 0 && (
                    <div className="flex justify-between text-purple-600">
                      <span>− {st.couponDiscount}</span>
                      <span dir="ltr">−{fmt(preview.couponDiscountTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 text-sm border-t border-gray-100 pt-2 mt-1">
                    <span>{st.total}</span>
                    <span dir="ltr">{fmt(preview.finalTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="app-page-bg flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    }>
      <CheckoutPageInner />
    </Suspense>
  );
}
