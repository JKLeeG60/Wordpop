# Word Pop

토익 단어 카드 웹앱 (Vite + React + TypeScript + Supabase).

## 기능
- Google 로그인, 24문항 레벨테스트(6문항×4구간), 홈 대시보드(누적 7일 그래프·복습/졸업·레벨 진도·목표·연속 학습)
- 카드 학습: 탭 뒤집기, 위로 밀기=알아요(뒤집기 전엔 확인), 좌우=몰라요, 되돌리기, 영어 발음(Web Speech API)
- 라이트너 복습(1·3·7·14·30일), 새 단어 더 보기, 레벨 올리기
- 설정: 목표/레벨/자동 재생, 로그아웃, 계정 삭제, 이용약관·개인정보처리방침
- 단어 200개는 `src/data/words.json`에 포함 (AI 초안, 공개 전 검수 필요)

## 실행
```
npm install
npm run dev
```
`.env`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`가 없으면 데모 모드(브라우저 저장)로 동작합니다.

## Supabase
`supabase/schema.sql`을 SQL Editor에서 한 번 실행하세요. (기존 테스트용 테이블은 삭제됩니다)
