# NutriDeck gyms

Existing card and mechanics gyms are preserved. `multiplayer.html` is the real online Nutri-Score gym (2–8 players).

## Source and build

- `public/`: the three gyms and the shared card renderer.
- `worker/index.js`: server-authoritative room API, Open Food Facts draw, masking and scoring.
- `db/schema.ts`, `drizzle/`: D1 schema and generated migrations.
- `npm ci && npm run build`: emits a Cloudflare Worker with embedded static assets. No browser-held database keys.
- `node tests/server.test.mjs`: SQLite-backed API tests, after build.

Rooms use random invitation IDs; a random device token identifies each player and is hashed server-side. Sharing the invitation never shares a player credential. Room state is durable in D1; local storage retains only the device credential and UI preferences. Closing a tab or opening Messenger does not delete a room. To resume the same player, use the same browser; a different browser creates a separate profile. There is no disconnect penalty and no automatic removal on `pagehide`/`unload`. An absent host can return to move to the next round.

Votes can change until every member has voted or the first-vote deadline expires. Server timestamps drive the countdown/reveal. Optimistic version checks serialize simultaneous joins and votes. Answers and other players' votes are removed from API responses during voting. Scoring occurs atomically once per round. Future products never leave the server. The existing nutrition table remains visible. Host can skip a broken photo with a confirmation (zero points).

The draw calls the Open Food Facts search API with a random page, filters records with photos, a valid Nutri-Score and usable nutrition, then shuffles without repetition within the game. This is a random sample of eligible search results, **not** a uniform sample of the entire OFF database. Search-a-licious is used if the main search API is unavailable; product detail reads hydrate incomplete records. Requests have timeouts, a shared search throttle and a one-hour page cache. If OFF is unavailable, the lobby remains intact and the host can retry. No fabricated or bundled products are silently substituted in multiplayer.

Sources: https://openfoodfacts.github.io/openfoodfacts-server/api/ and https://openfoodfacts.github.io/search-a-licious/users/ref-openapi/ . Data: Open Food Facts ODbL; photos CC BY-SA. OFF is collaborative and some fields can be missing.
