import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MAX_RESULT_DISPLAY_DURATION,
  MAX_ROUND_DURATION,
  MAX_ROUNDS,
  MIN_RESULT_DISPLAY_DURATION,
  MIN_ROUND_DURATION,
  MIN_ROUNDS,
} from '../shared/game'
import { MINIGAMES } from '../shared/minigames'
import type { GameSettings, InputControl, RoundHistoryItem } from '../shared/game'
import { usePartyGame } from './hooks/usePartyGame'

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function phaseLabel(phase: string) {
  switch (phase) {
    case 'lobby':
      return '로비'
    case 'round':
      return '게임 진행'
    case 'roundResult':
      return '라운드 결과'
    case 'finished':
      return '최종 결과'
    default:
      return '대기 중'
  }
}

function EntryScreen(props: {
  nickname: string
  roomCode: string
  error: string | null
  onNicknameChange: (value: string) => void
  onRoomCodeChange: (value: string) => void
  onCreate: () => void
  onJoin: () => void
}) {
  const disabled = props.nickname.trim().length < 2

  return (
    <section className="landing">
      <div className="landing-copy">
        <span className="section-kicker">파티룸</span>
        <h1>한 공간에서 모이고, 채팅하고, 라운드별 심리전까지 이어지는 파티 게임</h1>
        <p>
          방을 만들거나 참가한 뒤 로비에서 설정을 맞추고, 다양한 미니게임을 실시간으로 진행해 최종
          순위를 겨뤄 보세요.
        </p>
      </div>

      <section className="auth-panel">
        <label className="field">
          <span>닉네임</span>
          <input
            value={props.nickname}
            maxLength={18}
            onChange={(event) => props.onNicknameChange(event.target.value)}
            placeholder="예: PixelFox"
          />
        </label>

        <label className="field">
          <span>방 코드</span>
          <input
            value={props.roomCode}
            maxLength={6}
            onChange={(event) => props.onRoomCodeChange(event.target.value.toUpperCase())}
            placeholder="ABCD"
          />
        </label>

        <div className="button-row">
          <button className="button solid" disabled={disabled} onClick={props.onCreate}>
            방 만들기
          </button>
          <button
            className="button subtle"
            disabled={disabled || props.roomCode.trim().length < 4}
            onClick={props.onJoin}
          >
            코드로 참가
          </button>
        </div>

        {props.error ? <p className="inline-error">{props.error}</p> : null}
      </section>
    </section>
  )
}

function Header(props: {
  roomCode?: string
  phase?: string
  connectionLost: boolean
  onLeave?: () => void
}) {
  return (
    <header className="site-header">
      <div className="brand">
        <div className="brand-mark">P</div>
        <div>
          <strong>파티룸</strong>
          <p>실시간 멀티플레이 미니게임</p>
        </div>
      </div>

      <div className="header-actions">
        {props.roomCode ? <span className="status-chip">방 {props.roomCode}</span> : null}
        {props.phase ? <span className="status-chip muted">{phaseLabel(props.phase)}</span> : null}
        <span className={`status-chip ${props.connectionLost ? 'danger' : ''}`}>
          {props.connectionLost ? '재연결 중' : '연결됨'}
        </span>
        {props.onLeave ? (
          <button className="button ghost compact" onClick={props.onLeave}>
            나가기
          </button>
        ) : null}
      </div>
    </header>
  )
}

function LobbyHero(props: {
  roomCode: string
  playerCount: number
  isHost: boolean
  isReady: boolean
  canStart: boolean
  onStart: () => void
  onToggleReady: () => void
}) {
  return (
    <section className="scene-hero">
      <div>
        <span className="section-kicker">방 {props.roomCode}</span>
        <h1>모두 준비되면 바로 시작하세요</h1>
        <p>
          지금 이 방에는 {props.playerCount}명이 있습니다. 호스트는 라운드 수와 게임 풀을 조정할 수
          있고, 참가자는 준비만 마치면 됩니다.
        </p>
      </div>

      <div className="hero-action">
        {props.isHost ? (
          <button className="button solid large" disabled={!props.canStart} onClick={props.onStart}>
            게임 시작
          </button>
        ) : (
          <button className="button solid large" onClick={props.onToggleReady}>
            {props.isReady ? '준비 취소' : '준비 완료'}
          </button>
        )}
      </div>
    </section>
  )
}

function PlayersPanel(props: {
  hostId: string
  players: ReturnType<typeof usePartyGame>['rankedPlayers']
}) {
  return (
    <section className="surface section-block">
      <div className="section-head">
        <div>
          <span className="section-kicker">참가자</span>
          <h2>방 인원</h2>
        </div>
        <strong>{props.players.length}명</strong>
      </div>

      <div className="list-table">
        {props.players.map((player) => (
          <article className="list-row" key={player.id}>
            <div>
              <strong>{player.nickname}</strong>
              <p>
                {player.id === props.hostId ? '호스트' : player.isReady ? '준비 완료' : '대기 중'}
                {' · '}
                {player.connected ? '온라인' : '오프라인'}
              </p>
            </div>
            <span className="score-text">{player.score}점</span>
          </article>
        ))}
      </div>
    </section>
  )
}

function SettingsPanel(props: {
  settings: GameSettings
  isHost: boolean
  onChange: (patch: Partial<GameSettings>) => void
}) {
  return (
    <section className="surface section-block">
      <div className="section-head">
        <div>
          <span className="section-kicker">설정</span>
          <h2>게임 설정</h2>
        </div>
        <strong>{props.isHost ? '편집 가능' : '호스트 전용'}</strong>
      </div>

      <div className="settings-form settings-form-double">
        <label className="field">
          <span>총 라운드 수</span>
          <input
            type="number"
            min={MIN_ROUNDS}
            max={MAX_ROUNDS}
            disabled={!props.isHost}
            value={props.settings.totalRounds}
            onChange={(event) => props.onChange({ totalRounds: Number(event.target.value) })}
          />
        </label>

        <label className="field">
          <span>라운드 시간</span>
          <input
            type="number"
            min={MIN_ROUND_DURATION}
            max={MAX_ROUND_DURATION}
            disabled={!props.isHost}
            value={props.settings.roundDuration}
            onChange={(event) => props.onChange({ roundDuration: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="settings-form settings-form-double">
        <label className="field">
          <span>결과 화면 시간</span>
          <input
            type="number"
            min={MIN_RESULT_DISPLAY_DURATION}
            max={MAX_RESULT_DISPLAY_DURATION}
            disabled={!props.isHost}
            value={props.settings.resultDisplayDuration}
            onChange={(event) =>
              props.onChange({ resultDisplayDuration: Number(event.target.value) })
            }
          />
        </label>

        <label className="field">
          <span>점수 방식</span>
          <select
            disabled={!props.isHost}
            value={props.settings.scoringMode}
            onChange={(event) =>
              props.onChange({ scoringMode: event.target.value as GameSettings['scoringMode'] })
            }
          >
            <option value="classic">기본 점수</option>
            <option value="streak">연속 보너스</option>
          </select>
        </label>
      </div>

      <div className="game-pool">
        {MINIGAMES.map((game) => {
          const checked = props.settings.minigamePool.includes(game.id)
          return (
            <label className="pool-row" key={game.id}>
              <input
                type="checkbox"
                checked={checked}
                disabled={!props.isHost}
                onChange={(event) => {
                  const nextPool = event.target.checked
                    ? [...props.settings.minigamePool, game.id]
                    : props.settings.minigamePool.filter((id) => id !== game.id)

                  if (nextPool.length > 0) {
                    props.onChange({ minigamePool: nextPool })
                  }
                }}
              />
              <div>
                <strong>{game.name}</strong>
                <p>{game.description}</p>
              </div>
            </label>
          )
        })}
      </div>
    </section>
  )
}

function ChatPanel(props: {
  messages: NonNullable<ReturnType<typeof usePartyGame>['room']>['chatMessages']
  onSend: (message: string) => void
}) {
  const [value, setValue] = useState('')
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = logRef.current
    if (!node) {
      return
    }

    node.scrollTop = node.scrollHeight
  }, [props.messages])

  return (
    <aside className="side-panel">
      <div className="section-head">
        <div>
          <span className="section-kicker">채팅</span>
          <h2>대화</h2>
        </div>
      </div>

      <div className="chat-log chat-log-plain" ref={logRef}>
        {props.messages.map((message) => (
          <div className={`chat-text-line ${message.system ? 'system' : ''}`} key={message.id}>
            <strong>{message.nickname}</strong>
            <span> : </span>
            <span>{message.message}</span>
          </div>
        ))}
      </div>

      <form
        className="chat-compose"
        onSubmit={(event) => {
          event.preventDefault()
          if (!value.trim()) {
            return
          }

          props.onSend(value)
          setValue('')
        }}
      >
        <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="메시지 입력" />
        <button className="button subtle" type="submit">
          보내기
        </button>
      </form>
    </aside>
  )
}

function renderControl(
  control: InputControl,
  values: Record<string, string>,
  onChange: (id: string, value: string) => void,
) {
  if (control.type === 'number') {
    return (
      <label className="field" key={control.id}>
        <span>{control.label}</span>
        <input
          type="number"
          min={control.min}
          max={control.max}
          value={values[control.id] ?? ''}
          placeholder={control.placeholder}
          onChange={(event) => onChange(control.id, event.target.value)}
        />
      </label>
    )
  }

  if (control.type === 'text') {
    return (
      <label className="field" key={control.id}>
        <span>{control.label}</span>
        <input
          type="text"
          value={values[control.id] ?? ''}
          placeholder={control.placeholder}
          onChange={(event) => onChange(control.id, event.target.value)}
        />
      </label>
    )
  }

  return (
    <label className="field" key={control.id}>
      <span>{control.label}</span>
      <select value={values[control.id] ?? ''} onChange={(event) => onChange(control.id, event.target.value)}>
        <option value="">선택해 주세요</option>
        {control.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function RoundScene(props: {
  room: NonNullable<ReturnType<typeof usePartyGame>['room']>
  onSubmit: (values: Record<string, string>) => void
}) {
  const activeRound = props.room.activeRound
  const [values, setValues] = useState<Record<string, string>>(activeRound?.selfSubmission ?? {})
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!activeRound) {
      return
    }

    const sync = () => setRemaining(activeRound.endsAt - Date.now())
    sync()
    const timer = window.setInterval(sync, 250)
    return () => window.clearInterval(timer)
  }, [activeRound])

  if (!activeRound) {
    return null
  }

  const canSubmit =
    activeRound.controls.length > 0 &&
    activeRound.controls.every((control) => (values[control.id] ?? '').trim().length > 0)

  return (
    <section className="round-scene">
      <div className="round-hero">
        <div>
          <span className="section-kicker">
            {activeRound.roundNumber}라운드 · {activeRound.stageIndex}/{activeRound.stageCount} 단계
          </span>
          <h1>{activeRound.miniGameName}</h1>
          <p>{activeRound.description}</p>
        </div>
        <div className="timer-display">{formatTime(remaining)}</div>
      </div>

      <div className="round-layout">
        <section className="answer-stage">
          <p className="prompt-text">{activeRound.stageLabel}</p>

          <div className="instruction-list">
            {activeRound.instructions.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>

          {activeRound.privateNote ? <div className="private-note">{activeRound.privateNote}</div> : null}

          {activeRound.publicInfo.length > 0 ? (
            <div className="public-info-list">
              {activeRound.publicInfo.map((item) => (
                <div className="public-info-row" key={`${item.label}-${item.value}`}>
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          ) : null}

          {activeRound.controls.length > 0 ? (
            <div className="dynamic-controls">
              {activeRound.controls.map((control) =>
                renderControl(control, values, (id, value) =>
                  setValues((current) => ({
                    ...current,
                    [id]: value,
                  })),
                ),
              )}
            </div>
          ) : (
            <div className="waiting-box">이 단계는 안내만 표시됩니다. 타이머가 끝나면 다음 단계로 이동합니다.</div>
          )}

          <div className="answer-actions">
            {activeRound.controls.length > 0 ? (
              <>
                <button className="button solid large" disabled={!canSubmit} onClick={() => props.onSubmit(values)}>
                  {activeRound.selfSubmitted ? '제출 수정' : '제출하기'}
                </button>
                <p>
                  {activeRound.selfSubmitted
                    ? '마감 전까지 현재 단계의 입력을 수정할 수 있습니다.'
                    : '모든 참가자는 동시에 입력할 수 있으며, 미입력 시 자동 기권 처리됩니다.'}
                </p>
              </>
            ) : (
              <p>입력 없이 잠시 후 자동 진행됩니다.</p>
            )}
          </div>
        </section>

        <aside className="round-side">
          <section className="surface section-block compact-block">
            <span className="section-kicker">내 상태</span>
            <h2>{activeRound.selfSubmitted ? '입력 저장됨' : '아직 입력 전'}</h2>
            <p>이 라운드의 모든 판정과 시간 계산은 서버 기준으로 처리됩니다.</p>
          </section>

          <section className="surface section-block compact-block">
            <span className="section-kicker">점수판</span>
            <h2>현재 점수</h2>
            <div className="list-table tight">
              {props.room.players.map((player) => (
                <article className="list-row" key={player.id}>
                  <strong>{player.nickname}</strong>
                  <span className="score-text">{player.score}점</span>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}

function RoundSummary(props: { round: RoundHistoryItem }) {
  return (
    <section className="surface results-section">
      <div className="section-head">
        <div>
          <span className="section-kicker">라운드 결과</span>
          <h2>
            {props.round.roundNumber}라운드 · {props.round.miniGameName}
          </h2>
        </div>
      </div>

      <div className="result-list">
        {props.round.results.map((result) => (
          <article className="result-row" key={result.playerId}>
            <div>
              <strong>
                #{result.rank} {result.nickname}
              </strong>
              <p>{result.submission ?? '미제출'}</p>
            </div>
            <div className="result-meta">
              <span>{result.points >= 0 ? '+' : ''}{result.points}점</span>
              <small>{result.detail}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function FinalResults(props: {
  rounds: RoundHistoryItem[]
  players: ReturnType<typeof usePartyGame>['rankedPlayers']
  isHost: boolean
  onRestart: () => void
  onReturnToLobby: () => void
}) {
  const winner = props.players[0]

  return (
    <section className="final-scene">
      <section className="scene-hero">
        <div>
          <span className="section-kicker">게임 종료</span>
          <h1>{winner ? `${winner.nickname}님이 1위입니다` : '게임이 종료되었습니다'}</h1>
          <p>최종 순위와 라운드 기록을 확인한 뒤 로비로 돌아가거나 바로 다시 시작할 수 있습니다.</p>
        </div>

        <div className="button-row">
          <button className="button subtle" disabled={!props.isHost} onClick={props.onReturnToLobby}>
            로비로 돌아가기
          </button>
          <button className="button solid" disabled={!props.isHost} onClick={props.onRestart}>
            다시 시작
          </button>
        </div>
      </section>

      <div className="results-grid">
        <section className="surface section-block">
          <div className="section-head">
            <div>
              <span className="section-kicker">최종 순위</span>
              <h2>순위표</h2>
            </div>
          </div>

          <div className="list-table">
            {props.players.map((player, index) => (
              <article className="list-row" key={player.id}>
                <div>
                  <strong>
                    #{index + 1} {player.nickname}
                  </strong>
                  <p>{player.connected ? '온라인' : '오프라인'}</p>
                </div>
                <span className="score-text">{player.score}점</span>
              </article>
            ))}
          </div>
        </section>

        <section className="surface section-block">
          <div className="section-head">
            <div>
              <span className="section-kicker">라운드 기록</span>
              <h2>진행 요약</h2>
            </div>
          </div>

          <div className="history-list">
            {props.rounds.map((round) => (
              <article className="history-row" key={round.roundNumber}>
                <strong>
                  {round.roundNumber}라운드 · {round.miniGameName}
                </strong>
                <p>{round.results.map((entry) => `${entry.nickname} ${entry.points >= 0 ? '+' : ''}${entry.points}점`).join(' / ')}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

export default function App() {
  const game = usePartyGame()
  const [roomCodeInput, setRoomCodeInput] = useState(game.session.roomCode ?? '')

  const latestRound = useMemo(
    () => game.room?.roundHistory[game.room.roundHistory.length - 1] ?? null,
    [game.room],
  )

  return (
    <main className="app-shell">
      <Header
        roomCode={game.room?.roomCode}
        phase={game.room?.phase}
        connectionLost={game.connectionLost}
        onLeave={game.room ? game.leaveRoom : undefined}
      />

      {!game.room ? (
        <EntryScreen
          nickname={game.session.nickname}
          roomCode={roomCodeInput}
          error={game.error}
          onNicknameChange={game.updateNickname}
          onRoomCodeChange={setRoomCodeInput}
          onCreate={game.createRoom}
          onJoin={() => game.joinRoom(roomCodeInput)}
        />
      ) : (
        <section className="app-layout">
          <div className="main-scene">
            {game.room.phase === 'lobby' ? (
              <>
                <LobbyHero
                  roomCode={game.room.roomCode}
                  playerCount={game.room.players.length}
                  isHost={Boolean(game.me?.isHost)}
                  isReady={Boolean(game.me?.isReady)}
                  canStart={game.canStart}
                  onStart={game.startGame}
                  onToggleReady={game.toggleReady}
                />

                <div className="content-grid">
                  <div className="primary-column">
                    <PlayersPanel hostId={game.room.hostId} players={game.rankedPlayers} />
                    <SettingsPanel
                      settings={game.room.settings}
                      isHost={Boolean(game.me?.isHost)}
                      onChange={game.updateSettings}
                    />
                  </div>
                  <ChatPanel messages={game.room.chatMessages} onSend={game.sendChat} />
                </div>
              </>
            ) : null}

            {game.room.phase === 'round' ? (
              <RoundScene
                key={`${game.room.activeRound?.roundNumber ?? 0}-${game.room.activeRound?.stageKey ?? ''}`}
                room={game.room}
                onSubmit={game.submitAction}
              />
            ) : null}

            {game.room.phase === 'roundResult' && latestRound ? <RoundSummary round={latestRound} /> : null}

            {game.room.phase === 'finished' ? (
              <FinalResults
                rounds={game.room.roundHistory}
                players={game.rankedPlayers}
                isHost={Boolean(game.me?.isHost)}
                onRestart={game.restartGame}
                onReturnToLobby={game.returnToLobby}
              />
            ) : null}
          </div>

          {game.room.phase !== 'lobby' ? (
            <ChatPanel messages={game.room.chatMessages} onSend={game.sendChat} />
          ) : null}
        </section>
      )}

      {game.error ? (
        <aside className="toast" onClick={game.clearError}>
          {game.error}
        </aside>
      ) : null}
    </main>
  )
}
