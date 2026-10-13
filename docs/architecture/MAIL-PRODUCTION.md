# Messagerie de production ACREA

État opérationnel validé le 22 août 2026.

## Architecture active

```text
Internet
  -> MX acrea-fitness.fr : 10 mail.sbcenter.fr.
  -> 176.171.14.46 / Stalwart
  -> support@acrea-fitness.fr

Client Thunderbird
  -> Stalwart (Submission 587, STARTTLS)
  -> relais Brevo (SMTP 587, STARTTLS)
  -> Internet

Supabase Auth
  -> relais Brevo (SMTP 587, STARTTLS)
  -> ACREA Fitness <noreply@acrea-fitness.fr>
  -> destinataire
```

Stalwart est déployé sur `mail.sbcenter.fr` (`stalwartlabs/stalwart:v0.16.15`).
Les protocoles prévus sont SMTP 25, SMTPS 465, Submission 587 et IMAPS 993.
Les certificats TLS sont partagés avec Traefik.

## Comptes et rôles

| Adresse | Rôle |
|---|---|
| `support@acrea-fitness.fr` | Boîte Stalwart principale, nom affiché « Support ACREA Fitness ». |
| `noreply@acrea-fitness.fr` | Alias vers `support@` ; adresse d'expédition Brevo et Supabase Auth. |
| `postmaster@acrea-fitness.fr` | Alias de traitement local vers `support@`. |
| `dmarc@acrea-fitness.fr` | Alias de traitement local vers `support@`. |

La boîte OVH historique reste intacte : aucune suppression ni migration de son
historique ne fait partie de cette bascule.

## Routage et secrets

- Les destinataires locaux restent remis par Stalwart.
- Les messages externes soumis à Stalwart passent par le relais Brevo
  `smtp-relay.brevo.com:587` avec STARTTLS ; aucun e-mail sortant n'est remis
  directement depuis l'adresse IP de la Bbox.
- Brevo maintient l'expéditeur vérifié `ACREA Fitness
  <noreply@acrea-fitness.fr>`.
- Une clé SMTP Brevo est dédiée au relais Stalwart et une autre à Supabase
  Auth. Elles sont stockées dans leurs configurations protégées respectives et
  ne doivent jamais être ajoutées au dépôt, aux variables publiques ou à la
  documentation.
- Les enregistrements SPF, DKIM Brevo, DMARC et `brevo-code` existants ont été
  conservés pendant la bascule MX.

## DNS de réception

La configuration active est :

```dns
acrea-fitness.fr.  MX  10  mail.sbcenter.fr.
```

La résolution a été contrôlée le 22 août 2026 depuis les résolveurs Cloudflare
(`1.1.1.1`) et Google (`8.8.8.8`). Les anciens MX OVH, à restaurer uniquement
en cas de retour arrière de la réception, étaient :

```dns
acrea-fitness.fr.  MX  1    mx1.mail.ovh.net.
acrea-fitness.fr.  MX  5    mx2.mail.ovh.net.
acrea-fitness.fr.  MX  100  mx3.mail.ovh.net.
```

Le PTR de `176.171.14.46` reste un nom générique Bbox. Sa mise en cohérence avec
`mail.sbcenter.fr` est une amélioration à demander au fournisseur. Elle n'est
pas bloquante pour le flux actuel, car Brevo effectue les remises sortantes.

## Vérifications réalisées

Le 22 août 2026, les contrôles suivants ont été conclus :

1. Le serveur répond au dialogue SMTP entrant sur le port 25, avec EHLO et
   STARTTLS, sans relais ouvert.
2. La résolution MX publique retourne `mail.sbcenter.fr` depuis Cloudflare et
   Google.
3. Un message Auth de Supabase est arrivé dans `support@` via l'alias
   `noreply@`; le compte de test a ensuite été supprimé.
4. Un envoi depuis Thunderbird avec `support@` a été remis à une boîte externe
   via le relais Brevo.
5. L'expéditeur Brevo `ACREA Fitness <noreply@acrea-fitness.fr>` est vérifié.

## Exploitation et retour arrière

Après tout changement SMTP ou DNS, effectuer dans cet ordre :

1. Vérifier le MX avec au moins deux résolveurs publics.
2. Envoyer un e-mail externe vers `support@` et confirmer sa réception dans
   Stalwart ou Thunderbird.
3. Répondre depuis Thunderbird et contrôler la réception extérieure ainsi que
   les en-têtes d'authentification.
4. Déclencher un e-mail Auth Supabase vers une boîte externe ; vérifier le nom
   d'expéditeur et les liens de l'application, puis supprimer tout utilisateur
   de test.

Si la réception publique échoue après un changement de MX, restaurer
immédiatement les trois MX OVH ci-dessus avec leurs priorités d'origine. Le
relais Brevo sortant et la configuration SMTP Supabase sont indépendants de ce
retour arrière.
