import { useState } from 'react'
import { LEVEL_NAMES } from '../lib/words'
import { addOffsetDays, getOffset, resetOffset } from '../lib/clock'
import { audioSupported } from '../lib/audio'
import type { Store } from '../lib/store'
import type { Profile } from '../lib/types'

export default function Settings({
  profile,
  store,
  onChange,
  onRetest,
  onBack,
  onClock,
}: {
  profile: Profile
  store: Store
  onChange: (p: Partial<Profile>) => void
  onRetest: () => void
  onBack: () => void
  onClock: () => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    setBusy(true)
    setError('')
    try {
      await store.deleteAccount()
      await store.signOut()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했어요')
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <div className="row between">
        <button className="link" onClick={onBack}>
          ← 뒤로
        </button>
        <h2 className="m0">설정</h2>
        <span style={{ width: 40 }} />
      </div>

      <h3 className="sec">하루 새 단어 목표</h3>
      <div className="seg">
        {[5, 10, 20].map((n) => (
          <button
            key={n}
            className={profile.dailyGoal === n ? 'on' : ''}
            onClick={() => onChange({ dailyGoal: n })}
          >
            {n}개
          </button>
        ))}
      </div>

      <h3 className="sec">학습 레벨</h3>
      <div className="seg">
        {[1, 2, 3, 4].map((lv) => (
          <button
            key={lv}
            className={profile.level === lv ? 'on' : ''}
            onClick={() => onChange({ level: lv })}
          >
            {LEVEL_NAMES[lv]}
          </button>
        ))}
      </div>
      <button className="btn block mt" onClick={onRetest}>
        레벨 테스트 다시 보기
      </button>

      <h3 className="sec">소리</h3>
      <label className="toggle">
        <span>카드가 나오면 발음 자동 재생</span>
        <input
          type="checkbox"
          checked={profile.autoAudio}
          onChange={(e) => onChange({ autoAudio: e.target.checked })}
        />
      </label>
      <label className="toggle mt">
        <span>
          뒤집기 전 &lsquo;알아요&rsquo; 확인 팝업
          <br />
          <small className="mute">끄면 뜻을 보지 않고 바로 알아요 처리돼요</small>
        </span>
        <input
          type="checkbox"
          checked={profile.confirmKnow}
          onChange={(e) => onChange({ confirmKnow: e.target.checked })}
        />
      </label>
      {!audioSupported() && <p className="mute small">이 브라우저는 음성 재생을 지원하지 않아요.</p>}

      {store.demo && (
        <>
          <h3 className="sec">데모 도구</h3>
          <p className="mute small">
            복습 일정을 확인하려고 시간을 앞당겨요. (현재 +{getOffset()}일)
          </p>
          <div className="row">
            <button
              className="btn grow"
              onClick={() => {
                addOffsetDays(1)
                onClock()
              }}
            >
              하루 뒤로
            </button>
            <button
              className="btn grow"
              onClick={() => {
                resetOffset()
                onClock()
              }}
            >
              시간 되돌리기
            </button>
          </div>
        </>
      )}

      <h3 className="sec">계정</h3>
      <button className="btn block" onClick={() => store.signOut()}>
        로그아웃
      </button>
      {!confirmDel ? (
        <button className="btn danger block mt" onClick={() => setConfirmDel(true)}>
          계정 삭제
        </button>
      ) : (
        <div className="panel mt">
          <p>계정과 모든 학습 기록이 삭제되며 되돌릴 수 없어요. 정말 삭제할까요?</p>
          <div className="row">
            <button className="btn grow" onClick={() => setConfirmDel(false)} disabled={busy}>
              취소
            </button>
            <button className="btn danger grow" onClick={remove} disabled={busy}>
              {busy ? '삭제 중…' : '삭제'}
            </button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      <p className="mute small center-text mt">
        <a href="#/terms">이용약관</a> · <a href="#/privacy">개인정보처리방침</a>
      </p>
    </main>
  )
}
