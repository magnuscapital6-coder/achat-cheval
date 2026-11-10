// Marchés et langues de la boutique. Ce fichier est partagé par l'app (React)
// et par le Worker (balises SEO, sitemap) : une seule source de vérité.
//
// Un marché = une URL. Le marché principal (France) vit à la racine ; les
// autres sont préfixés, ce qui donne à chaque marché francophone ou germanophone
// sa propre adresse pour les balises hreflang.

export type Lang = 'fr' | 'de' | 'sl' | 'en' | 'da' | 'nl'

export type MarketId =
  | 'fr-fr'
  | 'fr-be'
  | 'fr-ch'
  | 'fr-lu'
  | 'de-de'
  | 'de-ch'
  | 'de-lu'
  | 'sl-si'
  | 'en-au'
  | 'da-dk'
  | 'nl-nl'

export interface Market {
  id: MarketId
  /** Préfixe d'URL ; vide pour la France, qui occupe la racine. */
  prefix: string
  lang: Lang
  /** Code hreflang déclaré aux moteurs. */
  hreflang: string
  /** Nom du marché, dans la langue du marché. */
  label: string
  country: string
  /** Phrase de marché affichée en pied de page (transport, devise). */
  note: string
}

export const MARKETS: Market[] = [
  {
    id: 'fr-fr',
    prefix: '',
    lang: 'fr',
    hreflang: 'fr-FR',
    label: 'France',
    country: 'FR',
    note: 'Chevaux, poneys et ânes à la vente en France, visite sur rendez-vous.',
  },
  {
    id: 'fr-be',
    prefix: '/fr-be',
    lang: 'fr',
    hreflang: 'fr-BE',
    label: 'Belgique',
    country: 'BE',
    note: 'Achat depuis la Belgique : transport sur devis vers tout le pays.',
  },
  {
    id: 'fr-ch',
    prefix: '/fr-ch',
    lang: 'fr',
    hreflang: 'fr-CH',
    label: 'Suisse romande',
    country: 'CH',
    note: 'Achat depuis la Suisse romande : transport sur devis, prix en euros.',
  },
  {
    id: 'fr-lu',
    prefix: '/fr-lu',
    lang: 'fr',
    hreflang: 'fr-LU',
    label: 'Luxembourg',
    country: 'LU',
    note: 'Achat depuis le Luxembourg : transport sur devis, prix en euros.',
  },
  {
    id: 'de-de',
    prefix: '/de',
    lang: 'de',
    hreflang: 'de-DE',
    label: 'Deutschland',
    country: 'DE',
    note: 'Kauf aus Deutschland: Transport auf Anfrage, Preise in Euro.',
  },
  {
    id: 'de-ch',
    prefix: '/de-ch',
    lang: 'de',
    hreflang: 'de-CH',
    label: 'Schweiz',
    country: 'CH',
    note: 'Kauf aus der Schweiz: Transport auf Anfrage, Preise in Euro.',
  },
  {
    id: 'de-lu',
    prefix: '/de-lu',
    lang: 'de',
    hreflang: 'de-LU',
    label: 'Luxemburg',
    country: 'LU',
    note: 'Kauf aus Luxemburg: Transport auf Anfrage, Preise in Euro.',
  },
  {
    id: 'sl-si',
    prefix: '/sl',
    lang: 'sl',
    hreflang: 'sl-SI',
    label: 'Slovenija',
    country: 'SI',
    note: 'Nakup iz Slovenije: prevoz po ponudbi, cene v evrih.',
  },
  {
    id: 'en-au',
    prefix: '/en-au',
    lang: 'en',
    hreflang: 'en-AU',
    label: 'Australia',
    country: 'AU',
    note: 'Buying from Australia: prices in euros, shipping quoted per horse.',
  },
  {
    id: 'da-dk',
    prefix: '/da',
    lang: 'da',
    hreflang: 'da-DK',
    label: 'Danmark',
    country: 'DK',
    note: 'Køb fra Danmark: transport efter tilbud, priser i euro.',
  },
  {
    id: 'nl-nl',
    prefix: '/nl',
    lang: 'nl',
    hreflang: 'nl-NL',
    label: 'Nederland',
    country: 'NL',
    note: 'Koop vanuit Nederland: transport op aanvraag, prijzen in euro.',
  },
]

export const DEFAULT_MARKET = MARKETS[0]

/** Le préfixe le plus long d'abord : `/de-ch` doit gagner sur `/de`. */
const BY_PREFIX = [...MARKETS].filter((m) => m.prefix).sort((a, b) => b.prefix.length - a.prefix.length)

export function marketFromPath(pathname: string): Market {
  for (const market of BY_PREFIX) {
    if (pathname === market.prefix || pathname.startsWith(`${market.prefix}/`)) return market
  }
  return DEFAULT_MARKET
}

/** Retire le préfixe de marché d'un chemin, pour le repasser à React Router. */
export function stripMarket(pathname: string, market: Market) {
  if (!market.prefix) return pathname || '/'
  const rest = pathname.slice(market.prefix.length)
  return rest.startsWith('/') ? rest : `/${rest}`
}

/** Ajoute le préfixe de marché à un chemin interne. */
export function marketPath(path: string, market: Market) {
  const clean = path.startsWith('/') ? path : `/${path}`
  return market.prefix ? `${market.prefix}${clean === '/' ? '' : clean}` : clean
}

export const LANGS: Lang[] = ['fr', 'de', 'sl', 'en', 'da', 'nl']

export const langName: Record<Lang, string> = {
  fr: 'Français',
  de: 'Deutsch',
  sl: 'Slovenščina',
  en: 'English',
  da: 'Dansk',
  nl: 'Nederlands',
}

export const langCode: Record<Lang, string> = { fr: 'fr', de: 'de', sl: 'sl', en: 'en', da: 'da', nl: 'nl' }

/** Les marchés regroupés par langue, pour le sélecteur : onze entrées à plat sont illisibles. */
export const MARKETS_BY_LANG = LANGS.map((lang) => ({
  lang,
  markets: MARKETS.filter((market) => market.lang === lang),
})).filter((group) => group.markets.length > 0)
