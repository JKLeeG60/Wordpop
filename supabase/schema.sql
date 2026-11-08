-- Word Pop 데이터베이스 스키마 (기획안 8장 기준)
-- Supabase 대시보드 > SQL Editor > New query 에 전체를 붙여넣고 Run 하세요.
-- 단어 데이터(200개)는 앱에 포함되어 있어서 words 테이블이 필요 없습니다.

-- 초기 테스트용으로 만들었던 예전 테이블 정리 (아직 실사용 데이터 없음)
drop table if exists public.progress cascade;
drop table if exists public.words cascade;
drop table if exists public.word_progress cascade;
drop table if exists public.review_log cascade;
drop table if exists public.level_tests cascade;
drop table if exists public.profiles cascade;

-- 1) 사용자 설정
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  level smallint check (level between 1 and 4),
  tested boolean not null default false,
  auto_audio boolean not null default true,
  confirm_know boolean not null default true,
  daily_goal smallint not null default 10 check (daily_goal in (5, 10, 20)),
  locale text not null default 'ko',
  created_at timestamptz not null default now()
);

-- 2) 단어별 학습 상태 (box 0 학습 중, 1~5 복습 단계, 6 졸업)
create table public.word_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  word_id text not null,
  box smallint not null default 0 check (box between 0 and 6),
  due_at timestamptz,
  wrong_count integer not null default 0,
  streak smallint not null default 0,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id)
);
create index word_progress_due on public.word_progress (user_id, due_at);

-- 3) 모든 판단 기록 (통계·알고리즘 튜닝용)
create table public.review_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  word_id text not null,
  known boolean not null,
  is_new boolean not null default false,
  response_ms integer,
  reviewed_at timestamptz not null default now()
);
create index review_log_user_time on public.review_log (user_id, reviewed_at);

-- 4) 레벨테스트 이력
create table public.level_tests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  taken_at timestamptz not null default now(),
  scores jsonb not null,
  result_level smallint not null check (result_level between 1 and 4)
);

-- 본인 데이터만 접근
alter table public.profiles enable row level security;
alter table public.word_progress enable row level security;
alter table public.review_log enable row level security;
alter table public.level_tests enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own progress" on public.word_progress
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own log" on public.review_log
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tests" on public.level_tests
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 계정 삭제: auth 사용자를 지우면 위 테이블의 본인 데이터가 cascade 로 함께 삭제됨
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
