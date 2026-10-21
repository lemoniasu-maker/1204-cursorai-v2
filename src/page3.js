// ===== page3.js - 나눗셈 실생활 문제 만들기 =====

// Sweetalert2 import
import Swal from 'sweetalert2';

// API Key 가져오기 (Vite 환경변수)
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// 구글 폼 설정
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSciLkhOFYYWxL3ecz6gMg1l3HRMrR3d_c9dJ8F4QGgXgei5bw/formResponse';
const FORM_ENTRIES = {
  name: 'entry.916021620',
  chatHistory: 'entry.1208210550',
  finalProblem: 'entry.2051329165'
};

// DOM 요소
const statusBar = document.getElementById('statusBar');
const nameInput = document.getElementById('nameInput');
const problemTextarea = document.getElementById('problemTextarea');
const copyBtn = document.getElementById('copyBtn');
const chatLog = document.getElementById('chatLog');
const chatInput = document.getElementById('chatInput');
const pasteBtn = document.getElementById('pasteBtn');
const sendBtn = document.getElementById('sendBtn');
const revisedSection = document.getElementById('revisedSection');
const revisedProblemTextarea = document.getElementById('revisedProblemTextarea');
const finalSubmitBtn = document.getElementById('finalSubmitBtn');

// 채팅 히스토리 (대화 맥락 유지용)
let chatHistory = [];
let hasConversation = false; // 대화 진행 여부

// System Prompt (AI 튜터 역할 설정)
const SYSTEM_PROMPT = `당신은 초등학교 3학년 수학 선생님입니다. 학생이 나눗셈 실생활 문제를 만들 때 직접 답을 주지 않고, 질문을 통해 스스로 생각하게 유도하세요.

**역할:**
- 학생에게 정답을 알려주지 않습니다
- 질문을 던져 학생이 스스로 문제점을 발견하게 합니다
- 이전 대화 맥락을 기억하고 일관성 있게 대화합니다
- 학생의 생각을 존중하며 격려합니다
- 문제가 잘 만들어졌다고 판단되면 최종 제출을 권장합니다

**검토 기준:**
1) 나눗셈 개념(똑같이 나누기)이 명확히 들어가 있는지
2) 나누는 수가 문제에 명확히 나와 있는지
3) 실생활 예시가 자연스러운지
4) 숫자가 3학년 수준에 맞는지 (나누어지는 수 100 이하, 나누는 수는 한 자리)
5) 무엇을 구해야 하는지 명확한지

**유도 질문 예시:**
- "나눗셈 문제라는 것을 문제를 읽는 사람이 알 수 있을까요?"
- "몇 명(또는 몇 개)으로 나누는지 명확하게 나와 있나요?"
- "3학년 친구들이 풀기에 숫자가 적당한가요?"
- "실생활에서 실제로 있을 법한 상황인가요?"
- "문제를 읽었을 때 무엇을 구해야 하는지 분명한가요?"

**문제가 잘 만들어졌을 때:**
- 위의 5가지 기준을 모두 만족하면 더 이상 계산하라고 하지 마세요
- "잘 만들었어요! 이제 아래 '수정한 문제' 칸에 최종 문제를 적고 선생님께 제출해볼까요? 📤" 같은 형태로 제출을 권장하세요

**대화 스타일:**
- 친절하고 격려하는 말투를 사용하세요
- "~해볼까요?", "~은 어떤가요?" 같은 질문형으로 유도하세요
- 학생이 스스로 답을 찾으면 칭찬해주세요
- 응답은 간결하게 2-3문장으로 해주세요
- 절대 문제의 정답이나 수정안을 직접 제시하지 마세요`;

// ===== 초기화 =====
function init() {
  checkApiKey();
  setupEventListeners();
}

// ===== API Key 확인 =====
function checkApiKey() {
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
  // 복사 버튼
  copyBtn.addEventListener('click', copyProblem);
  
  // 붙여넣기 버튼
  pasteBtn.addEventListener('click', pasteProblem);
  
  // 최종 제출 버튼
  finalSubmitBtn.addEventListener('click', submitProblem);
  
  // 전송 버튼
  sendBtn.addEventListener('click', sendMessage);
  
  // 엔터 키로 전송
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// ===== 문제 복사 =====
async function copyProblem() {
  const text = problemTextarea.value.trim();
  
  if (!text) {
    Swal.fire({
      icon: 'warning',
      title: '문제를 먼저 작성해주세요',
      text: '복사할 문제를 먼저 작성해주세요!',
      confirmButtonText: '확인',
      confirmButtonColor: '#4CAF50'
    });
    return;
  }
  
  try {
    await navigator.clipboard.writeText(text);
    
    // 버튼 피드백
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '복사됨! ✓';
    copyBtn.style.background = '#b4f8c8';
    
    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.style.background = '';
    }, 1500);
  } catch (err) {
    console.error('복사 실패:', err);
    Swal.fire({
      icon: 'error',
      title: '복사 실패',
      text: '복사에 실패했습니다. 직접 선택하여 복사해주세요.',
      confirmButtonText: '확인',
      confirmButtonColor: '#4CAF50'
    });
  }
}

// ===== 문제 붙여넣기 (채팅창에) =====
function pasteProblem() {
  const text = problemTextarea.value.trim();
  
  if (!text) {
    Swal.fire({
      icon: 'warning',
      title: '문제를 먼저 작성해주세요',
      text: '붙여넣을 문제를 먼저 작성해주세요!',
      confirmButtonText: '확인',
      confirmButtonColor: '#4CAF50'
    });
    return;
  }
  
  // 채팅 입력창에 문제 내용 붙여넣기
  chatInput.value = text;
  chatInput.focus();
  
  // 버튼 피드백
  const originalText = pasteBtn.textContent;
  pasteBtn.textContent = '붙여넣음! ✓';
  pasteBtn.style.background = '#b4f8c8';
  
  setTimeout(() => {
    pasteBtn.textContent = originalText;
    pasteBtn.style.background = '';
  }, 1500);
}

// ===== 문제 제출 =====
async function submitProblem() {
  const name = nameInput.value.trim();
  const originalProblem = problemTextarea.value.trim();
  const revisedProblem = revisedProblemTextarea.value.trim();
  
  if (!name) {
    Swal.fire({
      icon: 'warning',
      title: '이름을 입력해주세요',
      text: '이름을 먼저 입력해주세요!',
      confirmButtonText: '확인',
      confirmButtonColor: '#4CAF50'
    });
    nameInput.focus();
    return;
  }
  
  if (!originalProblem) {
    Swal.fire({
      icon: 'warning',
      title: '문제를 작성해주세요',
      text: '처음 만든 문제를 먼저 작성해주세요!',
      confirmButtonText: '확인',
      confirmButtonColor: '#4CAF50'
    });
    return;
  }
  
  if (!revisedProblem) {
    Swal.fire({
      icon: 'warning',
      title: '수정한 문제를 작성해주세요',
      text: '수정한 문제를 작성해주세요!',
      confirmButtonText: '확인',
      confirmButtonColor: '#4CAF50'
    });
    revisedProblemTextarea.focus();
    return;
  }
  
  // 챗봇 대화 내역 포맷팅
  const chatHistoryText = formatChatHistory();
  
  // 제출 확인
  const result = await Swal.fire({
    icon: 'question',
    title: '문제를 제출하시겠습니까?',
    text: `${name}님, 문제를 제출하시겠습니까?`,
    showCancelButton: true,
    confirmButtonText: '네, 제출할래요!',
    cancelButtonText: '아니요',
    confirmButtonColor: '#4CAF50',
    cancelButtonColor: '#d33'
  });
  
  if (!result.isConfirmed) {
    return;
  }
  
  // 버튼 비활성화
  finalSubmitBtn.disabled = true;
  finalSubmitBtn.textContent = '제출 중...';
  
  try {
    // 구글 폼에 제출
    const formData = new FormData();
    formData.append(FORM_ENTRIES.name, name);
    formData.append(FORM_ENTRIES.chatHistory, chatHistoryText);
    formData.append(FORM_ENTRIES.finalProblem, revisedProblem);
    
    await fetch(GOOGLE_FORM_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: formData
    });
    
    // 성공 메시지
    await Swal.fire({
      icon: 'success',
      title: '제출 완료! 🎉',
      html: `<strong>${name}님</strong>의 문제가 제출되었습니다!<br><br>수고하셨어요!`,
      confirmButtonText: '확인',
      confirmButtonColor: '#4CAF50'
    });
    
    // 폼 초기화
    nameInput.value = '';
    problemTextarea.value = '';
    revisedProblemTextarea.value = '';
    chatHistory = [];
    hasConversation = false;
    revisedSection.style.display = 'none';
    
    // 채팅 로그 초기화
    chatLog.innerHTML = `
      <div class="welcome-message">
        <div class="emoji">👨‍🏫</div>
        <p>안녕하세요! AI 선생님이에요.<br>제출하기 전 AI 선생님의 피드백을 받고 문제를 수정하여 제출하세요!</p>
        <div class="instruction">
          💡 <strong>팁:</strong> 아래 채팅창에 <strong>붙여넣기 버튼</strong>을 클릭하여 "이 문제가 괜찮을까요?"라고 물어보세요!
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error('제출 실패:', error);
    Swal.fire({
      icon: 'error',
      title: '제출 실패',
      text: '제출에 실패했습니다. 다시 시도해주세요.',
      confirmButtonText: '확인',
      confirmButtonColor: '#4CAF50'
    });
  } finally {
    // 버튼 활성화
    finalSubmitBtn.disabled = false;
    finalSubmitBtn.textContent = '선생님께 제출하기 📤';
  }
}

// ===== 챗봇 대화 내역 포맷팅 =====
function formatChatHistory() {
  if (chatHistory.length === 0) {
    return '(대화 없음)';
  }
  
  let formatted = '';
  chatHistory.forEach((msg, idx) => {
    if (msg.role === 'user') {
      formatted += `[학생]: ${msg.content}\n\n`;
    } else if (msg.role === 'assistant') {
      formatted += `[AI 선생님]: ${msg.content}\n\n`;
    }
  });
  
  return formatted.trim();
}

// ===== 메시지 전송 =====
async function sendMessage() {
  const message = chatInput.value.trim();
  
  if (!message) return;
  
  // API Key 확인
  if (!API_KEY || API_KEY === 'undefined' || API_KEY.trim() === '') {
    addMessage('AI 선생님과 연결되지 않았어요. .env 파일에 VITE_OPENAI_API_KEY를 설정해주세요.', 'ai');
    return;
  }
  
  // 환영 메시지 제거 (처음 메시지일 때)
  const welcomeMsg = chatLog.querySelector('.welcome-message');
  if (welcomeMsg) {
    welcomeMsg.remove();
  }
  
  // 사용자 메시지 추가
  addMessage(message, 'user');
  chatInput.value = '';
  
  // 전송 버튼 비활성화
  sendBtn.disabled = true;
  
  // 로딩 인디케이터 추가
  const loadingId = addLoadingIndicator();
  
  try {
    // 학생의 질문만 전달 (문제 내용은 전달하지 않음)
    chatHistory.push({ role: 'user', content: message });
    
    // API 호출 (전체 대화 히스토리 전달로 맥락 유지)
    const response = await chatWithAI(chatHistory);
    
    // 로딩 제거
    removeLoadingIndicator(loadingId);
    
    // AI 응답 추가
    addMessage(response, 'ai');
    
    // 대화 히스토리에 AI 응답 추가
    chatHistory.push({ role: 'assistant', content: response });
    
    // 첫 대화 완료 시 수정 영역과 제출 버튼 표시
    if (!hasConversation) {
      hasConversation = true;
      revisedSection.style.display = 'block';
      // 처음 문제를 수정 영역에 복사
      revisedProblemTextarea.value = problemTextarea.value;
    }
    
  } catch (error) {
    console.error('API 호출 실패:', error);
    removeLoadingIndicator(loadingId);
    addMessage('죄송해요, 잠시 문제가 생겼어요. 다시 시도해주세요!', 'ai');
  }
  
  // 전송 버튼 활성화
  sendBtn.disabled = false;
}

// ===== AI API 호출 =====
async function chatWithAI(messages) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 400
    })
  });
  
  if (!response.ok) {
    throw new Error(`API 호출 실패: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// ===== 메시지 추가 =====
function addMessage(text, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${sender}`;
  messageDiv.textContent = text;
  chatLog.appendChild(messageDiv);
  
  // 스크롤 하단 고정
  chatLog.scrollTop = chatLog.scrollHeight;
}

// ===== 로딩 인디케이터 추가 =====
function addLoadingIndicator() {
  const id = 'loading-' + Date.now();
  const loadingDiv = document.createElement('div');
  loadingDiv.id = id;
  loadingDiv.className = 'chat-message ai loading';
  loadingDiv.innerHTML = `
    <div class="typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
  chatLog.appendChild(loadingDiv);
  chatLog.scrollTop = chatLog.scrollHeight;
  return id;
}

// ===== 로딩 인디케이터 제거 =====
function removeLoadingIndicator(id) {
  const loadingDiv = document.getElementById(id);
  if (loadingDiv) {
    loadingDiv.remove();
  }
}

// 페이지 로드 시 초기화
init();

