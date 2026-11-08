# Word Pop

토익 단어 카드 웹앱 (Vite + React + TypeScript + Supabase).

## 기능
- Google 로그인, 24문항 레벨테스트(6문항×4구간), 홈 대시보드(누적 7일 그래프·복습/졸업·레벨 진도·목표·연속 학습)
- 카드 학습: 탭 뒤집기, 위로 밀기=알아요(뒤집기 전엔 확인), 좌우=몰라요, 되돌리기, 영어 발음(Web Speech API), 카드 앞면 발음기호(IPA)
- 라이트너 복습(1·3·7·14·30일), 새 단어 더 보기, 레벨 올리기
- 설정: 목표/레벨/자동 재생, 로그아웃, 계정 삭제, 이용약관·개인정보처리방침
- 단어 4,979개 (레벨당 약 1,250개, 모두 발음기호 포함 — 미국식 CMU 발음 사전 기준)는 `src/data/words/level1~4.json`에 레벨별로 나뉘어 있고, 필요한 레벨만 불러옵니다 (뜻·예문은 AI가 직접 작성)

## 실행
```
npm install
npm run dev
```
`.env`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`가 없으면 데모 모드(브라우저 저장)로 동작합니다.
개인정보처리방침·이용약관의 문의 메일은 `VITE_CONTACT_EMAIL`로 바꿀 수 있습니다 (기본값 있음).

## Supabase
`supabase/schema.sql`을 SQL Editor에서 한 번 실행하세요. (기존 테스트용 테이블은 삭제됩니다)
