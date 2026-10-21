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

// ===== 레벨별 설정 =====
const LEVEL_CONFIG = [
  { 
    name: '(몇십)÷(몇) (1)',
    dividendMin: 10, dividendMax: 90, divisorMin: 2, divisorMax: 9,
    description: '10~90 사이의 10의 배수를 한 자리 수(2~9)로 나누어 떨어지는',
    mustBeTen: true
  },
  { 
    name: '(몇십)÷(몇) (2)',
    dividendMin: 10, dividendMax: 90, divisorMin: 2, divisorMax: 9,
    description: '10~90 사이의 10의 배수를 한 자리 수(2~9)로 나누는 (나머지 있을 수 있음)',
    mustBeTen: true
  },
  { 
    name: '(몇십몇)÷(몇) (1)',
    dividendMin: 10, dividendMax: 99, divisorMin: 2, divisorMax: 9,
    description: '10~99 사이의 두 자리 수를 한 자리 수(2~9)로 나누어 떨어지는',
    mustBeTen: false
  },
  { 
    name: '(몇십몇)÷(몇) (2)',
    dividendMin: 10, dividendMax: 99, divisorMin: 2, divisorMax: 9,
    description: '10~99 사이의 두 자리 수를 한 자리 수(2~9)로 나누는',
    mustBeTen: false
  },
  { 
    name: '(세 자리 수)÷(한 자리 수) (1)',
    dividendMin: 100, dividendMax: 999, divisorMin: 2, divisorMax: 9,
    description: '100~999 사이의 세 자리 수를 한 자리 수(2~9)로 나누어 떨어지는',
    mustBeTen: false
  },
  { 
    name: '(세 자리 수)÷(한 자리 수) (2)',
    dividendMin: 100, dividendMax: 999, divisorMin: 2, divisorMax: 9,
    description: '100~999 사이의 세 자리 수를 한 자리 수(2~9)로 나누는',
    mustBeTen: false
  }
];

// ===== Fallback 문제 (API 실패 시 사용) =====
const FALLBACK_PROBLEMS = [
  [
    { question: "사탕 30개를 3명의 친구에게 똑같이 나누어 주려고 합니다. 한 명에게 몇 개씩 줄 수 있을까요?", answer: 10, remainder: 0, dividend: 30, divisor: 3, hint: "30을 3으로 나누어 보세요." },
    { question: "연필 40자루를 5명이 똑같이 나누어 가집니다. 한 명당 몇 자루씩 가질 수 있나요?", answer: 8, remainder: 0, dividend: 40, divisor: 5, hint: "40 ÷ 5를 계산해 보세요." }
  ],
  [
    { question: "구슬 50개를 6개의 상자에 똑같이 나누어 담으려고 합니다. 한 상자에 몇 개씩 담을 수 있고, 나머지는 몇 개인가요?", answer: 8, remainder: 2, dividend: 50, divisor: 6, hint: "50 ÷ 6의 몫과 나머지를 구해보세요." },
    { question: "풍선 70개를 8명에게 똑같이 나누어 줍니다. 한 명당 몇 개씩 받고, 나머지는 몇 개인가요?", answer: 8, remainder: 6, dividend: 70, divisor: 8, hint: "70 ÷ 8을 계산해 보세요." }
  ],
  [
    { question: "색종이 36장을 4명이 똑같이 나누어 가집니다. 한 명이 몇 장씩 가질 수 있나요?", answer: 9, remainder: 0, dividend: 36, divisor: 4, hint: "36 ÷ 4를 계산해 보세요." },
    { question: "쿠키 48개를 6개의 접시에 똑같이 담습니다. 한 접시에 몇 개씩 담을 수 있나요?", answer: 8, remainder: 0, dividend: 48, divisor: 6, hint: "48을 6으로 나누어 보세요." }
  ],
  [
    { question: "사과 57개를 7명이 똑같이 나누어 가집니다. 한 명당 몇 개씩 가지고, 나머지는 몇 개인가요?", answer: 8, remainder: 1, dividend: 57, divisor: 7, hint: "57 ÷ 7의 몫과 나머지를 구해보세요." },
    { question: "도넛 65개를 8개의 상자에 나누어 담습니다. 한 상자에 몇 개씩 담고, 나머지는 몇 개인가요?", answer: 8, remainder: 1, dividend: 65, divisor: 8, hint: "65 ÷ 8을 계산해 보세요." }
  ],
  [
    { question: "초콜릿 126개를 3명의 친구에게 똑같이 나누어 줍니다. 한 명에게 몇 개씩 줄 수 있나요?", answer: 42, remainder: 0, dividend: 126, divisor: 3, hint: "126 ÷ 3을 세로셈으로 계산해 보세요." },
    { question: "연필 248자루를 4개의 필통에 똑같이 나누어 담습니다. 한 필통에 몇 자루씩 담나요?", answer: 62, remainder: 0, dividend: 248, divisor: 4, hint: "248 ÷ 4를 계산해 보세요." }
  ],
  [
    { question: "스티커 357장을 7명에게 똑같이 나누어 줍니다. 한 명당 몇 장씩 받을 수 있나요?", answer: 51, remainder: 0, dividend: 357, divisor: 7, hint: "357 ÷ 7을 세로셈으로 풀어보세요." },
    { question: "구슬 523개를 9개의 주머니에 똑같이 나누어 담습니다. 한 주머니에 몇 개씩 담고, 나머지는 몇 개인가요?", answer: 58, remainder: 1, dividend: 523, divisor: 9, hint: "523 ÷ 9의 몫과 나머지를 구해보세요." }
  ]
];

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

// ===== OpenAI API 호출 함수 =====
async function generateProblemAI(levelIndex) {
  const config = LEVEL_CONFIG[levelIndex];
  
  // 레벨별 난이도 설명
  const levelDescriptions = [
    '(몇십)÷(몇)(1), 내림 없음 (예: 60÷3=20). 십의 자리가 나누는 수로 나누어떨어짐. 나머지 0.',
    '(몇십)÷(몇)(2), 내림 있음 (예: 70÷6=11...4). 십의 자리를 나눈 나머지가 일의 자리로 내림. 나머지 0.',
    '(몇십몇)÷(몇)(1), 내림 없음 (예: 36÷3=12). 십의 자리와 일의 자리 모두 나누어떨어짐. 나머지 0.',
    '(몇십몇)÷(몇)(2), 내림 있음 (예: 45÷3=15). 십의 자리 나머지가 일의 자리로 이동. 나머지 0.',
    '(세 자리)÷(한 자리)(1), 몫이 세 자리 (예: 484÷4=121). 백의 자리가 나누는 수보다 크거나 같음. 나머지 있어도 됨.',
    '(세 자리)÷(한 자리)(2), 몫이 두 자리 (예: 250÷5=50). 백의 자리가 나누는 수보다 작음. 나머지 있어도 됨.'
  ];
  
  // 나머지 허용 여부
  const allowRemainder = levelIndex >= 4; // Level 5, 6만 나머지 허용
  
  const prompt = `당신은 다정한 초등학교 3학년 수학 선생님입니다.
아래 난이도에 맞는 나눗셈 실생활 문제를 만들어주세요.

**난이도 (Level ${levelIndex + 1}):** ${levelDescriptions[levelIndex]}

**조건:**
- 나누어지는 수 범위: ${config.dividendMin} ~ ${config.dividendMax}
- 나누는 수 범위: ${config.divisorMin} ~ ${config.divisorMax}
${config.mustBeTen ? '- 나누어지는 수는 반드시 10의 배수여야 합니다.' : ''}
${allowRemainder ? '- 나머지가 있어도 되고 없어도 됩니다.' : '- 반드시 나머지가 0이어야 합니다 (나누어떨어지는 문제).'}

**수학적 정확성 검증:**
- divisor로 dividend를 나눈 값이 위 난이도 설명과 정확히 일치하는지 반드시 확인하세요.
- quotient = Math.floor(dividend / divisor)
- remainder = dividend - (quotient * divisor)

**소재:**
- 아이들에게 친숙한 학교(색종이, 연필, 지우개), 간식(떡, 딸기, 사탕, 쿠키), 생활(대나무 칫솔, 텀블러, 친환경 관련) 등 다양하게 사용하세요.

**중요: 나누는 수는 반드시 문제에 명확히 나타나야 합니다!**
- 좋은 예: "사탕 48개를 6명의 친구에게 똑같이 나누어 주려고 합니다."
- 좋은 예: "색종이 60장을 한 묶음에 5장씩 만들려고 합니다."
- 좋은 예: "딸기 77개를 주스 한 잔에 7개씩 넣으려고 합니다."
- 나쁜 예: "사탕을 친구들과 나누려고 합니다." ← 몇 명인지 불명확!

**문장 스타일 (필수):**
- 나머지가 0일 때: "~하려고 합니다. 필요한 [단위]는 몇 [단위]인지 구해 봅시다."
  예: "연필 36자루를 6명에게 똑같이 나누어 주려고 합니다. 한 명은 몇 자루씩 받는지 구해 봅시다."
- 나머지가 있을 때: "~하려고 합니다. 필요한 [단위]는 몇 [단위]이고, 남는 [물건]은 몇 개인지 구해 봅시다."
  예: "딸기 77개를 주스 한 잔에 7개씩 넣으려고 합니다. 주스를 몇 잔 만들 수 있고, 남는 딸기는 몇 개인지 구해 봅시다."

**출력 형식:**
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트나 마크다운 없이 JSON만 출력하세요.

{
  "question": "문제 지문 (나누는 수가 반드시 명시되어야 함)",
  "dividend": 나누어지는수,
  "divisor": 나누는수,
  "quotient": 몫,
  "remainder": 나머지,
  "hasRemainder": true_또는_false
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '당신은 초등학교 수학 문제를 만드는 선생님입니다. JSON 형식으로만 응답합니다. 마크다운 코드 블록을 사용하지 마세요.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    throw new Error(`API 호출 실패: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // 기존 형식으로 변환 (answer, hint, dividend, divisor 추가)
      return {
        question: parsed.question,
        answer: parsed.quotient,
        remainder: parsed.remainder || 0,
        dividend: parsed.dividend,
        divisor: parsed.divisor,
        hint: `${parsed.dividend} ÷ ${parsed.divisor}를 계산해 보세요.`
      };
    }
    throw new Error('JSON 형식이 아닙니다');
  } catch (e) {
    console.error('JSON 파싱 실패:', content);
    throw e;
  }
}

// ===== Fallback 문제 가져오기 =====
function getRandomFallbackProblem(levelIndex) {
  const problems = FALLBACK_PROBLEMS[levelIndex];
  const randomIndex = Math.floor(Math.random() * problems.length);
  return { ...problems[randomIndex] };
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

