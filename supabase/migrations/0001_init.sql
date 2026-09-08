-- BudgetCore — initial schema (Firebase/Firestore → Supabase/Postgres migration)
-- Run this once in the Supabase Dashboard → SQL Editor after creating the project.

-- ── profiles ────────────────────────────────────────────────────────────────
-- Consolidates the four Firestore docs users/{uid}/settings/{profile,userProfile,paycheck,onboarding}
-- into one row per user, since they were all already independently partial-written.
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text,
  avatar           text,
  avatar_data      text,
  user_type        text check (user_type in ('spender','saver','learner','investor','fighter')),
  monthly_budget   numeric,
  income_target    numeric,
  expense_limit    numeric,
  email_digest     boolean not null default true,
  onboarding_goal  text,
  onboarded_at     timestamptz,
  paycheck_amount  numeric,
  paycheck_date    date,
  created_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are owner-only"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── transactions ────────────────────────────────────────────────────────────
create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null check (type in ('income','expense')),
  description   text not null,
  amount        numeric not null check (amount > 0),
  category      text,
  date          date not null,
  is_recurring  boolean not null default false,
  location      text,
  created_at    timestamptz not null default now()
);

create index transactions_user_id_idx on public.transactions(user_id);
create index transactions_user_date_idx on public.transactions(user_id, date);

alter table public.transactions enable row level security;

create policy "transactions are owner-only"
  on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── goals ───────────────────────────────────────────────────────────────────
create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  target      numeric not null check (target > 0),
  saved       numeric not null default 0,
  deadline    date,
  note        text not null default '',
  created_at  timestamptz not null default now()
);

create index goals_user_id_idx on public.goals(user_id);

alter table public.goals enable row level security;

create policy "goals are owner-only"
  on public.goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── investments ─────────────────────────────────────────────────────────────
create table public.investments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  type            text not null check (type in ('crypto','stock','etf','other')),
  shares          numeric not null check (shares > 0),
  purchase_price  numeric not null,
  current_price   numeric not null,
  purchase_date   date,
  created_at      timestamptz not null default now()
);

create index investments_user_id_idx on public.investments(user_id);

alter table public.investments enable row level security;

create policy "investments are owner-only"
  on public.investments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── networth ────────────────────────────────────────────────────────────────
create table public.networth (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  type              text not null check (type in (
                      'cash','savings','investment','realestate','vehicle','crypto','other_asset',
                      'creditcard_debt','student_loan','car_loan','mortgage_debt','personal_loan',
                      'medical_debt','other_liability'
                    )),
  value             numeric not null check (value >= 0),
  interest_rate     numeric not null default 0,
  monthly_payment   numeric not null default 0,
  created_at        timestamptz not null default now()
);

create index networth_user_id_idx on public.networth(user_id);

alter table public.networth enable row level security;

create policy "networth is owner-only"
  on public.networth for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── challenges ──────────────────────────────────────────────────────────────
create table public.challenges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  def_id        text not null,
  status        text not null default 'active' check (status in ('active','completed')),
  start_date    date not null default current_date,
  completed_at  date,
  created_at    timestamptz not null default now()
);

create index challenges_user_id_idx on public.challenges(user_id);

alter table public.challenges enable row level security;

create policy "challenges are owner-only"
  on public.challenges for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── new-user bootstrap ──────────────────────────────────────────────────────
-- Creates the profiles row the moment someone signs up, whether via email/password,
-- Google, or Apple, so every page can rely on a profile row already existing.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
