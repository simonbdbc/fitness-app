# Rôles et profils utilisateur

## Source d'autorisation

Supabase Auth authentifie l'utilisateur et lui attribue le rôle PostgreSQL
`authenticated`. Ce rôle technique signifie uniquement que la session est
valide.

Le rôle applicatif est stocké dans `public.user_profiles.account_type`. Les
valeurs autorisées sont `basic`, `premium` et `admin`. Ni SQLite, ni
`user_metadata`, ni le frontend ne sont une source d'autorisation.

## Définitions

| Rôle | Libellé | Accès standard | Capacité premium | Administration catalogue |
|---|---|---:|---:|---:|
| `basic` | Basic | Oui | Non | Non |
| `premium` | Premium | Oui | Oui | Non |
| `admin` | Administrateur | Oui | Oui | Oui |

Dans cette tranche, la capacité premium ne bloque aucune fonctionnalité
existante. Elle est exposée par `canAccessPremiumFeatures` pour les futurs
services premium.

Le rôle `admin` hérite des capacités premium. Il expose le menu catalogue et
autorise les mutations sur équipements, repos, séries, répétitions,
intervalles, formats, templates de session et niveaux de template.

La page Exercices reste hors périmètre des mutations Supabase et SQLite. Les
fiches sont modifiées dans la bibliothèque V2 canonique puis régénérées ;
l'interface les expose en lecture seule.

## Structure `user_profiles`

- `id` : UUID identique à la clé primaire `auth.users.id` ; suppression en
  cascade avec le compte Auth.
- `email` : copie synchronisée depuis Supabase Auth.
- `display_name` : nom affichable modifiable par le propriétaire du profil.
- `account_type` : rôle applicatif, `basic` par défaut.
- `created_at`, `updated_at` : dates techniques.

Le trigger Auth crée automatiquement un profil `basic` et synchronise l'email.
Une indisponibilité de `user_profiles` conserve la session mais force les
capacités `basic`; les accès premium et admin échouent donc de manière fermée.

## Attribution des rôles

Un utilisateur ne peut jamais modifier `account_type` depuis le client. Une
promotion est réalisée par SQL avec un accès propriétaire ou service role :

```sql
select id, email, account_type
from public.user_profiles
where email = 'utilisateur@example.com';

update public.user_profiles
set account_type = 'premium'
where id = '<uuid-validé>';
```

Utiliser `admin`, `premium` ou `basic` selon la décision validée. L'utilisateur
doit ensuite rafraîchir sa session ou se reconnecter pour que le frontend
recharge son profil.

## Comptes Supabase locaux

Ces comptes sont créés uniquement par `supabase db reset` local :

| Rôle | Email | Mot de passe |
|---|---|---|
| Basic | `basic@example.test` | `demo-session` |
| Premium | `premium@example.test` | `premium-session` |
| Administrateur | `admin@example.test` | `admin-session` |

Le provider de démonstration utilisé lorsque Supabase n'est pas configuré reste
`basic` et ne donne jamais accès au menu admin.

## Persistance catalogue

- Local/dev : les mutations admin ciblées écrivent dans SQLite.
- Hors runtime local : les mêmes mutations écrivent dans Supabase sous RLS,
  puis le snapshot distant remplace le cache SQLite.
- Offline : aucune mutation distante n'est mise en attente.
- Template de session : l'enregistrement du template et le remplacement de ses
  niveaux passent par une RPC transactionnelle.

## Vérification

`pnpm auth:roles:check` refuse une URL Supabase distante et vérifie les trois
rôles, l'impossibilité d'auto-promotion, les policies catalogue et l'atomicité
de la RPC sur l'instance locale.
