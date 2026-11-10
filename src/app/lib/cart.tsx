import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { Lang } from '../../data/locales'
import { bySlug, type Product } from '../../data/products'

export interface CartLine {
  slug: string
  option?: string
  quantity: number
}

interface CartState {
  lines: CartLine[]
  open: boolean
  add: (product: Product, option?: string, quantity?: number) => void
  setQuantity: (slug: string, option: string | undefined, quantity: number) => void
  remove: (slug: string, option?: string) => void
  clear: () => void
  setOpen: (open: boolean) => void
  count: number
  subtotal: number
  items: (CartLine & { product: Product })[]
}

const CartContext = createContext<CartState | null>(null)
const KEY = 'achat-cheval-panier'

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? (JSON.parse(raw) as CartLine[]).filter((l) => bySlug(l.slug)) : []
    } catch {
      return []
    }
  })
  const [open, setOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(lines))
  }, [lines])

  const same = (a: CartLine, slug: string, option?: string) => a.slug === slug && (a.option ?? '') === (option ?? '')

  const add = useCallback((product: Product, option?: string, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => same(l, product.slug, option))
      if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + quantity } : l))
      return [...prev, { slug: product.slug, option, quantity }]
    })
    setOpen(true)
  }, [])

  const setQuantity = useCallback((slug: string, option: string | undefined, quantity: number) => {
    setLines((prev) => (quantity <= 0 ? prev.filter((l) => !same(l, slug, option)) : prev.map((l) => (same(l, slug, option) ? { ...l, quantity } : l))))
  }, [])

  const remove = useCallback((slug: string, option?: string) => setLines((prev) => prev.filter((l) => !same(l, slug, option))), [])
  const clear = useCallback(() => setLines([]), [])

  const value = useMemo<CartState>(() => {
    const items = lines.map((l) => ({ ...l, product: bySlug(l.slug)! }))
    return {
      lines,
      open,
      add,
      setQuantity,
      remove,
      clear,
      setOpen,
      items,
      count: items.reduce((n, l) => n + l.quantity, 0),
      subtotal: items.reduce((n, l) => n + l.quantity * l.product.price, 0),
    }
  }, [lines, open, add, setQuantity, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartState {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart outside CartProvider')
  return ctx
}

// Les prix restent en euros (le catalogue est vendu en euros) ; seul le
// formatage suit la langue : « 12 500 € » en français, « 12.500 € » en allemand.
let moneyLocale = 'fr-FR'
const formatters = new Map<string, Intl.NumberFormat>()

function formatter(digits: number) {
  const key = `${moneyLocale}:${digits}`
  let instance = formatters.get(key)
  if (!instance) {
    instance = new Intl.NumberFormat(moneyLocale, { style: 'currency', currency: 'EUR', minimumFractionDigits: digits, maximumFractionDigits: digits })
    formatters.set(key, instance)
  }
  return instance
}

const MONEY_LOCALE: Record<Lang, string> = {
  fr: 'fr-FR',
  de: 'de-DE',
  sl: 'sl-SI',
  en: 'en-AU',
  da: 'da-DK',
  nl: 'nl-NL',
}

export function setMoneyLocale(lang: Lang) {
  moneyLocale = MONEY_LOCALE[lang] ?? 'fr-FR'
}

export const money = (value: number) => (Number.isInteger(value) ? formatter(0) : formatter(2)).format(value)
