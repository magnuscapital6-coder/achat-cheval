import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { products as marketListings, type Category, type Product } from '../../data/products'

/** Une annonce ajoutée depuis /admin : elle vit en base, pas dans le fichier. */
export interface OwnListing {
  id: string
  slug: string
  name: string
  price: number
  category: Category
  breed?: string
  sex?: string
  age?: string
  height?: string
  discipline?: string
  place?: string
  description: string
  details: string[]
  image: string | null
  createdAt: string
}

interface Catalogue {
  /** Vos chevaux d'abord, puis le reste du catalogue. */
  products: Product[]
  own: OwnListing[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const CatalogueContext = createContext<Catalogue | null>(null)

const initials = (value: string) =>
  value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()

export function listingToProduct(listing: OwnListing): Product {
  return {
    slug: listing.slug,
    name: listing.name,
    price: listing.price,
    category: listing.category,
    kind: 'animal',
    image: listing.image ?? undefined,
    mark: initials(listing.breed || listing.name),
    short: [listing.breed, listing.sex, listing.age, listing.place].filter(Boolean).join(' · '),
    description: listing.description,
    details: listing.details,
    breed: listing.breed,
    sex: listing.sex,
    age: listing.age,
    height: listing.height,
    discipline: listing.discipline,
    place: listing.place,
  }
}

export function CatalogueProvider({ children }: { children: ReactNode }) {
  const [own, setOwn] = useState<OwnListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/listings')
      const body = (await response.json()) as { listings?: OwnListing[]; error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Chargement impossible.')
      setOwn(body.listings ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const products = useMemo(() => [...own.map(listingToProduct), ...marketListings], [own])

  const value = useMemo<Catalogue>(() => ({ products, own, loading, error, refresh }), [products, own, loading, error, refresh])

  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>
}

export function useCatalogue() {
  const context = useContext(CatalogueContext)
  if (!context) throw new Error('useCatalogue doit être utilisé dans <CatalogueProvider>')
  return context
}
