-- Word Pop 스키마. Supabase 대시보드 > SQL Editor 에 붙여넣고 Run.

create table if not exists public.words (
  id bigint generated always as identity primary key,
  word text not null unique,
  meaning_ko text not null,
  pos text,
  example text,
  level smallint not null check (level between 1 and 4), -- 1:100~300 2:300~500 3:500~700 4:700~990
  reviewed boolean not null default false               -- 직접 검수 완료 여부
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  level smallint check (level between 1 and 4),
  total_studied integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  word_id bigint not null references public.words (id) on delete cascade,
  box smallint not null default 0,
  next_review timestamptz not null default now(),
  known_count integer not null default 0,
  unknown_count integer not null default 0,
  primary key (user_id, word_id)
);

alter table public.words enable row level security;
alter table public.profiles enable row level security;
alter table public.progress enable row level security;

create policy "words readable by signed-in users" on public.words
  for select to authenticated using (true);

create policy "own profile" on public.profiles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own progress" on public.progress
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 계정 삭제: 본인 계정을 삭제하면 profiles/progress 도 cascade 로 함께 삭제됨
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
