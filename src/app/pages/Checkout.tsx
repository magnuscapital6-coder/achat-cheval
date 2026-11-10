import { Check, Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'

import { FREE_SHIPPING_AT } from '../../data/products'
import { Button, ButtonLink, Container, inputClass } from '../components/ui'
import { money, useCart } from '../lib/cart'
import { useI18n } from '../lib/i18n'

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      {children}
    </label>
  )
}

const COUNTRIES = ['FR', 'BE', 'CH', 'LU', 'ES', 'IT', 'DE', 'NL', 'GB']

export function Checkout() {
  const { t, market } = useI18n()
  const countryNames = new Intl.DisplayNames([market.hreflang], { type: 'region' })
  const cart = useCart()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', first: '', last: '', address: '', city: '', postcode: '', country: market.country })
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle')
  const [error, setError] = useState('')

  if (cart.items.length === 0) return <Navigate to="/shop" replace />

  const shipping = cart.subtotal >= FREE_SHIPPING_AT ? 0 : 9.9
  const total = cart.subtotal + shipping
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          market: market.id,
          items: cart.items.map((i) => ({ id: i.slug, option: i.option, quantity: i.quantity })),
        }),
      })
      const body = (await response.json()) as { reference?: string; error?: string }
      if (!response.ok || !body.reference) throw new Error(body.error ?? t('visit.error'))
      const summary = { reference: body.reference, email: form.email, items: cart.items, total }
      cart.clear()
      navigate(`/order/${body.reference}`, { state: summary })
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : t('visit.error'))
    }
  }

  return (
    <Container className="pt-10 sm:pt-14">
      <h1 className="font-display text-[44px] sm:text-[56px]">{t('checkout.title')}</h1>
      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_420px] lg:gap-20">
        <form onSubmit={submit} className="flex flex-col gap-10">
          <section>
            <h2 className="text-[16px] font-medium">{t('checkout.contact')}</h2>
            <Field label={t('checkout.email')} className="mt-4 block">
              <input type="email" required className={inputClass} value={form.email} onChange={set('email')} autoComplete="email" />
            </Field>
          </section>
          <section>
            <h2 className="text-[16px] font-medium">{t('checkout.shipping')}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label={t('checkout.first')}>
                <input required className={inputClass} value={form.first} onChange={set('first')} autoComplete="given-name" />
              </Field>
              <Field label={t('checkout.last')}>
                <input required className={inputClass} value={form.last} onChange={set('last')} autoComplete="family-name" />
              </Field>
              <Field label={t('checkout.address')} className="col-span-2">
                <input required className={inputClass} value={form.address} onChange={set('address')} autoComplete="street-address" />
              </Field>
              <Field label={t('checkout.city')}>
                <input required className={inputClass} value={form.city} onChange={set('city')} autoComplete="address-level2" />
              </Field>
              <Field label={t('checkout.postcode')}>
                <input required className={inputClass} value={form.postcode} onChange={set('postcode')} autoComplete="postal-code" />
              </Field>
              <Field label={t('checkout.country')} className="col-span-2">
                <select className={inputClass} value={form.country} onChange={set('country')} autoComplete="country-name">
                  {COUNTRIES.map((code) => (
                    <option key={code} value={code}>
                      {countryNames.of(code) ?? code}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>
          <section>
            <h2 className="text-[16px] font-medium">{t('checkout.payment')}</h2>
            <div className="mt-4 rounded-card border border-line bg-surface p-5">
              <div className="flex items-center gap-2 text-[14px] text-muted">
                <Lock className="size-4" />
                <span>
                  {t('checkout.demo')} <code className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 text-[12.5px]">src/worker/index.ts</code>
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 opacity-60">
                <input disabled placeholder={t('checkout.card')} className={`${inputClass} col-span-2`} />
                <input disabled placeholder={t('checkout.expiry')} className={inputClass} />
                <input disabled placeholder={t('checkout.cvc')} className={inputClass} />
              </div>
            </div>
          </section>
          {state === 'error' && <p className="text-[14px] text-accent">{error}</p>}
          <Button type="submit" size="lg" loading={state === 'sending'} className="w-full sm:w-auto">
            {t('checkout.submit', { total: money(total) })}
          </Button>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-line bg-surface p-6">
            <h2 className="text-[16px] font-medium">{t('checkout.summary')}</h2>
            <ul className="mt-4 divide-y divide-line">
              {cart.items.map((item) => (
                <li key={`${item.slug}-${item.option ?? ''}`} className="flex items-center gap-4 py-3">
                  <span className="image-frame relative size-16 shrink-0 rounded-[14px]">
                    <img src={item.product.image} alt="" className="size-full object-cover" />
                    <span className="round absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-fg px-1.5 text-[11px] font-semibold tabular-nums text-bg">{item.quantity}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{item.product.name}</span>
                    {item.option && <span className="block text-[13px] text-muted">{item.option}</span>}
                  </span>
                  <span className="tabular-nums">{money(item.product.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-[14.5px]">
              <div className="flex justify-between">
                <dt className="text-muted">{t('cart.subtotal')}</dt>
                <dd className="tabular-nums">{money(cart.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t('checkout.shippingRow')}</dt>
                <dd className="tabular-nums">{shipping === 0 ? t('checkout.free') : money(shipping)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-[16px] font-medium">
                <dt>{t('checkout.total')}</dt>
                <dd className="tabular-nums">{money(total)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </Container>
  )
}

export function OrderConfirmed() {
  const { t } = useI18n()
  const { state } = useLocation() as { state?: { reference: string; email: string; total: number } }
  return (
    <Container className="pt-16 sm:pt-24">
      <div className="mx-auto max-w-md text-center">
        <span className="round mx-auto grid size-14 place-items-center rounded-full bg-fg text-bg">
          <Check className="size-6" />
        </span>
        <h1 className="font-display mt-6 text-[44px] leading-[1.02] sm:text-[56px]">{t('checkout.thanks')}</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">
          {state ? t('checkout.confirmed', { reference: state.reference, email: state.email }) : t('checkout.confirmedPlain')}
        </p>
        <ButtonLink to="/shop" variant="secondary" className="mt-8">
          {t('checkout.continue')}
        </ButtonLink>
        <p className="mt-10 text-[13px] text-faint">
          {t('checkout.question')}{' '}
          <Link to="/about" className="underline underline-offset-4">
            {t('checkout.write')}
          </Link>
        </p>
      </div>
    </Container>
  )
}
