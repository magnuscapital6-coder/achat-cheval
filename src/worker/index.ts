import { createFreebuffAuth, isSameOriginRequest } from '@freebuff/auth'
import type { FreebuffAuth, FreebuffUser } from '@freebuff/auth'
import { Hono } from 'hono'
import type { Context } from 'hono'

// Le Worker devant la boutique. Le catalogue est une donnée statique livrée
// avec l'app ; ce Worker gère ce qui demande un serveur.
type Env = {
  ASSETS: Fetcher
  DB: D1Database
  FILES: R2Bucket
  FREEBUFF_CLIENT_ID: string
  FREEBUFF_ISSUER?: string
  APP_ORIGIN: string
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
           message TEXT NOT NULL
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
      // Une seule ligne dans cette table : le compte Freebuff qui gère le
      // catalogue. Elle est remplie à la première connexion.
      db.prepare(
        `CREATE TABLE IF NOT EXISTS site_owner (
           id INTEGER PRIMARY KEY CHECK (id = 1),
           sub TEXT NOT NULL,
           created_at TEXT NOT NULL
         )`,
      ),
    ])
    // Tables créées avant l'édition : les colonnes arrivent ici, sans migration
    // à lancer à la main. L'erreur « column already exists » est sans gravité.
    await db.prepare("ALTER TABLE listings ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''").run().catch(() => undefined)
    await db.prepare("ALTER TABLE listings ADD COLUMN owner_id TEXT NOT NULL DEFAULT ''").run().catch(() => undefined)
  })().catch((error) => {
    schemaReady = undefined
    throw error
  })
  return schemaReady
}

type Enquiry = { id: string; animal: string; name: string; phone: string; message: string; createdAt: string }

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)

// Notification au propriétaire. Sans clé Resend configurée, la demande reste
// enregistrée en base : l'e-mail est un bonus, pas une condition de succès.
async function notifyOwner(env: Env, enquiry: Enquiry) {
  const apiKey = env.RESEND_API_KEY
  const to = env.ENQUIRY_NOTIFY_EMAIL
  if (!apiKey || !to) {
    console.warn('Demande enregistrée, notification e-mail ignorée : RESEND_API_KEY ou ENQUIRY_NOTIFY_EMAIL manquant.')
    return false
  }

  const when = new Date(enquiry.createdAt).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris' })
  const rows: [string, string][] = [
    ['Animal', enquiry.animal],
    ['Nom', enquiry.name],
    ['Téléphone', enquiry.phone],
    ['Reçue le', when],
    ['Référence', enquiry.id],
  ]

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.ENQUIRY_FROM_EMAIL ?? 'achat-cheval <onboarding@resend.dev>',
      to: [to],
      subject: `Demande de visite — ${enquiry.animal} (${enquiry.name})`,
      text: [
        `Nouvelle demande de visite pour ${enquiry.animal}.`,
        '',
        `Nom : ${enquiry.name}`,
        `Téléphone : ${enquiry.phone}`,
        `Reçue le : ${when}`,
        '',
        'Message :',
        enquiry.message,
        '',
        `— achat-cheval, référence ${enquiry.id}`,
      ].join('\n'),
      html: `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#1c1917">
  <h1 style="font-size:20px;margin:0 0 4px">Nouvelle demande de visite</h1>
  <p style="margin:0 0 20px;color:#78716c">${escapeHtml(enquiry.animal)}</p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    ${rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:4px 20px 4px 0;color:#78716c;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0;font-weight:600">${escapeHtml(value)}</td></tr>`,
      )
      .join('\n    ')}
  </table>
  <p style="margin:20px 0 4px;color:#78716c">Message</p>
  <p style="margin:0;white-space:pre-line">${escapeHtml(enquiry.message)}</p>
</div>`,
    }),
  })

  if (!response.ok) {
    console.error(`Resend a refusé l'e-mail (${response.status}) : ${await response.text()}`)
    return false
  }
  return true
}

app.get('/api/health', (c) => c.json({ ok: true }))

// Paiement de démonstration : valide la commande et renvoie une référence.
// Remplacez le corps par une session Stripe Checkout (secret côté Sites →
// Secrets) ou enregistrez les commandes dans D1 quand une base est branchée.
app.post('/api/orders', async (c) => {
  const order = await c.req.json<{ email?: string; items?: { id: string; quantity: number }[] }>().catch(() => null)
  if (!order?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email)) return c.json({ error: 'Entrez une adresse e-mail valide.' }, 400)
  if (!order.items?.length) return c.json({ error: 'Votre panier est vide.' }, 400)
  const reference = `AC-${Date.now().toString(36).toUpperCase().slice(-6)}`
  return c.json({ reference })
})

// Demandes de visite pour les chevaux, poneys et ânes : validation, puis
// enregistrement dans D1 et e-mail de notification au propriétaire.
app.post('/api/enquiries', async (c) => {
  const body = await c.req.json<{ name?: string; phone?: string; message?: string; animal?: string }>().catch(() => null)
  const name = body?.name?.trim() ?? ''
  const phone = body?.phone?.trim() ?? ''
  const message = body?.message?.trim() ?? ''
  const animal = body?.animal?.trim().slice(0, 80) || 'Fiche animal'
  const digits = phone.replace(/\D/g, '')
  if (name.length < 2) return c.json({ error: 'Indiquez votre nom.' }, 400)
  if (digits.length < 6 || digits.length > 20) return c.json({ error: 'Entrez un numéro de téléphone valide.' }, 400)
  if (message.length < 5) return c.json({ error: 'Dites-nous en un peu plus dans le message.' }, 400)

  const enquiry: Enquiry = {
    id: crypto.randomUUID(),
    animal,
    name: name.slice(0, 120),
    phone: phone.slice(0, 40),
    message: message.slice(0, 4000),
    createdAt: new Date().toISOString(),
  }

  try {
    await ensureSchema(c.env.DB)
    await c.env.DB.prepare('INSERT INTO enquiries (id, created_at, animal, name, phone, message) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(enquiry.id, enquiry.createdAt, enquiry.animal, enquiry.name, enquiry.phone, enquiry.message)
      .run()
  } catch (error) {
    console.error('Enregistrement de la demande impossible :', error)
    return c.json({ error: 'Impossible d’enregistrer votre demande. Réessayez ou appelez-nous.' }, 500)
  }

  try {
    await notifyOwner(c.env, enquiry)
  } catch (error) {
    console.error('Notification e-mail impossible :', error)
  }

  return c.json({ ok: true })
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
// Sign in with Freebuff : le compte tient lieu de clé. Une seule instance par
// isolate, elle met en cache la découverte OIDC et les clés de signature.
let auth: FreebuffAuth | undefined

function authFor(env: Env) {
  auth ??= createFreebuffAuth({
    clientId: env.FREEBUFF_CLIENT_ID,
    issuer: env.FREEBUFF_ISSUER,
    baseUrl: env.APP_ORIGIN,
    // Uniquement le développement local, en http.
    allowInsecureLocalhost: env.APP_ORIGIN.startsWith('http://localhost') || env.APP_ORIGIN.startsWith('http://127.0.0.1'),
  })
  return auth
}

/** Le compte qui gère le catalogue, s'il s'est déjà connecté une fois. */
async function ownerSub(env: Env) {
  await ensureSchema(env.DB)
  const row = await env.DB.prepare('SELECT sub FROM site_owner WHERE id = 1').first<{ sub: string }>()
  return row?.sub ?? null
}

/**
 * Le visiteur connecté, ou une réponse 401. Toute écriture passe par là :
 * cacher un bouton ne protège rien.
 */
async function requireUser(c: Context<{ Bindings: Env }>): Promise<FreebuffUser | Response> {
  if (!isSameOriginRequest(c.req.raw, c.env.APP_ORIGIN)) return c.json({ error: 'Requête refusée : origine inattendue.' }, 403)
  const user = await authFor(c.env).getUser(c.req.raw)
  if (!user) return c.json({ error: 'Connectez-vous pour gérer le catalogue.' }, 401, { 'cache-control': 'private, no-store' })
  return user
}

/**
 * Le propriétaire, ou une réponse. La première connexion revendique le
 * catalogue ; ensuite un autre compte est refusé.
 */
async function requireOwner(c: Context<{ Bindings: Env }>): Promise<FreebuffUser | Response> {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  if (!(await ownerSub(c.env))) {
    await c.env.DB.prepare('INSERT INTO site_owner (id, sub, created_at) VALUES (1, ?, ?) ON CONFLICT (id) DO NOTHING')
      .bind(user.sub, new Date().toISOString())
      .run()
  }

  if ((await ownerSub(c.env)) !== user.sub) {
    return c.json({ error: 'Ce catalogue est géré par un autre compte.' }, 403, { 'cache-control': 'private, no-store' })
  }
  return user
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

app.get('/api/me', async (c) => {
  const user = await authFor(c.env).getUser(c.req.raw)
  const current = user ? await ownerSub(c.env) : null
  // Tant que personne n'a revendiqué le catalogue, le premier compte connecté
  // a la main (la revendication se fait à la première écriture).
  const owner = user ? current === null || current === user.sub : false
  return c.json({ user, owner }, 200, { 'cache-control': 'private, no-store' })
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
        owner.sub,
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
  if (existing.owner_id !== owner.sub) return c.json({ error: 'Cette annonce appartient à un autre compte.' }, 403)

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
        owner.sub,
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
  if (row.owner_id !== owner.sub) return c.json({ error: 'Cette annonce appartient à un autre compte.' }, 403)
  await c.env.DB.prepare('DELETE FROM listings WHERE id = ? AND owner_id = ?').bind(id, owner.sub).run()
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

app.post('/api/newsletter', async (c) => {
  const body = await c.req.json<{ email?: string }>().catch(() => ({}) as { email?: string })
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return c.json({ error: 'Entrez une adresse e-mail valide.' }, 400)
  return c.json({ ok: true })
})

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

// `wrap` sert /auth/freebuff/* (connexion, retour, déconnexion, session) et
// rafraîchit la session avant de passer la main : il doit rester devant tout
// le reste, y compris le repli sur les assets.
let wrapped: ((request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>) | undefined

function handlerFor(env: Env) {
  wrapped ??= authFor(env).wrap(app.fetch)
  return wrapped
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return handlerFor(env)(request, env, ctx)
  },
}
