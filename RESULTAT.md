# Résumé de l'opération

Nous avons réussi à attribuer le rôle Admin à l'utilisateur Tommy VILMEN (ID: 105906689661054220398) en redéployant le contrat UserNet et en créant un profil avec le rôle Admin par défaut.

## Étapes suivies

1. Création et déploiement d'un nouveau contrat UserNet à l'adresse 0x055e43d8ece31B468cEaac6da8619E34F11D48A0
2. Génération automatique et exécution du script auto-set-admin.mjs
3. Vérification que l'utilisateur a bien le rôle Admin (0)

## Résultat

Les résultats montrent que:

```
Profil créé - Email: tommy.vilmen@jdc.fr, Rôle: 0
✅ SUCCÈS: L'utilisateur 105906689661054220398 est maintenant Admin!
```

Et la vérification ultérieure confirme:

```
Rôle actuel: Admin (0)
```

## Conclusion

L'erreur 'Cannot assign to read only property' a été contournée en créant directement un profil avec le rôle Admin plutôt que de modifier un profil existant.

L'utilisateur peut maintenant se connecter à l'application avec des droits d'administrateur et effectuer toutes les opérations réservées aux administrateurs.

# Résolution du problème d'ID utilisateur manquant ou invalide

## Problème rencontré
L'erreur "Erreur de mise à jour: Utilisateur avec ID user_b9c0bea4_madvfdo1 non trouvé sur la blockchain" apparaît lors de la modification d'un utilisateur dans le panneau d'administration.

## Diagnostic
Après analyse, nous avons identifié que les ID utilisateurs étaient générés avec un timestamp (`user_b9c0bea4_madvfdo1`), ce qui créait des identifiants différents à chaque utilisation de la fonction de récupération des profils. Quand la mise à jour était tentée, la blockchain ne reconnaissait pas l'ID.

## Solution mise en place
1. **Génération stable des ID utilisateurs**:
   - Modification de la fonction `getAllUserProfilesFromBlockchain` pour utiliser un format stable: `user_[8 premiers caractères de l'adresse]`
   - Maintien d'une table de correspondance (cache) entre adresses blockchain et ID générés

2. **Amélioration du processus de mise à jour**:
   - Stockage et transmission de l'adresse blockchain complète lors des éditions d'utilisateur
   - Logique de fallback dans la fonction `updateUserProfile` qui essaie trois méthodes de récupération:
     - Utilisation de l'adresse blockchain fournie directement si disponible
     - Recherche dans la table de correspondance des IDs
     - Méthode standard `getUserAddressById` en dernier recours

3. **Validation renforcée**:
   - Affichage de l'adresse blockchain dans l'interface d'édition pour débogage
   - Validation et normalisation rigoureuse des ID utilisateurs
   - Messages d'erreur plus précis et explicites

4. **Script de correction**:
   - Création d'un script `fix-user-ids.mjs` qui parcourt tous les utilisateurs existants
   - Correction des ID incohérents pour les faire correspondre au nouveau format stable
   - Mise à jour de la blockchain pour garantir la cohérence des références

Ces modifications permettent maintenant de modifier les utilisateurs sans rencontrer l'erreur "ID utilisateur manquant ou invalide".

# Synchronisation avec UserNet - Récupération du Refresh Token

## Objectif
Nous avons modifié le système de synchronisation des installations pour récupérer le refresh token Google OAuth directement depuis le contrat UserNet plutôt que depuis les variables d'environnement.

## Modification principale
Le fichier `app/routes/api.sync-installations.ts` a été modifié pour :
1. Initialiser le contrat UserNet
2. Parcourir les utilisateurs à la recherche d'un utilisateur ayant un refresh token
3. Utiliser ce refresh token pour l'authentification Google Sheets

## Scripts utilitaires créés

### 1. Liste des utilisateurs
Le script `scripts/list-users.mjs` permet de lister tous les utilisateurs dans UserNet avec leurs détails.

```bash
node scripts/list-users.mjs
```

### 2. Test de recherche d'ID 
Le script `scripts/find-user-id.mjs` tente de trouver l'ID d'un utilisateur par son email.

```bash
node scripts/find-user-id.mjs
```

### 3. Mise à jour du refresh token
Le script `scripts/update-refresh-token.mjs` permet de mettre à jour le refresh token d'un utilisateur spécifique.

```bash
# Nécessite de connaître l'ID utilisateur et d'avoir GOOGLE_REFRESH_TOKEN dans .env
node scripts/update-refresh-token.mjs
```

### 4. Mise à jour de tous les refresh tokens
Le script `scripts/update-all-refresh-tokens.mjs` met à jour tous les utilisateurs avec le même refresh token.

```bash
# Nécessite d'avoir GOOGLE_REFRESH_TOKEN dans .env
node scripts/update-all-refresh-tokens.mjs
```

### 5. Test de synchronisation
Le script `scripts/test-direct-sync.mjs` permet de tester la synchronisation en utilisant le refresh token de UserNet.

```bash
node scripts/test-direct-sync.mjs
```

## Processus de mise en place

1. **Stockage du refresh token** : Le refresh token est stocké dans UserNet lors de l'authentification Google OAuth
   - Voir les logs de `auth.google.callback.ts` qui stockent le token

2. **Récupération du token** : Le système récupère le token en parcourant les utilisateurs dans UserNet
   - Priorité donnée aux utilisateurs avec `isGmailProcessor` à `true`
   - Sinon, utiliser le premier utilisateur ayant un refresh token

3. **Fallback** : Si aucun utilisateur n'a de refresh token, le système tente d'utiliser `GOOGLE_REFRESH_TOKEN` des variables d'environnement

## Important à savoir

- Le refresh token Google a une validité limitée. Si les utilisateurs se reconnectent à Google, un nouveau token est généré et l'ancien devient invalide.
- La propriété `isGmailProcessor` permet de désigner un utilisateur comme responsable des traitements Gmail/Google Sheets.
- Le statut `gmailAuthStatus` indique si les autorisations nécessaires pour Gmail ont été accordées.

## Dépannage

Si la synchronisation échoue :

1. Vérifier que le token est bien stocké dans UserNet avec `scripts/list-users.mjs`
2. Tester l'accès Google Sheets avec `scripts/test-sync-with-token.mjs`
3. Si nécessaire, mettre à jour le refresh token avec `scripts/update-all-refresh-tokens.mjs`
4. S'assurer que l'utilisateur a les autorisations nécessaires (scope) pour accéder aux Google Sheets 