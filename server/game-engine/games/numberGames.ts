import type { PlayerSummary } from '../../../shared/game.js'
import type { GameDefinition } from '../types.js'
import {
  buildResultBundle,
  choiceControl,
  createView,
  numberControl,
  parseInteger,
  randomInt,
  recordSubmission,
  runtimeBase,
} from '../utils.js'

export const numberGames: Record<string, GameDefinition> = {
  'greed-control': {
    id: 'greed-control',
    create(_players, settings, roundNumber) {
      const runtime = runtimeBase('greed-control', roundNumber, settings.roundDuration)
      runtime.instructions = ['1부터 100 사이 정수를 제출하세요.']
      runtime.controls = [numberControl('number', '제출 숫자', 1, 100)]
      return runtime
    },
    buildView(runtime, playerId) {
      return createView(runtime, playerId, runtime.controls, runtime.instructions, [])
    },
    submit(runtime, playerId, values, _players, _settings, receivedAt) {
      const number = parseInteger(values.number)
      if (number === null || number < 1 || number > 100) {
        return
      }

      recordSubmission(runtime, playerId, { number: String(number) }, receivedAt)
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}
      const submitted = players
        .map((player) => ({
          player,
          number: parseInteger(runtime.submissions.get(player.id)?.values.number) ?? null,
        }))
        .filter((entry) => entry.number !== null) as Array<{ player: PlayerSummary; number: number }>

      players.forEach((player) => {
        deltas[player.id] = 0
        details[player.id] = '기권'
        summaries[player.id] = runtime.submissions.has(player.id)
          ? runtime.submissions.get(player.id)?.values.number ?? null
          : null
      })

      submitted.forEach((entry) => {
        details[entry.player.id] = `${entry.number} 제출`
      })

      const highest = Math.max(-Infinity, ...submitted.map((entry) => entry.number))
      const highestPlayers = submitted.filter((entry) => entry.number === highest)

      if (highestPlayers.length === 1) {
        deltas[highestPlayers[0].player.id] -= 2
      } else if (highestPlayers.length > 1) {
        highestPlayers.forEach((entry) => {
          deltas[entry.player.id] -= 1
        })
      }

      const remaining = submitted.filter((entry) => entry.number !== highest)
      if (remaining.length > 0) {
        const second = Math.max(...remaining.map((entry) => entry.number))
        const secondPlayers = remaining.filter((entry) => entry.number === second)
        secondPlayers.forEach((entry) => {
          deltas[entry.player.id] += secondPlayers.length === 1 ? 3 : 2
        })
      }

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '그리드 컨트롤 결과',
      })
    },
  },
  'treasure-box': {
    id: 'treasure-box',
    create(_players, settings, roundNumber) {
      const runtime = runtimeBase('treasure-box', roundNumber, settings.roundDuration)
      runtime.instructions = ['1번, 2번, 3번 상자 중 하나를 선택하세요.']
      runtime.controls = [choiceControl('box', '상자 선택', ['1', '2', '3'])]
      runtime.state.answer = String(randomInt(1, 3))
      return runtime
    },
    buildView(runtime, playerId) {
      return createView(runtime, playerId, runtime.controls, runtime.instructions, [])
    },
    submit(runtime, playerId, values, _players, _settings, receivedAt) {
      if (!['1', '2', '3'].includes(values.box)) {
        return
      }

      recordSubmission(runtime, playerId, { box: values.box }, receivedAt)
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      const answer = String(runtime.state.answer)
      const winners = players.filter((player) => runtime.submissions.get(player.id)?.values.box === answer)
      const winScore = winners.length === 1 ? 3 : winners.length === 2 ? 2 : winners.length >= 3 ? 1 : 0
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}

      players.forEach((player) => {
        const pick = runtime.submissions.get(player.id)?.values.box
        deltas[player.id] = winners.some((winner) => winner.id === player.id) ? winScore : 0
        summaries[player.id] = pick ? `${pick}번 상자` : null
        details[player.id] = pick ? `정답 상자: ${answer}번` : '기권'
      })

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '보물 상자 결과',
      })
    },
  },
  'unique-number': {
    id: 'unique-number',
    create(players, settings, roundNumber) {
      const runtime = runtimeBase('unique-number', roundNumber, settings.roundDuration)
      runtime.instructions = [`1부터 ${players.length * 2} 사이 정수를 제출하세요.`]
      runtime.controls = [numberControl('number', '제출 숫자', 1, players.length * 2)]
      return runtime
    },
    buildView(runtime, playerId) {
      return createView(runtime, playerId, runtime.controls, runtime.instructions, [])
    },
    submit(runtime, playerId, values, players, _settings, receivedAt) {
      const number = parseInteger(values.number)
      if (number === null || number < 1 || number > players.length * 2) {
        return
      }

      recordSubmission(runtime, playerId, { number: String(number) }, receivedAt)
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      const counts: Record<string, number> = {}
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}

      players.forEach((player) => {
        const value = runtime.submissions.get(player.id)?.values.number ?? null
        summaries[player.id] = value
        details[player.id] = value ? `${value} 제출` : '기권'
        deltas[player.id] = 0
        if (value) {
          counts[value] = (counts[value] ?? 0) + 1
        }
      })

      const uniqueValues = Object.entries(counts)
        .filter(([, count]) => count === 1)
        .map(([value]) => Number(value))
      const highestUniqueValue = uniqueValues.length > 0 ? Math.max(...uniqueValues) : null

      if (highestUniqueValue !== null) {
        players.forEach((player) => {
          const value = runtime.submissions.get(player.id)?.values.number
          if (Number(value) === highestUniqueValue) {
            deltas[player.id] = Math.floor(highestUniqueValue / 2)
          }
        })
      }

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '유일 숫자 결과',
      })
    },
  },
  average: {
    id: 'average',
    create(_players, settings, roundNumber) {
      const runtime = runtimeBase('average', roundNumber, settings.roundDuration)
      runtime.instructions = ['-100부터 100 사이 정수를 제출하세요.']
      runtime.controls = [numberControl('number', '제출 숫자', -100, 100)]
      return runtime
    },
    buildView(runtime, playerId) {
      return createView(runtime, playerId, runtime.controls, runtime.instructions, [])
    },
    submit(runtime, playerId, values, _players, _settings, receivedAt) {
      const number = parseInteger(values.number)
      if (number === null || number < -100 || number > 100) {
        return
      }

      recordSubmission(runtime, playerId, { number: String(number) }, receivedAt)
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      const submitted = players
        .map((player) => ({
          player,
          number: parseInteger(runtime.submissions.get(player.id)?.values.number),
        }))
        .filter((entry) => entry.number !== null) as Array<{ player: PlayerSummary; number: number }>

      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}

      players.forEach((player) => {
        deltas[player.id] = 0
        summaries[player.id] = runtime.submissions.get(player.id)?.values.number ?? null
        details[player.id] = summaries[player.id] ? `${summaries[player.id]} 제출` : '기권'
      })

      if (submitted.length > 0) {
        const averageValue = submitted.reduce((sum, entry) => sum + entry.number, 0) / submitted.length
        const distances = submitted.map((entry) => ({
          playerId: entry.player.id,
          distance: Math.abs(entry.number - averageValue),
          exact: entry.number === averageValue,
        }))
        const bestDistance = Math.min(...distances.map((entry) => entry.distance))
        const closest = distances.filter((entry) => entry.distance === bestDistance)

        if (closest.length === 1) {
          deltas[closest[0].playerId] += 3
        } else {
          closest.forEach((entry) => {
            deltas[entry.playerId] += 1
          })
        }

        distances.filter((entry) => entry.exact).forEach((entry) => {
          deltas[entry.playerId] += 1
        })

        players.forEach((player) => {
          details[player.id] = `${details[player.id]} / 평균 ${averageValue.toFixed(2)}`
        })
      }

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '평균 게임 결과',
      })
    },
  },
  'odd-even': {
    id: 'odd-even',
    create(_players, settings, roundNumber) {
      const runtime = runtimeBase('odd-even', roundNumber, settings.roundDuration)
      runtime.instructions = ['숫자를 제출하고 총합의 홀짝을 예측하세요.']
      runtime.controls = [
        numberControl('number', '제출 숫자', -100, 100),
        choiceControl('prediction', '홀짝 예측', ['홀', '짝']),
      ]
      return runtime
    },
    buildView(runtime, playerId) {
      return createView(runtime, playerId, runtime.controls, runtime.instructions, [])
    },
    submit(runtime, playerId, values, _players, _settings, receivedAt) {
      const number = parseInteger(values.number)
      if (number === null || number < -100 || number > 100 || !['홀', '짝'].includes(values.prediction)) {
        return
      }

      recordSubmission(runtime, playerId, { number: String(number), prediction: values.prediction }, receivedAt)
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}
      const numbers = players.map((player) => ({
        player,
        number: parseInteger(runtime.submissions.get(player.id)?.values.number) ?? 0,
      }))
      const total = numbers.reduce((sum, entry) => sum + entry.number, 0)
      const actual = Math.abs(total % 2) === 0 ? '짝' : '홀'

      players.forEach((player) => {
        const submission = runtime.submissions.get(player.id)
        deltas[player.id] = 0
        summaries[player.id] = submission
          ? `${submission.values.number} / ${submission.values.prediction}`
          : null
        details[player.id] = submission ? `합계 ${total} (${actual})` : '기권'

        if (submission?.values.prediction === actual) {
          deltas[player.id] += 2
        }
      })

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '홀짝 결과',
      })
    },
  },
  'random-number': {
    id: 'random-number',
    create(_players, settings, roundNumber) {
      const runtime = runtimeBase('random-number', roundNumber, settings.roundDuration)
      runtime.instructions = ['0부터 100 사이 숫자를 제출하세요.']
      runtime.controls = [numberControl('number', '제출 숫자', 0, 100)]
      runtime.state.answer = randomInt(0, 100)
      return runtime
    },
    buildView(runtime, playerId) {
      return createView(runtime, playerId, runtime.controls, runtime.instructions, [])
    },
    submit(runtime, playerId, values, _players, _settings, receivedAt) {
      const number = parseInteger(values.number)
      if (number === null || number < 0 || number > 100) {
        return
      }

      recordSubmission(runtime, playerId, { number: String(number) }, receivedAt)
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      const answer = Number(runtime.state.answer)
      const distances = players.map((player) => {
        const number = parseInteger(runtime.submissions.get(player.id)?.values.number)
        return {
          player,
          number,
          distance: number === null ? Infinity : Math.abs(number - answer),
        }
      })
      const bestDistance = Math.min(...distances.map((entry) => entry.distance))
      const closestIds = distances.filter((entry) => entry.distance === bestDistance).map((entry) => entry.player.id)
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}

      distances.forEach((entry) => {
        deltas[entry.player.id] = 0
        summaries[entry.player.id] = entry.number !== null ? String(entry.number) : null
        details[entry.player.id] = entry.number === null ? '기권' : `정답 ${answer}`

        if (entry.number === answer) {
          deltas[entry.player.id] = 5
        } else if (closestIds.includes(entry.player.id)) {
          deltas[entry.player.id] = 2
        }
      })

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '랜덤 번호 결과',
      })
    },
  },
  'secret-auction': {
    id: 'secret-auction',
    create(_players, settings, roundNumber) {
      const runtime = runtimeBase('secret-auction', roundNumber, settings.roundDuration)
      runtime.instructions = ['0부터 100 사이 숫자를 비밀 입찰하세요.']
      runtime.controls = [numberControl('number', '입찰 숫자', 0, 100)]
      return runtime
    },
    buildView(runtime, playerId) {
      return createView(runtime, playerId, runtime.controls, runtime.instructions, [])
    },
    submit(runtime, playerId, values, _players, _settings, receivedAt) {
      const number = parseInteger(values.number)
      if (number === null || number < 0 || number > 100) {
        return
      }

      recordSubmission(runtime, playerId, { number: String(number) }, receivedAt)
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      const bids = players
        .map((player) => ({
          player,
          bid: parseInteger(runtime.submissions.get(player.id)?.values.number),
        }))
        .filter((entry) => entry.bid !== null) as Array<{ player: PlayerSummary; bid: number }>

      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}

      players.forEach((player) => {
        deltas[player.id] = 0
        summaries[player.id] = runtime.submissions.get(player.id)?.values.number ?? null
        details[player.id] = summaries[player.id] ? `${summaries[player.id]} 입찰` : '기권'
      })

      if (bids.length > 0) {
        const highest = Math.max(...bids.map((entry) => entry.bid))
        const highestPlayers = bids.filter((entry) => entry.bid === highest)

        if (highestPlayers.length === 1) {
          deltas[highestPlayers[0].player.id] = 3
        } else {
          highestPlayers.forEach((entry) => {
            deltas[entry.player.id] = -1
          })
        }
      }

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '비밀 경매 결과',
      })
    },
  },
}
