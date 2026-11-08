import { COURSES, type CourseKey } from '../lib/courses'

// 처음 로그인한 새 계정이 어떤 시험을 준비할지 고르는 화면
export default function CoursePicker({ onPick }: { onPick: (c: CourseKey) => void }) {
  return (
    <main className="screen">
      <div className="brand sm">Word Pop</div>
      <h1 className="pick-title">어떤 시험을 준비하세요?</h1>
      <p className="mute m0">오늘 공부할 시험을 골라 주세요. 홈 화면에서 언제든 바꿀 수 있어요.</p>
      <div className="course-grid">
        {COURSES.map((c) =>
          c.ready ? (
            <button
              key={c.key}
              className="course-card ready"
              onClick={() => onPick(c.key)}
              aria-label={`${c.name} ${c.exam} 시작하기`}
            >
              <span className="course-glyph">{c.glyph}</span>
              <span>
                <b className="course-name">{c.name}</b>
                <span className="course-exam">{c.exam}</span>
                <span className="course-go">시작하기 →</span>
              </span>
            </button>
          ) : (
            <button key={c.key} className="course-card" disabled aria-label={`${c.name} ${c.exam} 준비 중`}>
              <span className="course-glyph soon">{c.glyph}</span>
              <span>
                <b className="course-name">{c.name}</b>
                <span className="course-exam">{c.exam}</span>
                <span className="soon-pill">준비 중</span>
              </span>
            </button>
          ),
        )}
      </div>
      {COURSES.some((c) => !c.ready) && (
        <p className="mute small center-text spacer-top">준비 중인 시험은 순서대로 열어 갈게요.</p>
      )}
    </main>
  )
}
