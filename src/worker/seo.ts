// Balises SEO, plan du site et robots servis par le Worker.
//
// L'app est une SPA : sans ce module, toutes les URL renverraient le même
// <title> et le même canonical. Le Worker réécrit donc l'en-tête de
// index.html à la demande, selon le marché déduit du chemin.

import { MARKETS, marketFromPath, stripMarket, type Market } from '../data/locales'
import { alternates, canonicalFor, formatPrice, seoFor, structuredData, type SeoProduct } from '../data/seo'

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)

export interface SeoInput {
  origin: string
  /** Chemin demandé, préfixe de marché compris. */
  pathname: string
  /** Query string, `?` compris : elle porte la catégorie de la boutique. */
  search?: string
  /** URL inconnue : la réponse part en 404 et ne doit pas être indexée. */
  notFound?: boolean
  product?: SeoProduct
}

export function resolve(input: SeoInput) {
  const market = marketFromPath(input.pathname)
  const path = stripMarket(`${input.pathname}${input.search ?? ''}`, market)
  const seo = seoFor(path, market, input.product)
  const canonical = canonicalFor(path, market, input.origin)
  const image = input.product?.image ? new URL(input.product.image, input.origin).toString() : `${input.origin}/images/hero.jpg`
  return { market, path, seo, canonical, image }
}

function headTags(input: SeoInput) {
  const { market, path, seo, canonical, image } = resolve(input)
  const alts = alternates(path, input.origin)
  const ogLocale = market.hreflang.replace('-', '_')
  const others = MARKETS.filter((m) => m.id !== market.id).map((m) => `<meta property="og:locale:alternate" content="${m.hreflang.replace('-', '_')}" />`)

  const graph = structuredData(path, market, input.origin, input.product)

  // Le tunnel d'achat n'a rien à faire dans un index : panier vide côté robot,
  // et une confirmation de commande n'est pas une page d'entrée.
  const bare = path.split('?')[0].replace(/\/$/, '')
  const transactional = /^\/(?:checkout|order\/[^/]+)$/.test(bare)
  const noindex = input.notFound || transactional || bare === '/admin'
  const indexable = !input.notFound

  return [
    ...(noindex ? ['<meta name="robots" content="noindex, nofollow" />'] : []),
    ...(indexable ? [`<link rel="canonical" href="${escapeHtml(canonical)}" />`] : []),
    ...(indexable ? alts.map((alternate) => `<link rel="alternate" hreflang="${alternate.hreflang}" href="${escapeHtml(alternate.href)}" />`) : []),
    `<meta property="og:type" content="${input.product ? 'product' : 'website'}" />`,
    `<meta property="og:site_name" content="achat-cheval" />`,
    `<meta property="og:title" content="${escapeHtml(seo.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(seo.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:locale" content="${ogLocale}" />`,
    ...others,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(seo.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(seo.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    ...(indexable
      ? [`<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`]
      : []),
  ].join('\n    ')
}

/** Réécrit l'en-tête d'index.html pour la page et le marché demandés. */
export function applySeo(html: string, input: SeoInput) {
  const { market, seo } = resolve(input)
  let out = html
  out = out.replace(/<html lang="[^"]*"/, `<html lang="${market.lang}"`)
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(seo.title)}</title>`)
  out = out.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(seo.description)}" />`)
  out = out.replace('</head>', `  ${headTags(input)}\n  </head>`)
  return out
}

export interface SitemapProduct {
  slug: string
  /** Horodatage ISO de la dernière modification de la fiche. */
  lastmod?: string
}

/** Le plan du site n'accepte qu'une date, pas un horodatage complet. */
function day(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10)
}

/**
 * Toutes les URL indexables, avec leurs versions linguistiques. Les pages fixes
 * n'ont pas de `lastmod` : le sitemap est régénéré à chaque requête, y mettre
 * la date du jour annoncerait un contenu modifié tous les jours.
 */
export function sitemap(origin: string, products: SitemapProduct[]) {
  const entries: { path: string; lastmod?: string }[] = [
    { path: '/' },
    { path: '/shop' },
    { path: '/about' },
    { path: '/shop?category=chevaux' },
    { path: '/shop?category=poneys' },
    { path: '/shop?category=autres' },
    ...products.map((product) => ({ path: `/product/${product.slug}`, lastmod: day(product.lastmod) })),
  ]

  const urls = entries.flatMap(({ path, lastmod }) =>
    MARKETS.map((market) => {
      const clean = path.split('?')[0]
      const loc = `${origin}${market.prefix}${clean === '/' ? '/' : clean}${path.includes('?') ? `?${path.split('?')[1]}` : ''}`
      const links = alternates(path, origin).map(
        (alternate) => `    <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${escapeHtml(alternate.href)}" />`,
      )
      return [
        '  <url>',
        `    <loc>${escapeHtml(loc)}</loc>`,
        ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
        ...links,
        '    <changefreq>weekly</changefreq>',
        path.startsWith('/product/') ? '    <priority>0.8</priority>' : '    <priority>0.9</priority>',
        '  </url>',
      ].join('\n')
    }),
  )

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}

export function robots(origin: string) {
  return ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /*/admin', 'Disallow: /api/', '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n')
}

export function marketOf(pathname: string): Market {
  return marketFromPath(pathname)
}

export { formatPrice }
