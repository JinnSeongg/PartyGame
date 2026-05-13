export const STORAGE_KEYS = {
  nickname: 'party-nickname',
  sessionId: 'party-session-id',
  roomCode: 'party-room-code',
} as const

export const ROOM_PHASES = ['idle', 'lobby', 'round', 'roundResult', 'finished'] as const
export type RoomPhase = (typeof ROOM_PHASES)[number]

export type ScoringMode = 'classic' | 'streak'
export type InputControlType = 'choice' | 'number' | 'text'

export interface MiniGameDefinition {
  id: string
  name: string
  description: string
}

export interface InputOption {
  value: string
  label: string
}

export interface InputControl {
  id: string
  label: string
  type: InputControlType
  options?: InputOption[]
  min?: number
  max?: number
  placeholder?: string
}

export interface PublicInfoLine {
  label: string
  value: string
}

export interface GameSettings {
  totalRounds: number
  roundDuration: number
  resultDisplayDuration: number
  minigamePool: string[]
  scoringMode: ScoringMode
}

export interface PlayerSummary {
  id: string
  nickname: string
  isHost: boolean
  isReady: boolean
  score: number
  connected: boolean
  joinedAt: number
}

export interface ChatMessage {
  id: string
  senderId: string
  nickname: string
  message: string
  timestamp: number
  system?: boolean
}

export interface ScoreChange {
  playerId: string
  nickname: string
  delta: number
  totalScore: number
  reason: string
}

export interface RoundResultEntry {
  playerId: string
  nickname: string
  submission: string | null
  rank: number
  points: number
  detail: string
}

export interface RoundHistoryItem {
  roundNumber: number
  miniGameId: string
  miniGameName: string
  startedAt: number
  endedAt: number
  results: RoundResultEntry[]
  scoreChanges: ScoreChange[]
}

export interface ActiveRoundState {
  roundNumber: number
  miniGameId: string
  miniGameName: string
  description: string
  stageKey: string
  stageLabel: string
  stageIndex: number
  stageCount: number
  startedAt: number
  endsAt: number
  instructions: string[]
  controls: InputControl[]
  publicInfo: PublicInfoLine[]
  selfSubmitted: boolean
  selfSubmission: Record<string, string> | null
  privateNote?: string | null
}

export interface RoomState {
  roomCode: string
  hostId: string
  phase: RoomPhase
  players: PlayerSummary[]
  settings: GameSettings
  activeRound: ActiveRoundState | null
  roundHistory: RoundHistoryItem[]
  chatMessages: ChatMessage[]
  createdAt: number
}

export interface ClientSession {
  sessionId: string
  playerId?: string
  nickname: string
  roomCode?: string
}

export interface JoinPayload {
  nickname: string
  roomCode?: string
  sessionId?: string
}

export interface SettingsPatch {
  totalRounds?: number
  roundDuration?: number
  resultDisplayDuration?: number
  minigamePool?: string[]
  scoringMode?: ScoringMode
}

export interface SubmitPayload {
  values: Record<string, string>
}

export interface ServerToClientEvents {
  room_state: (room: RoomState) => void
  room_joined: (payload: { sessionId: string; playerId: string; roomCode: string }) => void
  error_message: (payload: { message: string }) => void
  connection_status: (payload: { reconnecting: boolean }) => void
}

export interface ClientToServerEvents {
  create_room: (payload: JoinPayload) => void
  join_room: (payload: JoinPayload) => void
  reconnect_room: (payload: JoinPayload) => void
  leave_room: () => void
  toggle_ready: () => void
  update_settings: (patch: SettingsPatch) => void
  send_chat: (payload: { message: string }) => void
  start_game: () => void
  submit_action: (payload: SubmitPayload) => void
  restart_game: () => void
  return_to_lobby: () => void
}

export const DEFAULT_SETTINGS: GameSettings = {
  totalRounds: 3,
  roundDuration: 25,
  resultDisplayDuration: 10,
  minigamePool: [
    'bounty',
    'greed-control',
    'minority',
    'treasure-box',
    'unique-number',
    'cooperate-betray',
    'button-game',
    'crown',
    'average',
    'silence',
    'tracker',
    'faction-war',
    'odd-even',
    'random-number',
    'smuggler',
    'secret-auction',
    'trade-offer',
    'memory-test',
    'secret-team',
  ],
  scoringMode: 'classic',
}

export const MIN_ROUNDS = 1
export const MAX_ROUNDS = 7
export const MIN_ROUND_DURATION = 10
export const MAX_ROUND_DURATION = 90
export const MIN_RESULT_DISPLAY_DURATION = 2
export const MAX_RESULT_DISPLAY_DURATION = 15

export function createRoomCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function clampSettings(settings: GameSettings): GameSettings {
  return {
    totalRounds: Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, settings.totalRounds)),
    roundDuration: Math.min(
      MAX_ROUND_DURATION,
      Math.max(MIN_ROUND_DURATION, settings.roundDuration),
    ),
    resultDisplayDuration: Math.min(
      MAX_RESULT_DISPLAY_DURATION,
      Math.max(MIN_RESULT_DISPLAY_DURATION, settings.resultDisplayDuration),
    ),
    minigamePool: settings.minigamePool,
    scoringMode: settings.scoringMode,
  }
}

export function rankPlayers(players: PlayerSummary[]): PlayerSummary[] {
  return [...players].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }

    if (left.connected !== right.connected) {
      return Number(right.connected) - Number(left.connected)
    }

    return left.joinedAt - right.joinedAt
  })
}
