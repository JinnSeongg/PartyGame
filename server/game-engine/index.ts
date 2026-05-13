import { createId } from '../../shared/game.js'
import type { GameSettings, PlayerSummary } from '../../shared/game.js'
import { GAME_DEFINITIONS } from './games/index.js'
import type { GameRuntime, SubmissionValues } from './types.js'

export { GAME_DEFINITIONS }
export type { GameDefinition, GameRuntime, ResultBundle, SubmissionRecord, SubmissionValues } from './types.js'

export function createRoundRuntime(
  miniGameId: string,
  players: PlayerSummary[],
  settings: GameSettings,
  roundNumber: number,
) {
  return GAME_DEFINITIONS[miniGameId].create(players, settings, roundNumber)
}

export function buildRoundView(
  runtime: GameRuntime,
  playerId: string,
  players: PlayerSummary[],
  settings: GameSettings,
) {
  return GAME_DEFINITIONS[runtime.miniGameId].buildView(runtime, playerId, players, settings)
}

export function submitToRound(
  runtime: GameRuntime,
  playerId: string,
  values: SubmissionValues,
  players: PlayerSummary[],
  settings: GameSettings,
  receivedAt: number,
) {
  GAME_DEFINITIONS[runtime.miniGameId].submit(runtime, playerId, values, players, settings, receivedAt)
}

export function advanceRound(runtime: GameRuntime, players: PlayerSummary[], settings: GameSettings) {
  return GAME_DEFINITIONS[runtime.miniGameId].onTimeout(runtime, players, settings)
}

export function buildRoundResults(runtime: GameRuntime, players: PlayerSummary[], settings: GameSettings) {
  return GAME_DEFINITIONS[runtime.miniGameId].buildResults(runtime, players, settings)
}

export function createSystemChat(nickname: string, message: string) {
  return {
    id: createId('chat'),
    senderId: 'system',
    nickname,
    message,
    timestamp: Date.now(),
    system: true,
  }
}
