import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

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

const euro = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const euroCents = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

export const money = (value: number) => (Number.isInteger(value) ? euro.format(value) : euroCents.format(value))
