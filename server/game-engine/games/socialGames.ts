import type { GameDefinition } from '../types.js'
import {
  buildResultBundle,
  choiceControl,
  createView,
  customChoiceControl,
  playerOptions,
  randomPick,
  recordSubmission,
  runtimeBase,
} from '../utils.js'

const trackerChoiceSets = [
  ['A', 'B'],
  ['홀', '짝'],
  ['빨강', '파랑'],
]

export const socialGames: Record<string, GameDefinition> = {
  bounty: {
    id: 'bounty',
    create(players, settings, roundNumber) {
      const runtime = runtimeBase('bounty', roundNumber, settings.roundDuration)
      runtime.instructions = ['다른 플레이어 한 명을 지목하세요.', '자기 자신은 선택할 수 없습니다.']
      return runtime
    },
    buildView(runtime, playerId, players) {
      const counts: Record<string, number> = {}
      for (const submission of runtime.submissions.values()) {
        const target = submission.values.target
        if (target) {
          counts[target] = (counts[target] ?? 0) + 1
        }
      }

      const topCount = Math.max(0, ...Object.values(counts))
      const leaders =
        topCount > 0
          ? players.filter((player) => counts[player.id] === topCount).map((player) => player.nickname)
          : []

      return createView(
        runtime,
        playerId,
        [customChoiceControl('target', '지목할 플레이어', playerOptions(players, playerId))],
        runtime.instructions,
        [
          { label: '현재 최다 지목', value: leaders.length > 0 ? leaders.join(', ') : '아직 없음' },
          { label: '최다 지목 수', value: topCount > 0 ? `${topCount}표` : '0표' },
        ],
      )
    },
    submit(runtime, playerId, values, players, _settings, receivedAt) {
      const target = values.target
      if (!players.some((player) => player.id === target && player.id !== playerId)) {
        return
      }

      recordSubmission(runtime, playerId, { target }, receivedAt)
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      const voteMap: Record<string, string[]> = {}
      const summaries: Record<string, string | null> = {}
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}

      players.forEach((player) => {
        deltas[player.id] = 0
        summaries[player.id] = null
        details[player.id] = '기권'
      })

      for (const [playerId, submission] of runtime.submissions.entries()) {
        const target = submission.values.target
        voteMap[target] = [...(voteMap[target] ?? []), playerId]
        const targetName = players.find((player) => player.id === target)?.nickname ?? '알 수 없음'
        summaries[playerId] = `지목: ${targetName}`
        details[playerId] = `${targetName} 지목`
      }

      const voteCounts = Object.entries(voteMap).map(([targetId, selectors]) => ({
        targetId,
        count: selectors.length,
      }))
      const maxCount = Math.max(0, ...voteCounts.map((entry) => entry.count))
      const topTargets =
        maxCount > 0
          ? voteCounts.filter((entry) => entry.count === maxCount).map((entry) => entry.targetId)
          : []
      const distinctCounts = [...new Set(voteCounts.map((entry) => entry.count).filter((count) => count > 0))].sort(
        (left, right) => right - left,
      )
      const secondCount = distinctCounts[1] ?? null
      const secondTargets =
        secondCount === null
          ? []
          : voteCounts.filter((entry) => entry.count === secondCount).map((entry) => entry.targetId)

      topTargets.forEach((targetId) => {
        deltas[targetId] = (deltas[targetId] ?? 0) + 1
      })

      for (const [targetId, selectors] of Object.entries(voteMap)) {
        if (!secondTargets.includes(targetId)) {
          continue
        }

        selectors.forEach((selectorId) => {
          deltas[selectorId] += 2
        })
      }

      players.forEach((player) => {
        if (topTargets.includes(player.id)) {
          details[player.id] =
            details[player.id] === '기권'
              ? '최다 지목 대상'
              : `${details[player.id]} / 최다 지목 대상`
        }
      })

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '현상금 결과',
      })
    },
  },
  minority: {
    id: 'minority',
    create(_players, settings, roundNumber) {
      const runtime = runtimeBase('minority', roundNumber, settings.roundDuration)
      runtime.instructions = ['A 또는 B 중 하나를 선택하세요.']
      runtime.controls = [choiceControl('side', '선택', ['A', 'B'])]
      return runtime
    },
    buildView(runtime, playerId) {
      return createView(runtime, playerId, runtime.controls, runtime.instructions, [])
    },
    submit(runtime, playerId, values, _players, _settings, receivedAt) {
      if (!['A', 'B'].includes(values.side)) {
        return
      }

      recordSubmission(runtime, playerId, { side: values.side }, receivedAt)
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      const counts = { A: 0, B: 0 }
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}

      players.forEach((player) => {
        deltas[player.id] = 0
        const pick = runtime.submissions.get(player.id)?.values.side
        summaries[player.id] = pick ?? null
        details[player.id] = pick ? `${pick} 선택` : '기권'
        if (pick === 'A' || pick === 'B') {
          counts[pick] += 1
        }
      })

      if (counts.A !== counts.B) {
        const minoritySide = counts.A < counts.B ? 'A' : 'B'
        const minorityCount = counts[minoritySide]
        players.forEach((player) => {
          if (runtime.submissions.get(player.id)?.values.side === minoritySide) {
            deltas[player.id] += 3
            if (minorityCount === 1) {
              deltas[player.id] += 1
            }
          }
        })
      }

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '소수 선택 결과',
      })
    },
  },
  tracker: {
    id: 'tracker',
    create(players, settings, roundNumber) {
      const runtime = runtimeBase('tracker', roundNumber, settings.roundDuration)
      const assignments: Record<string, string> = {}
      const options = randomPick(trackerChoiceSets)

      players.forEach((player) => {
        const candidates = players.filter((candidate) => candidate.id !== player.id)
        assignments[player.id] = randomPick(candidates).id
      })

      runtime.state.targets = assignments
      runtime.state.options = options
      runtime.instructions = [
        '공통 선택지 중 하나를 고르세요.',
        '당신의 목표 플레이어와 같은 선택을 하면 점수를 얻습니다.',
      ]
      return runtime
    },
    buildView(runtime, playerId, players) {
      const targetId = (runtime.state.targets as Record<string, string>)[playerId]
      const targetName = players.find((player) => player.id === targetId)?.nickname ?? '알 수 없음'
      const options = runtime.state.options as string[]

      return createView(
        runtime,
        playerId,
        [choiceControl('choice', '선택', options)],
        runtime.instructions,
        [],
        `당신의 목표는 ${targetName}입니다.`,
      )
    },
    submit(runtime, playerId, values, _players, _settings, receivedAt) {
      const options = runtime.state.options as string[]
      if (!options.includes(values.choice)) {
        return
      }

      recordSubmission(runtime, playerId, { choice: values.choice }, receivedAt)
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      const targets = runtime.state.targets as Record<string, string>
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}

      players.forEach((player) => {
        const choice = runtime.submissions.get(player.id)?.values.choice ?? null
        const targetId = targets[player.id]
        const targetChoice = runtime.submissions.get(targetId)?.values.choice ?? null
        deltas[player.id] = choice && targetChoice && choice === targetChoice ? 2 : 0
        summaries[player.id] = choice
        details[player.id] = choice
          ? `목표와 ${choice === targetChoice ? '같은' : '다른'} 선택`
          : '기권'
      })

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '추적자 결과',
      })
    },
  },
  'faction-war': {
    id: 'faction-war',
    create(_players, settings, roundNumber) {
      const runtime = runtimeBase('faction-war', roundNumber, settings.roundDuration)
      runtime.instructions = ['빨강과 파랑 중 하나를 선택하세요.']
      runtime.controls = [choiceControl('team', '진영 선택', ['빨강', '파랑'])]
      return runtime
    },
    buildView(runtime, playerId) {
      return createView(runtime, playerId, runtime.controls, runtime.instructions, [])
    },
    submit(runtime, playerId, values, _players, _settings, receivedAt) {
      if (!['빨강', '파랑'].includes(values.team)) {
        return
      }

      recordSubmission(runtime, playerId, { team: values.team }, receivedAt)
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      const red = players.filter((player) => runtime.submissions.get(player.id)?.values.team === '빨강')
      const blue = players.filter((player) => runtime.submissions.get(player.id)?.values.team === '파랑')
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}

      players.forEach((player) => {
        const team = runtime.submissions.get(player.id)?.values.team ?? null
        deltas[player.id] = 0
        summaries[player.id] = team
        details[player.id] = team ?? '기권'
      })

      if (red.length === blue.length) {
        players.forEach((player) => {
          deltas[player.id] = 1
        })
      } else {
        const winningTeam = red.length > blue.length ? '빨강' : '파랑'
        const margin = Math.abs(red.length - blue.length)
        players.forEach((player) => {
          if (runtime.submissions.get(player.id)?.values.team === winningTeam) {
            deltas[player.id] = margin === 1 ? 2 : 1
          }
        })
      }

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '진영전 결과',
      })
    },
  },
  smuggler: {
    id: 'smuggler',
    create(players, settings, roundNumber) {
      const runtime = runtimeBase('smuggler', roundNumber, settings.roundDuration)
      const smuggler = randomPick(players)
      runtime.state.smugglerIds = [smuggler.id]
      runtime.instructions = [
        '시민 또는 밀수꾼 중 하나를 공개 선언하세요.',
        '의심되는 플레이어를 지목하거나 기권할 수 있습니다.',
      ]
      return runtime
    },
    buildView(runtime, playerId, players) {
      const smugglers = runtime.state.smugglerIds as string[]
      const isSmuggler = smugglers.includes(playerId)

      return createView(
        runtime,
        playerId,
        [
          choiceControl('declaration', '공개 선언', ['시민', '밀수꾼']),
          customChoiceControl('suspect', '의심 플레이어', playerOptions(players, playerId, true)),
        ],
        runtime.instructions,
        [],
        isSmuggler ? '당신은 밀수꾼입니다.' : '당신은 시민입니다.',
      )
    },
    submit(runtime, playerId, values, players, _settings, receivedAt) {
      const validSuspect =
        values.suspect === 'skip' ||
        players.some((player) => player.id === values.suspect && player.id !== playerId)

      if (!['시민', '밀수꾼'].includes(values.declaration) || !validSuspect) {
        return
      }

      recordSubmission(
        runtime,
        playerId,
        { declaration: values.declaration, suspect: values.suspect },
        receivedAt,
      )
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      const smugglers = new Set(runtime.state.smugglerIds as string[])
      const suspectCounts: Record<string, number> = {}
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}

      players.forEach((player) => {
        deltas[player.id] = 0
        const submission = runtime.submissions.get(player.id)
        summaries[player.id] = submission
          ? `${submission.values.declaration} / ${
              submission.values.suspect === 'skip'
                ? '기권'
                : players.find((entry) => entry.id === submission.values.suspect)?.nickname ?? '기권'
            }`
          : null
        details[player.id] = submission ? '선언 완료' : '기권'
        if (submission && submission.values.suspect !== 'skip') {
          suspectCounts[submission.values.suspect] = (suspectCounts[submission.values.suspect] ?? 0) + 1
        }
      })

      players.forEach((player) => {
        const submission = runtime.submissions.get(player.id)

        if (smugglers.has(player.id)) {
          deltas[player.id] = (suspectCounts[player.id] ?? 0) === 0 ? 3 : -1
          details[player.id] =
            (suspectCounts[player.id] ?? 0) === 0 ? '정체를 숨기는 데 성공했습니다.' : '누군가에게 지목당했습니다.'
          return
        }

        if (!submission || submission.values.suspect === 'skip') {
          deltas[player.id] = 0
          details[player.id] = '기권'
          return
        }

        deltas[player.id] = smugglers.has(submission.values.suspect) ? 2 : -1
        details[player.id] = smugglers.has(submission.values.suspect)
          ? '밀수꾼 지목 성공'
          : '시민을 잘못 지목했습니다.'
      })

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '밀수꾼 결과',
      })
    },
  },
}
