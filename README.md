# Word Pop

토익 단어 암기카드 웹앱 (React + TypeScript + Vite + Supabase)

## 로컬 실행

```bash
cp .env.example .env   # Supabase URL / anon key 입력
npm install
npm run dev
```

## Supabase 설정

1. SQL Editor에서 `supabase/schema.sql` 실행 → `supabase/seed.sql` 실행
2. Authentication > Providers > Google 활성화
3. Authentication > URL Configuration 에 배포 주소(Site URL / Redirect URLs) 등록

## 기능 (MVP)

- Google 로그인
- 토익 레벨 테스트 (100~300 / 300~500 / 500~700 / 700~990)
- 카드 학습: 탭하면 뒤집기, 위로 밀기=아는 단어, 좌우로 밀기=모르는 단어(5~10장 뒤 재등장)
- 미국식 발음 읽어주기, 복습 일정, 누적 카드 수
- 개인정보처리방침·이용약관·계정 삭제

> 샘플 단어 40개는 AI 초안입니다. 공개 전에 직접 검수하세요.
