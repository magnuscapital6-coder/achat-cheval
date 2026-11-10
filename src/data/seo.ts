// Textes de référencement, un jeu par marché. Ils vivent à part du dictionnaire
// d'interface : l'interface est traduite par langue, le SEO par marché (la
// Belgique et la France partagent le français mais pas les mêmes mots-clés).
//
// Utilisé par le Worker (balises envoyées aux moteurs) et par l'app (mise à
// jour des mêmes balises quand on navigue sans recharger).

import type { Market, MarketId } from './locales'
import { MARKETS } from './locales'

export interface PageSeo {
  title: string
  description: string
}

type PageKey = 'home' | 'shop' | 'chevaux' | 'poneys' | 'autres' | 'stables'

const COPY: Record<MarketId, Record<PageKey, PageSeo>> = {
  'fr-fr': {
    home: {
      title: 'Chevaux et poneys à vendre en France — achat-cheval',
      description:
        'Chevaux, poneys et ânes à la vente en France : chaque fiche donne la race, l’âge, la taille, la discipline et le prix. Photos réelles et visite sur rendez-vous.',
    },
    shop: {
      title: 'Annonces de chevaux, poneys et ânes — tout le catalogue',
      description:
        'Parcourez les annonces à la vente : chevaux de sport, poneys de club et ânes. Prix en euros, département indiqué, visite sur rendez-vous.',
    },
    chevaux: {
      title: 'Chevaux à vendre — CSO, dressage, concours complet',
      description: 'Chevaux à la vente en France : Selle Français, KWPN, PRE… prix, âge, taille et discipline sur chaque fiche. Visite sur rendez-vous.',
    },
    poneys: {
      title: 'Poneys à vendre — clubs, familles et concours',
      description: 'Poneys français de selle, New Forest et autres races : fiches complètes avec prix, taille, discipline et département.',
    },
    autres: {
      title: 'Ânes à vendre — Grand Noir du Berry et miniatures',
      description: 'Ânes et ânons à la vente en France : race, âge, prix et département, avec une photo sur chaque fiche.',
    },
    stables: {
      title: 'L’écurie — comment nous choisissons les chevaux',
      description: 'Notre méthode : des fiches complètes, des photos, et les réponses aux questions qui comptent avant de vous déplacer.',
    },
  },
  'fr-be': {
    home: {
      title: 'Chevaux et poneys à vendre pour la Belgique — achat-cheval',
      description:
        'Sélection de chevaux et poneys en France, présentée aux acheteurs belges : fiches complètes, prix en euros, transport vers la Belgique sur devis.',
    },
    shop: {
      title: 'Annonces de chevaux et poneys — catalogue pour la Belgique',
      description: 'Chevaux, poneys et ânes à la vente : race, âge, taille, discipline et prix. Visite sur rendez-vous en France, transport vers la Belgique sur devis.',
    },
    chevaux: {
      title: 'Chevaux à vendre pour la Belgique — CSO et dressage',
      description: 'Chevaux de sport sélectionnés en France : prix, âge, taille et discipline sur chaque fiche. Transport vers la Belgique sur devis.',
    },
    poneys: {
      title: 'Poneys à vendre pour la Belgique — clubs et familles',
      description: 'Poneys de club et de famille, fiches complètes avec prix et taille. Visite en France et transport vers la Belgique sur devis.',
    },
    autres: {
      title: 'Ânes à vendre pour la Belgique',
      description: 'Ânes et ânons à la vente : race, âge, prix et département. Transport vers la Belgique organisé sur devis.',
    },
    stables: {
      title: 'L’écurie — acheter un cheval depuis la Belgique',
      description: 'Comment nous sélectionnons les chevaux, ce que couvre la visite et comment s’organise le transport vers la Belgique.',
    },
  },
  'fr-ch': {
    home: {
      title: 'Chevaux et poneys à vendre pour la Suisse romande — achat-cheval',
      description:
        'Chevaux et poneys sélectionnés en France pour les acheteurs suisses : fiches complètes, prix en euros et transport vers la Suisse sur devis.',
    },
    shop: {
      title: 'Annonces de chevaux et poneys — catalogue pour la Suisse',
      description: 'Chevaux, poneys et ânes à la vente : race, âge, taille, discipline et prix. Visite sur rendez-vous et transport vers la Suisse sur devis.',
    },
    chevaux: {
      title: 'Chevaux à vendre pour la Suisse romande',
      description: 'Chevaux de sport et de loisir sélectionnés en France : prix, âge, taille et discipline. Transport vers la Suisse sur devis.',
    },
    poneys: {
      title: 'Poneys à vendre pour la Suisse romande',
      description: 'Poneys de club et de famille, fiches complètes avec prix et taille, livrables en Suisse sur devis.',
    },
    autres: {
      title: 'Ânes à vendre pour la Suisse',
      description: 'Ânes et ânons à la vente, race, âge et prix sur chaque fiche. Transport vers la Suisse organisé sur devis.',
    },
    stables: {
      title: 'L’écurie — acheter un cheval depuis la Suisse',
      description: 'Notre méthode de sélection, le déroulé d’une visite et l’organisation du transport vers la Suisse romande.',
    },
  },
  'fr-lu': {
    home: {
      title: 'Chevaux et poneys à vendre pour le Luxembourg — achat-cheval',
      description:
        'Chevaux et poneys sélectionnés en France pour les acheteurs luxembourgeois : fiches complètes, prix en euros et transport vers le Luxembourg sur devis.',
    },
    shop: {
      title: 'Annonces de chevaux et poneys — catalogue pour le Luxembourg',
      description: 'Chevaux, poneys et ânes à la vente : race, âge, taille, discipline et prix. Visite sur rendez-vous et transport vers le Luxembourg sur devis.',
    },
    chevaux: {
      title: 'Chevaux à vendre pour le Luxembourg — CSO et dressage',
      description: 'Chevaux de sport et de loisir sélectionnés en France : prix, âge, taille et discipline sur chaque fiche. Transport vers le Luxembourg sur devis.',
    },
    poneys: {
      title: 'Poneys à vendre pour le Luxembourg — clubs et familles',
      description: 'Poneys de club et de famille, fiches complètes avec prix et taille. Visite en France et transport vers le Luxembourg sur devis.',
    },
    autres: {
      title: 'Ânes à vendre pour le Luxembourg',
      description: 'Ânes et ânons à la vente : race, âge, prix et département. Transport vers le Luxembourg organisé sur devis.',
    },
    stables: {
      title: 'L’écurie — acheter un cheval depuis le Luxembourg',
      description: 'Comment nous sélectionnons les chevaux, ce que couvre la visite et comment s’organise le transport vers le Luxembourg.',
    },
  },
  'de-de': {
    home: {
      title: 'Pferde und Ponys kaufen — Anzeigen aus Frankreich',
      description:
        'Pferde, Ponys und Esel aus Frankreich: vollständige Anzeigen mit Rasse, Alter, Stockmaß, Disziplin und Preis. Besichtigung nach Vereinbarung, Transport nach Deutschland auf Anfrage.',
    },
    shop: {
      title: 'Alle Anzeigen — Pferde, Ponys und Esel',
      description: 'Pferde, Ponys und Esel mit Rasse, Alter, Größe, Disziplin und Preis. Besichtigung vor Ort, Transport nach Deutschland auf Anfrage.',
    },
    chevaux: {
      title: 'Pferde kaufen — Springen, Dressur, Vielseitigkeit',
      description: 'Selle Français, KWPN, PRE und mehr: Preis, Alter, Stockmaß und Disziplin auf jeder Anzeige, mit echtem Foto.',
    },
    poneys: {
      title: 'Ponys kaufen — für Vereine und Familien',
      description: 'Poney Français de Selle, New Forest und weitere Rassen: vollständige Angaben mit Preis und Stockmaß.',
    },
    autres: {
      title: 'Esel kaufen — Grand Noir du Berry und Miniaturesel',
      description: 'Esel und Eselsfohlen aus Frankreich: Rasse, Alter, Preis und Region auf jeder Anzeige.',
    },
    stables: {
      title: 'Der Stall — so wählen wir die Pferde',
      description: 'Vollständige Anzeigen, echte Fotos und klare Antworten auf die Fragen, die vor der Anreise zählen.',
    },
  },
  'de-ch': {
    home: {
      title: 'Pferde und Ponys kaufen für die Schweiz — Anzeigen aus Frankreich',
      description:
        'Pferde, Ponys und Esel aus Frankreich für Käufer in der Schweiz: vollständige Anzeigen, Preise in Euro, Transport in die Schweiz auf Anfrage.',
    },
    shop: {
      title: 'Alle Anzeigen — Pferde und Ponys für die Schweiz',
      description: 'Anzeigen mit Rasse, Alter, Größe und Preis. Besichtigung nach Vereinbarung, Transport in die Schweiz auf Anfrage.',
    },
    chevaux: {
      title: 'Pferde kaufen für die Schweiz — Springen und Dressur',
      description: 'Sportpferde aus Frankreich: Preis, Alter, Stockmaß und Disziplin auf jeder Anzeige. Transport in die Schweiz auf Anfrage.',
    },
    poneys: {
      title: 'Ponys kaufen für die Schweiz',
      description: 'Ponys für Vereine und Familien, mit vollständigen Angaben und Preis. Transport in die Schweiz auf Anfrage.',
    },
    autres: {
      title: 'Esel kaufen für die Schweiz',
      description: 'Esel und Eselsfohlen aus Frankreich: Rasse, Alter und Preis. Transport in die Schweiz auf Anfrage.',
    },
    stables: {
      title: 'Der Stall — ein Pferd aus der Schweiz kaufen',
      description: 'So wählen wir die Pferde, das läuft eine Besichtigung ab und so organisieren wir den Transport in die Schweiz.',
    },
  },
  'de-lu': {
    home: {
      title: 'Pferde und Ponys kaufen in Luxemburg — Anzeigen aus Frankreich',
      description:
        'Pferde, Ponys und Esel aus Frankreich für Käufer in Luxemburg: vollständige Anzeigen, Preise in Euro, Transport nach Luxemburg auf Anfrage.',
    },
    shop: {
      title: 'Alle Anzeigen — Pferde und Ponys für Luxemburg',
      description: 'Anzeigen mit Rasse, Alter, Größe und Preis. Besichtigung nach Vereinbarung, Transport nach Luxemburg auf Anfrage.',
    },
    chevaux: {
      title: 'Pferde kaufen für Luxemburg — Springen und Dressur',
      description: 'Sportpferde aus Frankreich: Preis, Alter, Stockmaß und Disziplin auf jeder Anzeige. Transport nach Luxemburg auf Anfrage.',
    },
    poneys: {
      title: 'Ponys kaufen für Luxemburg — für Vereine und Familien',
      description: 'Ponys für Vereine und Familien, mit vollständigen Angaben und Preis. Transport nach Luxemburg auf Anfrage.',
    },
    autres: {
      title: 'Esel kaufen für Luxemburg',
      description: 'Esel und Eselsfohlen aus Frankreich: Rasse, Alter und Preis. Transport nach Luxemburg auf Anfrage.',
    },
    stables: {
      title: 'Der Stall — ein Pferd aus Luxemburg kaufen',
      description: 'So wählen wir die Pferde, das läuft eine Besichtigung ab und so organisieren wir den Transport nach Luxemburg.',
    },
  },
  'sl-si': {
    home: {
      title: 'Konji in poniji naprodaj — oglasi iz Francije',
      description:
        'Konji, poniji in osli iz Francije: vsak oglas navaja pasmo, starost, višino, disciplino in ceno. Ogled po dogovoru, prevoz v Slovenijo po ponudbi.',
    },
    shop: {
      title: 'Vsi oglasi — konji, poniji in osli',
      description: 'Oglasi s pasmo, starostjo, višino, disciplino in ceno. Ogled po dogovoru, prevoz v Slovenijo po ponudbi.',
    },
    chevaux: {
      title: 'Konji naprodaj — preskakovanje ovir, dresura, vsestranski',
      description: 'Selle Français, KWPN, PRE in druge pasme: cena, starost, višina in disciplina v vsakem oglasu, s pravo fotografijo.',
    },
    poneys: {
      title: 'Poniji naprodaj — za klube in družine',
      description: 'Poney Français de Selle, New Forest in druge pasme: popolni podatki s ceno in višino.',
    },
    autres: {
      title: 'Osli naprodaj — Grand Noir du Berry in miniaturne pasme',
      description: 'Osli in oslički iz Francije: pasma, starost, cena in regija v vsakem oglasu.',
    },
    stables: {
      title: 'Hlev — kako izbiramo konje',
      description: 'Popolni oglasi, prave fotografije in jasni odgovori na vprašanja, ki štejejo pred potjo.',
    },
  },
  'en-au': {
    home: {
      title: 'Horses and ponies for sale — shipped to Australia',
      description:
        'Horses, ponies and donkeys from France: every listing gives breed, age, height, discipline and price. Viewing by appointment, shipping to Australia quoted per horse.',
    },
    shop: {
      title: 'Horse and pony listings — the full catalogue',
      description: 'Sport horses, club ponies and donkeys with breed, age, height, discipline and price. Viewing by appointment, shipping to Australia on request.',
    },
    chevaux: {
      title: 'Horses for sale — show jumping, dressage, eventing',
      description: 'Selle Français, KWPN, PRE and more: price, age, height and discipline on every listing, with a real photo.',
    },
    poneys: {
      title: 'Ponies for sale — for clubs and families',
      description: 'Poney Français de Selle, New Forest and other breeds: complete details with price and height.',
    },
    autres: {
      title: 'Donkeys for sale — Grand Noir du Berry and miniatures',
      description: 'Donkeys and foals from France: breed, age, price and region on every listing.',
    },
    stables: {
      title: 'The yard — how we pick the horses',
      description: 'Complete listings, real photos and straight answers to the questions that matter before you travel.',
    },
  },
  'da-dk': {
    home: {
      title: 'Heste og ponyer til salg — levering til Danmark',
      description:
        'Heste, ponyer og æsler fra Frankrig: hver annonce viser race, alder, stangmål, disciplin og pris. Besigtigelse efter aftale, transport til Danmark efter tilbud.',
    },
    shop: {
      title: 'Alle annoncer — heste, ponyer og æsler',
      description: 'Sportheste, klubponyer og æsler med race, alder, højde, disciplin og pris. Besigtigelse efter aftale, transport til Danmark efter tilbud.',
    },
    chevaux: {
      title: 'Heste til salg — springning, dressur, military',
      description: 'Selle Français, KWPN, PRE og flere: pris, alder, stangmål og disciplin i hver annonce, med ægte foto.',
    },
    poneys: {
      title: 'Ponyer til salg — til klubber og familier',
      description: 'Poney Français de Selle, New Forest og andre racer: komplette oplysninger med pris og stangmål.',
    },
    autres: {
      title: 'Æsler til salg — Grand Noir du Berry og miniatyræsler',
      description: 'Æsler og føl fra Frankrig: race, alder, pris og region i hver annonce.',
    },
    stables: {
      title: 'Stalden — sådan vælger vi hestene',
      description: 'Komplette annoncer, ægte fotos og klare svar på de spørgsmål, der betyder noget, før du tager af sted.',
    },
  },
  'nl-nl': {
    home: {
      title: 'Paarden en pony’s te koop — levering naar Nederland',
      description:
        'Paarden, pony’s en ezels uit Frankrijk: elke advertentie vermeldt ras, leeftijd, stokmaat, discipline en prijs. Bezichtiging op afspraak, transport naar Nederland op aanvraag.',
    },
    shop: {
      title: 'Alle advertenties — paarden, pony’s en ezels',
      description: 'Sportpaarden, clubpony’s en ezels met ras, leeftijd, hoogte, discipline en prijs. Bezichtiging op afspraak, transport naar Nederland op aanvraag.',
    },
    chevaux: {
      title: 'Paarden te koop — springen, dressuur, eventing',
      description: 'Selle Français, KWPN, PRE en meer: prijs, leeftijd, stokmaat en discipline bij elke advertentie, met een echte foto.',
    },
    poneys: {
      title: 'Pony’s te koop — voor clubs en gezinnen',
      description: 'Poney Français de Selle, New Forest en andere rassen: volledige gegevens met prijs en stokmaat.',
    },
    autres: {
      title: 'Ezels te koop — Grand Noir du Berry en miniatuurrassen',
      description: 'Ezels en veulens uit Frankrijk: ras, leeftijd, prijs en regio bij elke advertentie.',
    },
    stables: {
      title: 'De stal — zo kiezen wij de paarden',
      description: 'Volledige advertenties, echte foto’s en duidelijke antwoorden op de vragen die tellen voordat je afreist.',
    },
  },
}

const PRODUCT_SUFFIX: Record<MarketId, string> = {
  'fr-fr': 'Cheval à vendre',
  'fr-be': 'Cheval à vendre, transport vers la Belgique',
  'fr-ch': 'Cheval à vendre, transport vers la Suisse',
  'fr-lu': 'Cheval à vendre, transport vers le Luxembourg',
  'de-de': 'Pferd kaufen, Transport nach Deutschland',
  'de-ch': 'Pferd kaufen, Transport in die Schweiz',
  'de-lu': 'Pferd kaufen, Transport nach Luxemburg',
  'sl-si': 'Konj naprodaj, prevoz v Slovenijo',
  'en-au': 'Horse for sale, shipping to Australia',
  'da-dk': 'Hest til salg, transport til Danmark',
  'nl-nl': 'Paard te koop, transport naar Nederland',
}

const LOCALE_TAG: Record<MarketId, string> = {
  'fr-fr': 'fr-FR',
  'fr-be': 'fr-BE',
  'fr-ch': 'fr-CH',
  'fr-lu': 'fr-LU',
  'de-de': 'de-DE',
  'de-ch': 'de-CH',
  'de-lu': 'de-LU',
  'sl-si': 'sl-SI',
  'en-au': 'en-AU',
  'da-dk': 'da-DK',
  'nl-nl': 'nl-NL',
}

export function formatPrice(price: number, market: Market) {
  return new Intl.NumberFormat(LOCALE_TAG[market.id], { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(price)
}

export interface SeoProduct {
  name: string
  price: number
  description: string
  image?: string | null
  category: string
  breed?: string
  age?: string
  place?: string
}

/** Métadonnées d'une page, préfixe de marché déjà retiré (`/shop`, `/product/x`). */
export function seoFor(path: string, market: Market, product?: SeoProduct): PageSeo {
  const params = new URLSearchParams(path.split('?')[1] ?? '')
  const clean = path.split('?')[0] || '/'

  if (product && clean.startsWith('/product/')) {
    return {
      title: `${product.name} — ${formatPrice(product.price, market)} | ${PRODUCT_SUFFIX[market.id]}`,
      description: `${product.description.slice(0, 150).trim()}${product.description.length > 150 ? '…' : ''} ${PRODUCT_SUFFIX[market.id]}.`,
    }
  }

  if (clean === '/' || clean === '') return COPY[market.id].home
  if (clean === '/about') return COPY[market.id].stables
  if (clean === '/shop') {
    const category = params.get('category')
    if (category === 'chevaux' || category === 'poneys' || category === 'autres') return COPY[market.id][category]
    return COPY[market.id].shop
  }
  if (clean === '/admin') return { title: 'Espace propriétaire — achat-cheval', description: 'Publiez et gérez vos annonces.' }
  return COPY[market.id].home
}

/**
 * Seule la catégorie mérite sa propre URL indexée : les filtres de prix et de
 * tri pointent tous vers la même page, pour éviter le contenu dupliqué.
 */
function canonicalQuery(path: string) {
  const category = new URLSearchParams(path.split('?')[1] ?? '').get('category')
  return category === 'chevaux' || category === 'poneys' || category === 'autres' ? `?category=${category}` : ''
}

/**
 * Les versions linguistiques d'une même page, pour les balises hreflang.
 * `x-default` ferme la liste et pointe vers la version France.
 */
export function alternates(path: string, origin: string) {
  const clean = path.split('?')[0] || '/'
  const query = canonicalQuery(path)
  const versions = MARKETS.map((market) => ({
    hreflang: market.hreflang,
    href: `${origin}${market.prefix}${clean === '/' ? '/' : clean}${query}`,
  }))
  return [...versions, { hreflang: 'x-default', href: `${origin}${clean === '/' ? '/' : clean}${query}` }]
}

export function canonicalFor(path: string, market: Market, origin: string) {
  const clean = path.split('?')[0] || '/'
  return `${origin}${market.prefix}${clean === '/' ? '/' : clean}${canonicalQuery(path)}`
}

/** Données structurées : entreprise à la racine, produit sur une fiche. */
export function structuredData(path: string, market: Market, origin: string, product?: SeoProduct): Record<string, unknown>[] {
  const clean = path.split('?')[0] || '/'
  const homeUrl = `${origin}${market.prefix || ''}/`
  const organization = {
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: 'achat-cheval',
    url: homeUrl,
    logo: `${origin}/favicon.svg`,
    areaServed: MARKETS.map((m) => ({ '@type': 'Country', name: m.label })),
  }

  if (product && clean.startsWith('/product/')) {
    return [
      organization,
      {
        '@type': 'Product',
        name: product.name,
        description: product.description,
        image: product.image ? `${origin}${product.image}` : `${origin}/images/hero.jpg`,
        category: product.category,
        brand: { '@type': 'Brand', name: 'achat-cheval' },
        offers: {
          '@type': 'Offer',
          price: product.price,
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
          url: canonicalFor(clean, market, origin),
          seller: { '@id': `${origin}/#organization` },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'achat-cheval', item: homeUrl },
          { '@type': 'ListItem', position: 2, name: product.category, item: `${origin}${market.prefix}/shop?category=${product.category}` },
          { '@type': 'ListItem', position: 3, name: product.name, item: canonicalFor(clean, market, origin) },
        ],
      },
    ]
  }

  return [
    organization,
    {
      '@type': 'WebSite',
      '@id': `${origin}/#website`,
      name: 'achat-cheval',
      url: homeUrl,
      inLanguage: market.hreflang,
      publisher: { '@id': `${origin}/#organization` },
    },
  ]
}
