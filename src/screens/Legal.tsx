// ⚠️ 초안입니다. 공개 전에 운영자 정보(이름/문의 이메일/시행일)를 채우고 검토하세요.
const CONTACT: string =
  (import.meta.env.VITE_CONTACT_EMAIL as string | undefined) || 'jkleeg60@gmail.com'

export function Privacy() {
  return (
    <main className="screen legal-page">
      <h1>개인정보처리방침 (초안)</h1>
      <h2>수집하는 정보</h2>
      <p>
        Google 로그인 시 이메일 주소와 계정 고유 ID, 서비스 이용 중 생성되는 학습 기록(레벨, 단어별 학습
        상태, 판단 기록, 레벨테스트 결과)을 수집합니다.
      </p>
      <h2>이용 목적</h2>
      <p>로그인 및 본인 확인, 학습 기록 저장과 복습 일정 제공, 서비스 개선에 이용합니다.</p>
      <h2>보관 및 삭제</h2>
      <p>
        계정이 유지되는 동안 보관하며, 앱의 '설정 &gt; 계정 삭제'를 누르면 계정과 모든 학습 기록이 즉시
        삭제됩니다.
      </p>
      <h2>처리 위탁</h2>
      <p>데이터 저장과 인증은 Supabase를 통해 처리됩니다.</p>
      <h2>문의</h2>
      <p>{CONTACT}</p>
      <a href="#/">← 돌아가기</a>
    </main>
  )
}

export function Terms() {
  return (
    <main className="screen legal-page">
      <h1>이용약관 (초안)</h1>
      <h2>서비스</h2>
      <p>Word Pop은 토익 영어 단어 암기를 돕는 무료 학습 서비스입니다.</p>
      <h2>이용자의 책임</h2>
      <p>본인의 Google 계정으로 이용하며, 서비스를 부정한 방법으로 이용해서는 안 됩니다.</p>
      <h2>콘텐츠</h2>
      <p>
        단어 뜻과 예문은 학습 참고용이며 정확성을 보장하지 않습니다. 점수대 구분은 실제 토익 점수가 아니라
        단어 난이도 추정입니다.
      </p>
      <h2>서비스 변경 및 종료</h2>
      <p>운영상 필요에 따라 서비스 내용이 변경되거나 종료될 수 있습니다.</p>
      <h2>문의</h2>
      <p>{CONTACT}</p>
      <a href="#/">← 돌아가기</a>
    </main>
  )
}
