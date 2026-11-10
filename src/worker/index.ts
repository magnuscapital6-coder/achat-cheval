import { isSameOriginRequest } from '@freebuff/auth'
import { Hono } from 'hono'
import type { Context } from 'hono'

import { MARKETS, marketFromPath, stripMarket } from '../data/locales'
import { FREE_SHIPPING_AT, products as marketListings } from '../data/products'
import type { SeoProduct } from '../data/seo'
import { applySeo, robots, sitemap, type SitemapProduct } from './seo'

// Le Worker devant la boutique. Le catalogue est une donnée statique livrée
// avec l'app ; ce Worker gère ce qui demande un serveur.
type Env = {
  ASSETS: Fetcher
  DB: D1Database
  FILES: R2Bucket
  APP_ORIGIN: string
  // Identifiants de l'admin, en JSON : { email, salt, iterations, hash }.
  ADMIN_CREDENTIALS?: string
  RESEND_API_KEY?: string
  ENQUIRY_NOTIFY_EMAIL?: string
  ENQUIRY_FROM_EMAIL?: string
}

const app = new Hono<{ Bindings: Env }>()

// La table est créée au premier usage : pas d'étape SQL à lancer après le
// déploiement, et une base vide fonctionne dès la première demande.
let schemaReady: Promise<void> | undefined
function ensureSchema(db: D1Database) {
  schemaReady ??= (async () => {
    await db.batch([
      db.prepare(
        `CREATE TABLE IF NOT EXISTS enquiries (
           id TEXT PRIMARY KEY,
           created_at TEXT NOT NULL,
           animal TEXT NOT NULL,
           name TEXT NOT NULL,
           phone TEXT NOT NULL,
           message TEXT NOT NULL,
           market TEXT NOT NULL DEFAULT '',
           source TEXT NOT NULL DEFAULT ''
         )`,
      ),
      db.prepare('CREATE INDEX IF NOT EXISTS enquiries_created_at ON enquiries (created_at DESC)'),
      db.prepare(
        `CREATE TABLE IF NOT EXISTS listings (
           id TEXT PRIMARY KEY,
           created_at TEXT NOT NULL,
           updated_at TEXT NOT NULL DEFAULT '',
           slug TEXT NOT NULL UNIQUE,
           name TEXT NOT NULL,
           price INTEGER NOT NULL,
           category TEXT NOT NULL,
           breed TEXT NOT NULL DEFAULT '',
           sex TEXT NOT NULL DEFAULT '',
           age TEXT NOT NULL DEFAULT '',
           height TEXT NOT NULL DEFAULT '',
           discipline TEXT NOT NULL DEFAULT '',
           place TEXT NOT NULL DEFAULT '',
           description TEXT NOT NULL,
           details TEXT NOT NULL DEFAULT '[]',
           photo_key TEXT,
           owner_id TEXT NOT NULL DEFAULT ''
         )`,
      ),
      // Ancienne revendication par compte Freebuff : la table reste en place
      // mais l'admin se connecte désormais par e-mail et mot de passe.
      db.prepare(
        `CREATE TABLE IF NOT EXISTS site_owner (
           id INTEGER PRIMARY KEY CHECK (id = 1),
           sub TEXT NOT NULL,
           created_at TEXT NOT NULL
         )`,
      ),
      // Sessions de l'admin : un jeton aléatoire dans un cookie HttpOnly, et
      // seulement son empreinte ici. Supprimer la ligne déconnecte l'appareil.
      db.prepare(
        `CREATE TABLE IF NOT EXISTS admin_sessions (
           token_hash TEXT PRIMARY KEY,
           email TEXT NOT NULL,
           created_at TEXT NOT NULL,
           expires_at TEXT NOT NULL,
           user_agent TEXT NOT NULL DEFAULT '',
           ip TEXT NOT NULL DEFAULT ''
         )`,
      ),
      // Tentatives de connexion par adresse IP : la route est publique, elle
      // doit coûter cher à qui essaie des mots de passe au hasard.
      db.prepare(
        `CREATE TABLE IF NOT EXISTS admin_attempts (
           key TEXT PRIMARY KEY,
           count INTEGER NOT NULL DEFAULT 0,
           first_at TEXT NOT NULL
         )`,
      ),
      // Journal des refus : l'admin peut voir qui a essayé et quand, sans
      // garder le mot de passe tenté (il n'est jamais écrit nulle part).
      db.prepare(
        `CREATE TABLE IF NOT EXISTS admin_login_failures (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           created_at TEXT NOT NULL,
           ip TEXT NOT NULL DEFAULT '',
           reason TEXT NOT NULL DEFAULT 'refuse'
         )`,
      ),
      db.prepare('CREATE INDEX IF NOT EXISTS admin_login_failures_id ON admin_login_failures (id DESC)'),
      // Historique des connexions acceptées : de quoi vérifier qui est entré,
      // quand et depuis quel appareil, même après la fermeture des sessions.
      db.prepare(
        `CREATE TABLE IF NOT EXISTS admin_logins (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           created_at TEXT NOT NULL,
           ip TEXT NOT NULL DEFAULT '',
           user_agent TEXT NOT NULL DEFAULT ''
         )`,
      ),
      db.prepare('CREATE INDEX IF NOT EXISTS admin_logins_id ON admin_logins (id DESC)'),
      // Inscriptions au pied de page. Sans cette table, elles étaient validées
      // puis jetées.
      db.prepare(
        `CREATE TABLE IF NOT EXISTS subscribers (
           id TEXT PRIMARY KEY,
           created_at TEXT NOT NULL,
           email TEXT NOT NULL UNIQUE,
           market TEXT NOT NULL DEFAULT ''
         )`,
      ),
      // Visites par fiche : une ligne par annonce, pour comparer l'intérêt
      // (visites) et la conversion (demandes reçues).
      db.prepare(
        `CREATE TABLE IF NOT EXISTS fiche_views (
           path TEXT PRIMARY KEY,
           market TEXT NOT NULL DEFAULT '',
           views INTEGER NOT NULL DEFAULT 0,
           updated_at TEXT NOT NULL
         )`,
      ),
      // Le détail par jour : le total par fiche ne suffit pas à résumer la
      // semaine dans l'admin.
      db.prepare(
        `CREATE TABLE IF NOT EXISTS fiche_view_days (
           day TEXT NOT NULL,
           path TEXT NOT NULL,
           views INTEGER NOT NULL DEFAULT 0,
           PRIMARY KEY (day, path)
         )`,
      ),
      // Commandes passées en caisse. La démo ne gardait que la référence
      // affichée au visiteur.
      db.prepare(
        `CREATE TABLE IF NOT EXISTS orders (
           id TEXT PRIMARY KEY,
           created_at TEXT NOT NULL,
           reference TEXT NOT NULL UNIQUE,
           email TEXT NOT NULL,
           items TEXT NOT NULL DEFAULT '[]',
           total INTEGER NOT NULL DEFAULT 0,
           market TEXT NOT NULL DEFAULT '',
           notified_at TEXT NOT NULL DEFAULT ''
         )`,
      ),
      // Modèles de messages : le texte s'édite depuis l'admin, la clé reste
      // stable pour que les boutons sachent quel modèle ouvrir.
      db.prepare(
        `CREATE TABLE IF NOT EXISTS message_templates (
           key TEXT PRIMARY KEY,
           label TEXT NOT NULL,
           audience TEXT NOT NULL DEFAULT 'inscription',
           subject TEXT NOT NULL,
           body TEXT NOT NULL,
           updated_at TEXT NOT NULL DEFAULT ''
         )`,
      ),
      // Journal des envois : un message parti (ou refusé) laisse une trace,
      // même si la boîte du destinataire ne le montre plus.
      db.prepare(
        `CREATE TABLE IF NOT EXISTS admin_messages (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           created_at TEXT NOT NULL,
           email TEXT NOT NULL,
           template_key TEXT NOT NULL DEFAULT '',
           subject TEXT NOT NULL,
           body TEXT NOT NULL,
           reference TEXT NOT NULL DEFAULT '',
           status TEXT NOT NULL DEFAULT 'envoye',
           detail TEXT NOT NULL DEFAULT ''
         )`,
      ),
      db.prepare('CREATE INDEX IF NOT EXISTS admin_messages_id ON admin_messages (id DESC)'),
      db.prepare('CREATE INDEX IF NOT EXISTS admin_messages_email ON admin_messages (email, id DESC)'),
    ])
    // Tables créées avant l'édition : les colonnes arrivent ici, sans migration
    // à lancer à la main. L'erreur « column already exists » est sans gravité.
    await db.prepare("ALTER TABLE listings ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''").run().catch(() => undefined)
    // Demandes reçues avant l'ajout du marché : la colonne arrive vide.
    await db.prepare("ALTER TABLE enquiries ADD COLUMN market TEXT NOT NULL DEFAULT ''").run().catch(() => undefined)
    // `notified_at` reste vide tant que l'e-mail d'alerte n'est pas parti :
    // l'admin peut donc signaler un envoi manqué au lieu de le perdre au log.
    await db.prepare("ALTER TABLE enquiries ADD COLUMN notified_at TEXT NOT NULL DEFAULT ''").run().catch(() => undefined)
    // Fiche d'origine : vide pour les demandes reçues avant la colonne.
    await db.prepare("ALTER TABLE enquiries ADD COLUMN source TEXT NOT NULL DEFAULT ''").run().catch(() => undefined)
    await db.prepare("ALTER TABLE listings ADD COLUMN owner_id TEXT NOT NULL DEFAULT ''").run().catch(() => undefined)
    // Sessions ouvertes avant l'ajout de l'appareil : ces colonnes restent
    // vides, l'écran le dit au lieu d'inventer un navigateur.
    await db.prepare("ALTER TABLE admin_sessions ADD COLUMN user_agent TEXT NOT NULL DEFAULT ''").run().catch(() => undefined)
    await db.prepare("ALTER TABLE admin_sessions ADD COLUMN ip TEXT NOT NULL DEFAULT ''").run().catch(() => undefined)
    // Connexions déjà enregistrées sans leur navigateur : la colonne arrive
    // vide, la ligne s'affiche alors avec la seule adresse.
    await db.prepare("ALTER TABLE admin_logins ADD COLUMN user_agent TEXT NOT NULL DEFAULT ''").run().catch(() => undefined)
    // Modèles livrés avec le site : `INSERT OR IGNORE` pour ne jamais écraser
    // un texte déjà personnalisé depuis l'admin.
    await db.batch(
      DEFAULT_TEMPLATES.map((template) =>
        db
          .prepare('INSERT OR IGNORE INTO message_templates (key, label, audience, subject, body, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(template.key, template.label, template.audience, template.subject, template.body, ''),
      ),
    )
  })().catch((error) => {
    schemaReady = undefined
    throw error
  })
  return schemaReady
}

type Enquiry = { id: string; animal: string; name: string; phone: string; message: string; market: string; source: string; createdAt: string }

/**
 * La fiche d'origine, réduite à un chemin du site : ni domaine, ni paramètres,
 * pour qu'une valeur envoyée par le navigateur ne devienne jamais un lien
 * sortant dans l'e-mail ou dans l'admin.
 */
function safeSource(raw?: string) {
  const value = (raw ?? '').trim().split('?')[0].split('#')[0]
  if (!value.startsWith('/') || value.startsWith('//')) return ''
  if (!/^\/[A-Za-z0-9\-_/.%]*$/.test(value)) return ''
  return value.slice(0, 200)
}

/**
 * La fiche d'une annonce, indépendamment du marché : `/de/product/x` et
 * `/fr-be/product/x` désignent la même fiche et se comptent ensemble.
 */
function fichePath(raw?: string) {
  const path = safeSource(raw)
  if (!path) return ''
  const clean = stripMarket(path, marketFromPath(path))
  return clean.startsWith('/product/') ? clean : ''
}

/** Le nom du marché, pour l'e-mail et pour l'admin ; vide pour les anciennes demandes. */
function marketLabel(id: string) {
  const market = MARKETS.find((candidate) => candidate.id === id)
  return market ? `${market.label} (${market.hreflang})` : 'Marché non identifié'
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)

type EmailMessage = { to: string; subject: string; text: string; html: string }

// Un seul point d'envoi. Sans clé Resend, l'événement reste enregistré en
// base : l'e-mail est un bonus, pas une condition de succès.
async function sendEmail(env: Env, message: EmailMessage) {
  const apiKey = env.RESEND_API_KEY
  if (!apiKey) {
    console.warn(`E-mail ignoré (« ${message.subject} ») : RESEND_API_KEY manquant.`)
    return false
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.ENQUIRY_FROM_EMAIL ?? 'achat-cheval <onboarding@resend.dev>',
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  })
  if (!response.ok) {
    console.error(`Resend a refusé l'e-mail « ${message.subject} » (${response.status}) : ${await response.text()}`)
    return false
  }
  return true
}

const frenchDate = (value: string) =>
  new Date(value).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris' })

function detailsTable(rows: [string, string][]) {
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    ${rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:4px 20px 4px 0;color:#78716c;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0;font-weight:600">${escapeHtml(value)}</td></tr>`,
      )
      .join('\n    ')}
  </table>`
}

/** Alerte au propriétaire pour une nouvelle demande de visite. */
async function notifyEnquiry(env: Env, enquiry: Enquiry) {
  const to = env.ENQUIRY_NOTIFY_EMAIL
  if (!to) {
    console.warn('Demande enregistrée, notification e-mail ignorée : ENQUIRY_NOTIFY_EMAIL manquant.')
    return false
  }
  const when = frenchDate(enquiry.createdAt)
  const fiche = enquiry.source ? `${env.APP_ORIGIN}${enquiry.source}` : 'non transmise (appel ou message direct)'
  const rows: [string, string][] = [
    ['Animal', enquiry.animal],
    ['Nom', enquiry.name],
    ['Téléphone', enquiry.phone],
    ['Marché', marketLabel(enquiry.market)],
    ['Fiche', fiche],
    ['Reçue le', when],
    ['Référence', enquiry.id],
  ]
  return sendEmail(env, {
    to,
    subject: `Demande de visite — ${enquiry.animal} (${enquiry.name})`,
    text: [
      `Nouvelle demande de visite pour ${enquiry.animal}.`,
      '',
      `Nom : ${enquiry.name}`,
      `Téléphone : ${enquiry.phone}`,
      `Marché : ${marketLabel(enquiry.market)}`,
      `Fiche : ${fiche}`,
      `Reçue le : ${when}`,
      '',
      'Message :',
      enquiry.message,
      '',
      `— achat-cheval, référence ${enquiry.id}`,
    ].join('\n'),
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#1c1917">
  <h1 style="font-size:20px;margin:0 0 4px">Nouvelle demande de visite</h1>
  <p style="margin:0 0 20px;color:#78716c">${escapeHtml(enquiry.animal)} · ${escapeHtml(marketLabel(enquiry.market))}</p>
  ${detailsTable(rows)}
  <p style="margin:20px 0 4px;color:#78716c">Message</p>
  <p style="margin:0;white-space:pre-line">${escapeHtml(enquiry.message)}</p>
</div>`,
  })
}

type OrderLine = { id: string; name: string; price: number; quantity: number; option?: string }
type Order = {
  id: string
  reference: string
  email: string
  items: OrderLine[]
  total: number
  market: string
  createdAt: string
}

const orderLines = (order: Order) =>
  order.items.map((line) => `${line.quantity} × ${line.name}${line.option ? ` (${line.option})` : ''} — ${line.price * line.quantity} €`)

/** Alerte au propriétaire pour une commande passée en caisse. */
async function notifyOrder(env: Env, order: Order) {
  const to = env.ENQUIRY_NOTIFY_EMAIL
  if (!to) {
    console.warn('Commande enregistrée, notification e-mail ignorée : ENQUIRY_NOTIFY_EMAIL manquant.')
    return false
  }
  const rows: [string, string][] = [
    ['Référence', order.reference],
    ['E-mail', order.email],
    ['Marché', marketLabel(order.market)],
    ['Total', `${order.total} €`],
    ['Reçue le', frenchDate(order.createdAt)],
  ]
  return sendEmail(env, {
    to,
    subject: `Commande ${order.reference} — ${order.total} €`,
    text: [
      `Nouvelle commande ${order.reference}.`,
      '',
      `E-mail : ${order.email}`,
      `Marché : ${marketLabel(order.market)}`,
      `Total : ${order.total} €`,
      `Reçue le : ${frenchDate(order.createdAt)}`,
      '',
      ...orderLines(order),
      '',
      '— achat-cheval',
    ].join('\n'),
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#1c1917">
  <h1 style="font-size:20px;margin:0 0 4px">Nouvelle commande</h1>
  <p style="margin:0 0 20px;color:#78716c">${escapeHtml(order.reference)}</p>
  ${detailsTable(rows)}
  <p style="margin:20px 0 4px;color:#78716c">Détail</p>
  <p style="margin:0;white-space:pre-line">${escapeHtml(orderLines(order).join('\n'))}</p>
</div>`,
  })
}

/** Accusé de réception à l'acheteur, avec sa référence — rien à retenir de plus. */
async function confirmOrder(env: Env, order: Order) {
  return sendEmail(env, {
    to: order.email,
    subject: `Votre commande ${order.reference} — achat-cheval`,
    text: [
      `Merci pour votre commande ${order.reference}.`,
      '',
      ...orderLines(order),
      '',
      `Total : ${order.total} €`,
      '',
      'Nous vous écrivons à cette adresse pour la suite. Une question ? Répondez à cet e-mail.',
      '',
      '— achat-cheval',
    ].join('\n'),
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#1c1917">
  <h1 style="font-size:20px;margin:0 0 4px">Merci pour votre commande</h1>
  <p style="margin:0 0 20px;color:#78716c">Référence ${escapeHtml(order.reference)}</p>
  <p style="margin:0;white-space:pre-line">${escapeHtml(orderLines(order).join('\n'))}</p>
  <p style="margin:16px 0 0;font-weight:600">Total : ${order.total} €</p>
  <p style="margin:16px 0 0">Nous vous écrivons à cette adresse pour la suite. Une question ? Répondez à cet e-mail.</p>
</div>`,
  })
}

// ——— Messages aux clients ————————————————————————————————————————
// L'admin écrit aux inscrits et aux acheteurs à partir de modèles gardés en
// base : le texte se modifie depuis l'écran « Modèles », sans redéploiement.

type TemplateAudience = 'inscription' | 'commande'

type MessageTemplate = { key: string; label: string; audience: TemplateAudience; subject: string; body: string }

type TemplateRow = { key: string; label: string; audience: string; subject: string; body: string; updated_at: string }

const MESSAGE_SUBJECT_MAX = 160
const MESSAGE_BODY_MAX = 5000

// Les clés restent stables (elles nomment le bouton qui ouvre le modèle) ;
// seul le texte se personnalise. `{{...}}` est remplacé à l'envoi.
const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    key: 'bienvenue',
    label: 'Bienvenue à l’inscription',
    audience: 'inscription',
    subject: 'Votre inscription chez {{boutique}}',
    body: [
      'Bonjour,',
      '',
      'Merci de votre inscription : vous recevrez les nouveaux chevaux, poneys et ânes mis en vente, et les baisses de prix qui comptent.',
      '',
      'Tout le catalogue : {{lien}}',
      '',
      'Une question sur un animal ? Répondez à cet e-mail, nous lisons tout.',
      '',
      'À bientôt,',
      '{{boutique}}',
    ].join('\n'),
  },
  {
    key: 'nouveautes',
    label: 'Nouvelles fiches de la semaine',
    audience: 'inscription',
    subject: 'Les nouvelles fiches de la semaine',
    body: [
      'Bonjour,',
      '',
      'De nouvelles fiches viennent d’arriver : race, âge, discipline, département et prix y sont détaillés, photo comprise.',
      '',
      'Le catalogue complet : {{lien}}',
      '',
      'Bonne visite,',
      '{{boutique}}',
    ].join('\n'),
  },
  {
    key: 'paiement-attente',
    label: 'Relance de paiement',
    audience: 'commande',
    subject: 'Votre commande {{reference}} attend son règlement',
    body: [
      'Bonjour,',
      '',
      'Votre commande {{reference}} est bien enregistrée, mais son règlement n’est pas encore arrivé.',
      '',
      'Montant : {{total}}',
      'Articles :',
      '{{articles}}',
      '',
      'Répondez à cet e-mail pour recevoir le lien de paiement, ou réglez par virement si nous vous l’avons déjà transmis : nous gardons la commande de côté d’ici là.',
      '',
      'Merci,',
      '{{boutique}}',
    ].join('\n'),
  },
  {
    key: 'paiement-recu',
    label: 'Paiement reçu',
    audience: 'commande',
    subject: 'Paiement reçu — commande {{reference}}',
    body: [
      'Bonjour,',
      '',
      'Nous avons bien reçu le règlement de {{total}} pour la commande {{reference}}. Elle est confirmée et nous préparons le départ.',
      '',
      'Articles :',
      '{{articles}}',
      '',
      'Vous recevrez un message avec le suivi dès l’expédition.',
      '',
      'Merci de votre confiance,',
      '{{boutique}}',
    ].join('\n'),
  },
  {
    key: 'expedition',
    label: 'Commande expédiée',
    audience: 'commande',
    subject: 'Votre commande {{reference}} est en route',
    body: [
      'Bonjour,',
      '',
      'Votre commande {{reference}} a quitté nos écuries. Le transporteur vous contacte pour convenir de la livraison.',
      '',
      'Articles :',
      '{{articles}}',
      '',
      'Une question d’ici là ? Répondez à cet e-mail.',
      '',
      '{{boutique}}',
    ].join('\n'),
  },
]

type MessageContext = { email: string; reference?: string; total?: number; items?: OrderLine[] }

/** Même format que l'admin (`2 450 €`), pour que l'aperçu et le reçu collent. */
const euro = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)

/**
 * Remplace `{{cle}}` par sa valeur. Un jeton inconnu reste tel quel : mieux
 * vaut un `{{reference}}` visible dans un e-mail d'inscription qu'un texte
 * silencieusement troué.
 */
function fillTemplate(text: string, context: MessageContext, env: Env) {
  const values: Record<string, string> = {
    email: context.email,
    boutique: 'achat-cheval',
    lien: env.APP_ORIGIN,
    date: new Date().toLocaleDateString('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }),
  }
  if (context.reference) values.reference = context.reference
  if (typeof context.total === 'number') values.total = euro(context.total)
  if (context.items) {
    values.articles = context.items
      .map((line) => `· ${line.quantity} × ${line.name}${line.option ? ` (${line.option})` : ''} — ${euro(line.price * line.quantity)}`)
      .join('\n')
  }
  return text.replace(/\{\{\s*([a-z]+)\s*\}\}/gi, (match, name: string) => values[name.toLowerCase()] ?? match)
}

/** Le texte du modèle, mis en pages pour un client mail (texte échappé). */
function messageHtml(text: string) {
  const blocks = escapeHtml(text)
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 16px">${block.replace(/\n/g, '<br>')}</p>`)
    .join('')
  return `<div style="font-family:system-ui,sans-serif;line-height:1.65;color:#1c1917">${blocks}</div>`
}

app.get('/api/health', (c) => c.json({ ok: true }))

// Commande passée en caisse. Le paiement reste une démonstration (branchez
// Stripe ici), mais la commande est enregistrée, chiffrée côté serveur — les
// prix ne viennent pas du navigateur — et notifiée au propriétaire comme à
// l'acheteur.
app.post('/api/orders', async (c) => {
  const body = await c
    .req.json<{ email?: string; market?: string; items?: { id?: string; option?: string; quantity?: number }[] }>()
    .catch(() => null)
  const email = body?.email?.trim() ?? ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Entrez une adresse e-mail valide.' }, 400)
  if (!body?.items?.length) return c.json({ error: 'Votre panier est vide.' }, 400)

  const items: OrderLine[] = []
  for (const raw of body.items.slice(0, 20)) {
    if (!raw.id) continue
    const quantity = Math.min(Math.max(Math.trunc(Number(raw.quantity) || 0), 1), 20)
    const product = await productFor(c.env, raw.id)
    if (!product) continue
    items.push({
      id: raw.id,
      name: product.name,
      price: product.price,
      quantity,
      ...(raw.option ? { option: raw.option.slice(0, 60) } : {}),
    })
  }
  if (!items.length) return c.json({ error: 'Ces articles ne sont plus au catalogue.' }, 400)

  const subtotal = items.reduce((sum, line) => sum + line.price * line.quantity, 0)
  const shipping = subtotal >= FREE_SHIPPING_AT ? 0 : 9.9
  const requested = body.market?.trim() ?? ''
  const order: Order = {
    id: crypto.randomUUID(),
    reference: `AC-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    email: email.slice(0, 160),
    items,
    total: Math.round(subtotal + shipping),
    market: MARKETS.some((candidate) => candidate.id === requested) ? requested : '',
    createdAt: new Date().toISOString(),
  }

  try {
    await ensureSchema(c.env.DB)
    await c.env.DB.prepare(
      'INSERT INTO orders (id, created_at, reference, email, items, total, market) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(order.id, order.createdAt, order.reference, order.email, JSON.stringify(order.items), order.total, order.market)
      .run()
  } catch (error) {
    console.error('Enregistrement de la commande impossible :', error)
    return c.json({ error: 'Impossible d’enregistrer votre commande. Réessayez dans un instant.' }, 500)
  }

  // Les deux e-mails sont indépendants : un propriétaire sans adresse
  // configurée ne doit pas priver l'acheteur de son accusé de réception.
  const [ownerSent] = await Promise.all([
    notifyOrder(c.env, order).catch(() => false),
    confirmOrder(c.env, order).catch(() => false),
  ])
  if (ownerSent) {
    await c.env.DB.prepare('UPDATE orders SET notified_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), order.id)
      .run()
      .catch(() => undefined)
  }

  return c.json({ reference: order.reference, total: order.total })
})

// Demandes de visite pour les chevaux, poneys et ânes : validation, puis
// enregistrement dans D1 et e-mail de notification au propriétaire.
app.post('/api/enquiries', async (c) => {
  const body = await c.req.json<{ name?: string; phone?: string; message?: string; animal?: string; market?: string; source?: string }>().catch(() => null)
  const name = body?.name?.trim() ?? ''
  const phone = body?.phone?.trim() ?? ''
  const message = body?.message?.trim() ?? ''
  const animal = body?.animal?.trim().slice(0, 80) || 'Fiche animal'
  const digits = phone.replace(/\D/g, '')
  if (name.length < 2) return c.json({ error: 'Indiquez votre nom.' }, 400)
  if (digits.length < 6 || digits.length > 20) return c.json({ error: 'Entrez un numéro de téléphone valide.' }, 400)
  if (message.length < 5) return c.json({ error: 'Dites-nous en un peu plus dans le message.' }, 400)
  // Le marché vient de l'URL que le visiteur consulte : une valeur inconnue
  // est ignorée plutôt que rejetée, la demande reste valable.
  const requested = body?.market?.trim() ?? ''
  const market = MARKETS.some((candidate) => candidate.id === requested) ? requested : ''

  const enquiry: Enquiry = {
    id: crypto.randomUUID(),
    animal,
    name: name.slice(0, 120),
    phone: phone.slice(0, 40),
    message: message.slice(0, 4000),
    market,
    source: safeSource(body?.source),
    createdAt: new Date().toISOString(),
  }

  try {
    await ensureSchema(c.env.DB)
    await c.env.DB.prepare('INSERT INTO enquiries (id, created_at, animal, name, phone, message, market, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(enquiry.id, enquiry.createdAt, enquiry.animal, enquiry.name, enquiry.phone, enquiry.message, enquiry.market, enquiry.source)
      .run()
  } catch (error) {
    console.error('Enregistrement de la demande impossible :', error)
    return c.json({ error: 'Impossible d’enregistrer votre demande. Réessayez ou appelez-nous.' }, 500)
  }

  // L'alerte e-mail est un bonus : un échec ne défait pas la demande, mais
  // `notified_at` reste vide et l'admin le signale.
  const sent = await notifyEnquiry(c.env, enquiry).catch((error: unknown) => {
    console.error('Notification e-mail impossible :', error)
    return false
  })
  if (sent) {
    await c.env.DB.prepare('UPDATE enquiries SET notified_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), enquiry.id)
      .run()
      .catch(() => undefined)
  }

  return c.json({ ok: true })
})

// Les demandes reçues, pour l'admin. Réservé au propriétaire : l'adresse
// e-mail et le téléphone des visiteurs ne sortent pas de là.
app.get('/api/enquiries', async (c) => {
  const owner = await requireOwner(c)
  if (owner instanceof Response) return owner
  try {
    await ensureSchema(c.env.DB)
    const { results } = await c.env.DB.prepare(
      'SELECT id, created_at, animal, name, phone, message, market, source, notified_at FROM enquiries ORDER BY created_at DESC LIMIT 500',
    ).all<{ id: string; created_at: string; animal: string; name: string; phone: string; message: string; market: string; source: string; notified_at: string }>()
    return c.json(
      {
        enquiries: results.map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          animal: row.animal,
          name: row.name,
          phone: row.phone,
          message: row.message,
          market: row.market,
          source: row.source,
          notified: Boolean(row.notified_at),
        })),
      },
      200,
      { 'cache-control': 'private, no-store' },
    )
  } catch (error) {
    console.error('Lecture des demandes impossible :', error)
    return c.json({ error: 'Impossible de charger les demandes.' }, 500)
  }
})

// Compteur de visites des fiches. Public et sans identité : une ligne par
// annonce, incrémentée à chaque ouverture. Sert à rapporter les demandes aux
// visites dans l'admin.
app.post('/api/views', async (c) => {
  if (!isSameOriginRequest(c.req.raw, c.env.APP_ORIGIN)) return c.json({ error: 'Requête refusée : origine inattendue.' }, 403)
  // Les robots d'indexation ouvrent les fiches sans être des visiteurs.
  const agent = c.req.header('user-agent') ?? ''
  if (/bot|crawler|spider|headless|slurp|bingpreview|lighthouse/i.test(agent)) return c.json({ ok: true })
  const body = await c.req.json<{ path?: string }>().catch(() => null)
  const path = fichePath(body?.path)
  // Tout ce qui n'est pas une fiche est ignoré en silence : le compteur ne
  // doit jamais devenir une source d'erreur pour le visiteur.
  if (!path) return c.json({ ok: true })
  const market = marketFromPath(safeSource(body?.path)).id
  const now = new Date()
  const day = now.toISOString().slice(0, 10)
  try {
    await ensureSchema(c.env.DB)
    // Le total par fiche et le détail du jour avancent ensemble, sinon le
    // résumé de la semaine ne correspondrait pas au classement.
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO fiche_views (path, market, views, updated_at) VALUES (?, ?, 1, ?)
         ON CONFLICT(path) DO UPDATE SET views = fiche_views.views + 1, market = excluded.market, updated_at = excluded.updated_at`,
      ).bind(path, market, now.toISOString()),
      c.env.DB.prepare(
        `INSERT INTO fiche_view_days (day, path, views) VALUES (?, ?, 1)
         ON CONFLICT(day, path) DO UPDATE SET views = fiche_view_days.views + 1`,
      ).bind(day, path),
    ])
  } catch (error) {
    console.error('Compteur de visites impossible :', error)
  }
  return c.json({ ok: true })
})

// Les visites par fiche, pour l'admin : agrégées, aucune donnée personnelle.
app.get('/api/views', async (c) => {
  const owner = await requireOwner(c)
  if (owner instanceof Response) return owner
  try {
    await ensureSchema(c.env.DB)
    const { results } = await c.env.DB.prepare('SELECT path, market, views FROM fiche_views ORDER BY views DESC LIMIT 500').all<{
      path: string
      market: string
      views: number
    }>()
    return c.json({ views: results }, 200, { 'cache-control': 'private, no-store' })
  } catch (error) {
    console.error('Lecture des visites impossible :', error)
    return c.json({ error: 'Impossible de charger les visites.' }, 500)
  }
})

// Le résumé de l'admin : les sept derniers jours et le cumul depuis le début,
// en une seule requête. Aucune donnée personnelle, mais réservé au propriétaire.
app.get('/api/summary', async (c) => {
  const owner = await requireOwner(c)
  if (owner instanceof Response) return owner
  try {
    await ensureSchema(c.env.DB)
    // Semaine calendaire du lundi au dimanche, en UTC comme les jours du
    // compteur de visites : les totaux et le graphique couvrent la même fenêtre.
    const today = new Date()
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - ((today.getUTCDay() + 6) % 7)))
    const since = start.toISOString()
    const sinceDay = since.slice(0, 10)
    const [demands, orders, subscribers, visits, visitsByDay, visitsPerDay, demandsPerDay] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS week FROM enquiries')
        .bind(since)
        .first<{ total: number; week: number }>(),
      c.env.DB.prepare(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS week,
                COALESCE(SUM(total), 0) AS revenue,
                COALESCE(SUM(CASE WHEN created_at >= ? THEN total ELSE 0 END), 0) AS week_revenue
           FROM orders`,
      )
        .bind(since, since)
        .first<{ total: number; week: number; revenue: number; week_revenue: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS week FROM subscribers')
        .bind(since)
        .first<{ total: number; week: number }>(),
      c.env.DB.prepare('SELECT COALESCE(SUM(views), 0) AS total FROM fiche_views').first<{ total: number }>(),
      c.env.DB.prepare('SELECT COALESCE(SUM(views), 0) AS week FROM fiche_view_days WHERE day >= ?')
        .bind(sinceDay)
        .first<{ week: number }>(),
      // Les séries jour par jour du graphique : vues agrégées et demandes datées.
      c.env.DB.prepare('SELECT day, COALESCE(SUM(views), 0) AS count FROM fiche_view_days WHERE day >= ? GROUP BY day')
        .bind(sinceDay)
        .all<{ day: string; count: number }>(),
      c.env.DB.prepare('SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count FROM enquiries WHERE created_at >= ? GROUP BY day')
        .bind(since)
        .all<{ day: string; count: number }>(),
    ])
    const viewsByDate = new Map((visitsPerDay.results ?? []).map((row) => [row.day, row.count]))
    const demandsByDate = new Map((demandsPerDay.results ?? []).map((row) => [row.day, row.count]))
    // Les sept jours de la semaine, dimanche compris : les jours sans données
    // (et ceux à venir) apparaissent à zéro plutôt que d'être absents.
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + index))
      const day = date.toISOString().slice(0, 10)
      return { day, demands: demandsByDate.get(day) ?? 0, views: viewsByDate.get(day) ?? 0 }
    })
    return c.json(
      {
        since,
        demands: { week: demands?.week ?? 0, total: demands?.total ?? 0 },
        orders: {
          week: orders?.week ?? 0,
          total: orders?.total ?? 0,
          revenue: orders?.revenue ?? 0,
          weekRevenue: orders?.week_revenue ?? 0,
        },
        subscribers: { week: subscribers?.week ?? 0, total: subscribers?.total ?? 0 },
        views: { week: visitsByDay?.week ?? 0, total: visits?.total ?? 0 },
        days,
      },
      200,
      { 'cache-control': 'private, no-store' },
    )
  } catch (error) {
    console.error('Résumé de l’admin impossible :', error)
    return c.json({ error: 'Impossible de charger le résumé.' }, 500)
  }
})

// ——— Chevaux du propriétaire (admin) ———————————————————————————————
// Le catalogue du fonds vit dans src/data/products.ts ; celles
// ajoutées depuis /admin vivent ici, avec leur photo dans R2.

type ListingRow = {
  id: string
  created_at: string
  updated_at: string
  slug: string
  name: string
  price: number
  category: string
  breed: string
  sex: string
  age: string
  height: string
  discipline: string
  place: string
  description: string
  details: string
  photo_key: string | null
  owner_id: string
}

const CATEGORIES = ['chevaux', 'poneys', 'autres']

function toListing(row: ListingRow) {
  let details: string[] = []
  try {
    const parsed: unknown = JSON.parse(row.details)
    if (Array.isArray(parsed)) details = parsed.filter((d): d is string => typeof d === 'string')
  } catch {
    details = []
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: row.price,
    category: row.category,
    breed: row.breed,
    sex: row.sex,
    age: row.age,
    height: row.height,
    discipline: row.discipline,
    place: row.place,
    description: row.description,
    details,
    // Le suffixe change à chaque photo remplacée : le cache un an des photos
    // ne sert donc jamais une ancienne image.
    image: row.photo_key ? `/api/photo/${row.id}?v=${encodeURIComponent(row.updated_at || row.created_at)}` : null,
    createdAt: row.created_at,
  }
}

// ——— Connexion ———————————————————————————————————————————————
// E-mail et mot de passe, sans service externe. Le mot de passe n'existe nulle
// part en clair : seul un condensat PBKDF2 (sel + itérations + empreinte) est
// rangé dans le secret `ADMIN_CREDENTIALS`. La session est un jeton aléatoire
// dans un cookie HttpOnly ; la base n'en garde que l'empreinte.
const SESSION_COOKIE = 'achat_admin'
const SESSION_DAYS = 7
/** Nombre de connexions gardées : au-delà, la plus ancienne s'efface. */
const MAX_SESSIONS = 5
const MAX_ATTEMPTS = 8
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000

type AdminCredentials = { email: string; salt: string; iterations: number; hash: string }
type Admin = { email: string }

function adminCredentials(env: Env): AdminCredentials | null {
  if (!env.ADMIN_CREDENTIALS) return null
  try {
    const parsed = JSON.parse(env.ADMIN_CREDENTIALS) as Partial<AdminCredentials>
    const iterations = Number(parsed.iterations)
    if (!parsed.email || !parsed.salt || !parsed.hash || !Number.isInteger(iterations) || iterations < 10000) return null
    return { email: parsed.email.trim().toLowerCase(), salt: parsed.salt, iterations, hash: parsed.hash.toLowerCase() }
  } catch {
    return null
  }
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(Math.floor(hex.length / 2))
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  return bytes
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToHex(new Uint8Array(digest))
}

/** PBKDF2-SHA256, comme le script de génération des identifiants. */
async function hashPassword(password: string, credentials: AdminCredentials) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(credentials.salt), iterations: credentials.iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return bytesToHex(new Uint8Array(bits))
}

/** Comparaison à durée constante : inutile de mesurer le préfixe correct. */
function sameHash(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

function readCookie(request: Request, name: string) {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== name) continue
    return decodeURIComponent(part.slice(separator + 1).trim())
  }
  return null
}

function sessionCookie(request: Request, value: string, maxAge: number) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

/** La session en cours, ou null : lecture seule, sans réponse d'erreur. */
async function currentAdmin(env: Env, request: Request): Promise<Admin | null> {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return null
  await ensureSchema(env.DB)
  const row = await env.DB.prepare('SELECT email, expires_at FROM admin_sessions WHERE token_hash = ?')
    .bind(await sha256Hex(token))
    .first<{ email: string; expires_at: string }>()
  if (!row || row.expires_at <= new Date().toISOString()) return null
  return { email: row.email }
}

/**
 * L'admin, ou une réponse. Toute lecture et écriture réservée passe par là :
 * cacher un bouton ne protège rien.
 */
async function requireOwner(c: Context<{ Bindings: Env }>): Promise<Admin | Response> {
  if (!isSameOriginRequest(c.req.raw, c.env.APP_ORIGIN)) return c.json({ error: 'Requête refusée : origine inattendue.' }, 403)
  const admin = await currentAdmin(c.env, c.req.raw)
  if (!admin) return c.json({ error: 'Session expirée. Reconnectez-vous.' }, 401, { 'cache-control': 'private, no-store' })
  return admin
}

async function attemptsInWindow(db: D1Database, key: string) {
  const row = await db.prepare('SELECT count, first_at FROM admin_attempts WHERE key = ?').bind(key).first<{ count: number; first_at: string }>()
  if (!row) return 0
  if (Date.now() - new Date(row.first_at).getTime() > ATTEMPT_WINDOW_MS) {
    await db.prepare('DELETE FROM admin_attempts WHERE key = ?').bind(key).run().catch(() => undefined)
    return 0
  }
  return row.count
}

async function recordFailure(db: D1Database, key: string) {
  await db
    .prepare('INSERT INTO admin_attempts (key, count, first_at) VALUES (?, 1, ?) ON CONFLICT (key) DO UPDATE SET count = admin_attempts.count + 1')
    .bind(key, new Date().toISOString())
    .run()
    .catch(() => undefined)
}

async function clearFailures(db: D1Database, key: string) {
  await db.prepare('DELETE FROM admin_attempts WHERE key = ?').bind(key).run().catch(() => undefined)
}

/** Une ligne d'historique : la connexion acceptée, son heure et son adresse. */
async function logLogin(db: D1Database, ip: string, userAgent: string) {
  await db
    .prepare('INSERT INTO admin_logins (created_at, ip, user_agent) VALUES (?, ?, ?)')
    .bind(new Date().toISOString(), ip === 'inconnu' ? '' : ip, userAgent.slice(0, 300))
    .run()
    .catch(() => undefined)
  await db
    .prepare('DELETE FROM admin_logins WHERE id NOT IN (SELECT id FROM admin_logins ORDER BY id DESC LIMIT 200)')
    .run()
    .catch(() => undefined)
}

/**
 * Journal des tentatives refusées : une ligne par refus, avec l'heure et
 * l'adresse d'où elle vient. Les 200 dernières suffisent à voir une attaque.
 */
async function logRefusal(db: D1Database, ip: string, reason: 'refuse' | 'bloque') {
  await db
    .prepare('INSERT INTO admin_login_failures (created_at, ip, reason) VALUES (?, ?, ?)')
    .bind(new Date().toISOString(), ip === 'inconnu' ? '' : ip, reason)
    .run()
    .catch(() => undefined)
  await db
    .prepare('DELETE FROM admin_login_failures WHERE id NOT IN (SELECT id FROM admin_login_failures ORDER BY id DESC LIMIT 200)')
    .run()
    .catch(() => undefined)
}

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'cheval'

type ListingFields = {
  name: string
  price: number
  category: string
  description: string
  details: string[]
  breed: string
  sex: string
  age: string
  height: string
  discipline: string
  place: string
}

type ReadResult = { fields: ListingFields; error?: undefined } | { fields?: undefined; error: string }

// Création et édition partagent les mêmes règles : un seul endroit à corriger.
function readListing(body: Record<string, string | File>): ReadResult {
  const text = (key: string) => {
    const value = body[key]
    return typeof value === 'string' ? value.trim() : ''
  }

  const name = text('name').slice(0, 120)
  const price = Number(text('price').replace(/[^\d]/g, ''))
  const category = text('category')
  const description = text('description').slice(0, 2000)
  const details = text('details')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12)

  if (name.length < 2) return { error: 'Donnez un nom à l’annonce.' }
  if (!Number.isFinite(price) || price <= 0) return { error: 'Indiquez un prix en euros.' }
  if (!CATEGORIES.includes(category)) return { error: 'Choisissez une catégorie.' }
  if (description.length < 10) return { error: 'Ajoutez une description de quelques mots.' }

  return {
    fields: {
      name,
      price: Math.round(price),
      category,
      description,
      details,
      breed: text('breed').slice(0, 80),
      sex: text('sex').slice(0, 40),
      age: text('age').slice(0, 40),
      height: text('height').slice(0, 40),
      discipline: text('discipline').slice(0, 80),
      place: text('place').slice(0, 80),
    },
  }
}

// Un nouvel envoi ne doit jamais écraser une photo par un fichier refusé.
function readPhoto(body: Record<string, string | File>): { file: File | null; error?: undefined } | { file?: undefined; error: string } {
  const photo = body.photo
  if (!(photo instanceof File) || photo.size === 0) return { file: null }
  if (photo.size > 8 * 1024 * 1024) return { error: 'La photo dépasse 8 Mo.' }
  if (!photo.type.startsWith('image/')) return { error: 'Le fichier n’est pas une image.' }
  return { file: photo }
}

function photoExtension(photo: File) {
  return photo.type.split('/')[1]?.replace('jpeg', 'jpg').replace('svg+xml', 'svg') ?? 'jpg'
}

app.post('/api/admin/login', async (c) => {
  if (!isSameOriginRequest(c.req.raw, c.env.APP_ORIGIN)) return c.json({ error: 'Requête refusée : origine inattendue.' }, 403)

  const credentials = adminCredentials(c.env)
  if (!credentials) {
    console.error('ADMIN_CREDENTIALS absent ou illisible : connexion impossible.')
    return c.json({ error: 'La connexion n’est pas configurée sur ce site.' }, 503, { 'cache-control': 'no-store' })
  }

  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => null)
  const email = (body?.email ?? '').trim().toLowerCase()
  const password = body?.password ?? ''
  if (!email || !password) return c.json({ error: 'Renseignez l’e-mail et le mot de passe.' }, 400)

  await ensureSchema(c.env.DB)
  const attemptKey = c.req.header('cf-connecting-ip')?.trim() || 'inconnu'
  if ((await attemptsInWindow(c.env.DB, attemptKey)) >= MAX_ATTEMPTS) {
    await logRefusal(c.env.DB, attemptKey, 'bloque')
    return c.json({ error: 'Trop de tentatives. Réessayez dans un quart d’heure.' }, 429, { 'cache-control': 'no-store' })
  }

  // Le mot de passe est vérifié même si l'e-mail ne correspond pas : la
  // réponse arrive au même moment dans les deux cas.
  const matches = sameHash(await hashPassword(password, credentials), credentials.hash) && email === credentials.email
  if (!matches) {
    await recordFailure(c.env.DB, attemptKey)
    await logRefusal(c.env.DB, attemptKey, 'refuse')
    console.warn('Connexion admin refusée.')
    return c.json({ error: 'E-mail ou mot de passe incorrect.' }, 401, { 'cache-control': 'no-store' })
  }

  await clearFailures(c.env.DB, attemptKey)
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
  const now = new Date()
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  // L'appareil est retenu pour que l'écran des sessions puisse les distinguer :
  // la chaîne brute reste en base, le libellé lisible est calculé à la lecture.
  const userAgent = (c.req.header('user-agent') ?? '').slice(0, 300)
  await logLogin(c.env.DB, attemptKey, userAgent)
  await c.env.DB.prepare(
    'INSERT INTO admin_sessions (token_hash, email, created_at, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(await sha256Hex(token), credentials.email, now.toISOString(), expires.toISOString(), userAgent, attemptKey === 'inconnu' ? '' : attemptKey)
    .run()
  // Les sessions périmées ne servent plus : on les efface au passage.
  await c.env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now.toISOString()).run().catch(() => undefined)
  // Une sixième connexion pousse dehors la plus ancienne : l'écran reste lisible
  // et un appareil oublié ne reste pas connecté des semaines.
  await c.env.DB.prepare(
    `DELETE FROM admin_sessions
      WHERE token_hash NOT IN (
        SELECT token_hash FROM admin_sessions ORDER BY created_at DESC, rowid DESC LIMIT ?
      )`,
  )
    .bind(MAX_SESSIONS)
    .run()
    .catch(() => undefined)

  return c.json(
    { email: credentials.email },
    200,
    { 'set-cookie': sessionCookie(c.req.raw, token, SESSION_DAYS * 24 * 60 * 60), 'cache-control': 'private, no-store' },
  )
})

app.post('/api/admin/logout', async (c) => {
  if (!isSameOriginRequest(c.req.raw, c.env.APP_ORIGIN)) return c.json({ error: 'Requête refusée : origine inattendue.' }, 403)
  const token = readCookie(c.req.raw, SESSION_COOKIE)
  if (token) {
    await ensureSchema(c.env.DB)
    await c.env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run().catch(() => undefined)
  }
  return c.json({ ok: true }, 200, { 'set-cookie': sessionCookie(c.req.raw, '', 0), 'cache-control': 'private, no-store' })
})

// ——— Sessions ouvertes —————————————————————————————————————————
// La base ne garde que l'empreinte du jeton : l'identifiant affiché à l'écran
// en est le début, il ne permet donc pas de rejouer le cookie.
const SESSION_ID_LENGTH = 16

/** « Chrome · Windows » à partir de l'en-tête User-Agent, vide si inconnu. */
function deviceLabel(userAgent: string) {
  if (!userAgent) return ''
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\/|Opera/.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\/|CriOS/.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : ''
  const system = /Windows/.test(userAgent)
    ? 'Windows'
    : /iPhone|iPad|iPod/.test(userAgent)
      ? 'iOS'
      : /Android/.test(userAgent)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : ''
  return [browser, system].filter(Boolean).join(' · ')
}

app.get('/api/admin/sessions', async (c) => {
  const admin = await requireOwner(c)
  if (admin instanceof Response) return admin
  const now = new Date().toISOString()
  // Les sessions périmées ne sont plus « ouvertes » : elles partent au passage.
  await c.env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now).run().catch(() => undefined)
  const { results } = await c.env.DB.prepare(
    'SELECT token_hash, created_at, expires_at, user_agent, ip FROM admin_sessions ORDER BY created_at DESC',
  ).all<{ token_hash: string; created_at: string; expires_at: string; user_agent: string; ip: string }>()
  const token = readCookie(c.req.raw, SESSION_COOKIE)
  const current = token ? await sha256Hex(token) : ''
  return c.json(
    {
      sessions: (results ?? []).map((row) => ({
        id: row.token_hash.slice(0, SESSION_ID_LENGTH),
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        device: deviceLabel(row.user_agent ?? ''),
        ip: row.ip ?? '',
        current: row.token_hash === current,
      })),
    },
    200,
    { 'cache-control': 'private, no-store' },
  )
})

/**
 * Terme de filtre saisi dans l'admin (`?ip=`), réduit à une longueur utile.
 * La comparaison se fait par `instr` sur l'adresse en minuscules : pas de
 * joker SQL à échapper, et un début d'adresse IPv6 suffit à retrouver un poste.
 */
function ipFilter(c: Context<{ Bindings: Env }>) {
  return (c.req.query('ip') ?? '').trim().toLowerCase().slice(0, 60)
}

app.get('/api/admin/failures', async (c) => {
  const admin = await requireOwner(c)
  if (admin instanceof Response) return admin
  const term = ipFilter(c)
  const where = term ? 'WHERE instr(lower(ip), ?) > 0' : ''
  const rows = c.env.DB.prepare(`SELECT created_at, ip, reason FROM admin_login_failures ${where} ORDER BY id DESC LIMIT 20`)
  const count = c.env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_login_failures ${where}`)
  const { results } = await (term ? rows.bind(term) : rows).all<{ created_at: string; ip: string; reason: string }>()
  const total = await (term ? count.bind(term) : count).first<{ n: number }>()
  return c.json(
    {
      filter: term,
      total: total?.n ?? 0,
      attempts: (results ?? []).map((row) => ({ at: row.created_at, ip: row.ip, reason: row.reason })),
    },
    200,
    { 'cache-control': 'private, no-store' },
  )
})

app.get('/api/admin/logins', async (c) => {
  const admin = await requireOwner(c)
  if (admin instanceof Response) return admin
  const term = ipFilter(c)
  const where = term ? 'WHERE instr(lower(ip), ?) > 0' : ''
  const rows = c.env.DB.prepare(`SELECT created_at, ip, user_agent FROM admin_logins ${where} ORDER BY id DESC LIMIT 20`)
  const count = c.env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_logins ${where}`)
  const { results } = await (term ? rows.bind(term) : rows).all<{ created_at: string; ip: string; user_agent: string }>()
  const total = await (term ? count.bind(term) : count).first<{ n: number }>()
  return c.json(
    {
      filter: term,
      total: total?.n ?? 0,
      logins: (results ?? []).map((row) => ({ at: row.created_at, ip: row.ip, device: deviceLabel(row.user_agent ?? '') })),
    },
    200,
    { 'cache-control': 'private, no-store' },
  )
})

app.post('/api/admin/failures/clear', async (c) => {
  const admin = await requireOwner(c)
  if (admin instanceof Response) return admin
  const removed = await c.env.DB.prepare('DELETE FROM admin_login_failures').run()
  return c.json({ ok: true, cleared: removed.meta.changes ?? 0 }, 200, { 'cache-control': 'private, no-store' })
})

app.post('/api/admin/sessions/close', async (c) => {
  const admin = await requireOwner(c)
  if (admin instanceof Response) return admin
  const body = (await c.req.json().catch(() => null)) as { id?: unknown } | null
  const id = typeof body?.id === 'string' ? body.id.trim().toLowerCase() : ''
  if (!/^[0-9a-f]{16}$/.test(id)) return c.json({ error: 'Session inconnue.' }, 400, { 'cache-control': 'private, no-store' })
  const token = readCookie(c.req.raw, SESSION_COOKIE)
  const removed = await c.env.DB.prepare('DELETE FROM admin_sessions WHERE substr(token_hash, 1, ?) = ?')
    .bind(SESSION_ID_LENGTH, id)
    .run()
  if (!removed.meta.changes) return c.json({ error: 'Session déjà fermée.' }, 404, { 'cache-control': 'private, no-store' })
  // Fermer son propre appareil revient à se déconnecter : le cookie part avec.
  if (token && (await sha256Hex(token)).startsWith(id)) {
    return c.json({ ok: true, current: true }, 200, { 'set-cookie': sessionCookie(c.req.raw, '', 0), 'cache-control': 'private, no-store' })
  }
  return c.json({ ok: true, current: false }, 200, { 'cache-control': 'private, no-store' })
})

app.post('/api/admin/sessions/close-others', async (c) => {
  const admin = await requireOwner(c)
  if (admin instanceof Response) return admin
  const token = readCookie(c.req.raw, SESSION_COOKIE)
  if (!token) return c.json({ error: 'Session expirée. Reconnectez-vous.' }, 401, { 'cache-control': 'private, no-store' })
  // Tout part sauf l'empreinte du poste qui fait la demande : il reste connecté.
  const removed = await c.env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash <> ?')
    .bind(await sha256Hex(token))
    .run()
  return c.json({ ok: true, closed: removed.meta.changes ?? 0 }, 200, { 'cache-control': 'private, no-store' })
})

app.get('/api/me', async (c) => {
  const admin = await currentAdmin(c.env, c.req.raw)
  // Même forme qu'avant pour l'admin : un `user` à afficher et un droit.
  return c.json(
    { user: admin ? { email: admin.email, name: admin.email } : null, owner: Boolean(admin) },
    200,
    { 'cache-control': 'private, no-store' },
  )
})

app.get('/api/listings', async (c) => {
  try {
    await ensureSchema(c.env.DB)
    const { results } = await c.env.DB.prepare('SELECT * FROM listings ORDER BY created_at DESC').all<ListingRow>()
    return c.json({ listings: results.map(toListing) }, 200, { 'cache-control': 'no-store' })
  } catch (error) {
    console.error('Lecture des annonces impossible :', error)
    return c.json({ error: 'Impossible de charger vos annonces.' }, 500)
  }
})

app.post('/api/listings', async (c) => {
  const owner = await requireOwner(c)
  if (owner instanceof Response) return owner

  const body = await c.req.parseBody().catch(() => null)
  if (!body) return c.json({ error: 'Formulaire illisible.' }, 400)

  const parsed = readListing(body)
  if (!parsed.fields) return c.json({ error: parsed.error }, 400)
  const fields = parsed.fields

  const id = crypto.randomUUID()
  const slug = `${slugify(fields.name)}-${id.slice(0, 6)}`
  let photoKey: string | null = null

  const read = readPhoto(body)
  if (read.error) return c.json({ error: read.error }, 400)
  if (read.file) {
    photoKey = `listings/${id}.${photoExtension(read.file)}`
    await c.env.FILES.put(photoKey, await read.file.arrayBuffer(), { httpMetadata: { contentType: read.file.type } })
  }

  const now = new Date().toISOString()

  try {
    await ensureSchema(c.env.DB)
    await c.env.DB.prepare(
      `INSERT INTO listings (id, created_at, updated_at, slug, name, price, category, breed, sex, age, height, discipline, place, description, details, photo_key, owner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        now,
        now,
        slug,
        fields.name,
        fields.price,
        fields.category,
        fields.breed,
        fields.sex,
        fields.age,
        fields.height,
        fields.discipline,
        fields.place,
        fields.description,
        JSON.stringify(fields.details),
        photoKey,
        owner.email,
      )
      .run()
  } catch (error) {
    if (photoKey) await c.env.FILES.delete(photoKey).catch(() => undefined)
    console.error('Enregistrement de l’annonce impossible :', error)
    return c.json({ error: 'Impossible d’enregistrer cette annonce.' }, 500)
  }

  const row = await c.env.DB.prepare('SELECT * FROM listings WHERE id = ?').bind(id).first<ListingRow>()
  return c.json({ listing: row ? toListing(row) : null }, 201)
})

app.put('/api/listings/:id', async (c) => {
  const owner = await requireOwner(c)
  if (owner instanceof Response) return owner
  const id = c.req.param('id')

  const body = await c.req.parseBody().catch(() => null)
  if (!body) return c.json({ error: 'Formulaire illisible.' }, 400)

  const parsed = readListing(body)
  if (!parsed.fields) return c.json({ error: parsed.error }, 400)
  const fields = parsed.fields

  const read = readPhoto(body)
  if (read.error) return c.json({ error: read.error }, 400)

  await ensureSchema(c.env.DB)
  const existing = await c.env.DB.prepare('SELECT * FROM listings WHERE id = ?').bind(id).first<ListingRow>()
  if (!existing) return c.json({ error: 'Annonce introuvable.' }, 404)

  // Le slug ne bouge pas : un lien déjà partagé continue de marcher.
  let photoKey = existing.photo_key
  let replacedKey: string | null = null

  if (body.removePhoto === '1') {
    replacedKey = photoKey
    photoKey = null
  }

  if (read.file) {
    const key = `listings/${id}.${photoExtension(read.file)}`
    if (key !== existing.photo_key) replacedKey = existing.photo_key
    await c.env.FILES.put(key, await read.file.arrayBuffer(), { httpMetadata: { contentType: read.file.type } })
    photoKey = key
  }

  try {
    await c.env.DB.prepare(
      `UPDATE listings SET updated_at = ?, name = ?, price = ?, category = ?, breed = ?, sex = ?, age = ?, height = ?,
         discipline = ?, place = ?, description = ?, details = ?, photo_key = ?
       WHERE id = ? AND owner_id = ?`,
    )
      .bind(
        new Date().toISOString(),
        fields.name,
        fields.price,
        fields.category,
        fields.breed,
        fields.sex,
        fields.age,
        fields.height,
        fields.discipline,
        fields.place,
        fields.description,
        JSON.stringify(fields.details),
        photoKey,
        id,
        owner.email,
      )
      .run()
  } catch (error) {
    if (photoKey && photoKey !== existing.photo_key) await c.env.FILES.delete(photoKey).catch(() => undefined)
    console.error('Modification de l’annonce impossible :', error)
    return c.json({ error: 'Impossible d’enregistrer cette annonce.' }, 500)
  }

  if (replacedKey && replacedKey !== photoKey) await c.env.FILES.delete(replacedKey).catch(() => undefined)

  const row = await c.env.DB.prepare('SELECT * FROM listings WHERE id = ?').bind(id).first<ListingRow>()
  return c.json({ listing: row ? toListing(row) : null })
})

app.delete('/api/listings/:id', async (c) => {
  const owner = await requireOwner(c)
  if (owner instanceof Response) return owner
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('SELECT photo_key, owner_id FROM listings WHERE id = ?')
    .bind(id)
    .first<{ photo_key: string | null; owner_id: string }>()
  if (!row) return c.json({ error: 'Annonce introuvable.' }, 404)
  await c.env.DB.prepare('DELETE FROM listings WHERE id = ?').bind(id).run()
  if (row.photo_key) await c.env.FILES.delete(row.photo_key).catch(() => undefined)
  return c.json({ ok: true })
})

app.get('/api/photo/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT photo_key FROM listings WHERE id = ?').bind(c.req.param('id')).first<{ photo_key: string | null }>()
  if (!row?.photo_key) return c.json({ error: 'Photo introuvable.' }, 404)
  const object = await c.env.FILES.get(row.photo_key)
  if (!object) return c.json({ error: 'Photo introuvable.' }, 404)
  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable',
      etag: object.httpEtag,
    },
  })
})

// Inscription au pied de page. Une adresse déjà connue réussit quand même :
// la réponse ne dit jamais qui est déjà inscrit.
app.post('/api/newsletter', async (c) => {
  const body = await c.req.json<{ email?: string; market?: string }>().catch(() => ({}) as { email?: string; market?: string })
  const email = body.email?.trim().toLowerCase() ?? ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    return c.json({ error: 'Entrez une adresse e-mail valide.' }, 400)
  }
  const requested = body.market?.trim() ?? ''
  const market = MARKETS.some((candidate) => candidate.id === requested) ? requested : ''
  try {
    await ensureSchema(c.env.DB)
    await c.env.DB.prepare(
      'INSERT INTO subscribers (id, created_at, email, market) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO NOTHING',
    )
      .bind(crypto.randomUUID(), new Date().toISOString(), email, market)
      .run()
  } catch (error) {
    console.error('Enregistrement de l’inscription impossible :', error)
    return c.json({ error: 'Impossible de vous inscrire pour l’instant. Réessayez plus tard.' }, 500)
  }
  return c.json({ ok: true })
})

// Les commandes et les inscrits, pour l'admin — même réserve que les demandes.
app.get('/api/orders', async (c) => {
  const owner = await requireOwner(c)
  if (owner instanceof Response) return owner
  try {
    await ensureSchema(c.env.DB)
    const { results } = await c.env.DB.prepare(
      'SELECT reference, created_at, email, items, total, market, notified_at FROM orders ORDER BY created_at DESC LIMIT 200',
    ).all<{ reference: string; created_at: string; email: string; items: string; total: number; market: string; notified_at: string }>()
    return c.json(
      {
        orders: results.map((row) => {
          let items: OrderLine[] = []
          try {
            const parsed: unknown = JSON.parse(row.items)
            if (Array.isArray(parsed)) items = parsed as OrderLine[]
          } catch {
            items = []
          }
          return {
            reference: row.reference,
            createdAt: row.created_at,
            email: row.email,
            items,
            total: row.total,
            market: row.market,
            notified: Boolean(row.notified_at),
          }
        }),
      },
      200,
      { 'cache-control': 'private, no-store' },
    )
  } catch (error) {
    console.error('Lecture des commandes impossible :', error)
    return c.json({ error: 'Impossible de charger les commandes.' }, 500)
  }
})

// Suppression d'une commande : la ligne disparaît des listes, mais le journal
// `admin_messages` est conservé — savoir qu'on a écrit à un acheteur reste
// utile même après le nettoyage d'une commande de test.
app.delete('/api/orders/:reference', async (c) => {
  const owner = await requireOwner(c)
  if (owner instanceof Response) return owner
  const reference = c.req.param('reference')
  try {
    await ensureSchema(c.env.DB)
    const row = await c.env.DB.prepare('SELECT id FROM orders WHERE reference = ?').bind(reference).first<{ id: string }>()
    if (!row) return c.json({ error: 'Commande introuvable.' }, 404)
    await c.env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(row.id).run()
    return c.json({ ok: true }, 200, { 'cache-control': 'private, no-store' })
  } catch (error) {
    console.error('Suppression de la commande impossible :', error)
    return c.json({ error: 'Impossible de supprimer cette commande.' }, 500)
  }
})

// Désinscription depuis l'admin : la demande de quelqu'un qui ne veut plus rien
// recevoir doit pouvoir être honorée sans passer par la base à la main.
app.delete('/api/subscribers/:email', async (c) => {
  const owner = await requireOwner(c)
  if (owner instanceof Response) return owner
  const email = c.req.param('email').trim().toLowerCase()
  try {
    await ensureSchema(c.env.DB)
    const row = await c.env.DB.prepare('SELECT id FROM subscribers WHERE email = ?').bind(email).first<{ id: string }>()
    if (!row) return c.json({ error: 'Inscription introuvable.' }, 404)
    await c.env.DB.prepare('DELETE FROM subscribers WHERE id = ?').bind(row.id).run()
    return c.json({ ok: true }, 200, { 'cache-control': 'private, no-store' })
  } catch (error) {
    console.error('Suppression de l’inscription impossible :', error)
    return c.json({ error: 'Impossible de supprimer cette inscription.' }, 500)
  }
})

app.get('/api/subscribers', async (c) => {
  const owner = await requireOwner(c)
  if (owner instanceof Response) return owner
  try {
    await ensureSchema(c.env.DB)
    const { results } = await c.env.DB.prepare(
      'SELECT email, created_at, market FROM subscribers ORDER BY created_at DESC LIMIT 500',
    ).all<{ email: string; created_at: string; market: string }>()
    return c.json(
      { subscribers: results.map((row) => ({ email: row.email, createdAt: row.created_at, market: row.market })) },
      200,
      { 'cache-control': 'private, no-store' },
    )
  } catch (error) {
    console.error('Lecture des inscriptions impossible :', error)
    return c.json({ error: 'Impossible de charger les inscriptions.' }, 500)
  }
})

// Modèles de messages : l'admin les lit et les réécrit à sa main. Ils vivent
// en base, donc un texte changé vaut immédiatement, sans redéploiement.
app.get('/api/admin/templates', async (c) => {
  const owner = await requireOwner(c)
  if (owner instanceof Response) return owner
  try {
    await ensureSchema(c.env.DB)
    const { results } = await c.env.DB.prepare(
      'SELECT key, label, audience, subject, body, updated_at FROM message_templates ORDER BY audience DESC, label ASC',
    ).all<TemplateRow>()
    return c.json(
      {
        templates: results.map((row) => ({
          key: row.key,
          label: row.label,
          audience: row.audience === 'commande' ? 'commande' : 'inscription',
          subject: row.subject,
          body: row.body,
          updatedAt: row.updated_at,
        })),
      },
      200,
      { 'cache-control': 'private, no-store' },
    )
  } catch (error) {
    console.error('Lecture des modèles impossible :', error)
    return c.json({ error: 'Impossible de charger les modèles.' }, 500)
  }
})

app.put('/api/admin/templates/:key', async (c) => {
  const owner = await requireOwner(c)
  if (owner instanceof Response) return owner
  const body = await c.req.json<{ subject?: string; body?: string }>().catch(() => null)
  const subject = (body?.subject ?? '').trim()
  const text = (body?.body ?? '').trim()
  if (!subject) return c.json({ error: 'Renseignez un objet.' }, 400)
  if (subject.length > MESSAGE_SUBJECT_MAX) return c.json({ error: `L’objet dépasse ${MESSAGE_SUBJECT_MAX} caractères.` }, 400)
  if (text.length < 10) return c.json({ error: 'Le message est trop court.' }, 400)
  if (text.length > MESSAGE_BODY_MAX) return c.json({ error: `Le message dépasse ${MESSAGE_BODY_MAX} caractères.` }, 400)

  try {
    await ensureSchema(c.env.DB)
    const updatedAt = new Date().toISOString()
    const result = await c.env.DB.prepare('UPDATE message_templates SET subject = ?, body = ?, updated_at = ? WHERE key = ?')
      .bind(subject, text, updatedAt, c.req.param('key'))
      .run()
    if (!result.meta.changes) return c.json({ error: 'Ce modèle n’existe pas.' }, 404)
    return c.json({ ok: true, updatedAt }, 200, { 'cache-control': 'private, no-store' })
  } catch (error) {
    console.error('Enregistrement du modèle impossible :', error)
    return c.json({ error: 'Impossible d’enregistrer ce modèle.' }, 500)
  }
})

// Envoi d'un message à une adresse. Le contexte d'une commande (référence,
// lignes, total) est relu en base : ce qui part ne dépend jamais des valeurs
// envoyées par le navigateur.
app.post('/api/admin/messages', async (c) => {
  const owner = await requireOwner(c)
  if (owner instanceof Response) return owner
  const body = await c.req
    .json<{ to?: string; template?: string; subject?: string; body?: string; reference?: string }>()
    .catch(() => null)
  const to = (body?.to ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 160) return c.json({ error: 'Adresse e-mail invalide.' }, 400)
  const subject = (body?.subject ?? '').trim()
  const text = (body?.body ?? '').trim()
  if (!subject) return c.json({ error: 'Renseignez un objet.' }, 400)
  if (subject.length > MESSAGE_SUBJECT_MAX) return c.json({ error: `L’objet dépasse ${MESSAGE_SUBJECT_MAX} caractères.` }, 400)
  if (text.length < 10) return c.json({ error: 'Écrivez le message avant de l’envoyer.' }, 400)
  if (text.length > MESSAGE_BODY_MAX) return c.json({ error: `Le message dépasse ${MESSAGE_BODY_MAX} caractères.` }, 400)

  const reference = (body?.reference ?? '').trim()

  try {
    await ensureSchema(c.env.DB)

    let order: { reference: string; items: string; total: number } | null = null
    if (reference) {
      order = await c.env.DB.prepare('SELECT reference, items, total FROM orders WHERE reference = ?')
        .bind(reference)
        .first<{ reference: string; items: string; total: number }>()
      if (!order) return c.json({ error: 'Commande introuvable.' }, 404)
    }

    let items: OrderLine[] | undefined
    if (order) {
      items = []
      try {
        const parsed: unknown = JSON.parse(order.items)
        if (Array.isArray(parsed)) items = parsed as OrderLine[]
      } catch {
        items = []
      }
    }

    const context: MessageContext = { email: to, reference: order?.reference, total: order?.total, items }
    const filledSubject = fillTemplate(subject, context, c.env).slice(0, MESSAGE_SUBJECT_MAX)
    const filledText = fillTemplate(text, context, c.env)

    // Sans clé Resend, le message est tout de même journalisé : l'admin voit
    // qu'il est parti de son écran sans jamais être arrivé.
    let status: 'envoye' | 'echec' | 'sans-cle' = 'envoye'
    let detail = ''
    if (!c.env.RESEND_API_KEY) {
      status = 'sans-cle'
      detail = 'RESEND_API_KEY manquant.'
    } else {
      const sent = await sendEmail(c.env, {
        to,
        subject: filledSubject,
        text: filledText,
        html: messageHtml(filledText),
      }).catch((error: unknown) => {
        console.error('Envoi du message impossible :', error)
        return false
      })
      if (!sent) {
        status = 'echec'
        detail = 'Resend a refusé l’envoi.'
      }
    }

    await c.env.DB.prepare(
      'INSERT INTO admin_messages (created_at, email, template_key, subject, body, reference, status, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(
        new Date().toISOString(),
        to,
        (body?.template ?? '').slice(0, 60),
        filledSubject,
        filledText,
        order?.reference ?? '',
        status,
        detail,
      )
      .run()
      .catch((error: unknown) => console.error('Journal du message impossible :', error))
    await c.env.DB.prepare('DELETE FROM admin_messages WHERE id NOT IN (SELECT id FROM admin_messages ORDER BY id DESC LIMIT 200)')
      .run()
      .catch(() => undefined)

    if (status === 'sans-cle') {
      return c.json({ status, error: 'Aucune clé Resend : le message est enregistré, mais rien n’est parti.' }, 503)
    }
    if (status === 'echec') {
      return c.json({ status, error: 'Resend n’a pas accepté l’envoi. Vérifiez la clé et l’adresse d’expédition.' }, 502)
    }
    return c.json({ status, subject: filledSubject, body: filledText }, 200, { 'cache-control': 'private, no-store' })
  } catch (error) {
    console.error('Envoi du message impossible :', error)
    return c.json({ error: 'Impossible d’envoyer ce message.' }, 500)
  }
})

// ——— Référencement ————————————————————————————————————————————
// L'app est une SPA : le Worker réécrit l'en-tête de index.html pour que
// chaque URL et chaque marché ait son titre, son canonical et ses hreflang.

const listingProduct = (row: ListingRow): SeoProduct => ({
  name: row.name,
  price: row.price,
  description: row.description,
  image: row.photo_key ? `/api/photo/${row.id}?v=${encodeURIComponent(row.updated_at || row.created_at)}` : null,
  category: row.category,
  breed: row.breed,
  age: row.age,
  place: row.place,
})

async function productFor(env: Env, slug: string): Promise<SeoProduct | undefined> {
  try {
    await ensureSchema(env.DB)
    const row = await env.DB.prepare('SELECT * FROM listings WHERE slug = ?').bind(slug).first<ListingRow>()
    if (row) return listingProduct(row)
  } catch (error) {
    // Une base indisponible ne doit pas casser une fiche du fonds.
    console.error('Lecture de la fiche pour le SEO impossible :', error)
  }
  const fallback = marketListings.find((product) => product.slug === slug)
  if (!fallback) return undefined
  return {
    name: fallback.name,
    price: fallback.price,
    description: fallback.description,
    image: fallback.image ?? null,
    category: fallback.category,
    breed: fallback.breed,
    age: fallback.age,
    place: fallback.place,
  }
}

app.get('/robots.txt', (c) => c.body(robots(new URL(c.req.url).origin), 200, { 'content-type': 'text/plain; charset=utf-8' }))

app.get('/sitemap.xml', async (c) => {
  // Les fiches du fonds n'ont pas de date de modification : pas de `lastmod`.
  let products: SitemapProduct[] = marketListings.map((product) => ({ slug: product.slug }))
  try {
    await ensureSchema(c.env.DB)
    const { results } = await c.env.DB.prepare(
      `SELECT slug, COALESCE(NULLIF(updated_at, ''), created_at) AS lastmod FROM listings`,
    ).all<{ slug: string; lastmod: string }>()
    products = [...results.map((row) => ({ slug: row.slug, lastmod: row.lastmod })), ...products]
  } catch (error) {
    console.error('Plan du site sans les annonces en base :', error)
  }
  return c.body(sitemap(new URL(c.req.url).origin, products), 200, {
    'content-type': 'application/xml; charset=utf-8',
    'cache-control': 'public, max-age=600',
  })
})

app.get('*', async (c) => {
  const request = c.req.raw
  const asset = await c.env.ASSETS.fetch(request)
  const contentType = asset.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) return asset

  const url = new URL(request.url)
  const slug = url.pathname.match(/\/product\/([^/]+)\/?$/)?.[1]
  const product = slug ? await productFor(c.env, decodeURIComponent(slug)) : undefined

  // L'app redirige les URL inconnues vers l'accueil. Servies en 200, elles
  // passeraient pour des pages valides aux yeux des moteurs : on répond 404.
  const path = stripMarket(url.pathname, marketFromPath(url.pathname))
  const knownPage = /^\/(?:shop|about|admin|checkout|order\/[^/]+)?\/?$/.test(path)
  const notFound = !knownPage && !(slug && product)

  const headers = new Headers(asset.headers)
  headers.delete('content-length')
  headers.set('content-type', 'text/html; charset=utf-8')
  return new Response(
    applySeo(await asset.text(), { origin: url.origin, pathname: url.pathname, search: url.search, product, notFound }),
    {
      status: notFound ? 404 : asset.status,
      headers,
    },
  )
})

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

/**
 * Hôtes qui ne doivent jamais entrer dans un index : la prévisualisation sert
 * le même contenu que la production, avec des canonical et des `hreflang` qui
 * désignent le domaine de production. Les laisser indexer mettrait les deux
 * hôtes en concurrence. À compléter si l'environnement de prévisualisation
 * change d'hôte ; un domaine de production, lui, n'est pas concerné.
 */
const PREVIEW_HOSTS = new Set(['site-7ef7b2b2bb224ba3a4671527936a4320.freebuff.page'])
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function outOfIndex(hostname: string) {
  return PREVIEW_HOSTS.has(hostname) || LOCAL_HOSTS.has(hostname)
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const response = await app.fetch(request, env, ctx)
    if (!outOfIndex(new URL(request.url).hostname)) return response

    // `X-Robots-Tag` plutôt qu'un `Disallow` : le robot doit pouvoir lire la
    // page pour voir qu'elle est exclue, et les liens de maillage restent utiles.
    const headers = new Headers(response.headers)
    headers.set('x-robots-tag', 'noindex')
    const body = response.body && response.status !== 204 && response.status !== 304 ? response.body : null
    return new Response(body, { status: response.status, statusText: response.statusText, headers })
  },
}
