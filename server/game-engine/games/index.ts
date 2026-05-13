import type { GameDefinition } from '../types.js'
import { decisionGames } from './decisionGames.js'
import { numberGames } from './numberGames.js'
import { socialGames } from './socialGames.js'
import { stageGames } from './stageGames.js'

export const GAME_DEFINITIONS: Record<string, GameDefinition> = {
  ...socialGames,
  ...numberGames,
  ...decisionGames,
  ...stageGames,
}
