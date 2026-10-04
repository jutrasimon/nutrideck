# NutriDeck — analyse et gym de cartes v0.2.0

Analyse du code au commit initial 46971dfc73dece807350d178aa537e07bf24689a, le 4 octobre 2026.

## Ce que le projet contient

Application JavaScript sans framework ni compilation. `app.js` normalise les produits Open Food Facts, rend les cartes et gère zones, piles et déplacement. `settings.js` expose les thèmes et variables CSS. `games.js` propose Tier List Battle, Rangez-vous, Devine le score et Le juste prix. `online.js` utilise le relais WebSocket de `server.js`. Le serveur Node sert aussi les fichiers autorisés et relaie les recherches OFF avec cache mémoire de dix minutes. Les collections et réglages sont locaux au navigateur.

## Points solides

- Le renderer `cardEl` est partagé entre collection, table et jeux.
- La normalisation isole déjà les données brutes de leur présentation.
- Les zones, piles et retournements constituent une base réutilisable.
- Plusieurs propriétés visuelles sont paramétrées plutôt que dispersées dans le code.

## Les problèmes de cartes

1. Largeur initiale 140 px, plusieurs scores et titre sur deux lignes : concurrence forte pour peu de surface. Augmenter la taille ne résout pas la hiérarchie.
2. La marque appartient à `card-inner`, hors des faces : son placement et sa transformation sont moins prévisibles qu'un élément intégré au recto.
3. Photo, titre, scores et données détaillées partagent une composition unique. L'atelier change surtout les variables, pas cette composition.
4. Le verso combine sept valeurs, scores, ingrédients et additifs. Les règles de conteneur cachent certaines informations selon la taille : la promesse de contenu varie.
5. Le remplacement d'une photo par une boîte de conserve ne distingue pas clairement une donnée absente.
6. Les couleurs liées aux scores doivent rester absentes de tous les états de devinette. Le renderer initial neutralise déjà `--g` avec `hide`; c'est une propriété à conserver.
7. Les styles globaux sont volumineux et les sélecteurs génériques (`.info`, `.brand`, `.back`) rendent une refonte plus risquée.

## Proposition construite

`card-gym.html`, `card-gym.css`, `card-gym.js` : atelier autonome accessible depuis l'en-tête et l'atelier existant. Trois compositions : Éditorial (hiérarchie sobre), Arène (cadre et contraste), Studio (titre typographique et pied coloré).

- Édition grand format et aperçu à la taille de jeu sur grand écran.
- Comparaison des trois compositions avec le même produit; instantané épinglé en mémoire pour comparer une variante.
- Main de cinq cartes et grille de table; sélection souris, clavier et tactile.
- Recto, verso, dos mystère identique pour chaque produit; aucune identité ni couleur de score sur le dos.
- Format, angles, typographie, zoom de photo, ombre, trois couleurs et champs recto réglables.
- Statistique principale au choix, valeurs absentes représentées par un tiret.
- Tests noms longs, photo absente et données absentes.
- Persistance locale, import JSON validé, export du style.
- Contraste papier/encre calculé et taille indicative des petits libellés en jeu. Ce diagnostic n'est pas une certification complète d'accessibilité : photos, accents et badges ont leurs propres contrastes.
- Trois produits OFF avec images stockées localement; un exemple hérité explicitement identifié comme démonstration. Les produits de la collection locale apparaissent si le gym et le jeu partagent la même origine.

## Intégration et limites

Le gym ne remplace pas encore `cardEl` et ne change pas les parties. `window.NutriCardGym.makeCard` constitue le renderer exploratoire; les styles exportés ne sont pas ceux de l'ancien atelier. Choisir et éprouver un style avant de brancher la production, puis conserver les options `hide`, `mini`, `focus` et les événements des piles/boards lors de l'adaptation.

Les données OFF sont un instantané, pas une validation nutritionnelle. Images sous CC BY-SA et base OFF sous ODbL; attribution visible dans le gym. Le format poker est un ratio d'écran, pas une promesse d'impression à l'échelle physique. Le verso peut défiler pour conserver les ingrédients longs. Les paramètres restent sur l'appareil; exporter le JSON pour les transférer. Le gym autonome hébergé séparément n'a pas accès à la collection stockée sur une autre origine.

## Prochaines décisions de design

Évaluer d'abord une carte à 190 px dans une main. Vérifier la distinction entre identité, valeur principale et scores secondaires. Choisir ensuite la direction et le nombre de valeurs visibles avant de remplacer les cartes dans les quatre jeux.
