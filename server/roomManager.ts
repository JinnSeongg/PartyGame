import { Server, Socket } from 'socket.io'
import {
  DEFAULT_SETTINGS,
  clampSettings,
  createId,
  createRoomCode,
  rankPlayers,
} from '../shared/game.js'
import { MINIGAME_MAP, MINIGAMES } from '../shared/minigames.js'
import type {
  ChatMessage,
  ClientToServerEvents,
  GameSettings,
  PlayerSummary,
  RoomState,
  ServerToClientEvents,
  SettingsPatch,
} from '../shared/game.js'
import {
  advanceRound,
  buildRoundResults,
  buildRoundView,
  createRoundRuntime,
  createSystemChat,
  submitToRound,
  type GameRuntime,
} from './gameEngine.js'

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>
type GameServer = Server<ClientToServerEvents, ServerToClientEvents>

interface PlayerRecord extends PlayerSummary {
  sessionId: string
  socketId: string
}

interface ActiveRoundRecord {
  runtime: GameRuntime
  roundStartedAt: number
}

interface RoomRecord {
  roomCode: string
  hostId: string
  phase: RoomState['phase']
  players: PlayerRecord[]
  settings: GameSettings
  activeRound: ActiveRoundRecord | null
  roundHistory: RoomState['roundHistory']
  chatMessages: ChatMessage[]
  createdAt: number
  roundTimer?: NodeJS.Timeout
  roundIndexCursor: number
}

interface JoinContext {
  roomCode?: string
  nickname: string
  sessionId?: string
}

export class RoomManager {
  private readonly rooms = new Map<string, RoomRecord>()

  public constructor(private readonly io: GameServer) {}

  public bindSocket(socket: GameSocket) {
    socket.emit('connection_status', { reconnecting: false })

    socket.on('create_room', (payload) => this.handleCreateRoom(socket, payload))
    socket.on('join_room', (payload) => this.handleJoinRoom(socket, payload))
    socket.on('reconnect_room', (payload) => this.handleReconnect(socket, payload))

    socket.on('toggle_ready', () => {
      const located = this.findPlayerBySocket(socket.id)
      if (!located || located.room.phase !== 'lobby') {
        return
      }

      located.player.isReady = !located.player.isReady
      this.emitRoom(located.room)
    })

    socket.on('update_settings', (patch) => {
      const located = this.findPlayerBySocket(socket.id)
      if (!located) {
        return
      }

      if (located.room.hostId !== located.player.id || located.room.phase !== 'lobby') {
        this.emitError(socket, '호스트만 로비에서 설정을 변경할 수 있어요.')
        return
      }

      located.room.settings = this.mergeSettings(located.room.settings, patch)
      this.emitRoom(located.room)
    })

    socket.on('send_chat', ({ message }) => {
      const located = this.findPlayerBySocket(socket.id)
      if (!located || !message.trim()) {
        return
      }

      located.room.chatMessages.push({
        id: createId('chat'),
        senderId: located.player.id,
        nickname: located.player.nickname,
        message: message.trim().slice(0, 240),
        timestamp: Date.now(),
      })
      located.room.chatMessages = located.room.chatMessages.slice(-100)
      this.emitRoom(located.room)
    })

    socket.on('start_game', () => {
      const located = this.findPlayerBySocket(socket.id)
      if (!located) {
        return
      }

      this.startGame(located.room, located.player.id, socket)
    })

    socket.on('submit_action', ({ values }) => {
      const located = this.findPlayerBySocket(socket.id)
      if (!located || located.room.phase !== 'round' || !located.room.activeRound) {
        return
      }

      submitToRound(
        located.room.activeRound.runtime,
        located.player.id,
        values,
        located.room.players,
        located.room.settings,
        Date.now(),
      )
      this.emitRoom(located.room)
    })

    socket.on('restart_game', () => {
      const located = this.findPlayerBySocket(socket.id)
      if (!located) {
        return
      }

      if (located.room.hostId !== located.player.id || located.room.phase !== 'finished') {
        this.emitError(socket, '최종 결과 화면에서는 호스트만 다시 시작할 수 있어요.')
        return
      }

      this.resetRoomToLobby(located.room, true)
    })

    socket.on('return_to_lobby', () => {
      const located = this.findPlayerBySocket(socket.id)
      if (!located) {
        return
      }

      if (located.room.hostId !== located.player.id) {
        this.emitError(socket, '호스트만 방을 로비로 돌릴 수 있어요.')
        return
      }

      this.resetRoomToLobby(located.room, false)
    })

    socket.on('leave_room', () => {
      this.leaveBySocket(socket.id)
    })

    socket.on('disconnect', () => {
      this.markDisconnected(socket.id)
    })
  }

  private handleCreateRoom(socket: GameSocket, payload: JoinContext) {
    const nickname = this.normalizeNickname(payload.nickname)
    if (!nickname) {
      this.emitError(socket, '닉네임은 두 글자 이상 입력해 주세요.')
      return
    }

    let roomCode = createRoomCode()
    while (this.rooms.has(roomCode)) {
      roomCode = createRoomCode()
    }

    const player = this.createPlayerRecord(nickname, payload.sessionId, socket.id, true)
    const room: RoomRecord = {
      roomCode,
      hostId: player.id,
      phase: 'lobby',
      players: [player],
      settings: DEFAULT_SETTINGS,
      activeRound: null,
      roundHistory: [],
      chatMessages: [createSystemChat('안내', `${nickname}님이 방을 만들었습니다.`)],
      createdAt: Date.now(),
      roundIndexCursor: 0,
    }

    this.rooms.set(roomCode, room)
    socket.join(roomCode)
    socket.emit('room_joined', { sessionId: player.sessionId, playerId: player.id, roomCode })
    this.emitRoom(room)
  }

  private handleJoinRoom(socket: GameSocket, payload: JoinContext) {
    const roomCode = payload.roomCode?.trim().toUpperCase()
    const nickname = this.normalizeNickname(payload.nickname)
    if (!roomCode || !nickname) {
      this.emitError(socket, '방 코드와 닉네임을 확인해 주세요.')
      return
    }

    const room = this.rooms.get(roomCode)
    if (!room) {
      this.emitError(socket, '존재하지 않는 방 코드예요.')
      return
    }

    if (room.phase !== 'lobby') {
      this.emitError(socket, '새 참가자는 로비 상태에서만 들어올 수 있어요.')
      return
    }

    const finalNickname = this.ensureUniqueNickname(room, nickname)
    const player = this.createPlayerRecord(finalNickname, payload.sessionId, socket.id, false)
    room.players.push(player)
    room.chatMessages.push(createSystemChat('안내', `${finalNickname}님이 참가했습니다.`))
    socket.join(roomCode)
    socket.emit('room_joined', { sessionId: player.sessionId, playerId: player.id, roomCode })
    this.emitRoom(room)
  }

  private handleReconnect(socket: GameSocket, payload: JoinContext) {
    const roomCode = payload.roomCode?.trim().toUpperCase()
    const sessionId = payload.sessionId?.trim()
    if (!roomCode || !sessionId) {
      return
    }

    const room = this.rooms.get(roomCode)
    if (!room) {
      return
    }

    const player = room.players.find((candidate) => candidate.sessionId === sessionId)
    if (!player) {
      return
    }

    player.socketId = socket.id
    player.connected = true
    player.nickname = this.ensureUniqueNickname(room, payload.nickname || player.nickname, player.id)
    socket.join(roomCode)
    socket.emit('room_joined', { sessionId: player.sessionId, playerId: player.id, roomCode })
    socket.emit('connection_status', { reconnecting: true })
    this.emitRoom(room)
  }

  private startGame(room: RoomRecord, requesterId: string, socket: GameSocket) {
    if (room.hostId !== requesterId) {
      this.emitError(socket, '호스트만 게임을 시작할 수 있어요.')
      return
    }

    if (room.phase !== 'lobby') {
      this.emitError(socket, '게임은 로비에서만 시작할 수 있어요.')
      return
    }

    const connectedPlayers = room.players.filter((player) => player.connected)
    if (connectedPlayers.length < 2) {
      this.emitError(socket, '최소 2명 이상 연결되어 있어야 해요.')
      return
    }

    if (!room.players.every((player) => player.isHost || player.isReady || !player.connected)) {
      this.emitError(socket, '호스트를 제외한 연결된 참가자는 모두 준비 상태여야 해요.')
      return
    }

    room.players.forEach((player) => {
      player.score = 0
      player.isReady = false
    })
    room.roundHistory = []
    room.roundIndexCursor = 0
    this.startNextRound(room)
  }

  private startNextRound(room: RoomRecord) {
    if (room.roundIndexCursor >= room.settings.totalRounds) {
      room.phase = 'finished'
      room.activeRound = null
      this.emitRoom(room)
      return
    }

    const pool = room.settings.minigamePool
    const selectedId = pool[Math.floor(Math.random() * pool.length)]
    const miniGameId = MINIGAME_MAP[selectedId] ? selectedId : MINIGAMES[0].id
    const runtime = createRoundRuntime(miniGameId, room.players, room.settings, room.roundIndexCursor + 1)
    room.phase = 'round'
    room.activeRound = {
      runtime,
      roundStartedAt: Date.now(),
    }
    room.chatMessages.push(createSystemChat('안내', `${runtime.roundNumber}라운드가 시작되었습니다.`))
    this.armRoundStage(room)
    this.emitRoom(room)
  }

  private armRoundStage(room: RoomRecord) {
    if (!room.activeRound) {
      return
    }

    const runtime = room.activeRound.runtime
    runtime.startedAt = Date.now()
    runtime.endsAt = runtime.startedAt + runtime.durationSeconds * 1000

    clearTimeout(room.roundTimer)
    room.roundTimer = setTimeout(() => {
      this.handleRoundTimeout(room.roomCode)
    }, runtime.durationSeconds * 1000)
  }

  private handleRoundTimeout(roomCode: string) {
    const room = this.rooms.get(roomCode)
    if (!room || room.phase !== 'round' || !room.activeRound) {
      return
    }

    const action = advanceRound(room.activeRound.runtime, room.players, room.settings)
    if (action === 'next') {
      this.armRoundStage(room)
      this.emitRoom(room)
      return
    }

    this.finishRound(room)
  }

  private finishRound(room: RoomRecord) {
    if (!room.activeRound) {
      return
    }

    clearTimeout(room.roundTimer)
    room.roundTimer = undefined

    const { runtime } = room.activeRound
    const resultBundle = buildRoundResults(runtime, room.players, room.settings)

    resultBundle.scoreChanges.forEach((change) => {
      const player = room.players.find((candidate) => candidate.id === change.playerId)
      if (player) {
        player.score = change.totalScore
      }
    })

    room.roundHistory.push({
      roundNumber: runtime.roundNumber,
      miniGameId: runtime.miniGameId,
      miniGameName: runtime.miniGameName,
      startedAt: room.activeRound.roundStartedAt,
      endedAt: Date.now(),
      results: resultBundle.results,
      scoreChanges: resultBundle.scoreChanges,
    })

    room.phase = 'roundResult'
    room.activeRound = null
    room.roundIndexCursor += 1
    this.emitRoom(room)

    setTimeout(() => {
      if (!this.rooms.has(room.roomCode)) {
        return
      }

      if (room.roundIndexCursor >= room.settings.totalRounds) {
        room.phase = 'finished'
        this.emitRoom(room)
        return
      }

      this.startNextRound(room)
    }, room.settings.resultDisplayDuration * 1000)
  }

  private leaveBySocket(socketId: string) {
    const located = this.findPlayerBySocket(socketId)
    if (!located) {
      return
    }

    const room = located.room
    room.players = room.players.filter((candidate) => candidate.id !== located.player.id)

    if (room.players.length === 0) {
      clearTimeout(room.roundTimer)
      this.rooms.delete(room.roomCode)
      return
    }

    if (room.hostId === located.player.id) {
      const nextHost = rankPlayers(room.players)[0]
      room.hostId = nextHost.id
      room.players.forEach((candidate) => {
        candidate.isHost = candidate.id === nextHost.id
      })
      room.chatMessages.push(createSystemChat('안내', `${nextHost.nickname}님이 새 호스트가 되었습니다.`))
    }

    room.chatMessages.push(createSystemChat('안내', `${located.player.nickname}님이 방을 나갔습니다.`))
    this.emitRoom(room)
  }

  private markDisconnected(socketId: string) {
    const located = this.findPlayerBySocket(socketId)
    if (!located) {
      return
    }

    located.player.connected = false
    located.room.chatMessages.push(
      createSystemChat('안내', `${located.player.nickname}님의 연결이 끊어졌습니다.`),
    )

    if (located.room.hostId === located.player.id) {
      const fallbackHost = rankPlayers(
        located.room.players.filter((player) => player.id !== located.player.id),
      )[0]

      if (fallbackHost) {
        located.room.hostId = fallbackHost.id
        located.room.players.forEach((player) => {
          player.isHost = player.id === fallbackHost.id
        })
      }
    }

    this.emitRoom(located.room)
  }

  private resetRoomToLobby(room: RoomRecord, clearHistory: boolean) {
    clearTimeout(room.roundTimer)
    room.phase = 'lobby'
    room.activeRound = null
    room.roundHistory = clearHistory ? [] : room.roundHistory
    room.roundIndexCursor = 0
    room.players.forEach((player) => {
      player.isReady = false
      player.score = 0
    })
    room.chatMessages.push(createSystemChat('안내', '로비로 돌아왔습니다. 새 게임을 준비해 보세요.'))
    this.emitRoom(room)
  }

  private emitRoom(room: RoomRecord) {
    const players = rankPlayers(room.players).map((player) => ({
      id: player.id,
      nickname: player.nickname,
      isHost: player.isHost,
      isReady: player.isReady,
      score: player.score,
      connected: player.connected,
      joinedAt: player.joinedAt,
    }))

    room.players.forEach((recipient) => {
      const publicRoom: RoomState = {
        roomCode: room.roomCode,
        hostId: room.hostId,
        phase: room.phase,
        players,
        settings: room.settings,
        activeRound: room.activeRound
          ? buildRoundView(room.activeRound.runtime, recipient.id, room.players, room.settings)
          : null,
        roundHistory: room.roundHistory,
        chatMessages: room.chatMessages.slice(-60),
        createdAt: room.createdAt,
      }

      this.io.to(recipient.socketId).emit('room_state', publicRoom)
    })
  }

  private mergeSettings(current: GameSettings, patch: SettingsPatch): GameSettings {
    const merged: GameSettings = {
      totalRounds: patch.totalRounds ?? current.totalRounds,
      roundDuration: patch.roundDuration ?? current.roundDuration,
      resultDisplayDuration: patch.resultDisplayDuration ?? current.resultDisplayDuration,
      minigamePool:
        patch.minigamePool && patch.minigamePool.length > 0
          ? patch.minigamePool.filter((id) => !!MINIGAME_MAP[id])
          : current.minigamePool,
      scoringMode: patch.scoringMode ?? current.scoringMode,
    }

    return clampSettings(merged)
  }

  private normalizeNickname(nickname: string) {
    const trimmed = nickname.trim().slice(0, 18)
    return trimmed.length >= 2 ? trimmed : ''
  }

  private ensureUniqueNickname(room: RoomRecord, nickname: string, playerId?: string) {
    const normalized = this.normalizeNickname(nickname) || 'Player'
    const taken = new Set(
      room.players
        .filter((player) => player.id !== playerId)
        .map((player) => player.nickname.toLowerCase()),
    )

    if (!taken.has(normalized.toLowerCase())) {
      return normalized
    }

    let suffix = 2
    let candidate = `${normalized} ${suffix}`
    while (taken.has(candidate.toLowerCase())) {
      suffix += 1
      candidate = `${normalized} ${suffix}`
    }

    return candidate
  }

  private createPlayerRecord(
    nickname: string,
    sessionId: string | undefined,
    socketId: string,
    isHost: boolean,
  ): PlayerRecord {
    return {
      id: createId('player'),
      sessionId: sessionId || createId('session'),
      socketId,
      nickname,
      isHost,
      isReady: false,
      score: 0,
      connected: true,
      joinedAt: Date.now(),
    }
  }

  private findPlayerBySocket(socketId: string) {
    for (const room of this.rooms.values()) {
      const player = room.players.find((candidate) => candidate.socketId === socketId)
      if (player) {
        return { room, player }
      }
    }

    return null
  }

  private emitError(socket: GameSocket, message: string) {
    socket.emit('error_message', { message })
  }
}
