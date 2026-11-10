# Soumission et suivi SEO des onze marchés

État au 9 novembre 2026 : 11 marchés, 6 langues, 187 URL dans le sitemap
(6 pages + 11 fiches produit par marché), 12 balises `hreflang` par page
(11 marchés + `x-default`), 2 244 liens linguistiques dans le sitemap.

Ce plan couvre la mise en index, la validation des annotations
internationales et le maillage entre marchés. Il suppose une URL de
production figée : tout (canonical, `hreflang`, sitemap) est calculé à partir
de l'origine de la requête, donc rien à recoder au basculement, mais aussi
aucune protection contre une indexation du domaine de prévisualisation.

## 1. Ce que le site déclare déjà

| Signal | État | Où |
| --- | --- | --- |
| `lang` + `hreflang` autoréciproques, `x-default` vers `/` | 12 balises par page | `src/worker/seo.ts`, `src/app/lib/useSeo.ts` |
| Canonical par marché, paramètres de tri retirés | `/de-lu/shop?category=chevaux&sort=asc` → `/de-lu/shop?category=chevaux` | `canonicalFor` |
| Titres et descriptions rédigés par marché | 6 pages × 11 marchés | `src/data/seo.ts` |
| JSON-LD `@graph` avec `inLanguage` et `areaServed` | par marché | `structuredData` |
| Sitemap unique avec alternates `xhtml:link` | 187 URL / 2 244 liens | `/sitemap.xml` |
| `robots.txt` : admin et API fermés, sitemap déclaré | — | `/robots.txt` |
| URL inconnue | 404 réel + `noindex`, sans canonical | `src/worker/index.ts` |
| Open Graph localisé + 10 `og:locale:alternate` | par marché | `headTags` |

Rien de tout cela ne demande une action manuelle dans Search Console : les
marchés sont des préfixes d'un seul hôte, pas onze sites.

## 2. Préalables bloquants

À traiter avant la première soumission, sinon on indexe un doublon.

| # | Problème | Correction | État |
| --- | --- | --- | --- |
| 1 | L'hôte `*.freebuff.page` répond `Allow: /` et sert un sitemap identique à la production. Deux hôtes indexés = canonical et `hreflang` contradictoires. | En-tête `X-Robots-Tag: noindex` sur les hôtes de prévisualisation et de développement, dans `src/worker/index.ts` (`PREVIEW_HOSTS`, `LOCAL_HOSTS`). À compléter si l'environnement de prévisualisation change d'hôte. | **fait** |
| 2 | `/checkout` répond 200 avec un canonical propre : page vide pour un robot. | `noindex` sur `/checkout` et `/order/<référence>`, côté Worker (`src/worker/seo.ts`) et côté navigation interne (`src/app/lib/useSeo.ts`). | **fait** |
| 3 | Le sitemap n'a pas de `lastmod` : rien n'indique au robot qu'une fiche a changé. | `lastmod` sur les fiches produit (date `updated_at`, à défaut `created_at`). Les pages fixes n'en portent pas : le sitemap est régénéré à chaque requête, y mettre la date du jour annoncerait un contenu modifié chaque jour. | **fait** |
| 4 | Le domaine de production n'est pas encore choisi ni publié. | Figer l'URL finale, la publier, puis seulement soumettre. Ne jamais soumettre la prévisualisation. | à faire |

Tant que 1 et 4 ne sont pas faits, on ne soumet rien : on prépare seulement
la propriété et on vérifie en inspection d'URL.

## 3. Soumission

### Search Console

1. **Une seule propriété, de type « Domaine »** (vérification DNS TXT).
   Onze propriétés seraient une erreur : les marchés sont des dossiers
   d'URL, pas des domaines. Ajouter un utilisateur délégué en accès restreint
   pour la personne qui suivra les chiffres.
2. **Un seul sitemap** : `https://<domaine>/sitemap.xml`. Il contient déjà les
   variantes de chaque page ; un sitemap par marché n'apporterait rien et
   multiplierait les rapports à surveiller.
3. **Pas de rapport de ciblage international** : il a été retiré de Search
   Console en 2022, et le réglage de pays n'existe plus. Google continue de
   lire `hreflang`, mais ne le valide plus dans l'interface. La validation
   active se fait donc avec un crawler (Screaming Frog en version gratuite
   suffit pour 187 URL) ou par inspection d'URL.
4. **Inspection d'URL, 22 URL prioritaires** : pour chaque marché, l'accueil
   et `/shop?category=chevaux`. Vérifier deux choses : « Page indexée » et
   « Canonicale sélectionnée par Google = la page elle-même ». Une demande
   d'exploration est limitée en volume quotidien : la réserver à ces 22 URL,
   le reste passe par le sitemap.
5. **Performances** : filtrer par préfixe d'URL (`/fr-lu`, `/de-lu`, …), pas
   par pays. Un marché francophone reçoit des impressions depuis la France,
   la Belgique et le Luxembourg à la fois ; le préfixe est le seul axe fiable.
   Enregistrer 11 filtres, un par marché.
6. **Indexation des pages** : surveiller trois motifs.
   - « Page alternative avec une canonicale correcte » : normal, ce sont les
     variantes de tri et de filtre.
   - « Dupliquée, canonicale choisie par Google » : anormal sur une page de
     marché, signale un `hreflang` ou un canonical cassé.
   - « Explorée, actuellement non indexée » : sur les marchés non
     francophones, c'est presque toujours le signal d'un contenu trop proche.

### Bing et les autres

- Bing Webmaster Tools : importer la propriété depuis Search Console, puis
  soumettre le même sitemap. Bing exploite `hreflang` et `lang` de la même
  façon, sans réglage par marché.
- IndexNow : optionnel, utile seulement si le rythme de publication des
  fiches devient quotidien. Nécessite une clé servie à la racine.
- Yandex, Naver, Baidu : hors périmètre tant qu'aucun marché ne les vise.

## 4. Maillage interne, par priorité

Constat de départ : le sélecteur de marché est un `<select>` piloté en
JavaScript. Ce ne sont pas des liens `<a>`, donc pour un moteur les seuls
ponts entre marchés étaient `hreflang` et le sitemap. Le bloc de 11 liens en
pied de page corrige cela ; les priorités suivantes ajoutent les liens
contextuels qui manquent encore.

### P1 — Liste des marchés en pied de page (fait)

Un bloc de 11 liens `<a href>` en pied de page, libellés dans la langue du
marché (« France », « Belgique », « Suisse romande », « Luxembourg »,
« Deutschland », « Schweiz », « Luxemburg », « Slovenija », « Australia »,
« Danmark », « Nederland »), avec `hrefLang` et `aria-current` sur le marché
courant. Sitewide, donc découvrable depuis n'importe quelle page. Pas de
`nofollow` : ces liens sont la structure du site multilingue, pas du spam.
Le sélecteur de l'en-tête reste, il est simplement plus rapide pour changer
de page en gardant le contexte.

### P2 — Paires de marchés à relier contextuellement

| Source | Cibles | Ancre type |
| --- | --- | --- |
| `/` (fr-FR) | `/fr-be`, `/fr-ch`, `/fr-lu` | « Chevaux à vendre pour la Belgique » |
| `/de` | `/de-ch`, `/de-lu` | « Pferde kaufen für Luxemburg » |
| `/fr-lu` | `/de-lu` | « Anzeigen auf Deutsch » |
| `/de-lu` | `/fr-lu` | « Annonces en français » |
| `/en-au`, `/da`, `/nl` | `/` et leur propre `/shop` | « See the catalogue », « Se kataloget », « Bekijk de catalogus » |

Les deux marchés du Luxembourg se lient entre eux : c'est le seul cas où un
acheteur change réellement de langue sur le même pays. Trois à cinq liens
contextuels suffisent, placés dans le contenu (accueil et page écurie), pas
en pied de page une deuxième fois.

### P3 — Catégories

Chaque page de catégorie doit lier vers ses deux sœurs du même marché
(`chevaux` ↔ `poneys` ↔ `autres`) : c'est déjà le cas via la navigation.
Ajouter, en bas de liste, un lien vers la catégorie équivalente du marché
frère quand il existe (`/fr-lu/shop?category=poneys` → `/de-lu/...` non :
on reste dans la même langue). Cible : 2 liens par page de catégorie.

### P4 — Fiches produit

Ne pas créer de liens croisés entre la même fiche dans deux marchés : ce sont
des quasi-doublons, `hreflang` suffit et des liens visibles entre eux
brouillent le choix de canonicale. En revanche, chaque fiche doit offrir un
retour clair vers sa catégorie du marché (fil d'Ariane déjà présent) et vers
deux fiches voisines du même marché (« aussi à voir »).

Règles communes : liens dans le HTML rendu, ancres uniques et descriptives,
pas plus d'une quinzaine de liens internes ajoutés par page, jamais de
redirection par langue basée sur l'IP (le robot explore depuis les
États-Unis et ne verrait qu'un seul marché).

## 5. Suivi

### Tableau de bord, une ligne par marché

| Marché | URL indexées / 17 | Impressions | CTR | Position moy. | Demandes de visite |
| --- | --- | --- | --- | --- | --- |

Les quatre premières colonnes viennent de Search Console (filtre préfixe,
période de 28 jours). La dernière se lit dans `/admin` : la table `enquiries`
enregistre désormais le marché consulté, et l'admin regroupe les demandes par
marché. La page d'origine (`path`) manque encore : on sait de quel marché vient
une demande, pas de quelle fiche.

### Calendrier

| Échéance | Contrôle | Décision |
| --- | --- | --- |
| J0 | Publication + `noindex` prévisualisation + sitemap soumis (Google, Bing) | — |
| J+3 | Sitemap « Réussite », 11 accueils découvertes | Corriger les erreurs de sitemap avant d'aller plus loin |
| J+14 | Couverture par préfixe, motifs d'exclusion | Traiter les « Explorée, non indexée » par différenciation de contenu |
| J+30 | Première lecture des impressions et du CTR par marché | Choisir 2 marchés à renforcer (contenu) et 2 à laisser mûrir |
| J+90 | Revue de fond : requêtes par marché, position moyenne, demandes | Arbitrer entre contenu, maillage et nouvelles langues |

Ne pas conclure avant J+30 sur un marché neuf : l'indexation d'un nouveau
préfixe prend plusieurs semaines, surtout sans liens externes.

## 6. Angles morts de contenu

1. **Les annonces restent en français.** Sur `/de-lu`, `/da`, `/nl`, `/en-au`,
   la fiche affiche « Hongre Selle Français, 13 ans, Eure-et-Loir » sous une
   interface traduite. C'est le principal frein à l'indexation et au CTR hors
   francophonie. Par ordre de rendement : traduire les champs courts (race,
   sexe, discipline, région) par dictionnaire, puis les descriptions des
   fiches en vedette, puis la traduction à la création de l'annonce.
2. **Trois marchés germanophones très proches.** `de-CH` et `de-LU` partagent
   l'essentiel de leur texte avec `de-DE`. `hreflang` évite la confusion entre
   versions, il ne remplace pas la différence de contenu : 150 à 250 mots
   propres par marché (transport, douane et TVA suisses, importation
   australienne) suffisent à distinguer les pages.
3. **Promesse à tenir.** Le titre australien annonce « shipped to Australia » :
   la page doit détailler le transport (délai, quarantaine, coût indicatif),
   sinon l'écart entre titre et contenu coûte en CTR et en qualité perçue.
4. **Fiches produit par marché.** 11 fiches × 11 marchés = 121 URL de fiches,
   dont 110 sont des traductions d'interface autour d'un texte français.
   Prioriser les fiches à forte valeur (celles du sitemap) plutôt que les 121.

## 7. À éviter

- Soumettre ou laisser indexable l'hôte de prévisualisation.
- Créer une propriété Search Console par marché.
- Rediriger automatiquement selon la langue du navigateur ou l'IP : Googlebot
  n'a pas de préférence linguistique et ne verra qu'une version.
- Ajouter `hreflang` sur des pages `noindex` (checkout, admin) : annotation
  sans objet.
- Bloquer un pays dans `robots.txt` ou par géo-filtrage : le marché se déclare
  par `hreflang` et par le contenu, pas par un blocage.

## 8. Actions prêtes à exécuter

| Action | Fichier | État |
| --- | --- | --- |
| `noindex` sur les hôtes de prévisualisation | `src/worker/index.ts` | fait |
| `noindex` sur `/checkout` et `/order/*` | `src/worker/seo.ts`, `src/app/lib/useSeo.ts` | fait |
| `lastmod` dans le sitemap | `src/worker/seo.ts`, `src/worker/index.ts` | fait |
| Bloc de 11 liens de marchés en pied de page | `src/app/components/Footer.tsx` | fait |
| Colonne `market` dans les demandes de visite | `src/worker/index.ts`, `src/app/components/VisitForm.tsx` | fait |
| Affichage des demandes par marché dans l'admin | `src/app/pages/Admin.tsx` | fait |

Les préalables sont couverts. La colonne `path` (page d'origine de la demande)
reste une amélioration possible, pour distinguer une fiche d'une autre.
