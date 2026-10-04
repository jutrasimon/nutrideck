# Gym de mécaniques — v0.5.0

Route `/mechanics-gym.html`, reliée au gym de cartes.

## Parcours

1. Un clic sur une lettre ou un changement de valeur soumet le vote. Il reste modifiable tant que la manche est ouverte.
2. Le premier vote (humain ou simulé) lance le compte à rebours. Durée réglable : 8, 12 ou 20 secondes. Le dernier vote verrouille immédiatement la manche ; l’expiration verrouille aussi. Une absence de vote donne 0 point, sans réponse inventée.
3. Tous les votes apparaissent dans la liste des joueurs.
4. « Et la réponse était… » : les choix défilent et ralentissent (roulement de percussion si le son est activé), puis la bonne réponse apparaît avec un pulse.
5. Les bonnes réponses sont signalées en vert dans la liste ; les points défilent auprès de chaque joueur.
6. La liste se réorganise selon le total. Aucun écran de points individuel ou de classement séparé.

Sur mobile, la liste passe au-dessus de la réponse pendant le reveal. Le replay garde les votes et les totaux, sans doubler les points. Les joueurs autres que « Toi » sont explicitement simulés. Aucune partie en ligne.

## Carte partagée

Les deux gyms appellent le même `makeCard` dans `card-gym.js` et utilisent `card-component.css`. Le chargement `data-renderer-only` n’initialise pas l’atelier de cartes. La carte du vote mesure 240 px, reste droite, tourne dans les deux sens et partage les favoris locaux avec le gym de cartes. Les valeurs et scores sont masqués dans le modèle fourni au renderer avant le reveal (y compris la couleur Nutri et le lien externe de la fiche). Ingrédients et allergènes restent consultables. La carte est dévoilée à l’arrêt du roulement.

`title-fit.js` cherche la plus grande taille possible parmi les coupures entre mots sur deux lignes ; le nom complet est conservé. Les explications proviennent de `SCORE_INFO` et `NUT_INFO` dans le projet existant (`games.js`).

## Couleurs vérifiées

Les couleurs NOVA proviennent des SVG Open Food Facts : 1 `#00aa00`, 2 `#ffcc00`, 3 `#ff6600`, 4 `#ff0000`.
Les couleurs Éco A–E sont `#1e8f4e`, `#2ecc71`, `#f5c100`, `#ef7e1a`, `#de4523`. Une donnée inconnue reste neutre.
Sources consultées : https://github.com/openfoodfacts/openfoodfacts-server/tree/main/html/images/attributes/src (`nova-group-1.svg` à `nova-group-4.svg`, `ecoscore-a.svg` à `ecoscore-e.svg`). Ce sont les couleurs des visuels OFF, pas une affirmation de standard universel pour NOVA.

## Vérifications

Chromium : flip recto/verso au clic, favori partagé, explication, carte 240 px, réponse masquée avant reveal ; vote modifiable, premier vote humain ou bot lançant le chrono, verrouillage au dernier vote, expiration sans réponse donnant 0 ; roue, pause/reprise, arrêt exact, points dans la liste, classement et replay sans double points. Tests A–E et sucres, 4 et 6 joueurs, bornes numériques, largeur 320 px sans débordement. Captures inspectées mobile et desktop ; nom long complet sur deux lignes. Les mouvements réduits sont pris en compte.

WebMCP `skip_mechanics_reveal` : enregistrement, entrée valide/invalide et lecture de l’état testés avec un registre simulé. Contexte WebMCP natif indisponible.
