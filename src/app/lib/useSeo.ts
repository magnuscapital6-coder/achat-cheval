import { useEffect } from 'react'
import { useLocation } from 'react-router'

import { alternates, canonicalFor, seoFor } from '../../data/seo'
import { useCatalogue } from './catalogue'
import { useI18n } from './i18n'

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

// La navigation interne ne recharge pas la page : les balises posées par le
// Worker doivent donc être remises à jour ici, sinon toutes les pages gardent
// le titre de la première.
export function useSeo() {
  const { market } = useI18n()
  const { products } = useCatalogue()
  const { pathname, search } = useLocation()

  useEffect(() => {
    const slug = pathname.startsWith('/product/') ? pathname.split('/')[2] : undefined
    const product = slug ? products.find((p) => p.slug === slug) : undefined
    // La query porte la catégorie : sans elle, toutes les pages de boutique
    // auraient le même titre.
    const path = pathname + search
    const seo = seoFor(path, market, product)
    const origin = window.location.origin
    const canonical = canonicalFor(path, market, origin)

    // Le tunnel d'achat et l'admin sont en `noindex` : la navigation interne
    // doit poser la balise, et la retirer en sortant.
    const bare = pathname.replace(/\/$/, '')
    const privatePage = /^\/(?:checkout|order\/[^/]+|admin)$/.test(bare)
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (privatePage) {
      if (!robots) {
        robots = document.createElement('meta')
        robots.name = 'robots'
        document.head.appendChild(robots)
      }
      robots.content = 'noindex, nofollow'
    } else {
      robots?.remove()
    }

    document.title = seo.title
    setMeta('name', 'description', seo.description)
    setMeta('property', 'og:title', seo.title)
    setMeta('property', 'og:description', seo.description)
    setMeta('property', 'og:url', canonical)
    setMeta('property', 'og:locale', market.hreflang.replace('-', '_'))
    setMeta('property', 'og:image', product?.image ? new URL(product.image, origin).toString() : `${origin}/images/hero.jpg`)

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }
    link.href = canonical

    for (const element of document.head.querySelectorAll('link[rel="alternate"][hreflang]')) element.remove()
    for (const alternate of alternates(path, origin)) {
      const element = document.createElement('link')
      element.rel = 'alternate'
      element.hreflang = alternate.hreflang
      element.href = alternate.href
      document.head.appendChild(element)
    }
  }, [pathname, search, market, products])
}
