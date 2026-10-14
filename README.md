# ACREA Fitness — démonstration locale

Une PWA Expo/React Native pour découvrir l’évaluation ACREA en trois séances,
les six mouvements associés, le profil local et le minuteur.
La session est fictive : aucun compte, mot de passe, backend ou clé API n’est requis.
Les données restent dans une base SQLite dédiée à cette démonstration, dans le navigateur.

## Démarrer

Prérequis : Node 24 et pnpm 11.7.0.

```bash
git clone https://github.com/simonbdbc/fitness-app.git
cd fitness-app
pnpm run setup
pnpm demo
```

Ouvrir http://127.0.0.1:4173 et choisir **Continuer en session locale**.
Dans **Profil**, renseigner des valeurs fictives ; ouvrir ensuite **Évaluation de niveau**.
Pour développer : `pnpm dev`. Pour les tests navigateur, installer Chromium avec
`pnpm --dir apps/pwa exec playwright install chromium`. Pour vérifier : `pnpm typecheck`, `pnpm test`, `pnpm e2e`.
Arrêter le serveur avec Ctrl+C. Effacer uniquement les données du site de démonstration
dans le navigateur pour recommencer avec un profil neuf.

## Contenu

- `apps/pwa/` : interface, persistance locale, minuteur et tests.
- `contracts/catalog/` : protocole des six exercices et périmètre de démonstration.
- `docs/bibliotheque/` : six fiches FR/EN et douze médias.
- `crates/` : sources du moteur Rust/WASM embarqué et reconstructible.

Les données de formats sont limitées aux **neuf formats réellement utilisés**.
Les outils de backend, SQL de production, anciennes copies de seeds, générateur audio,
landing marketing et documents internes ne font pas partie de cette démo.
Le catalogue complet reste privé. La démo ne reproduit pas l’installation de production
et ne qualifie pas le mobile natif ni les résultats sportifs.

## Provenance et publication

Le développement est conservé dans GitLab privé. Ce dépôt reçoit un export contrôlé,
sans historique privé ni données utilisateur. Le job contrôlé lit la branche dédiée
`publication/github-main` toutes les quinze minutes lorsque le Mac de publication
est éveillé et connecté. Cette branche est exclue des builds Cloudflare ;
la synchronisation des sources ne déploie pas l’application.
Aucune licence globale nouvelle n’est ajoutée : les notices des contenus retenus sont
préservées, sans présumer des droits supplémentaires sur code, fiches, médias ou dépendances.

[Périmètre de publication et exclusions de production](PUBLICATION.md).
