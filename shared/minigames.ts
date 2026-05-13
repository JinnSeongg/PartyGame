import type { MiniGameDefinition } from './game.js'

export const MINIGAMES: MiniGameDefinition[] = [
  {
    id: 'bounty',
    name: '현상금',
    description:
      '다른 플레이어 1명을 지목합니다. 가장 많이 지목된 플레이어가 이득을 얻으며, 모두가 몰릴 대상을 한 단계 비껴 맞힌 플레이어들도 유리해집니다.',
  },
  {
    id: 'greed-control',
    name: '욕심 조절',
    description:
      '1~100 사이 숫자를 제출합니다. 가장 높은 숫자는 오히려 손해를 보고, 바로 아래를 노린 플레이가 가장 유리합니다.',
  },
  {
    id: 'minority',
    name: '소수파',
    description:
      'A 또는 B 중 하나를 선택합니다. 더 적은 사람이 선택한 팀이 승리하며, 혼자만 소수 팀에 남으면 추가 이득을 얻습니다.',
  },
  {
    id: 'treasure-box',
    name: '보물 상자',
    description:
      '3개의 상자 중 하나를 고릅니다. 정답 상자를 맞힌 사람 수가 적을수록 더 큰 보상을 받습니다.',
  },
  {
    id: 'unique-number',
    name: '유일 숫자',
    description:
      '숫자를 제출합니다. 아무도 고르지 않은 숫자 중 가장 큰 숫자를 낸 플레이어만 승리합니다.',
  },
  {
    id: 'cooperate-betray',
    name: '협력 / 배신',
    description:
      '협력 또는 배신을 선택합니다. 모두가 협력하면 안정적으로 이득을 얻지만, 소수의 배신자는 더 큰 보상을 챙길 수 있습니다.',
  },
  {
    id: 'button-game',
    name: '버튼 게임',
    description:
      '제한 시간 안에 버튼을 한 번 누를 수 있습니다. 가장 마지막에 누른 플레이어가 유리하지만, 너무 빨리 누르면 이득이 줄어듭니다.',
  },
  {
    id: 'crown',
    name: '왕관',
    description:
      '왕관을 차지할지 포기할지 선택합니다. 혼자 왕관을 선택하면 큰 이득을 얻지만, 여러 명이 동시에 노리면 모두 손해를 봅니다.',
  },
  {
    id: 'average',
    name: '평균',
    description:
      '숫자를 제출합니다. 전체 평균에 가장 가까운 숫자를 낸 플레이어가 승리합니다.',
  },
  {
    id: 'silence',
    name: '침묵',
    description:
      '말하기 또는 침묵을 선택합니다. 침묵하는 사람이 적을 때는 침묵이 유리하지만, 너무 많아지면 오히려 불리해집니다.',
  },
  {
    id: 'tracker',
    name: '추적자',
    description:
      '비밀 목표 플레이어의 선택을 예측합니다. 목표와 같은 선택을 하면 보상을 얻습니다.',
  },
  {
    id: 'faction-war',
    name: '진영전',
    description:
      '빨강 또는 파랑 진영을 선택합니다. 더 많은 인원이 합류한 진영이 승리합니다. 점수: 1명 차 승리 +2, 2명 차 이상 승리 +1, 패배 0, 동수면 전원 +1입니다.',
  },
  {
    id: 'odd-even',
    name: '홀짝',
    description:
      '숫자를 제출한 뒤 전체 합이 홀수인지 짝수인지 예측합니다. 결과를 맞힌 플레이어가 승리합니다.',
  },
  {
    id: 'random-number',
    name: '랜덤 번호',
    description:
      '0~100 사이 숫자를 제출합니다. 정답 숫자에 가장 가까운 플레이어가 승리하며, 정확히 맞히면 더 큰 보상을 얻습니다.',
  },
  {
    id: 'smuggler',
    name: '밀수꾼',
    description:
      '밀수꾼은 정체를 숨긴 채 살아남아야 하고, 시민은 밀수꾼을 정확히 찾아내야 합니다.',
  },
  {
    id: 'secret-auction',
    name: '비밀 경매',
    description:
      '0~100 사이 숫자를 비밀리에 제출합니다. 가장 높은 숫자가 승리하지만, 최고 입찰이 겹치면 모두 실패합니다.',
  },
  {
    id: 'trade-offer',
    name: '거래 제안',
    description:
      '무작위 상대와 각각 협력 또는 배신을 선택합니다. 서로 협력하면 안정적이지만, 상대를 배신하면 더 큰 이득을 노릴 수 있습니다.',
  },
  {
    id: 'memory-test',
    name: '기억 테스트',
    description:
      '잠깐 공개되는 정보를 기억한 뒤 문제를 풉니다. 많이 맞힐수록 유리하며, 전부 정답이면 추가 이득을 얻습니다.',
  },
  {
    id: 'secret-team',
    name: '비밀 팀',
    description:
      '공개적으로 팀을 고른 뒤 비밀리에 유지 또는 배신을 선택합니다. 팀을 승리시키는 것도 중요하지만, 상황에 따라 배신으로 더 큰 이득을 노릴 수도 있습니다.',
  },
]

export const MINIGAME_MAP = Object.fromEntries(MINIGAMES.map((game) => [game.id, game]))
