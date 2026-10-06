# NutriDeck gyms

Existing card and mechanics gyms are preserved. `multiplayer.html` is the real online Nutri-Score gym (1–8 players, including solo testing).

## Source and build

- `public/`: the three gyms and the shared card renderer.
- `worker/index.js`: server-authoritative room API, Open Food Facts draw, masking and scoring.
- `db/schema.ts`, `drizzle/`: D1 schema and generated migrations.
- `npm ci && npm run build`: emits a Cloudflare Worker with embedded static assets. No browser-held database keys.
- `node tests/server.test.mjs`: SQLite-backed API tests, after build.

Rooms use random invitation IDs; a random device token identifies each player and is hashed server-side. Sharing the invitation never shares a player credential. Room state is durable in D1; local storage retains only the device credential and UI preferences. Closing a tab or opening Messenger does not delete a room. To resume the same player, use the same browser; a different browser creates a separate profile. There is no disconnect penalty and no automatic removal on `pagehide`/`unload`. Automatic server deadlines keep the sequence advancing without depending on the host’s browser.

Votes can change until every member has voted or the first-vote deadline expires. Server timestamps drive the countdown/reveal. Optimistic version checks serialize simultaneous joins and votes. Answers and other players' votes are removed from API responses during voting. Scoring occurs atomically once per round. Future products never leave the server. The existing nutrition table remains visible. Host can skip a broken photo with a confirmation (zero points).

The draw calls the Open Food Facts search API with a random page, filters records with photos, a valid Nutri-Score and usable nutrition, then shuffles without repetition within the game. This is a random sample of eligible search results, **not** a uniform sample of the entire OFF database. Search-a-licious is the primary search service, with the legacy API as fallback; product detail reads hydrate incomplete records. Requests have timeouts and a one-hour page cache. Photos are checked before play; HEAD rejection is retried with GET. If OFF is unavailable, the lobby remains intact and the host can retry. No fabricated or bundled products are silently substituted in multiplayer.

Sources: https://openfoodfacts.github.io/openfoodfacts-server/api/ and https://openfoodfacts.github.io/search-a-licious/users/ref-openapi/ . Data: Open Food Facts ODbL; photos CC BY-SA. OFF is collaborative and some fields can be missing.

## v0.7 — countries, phase gates and final board

Country means **declared country of sale** (`countries_tags`), not origin or exclusive availability. The draw validates the selected country on every candidate, including cache and hydrated product records; it never silently falls back to another country. Default is Canada. Up to 20 Nutri-Score products, then 0–5 NOVA and 0–5 Eco-Score products, with no repeated barcode across phases. Missing scores are excluded. A matching allocation selects enough valid products for each requested phase.

Each included category begins with a short introduction. Introductions and post-answer results share a server-backed ready gate: advance when every member is ready or when the configurable 15/30/45/60/90-second deadline expires. Requests include game and step IDs to reject stale retries. Ready controls remain fixed in the mobile viewport. The final board has no timer. An immutable final snapshot remains visible to other players while the host prepares the next lobby; starting a new game moves everyone into its first introduction. Explicit leaving removes the player from the next game, without deleting the previous ranking. Closing the browser still preserves their place.

Product explanations use OFF's version-matched Nutri-Score components, NOVA classification/markers, or Eco-Score adjustments where available. Without a verified breakdown, display factual reference values and disclose that the full reason is not supplied. No score is recomputed or invented. Explanation data and score breakdown fields are omitted from voting payloads. Introductions and explanatory sources use the official OFF API schema and documentation.

Three statistical awards: longest exact-answer streak, most exact answers, largest relative error on the phase scale. Skipped products award no points and do not break streaks. Missed votes break a streak but do not win a largest-error award. Ties remain ties. Statistics and historical answers are persisted in the room. Existing v0.6 finished rooms retain their scores but report missing detailed statistics honestly.

Reveal sequences are planned once on the server and shared by all clients: direct slowdown, backward return, or hesitation, without repeating the same style consecutively. The last scheduled value always equals the actual answer. Client sequence indices never move backward due to network timing; intentional reverse steps are part of the plan.

## v0.8 — per-question category wheel

New games default to seven questions (configurable 1–30). Each category is independently sampled on the server from exactly 100 slots: 0–84 Nutri-Score, 85–94 Eco-Score, 95–99 NOVA. Crypto sampling uses rejection to avoid modulo bias. This is a probability per question, not a guaranteed composition per game. Categories and product assignments persist with the room; clients never reroll on reconnect. If OFF lacks eligible verified products, fewer questions may be available; the introduction reports the reduced total. Existing old-format games retain their original sequence until the next game.

Sequence: category wheel (4.2 s), short category card (2.6 s), voting, existing answer roll, full-screen answer with earned points and up to three evidence stickers, animated standings (2.6 s), next wheel. The last question follows the same result pause before the untimed final board. The ready countdown begins at the answer landing timestamp, alongside the stickers. No fixed explanation delay is added. Ready can shorten the pause after the first 3.2 s (or the configured timeout if shorter); all players must be ready. Disabling Ready makes progression timer-only and the server rejects readiness calls. Vote and result durations accept whole seconds from 1 to 3600. The vote timer still starts with the first vote.

The wheel has 100 rendered sectors, chasing lights and time-synchronized easing. Reduced-motion mode removes rotation and entrance animations. Stickers use a fixed overlay and absolute positioning, so they never reflow the product or player list. Only supported facts appear; no filler is added to reach three. General missing-data disclaimers are not presented as evidence stickers. Trophies remain exclusive to the final board.

Validation: SQLite API suite covers the exact category boundaries, seven questions through final, new and legacy sequences, timer-only and all-ready progression, flexible timers, stale requests, country filtering, real-image checks and durable room state. Mobile browser checks cover two independent players at 320/390 px, wheel reconnect, card flip, fixed result layout, and timer-only at 320×640 with reduced motion.
