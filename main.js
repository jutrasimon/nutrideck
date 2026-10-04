'use strict';
/* NutriDeck — démarrage */
applySettings();
$('#only-scored').checked = state.onlyScored !== false;
buildChips();
buildLab();
densityIcon();
updateBadge();
route();
if (!state.seeded && !allCodes().length) seedFirstRun();
