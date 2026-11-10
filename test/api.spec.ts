// Tests d'intégration des routes `/api/*`, exécutés par Vitest dans workerd
// (voir `vitest.config.ts`) : le Worker réel, une vraie base D1 locale, un vrai
// bucket R2. Aucun secret de production, aucun appel réseau.
import { env, SELF } from 'cloudflare:test'
import { beforeAll, describe, expect, it } from 'vitest'

const origin = 'http://localhost'
const adminEmail = 'admin@example.com'
const adminPassword = 'mot-de-passe-de-test-2026'

/** Espaces insécables des formats `Intl` ramenés à des espaces simples. */
const plain = (value: string) => value.replace(/[\u202f\u00a0\s]+/g, ' ').trim()

const send = (method: string, path: string, body: unknown, headers: Record<string, string> = {}) =>
  SELF.fetch(`${origin}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

const get = (path: string, headers: Record<string, string> = {}) => send('GET', path, undefined, headers)
const post = (path: string, body: unknown, headers: Record<string, string> = {}) => send('POST', path, body, headers)
const put = (path: string, body: unknown, headers: Record<string, string> = {}) => send('PUT', path, body, headers)

/** Les en-têtes d'une requête d'admin : même origine, session en cours. */
const admin = (extra: Record<string, string> = {}) => {
  if (!cookie) throw new Error('Aucune session : le test de connexion doit passer avant.')
  return { origin, cookie, 'sec-fetch-site': 'same-origin', ...extra }
}

/** L'origine seule, sans session : pour vérifier les refus 401. */
const sameSite = { origin, 'sec-fetch-site': 'same-origin' }

let cookie = ''

async function signIn() {
  const response = await post('/api/admin/login', { email: adminEmail, password: adminPassword }, sameSite)
  expect(response.status).toBe(200)
  const setCookie = response.headers.get('set-cookie') ?? ''
  expect(setCookie).toContain('HttpOnly')
  expect(setCookie).toContain('SameSite=Lax')
  cookie = setCookie.split(';')[0] ?? ''
}

beforeAll(signIn)

describe('santé et catalogue', () => {
  it('répond sur /api/health', async () => {
    const response = await get('/api/health')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('publie un sitemap qui contient les fiches du fonds', async () => {
    const response = await get('/sitemap.xml')
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('hongre-sf-13-ans-eure-et-loir')
  })
})

describe('inscriptions', () => {
  it('refuse une adresse invalide', async () => {
    const response = await post('/api/newsletter', { email: 'pas-une-adresse' })
    expect(response.status).toBe(400)
  })

  it('enregistre une adresse en minuscules et ignore le doublon', async () => {
    const first = await post('/api/newsletter', { email: '  Marie.Durand@Example.com ', market: 'fr-be' })
    expect(first.status).toBe(200)

    const second = await post('/api/newsletter', { email: 'marie.durand@example.com', market: 'fr-be' })
    expect(second.status).toBe(200)

    const { results } = await env.DB.prepare('SELECT email, market FROM subscribers').all<{ email: string; market: string }>()
    expect(results).toEqual([{ email: 'marie.durand@example.com', market: 'fr-be' }])
  })

  it('garde la liste réservée à l’admin', async () => {
    const anonymous = await get('/api/subscribers', sameSite)
    expect(anonymous.status).toBe(401)

    const response = await get('/api/subscribers', admin())
    expect(response.status).toBe(200)
    const data = (await response.json()) as { subscribers: { email: string }[] }
    expect(data.subscribers.map((row) => row.email)).toEqual(['marie.durand@example.com'])
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
})

describe('commandes', () => {
  let reference = ''

  it('recalcule le total depuis le catalogue, pas depuis le navigateur', async () => {
    const response = await post('/api/orders', {
      email: 'cliente@example.com',
      market: 'fr',
      // Prix fantaisiste à 1 €, article inconnu : ni l'un ni l'autre ne compte.
      items: [
        { id: 'hongre-sf-13-ans-eure-et-loir', quantity: 2, price: 1 },
        { id: 'fiche-qui-nexiste-pas', quantity: 1 },
      ],
      total: 1,
    })
    expect(response.status).toBe(200)
    const data = (await response.json()) as { reference: string; total: number }
    expect(data.total).toBe(58000)
    expect(data.reference).toMatch(/^AC-/)
    reference = data.reference
  })

  it('refuse un panier vide ou une adresse invalide', async () => {
    const empty = await post('/api/orders', { email: 'cliente@example.com', items: [{ id: 'fiche-qui-nexiste-pas' }] })
    expect(empty.status).toBe(400)

    const badEmail = await post('/api/orders', { email: 'invalide', items: [{ id: 'hongre-sf-13-ans-eure-et-loir' }] })
    expect(badEmail.status).toBe(400)
  })

  it('affiche la commande dans l’admin', async () => {
    const response = await get('/api/orders', admin())
    expect(response.status).toBe(200)
    const data = (await response.json()) as { orders: { reference: string; total: number; items: { name: string }[] }[] }
    const order = data.orders.find((row) => row.reference === reference)
    expect(order?.total).toBe(58000)
    expect(order?.items).toHaveLength(1)
  })
})

describe('demandes de visite', () => {
  it('valide les champs et enregistre la demande', async () => {
    const invalid = await post('/api/enquiries', { name: 'A', phone: '12', message: 'non' })
    expect(invalid.status).toBe(400)

    const response = await post('/api/enquiries', {
      name: 'Camille',
      phone: '06 12 34 56 78',
      message: 'Disponible samedi ?',
      animal: 'Hongre Selle Français',
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })

    const list = await get('/api/enquiries', admin())
    expect(list.status).toBe(200)
    const data = (await list.json()) as { enquiries: { name: string; phone: string }[] }
    expect(data.enquiries[0]).toMatchObject({ name: 'Camille', phone: '06 12 34 56 78' })
  })
})

describe('connexion admin', () => {
  it('refuse une requête venue d’un autre site', async () => {
    const response = await post(
      '/api/admin/login',
      { email: adminEmail, password: adminPassword },
      { origin: 'https://ailleurs.example' },
    )
    expect(response.status).toBe(403)
  })

  it('refuse un mauvais mot de passe sans dire si l’e-mail existe', async () => {
    const response = await post('/api/admin/login', { email: adminEmail, password: 'mauvais-mot-de-passe' }, sameSite)
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'E-mail ou mot de passe incorrect.' })
  })

  it('liste la session ouverte, la referme, puis en rouvre une', async () => {
    const sessions = await get('/api/admin/sessions', admin())
    expect(sessions.status).toBe(200)
    const data = (await sessions.json()) as { sessions: { current: boolean }[] }
    expect(data.sessions).toHaveLength(1)
    expect(data.sessions[0]?.current).toBe(true)

    const logout = await post('/api/admin/logout', undefined, admin())
    expect(logout.status).toBe(200)
    const after = await get('/api/admin/sessions', admin())
    expect(after.status).toBe(401)

    // La suite des tests a besoin d'une session : on en rouvre une.
    cookie = ''
    await signIn()
  })
})

describe('modèles de messages', () => {
  it('sème les cinq modèles au premier usage', async () => {
    const response = await get('/api/admin/templates', admin())
    expect(response.status).toBe(200)
    const data = (await response.json()) as { templates: { key: string; audience: string }[] }
    expect(data.templates.map((template) => template.key).sort()).toEqual([
      'bienvenue',
      'expedition',
      'nouveautes',
      'paiement-attente',
      'paiement-recu',
    ])
    expect(data.templates.filter((template) => template.audience === 'commande')).toHaveLength(3)
  })

  it('exige une session et la même origine', async () => {
    const anonymous = await get('/api/admin/templates', sameSite)
    expect(anonymous.status).toBe(401)

    const foreign = await get('/api/admin/templates', admin({ origin: 'https://ailleurs.example' }))
    expect(foreign.status).toBe(403)
  })

  it('réécrit un modèle et le relit', async () => {
    const update = await put(
      '/api/admin/templates/bienvenue',
      { subject: 'Bienvenue chez {{boutique}}', body: 'Bonjour,\n\nMerci de votre inscription.\n\n{{lien}}' },
      admin(),
    )
    expect(update.status).toBe(200)
    const { updatedAt } = (await update.json()) as { updatedAt: string }
    expect(updatedAt).not.toBe('')

    const response = await get('/api/admin/templates', admin())
    const data = (await response.json()) as { templates: { key: string; subject: string }[] }
    expect(data.templates.find((template) => template.key === 'bienvenue')?.subject).toBe('Bienvenue chez {{boutique}}')
  })

  it('refuse un objet vide, un texte trop court ou un modèle inconnu', async () => {
    const emptySubject = await put('/api/admin/templates/bienvenue', { subject: '   ', body: 'Bonjour,\n\nMerci.' }, admin())
    expect(emptySubject.status).toBe(400)

    const tooShort = await put('/api/admin/templates/bienvenue', { subject: 'Bonjour', body: 'court' }, admin())
    expect(tooShort.status).toBe(400)

    const unknown = await put(
      '/api/admin/templates/inconnu',
      { subject: 'Bonjour', body: 'Un texte assez long pour passer.' },
      admin(),
    )
    expect(unknown.status).toBe(404)
  })
})

describe('envoi de messages', () => {
  it('exige une session et la même origine', async () => {
    const anonymous = await post(
      '/api/admin/messages',
      { to: 'cliente@example.com', subject: 'Bonjour', body: 'Un message assez long.' },
      sameSite,
    )
    expect(anonymous.status).toBe(401)

    const foreign = await post(
      '/api/admin/messages',
      { to: 'cliente@example.com', subject: 'Bonjour', body: 'Un message assez long.' },
      admin({ origin: 'https://ailleurs.example' }),
    )
    expect(foreign.status).toBe(403)
  })

  it('refuse une adresse invalide ou un message vide', async () => {
    const badEmail = await post(
      '/api/admin/messages',
      { to: 'invalide', subject: 'Bonjour', body: 'Un message assez long.' },
      admin(),
    )
    expect(badEmail.status).toBe(400)

    const emptyText = await post('/api/admin/messages', { to: 'cliente@example.com', subject: 'Bonjour', body: '   ' }, admin())
    expect(emptyText.status).toBe(400)
  })

  it('refuse une référence de commande inconnue', async () => {
    const response = await post(
      '/api/admin/messages',
      {
        to: 'cliente@example.com',
        reference: 'AC-000000',
        subject: 'Votre commande',
        body: 'Bonjour,\n\nUn message assez long.',
      },
      admin(),
    )
    expect(response.status).toBe(404)
  })

  it('remplit référence, total et articles, puis journalise sans clé Resend', async () => {
    const reference = await latestReference()
    const response = await post(
      '/api/admin/messages',
      {
        to: 'Cliente@Example.com',
        template: 'paiement-attente',
        reference,
        subject: 'Commande {{reference}} — {{boutique}}',
        body: 'Bonjour,\n\nMontant : {{total}}\nArticles :\n{{articles}}\n\n{{inconnu}}',
      },
      admin(),
    )
    // Pas de clé Resend dans les tests : le message est enregistré, pas envoyé.
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ status: 'sans-cle' })

    const row = await env.DB.prepare(
      'SELECT email, template_key, subject, body, reference, status FROM admin_messages ORDER BY id DESC LIMIT 1',
    ).first<{ email: string; template_key: string; subject: string; body: string; reference: string; status: string }>()

    expect(row).toMatchObject({ email: 'cliente@example.com', template_key: 'paiement-attente', status: 'sans-cle' })
    expect(row?.reference).toBe(reference)
    expect(row?.subject).toBe(`Commande ${reference} — achat-cheval`)
    expect(plain(row?.body ?? '')).toContain('Montant : 58 000 €')
    expect(plain(row?.body ?? '')).toMatch(/· 2 × .* — 58 000 €/)
    // Un jeton inconnu reste visible plutôt que d'être vidé en silence.
    expect(row?.body).toContain('{{inconnu}}')
  })
})

async function latestReference() {
  const row = await env.DB.prepare('SELECT reference FROM orders ORDER BY created_at DESC LIMIT 1').first<{ reference: string }>()
  if (!row) throw new Error('Aucune commande en base pour le test.')
  return row.reference
}
