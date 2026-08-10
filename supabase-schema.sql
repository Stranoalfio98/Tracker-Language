-- =========================================================
-- Road to 90 — schema Supabase
-- Incolla tutto questo file in Supabase: SQL Editor -> New query -> Run
-- =========================================================

-- Tabella: una riga per ogni giornata di "Minuti Giornalieri"
create table if not exists public.minuti_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  lesing integer not null default 0,
  semplificato integer not null default 0,
  tecnico integer not null default 0,
  hobby integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists minuti_entries_user_date_idx on public.minuti_entries(user_id, date);

-- Tabella: una riga per ogni giornata di "Habit Tracker"
create table if not exists public.habit_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  checks jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists habit_entries_user_date_idx on public.habit_entries(user_id, date);

-- Tabella: impostazioni (una riga per utente)
create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_days integer not null default 90,
  verde_min integer not null default 120,
  giallo_min integer not null default 60,
  categories jsonb not null default '[
    {"key":"lesing","label":"Lesing / Ilys"},
    {"key":"semplificato","label":"Semplificato"},
    {"key":"tecnico","label":"Tecnico"},
    {"key":"hobby","label":"YT - Podcast / Hobby"}
  ]'::jsonb
);

-- Tabella: lista habit personalizzabile (una riga per utente)
create table if not exists public.app_habits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  habits jsonb not null default '[]'::jsonb
);

-- =========================================================
-- Row Level Security: ognuno vede e modifica SOLO i propri dati
-- =========================================================
alter table public.minuti_entries enable row level security;
alter table public.habit_entries enable row level security;
alter table public.app_settings enable row level security;
alter table public.app_habits enable row level security;

create policy "minuti_select_own" on public.minuti_entries for select using (auth.uid() = user_id);
create policy "minuti_insert_own" on public.minuti_entries for insert with check (auth.uid() = user_id);
create policy "minuti_update_own" on public.minuti_entries for update using (auth.uid() = user_id);
create policy "minuti_delete_own" on public.minuti_entries for delete using (auth.uid() = user_id);

create policy "habit_entries_select_own" on public.habit_entries for select using (auth.uid() = user_id);
create policy "habit_entries_insert_own" on public.habit_entries for insert with check (auth.uid() = user_id);
create policy "habit_entries_update_own" on public.habit_entries for update using (auth.uid() = user_id);
create policy "habit_entries_delete_own" on public.habit_entries for delete using (auth.uid() = user_id);

create policy "settings_select_own" on public.app_settings for select using (auth.uid() = user_id);
create policy "settings_insert_own" on public.app_settings for insert with check (auth.uid() = user_id);
create policy "settings_update_own" on public.app_settings for update using (auth.uid() = user_id);

create policy "habits_select_own" on public.app_habits for select using (auth.uid() = user_id);
create policy "habits_insert_own" on public.app_habits for insert with check (auth.uid() = user_id);
create policy "habits_update_own" on public.app_habits for update using (auth.uid() = user_id);
