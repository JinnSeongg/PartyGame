import type {
  ActiveRoundState,
  GameSettings,
  InputControl,
  PlayerSummary,
  PublicInfoLine,
  RoundResultEntry,
  ScoreChange,
} from '../../shared/game.js'

export type SubmissionValues = Record<string, string>

export interface SubmissionRecord {
  values: SubmissionValues
  submittedAt: number
  tieBreaker: number
}

export interface GameRuntime {
  roundNumber: number
  miniGameId: string
  miniGameName: string
  description: string
  stageKey: string
  stageLabel: string
  stageIndex: number
  stageCount: number
  instructions: string[]
  publicInfo: PublicInfoLine[]
  durationSeconds: number
  startedAt: number
  endsAt: number
  controls: InputControl[]
  submissions: Map<string, SubmissionRecord>
  state: Record<string, unknown>
}

export interface ResultBundle {
  results: RoundResultEntry[]
  scoreChanges: ScoreChange[]
}

export interface GameDefinition {
  id: string
  create: (players: PlayerSummary[], settings: GameSettings, roundNumber: number) => GameRuntime
  buildView: (
    runtime: GameRuntime,
    playerId: string,
    players: PlayerSummary[],
    settings: GameSettings,
  ) => ActiveRoundState
  submit: (
    runtime: GameRuntime,
    playerId: string,
    values: SubmissionValues,
    players: PlayerSummary[],
    settings: GameSettings,
    receivedAt: number,
  ) => void
  onTimeout: (runtime: GameRuntime, players: PlayerSummary[], settings: GameSettings) => 'next' | 'finish'
  buildResults: (runtime: GameRuntime, players: PlayerSummary[], settings: GameSettings) => ResultBundle
}
