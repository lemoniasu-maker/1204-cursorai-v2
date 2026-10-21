// ===== 나눗셈 차시 규칙 (2쪽 문제 풀이, 3쪽 문제 만들기, 게시판 서버가 함께 사용) =====

// ===== 차시별 숫자 규칙 =====
// 숫자는 코드가 교과서 차시 규칙에 맞게 뽑고, AI는 이야기 문장만 만든다.
export const LEVEL_RULES = [
  {
    name: '(몇십)÷(몇) (1)', // 2차시: 내림 없음, 몫이 몇십 (예: 60÷3=20)
    describe: '내림이 없는 (몇십)÷(몇), 나머지 없음',
    test: (n, d) => n >= 10 && n <= 90 && n % 10 === 0 && (n / 10) >= d && (n / 10) % d === 0
  },
  {
    name: '(몇십)÷(몇) (2)', // 3차시: 내림 있음, 나머지 0 (예: 70÷5=14)
    describe: '내림이 있는 (몇십)÷(몇), 나머지 없음',
    test: (n, d) => n >= 10 && n <= 90 && n % 10 === 0 && (n / 10) >= d && (n / 10) % d !== 0 && n % d === 0
  },
  {
    name: '(몇십몇)÷(몇) (1)', // 4차시: 십·일의 자리 모두 나누어떨어짐 (예: 36÷3=12)
    describe: '내림이 없는 (몇십몇)÷(몇), 나머지 없음',
    test: (n, d) => {
      const t = Math.floor(n / 10), o = n % 10;
      return n >= 11 && n <= 99 && o !== 0 && t >= d && t % d === 0 && o % d === 0;
    }
  },
  {
    name: '(몇십몇)÷(몇) (2)', // 5차시: 내림 있음, 나머지 0 (예: 45÷3=15)
    describe: '내림이 있는 (몇십몇)÷(몇), 나머지 없음',
    test: (n, d) => {
      const t = Math.floor(n / 10), o = n % 10;
      return n >= 11 && n <= 99 && o !== 0 && t >= d && t % d !== 0 && n % d === 0;
    }
  },
  {
    name: '(세 자리 수)÷(한 자리 수) (1)', // 9차시: 몫이 세 자리 (백의 자리 ≥ 나누는 수), 나머지 허용
    describe: '몫이 세 자리 수인 (세 자리 수)÷(한 자리 수), 나머지가 있을 수 있음',
    test: (n, d) => n >= 100 && n <= 999 && Math.floor(n / 100) >= d
  },
  {
    name: '(세 자리 수)÷(한 자리 수) (2)', // 10차시: 몫이 두 자리 (백의 자리 < 나누는 수), 나머지 허용
    describe: '몫이 두 자리 수인 (세 자리 수)÷(한 자리 수), 나머지가 있을 수 있음',
    test: (n, d) => n >= 100 && n <= 999 && Math.floor(n / 100) < d
  }
];

// 규칙에 맞는 (나누어지는 수, 나누는 수) 쌍을 모두 모아 두고 무작위로 하나 고르기
export const VALID_PAIRS = LEVEL_RULES.map(rule => {
  const pairs = [];
  for (let n = 10; n <= 999; n++) {
    for (let d = 2; d <= 9; d++) {
      if (rule.test(n, d)) pairs.push([n, d]);
    }
  }
  return pairs;
});

export function pickNumbers(levelIndex) {
  const pairs = VALID_PAIRS[levelIndex];
  const [dividend, divisor] = pairs[Math.floor(Math.random() * pairs.length)];
  return {
    dividend,
    divisor,
    quotient: Math.floor(dividend / divisor),
    remainder: dividend % divisor
  };
}

// ===== 받침에 맞는 조사 고르기 =====
export function endsWithBatchim(text) {
  const str = String(text);
  const last = str[str.length - 1];
  if (/[0-9]/.test(last)) {
    const n = Number(str.replace(/[^0-9]/g, ''));
    if (n % 10 === 0) return true; // 십, 백
    return [1, 3, 6, 7, 8].includes(n % 10); // 일, 삼, 육, 칠, 팔
  }
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;
  return code % 28 !== 0;
}
export const j = (text, withBatchim, withoutBatchim) => `${text}${endsWithBatchim(text) ? withBatchim : withoutBatchim}`;

