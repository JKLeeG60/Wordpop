import { useState } from 'react'
import { LEVEL_NAMES } from '../lib/words'
import { addOffsetDays, getOffset, resetOffset } from '../lib/clock'
import { audioSupported } from '../lib/audio'
import type { Store } from '../lib/store'
import type { Profile } from '../lib/types'

export default function Settings({
  profile,
  store,
  onSave,
  onRetest,
  onBack,
  onClock,
}: {
  profile: Profile
  store: Store
  onSave: (p: Partial<Profile>) => Promise<void>
  onRetest: () => void
  onBack: () => void
  onClock: () => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shareMsg, setShareMsg] = useState('')
  // 저장을 누르기 전까지는 화면 안의 임시 값으로만 들고 있는다
  const [draft, setDraft] = useState<Partial<Profile>>({})
  const [saving, setSaving] = useState(false)
  const cur = { ...profile, ...draft }
  const dirty = (Object.keys(draft) as (keyof Profile)[]).some((k) => draft[k] !== profile[k])
  const onChange = (p: Partial<Profile>) => setDraft((d) => ({ ...d, ...p }))

  async function save() {
    setSaving(true)
    setError('')
    try {
      await onSave(draft)
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했어요')
      setSaving(false)
    }
  }

  // 친구 초대: 폰의 공유 창(카카오톡·문자·복사 등)을 열고, 안 되면 링크를 복사
  async function invite() {
    const data = {
      title: 'Word Pop',
      text: 'Word Pop - 레벨 테스트로 내 수준을 확인하고, 카드를 넘기며 빠르게 토익 단어를 암기해요!',
      url: window.location.origin,
    }
    setShareMsg('')
    try {
      if (navigator.share) {
        await navigator.share(data)
        return
      }
      await navigator.clipboard.writeText(`${data.text}\n${data.url}`)
      setShareMsg('링크가 복사됐어요. 친구에게 붙여넣어 보내 주세요.')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // 사용자가 공유 창을 닫음
      setShareMsg(`복사에 실패했어요. 주소를 직접 알려 주세요: ${data.url}`)
    }
  }

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
        <button className="link strong" onClick={save} disabled={!dirty || saving}>
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>

      <h3 className="sec">하루 새 단어 목표</h3>
      <div className="seg">
        {[5, 10, 20].map((n) => (
          <button
            key={n}
            className={cur.dailyGoal === n ? 'on' : ''}
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
            className={cur.level === lv ? 'on' : ''}
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
          checked={cur.autoAudio}
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
          checked={cur.confirmKnow}
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
      <button className="btn block" onClick={invite}>
        친구 초대
      </button>
      {shareMsg && <p className="mute small">{shareMsg}</p>}
      <button className="btn block mt" onClick={() => store.signOut()}>
        로그 아웃
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
