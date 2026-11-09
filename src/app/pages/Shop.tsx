import { AnimatePresence, motion } from 'motion/react'
import { SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { categories, type Category } from '../../data/products'
import { useCatalogue } from '../lib/catalogue'
import { ProductCard } from '../components/ProductCard'
import { Button, Container } from '../components/ui'
import { cx } from '../lib/cx'

const categoryOptions: { key: Category; label: string }[] = categories.map((c) => ({ key: c.key, label: c.label }))
const priceOptions = [
  { key: '', label: 'Tous les prix' },
  { key: '0-10000', label: 'Moins de 10 000 €' },
  { key: '10000-25000', label: '10 000 à 25 000 €' },
  { key: '25000-', label: 'Plus de 25 000 €' },
]
const sortOptions = [
  { key: 'featured', label: 'En vedette' },
  { key: 'price-asc', label: 'Prix croissant' },
  { key: 'price-desc', label: 'Prix décroissant' },
]

export function Shop() {
  const { products, own } = useCatalogue()
  const ownSlugs = useMemo(() => new Set(own.map((listing) => listing.slug)), [own])
  const [params, setParams] = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)
  const category = params.get('category') ?? ''
  const price = params.get('price') ?? ''
  const sort = params.get('sort') ?? 'featured'

  function update(next: Record<string, string>) {
    const merged = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) v ? merged.set(k, v) : merged.delete(k)
    setParams(merged, { replace: true })
  }

  const list = useMemo(() => {
    let items = products.filter((p) => !category || p.category === category)
    if (price) {
      const [min, max] = price.split('-').map((v) => (v === '' ? undefined : Number(v)))
      items = items.filter((p) => (min === undefined || p.price >= min) && (max === undefined || p.price < max))
    }
    if (sort === 'price-asc') items = [...items].sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') items = [...items].sort((a, b) => b.price - a.price)
    // Vos propres chevaux d'abord, puis les fiches mises en avant.
    if (sort === 'featured')
      items = [...items].sort(
        (a, b) => Number(ownSlugs.has(b.slug)) - Number(ownSlugs.has(a.slug)) || (b.featured ? 1 : 0) - (a.featured ? 1 : 0),
      )
    return items
  }, [products, ownSlugs, category, price, sort])

  const title = categoryOptions.find((c) => c.key === category)?.label ?? 'Tout le catalogue'
  const activeCount = (category ? 1 : 0) + (price ? 1 : 0)

  const filters = (
    <div className="flex flex-col gap-8">
      <FilterGroup label="Catégorie">
        {[{ key: '', label: 'Tout' }, ...categoryOptions].map((c) => (
          <FilterOption key={c.key} active={category === c.key} onClick={() => update({ category: c.key })}>
            {c.label}
            <span className="ml-auto text-[12.5px] tabular-nums text-faint">{c.key ? products.filter((p) => p.category === c.key).length : products.length}</span>
          </FilterOption>
        ))}
      </FilterGroup>
      <FilterGroup label="Prix">
        {priceOptions.map((p) => (
          <FilterOption key={p.key} active={price === p.key} onClick={() => update({ price: p.key })}>
            {p.label}
          </FilterOption>
        ))}
      </FilterGroup>
    </div>
  )

  return (
    <Container className="pt-10 sm:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[14px] text-muted">Boutique</p>
          <h1 className="font-display mt-2 text-[44px] sm:text-[56px]">
            {title} <span className="text-[24px] text-faint">{list.length}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <SlidersHorizontal />
            Filtres{activeCount > 0 && ` (${activeCount})`}
          </Button>
          <label className="relative">
            <span className="sr-only">Trier</span>
            <select value={sort} onChange={(e) => update({ sort: e.target.value })} className="h-10 appearance-none rounded-[12px] border border-line-strong bg-transparent pl-4 pr-9 text-[14px] focus:border-fg focus:outline-none">
              {sortOptions.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </label>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-14">
        <aside className="hidden lg:block">
          <div className="sticky top-24">{filters}</div>
        </aside>
        <div>
          <motion.div layout className="grid grid-cols-2 gap-x-4 gap-y-10 xl:grid-cols-3 xl:gap-x-6">
            <AnimatePresence mode="popLayout">
              {list.map((p, i) => (
                <motion.div key={p.slug} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  <ProductCard product={p} index={i} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
          {list.length === 0 && (
            <div className="py-24 text-center">
              <p className="font-display text-[32px]">Rien dans cette sélection</p>
              <Button variant="secondary" className="mt-6" onClick={() => update({ category: '', price: '' })}>
                Effacer les filtres
              </Button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 z-50 bg-fg/30 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)}>
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-2 bottom-2 rounded-dialog bg-bg p-6 shadow-drawer"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <p className="font-display text-[28px]">Filtres</p>
                <button type="button" aria-label="Fermer" onClick={() => setMobileOpen(false)} className="grid size-10 place-items-center rounded-control hover:bg-surface-2">
                  <X className="size-5" />
                </button>
              </div>
              <div className="mt-6">{filters}</div>
              <Button className="mt-8 w-full" onClick={() => setMobileOpen(false)}>
                Afficher {list.length} {list.length === 1 ? 'résultat' : 'résultats'}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Container>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] font-medium">{label}</p>
      <ul className="mt-3 flex flex-col gap-0.5">{children}</ul>
    </div>
  )
}

function FilterOption({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cx('flex h-9 w-full items-center gap-2 rounded-[11px] px-2.5 text-left text-[14px] transition-colors', active ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg')}
      >
        {children}
      </button>
    </li>
  )
}
