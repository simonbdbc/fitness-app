# Composants pages admin catalogue

## Objectif

Les pages admin catalogue doivent partager une structure globale de composants
UI reutilisables. La reference visuelle et fonctionnelle canonique est
`/admin/catalogue/intervalles`.

## Socle de composants

- `AdminCatalogPage` : conteneur vertical commun.
- `AdminCatalogHeader` : titre, description et action primaire optionnelle.
- `AdminCatalogLoadingState` et `AdminCatalogErrorState` : etats techniques.
- `AdminCatalogMessage` : message succes/erreur.
- `AdminCatalogStats` et `AdminCatalogStatTile` : indicateurs.
- `AdminCatalogToolbar` : actions secondaires et filtres.
- `AdminCatalogList` : empilement des cartes.
- `AdminCatalogItemCard` : carte standard d'item catalogue.
- `AdminCatalogCrudList` : action primaire, etat vide, cartes item, badges,
  contenu metier et action `Editer` selon le modele `intervalles`.
- `AdminCatalogModal` : edition/creation.
- `AdminCatalogTextInput`, `AdminCatalogSelectionChips`,
  `AdminCatalogMultiSelectionChips`, `AdminCatalogBooleanChips`,
  `AdminCatalogFormActions` : formulaires.
- `AdminCatalogDisclosure` : bloc replié par défaut utilisé pour les formats
  liés. Son header reste visible avec le titre, la description et le compteur.

## Regles

- Les pages `sessions`, `niveaux`, `formats`, `series`, `repetitions`,
  `repos` et `equipements` utilisent ce socle pour converger vers la structure
  de `/admin/catalogue/intervalles`.
- Les variantes metier restent limitees aux champs, badges et contraintes de
  chaque page.
- La page `exercices` reste hors perimetre de cette tranche.
- Le socle est extrait de l'existant, pas reconcu.
- Les actions de mutation restent locales/dev via SQLite.
- La modale format associe une série, une répétition ou un intervalle, puis un
  repos. Elle n'expose aucune durée numérique dérivée.
- La modale intervalle expose uniquement le libellé et la durée d'effort. Un
  intervalle n'a pas de type.
- La modale répétition permet de choisir entre une valeur numérique et
  `Maximum`. La valeur numérique est masquée lorsque `Maximum` est actif.
- La modale session expose seulement titre, description, pilier, famille,
  exercice, niveaux et statut. Pilier et famille filtrent les exercices sans
  être persistés sur la session.

## Pages couvertes

- `/admin/catalogue/niveaux`
- `/admin/catalogue/sessions`
- `/admin/catalogue/formats`
- `/admin/catalogue/series`
- `/admin/catalogue/repetitions`
- `/admin/catalogue/intervalles`
- `/admin/catalogue/repos`
- `/admin/catalogue/equipements`
