// ===== page2.js - 실생활 문제 풀이 =====

// Sweetalert2 import
import Swal from 'sweetalert2';

// API Key 가져오기 (Vite 환경변수)
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// ===== 전역 변수 =====
let currentLevel = -1;         // 현재 선택된 레벨 (-1: 미선택)
let currentProblem = null;     // 현재 문제 데이터 { question, answer, hint }
let isDrawing = false;
let currentTool = 'pencil';    // 'pencil' | 'eraser'
let currentColor = '#000000';
let pencilWidth = 3;           // 펜 굵기 (기본: 보통)
let eraserWidth = 20;          // 지우개 굵기 (기본: 보통)

// ===== 차시별 숫자 규칙 =====
// 숫자는 코드가 교과서 차시 규칙에 맞게 뽑고, AI는 이야기 문장만 만든다.
const LEVEL_RULES = [
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
const VALID_PAIRS = LEVEL_RULES.map(rule => {
  const pairs = [];
  for (let n = 10; n <= 999; n++) {
    for (let d = 2; d <= 9; d++) {
      if (rule.test(n, d)) pairs.push([n, d]);
    }
  }
  return pairs;
});

function pickNumbers(levelIndex) {
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
function endsWithBatchim(text) {
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
const j = (text, withBatchim, withoutBatchim) => `${text}${endsWithBatchim(text) ? withBatchim : withoutBatchim}`;

// ===== AI 없이 쓰는 문장 틀 =====
const ITEMS = [
  { name: '색종이', bundle: true, unit: '장' }, { name: '연필', bundle: true, unit: '자루' }, { name: '지우개', unit: '개' },
  { name: '사탕', unit: '개' }, { name: '딸기', unit: '개' }, { name: '쿠키', unit: '개' },
  { name: '구슬', unit: '개' }, { name: '스티커', bundle: true, unit: '장' }, { name: '공책', bundle: true, unit: '권' },
  { name: '떡', unit: '개' }, { name: '카드', bundle: true, unit: '장' }, { name: '초콜릿', unit: '개' }
];
const SHARE_TARGETS = [ // 똑같이 나누기(등분제)
  { count: '명의 친구에게', each: '한 명에게', verb: '나누어 주려고', ask: '줄' },
  { count: '개의 상자에', each: '한 상자에', verb: '나누어 담으려고', ask: '담을' },
  { count: '개의 접시에', each: '한 접시에', verb: '나누어 담으려고', ask: '담을' },
  { count: '개의 모둠에', each: '한 모둠에', verb: '나누어 주려고', ask: '줄' }
];
const GROUP_TARGETS = [ // 몇 개씩 묶기(포함제)
  { pack: '봉지', verb: '담으려고' }, { pack: '상자', verb: '담으려고' }, { pack: '묶음', verb: '묶으려고' }
];
const pickOne = arr => arr[Math.floor(Math.random() * arr.length)];

function buildTemplateQuestion({ dividend, divisor, remainder }) {
  const item = pickOne(ITEMS);
  const amount = `${dividend}${item.unit}`;
  const leftover = remainder > 0 ? `, 남는 ${j(item.name, '은', '는')} 몇 ${item.unit}인지` : '';
  if (Math.random() < 0.5) {
    const t = pickOne(SHARE_TARGETS);
    return `${item.name} ${j(amount, '을', '를')} ${divisor}${t.count} 똑같이 ${t.verb} 합니다. ` +
      `${t.each} 몇 ${item.unit}씩 ${t.ask} 수 있${remainder > 0 ? '고' : '는지'}${leftover} 구해 봅시다.`;
  }
  const g = pickOne(GROUP_TARGETS.filter(t => t.pack !== '묶음' || item.bundle)); // 묶음은 묶을 수 있는 물건만
  const perPack = `${divisor}${item.unit}`;
  return `${item.name} ${j(amount, '을', '를')} 한 ${g.pack}에 ${perPack}씩 ${g.verb} 합니다. ` +
    `몇 ${j(g.pack, '이', '가')} ${remainder > 0 ? '되고' : '되는지'}${leftover} 구해 봅시다.`;
}

function makeProblem(nums, question) {
  return {
    question,
    answer: nums.quotient,
    remainder: nums.remainder,
    dividend: nums.dividend,
    divisor: nums.divisor,
    hint: `${nums.dividend} ÷ ${j(nums.divisor, '을', '를')} 계산해 보세요.`
  };
}

// ===== 초기화 =====
function init() {
  checkApiKey();
  setupEventListeners();
  setupCanvas();
}

// ===== API Key 확인 =====
function checkApiKey() {
  const statusBar = document.getElementById('statusBar');
  if (API_KEY && API_KEY !== 'undefined' && API_KEY.trim() !== '') {
    statusBar.className = 'status-bar connected';
    statusBar.innerHTML = '<span>🟢</span> AI 선생님과 연결되었습니다';
  } else {
    statusBar.className = 'status-bar disconnected';
    statusBar.innerHTML = '<span>🔴</span> API Key를 찾을 수 없습니다 (.env 파일에 VITE_OPENAI_API_KEY 설정 필요)';
  }
}

// ===== 이벤트 리스너 설정 =====
function setupEventListeners() {
  // 레벨 선택 버튼
  document.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentLevel = parseInt(this.dataset.level);
      generateNewProblem();
    });
  });

  // 정답 확인 버튼
  document.getElementById('checkBtn').addEventListener('click', checkAnswer);

  // 엔터 키로 정답 확인
  document.getElementById('quotientInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      checkAnswer();
    }
  });
  
  document.getElementById('remainderInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      checkAnswer();
    }
  });

  // 도구 버튼들
  document.getElementById('pencilBtn').addEventListener('click', function() {
    currentTool = 'pencil';
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });

  document.getElementById('eraserBtn').addEventListener('click', function() {
    currentTool = 'eraser';
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });

  // 색상 선택
  document.getElementById('colorPicker').addEventListener('input', function() {
    currentColor = this.value;
    currentTool = 'pencil';
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('pencilBtn').classList.add('active');
  });

  // 펜 굵기 슬라이더
  const pencilSlider = document.getElementById('pencilSlider');
  const pencilValue = document.getElementById('pencilValue');
  pencilSlider.addEventListener('input', function() {
    pencilWidth = parseInt(this.value);
    pencilValue.textContent = pencilWidth;
    currentTool = 'pencil';
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('pencilBtn').classList.add('active');
  });

  // 지우개 굵기 슬라이더
  const eraserSlider = document.getElementById('eraserSlider');
  const eraserValue = document.getElementById('eraserValue');
  eraserSlider.addEventListener('input', function() {
    eraserWidth = parseInt(this.value);
    eraserValue.textContent = eraserWidth;
    currentTool = 'eraser';
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('eraserBtn').classList.add('active');
  });
}

// ===== 문제 생성 함수 (메인) =====
window.generateNewProblem = async function() {
  if (currentLevel < 0) {
    Swal.fire({
      icon: 'warning',
      title: '유형을 선택해주세요',
      text: '먼저 공부할 유형을 선택해 주세요!',
      confirmButtonText: '확인',
      confirmButtonColor: '#4CAF50'
    });
    return;
  }

  resetUI();
  showLoading(true);

  try {
    if (API_KEY && API_KEY !== 'undefined' && API_KEY.trim() !== '') {
      currentProblem = await generateProblemAI(currentLevel);
    } else {
      console.log('API 키가 설정되지 않아 기본 문제를 사용합니다.');
      currentProblem = getRandomFallbackProblem(currentLevel);
    }
  } catch (error) {
    console.error('문제 생성 실패:', error);
    currentProblem = getRandomFallbackProblem(currentLevel);
  }

  showLoading(false);
  displayProblem(currentProblem);
  enableAnswerInput();
}

// ===== OpenAI API 호출 함수 (숫자는 코드가 정하고 AI는 문장만 만듦) =====
async function generateProblemAI(levelIndex) {
  const nums = pickNumbers(levelIndex);
  const { dividend, divisor, remainder } = nums;

  const prompt = `초등학교 3학년 학생을 위한 나눗셈 실생활 문제 문장을 하나 만들어 주세요.

[반드시 지킬 숫자 — 절대 바꾸지 마세요]
- 나누어지는 수: ${dividend}
- 나누는 수: ${divisor}
- ${remainder > 0 ? '나머지가 있는 문제입니다. 몫과 함께 남는 양도 묻는 문장으로 끝내세요.' : '나누어떨어지는 문제입니다. 남는 양은 묻지 마세요.'}

[규칙]
- ${dividend}과 ${divisor}가 문장에 숫자 그대로 나와야 합니다.
- 똑같이 나누어 주기(예: "연필 36자루를 3명에게 똑같이 나누어 주려고 합니다.") 또는 몇 개씩 묶기(예: "딸기 72개를 한 봉지에 4개씩 담으려고 합니다.") 중 하나로 만드세요.
- 소재는 학교 물건, 간식, 생활 물건 등 아이들에게 친숙한 것으로 하세요.
- 문장은 "~하려고 합니다. ~ 구해 봅시다."로 끝내고, 정답은 쓰지 마세요.

JSON으로만 답하세요: {"question": "문제 문장"}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '당신은 초등학교 수학 문제 문장을 쓰는 선생님입니다. JSON 형식으로만 응답합니다. 마크다운 코드 블록을 사용하지 마세요.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });
    if (!response.ok) throw new Error(`API 호출 실패: ${response.status}`);

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const question = jsonMatch ? JSON.parse(jsonMatch[0]).question : '';

    // AI 문장 검사: 숫자가 그대로 있고, 나머지 질문 여부가 맞는지
    const numbersInText = (question.match(/\d+/g) || []).map(Number);
    const hasBothNumbers = numbersInText.includes(dividend) && numbersInText.includes(divisor);
    const asksLeftover = /남는|남은|나머지/.test(question);
    const leftoverOk = remainder > 0 ? asksLeftover : !asksLeftover;
    if (question && hasBothNumbers && leftoverOk) {
      return makeProblem(nums, question);
    }
    console.warn('AI 문장이 조건에 맞지 않아 기본 문장을 사용합니다:', question);
  } catch (error) {
    console.error('AI 문제 생성 오류:', error);
  }
  return makeProblem(nums, buildTemplateQuestion(nums));
}

// ===== AI 없이 문제 만들기 =====
function getRandomFallbackProblem(levelIndex) {
  const nums = pickNumbers(levelIndex);
  return makeProblem(nums, buildTemplateQuestion(nums));
}

// ===== 문제 표시 =====
function displayProblem(problem) {
  const problemText = document.getElementById('problemText');
  problemText.textContent = problem.question;
}

// ===== 로딩 표시 =====
function showLoading(isLoading) {
  const problemBox = document.getElementById('problemBox');
  if (isLoading) {
    problemBox.innerHTML = `
      <div class="loading-spinner"></div>
      <p class="loading-text">AI 선생님이 문제를 만들고 있어요...</p>
    `;
  } else {
    // 로딩 종료 시 원래 구조 복원
    problemBox.innerHTML = `
      <p class="problem-text" id="problemText"></p>
    `;
  }
}

// ===== 정답 입력 활성화 =====
function enableAnswerInput() {
  document.getElementById('quotientInput').value = '';
  document.getElementById('remainderInput').value = '';
  document.getElementById('quotientInput').focus({ preventScroll: true });
}

// ===== UI 초기화 =====
function resetUI() {
  document.getElementById('quotientInput').value = '';
  document.getElementById('remainderInput').value = '';
  document.getElementById('feedbackContent').textContent = '문제를 풀고 정답을 확인해 보세요!';
  document.getElementById('feedbackContent').className = 'feedback-content';
  
  const hintBox = document.querySelector('.feedback-hint');
  if (hintBox) hintBox.remove();
}

// ===== AI 오류 분석 피드백 함수 =====
async function getAIErrorFeedback(problem, userQuotient, userRemainder) {
  if (!API_KEY || API_KEY === 'undefined' || API_KEY.trim() === '') {
    return null;
  }

  const dividend = problem.dividend || problem.answer * problem.divisor || 0;
  const divisor = problem.divisor || 1;
  const correctQuotient = problem.answer;
  const correctRemainder = problem.remainder || 0;

  const prompt = `학생이 ${dividend} ÷ ${divisor} 나눗셈 문제를 풀었습니다.

**정답:**
- 몫: ${correctQuotient}
- 나머지: ${correctRemainder}

**학생의 답:**
- 몫: ${userQuotient}
- 나머지: ${userRemainder}

학생의 오류를 분석하고 피드백을 주세요.

**오류 분석 기준:**
1. **알고리즘 오류**: 세로셈을 일의 자리부터 시작했거나, 내림(받아내림)을 잘못 처리했거나, 자릿수를 틀렸는지 확인
2. **0 처리 오류**: 몫의 중간에 0이 들어가야 하는데 빠뜨렸는지 확인
3. **기초 계산 오류**: 곱셈이나 뺄셈을 잘못 계산했는지 확인

**피드백 작성 규칙 (매우 중요):**
- **정답을 절대 알려주지 마세요!** 몫이나 나머지의 정확한 값을 말하지 마세요.
- 어떤 종류의 오류인지, 어떤 과정을 다시 확인해야 하는지만 알려주세요.
- 존댓말을 쓰고, 격려하는 말투로 작성하세요.
- 3-4문장으로 간결하게 작성하세요.

**좋은 피드백 예시 (정답을 노출하지 않음):**
- "나눗셈 세로셈은 가장 큰 자리부터 차례대로 계산해야 해요. 자릿수를 다시 한번 확인해볼까요? 😊"
- "몫에 0이 들어가는 경우를 빠뜨리지 않았나요? 각 자리에서 나누는 수보다 작으면 0을 써줘야 해요! 👍"
- "곱셈이나 뺄셈 계산을 다시 한번 확인해보세요. 각 단계를 천천히 계산해보면 어떨까요? 😊"
- "십의 자리를 나눈 후 나머지를 일의 자리로 내려주는 것을 확인해보세요. 받아내림이 잘 되었나요? 💪"

**나쁜 피드백 예시 (정답 노출 - 절대 금지!):**
- "정답은 121이에요." ❌
- "몫은 15가 되어야 해요." ❌
- "나머지는 3이 나와야 해요." ❌`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '당신은 친절한 초등학교 수학 선생님입니다. 학생의 오류를 분석하고 격려하며 가르칩니다. 절대로 정답을 직접 알려주지 않고, 힌트와 방향만 제시합니다.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('AI 피드백 오류:', error);
    return null;
  }
}

// ===== 정답 확인 =====
async function checkAnswer() {
  if (!currentProblem) {
    Swal.fire({
      icon: 'info',
      title: '문제를 먼저 생성해주세요',
      text: '먼저 문제를 생성해 주세요!',
      confirmButtonText: '확인',
      confirmButtonColor: '#4CAF50'
    });
    return;
  }

  const userQuotient = parseInt(document.getElementById('quotientInput').value);
  const userRemainder = parseInt(document.getElementById('remainderInput').value) || 0;
  const feedbackContent = document.getElementById('feedbackContent');
  const feedbackBox = document.getElementById('feedbackBox');

  if (isNaN(userQuotient)) {
    Swal.fire({
      icon: 'warning',
      title: '몫을 입력해주세요',
      text: '몫을 입력해 주세요!',
      confirmButtonText: '확인',
      confirmButtonColor: '#4CAF50'
    });
    return;
  }

  const existingHint = feedbackBox.querySelector('.feedback-hint');
  if (existingHint) existingHint.remove();

  // 정답의 나머지 계산 (문제에 remainder가 없으면 0으로 처리)
  const correctRemainder = currentProblem.remainder !== undefined ? currentProblem.remainder : 0;
  
  const quotientCorrect = userQuotient === currentProblem.answer;
  const remainderCorrect = userRemainder === correctRemainder;

  if (quotientCorrect && remainderCorrect) {
    feedbackContent.textContent = '참 잘했어요! 🎉 정답이에요!';
    feedbackContent.className = 'feedback-content feedback-correct';
    showConfetti();
  } else if (quotientCorrect && !remainderCorrect) {
    feedbackContent.textContent = '몫은 맞았어요! 나머지를 다시 확인해 볼까요?';
    feedbackContent.className = 'feedback-content feedback-wrong';
  } else if (!quotientCorrect && remainderCorrect) {
    feedbackContent.textContent = '나머지는 맞았어요! 몫을 다시 확인해 볼까요?';
    feedbackContent.className = 'feedback-content feedback-wrong';
    
    // AI 피드백 요청
    feedbackContent.textContent = '나머지는 맞았어요! AI 선생님이 피드백을 준비하고 있어요...';
    const aiFeedback = await getAIErrorFeedback(currentProblem, userQuotient, userRemainder);
    
    if (aiFeedback) {
      feedbackContent.textContent = aiFeedback;
    } else {
      feedbackContent.textContent = '나머지는 맞았어요! 몫을 다시 확인해 볼까요?';
      const hintDiv = document.createElement('div');
      hintDiv.className = 'feedback-hint';
      hintDiv.textContent = '💡 힌트: ' + currentProblem.hint;
      feedbackBox.appendChild(hintDiv);
    }
  } else {
    // 둘 다 틀린 경우 AI 피드백 요청
    feedbackContent.textContent = 'AI 선생님이 피드백을 준비하고 있어요...';
    const aiFeedback = await getAIErrorFeedback(currentProblem, userQuotient, userRemainder);
    
    if (aiFeedback) {
      feedbackContent.textContent = aiFeedback;
    } else {
      feedbackContent.textContent = '아쉬워요, 다시 한번 생각해 볼까요?';
      const hintDiv = document.createElement('div');
      hintDiv.className = 'feedback-hint';
      hintDiv.textContent = '💡 힌트: ' + currentProblem.hint;
      feedbackBox.appendChild(hintDiv);
    }
  }
}

// ===== 축하 효과 =====
function showConfetti() {
  const emojis = ['🎉', '🎊', '⭐', '🌟', '✨', '💫'];
  
  for (let i = 0; i < 20; i++) {
    setTimeout(() => {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      confetti.style.left = Math.random() * 100 + 'vw';
      confetti.style.top = '-50px';
      confetti.style.fontSize = (Math.random() * 20 + 20) + 'px';
      confetti.style.transition = 'all 2s ease-out';
      document.body.appendChild(confetti);
      
      setTimeout(() => {
        confetti.style.top = '100vh';
        confetti.style.opacity = '0';
      }, 50);
      
      setTimeout(() => confetti.remove(), 2500);
    }, i * 100);
  }
}

// ===== 캔버스 설정 =====
let canvas, ctx;

function setupCanvas() {
  canvas = document.getElementById('drawingCanvas');
  ctx = canvas.getContext('2d');
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // 마우스 이벤트
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);
  
  // 터치 이벤트
  canvas.addEventListener('touchstart', startDrawing);
  canvas.addEventListener('touchmove', draw);
  canvas.addEventListener('touchend', stopDrawing);
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = 500;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  if (e.touches) {
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
  }
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function startDrawing(e) {
  isDrawing = true;
  const pos = getPos(e);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  
  const pos = getPos(e);
  
  if (currentTool === 'pencil') {
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = pencilWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  } else {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = eraserWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
}

function stopDrawing() {
  isDrawing = false;
}

// 캔버스 초기화 (전역 함수로 노출)
window.clearCanvas = function() {
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// 페이지 로드 시 초기화
init();

