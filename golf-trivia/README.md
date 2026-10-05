# Golf Trivia

Music trivia for 2–3 teams. Teams hear a hidden song in growing clips and name it; the team with the **lowest total YouTube views** wins.

**Status: Phase 1.** All screens, the scoring logic and the hidden player work. The songs are made-up test songs and every one plays the same sample video. The Supabase / YouTube-API song pipeline is Phase 2.

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

## Layout

- `src/scoring.ts`, `src/winner.ts`, `src/format.ts`: pure logic (`calculateGuessScore`, `determineWinner`, `formatViews`).
- `src/store.ts`: Zustand store, including `handleGuess(teamId, isCorrect, songExactViews)`.
- `src/player/`: the hidden YouTube player (and the simulated one).
- `src/data/songSource.ts`: the single place songs come from. Phase 2 swaps this for the Supabase loader.

## Checks

```sh
npm test         # unit tests
npm run build    # type-check + production build
```
