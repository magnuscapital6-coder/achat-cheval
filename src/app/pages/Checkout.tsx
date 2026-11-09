import { Check, Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'

import { FREE_SHIPPING_AT } from '../../data/products'
import { Button, ButtonLink, Container, inputClass } from '../components/ui'
import { money, useCart } from '../lib/cart'

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      {children}
    </label>
  )
}

export function Checkout() {
  const cart = useCart()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', first: '', last: '', address: '', city: '', postcode: '', country: 'France' })
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
        body: JSON.stringify({ email: form.email, items: cart.items.map((i) => ({ id: i.slug, option: i.option, quantity: i.quantity })) }),
      })
      const body = (await response.json()) as { reference?: string; error?: string }
      if (!response.ok || !body.reference) throw new Error(body.error ?? 'Une erreur est survenue.')
      const summary = { reference: body.reference, email: form.email, items: cart.items, total }
      cart.clear()
      navigate(`/order/${body.reference}`, { state: summary })
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    }
  }

  return (
    <Container className="pt-10 sm:pt-14">
      <h1 className="font-display text-[44px] sm:text-[56px]">Commande</h1>
      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_420px] lg:gap-20">
        <form onSubmit={submit} className="flex flex-col gap-10">
          <section>
            <h2 className="text-[16px] font-medium">Contact</h2>
            <Field label="E-mail" className="mt-4 block">
              <input type="email" required className={inputClass} value={form.email} onChange={set('email')} autoComplete="email" />
            </Field>
          </section>
          <section>
            <h2 className="text-[16px] font-medium">Livraison</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Prénom">
                <input required className={inputClass} value={form.first} onChange={set('first')} autoComplete="given-name" />
              </Field>
              <Field label="Nom">
                <input required className={inputClass} value={form.last} onChange={set('last')} autoComplete="family-name" />
              </Field>
              <Field label="Adresse" className="col-span-2">
                <input required className={inputClass} value={form.address} onChange={set('address')} autoComplete="street-address" />
              </Field>
              <Field label="Ville">
                <input required className={inputClass} value={form.city} onChange={set('city')} autoComplete="address-level2" />
              </Field>
              <Field label="Code postal">
                <input required className={inputClass} value={form.postcode} onChange={set('postcode')} autoComplete="postal-code" />
              </Field>
              <Field label="Pays" className="col-span-2">
                <select className={inputClass} value={form.country} onChange={set('country')} autoComplete="country-name">
                  {['France', 'Belgique', 'Suisse', 'Luxembourg', 'Espagne', 'Italie', 'Allemagne', 'Pays-Bas', 'Royaume-Uni'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>
          <section>
            <h2 className="text-[16px] font-medium">Paiement</h2>
            <div className="mt-4 rounded-card border border-line bg-surface p-5">
              <div className="flex items-center gap-2 text-[14px] text-muted">
                <Lock className="size-4" />
                Paiement de démonstration. Branchez Stripe dans <code className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 text-[12.5px]">src/worker/index.ts</code> pour encaisser.
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 opacity-60">
                <input disabled placeholder="Numéro de carte" className={`${inputClass} col-span-2`} />
                <input disabled placeholder="MM / AA" className={inputClass} />
                <input disabled placeholder="Cryptogramme" className={inputClass} />
              </div>
            </div>
          </section>
          {state === 'error' && <p className="text-[14px] text-accent">{error}</p>}
          <Button type="submit" size="lg" loading={state === 'sending'} className="w-full sm:w-auto">
            Valider la commande · {money(total)}
          </Button>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-line bg-surface p-6">
            <h2 className="text-[16px] font-medium">Récapitulatif</h2>
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
                <dt className="text-muted">Sous-total</dt>
                <dd className="tabular-nums">{money(cart.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Livraison</dt>
                <dd className="tabular-nums">{shipping === 0 ? 'Offerte' : money(shipping)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-[16px] font-medium">
                <dt>Total</dt>
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
  const { state } = useLocation() as { state?: { reference: string; email: string; total: number } }
  return (
    <Container className="pt-16 sm:pt-24">
      <div className="mx-auto max-w-md text-center">
        <span className="round mx-auto grid size-14 place-items-center rounded-full bg-fg text-bg">
          <Check className="size-6" />
        </span>
        <h1 className="font-display mt-6 text-[44px] leading-[1.02] sm:text-[56px]">Merci</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">
          {state ? (
            <>
              La commande <span className="font-medium text-fg">{state.reference}</span> est notée. Un e-mail de confirmation part vers {state.email}.
            </>
          ) : (
            'Votre commande est confirmée.'
          )}
        </p>
        <ButtonLink to="/shop" variant="secondary" className="mt-8">
          Continuer mes achats
        </ButtonLink>
        <p className="mt-10 text-[13px] text-faint">
          Une question ? <Link to="/about" className="underline underline-offset-4">Écrivez-nous</Link>
        </p>
      </div>
    </Container>
  )
}
