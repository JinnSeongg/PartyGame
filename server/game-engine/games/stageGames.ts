import type { GameDefinition } from '../types.js'
import {
  buildResultBundle,
  buttonOrder,
  choiceControl,
  createView,
  customChoiceControl,
  randomPick,
  recordSubmission,
  runtimeBase,
  submittedPlayerIds,
} from '../utils.js'

const memorySeeds = [
  {
    lines: ['색상: 빨강, 파랑, 초록', '숫자: 4, 8, 1', '아이콘: 별, 달, 태양'],
    questions: [
      { id: 'q1', label: '기억한 숫자 중 가운데 숫자는?', options: ['1', '4', '8', '9'], answer: '8' },
      { id: 'q2', label: '기억한 아이콘에 없던 것은?', options: ['별', '달', '태양', '종'], answer: '종' },
    ],
  },
  {
    lines: ['색상: 노랑, 보라, 검정', '숫자: 2, 6, 9', '아이콘: 하트, 구름, 번개'],
    questions: [
      { id: 'q1', label: '기억한 색상에 없던 것은?', options: ['노랑', '보라', '검정', '하양'], answer: '하양' },
      { id: 'q2', label: '가장 큰 숫자는?', options: ['2', '5', '6', '9'], answer: '9' },
    ],
  },
]

export const stageGames: Record<string, GameDefinition> = {
  'button-game': {
    id: 'button-game',
    create(_players, settings, roundNumber) {
      const runtime = runtimeBase('button-game', roundNumber, settings.roundDuration)
      runtime.instructions = [
        '원하는 시점에 버튼을 한 번만 누를 수 있습니다.',
        '버튼을 누르면 취소할 수 없습니다.',
      ]
      runtime.controls = [choiceControl('press', '버튼', ['누르기'])]
      return runtime
    },
    buildView(runtime, playerId) {
      return createView(
        runtime,
        playerId,
        runtime.submissions.has(playerId) ? [] : runtime.controls,
        runtime.instructions,
        [{ label: '현재 버튼 입력 수', value: `${submittedPlayerIds(runtime).size}명` }],
      )
    },
    submit(runtime, playerId, values, _players, _settings, receivedAt) {
      if (runtime.submissions.has(playerId) || values.press !== '누르기') {
        return
      }

      recordSubmission(runtime, playerId, { press: 'button' }, receivedAt)
    },
    onTimeout() {
      return 'finish'
    },
    buildResults(runtime, players) {
      const ordered = buttonOrder(runtime)
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}

      players.forEach((player) => {
        deltas[player.id] = 0
        summaries[player.id] = runtime.submissions.has(player.id) ? '버튼 클릭' : null
        details[player.id] = runtime.submissions.has(player.id) ? '버튼을 눌렀습니다.' : '누르지 않았습니다.'
      })

      ordered.forEach(([playerId], index) => {
        if (ordered.length === 1) {
          deltas[playerId] = 4
        } else if (index === 0) {
          deltas[playerId] = 0
        } else if (index === ordered.length - 1) {
          deltas[playerId] = 4
        } else {
          deltas[playerId] = 1
        }
      })

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '버튼 게임 결과',
      })
    },
  },
  'memory-test': {
    id: 'memory-test',
    create(_players, settings, roundNumber) {
      const runtime = runtimeBase('memory-test', roundNumber, Math.max(4, Math.floor(settings.roundDuration / 3)))
      const seed = randomPick(memorySeeds)
      runtime.state.seed = seed
      runtime.stageKey = 'memorize'
      runtime.stageLabel = '기억 단계'
      runtime.stageIndex = 1
      runtime.stageCount = 2
      runtime.instructions = ['아래 정보를 짧은 시간 동안 기억하세요.']
      runtime.publicInfo = seed.lines.map((line, index) => ({ label: `정보 ${index + 1}`, value: line }))
      return runtime
    },
    buildView(runtime, playerId) {
      if (runtime.stageKey === 'memorize') {
        return createView(runtime, playerId, [], runtime.instructions, runtime.publicInfo)
      }

      return createView(runtime, playerId, runtime.controls, runtime.instructions, runtime.publicInfo)
    },
    submit(runtime, playerId, values, _players, _settings, receivedAt) {
      if (runtime.stageKey !== 'quiz') {
        return
      }

      recordSubmission(runtime, playerId, values, receivedAt)
    },
    onTimeout(runtime, _players, settings) {
      if (runtime.stageKey === 'memorize') {
        const seed = runtime.state.seed as typeof memorySeeds[number]
        runtime.stageKey = 'quiz'
        runtime.stageLabel = '문제 단계'
        runtime.stageIndex = 2
        runtime.instructions = ['기억한 내용을 바탕으로 문제를 풀어보세요.']
        runtime.controls = seed.questions.map((question) =>
          customChoiceControl(
            question.id,
            question.label,
            question.options.map((option) => ({ value: option, label: option })),
          ),
        )
        runtime.publicInfo = []
        runtime.durationSeconds = settings.roundDuration
        runtime.submissions = new Map()
        return 'next'
      }

      return 'finish'
    },
    buildResults(runtime, players) {
      const seed = runtime.state.seed as typeof memorySeeds[number]
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}

      players.forEach((player) => {
        const submission = runtime.submissions.get(player.id)?.values ?? null
        deltas[player.id] = 0
        summaries[player.id] = submission ? Object.values(submission).join(' / ') : null
        details[player.id] = submission ? '답안 제출' : '기권'
        if (!submission) {
          return
        }

        let correct = 0
        seed.questions.forEach((question) => {
          if (submission[question.id] === question.answer) {
            correct += 1
          }
        })

        deltas[player.id] = correct
        if (correct === seed.questions.length) {
          deltas[player.id] += 2
        }
        details[player.id] = `${correct}문항 정답`
      })

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '기억 테스트 결과',
      })
    },
  },
  'secret-team': {
    id: 'secret-team',
    create(_players, settings, roundNumber) {
      const runtime = runtimeBase('secret-team', roundNumber, Math.max(5, Math.floor(settings.roundDuration / 2)))
      runtime.stageKey = 'team-select'
      runtime.stageLabel = '팀 선택'
      runtime.stageIndex = 1
      runtime.stageCount = 2
      runtime.instructions = ['공개적으로 A 또는 B 팀을 선택하세요.']
      runtime.controls = [choiceControl('team', '팀 선택', ['A', 'B'])]
      return runtime
    },
    buildView(runtime, playerId) {
      return createView(runtime, playerId, runtime.controls, runtime.instructions, runtime.publicInfo)
    },
    submit(runtime, playerId, values, _players, _settings, receivedAt) {
      if (runtime.stageKey === 'team-select' && ['A', 'B'].includes(values.team)) {
        recordSubmission(runtime, playerId, { team: values.team }, receivedAt)
        return
      }

      if (runtime.stageKey === 'loyalty' && ['유지', '배신'].includes(values.choice)) {
        recordSubmission(runtime, playerId, { choice: values.choice }, receivedAt)
      }
    },
    onTimeout(runtime, players, settings) {
      if (runtime.stageKey === 'team-select') {
        runtime.state.teamChoices = Object.fromEntries(
          players.map((player) => [player.id, runtime.submissions.get(player.id)?.values.team ?? 'A']),
        )
        const teamChoices = runtime.state.teamChoices as Record<string, string>
        const counts = { A: 0, B: 0 }
        Object.values(teamChoices).forEach((team) => {
          if (team === 'A' || team === 'B') {
            counts[team] += 1
          }
        })

        runtime.stageKey = 'loyalty'
        runtime.stageLabel = '비밀 선택'
        runtime.stageIndex = 2
        runtime.instructions = ['현재 팀 인원을 보고 유지 또는 배신 중 하나를 비밀리에 선택하세요.']
        runtime.controls = [choiceControl('choice', '비밀 선택', ['유지', '배신'])]
        runtime.publicInfo = [
          { label: 'A 팀 인원', value: `${counts.A}명` },
          { label: 'B 팀 인원', value: `${counts.B}명` },
        ]
        runtime.durationSeconds = settings.roundDuration
        runtime.submissions = new Map()
        return 'next'
      }

      return 'finish'
    },
    buildResults(runtime, players) {
      const teams = runtime.state.teamChoices as Record<string, string>
      const keepCounts = { A: 0, B: 0 }
      const betrayCounts = { A: 0, B: 0 }
      const deltas: Record<string, number> = {}
      const details: Record<string, string> = {}
      const summaries: Record<string, string | null> = {}

      players.forEach((player) => {
        const team = teams[player.id] ?? 'A'
        const choice = runtime.submissions.get(player.id)?.values.choice ?? null
        summaries[player.id] = `${team} / ${choice ?? '기권'}`
        details[player.id] = `${team} 팀`
        deltas[player.id] = 0

        if (choice === '유지') {
          keepCounts[team as 'A' | 'B'] += 1
        } else if (choice === '배신') {
          betrayCounts[team as 'A' | 'B'] += 1
        }
      })

      let winner: 'A' | 'B' | null = null
      if (keepCounts.A > keepCounts.B) {
        winner = 'A'
      } else if (keepCounts.B > keepCounts.A) {
        winner = 'B'
      }

      if (winner) {
        players.forEach((player) => {
          const team = teams[player.id] as 'A' | 'B'
          const choice = runtime.submissions.get(player.id)?.values.choice
          if (team !== winner || !choice) {
            return
          }

          deltas[player.id] = choice === '유지' ? 2 : 3
        })

        if (betrayCounts[winner] > keepCounts[winner]) {
          players.forEach((player) => {
            const team = teams[player.id] as 'A' | 'B'
            const choice = runtime.submissions.get(player.id)?.values.choice
            if (team === winner && choice === '배신') {
              deltas[player.id] = 0
            }
          })
        }
      }

      return buildResultBundle({
        runtime,
        players,
        deltas,
        details,
        summaries,
        reason: '비밀 팀 결과',
      })
    },
  },
}
