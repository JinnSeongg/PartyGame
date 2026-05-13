import type {
  ActiveRoundState,
  GameSettings,
  InputControl,
  PlayerSummary,
  PublicInfoLine,
  RoundResultEntry,
  ScoreChange,
} from '../../shared/game.js'
import { MINIGAME_MAP } from '../../shared/minigames.js'
import type { GameRuntime, ResultBundle, SubmissionValues } from './types.js'

export function choiceControl(id: string, label: string, options: string[]): InputControl {
  return {
    id,
    label,
    type: 'choice',
    options: options.map((option) => ({ value: option, label: option })),
  }
}

export function customChoiceControl(
  id: string,
  label: string,
  options: Array<{ value: string; label: string }>,
): InputControl {
  return {
    id,
    label,
    type: 'choice',
    options,
  }
}

export function numberControl(
  id: string,
  label: string,
  min: number,
  max: number,
  placeholder?: string,
): InputControl {
  return {
    id,
    label,
    type: 'number',
    min,
    max,
    placeholder,
  }
}

export function playerOptions(players: PlayerSummary[], currentPlayerId: string, includeSkip = false) {
  const options = players
    .filter((player) => player.id !== currentPlayerId)
    .map((player) => ({ value: player.id, label: player.nickname }))

  if (includeSkip) {
    options.unshift({ value: 'skip', label: '기권' })
  }

  return options
}

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function runtimeBase(gameId: string, roundNumber: number, durationSeconds: number): GameRuntime {
  const meta = MINIGAME_MAP[gameId]
  return {
    roundNumber,
    miniGameId: gameId,
    miniGameName: meta.name,
    description: meta.description,
    stageKey: 'main',
    stageLabel: '입력 단계',
    stageIndex: 1,
    stageCount: 1,
    instructions: [],
    publicInfo: [],
    durationSeconds,
    startedAt: 0,
    endsAt: 0,
    controls: [],
    submissions: new Map(),
    state: {},
  }
}

function getSelfSubmission(runtime: GameRuntime, playerId: string) {
  return runtime.submissions.get(playerId)?.values ?? null
}

export function createView(
  runtime: GameRuntime,
  playerId: string,
  controls: InputControl[],
  instructions: string[],
  publicInfo: PublicInfoLine[],
  privateNote?: string,
): ActiveRoundState {
  return {
    roundNumber: runtime.roundNumber,
    miniGameId: runtime.miniGameId,
    miniGameName: runtime.miniGameName,
    description: runtime.description,
    stageKey: runtime.stageKey,
    stageLabel: runtime.stageLabel,
    stageIndex: runtime.stageIndex,
    stageCount: runtime.stageCount,
    startedAt: runtime.startedAt,
    endsAt: runtime.endsAt,
    instructions,
    controls,
    publicInfo,
    selfSubmitted: runtime.submissions.has(playerId),
    selfSubmission: getSelfSubmission(runtime, playerId),
    privateNote: privateNote ?? null,
  }
}

export function recordSubmission(
  runtime: GameRuntime,
  playerId: string,
  values: SubmissionValues,
  receivedAt: number,
) {
  runtime.submissions.set(playerId, {
    values,
    submittedAt: receivedAt,
    tieBreaker: Math.random(),
  })
}

export function buildResultBundle(args: {
  runtime: GameRuntime
  players: PlayerSummary[]
  deltas: Record<string, number>
  details: Record<string, string>
  summaries: Record<string, string | null>
  reason: string
}): ResultBundle {
  const ordered = [...args.players].sort((left, right) => {
    const deltaDiff = (args.deltas[right.id] ?? 0) - (args.deltas[left.id] ?? 0)
    if (deltaDiff !== 0) {
      return deltaDiff
    }

    return left.nickname.localeCompare(right.nickname, 'ko')
  })

  const results = ordered.map((player, index): RoundResultEntry => ({
    playerId: player.id,
    nickname: player.nickname,
    submission: args.summaries[player.id] ?? null,
    rank: index + 1,
    points: args.deltas[player.id] ?? 0,
    detail: args.details[player.id] ?? '',
  }))

  const scoreChanges = args.players.map((player): ScoreChange => {
    const delta = args.deltas[player.id] ?? 0
    return {
      playerId: player.id,
      nickname: player.nickname,
      delta,
      totalScore: player.score + delta,
      reason: args.reason,
    }
  })

  return { results, scoreChanges }
}

export function submittedPlayerIds(runtime: GameRuntime) {
  return new Set(runtime.submissions.keys())
}

export function parseInteger(value: string | undefined) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

export function buttonOrder(runtime: GameRuntime) {
  return [...runtime.submissions.entries()].sort((left, right) => {
    if (left[1].submittedAt !== right[1].submittedAt) {
      return left[1].submittedAt - right[1].submittedAt
    }

    return left[1].tieBreaker - right[1].tieBreaker
  })
}
