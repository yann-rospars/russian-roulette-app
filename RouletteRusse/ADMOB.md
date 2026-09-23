# AdMob — Expo 57, iOS et Android

Le projet conserve Expo 57 / React Native 0.86. `react-native-google-mobile-ads` 17.1 fournit AdMob et Google UMP ; `expo-dev-client` prépare le client natif. `expo-asset`, requis par `expo-audio`, est déclaré directement pour les builds natifs. Aucun changement dans les composants du pistolet, les rotations, les animations, la logique du jeu ou les fichiers audio.

## Publicités

- Une bannière adaptative, dans une zone dédiée sous le contenu défilant et à l’intérieur de la safe area, sur Home, configuration et rotation. Les dimensions du pistolet et du barillet restent identiques. Sur les petits écrans, le contenu reste défilable.
- Aucune bannière en `playing` ou `result`. Le composant est démonté dès COMMENCER ; pas simplement masqué.
- Chaque passage à `result` compte une partie terminée, une seule fois. Le compteur reste en mémoire pour la session de cet écran, y compris en passant par Home ; il repart à zéro au redémarrage de l’application. Abandonner une partie ne compte pas.
- Aux parties 3, 6, 9, etc., RECOMMENCER ferme d’abord la popup native, puis affiche l’interstitielle uniquement si elle est déjà chargée et si l’app est au premier plan. Le retour au barillet attend sa fermeture. Home ne déclenche jamais d’interstitielle.
- Si la pub manque, l’occasion est ignorée sans attendre son chargement et sans la reporter à la partie suivante. Préchargement après consentement, après fermeture et nouvelles tentatives avec temporisation en cas d’erreur. Les annonces expirées sont renouvelées. Une erreur de présentation rend la main au jeu.
- Fréquence : `INTERSTITIAL_EVERY_N_GAMES` dans `src/constants/ads.ts`.
- Web et Expo Go continuent sans publicité. Tester réellement AdMob exige le Development Build.

## TEST et production

Les App IDs dans `app.json` identifient les deux applications AdMob, y compris pour charger les messages UMP configurés dans ton compte. Ils sont distincts des Ad Unit IDs qui servent les annonces.

`TestIds.ADAPTIVE_BANNER` et `TestIds.INTERSTITIAL` de la bibliothèque fournissent les IDs officiels Google correspondant à iOS ou Android. Ils sont utilisés si `__DEV__` est vrai **ou** si le projet n’est pas explicitement configuré pour les pubs de production. Un export local ou un build `preview` utilise donc également les annonces de test.

Les vrais Ad Unit IDs ne sont sélectionnés que si les trois conditions sont réunies : bundle hors développement, `EAS_BUILD_PROFILE=production` et `ADMOB_PRODUCTION_ADS=true`. Le profil `production` est préparé dans `eas.json`, mais aucun build de production ni publication n’a été lancé. Les IDs sont centralisés dans `src/constants/ads.ts`.

## Consentement à configurer dans AdMob

Dans **AdMob → Confidentialité et messages**, créer/configurer le message « Réglementations européennes » pour **les deux applications**, avec l’URL de ta politique de confidentialité, puis rendre le message disponible. Pour iOS, configurer aussi le message IDFA/ATT si tu souhaites demander le suivi. Le SDK UMP se charge alors du formulaire officiel et de l’alerte ATT ; la description iOS est déjà déclarée. Cette configuration du compte AdMob ne peut pas être réalisée par le code de l’application.

À chaque lancement, UMP actualise les informations. Si un formulaire est requis, il est demandé depuis Home ; une réponse réseau arrivée après avoir quitté Home est différée jusqu’au retour sur Home. Le jeu reste accessible si la connexion ou UMP échoue. Aucune annonce n’est demandée tant que `canRequestAds` ne le permet pas. La mesure automatique AdMob est différée par la configuration native.

Le lien **Confidentialité** apparaît sur Home lorsque UMP exige un accès aux options de confidentialité. Il ouvre le formulaire officiel pour modifier les choix. Les annonces en cache sont invalidées, et l’autorisation est relue avant de recharger des annonces. Le refus ne bloque pas le jeu.

Pour tester une géographie UMP sur un appareil physique, utiliser temporairement `testDeviceIdentifiers` et `debugGeography: AdsConsentDebugGeography.EEA` dans `requestInfoUpdate`, uniquement sous `__DEV__`. Google indique le hash de l’appareil dans les logs natifs. Ne pas réinitialiser systématiquement le consentement et ne pas conserver de géographie forcée en production.

Références : [Google UMP](https://developers.google.com/admob/ios/privacy), [UMP dans la bibliothèque](https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent), [annonces de test](https://docs.page/invertase/react-native-google-mobile-ads#test-ads).

## Tester sur l’iPhone depuis Windows / PowerShell

Le bundle identifier iOS et le package Android sont `com.yannb.rouletterusse`. Si tu as déjà réservé un autre identifiant Apple/Google pour cette application, remplace-les dans `app.json` avant le premier build.

Un compte Expo et un abonnement Apple Developer actif sont nécessaires pour cette installation iOS via EAS. Le build iOS est effectué sur les machines macOS d’EAS ; aucun Mac local n’est nécessaire.

Le dossier actuel est sous un dépôt Git situé dans le dossier utilisateur Windows. Pour limiter l’archive envoyée à **ce projet**, lancer les commandes depuis le dossier `RouletteRusse` avec `EAS_NO_VCS=1` et `EAS_PROJECT_ROOT` explicitement défini :

```powershell
$env:EAS_NO_VCS = "1"
$env:EAS_PROJECT_ROOT = (Get-Location).Path
npx eas-cli@latest login
npx eas-cli@latest build --platform ios --profile development
```

Au premier lancement, EAS propose de créer/lier le projet et de configurer la signature Apple. Si EAS indique que `extra.eas.projectId` ne peut pas être écrit dans la configuration dynamique, ajouter l’UUID qu’il fournit à `expo.extra.eas.projectId` dans `app.json`, puis relancer la commande. `app.config.js` conserve ce champ. Ne pas inventer cet UUID.

Pour enregistrer l’iPhone si nécessaire : `npx eas-cli@latest device:create`, ouvrir le lien sur l’iPhone et suivre l’enregistrement avant de relancer le build. Sélectionner cet iPhone pour le profil de provisioning.

Installer le Development Build depuis le lien/QR EAS sur l’iPhone, activer le mode développeur iOS si demandé, puis démarrer Metro sur le PC :

```powershell
npx expo start --dev-client
```

PC et iPhone doivent pouvoir communiquer sur le réseau local. Si nécessaire, utiliser `npx expo start --dev-client --tunnel`. Ouvrir le QR dans le Development Build, et non Expo Go. Pour Android, le même profil fonctionne avec `--platform android`.

Références : [Expo DevClient 57](https://docs.expo.dev/versions/v57.0.0/sdk/dev-client/), [build EAS](https://docs.expo.dev/build/setup/), [distribution interne et enregistrement iOS](https://docs.expo.dev/build/internal-distribution/).

## Vérification sur appareil

Les contrôles locaux ne remplacent pas l’exécution du SDK natif sur un téléphone.

1. Vérifier l’indication « Test Ad » sur chaque écran prévu et l’accès à tous les boutons/chambres, y compris sur un petit écran.
2. COMMENCER : aucune bannière ; terminer les parties 1 et 2, puis vérifier l’interstitielle après RECOMMENCER à la partie 3 et le retour au barillet après fermeture. Refaire jusqu’à 6.
3. Répéter sans Internet : le jeu reste jouable et RECOMMENCER retourne au barillet sans attendre une publicité.
4. Tester le refus, l’acceptation et la modification du consentement depuis Confidentialité, puis le retour au premier plan.
5. Vérifier les mêmes scénarios dans le build Android avant diffusion.

Contrôles locaux : `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`. Les tests AdMob couvrent les garde-fous TEST/production, la fréquence, le double comptage, le chargement tardif, la fermeture, les erreurs, l’expiration, le passage en arrière-plan et le nettoyage.
