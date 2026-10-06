# Golf Trivia

Music trivia for 2–3 teams. Teams hear a hidden song in growing clips and name it; the team with the **lowest total YouTube views** wins.

Without any setup the game runs on 30 made-up **test songs** that all play one sample video. With Supabase configured (see "Real songs" below) it plays your sheet's songs instead.

## Run it on your Mac

Needs Node 18 or newer.

```sh
cd golf-trivia
npm install
npm run dev
```

Open the URL it prints (http://localhost:5173) in Chrome or Safari. Don't open `index.html` straight from the file system: YouTube only plays embeds from an http origin.

- **Audio:** the first clip needs a click on the page (browser autoplay rule). Pressing a listen button counts.
- **No sound / offline:** open `http://localhost:5173/?player=sim` for a silent simulated player with the same clip timing.
- **Different test video:** change `SAMPLE_VIDEO_ID` in `src/config.ts`.

## Rules (all tunable in `src/config.ts`)

| | |
|---|---|
| Correct guess | `views + round(views × (listen% + 15% × wrong guesses before))`, capped at 10B |
| Listen surcharge | longest clip played on the song: 1 s = 0%, 2 s = 2%, 4 s = 4%, 8 s = 8%, 16 s = 16% |
| Wrong guess | +15% on the song's views (3 guesses per song) |
| 3 wrong guesses, or 90 s timer | +10,000,000,000 |

The host judges each guess with the ✓ Correct / ✗ Wrong buttons.

## Real songs (Supabase + YouTube), Rock & Metal first, then Pop

The sheet only has YouTube *search* links, which can't be embedded, so each song needs a video found for it. Three steps, all run from the `golf-trivia` folder:

**1. Create the table.** Supabase → SQL Editor → paste `scripts/schema.sql` → Run. (Safe to re-run; it keeps rows you already have.)

**2. Fill in `.env`.** `cp .env.example .env`, then add your Supabase URL and keys and your YouTube API key (the file explains where each one comes from).

**3. Import the songs.** In Google Sheets: File → Download → Microsoft Excel (.xlsx), and save it as `songs.xlsx` here.

```sh
node scripts/import-sheet.mjs songs.xlsx            # dry run: prints a report, writes nothing
node scripts/import-sheet.mjs songs.xlsx --upload   # writes the Rock_Metal then Pop songs to Supabase
```

Read the dry-run report first. It lists songs it skipped (any song at or above 10,000,000,000 views is rejected), duplicates it dropped, and levels whose view ranges overlap (a sign a level is mislabelled in the sheet; reported, never changed). Use `--only=Rock_Metal,Pop,Hip_Hop_Rap` or `--all` for more categories.

**4. Find a video for each song.**

```sh
node scripts/fill-embed-urls.mjs --limit=95
```

Rock & Metal songs are searched first, then Pop. Inside a genre it takes one song from each Foreign / Israeli × Level 1–5 group in turn, so even after the first day you have songs at every level, not just Level 1. YouTube's free quota allows about **100 searches a day** (each search costs 100 of your 10,000 daily units), so run this once a day until it reports nothing left; it skips songs that already have a video and stops by itself if the quota runs out. `--category=Pop` limits it to one genre. Songs that got "no result" are retried on the next run.

Already know the right video for a song, or a match came out wrong? Paste `https://www.youtube.com/embed/<videoId>` into that row's `embed_url` in Supabase. The script never overwrites a filled row, and it costs no quota. Please don't create extra Google Cloud projects or keys to get more quota: that breaks YouTube's API terms.

**5. Play.** `npm run dev` (restart it after editing `.env`). Only songs that already have a video are playable; the setup screen lets you choose genres and Foreign / Israeli, and shows how many songs each level has.

If Supabase can't be reached, the game says so and falls back to the test songs.

## Layout

- `src/scoring.ts`, `src/winner.ts`, `src/format.ts`: pure logic (`calculateGuessScore`, `determineWinner`, `formatViews`).
- `src/store.ts`: Zustand store, including `handleGuess(teamId, isCorrect, songExactViews)`.
- `src/player/`: the hidden YouTube player (and the simulated one).
- `src/data/songSource.ts`: where songs come from (Supabase, or the test songs).
- `scripts/`: `schema.sql`, `import-sheet.mjs`, `fill-embed-urls.mjs`.

## Checks

```sh
npm test         # unit tests
npm run build    # type-check + production build
```
