import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

// Les tests tournent dans workerd, le runtime du Worker déployé, avec une base
// D1 et un bucket R2 locaux : ce qui passe ici passe en ligne, sans dépendre
// d'un serveur lancé à côté. `wrangler.test.jsonc` reprend la configuration du
// Worker sans les assets, inutiles aux routes `/api/*`.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.test.jsonc' },
      miniflare: {
        bindings: {
          // Un identifiant de test, propre au dépôt : ce condensat ne donne
          // accès à rien d'autre qu'à la base émulée par les tests.
          ADMIN_CREDENTIALS: JSON.stringify({
            email: 'admin@example.com',
            salt: '9a31af4f01fa2881104011887f4e4188',
            iterations: 60000,
            hash: '2fbfcd19b7481e06d1cdb3e8d7d5f5a2cda8efc7ed5e3f6d9145a9c6cf08f9ed',
          }),
          APP_ORIGIN: 'http://localhost',
          // Vide volontairement : un `.dev.vars` local peut contenir une vraie
          // clé, et ces valeurs-ci l'emportent — aucun test n'appelle Resend.
          RESEND_API_KEY: '',
          ENQUIRY_NOTIFY_EMAIL: '',
          ENQUIRY_FROM_EMAIL: '',
        },
      },
    }),
  ],
  test: {
    include: ['test/**/*.spec.ts'],
  },
})
