import type { GameDefinition } from '../types.js'
import { buildResultBundle, choiceControl, createView, recordSubmission, runtimeBase } from '../utils.js'

export const decisionGames: Record<string, GameDefinition> = {
  'cooperate-betray': {
    id: 'cooperate-betray',
    create(_players, settings, roundNumber) {
      const runtime = runtimeBase('cooperate-betray', roundNumber, settings.roundDuration)
      runtime.instructions = ['협력 또는 배신 중 하나를 선택하세요.']
      runtime.controls = [choiceControl('choice', '선택', ['협력', '배신'])]
      return runtime
    },
    buildView(runtime, playerId) {
      return createView(runtime, playerId, runtime.controls, runtime.instructions, [])
    },
    submit(runtime, playerId, values, _players, _settings, receivedAt) {
      if (!['협력', '배신'].includes(values.choice)) {
        return
      }

      recordSubmission(runtime, playerId, { choice: values.choice }, receivedAt)
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      let coop = 0
      let betray = 0
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}

      players.forEach((player) => {
        const choice = runtime.submissions.get(player.id)?.values.choice
        summaries[player.id] = choice ?? null
        details[player.id] = choice ?? '기권'
        deltas[player.id] = 0
        if (choice === '협력') {
          coop += 1
        }
        if (choice === '배신') {
          betray += 1
        }
      })

      players.forEach((player) => {
        const choice = runtime.submissions.get(player.id)?.values.choice
        if (!choice) {
          return
        }

        if (coop === players.length && betray === 0) {
          deltas[player.id] = 2
          return
        }

        if (coop > betray) {
          deltas[player.id] = choice === '협력' ? 1 : 3
          return
        }

        if (betray > coop) {
          deltas[player.id] = choice === '협력' ? 0 : -1
          return
        }

        deltas[player.id] = 0
      })

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '협력/배신 결과',
      })
    },
  },
  crown: {
    id: 'crown',
    create(_players, settings, roundNumber) {
      const runtime = runtimeBase('crown', roundNumber, settings.roundDuration)
      runtime.instructions = ['획득 또는 포기 중 하나를 선택하세요.']
      runtime.controls = [choiceControl('choice', '선택', ['획득', '포기'])]
      return runtime
    },
    buildView(runtime, playerId) {
      return createView(runtime, playerId, runtime.controls, runtime.instructions, [])
    },
    submit(runtime, playerId, values, _players, _settings, receivedAt) {
      if (!['획득', '포기'].includes(values.choice)) {
        return
      }

      recordSubmission(runtime, playerId, { choice: values.choice }, receivedAt)
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      const claimers = players.filter((player) => runtime.submissions.get(player.id)?.values.choice === '획득')
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}

      players.forEach((player) => {
        const choice = runtime.submissions.get(player.id)?.values.choice ?? null
        summaries[player.id] = choice
        details[player.id] = choice ?? '기권'
        deltas[player.id] = 0
      })

      if (claimers.length === 1) {
        deltas[claimers[0].id] = 4
      } else if (claimers.length >= 2) {
        claimers.forEach((player) => {
          deltas[player.id] = -2
        })
      }

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '왕관 결과',
      })
    },
  },
  silence: {
    id: 'silence',
    create(_players, settings, roundNumber) {
      const runtime = runtimeBase('silence', roundNumber, settings.roundDuration)
      runtime.instructions = ['말하기 또는 침묵 중 하나를 선택하세요.']
      runtime.controls = [choiceControl('choice', '선택', ['말하기', '침묵'])]
      return runtime
    },
    buildView(runtime, playerId) {
      return createView(runtime, playerId, runtime.controls, runtime.instructions, [])
    },
    submit(runtime, playerId, values, _players, _settings, receivedAt) {
      if (!['말하기', '침묵'].includes(values.choice)) {
        return
      }

      recordSubmission(runtime, playerId, { choice: values.choice }, receivedAt)
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      const silenceCount = players.filter((player) => runtime.submissions.get(player.id)?.values.choice === '침묵').length
      const threshold = players.length / 2
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}

      players.forEach((player) => {
        const choice = runtime.submissions.get(player.id)?.values.choice ?? null
        summaries[player.id] = choice
        details[player.id] = choice ?? '기권'
        deltas[player.id] = 0
        if (!choice) {
          return
        }

        if (silenceCount < threshold) {
          deltas[player.id] = choice === '침묵' ? 3 : 0
        } else {
          deltas[player.id] = choice === '침묵' ? -1 : 1
        }
      })

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '침묵 결과',
      })
    },
  },
  'trade-offer': {
    id: 'trade-offer',
    create(players, settings, roundNumber) {
      const runtime = runtimeBase('trade-offer', roundNumber, settings.roundDuration)
      const shuffled = [...players].sort(() => Math.random() - 0.5)
      const pairs: string[][] = []
      for (let index = 0; index < shuffled.length; index += 2) {
        pairs.push(shuffled.slice(index, index + 2).map((player) => player.id))
      }
      runtime.state.pairs = pairs
      runtime.instructions = ['짝과 협력 또는 배신 중 하나를 선택하세요.']
      return runtime
    },
    buildView(runtime, playerId, players) {
      const pairs = runtime.state.pairs as string[][]
      const pair = pairs.find((entry) => entry.includes(playerId)) ?? []
      const partnerId = pair.find((entry) => entry !== playerId)
      const partnerName = players.find((player) => player.id === partnerId)?.nickname ?? '대기'
      return createView(
        runtime,
        playerId,
        partnerId ? [choiceControl('choice', '선택', ['협력', '배신'])] : [],
        runtime.instructions,
        [],
        partnerId ? `이번 거래 상대는 ${partnerName}입니다.` : '이번 라운드에는 짝이 없어 자동 대기합니다.',
      )
    },
    submit(runtime, playerId, values, _players, _settings, receivedAt) {
      if (!['협력', '배신'].includes(values.choice)) {
        return
      }

      recordSubmission(runtime, playerId, { choice: values.choice }, receivedAt)
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      const pairs = runtime.state.pairs as string[][]
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}

      players.forEach((player) => {
        deltas[player.id] = 0
        summaries[player.id] = runtime.submissions.get(player.id)?.values.choice ?? null
        details[player.id] = summaries[player.id] ?? '대기'
      })

      pairs.forEach((pair) => {
        if (pair.length < 2) {
          if (pair[0]) {
            details[pair[0]] = '상대 없음'
          }
          return
        }

        const [leftId, rightId] = pair
        const leftChoice = runtime.submissions.get(leftId)?.values.choice ?? '협력'
        const rightChoice = runtime.submissions.get(rightId)?.values.choice ?? '협력'

        if (leftChoice === '협력' && rightChoice === '협력') {
          deltas[leftId] = 2
          deltas[rightId] = 2
        } else if (leftChoice === '협력' && rightChoice === '배신') {
          deltas[rightId] = 3
          deltas[leftId] = -1
        } else if (leftChoice === '배신' && rightChoice === '협력') {
          deltas[leftId] = 3
          deltas[rightId] = -1
        } else {
          deltas[leftId] = -1
          deltas[rightId] = -1
        }
      })

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '거래 제안 결과',
      })
    },
  },
}
