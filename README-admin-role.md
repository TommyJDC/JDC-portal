# Configuration du rôle Admin pour Tommy VILMEN

Ce document explique comment configurer l'utilisateur Tommy VILMEN (ID: 105906689661054220398) avec le rôle Admin dans l'application JDC-portal.

## Contexte

Nous avons rencontré des problèmes lors de la tentative de modification du rôle de l'utilisateur en raison de l'erreur suivante:
```
TypeError: Cannot assign to read only property '0' of object '[object Array]'
```

Pour résoudre ce problème, plusieurs approches sont disponibles:

## Solution 1: Interface Web

L'interface web est la solution la plus simple et la plus fiable. Vous pouvez accéder à la route `/admin-set-role` dans l'application pour modifier le rôle de l'utilisateur.

1. Lancez l'application avec `npm run dev`
2. Accédez à `http://localhost:5173/admin-set-role`
3. L'ID de Tommy VILMEN (105906689661054220398) est prérempli
4. Sélectionnez "Admin" dans la liste déroulante des rôles
5. Cliquez sur "Modifier le rôle"

## Solution 2: Scripts de modification de rôle

Nous avons créé plusieurs scripts pour modifier le rôle de l'utilisateur:

### Script 1: reset-user-role.mjs

Ce script vérifie si l'utilisateur existe déjà dans la blockchain, et si oui, réinitialise son profil avec le rôle Admin. S'il n'existe pas, il crée un nouveau profil avec le rôle Admin.

```bash
node scripts/reset-user-role.mjs
```

### Script 2: deploy-custom-usernet.mjs

Ce script redéploie le contrat UserNet et crée un script supplémentaire pour configurer automatiquement le rôle Admin pour l'utilisateur.

```bash
node scripts/deploy-custom-usernet.mjs
node scripts/auto-set-admin.mjs  # Script généré automatiquement
```

### Script 3: test-admin-set-role.mjs

Ce script teste si la route admin-set-role fonctionne correctement en envoyant une requête HTTP simulée.

```bash
node scripts/test-admin-set-role.mjs
```

## Ordre recommandé pour l'exécution

1. D'abord, essayez d'utiliser l'interface web (`/admin-set-role`)
2. Si l'interface web ne fonctionne pas, exécutez `reset-user-role.mjs`
3. Si le script reset-user-role échoue, redéployez le contrat avec `deploy-custom-usernet.mjs`, puis exécutez `auto-set-admin.mjs`

## Notes importantes

- Le problème principal est lié à la façon dont les tableaux sont traités lors de l'appel au contrat blockchain, causant l'erreur "Cannot assign to read only property"
- Les scripts utilisent des techniques pour créer des copies profondes des tableaux afin d'éviter ce problème
- Avant d'utiliser les scripts, assurez-vous d'avoir un solde ETH suffisant dans le wallet qui effectuera les transactions

## Dépannage

Si vous rencontrez des erreurs:

1. Vérifiez que le nœud blockchain local est en cours d'exécution
2. Vérifiez que le wallet utilisé a suffisamment d'ETH pour effectuer les transactions
3. Consultez les logs des erreurs pour plus de détails

Après avoir modifié le rôle, vous pouvez vérifier que le changement a bien été appliqué en vous connectant à l'application et en vérifiant le profil de l'utilisateur.

## Résumé de l'opération effectuée

Nous avons réussi à configurer le rôle Admin pour l'utilisateur Tommy VILMEN en suivant ces étapes:

1. Nous avons créé un script `deploy-custom-usernet.mjs` qui a redéployé le contrat UserNet à l'adresse `0x055e43d8ece31B468cEaac6da8619E34F11D48A0`
2. Ce script a généré automatiquement un autre script `auto-set-admin.mjs` pour configurer l'utilisateur
3. Nous avons exécuté `auto-set-admin.mjs` qui a créé un profil avec le rôle Admin pour l'utilisateur Tommy VILMEN
4. Nous avons vérifié avec `test-admin-set-role.mjs` que l'utilisateur a bien le rôle Admin (0)

Les résultats montrent que:

```
Profil créé - Email: tommy.vilmen@jdc.fr, Rôle: 0
✅ SUCCÈS: L'utilisateur 105906689661054220398 est maintenant Admin!
```

Et la vérification ultérieure confirme:

```
Rôle actuel: Admin (0)
```

Cette opération a résolu le problème d'attribution du rôle Admin en contournant l'erreur "Cannot assign to read only property" grâce à une approche qui crée directement le profil avec le rôle Admin plutôt que de modifier un profil existant.

Pour la suite, l'utilisateur devrait pouvoir se connecter à l'application avec des droits d'administrateur et effectuer toutes les opérations réservées aux administrateurs. 