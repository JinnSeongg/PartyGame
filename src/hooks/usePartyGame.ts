import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  rankPlayers,
} from '../../shared/game'
import type {
  ClientSession,
  RoomState,
  SettingsPatch,
} from '../../shared/game'
import { socket } from '../lib/socket'

interface PartyGameState {
  room: RoomState | null
  session: ClientSession
  connectionLost: boolean
  error: string | null
}

function readStorage(): ClientSession {
  const nickname = window.localStorage.getItem(STORAGE_KEYS.nickname) ?? ''
  const sessionId = window.localStorage.getItem(STORAGE_KEYS.sessionId) ?? ''
  const roomCode = window.localStorage.getItem(STORAGE_KEYS.roomCode) ?? ''

  return {
    nickname,
    sessionId,
    roomCode,
  }
}

export function usePartyGame() {
  const [state, setState] = useState<PartyGameState>({
    room: null,
    session: readStorage(),
    connectionLost: false,
    error: null,
  })
  const reconnectAttempted = useRef(false)

  useEffect(() => {
    const handleRoomState = (room: RoomState) => {
      setState((current) => ({
        ...current,
        room,
        error: null,
      }))
    }

    const handleJoined = (payload: { sessionId: string; playerId: string; roomCode: string }) => {
      setState((current) => ({
        ...current,
        session: {
          ...current.session,
          sessionId: payload.sessionId,
          playerId: payload.playerId,
          roomCode: payload.roomCode,
        },
      }))
      window.localStorage.setItem(STORAGE_KEYS.sessionId, payload.sessionId)
      window.localStorage.setItem(STORAGE_KEYS.roomCode, payload.roomCode)
    }

    const handleError = (payload: { message: string }) => {
      setState((current) => ({ ...current, error: payload.message }))
    }

    const handleReconnectFlag = (payload: { reconnecting: boolean }) => {
      setState((current) => ({ ...current, connectionLost: payload.reconnecting }))
    }

    const handleDisconnect = () => {
      setState((current) => ({ ...current, connectionLost: true }))
    }

    const handleConnect = () => {
      setState((current) => ({ ...current, connectionLost: false }))
    }

    socket.on('room_state', handleRoomState)
    socket.on('room_joined', handleJoined)
    socket.on('error_message', handleError)
    socket.on('connection_status', handleReconnectFlag)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect', handleConnect)

    return () => {
      socket.off('room_state', handleRoomState)
      socket.off('room_joined', handleJoined)
      socket.off('error_message', handleError)
      socket.off('connection_status', handleReconnectFlag)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect', handleConnect)
    }
  }, [])

  useEffect(() => {
    if (reconnectAttempted.current) {
      return
    }

    if (!state.session.nickname || !state.session.roomCode || !state.session.sessionId) {
      return
    }

    reconnectAttempted.current = true
    socket.emit('reconnect_room', {
      nickname: state.session.nickname,
      roomCode: state.session.roomCode,
      sessionId: state.session.sessionId,
    })
  }, [state.session])

  const me = useMemo(
    () => state.room?.players.find((player) => player.id === state.session.playerId) ?? null,
    [state.room, state.session.playerId],
  )

  const rankedPlayers = useMemo(
    () => (state.room ? rankPlayers(state.room.players) : []),
    [state.room],
  )

  const canStart = Boolean(
    state.room &&
      me?.isHost &&
      state.room.phase === 'lobby' &&
      state.room.players.filter((player) => player.connected).length >= 2 &&
      state.room.players.every((player) => player.isHost || player.isReady || !player.connected),
  )

  const updateNickname = (nickname: string) => {
    setState((current) => ({
      ...current,
      session: {
        ...current.session,
        nickname,
      },
    }))
    window.localStorage.setItem(STORAGE_KEYS.nickname, nickname)
  }

  const createRoom = () => {
    socket.emit('create_room', {
      nickname: state.session.nickname,
      sessionId: state.session.sessionId,
    })
  }

  const joinRoom = (roomCode: string) => {
    socket.emit('join_room', {
      nickname: state.session.nickname,
      roomCode,
      sessionId: state.session.sessionId,
    })
  }

  const updateSettings = (patch: SettingsPatch) => {
    socket.emit('update_settings', patch)
  }

  const leaveRoom = () => {
    socket.emit('leave_room')
    window.localStorage.removeItem(STORAGE_KEYS.roomCode)
    setState((current) => ({
      ...current,
      room: null,
      session: {
        ...current.session,
        roomCode: undefined,
        playerId: undefined,
      },
    }))
  }

  const clearError = () => {
    setState((current) => ({ ...current, error: null }))
  }

  return {
    room: state.room,
    me,
    rankedPlayers,
    session: state.session,
    connectionLost: state.connectionLost,
    error: state.error,
    defaultSettings: DEFAULT_SETTINGS,
    canStart,
    updateNickname,
    clearError,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady: () => socket.emit('toggle_ready'),
    updateSettings,
    sendChat: (message: string) => socket.emit('send_chat', { message }),
    startGame: () => socket.emit('start_game'),
    submitAction: (values: Record<string, string>) => socket.emit('submit_action', { values }),
    restartGame: () => socket.emit('restart_game'),
    returnToLobby: () => socket.emit('return_to_lobby'),
  }
}
