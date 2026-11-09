// Le catalogue du fonds : dix chevaux, poneys et ânes, chacun avec sa photo
// dans public/images/market. Pour ajouter ou modifier vos propres chevaux,
// passez par /admin : la fiche part en base avec sa photo, sans toucher à ce
// fichier.

export type Category = 'chevaux' | 'poneys' | 'autres'

export const categories: { key: Category; label: string; image: string; blurb: string }[] = [
  { key: 'chevaux', label: 'Chevaux', image: '/images/equestrian-hero.jpg', blurb: 'Sport, loisir, élevage' },
  { key: 'poneys', label: 'Poneys', image: '/images/poneys.jpg', blurb: 'Pour les clubs et les familles' },
  { key: 'autres', label: 'Autres', image: '/images/noisette.jpg', blurb: 'Ânes et compagnie' },
]

export interface Product {
  slug: string
  name: string
  price: number
  category: Category
  kind?: 'animal'
  image?: string
  /** Initiales affichées à la place d'une photo quand il n'y en a pas. */
  mark?: string
  badge?: 'Nouveau' | 'Coup de cœur' | 'Dernière place'
  short: string
  description: string
  details: string[]
  breed?: string
  sex?: string
  age?: string
  height?: string
  discipline?: string
  place?: string
  materials?: string
  options?: { name: string; values: string[] }
  featured?: boolean
}

export const products: Product[] = [
  {
    slug: 'hongre-sf-13-ans-eure-et-loir',
    name: 'Hongre Selle Français, 13 ans',
    price: 29000,
    category: 'chevaux',
    kind: 'animal',
    image: '/images/market/hongre-sf-13-ans-eure-et-loir.jpg',
    mark: 'SF',
    short: 'Selle Français · Hongre · 13 ans · Eure-et-Loir',
    description:
      "Hongre Selle Français de 13 ans, engagé en concours de saut d’obstacles sur des épreuves de 1,30 à 1,35 m. Visible en Eure-et-Loir.",
    details: ['Race : Selle Français', 'Sexe : hongre', 'Âge : 13 ans', 'Discipline : CSO 1,30 – 1,35 m', 'Département : Eure-et-Loir'],
    breed: 'Selle Français',
    sex: 'Hongre',
    age: '13 ans',
    discipline: 'CSO 1,30 – 1,35 m',
    place: 'Eure-et-Loir',
    featured: true,
  },
  {
    slug: 'hongre-pfs-9-ans-hautes-alpes',
    name: 'Hongre PFS, 9 ans, 1,45 m',
    price: 15000,
    category: 'poneys',
    kind: 'animal',
    image: '/images/market/hongre-pfs-9-ans-hautes-alpes.jpg',
    mark: 'PFS',
    short: 'Poney Français de Selle · Hongre · 9 ans · 1,45 m',
    description:
      'Hongre Poney Français de Selle de 9 ans, 1,45 m au garrot, présenté en concours complet, saut d’obstacles et dressage. Visible dans les Hautes-Alpes.',
    details: ['Race : Poney Français de Selle', 'Sexe : hongre', 'Âge : 9 ans', 'Taille : 1,45 m', 'Disciplines : CCE, CSO, dressage', 'Département : Hautes-Alpes'],
    breed: 'Poney Français de Selle',
    sex: 'Hongre',
    age: '9 ans',
    height: '1,45 m',
    discipline: 'CCE · CSO · Dressage',
    place: 'Hautes-Alpes',
    featured: true,
  },
  {
    slug: 'entier-pre-9-ans-isere',
    name: 'Étalon PRE, 9 ans',
    price: 15000,
    category: 'chevaux',
    kind: 'animal',
    image: '/images/market/entier-pre-9-ans-isere.jpg',
    mark: 'PRE',
    short: 'PRE · Étalon · 9 ans · Isère',
    description: 'Étalon Pure Race Espagnole de 9 ans, travaillé en dressage et polyvalent, en Isère.',
    details: ['Race : PRE (Pure Race Espagnole)', 'Sexe : étalon', 'Âge : 9 ans', 'Discipline : dressage, polyvalent', 'Département : Isère'],
    breed: 'PRE',
    sex: 'Étalon',
    age: '9 ans',
    discipline: 'Dressage · Polyvalent',
    place: 'Isère',
    featured: true,
  },
  {
    slug: 'hongre-sf-5-ans-oise',
    name: 'Hongre Selle Français, 5 ans, 1,64 m',
    price: 24000,
    category: 'chevaux',
    kind: 'animal',
    image: '/images/market/hongre-sf-5-ans-oise.jpg',
    mark: 'SF',
    short: 'Selle Français · Hongre · 5 ans · 1,64 m',
    description: "Hongre Selle Français de 5 ans, 1,64 m, présenté au saut d’obstacles dans l’Oise.",
    details: ['Race : Selle Français', 'Sexe : hongre', 'Âge : 5 ans', 'Taille : 1,64 m', 'Discipline : saut d’obstacles', 'Département : Oise'],
    breed: 'Selle Français',
    sex: 'Hongre',
    age: '5 ans',
    height: '1,64 m',
    discipline: 'Saut d’obstacles',
    place: 'Oise',
  },
  {
    slug: 'jument-kwpn-4-ans-haute-garonne',
    name: 'Jument KWPN, 4 ans',
    price: 30000,
    category: 'chevaux',
    kind: 'animal',
    image: '/images/market/jument-kwpn-4-ans-haute-garonne.jpg',
    mark: 'KWPN',
    short: 'KWPN · Jument · 4 ans · Haute-Garonne',
    description: 'Jument KWPN de 4 ans orientée dressage et concours complet, fille de Jayson et petite-fille de Gribaldi.',
    details: ['Race : KWPN', 'Sexe : jument', 'Âge : 4 ans', 'Disciplines : dressage, CCE', 'Département : Haute-Garonne'],
    breed: 'KWPN',
    sex: 'Jument',
    age: '4 ans',
    discipline: 'Dressage · CCE',
    place: 'Haute-Garonne',
  },
  {
    slug: 'jument-pfs-8-ans-haute-vienne',
    name: 'Jument PFS, 8 ans',
    price: 10000,
    category: 'poneys',
    kind: 'animal',
    image: '/images/market/jument-pfs-8-ans-haute-vienne.jpg',
    mark: 'PFS',
    short: 'Poney Français de Selle · Jument · 8 ans · Haute-Vienne',
    description: 'Jument Poney Français de Selle de 8 ans, visible en Haute-Vienne, avec des vidéos de son travail disponibles.',
    details: ['Race : Poney Français de Selle', 'Sexe : jument', 'Âge : 8 ans', 'Département : Haute-Vienne'],
    breed: 'Poney Français de Selle',
    sex: 'Jument',
    age: '8 ans',
    place: 'Haute-Vienne',
  },
  {
    slug: 'hongre-new-forest-4-ans-vienne',
    name: 'Hongre New Forest, 4 ans',
    price: 6500,
    category: 'poneys',
    kind: 'animal',
    image: '/images/market/hongre-new-forest-4-ans-vienne.jpg',
    mark: 'NF',
    short: 'New Forest · Hongre · 4 ans · Vienne',
    description: 'Hongre New Forest de 4 ans, à voir dans la Vienne.',
    details: ['Race : New Forest', 'Sexe : hongre', 'Âge : 4 ans', 'Département : Vienne'],
    breed: 'New Forest',
    sex: 'Hongre',
    age: '4 ans',
    place: 'Vienne',
  },
  {
    slug: 'poulain-sf-moselle',
    name: 'Poulain Selle Français',
    price: 8500,
    category: 'chevaux',
    kind: 'animal',
    image: '/images/market/poulain-sf-moselle.jpg',
    mark: 'SF',
    short: 'Selle Français · Poulain · moins d’un an · Moselle',
    description: 'Poulain Selle Français de moins d’un an, élevé en Moselle, de souche sport.',
    details: ['Race : Selle Français', 'Sexe : mâle (poulain)', 'Âge : moins d’un an', 'Département : Moselle'],
    breed: 'Selle Français',
    sex: 'Poulain',
    age: 'moins d’un an',
    place: 'Moselle',
  },
  {
    slug: 'anon-grand-noir-du-berry',
    name: 'Ânon Grand Noir du Berry',
    price: 1500,
    category: 'autres',
    kind: 'animal',
    image: '/images/market/anon-grand-noir-du-berry.jpg',
    mark: 'GNB',
    short: 'Grand Noir du Berry · Ânon · moins d’un an · Saône-et-Loire',
    description: 'Ânon Grand Noir du Berry de moins d’un an, de race pure, en Saône-et-Loire.',
    details: ['Race : Grand Noir du Berry', 'Sexe : mâle (ânon)', 'Âge : moins d’un an', 'Département : Saône-et-Loire'],
    breed: 'Grand Noir du Berry',
    sex: 'Ânon',
    age: 'moins d’un an',
    place: 'Saône-et-Loire',
  },
  {
    slug: 'ane-miniature-3-ans-eure',
    name: 'Âne miniature, 3 ans',
    price: 1900,
    category: 'autres',
    kind: 'animal',
    image: '/images/market/ane-miniature-3-ans-eure.jpg',
    mark: 'ÂNE',
    short: 'Miniature américain · Entier · 3 ans · Eure',
    description: 'Âne miniature américain entier de 3 ans, visible dans l’Eure.',
    details: ['Race : Miniature américain', 'Sexe : entier', 'Âge : 3 ans', 'Département : Eure'],
    breed: 'Miniature américain',
    sex: 'Entier',
    age: '3 ans',
    place: 'Eure',
  },
]

export const bySlug = (slug: string) => products.find((p) => p.slug === slug)
export const isAnimal = (p: Product) => p.kind === 'animal'

export const FREE_SHIPPING_AT = 150
