# Roadmap ACREA Fitness

État mis à jour le 22 août 2026. Cible : `release-beta-v1.00` / version
applicative `1.0.0-beta.1`.

## Décision actuelle

**GO atteint pour le catalogue progressif hors ligne.** La migration de
production, la publication PWA et les smoke tests associés ont été réalisés ;
la preuve datée est conservée dans
[`docs/release/GO-RECOVERY-PROGRESSIVE-CATALOG.md`](release/GO-RECOVERY-PROGRESSIVE-CATALOG.md).
Les identités, profils, évaluations, programmes et feedback restent hors du
périmètre de la migration locale V33, qui ajoute uniquement le suivi de cache.

Les 707 exercices complets restent la source distante : l'application embarque
le noyau d'évaluation et charge l'index puis les fiches à la demande. Les
audits NO-GO antérieurs restent des éléments historiques ; ils ne décrivent pas
l'état opérationnel courant.

## État par environnement

| Environnement | Révision / version | État | Décision |
|---|---|---|---|
| Production PWA | `aacc4aa1`, 13/08/2026 | Déploiement Cloudflare actif ; catalogue progressif publié et smoke testé | Référence de rollback applicative |
| Production landing | Déploiement Cloudflare actif | Desktop/mobile vérifiés sans erreur console | Maintenir |
| Production API | Aucun endpoint DNS joignable | Backend Rust non déployé | Hors v1 sauf décision contraire |
| Messagerie production | 22/08/2026 | MX Stalwart actif, envois Brevo et Auth Supabase configurés ; smoke test entrant/sortant validé | Exploitation courante |
| `origin/main` | `78d84c27` | Rapport GO publié ; le build runtime reste tracé par sa révision Cloudflare | Référence documentaire |
| `feature/progressive-offline-catalog` | Intégrée à `main` | Catalogue progressif qualifié et publié | Historique |

## État des produits et composants

| Domaine | Ce qui existe | Preuve manquante / blocage | Statut |
|---|---|---|---|
| Landing | Site public responsive et sain | Qualification finale avant release | `IN_PROGRESS` |
| Auth / rôles | Auth Supabase, rôles basic/premium/admin, RLS historique | QA multi-rôles en prod ; un seul compte admin observé | `IN_PROGRESS` |
| Bibliothèque V2 | 707 exercices bilingues complets, 1 414 médias, révision générée ; les 5 piliers sont couverts | 555 exercices incomplets exclus ; vérification licence/provenance à tracer avant publication commerciale | `IN_PROGRESS` |
| Catalogue local | Noyau V4 embarqué, index et fiches à la demande ; filtres persistants, posters visibles et fiche stable | QA native de la reprise à terminer | `IN_PROGRESS` |
| Programme ACREA | Core Rust/WASM et contrats V3/V4 présents ; 453 templates principaux et les phases fixes sont générés | E2E réel profil → V4 → programme à exécuter | `IN_PROGRESS` |
| Supabase | Migration de reset beta, release/médias/RLS et RPC V4 ajoutées localement | Replay Postgres, pgTAP, seed et dry-run sur copie à prouver | `IN_PROGRESS` |
| Backend Rust | Service Axum et tests unitaires présents | Non déployé, schéma catalogue incompatible, routes sensibles non authentifiées | `TODO` hors v1 par défaut |
| PWA/offline | Manifest, service worker, SQLite et écran offline présents | Build WIP frais + E2E web/mobile + upgrade sur copie complète | `IN_PROGRESS` |
| Conformité site public | Pages légales, liens footer, notice d'inscription et sitemap en cours d'intégration | Validation des informations d'éditeur et de conservation, inventaire anonyme des traceurs, mise en production contrôlée | `IN_PROGRESS` |

## Jalons jusqu'à `release-beta-v1.00`

### M0 — Gel et référentiel de preuves

Statut : `IN_PROGRESS`. EPIC : `EPIC-030`.

- Publier l'audit, cette roadmap et le contrat de sortie.
- Supprimer les documents legacy après retrait de toute dépendance active.
- Rendre les statuts calculables depuis les tickets, sans pourcentage manuel.

Sortie : documentation active unique, aucun lien ou build vers `docs-legacy`.

### M1 — Bibliothèque V2 réellement canonique

Statut : `IN_PROGRESS`. EPIC : `EPIC-031`.

- Conserver `docs/bibliotheque` comme source unique : chaque exercice publié
  porte ses deux fiches linguistiques et ses deux médias.
- Conserver les 555 exercices incomplets dans `docs/bibliotheque-incomplete`,
  avec leurs raisons normalisées ; ne jamais les publier par défaut.
- Les 707 fiches complètes sont validées `valide` / `validated` / `eligible`
  pour la beta ; conserver leur trace de décision dans l'audit beta.
- Tracer licence/provenance et la revue éditoriale complémentaire avant une
  release commerciale ; cela n'est pas masqué par le statut beta.
- Générer les 453 templates principaux des trois piliers ACREA et les deux
  phases fixes, avec une correspondance explicite difficulté→niveau ACREA.
- Générer PWA, SQLite et Supabase exclusivement depuis la bibliothèque V2.

Sortie : aucune fiche incomplète dans l'artefact ; décision beta datée pour les
707 fiches ; un template compatible par pilier et niveau ACREA 1–10.

### M2 — Convergence SQLite / Supabase / V4

Statut : `IN_PROGRESS`. EPIC : `EPIC-032`.

- Conserver les migrations V32/V33 additives et leurs tests réels, dont
  l'upgrade V32→V33 sans perte de profils, évaluations, programmes ou cache.
- Compléter la preuve d'upgrade sur une copie V29 représentative avec
  programmes, séances, feedback, rollback et comparaison de schéma.
- Rejouer la migration beta Supabase (release, médias, V4, RPC, grants et RLS)
  sur une copie ; vérifier le seed V2 de 707 exercices / 455 templates.
- Exécuter la remise à zéro explicitement approuvée : supprimer le graphe
  métier de programmation, conserver Auth/profils/équipement/évaluations
  complétées et remapper leurs identifiants vers la V2/V4.
- Régénérer les schémas SQL documentaires depuis les bases réelles.

Sortie : reset local vert, dry-run sur copie, parité de révision et de volumes,
sauvegarde restaurable avant purge et évaluations historiques lisibles avec les
identifiants V2/V4.

### M3 — Fermeture fonctionnelle

Statut : `IN_PROGRESS`. EPIC : `EPIC-033`.

- Requalifier EPIC 025–027 sur la nouvelle base.
- Remplacer le pilotage V3 par le contrat V4 validé.
- Maintenir verts composants (59/59), IA PWA (30/30), synchronisation et
  médias ; compléter les gates encore absents du pipeline candidat.
- Exécuter le parcours profil → évaluation → candidats → génération → séance →
  feedback sur web et mobile.
- Décider explicitement les éléments reportés à `1.1`.

Sortie : toutes les suites obligatoires et l'E2E métier sont verts sur un build
frais du commit candidat.

### M4 — Qualification et déploiement beta v1.00

Statut : `IN_PROGRESS`. EPIC : `EPIC-034`.

- Aligner les versions sur `1.0.0-beta.1` uniquement après M0–M3.
- Sauvegarder, simuler le reset, puis appliquer migration et seed en fenêtre
  contrôlée avec approbation explicite.
- Vérifier PWA, Auth, offline, mise à jour, données et observabilité en prod.
- Publier notes de version et matrice de preuves ; taguer
  `release-beta-v1.00`.

Sortie : tous les gates de `docs/release/RELEASE-BETA-v1.00.md` sont `PASS`.

### M5 — Expérience Bibliothèque et reprise applicative

Statut : `IN_PROGRESS` — les QA installées de `087cc45b` et `1eda0ad3` ont
échoué ; retour strict au comportement Minuteur/Entraînement de `f5cd675` en
validation locale. La généralisation reste bloquée jusqu'au gate humain.

- [x] Uniformiser la vue d'ensemble de la Bibliothèque, déplacer les commandes
  sous celle-ci et intégrer la recherche aux filtres.
- [x] Conserver les filtres par utilisateur avec `CARDIO` comme pilier initial,
  sans jamais restaurer des identifiants SQLite périssables.
- [x] Hydrater et vérifier uniquement les posters des cartes réellement visibles ;
  conserver le poster dans une modale stable et charger l'animation uniquement
  après un clic explicite, avec respect de la réduction des animations.
- [x] Retirer la tentative de centralisation non validée : coordinateur global,
  `foregroundRevision`, checkpoint `sessionStorage`, `launchQueue`, journal de
  reprise, rafraîchissements automatiques et persistance générique d'écran.
- [x] Restaurer strictement le hook et le stockage V2 du Minuteur depuis
  `f5cd675`, avec écoute directe de `visibilitychange` et `AppState`.
- [x] Restaurer strictement l'Entraînement de `f5cd675` : séance, exercice et
  feedback synchrones sur les clés Web historiques ; minuteurs d'effort et de
  récupération sur AsyncStorage V2.
- [x] Reproduire le défaut humain en recréant un document standalone contrôlé
  par le service worker depuis le `start_url` `/`.
- [x] Retirer les checkpoints de route, `launch_handler`, persistance globale
  du scroll et listeners lifecycle du shell ajoutés après `f5cd675`.
- [x] Verrouiller par SHA-256 les vingt fichiers de l'enveloppe PWA, du
  Minuteur et de l'Entraînement, ainsi que les six versions runtime critiques.
- [x] Rejouer la matrice automatisée de la phase 1 : 15 tests machine, 75 tests
  composants, 5 contrats d'architecture, 19 contrats PWA/API, typecheck, build,
  validation PWA et 13 E2E avec service workers actifs.
- [ ] Valider humainement sur PWA installée : Timer puis Entraînement,
  arrière-plan → premier plan sans apparition de `/home`, puis restauration
  après navigation/remontage.
- [ ] Après cet accord uniquement, concevoir une nouvelle centralisation et la
  déployer route par route avec un gate installé propre à chaque route.

Plan détaillé :
[`docs/architecture/pwa/PERSISTENCE-RECOVERY-PLAN.md`](architecture/pwa/PERSISTENCE-RECOVERY-PLAN.md).

Sortie : consultation progressive fluide, filtres persistants, reprise sans
perte d'état et téléchargement complet manuel inchangé.

### M6 — Conformité du site public et parcours d'inscription

Statut : `IN_PROGRESS`. Périmètre : landing Astro et continuité des liens dans
la PWA, sans changement de traitement métier ni de backend.

- [x] Créer les routes statiques `mentions-legales`, `politique-de-confidentialite`,
  `conditions-generales-utilisation` et `cookies`, puis les rendre accessibles
  depuis chaque footer de la landing.
- [x] Ajouter les routes légales au sitemap, avec canonical propre, et vérifier
  qu'une route légale générée produit son HTML et non une soft 404.
- [x] Ajouter la mention de copyright publique : `© 2026 ACREA-FITNESS. Tous
  droits réservés.`
- [x] Afficher avant la création de compte les liens vers les CGU, la politique
  de confidentialité et les informations cookies de la landing.
- [x] Documenter et appliquer un gate CI : l'identité de l'éditeur, son adresse
  professionnelle, le responsable de publication, le contact confidentialité
  et les durées de conservation doivent être fournies par variables GitLab
  avant tout déploiement.
- [x] Vérifier le code de la landing et de la PWA : aucun traceur non essentiel
  n'est configuré par défaut. Le pipeline refuse désormais un endpoint
  d'analytics PWA tant qu'un consentement conforme n'est pas livré.
- [x] Mettre en service la messagerie transactionnelle : `support@acrea-fitness.fr`
  est reçu par Stalwart, `noreply@acrea-fitness.fr` est son alias et l'expéditeur
  Brevo `ACREA Fitness`. Les envois externes Stalwart et Auth Supabase passent
  par deux identifiants SMTP Brevo distincts, stockés hors dépôt.
- [x] Basculer le MX public vers `10 mail.sbcenter.fr.` et le vérifier auprès de
  Cloudflare et Google. Les tests de réception Stalwart, de réponse Thunderbird
  via Brevo et de confirmation Auth Supabase ont été validés le 22 août 2026.
- [ ] Demander la mise à jour du PTR public de `176.171.14.46` vers
  `mail.sbcenter.fr` lorsque le fournisseur le permet. Ce point n'empêche pas
  le flux actuel : Stalwart ne remet pas directement les messages externes,
  Brevo assure la sortie SMTP.
- [x] Renseigner dans GitLab CI les variables obligatoires de publication :
  `PUBLIC_LEGAL_ENTITY_NAME`, `PUBLIC_LEGAL_REGISTERED_OFFICE`,
  `PUBLIC_LEGAL_PUBLICATION_DIRECTOR`, `PUBLIC_LEGAL_PRIVACY_CONTACT` et
  `PUBLIC_LEGAL_DATA_RETENTION`. Les valeurs de référence sont documentées dans
  `apps/landing/.env.example`.
- [ ] Auditer en session anonyme la landing et la PWA : cookies, localStorage,
  IndexedDB, service worker et appels réseau. Si un traceur non essentiel est
  activé, implémenter un CMP avec `Accepter`, `Refuser` et `Gérer mes cookies`
  accessibles au même niveau, ainsi qu'un retrait du consentement permanent.
- [ ] Vérifier le parcours public landing → inscription PWA avec les liens
  légaux, le clavier et une session non authentifiée, aux formats desktop et
  mobile.
- [ ] Faire valider par conseil juridique les CGU et, avant toute offre payante,
  ajouter les CGV et les informations consommateur applicables.

Sortie : les quatre pages légales sont publiées avec données validées, le
parcours d'inscription informe avant collecte, l'inventaire des traceurs est
daté, et la CI refuse une publication incomplète.

## Priorité d'exécution

1. M6 : valider les données juridiques et exécuter l'inventaire anonyme des
   traceurs avant toute amplification publique de la landing.
2. M5 : terminer la QA native Android/iOS de la suspension et de la reprise.
3. Rejouer les gates beta encore applicables, sans altérer les preuves de GO
   déjà consignées.
4. Poursuivre M1–M4 sur les preuves éditoriales, multi-rôles et de release beta.

## Règles de changement

- Aucun push/migration Supabase distante depuis ce chantier sans sauvegarde,
  dry-run sur copie et accord explicite.
- La migration beta peut tronquer exclusivement le périmètre métier décrit dans
  le contrat beta ; elle exige sauvegarde, dry-run et approbation explicite.
- Seule `docs/bibliotheque` entre dans la chaîne de build ;
  `docs/bibliotheque-incomplete` est strictement exclue.
- Le code équipement est un identifiant stable ; l'admin ne peut ni le renommer
  ni le supprimer s'il est canonique.
- Un artefact `dist` antérieur au commit candidat ne constitue pas une preuve.
- Les versions restent à `0.1.0` tant que les gates beta ne sont pas verts.
