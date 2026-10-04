# Gym de mécaniques — v0.4

Ouvrir `/mechanics-gym.html`. Navigation croisée avec le gym de cartes.

Un parcours mobile de vote secret, attente simulée, votes dévoilés un joueur à la fois, réponse, points par joueur et classement. L’atelier propose 2 à 6 joueurs, choix A–E ou estimation des sucres, ordre de passage, tempo de 600 à 2 500 ms et mode manuel. Les autres joueurs sont toujours signalés comme simulés. Les sons sont optionnels, désactivés au départ.

Le gym utilise le snapshot Open Food Facts et les photos locales existantes. Les réponses sont celles de ce snapshot, sans requête réseau à OFF pendant une partie. Aucun multijoueur ni stockage serveur. Les points sont cumulés pendant la session ; appliquer les réglages remet la partie à zéro. Un replay conserve les mêmes votes et ne cumule pas une seconde fois les points.

## Vérifications

Chromium headless : parcours complet manuel et automatique ; 2, 4 et 6 joueurs ; ordre « moi en dernier » ; estimation numérique et bornes 0–100 ; pause/reprise ; fermeture de l’atelier avant le vote ; changement de réglages annulant les timers ; replay sans double comptage ; manche suivante ; absence d’exception JavaScript. Captures inspectées à 390 px et 1 440 px, absence de débordement à 320 px et 390 px. Préférence de mouvement réduit respectée.

Le tool WebMCP `advance_mechanics_reveal` réutilise l’action visible « Suivant ». Enregistrement, entrée valide, erreurs attendues et lecture de l’état vérifiés avec un contexte simulé ; validation dans un navigateur WebMCP natif indisponible.
