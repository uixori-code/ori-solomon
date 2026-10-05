-- Golf Trivia: the songs table. Paste into Supabase -> SQL Editor -> Run. Safe to run more than once.
--
-- If you already created `songs_trivia` (for example by importing the sheet as CSV), this keeps your rows
-- and only adds what is missing. It will NOT touch your data except to fill exact_views from estimated_views.

create table if not exists public.songs_trivia (
  id               bigint generated always as identity primary key,
  category         text     not null,            -- Rock_Metal, Pop, ...
  region           text     not null,            -- Foreign / Israeli
  level            smallint not null check (level between 1 and 5),
  artist_and_song  text     not null,
  estimated_views  text,                         -- as written in the sheet, e.g. "1.5B"
  exact_views      bigint,                       -- whole number the game scores with
  youtube_link     text,                         -- the sheet's search link (reference only)
  embed_url        text                          -- filled by scripts/fill-embed-urls.mjs
);

-- Columns the game and scripts need, in case the table existed without them.
alter table public.songs_trivia add column if not exists exact_views bigint;
alter table public.songs_trivia add column if not exists embed_url text;

-- Fill exact_views from "1.5B" / "980M" / "850K" style text where it is still empty.
update public.songs_trivia
set exact_views = round(
      regexp_replace(estimated_views, '[^0-9.]', '', 'g')::numeric *
      case upper(right(regexp_replace(trim(estimated_views), '\+$', ''), 1))
        when 'B' then 1e9 when 'M' then 1e6 when 'K' then 1e3 else 1 end
    )::bigint
where exact_views is null
  and estimated_views ~ '[0-9]';

-- No song may reach the 10,000,000,000 fail penalty (otherwise missing it would cost less than getting it right).
-- This errors if any existing row is that large, which is the point: fix or remove the row, then re-run.
do $$
begin
  alter table public.songs_trivia
    add constraint songs_trivia_views_below_penalty
    check (exact_views is null or exact_views < 10000000000);
exception when duplicate_object then null;
end $$;

-- One row per category + region + song. The import script upserts on this, so re-running it never duplicates.
create unique index if not exists songs_trivia_unique
  on public.songs_trivia (category, region, artist_and_song);

-- The game (browser, anon key) only needs to READ songs.
alter table public.songs_trivia enable row level security;
drop policy if exists "anyone can read songs" on public.songs_trivia;
create policy "anyone can read songs" on public.songs_trivia for select to anon using (true);

-- WRITES: the import and fill scripts run on your own computer. The simplest, safest way is to put your
-- project's service_role key in .env as SUPABASE_SERVICE_ROLE_KEY (it bypasses these policies; never put it
-- in the browser app). If you would rather use the anon key, uncomment the next block while you run the
-- scripts, then drop the policies again, because anyone holding the anon key could otherwise edit your songs.
--
-- create policy "TEMP anon insert" on public.songs_trivia for insert to anon with check (true);
-- create policy "TEMP anon update" on public.songs_trivia for update to anon using (true) with check (true);
--
-- drop policy "TEMP anon insert" on public.songs_trivia;
-- drop policy "TEMP anon update" on public.songs_trivia;
