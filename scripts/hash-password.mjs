// Produit le secret `ADMIN_CREDENTIALS` de la connexion admin :
//   node scripts/hash-password.mjs 'mot de passe' [e-mail]
// Le mot de passe n'est ni affiché ni écrit sur le disque ; seul son condensat
// PBKDF2-SHA256 sort, à recopier dans Sites → Secrets. 16 octets de sel,
// SHA-256, 32 octets. 60 000 itérations tiennent dans le budget CPU du Worker
// hébergé (210 000 y dépassaient et la connexion répondait 500) ; c'est le
// nombre inscrit dans le secret qui fait foi, le Worker n'impose rien.
import { pbkdf2Sync, randomBytes } from 'node:crypto'

const password = process.argv[2]
const email = (process.argv[3] ?? 'elitecorporation292@gmail.com').trim().toLowerCase()

if (!password) {
  console.error('Usage : node scripts/hash-password.mjs \'mot de passe\' [e-mail]')
  process.exit(1)
}
if (password.length < 12) console.error('Attention : moins de 12 caractères, choisissez plus long.')

const salt = randomBytes(16)
const iterations = 60000
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256')

console.log(
  JSON.stringify({ email, salt: salt.toString('hex'), iterations, hash: hash.toString('hex') }),
)
