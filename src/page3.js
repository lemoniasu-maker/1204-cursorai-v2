// ===== page3.js - 문제 만들고 친구와 나누기 (게시판) =====
import Swal from 'sweetalert2';
import { LEVEL_RULES, j } from './divisionRules.js';
import { aiAvailable, aiChat } from './aiClient.js';

const POLL_MS = 10000; // 게시판 새로고침 간격 (크레딧 절약을 위해 10초)

// 차시 이름과 학생용 안내
const LESSONS = [
  { lesson: '2차시', tip: '몇십을 나누어요. 십의 자리 수가 나누는 수로 남김없이 나누어떨어지게 만들어요. (예: 60 ÷ 3)' },
  { lesson: '3차시', tip: '몇십을 나누어요. 십의 자리를 나누면 남는 것이 생겨 일의 자리로 내려가요. 하지만 마지막에는 남는 것이 없어야 해요. (예: 70 ÷ 5)' },
  { lesson: '4차시', tip: '몇십몇을 나누어요. 십의 자리와 일의 자리가 모두 남김없이 나누어떨어지게 만들어요. (예: 48 ÷ 4)' },
  { lesson: '5차시', tip: '몇십몇을 나누어요. 십의 자리에서 남는 것이 일의 자리로 내려가고, 마지막에는 남는 것이 없게 만들어요. (예: 72 ÷ 4)' },
  { lesson: '9차시', tip: '세 자리 수를 나누어요. 백의 자리 수가 나누는 수와 같거나 크게 만들어요(몫이 세 자리). 남는 것이 있어도 돼요. (예: 639 ÷ 3)' },
  { lesson: '10차시', tip: '세 자리 수를 나누어요. 백의 자리 수가 나누는 수보다 작게 만들어요(몫이 두 자리). 남는 것이 있어도 돼요. (예: 250 ÷ 5)' }
];

// ===== 상태 =====
const state = {
  me: null,             // 내 번호
  teacherPw: null,      // 선생님 비밀번호 (이 탭에서만 기억)
  boards: [],
  board: null,          // 지금 보고 있는 게시판
  rev: null,
  seenPosts: new Set(),
  results: {},          // 이 화면에서 채점한 결과 { postId: {correct, text} }
  maker: { item: '', unit: '', total: null, mode: null, divisor: null, target: '' },
  pollTimer: null,
  aiOn: false,
  sort: 'new',          // 'new' 최신순 | 'like' 좋아요순
  zoomId: null          // 확대보기 중인 문제
};

// 좋아요 정보 (선생님은 누른 번호 목록, 학생은 개수만 받음)
const likeCount = p => (Array.isArray(p.likes) ? p.likes.length : p.likeCount || 0);
const likedByMe = p => (Array.isArray(p.likes) ? p.likes.includes(state.me) : Boolean(p.likedByMe));

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const storage = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* 저장 불가 환경 */ } }
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const toast = (title, icon = 'info') => Swal.fire({ title, icon, confirmButtonText: '확인', confirmButtonColor: '#4f9cff' });

// ===== 서버 통신 =====
async function api(method, params = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.teacherPw) headers['x-teacher-password'] = state.teacherPw;
  let res;
  if (method === 'GET') {
    res = await fetch(`/api/board?${new URLSearchParams(params)}`, { headers });
  } else {
    res = await fetch('/api/board', { method: 'POST', headers, body: JSON.stringify(params) });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '연결이 잠시 끊겼어요. 다시 해 보세요.');
  return data;
}

// ===== 시작 화면 =====
function setMe(n) {
  state.me = n;
  storage.set('myNumber', n == null ? null : String(n));
  $('meLabel').innerHTML = n ? `나는 <b>${n}번</b>이에요` : (state.teacherPw ? '' : '번호를 먼저 써 주세요');
  $('changeNumberBtn').classList.toggle('hidden', !n);
  $('numberInput').value = n || '';
}

function lessonOf(level) { return LESSONS[level] || { lesson: '', tip: '' }; }

async function loadBoardList() {
  try {
    const data = await api('GET', { list: 1 });
    state.boards = (data.boards || []).sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  } catch (e) {
    $('boardListArea').innerHTML = `<p class="msg error">${esc(e.message)}</p>`;
    return;
  }
  renderBoardList();
  renderTeacherBoards();
}

function boardTile(b) {
  const isToday = b.date === today();
  return `<button class="board-tile ${b.locked ? 'locked' : isToday ? 'today' : ''}" data-board="${esc(b.id)}" type="button">
    <span class="lesson">${esc(lessonOf(b.level).lesson)} ${b.locked ? '· 🔒 지난 기록' : isToday ? '· 오늘' : ''}</span>
    <span class="title">${esc(b.title)}</span>
    <span class="date">${esc(b.date)}</span>
  </button>`;
}

function renderBoardList() {
  const open = state.boards.filter(b => !b.locked);
  const past = state.boards.filter(b => b.locked);
  if (!state.boards.length) {
    $('boardListArea').innerHTML = '<p class="muted">아직 열린 게시판이 없어요. 선생님이 게시판을 열면 여기에 나타나요.</p>';
    return;
  }
  $('boardListArea').innerHTML =
    (open.length ? `<div class="board-list">${open.map(boardTile).join('')}</div>` : '<p class="muted">지금 열린 게시판이 없어요.</p>') +
    (past.length ? `<p class="list-heading">📚 지난 게시판 (보기만 할 수 있어요)</p><div class="board-list">${past.map(boardTile).join('')}</div>` : '');
}

function renderTeacherBoards() {
  if (!state.teacherPw) return;
  $('teacherBoards').innerHTML = state.boards.map(b => `
    <div class="teacher-board-row">
      <span>${esc(b.date)} · ${esc(lessonOf(b.level).lesson)} · <b>${esc(b.title)}</b> ${b.locked ? '🔒' : '🟢'}</span>
      <button class="btn btn-soft btn-small" data-open="${esc(b.id)}" type="button">보기</button>
      <button class="btn btn-small ${b.locked ? 'btn-green' : 'btn-pink'}" data-lock="${esc(b.id)}" data-locked="${b.locked ? 1 : 0}" type="button">${b.locked ? '다시 열기' : '잠그기'}</button>
    </div>`).join('') || '<p class="muted">아직 게시판이 없어요.</p>';
}

async function teacherLogin(pw) {
  state.teacherPw = pw;
  try {
    await api('POST', { action: 'teacherCheck' });
    storage.set('teacherPw', pw);
    $('teacherLoginBox').classList.add('hidden');
    $('teacherToggleBtn').classList.add('hidden');
    $('teacherBox').classList.remove('hidden');
    $('teacherLabel').classList.remove('hidden');
    setMe(state.me);
    $('teacherMsg').textContent = '';
    renderTeacherBoards();
    return true;
  } catch (e) {
    state.teacherPw = null;
    storage.set('teacherPw', null);
    $('teacherMsg').textContent = e.message;
    $('teacherMsg').className = 'msg error';
    return false;
  }
}

function teacherLogout() {
  state.teacherPw = null;
  storage.set('teacherPw', null);
  $('teacherBox').classList.add('hidden');
  $('teacherToggleBtn').classList.remove('hidden');
  $('teacherLabel').classList.add('hidden');
  setMe(state.me);
}

async function setLock(boardId, locked) {
  try {
    await api('POST', { action: 'setLock', boardId, locked });
    await loadBoardList();
    if (state.board?.id === boardId) await refreshBoard(true);
  } catch (e) { toast(e.message, 'error'); }
}

// ===== 게시판 화면 =====
async function openBoard(id) {
  if (!state.me && !state.teacherPw) {
    $('numberMsg').textContent = '번호를 먼저 써 주세요!';
    $('numberMsg').className = 'msg error';
    $('numberInput').focus();
    return;
  }
  state.board = { id, posts: [] };
  state.rev = null;
  state.seenPosts = new Set();
  state.results = {};
  closeZoom();
  $('entryView').classList.add('hidden');
  $('boardView').classList.remove('hidden');
  $('cards').innerHTML = '<p class="empty">불러오는 중이에요...</p>';
  closeMaker();
  await refreshBoard(true);
  startPolling();
  window.scrollTo({ top: 0 });
}

function backToList() {
  stopPolling();
  closeZoom();
  state.board = null;
  document.body.classList.remove('present');
  $('boardView').classList.add('hidden');
  $('entryView').classList.remove('hidden');
  loadBoardList();
}

async function refreshBoard(force = false) {
  if (!state.board) return;
  try {
    const params = { board: state.board.id, me: state.me || 0 };
    if (!force && state.rev) params.rev = state.rev;
    const data = await api('GET', params);
    if (data.unchanged) return;
    applyBoard(data);
  } catch (e) {
    if (force) $('cards').innerHTML = `<p class="empty">${esc(e.message)}</p>`;
  }
}

function applyBoard(data) {
  const firstLoad = state.rev == null;
  state.board = data;
  state.rev = data.rev;
  const l = lessonOf(data.level);
  $('boardTitle').innerHTML = `${esc(data.title)}<span class="sub">${esc(l.lesson)} · ${esc(data.date)} · 문제 ${data.posts.length}개</span>`;
  $('lockBanner').classList.toggle('hidden', !data.locked);
  $('makeBtn').classList.toggle('hidden', data.locked || !state.me);
  $('presentBtn').classList.toggle('hidden', !state.teacherPw);
  $('lockBtn').classList.toggle('hidden', !state.teacherPw);
  $('lockBtn').textContent = data.locked ? '🔓 다시 열기' : '🔒 잠그기';
  if (data.locked) closeMaker();
  renderCards(firstLoad);
  renderSortBtn();
  if (state.zoomId) renderZoom();
}

// 카드 다시 그리기 (학생이 입력 중이던 값과 커서는 유지)
function renderCards(firstLoad) {
  const keep = {};
  document.querySelectorAll('#cards [data-keep]').forEach(el => { keep[el.dataset.keep] = el.value; });
  const focused = document.activeElement?.dataset?.keep;
  const caret = focused ? document.activeElement.selectionStart : null;

  const { posts, locked } = state.board;
  const teacher = Boolean(state.teacherPw);
  if (!posts.length) {
    $('cards').innerHTML = `<p class="empty">${locked ? '이 게시판에는 문제가 없어요.' : '아직 올라온 문제가 없어요. 첫 번째 문제를 만들어 볼까요? ✏️'}</p>`;
    return;
  }

  const ordered = [...posts].reverse(); // 최신순
  if (state.sort === 'like') ordered.sort((a, b) => likeCount(b) - likeCount(a)); // 같은 수면 최신순 유지

  $('cards').innerHTML = ordered.map(p => {
    const mine = p.number === state.me;
    const isNew = !firstLoad && !state.seenPosts.has(p.id);
    const correctCount = p.solves.filter(s => s.correct).length;
    const mySolve = p.solves.find(s => s.number === state.me);
    const result = state.results[p.id];
    const showAnswer = mine || teacher;
    const likes = likeCount(p);
    const liked = likedByMe(p);
    const canLike = !locked && state.me && !mine;
    const likeBtn = canLike
      ? `<button class="like-btn ${liked ? 'on' : ''}" data-like="${esc(p.id)}" data-liked="${liked ? 1 : 0}" type="button" aria-pressed="${liked}" title="${liked ? '좋아요 취소' : '좋아요'}">${liked ? '❤️' : '🤍'} ${likes}</button>`
      : `<span class="like-count" title="${mine ? '내 문제에는 누를 수 없어요' : '좋아요'}">❤️ ${likes}</span>`;
    const likers = teacher && Array.isArray(p.likes) && p.likes.length
      ? `<div class="likers">❤️ 누른 친구: ${p.likes.map(n => `${n}번`).join(', ')}</div>` : '';

    let answerArea = '';
    if (showAnswer && p.quotient !== undefined) {
      answerArea = `<div class="my-answer">${mine ? '내 문제 정답' : '정답'}: 몫 <b>${p.quotient}</b>${p.remainder ? `, 나머지 <b>${p.remainder}</b>` : ''}</div>`;
    }
    if (!mine && !locked) {
      if (mySolve?.correct || result?.correct) {
        answerArea += '<div class="result ok">✅ 맞혔어요! 댓글로 풀이 방법을 알려 줄까요?</div>';
      } else if (state.me) {
        answerArea += `<div class="answer-row">
            몫 <input type="number" inputmode="numeric" data-keep="q-${p.id}" value="${esc(keep[`q-${p.id}`] ?? '')}">
            나머지 <input type="number" inputmode="numeric" data-keep="r-${p.id}" value="${esc(keep[`r-${p.id}`] ?? '')}" placeholder="0">
            <button class="btn btn-primary btn-small" data-solve="${esc(p.id)}" type="button">확인</button>
          </div>
          ${result ? `<div class="result bad">${esc(result.text)}</div>` : ''}`;
      }
    }

    const comments = p.comments.map(c => `<div class="comment"><b>${c.number}번</b><span>${esc(c.text)}</span>
        ${teacher ? `<button class="del" data-del-comment="${esc(c.id)}" data-post="${esc(p.id)}" title="댓글 삭제" type="button">🗑</button>` : ''}</div>`).join('');
    const commentInput = !locked && state.me ? `<div class="comment-row">
        <input type="text" maxlength="100" placeholder="댓글 쓰기 (풀이 방법, 칭찬 등)" data-keep="c-${p.id}" value="${esc(keep[`c-${p.id}`] ?? '')}">
        <button class="btn btn-soft btn-small" data-comment="${esc(p.id)}" type="button">등록</button></div>` : '';

    return `<article class="card ${mine ? 'mine' : ''} ${isNew ? 'new' : ''}">
      <div class="card-head">
        <span class="who">🙋 ${p.number}번의 문제</span>
        <span class="tag ${p.mode}">${p.mode === 'share' ? '똑같이 나누어 주기' : '몇 개씩 묶어 담기'}</span>
        ${mine ? '<span class="tag me">내 문제</span>' : ''}
        <span class="head-tools">
          <button class="zoom-btn" data-zoom="${esc(p.id)}" title="이 문제만 크게 보기" type="button">🔍</button>
          ${teacher ? `<button class="del" data-del-post="${esc(p.id)}" title="문제 삭제" type="button">🗑</button>` : ''}
        </span>
      </div>
      <div class="card-question">${esc(p.question)}</div>
      ${answerArea}
      <div class="solve-stat">${likeBtn}<span>✅ ${correctCount}명 맞힘 · 💬 댓글 ${p.comments.length}개</span></div>
      ${likers}
      ${comments ? `<div class="comments">${comments}</div>` : ''}
      ${commentInput}
    </article>`;
  }).join('');

  posts.forEach(p => state.seenPosts.add(p.id));
  if (focused) {
    const el = document.querySelector(`#cards [data-keep="${CSS.escape(focused)}"]`);
    if (el) { el.focus({ preventScroll: true }); try { if (caret != null) el.setSelectionRange(caret, caret); } catch { /* 숫자 칸 */ } }
  }
}

async function toggleLike(postId, liked) {
  try {
    const data = await api('POST', { action: 'like', boardId: state.board.id, postId, number: state.me, liked });
    applyBoard(data);
  } catch (e) { toast(e.message, 'error'); }
}

function renderSortBtn() {
  const btn = $('sortBtn');
  btn.classList.toggle('hidden', !state.board?.posts?.length);
  btn.textContent = state.sort === 'like' ? '❤️ 좋아요순' : '🕒 최신순';
  btn.title = state.sort === 'like' ? '눌러서 최신순으로 보기' : '눌러서 좋아요 많은 순으로 보기';
}

// ===== 확대보기: 문제 하나만 크게 =====
function renderZoom() {
  const p = state.board?.posts?.find(x => x.id === state.zoomId);
  if (!p) { closeZoom(); return; }
  $('zoomWho').textContent = `🙋 ${p.number}번의 문제`;
  $('zoomTag').textContent = p.mode === 'share' ? '똑같이 나누어 주기' : '몇 개씩 묶어 담기';
  $('zoomTag').className = `tag ${p.mode}`;
  $('zoomQuestion').textContent = p.question;
  $('zoomLikes').textContent = `❤️ ${likeCount(p)}`;
}

function openZoom(postId) {
  state.zoomId = postId;
  renderZoom();
  $('zoomView').classList.remove('hidden');
  document.body.classList.add('zooming');
  $('zoomCloseBtn').focus();
}

function closeZoom() {
  state.zoomId = null;
  $('zoomView')?.classList.add('hidden');
  document.body.classList.remove('zooming');
}

async function solve(postId) {
  const q = document.querySelector(`[data-keep="q-${CSS.escape(postId)}"]`)?.value;
  const r = document.querySelector(`[data-keep="r-${CSS.escape(postId)}"]`)?.value;
  if (q === '' || q == null) { toast('몫을 써 주세요!', 'warning'); return; }
  try {
    const res = await api('POST', { action: 'solve', boardId: state.board.id, postId, number: state.me, quotient: Number(q), remainder: Number(r || 0) });
    let text = '';
    if (res.correct) text = '정답!';
    else if (res.quotientCorrect) text = '몫은 맞았어요! 나머지를 다시 생각해 봐요.';
    else if (res.remainderCorrect && Number(r || 0) !== 0) text = '나머지는 맞았어요! 몫을 다시 생각해 봐요.';
    else text = '다시 생각해 볼까요? 세로셈으로 차근차근 계산해 봐요. 💪';
    state.results[postId] = { correct: res.correct, text };
    if (res.correct) {
      Swal.fire({ title: '정답이에요! 🎉', text: '친구에게 댓글로 응원이나 풀이 방법을 남겨 볼까요?', icon: 'success', timer: 2200, showConfirmButton: false });
    }
    await refreshBoard(true);
  } catch (e) { toast(e.message, 'error'); }
}

async function addComment(postId) {
  const input = document.querySelector(`[data-keep="c-${CSS.escape(postId)}"]`);
  const text = input?.value.trim();
  if (!text) return;
  try {
    const data = await api('POST', { action: 'comment', boardId: state.board.id, postId, number: state.me, text });
    input.value = '';
    applyBoard(data);
  } catch (e) { toast(e.message, 'error'); }
}

async function teacherDelete(kind, postId, commentId) {
  const ok = await Swal.fire({ title: kind === 'post' ? '이 문제를 지울까요?' : '이 댓글을 지울까요?', icon: 'question', showCancelButton: true, confirmButtonText: '지우기', cancelButtonText: '취소', confirmButtonColor: '#e11d48' });
  if (!ok.isConfirmed) return;
  try {
    const data = await api('POST', { action: kind === 'post' ? 'deletePost' : 'deleteComment', boardId: state.board.id, postId, commentId });
    applyBoard(data);
  } catch (e) { toast(e.message, 'error'); }
}

function startPolling() {
  stopPolling();
  state.pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') refreshBoard();
  }, POLL_MS);
}
function stopPolling() { clearInterval(state.pollTimer); state.pollTimer = null; }

// ===== 문제 설계 도우미 (학생이 직접 쓰고, 필요할 때만 도움 받기) =====
function openMaker() {
  state.maker = { item: '', unit: '', total: null, mode: null, divisor: null, target: '' };
  ['itemInput', 'unitInput', 'totalInput', 'divisorInput', 'targetInput', 'questionInput'].forEach(id => { $(id).value = ''; });
  document.querySelectorAll('.help-box').forEach(b => b.classList.add('hidden'));
  document.querySelectorAll('.help-btn').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('on'));
  $('aiSuggest').classList.add('hidden');
  $('postMsg').textContent = '';
  updateMaker();
  $('maker').classList.remove('hidden');
  $('makeBtn').classList.add('hidden');
  $('maker').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeMaker() {
  $('maker').classList.add('hidden');
  if (state.board && !state.board.locked && state.me) $('makeBtn').classList.remove('hidden');
}

const blank = label => `<span class="blank">${label}</span>`;

// 단계별 도움말 (정답을 채워 주지 않고 생각할 거리만 줌)
function helpText(step) {
  const m = state.maker;
  const l = lessonOf(state.board?.level ?? 0);
  const unit = m.unit || '개';
  if (step === 'help1') {
    return '우리 주변에서 친구들과 나누는 물건을 떠올려 봐요.<br>🏫 학교에서 쓰는 물건 · 🍪 간식 · 🌱 생활 속 물건 등<br>내가 고른 물건으로 이야기를 만들면 더 재미있어요!';
  }
  if (step === 'help2') {
    return `📘 <b>${l.lesson}</b> — ${l.tip}<br>세는 말도 함께 써요. (예: 사탕은 '개', 색종이는 '장', 연필은 '자루', 공책은 '권')`;
  }
  if (step === 'help3') {
    return '🎁 <b>똑같이 나누어 주기</b>: 여러 사람(곳)에게 똑같이 나누어 줘요. "한 명에게 몇 개씩?"을 구해요.<br>' +
      '📦 <b>몇 개씩 묶어 담기</b>: 정해진 수만큼씩 담거나 묶어요. "몇 봉지(묶음)가 될까?"를 구해요.<br>' +
      '내 문제는 어떤 것을 궁금해하는 문제인지 생각해 봐요.';
  }
  if (step === 'help4') {
    if (m.mode === 'group') {
      return `한 번에 몇 ${unit}씩 담거나 묶을지 정해요. 그리고 무엇에 담을지 써요. (봉지, 상자, 묶음, 바구니 …)<br>나누는 수는 2부터 9까지로 정해 봐요.`;
    }
    return '몇 명(곳)에게 똑같이 나누어 줄지 정해요. 그리고 누구(어디)에게 줄지 써요. (친구, 모둠, 상자, 접시 …)<br>나누는 수는 2부터 9까지로 정해 봐요.';
  }
  if (step === 'help5') {
    const rem = m.total && m.divisor ? m.total % m.divisor : 0;
    const leftover = rem > 0 ? `, 남는 ${blank('무엇')}은(는) 몇 ${blank('세는 말')}인지` : '';
    const frame = m.mode === 'group'
      ? `${blank('무엇')} ${blank('전체 수')}${blank('세는 말')}을(를) 한 ${blank('담을 것')}에 ${blank('몇')}${blank('세는 말')}씩 담으려고 합니다. 몇 ${blank('담을 것')}이(가) ${rem > 0 ? '되고' : '되는지'}${leftover} 구해 봅시다.`
      : `${blank('무엇')} ${blank('전체 수')}${blank('세는 말')}을(를) ${blank('몇')}명의 ${blank('누구')}에게 똑같이 나누어 주려고 합니다. 한 명에게 몇 ${blank('세는 말')}씩 줄 수 있${rem > 0 ? '고' : '는지'}${leftover} 구해 봅시다.`;
    return `이런 틀을 보고 빈칸에 내 문제의 내용을 넣어 직접 써 봐요. 내 말로 바꾸어도 좋아요.<br>✏️ ${frame}`;
  }
  return '';
}

function toggleHelp(id, btn) {
  const box = $(id);
  const willShow = box.classList.contains('hidden');
  if (willShow) box.innerHTML = helpText(id);
  box.classList.toggle('hidden', !willShow);
  btn.classList.toggle('on', willShow);
}

// 이 차시에 맞는 수인지 학생 눈높이로 설명
function explainRule(level, n, d) {
  if (!Number.isInteger(n) || !Number.isInteger(d)) return '';
  if (d < 2 || d > 9) return '나누는 수는 2부터 9까지로 정해 봐요.';
  const t = Math.floor(n / 10) % 10, o = n % 10, h = Math.floor(n / 100);
  if (level <= 1 && !(n >= 10 && n <= 90 && o === 0)) return '이 시간에는 몇십(10, 20, … 90)을 나누어요.';
  if ((level === 2 || level === 3) && !(n >= 11 && n <= 99 && o !== 0)) return '이 시간에는 몇십몇(예: 36, 72)을 나누어요. 일의 자리가 0이 아니게 해 봐요.';
  if (level >= 4 && !(n >= 100 && n <= 999)) return '이 시간에는 세 자리 수(100~999)를 나누어요.';
  if (level <= 3 && t < d) return `몫이 두 자리 수가 되려면 십의 자리 수(${t})가 ${d}보다 크거나 같아야 해요.`;
  if (level === 0 && t % d !== 0) return `십의 자리 ${j(t, '을', '를')} ${j(d, '으로', '로')} 나누면 남는 것이 생겨요. 남김없이 나누어떨어지는 수로 바꿔 볼까요?`;
  if (level === 1 && t % d === 0) return '이건 내림이 없는 나눗셈이에요. 십의 자리를 나눌 때 남는 것이 생기는 수로 바꿔 볼까요?';
  if (level === 2 && t % d !== 0) return `십의 자리 ${j(t, '을', '를')} ${j(d, '으로', '로')} 나누면 남는 것이 생겨요. 십의 자리도 남김없이 나누어떨어지게 해 봐요.`;
  if (level === 2 && o % d !== 0) return `일의 자리 ${j(o, '을', '를')} ${j(d, '으로', '로')} 나누면 남는 것이 생겨요. 일의 자리도 남김없이 나누어떨어지게 해 봐요.`;
  if (level === 3 && t % d === 0) return '이건 내림이 없는 나눗셈이에요. 십의 자리를 나눌 때 남는 것이 생기는 수로 바꿔 볼까요?';
  if ((level === 1 || level === 3) && n % d !== 0) return `${n} ÷ ${d}는 마지막에 ${j(n % d, '이', '가')} 남아요. 남는 것이 없게 바꿔 볼까요?`;
  if (level === 4 && h < d) return `백의 자리 ${j(h, '이', '가')} ${d}보다 작아서 몫이 두 자리가 돼요. 이 시간에는 몫이 세 자리가 되게 만들어요.`;
  if (level === 5 && h >= d) return `백의 자리 ${j(h, '이', '가')} ${d}보다 크거나 같아서 몫이 세 자리가 돼요. 이 시간에는 몫이 두 자리가 되게 만들어요.`;
  return '이 시간에 만드는 나눗셈과 맞지 않아요.';
}

function updateMaker() {
  const m = state.maker;
  const level = state.board?.level ?? 0;
  m.item = $('itemInput').value.trim();
  m.unit = $('unitInput').value.trim();
  m.total = $('totalInput').value === '' ? null : Number($('totalInput').value);
  m.divisor = $('divisorInput').value === '' ? null : Number($('divisorInput').value);
  m.target = $('targetInput').value.trim();
  const unit = m.unit || '개';

  $('step4').classList.toggle('hidden', !m.mode);
  if (m.mode === 'group') {
    $('targetInput').placeholder = '봉지, 상자 …';
    $('step4Before').textContent = '';
    $('step4Mid').textContent = `${unit}씩,`;
    $('step4After').textContent = '에 담기';
  } else {
    $('step4Before').textContent = '';
    $('targetInput').placeholder = '친구, 모둠 …';
    $('step4Mid').textContent = '명(곳)의';
    $('step4After').textContent = '에게 나누어 주기';
  }

  let ok = false;
  const box = $('checkBox');
  if (m.mode && m.total != null && m.divisor != null) {
    ok = Boolean(LEVEL_RULES[level]?.test(m.total, m.divisor));
    box.classList.remove('hidden');
    box.className = `check-box ${ok ? 'ok' : 'bad'}`;
    box.textContent = ok
      ? `👍 좋아요! ${m.total} ÷ ${j(m.divisor, '은', '는')} 이 시간에 만드는 나눗셈에 딱 맞아요. 이제 문장으로 써 볼까요?`
      : `🤔 ${explainRule(level, m.total, m.divisor)}`;
  } else {
    box.classList.add('hidden');
  }

  const ready = ok && m.item;
  $('step5').classList.toggle('hidden', !ready);
  // 이미 열려 있는 도움말은 바뀐 내용으로 새로 고침
  document.querySelectorAll('.help-box:not(.hidden)').forEach(b => { b.innerHTML = helpText(b.id); });

  const q = $('questionInput').value;
  $('aiPolishBtn').classList.toggle('hidden', !state.aiOn || !q.trim());
  const nums = (q.match(/\d+/g) || []).map(Number);
  const hasNums = nums.includes(m.total) && nums.includes(m.divisor);
  $('postBtn').disabled = !(ready && q.trim() && hasNums);
  $('postMsg').className = 'msg error';
  $('postMsg').textContent = ready && q.trim().length > 5 && !hasNums
    ? `문장에 ${j(m.total, '과', '와')} ${j(m.divisor, '이', '가')} 들어가야 해요.` : '';
}

async function aiPolish() {
  const m = state.maker;
  const q = $('questionInput').value.trim();
  const rem = m.total % m.divisor;
  const btn = $('aiPolishBtn');
  btn.disabled = true;
  btn.textContent = '✨ AI가 생각하는 중...';
  const box = $('aiSuggest');
  try {
    const res = await aiChat({
      messages: [
        { role: 'system', content: '당신은 초등학교 3학년 수학 선생님입니다. 학생이 만든 나눗셈 문제 문장을 자연스럽게 다듬어 줍니다. 다듬은 문장만 답합니다.' },
        { role: 'user', content: `학생 문장: "${q}"

다듬는 규칙:
- 숫자 ${m.total}과 ${m.divisor}를 그대로 쓰세요. 다른 숫자를 더하지 마세요.
- 상황(${m.mode === 'share' ? '똑같이 나누어 주기' : '몇 개씩 묶어 담기'})과 물건(${m.item})을 바꾸지 마세요.
- ${rem > 0 ? '남는 양을 묻는 부분을 유지하세요.' : '남는 양은 묻지 마세요.'}
- 정답을 쓰지 마세요. 2문장 이내로, 3학년이 읽기 쉽게 써 주세요.` }
      ],
      temperature: 0.5,
      max_tokens: 200
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const suggestion = data.choices?.[0]?.message?.content?.trim().replace(/^["“]|["”]$/g, '') || '';
    const nums = (suggestion.match(/\d+/g) || []).map(Number);
    const asksLeft = /남는|남은|나머지/.test(suggestion);
    if (!suggestion || !nums.includes(m.total) || !nums.includes(m.divisor) || (rem > 0) !== asksLeft) {
      box.innerHTML = '🤖 이번에는 알맞게 다듬지 못했어요. 지금 문장도 충분히 좋아요!';
    } else {
      box.innerHTML = `🤖 이렇게 바꿔 보면 어때요?<br><b>${esc(suggestion)}</b>
        <div class="maker-actions"><button class="btn btn-primary btn-small" id="useAiBtn" type="button">이 문장 쓰기</button>
        <button class="btn btn-soft btn-small" id="keepMineBtn" type="button">내 문장 그대로</button></div>`;
      $('useAiBtn').onclick = () => { $('questionInput').value = suggestion; box.classList.add('hidden'); updateMaker(); };
      $('keepMineBtn').onclick = () => box.classList.add('hidden');
    }
  } catch {
    box.innerHTML = '🤖 AI와 연결이 잠시 안 돼요. 내 문장으로 올려도 괜찮아요!';
  }
  box.classList.remove('hidden');
  btn.disabled = false;
  btn.textContent = '✨ AI에게 문장 다듬기 도움 받기';
}

async function submitPost() {
  const m = state.maker;
  $('postBtn').disabled = true;
  try {
    const data = await api('POST', {
      action: 'post', boardId: state.board.id, number: state.me,
      item: m.item, unit: m.unit || '개', total: m.total, divisor: m.divisor, mode: m.mode,
      question: $('questionInput').value.trim()
    });
    closeMaker();
    applyBoard(data);
    Swal.fire({ title: '게시판에 올렸어요! 📌', text: '이제 친구들의 문제도 풀어 볼까요?', icon: 'success', timer: 2000, showConfirmButton: false });
  } catch (e) {
    $('postMsg').textContent = e.message;
    $('postMsg').className = 'msg error';
    $('postBtn').disabled = false;
  }
}

// ===== 이벤트 연결 =====
function setupEvents() {
  $('numberSaveBtn').onclick = () => {
    const n = Number($('numberInput').value);
    if (!Number.isInteger(n) || n < 1 || n > 40) {
      $('numberMsg').textContent = '1부터 40 사이의 번호를 써 주세요.';
      $('numberMsg').className = 'msg error';
      return;
    }
    setMe(n);
    $('numberMsg').textContent = '좋아요! 이제 게시판을 골라요. 👇';
    $('numberMsg').className = 'msg';
  };
  $('numberInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('numberSaveBtn').click(); });
  $('changeNumberBtn').onclick = () => { setMe(null); backToList(); $('numberInput').focus(); };

  $('boardListArea').addEventListener('click', e => {
    const tile = e.target.closest('[data-board]');
    if (tile) openBoard(tile.dataset.board);
  });

  // 선생님
  $('teacherToggleBtn').onclick = () => { $('teacherLoginBox').classList.toggle('hidden'); $('teacherPwInput').focus(); };
  $('teacherLoginBtn').onclick = () => teacherLogin($('teacherPwInput').value);
  $('teacherPwInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('teacherLoginBtn').click(); });
  $('teacherLogoutBtn').onclick = teacherLogout;
  $('levelSelect').innerHTML = LEVEL_RULES.map((r, i) => `<option value="${i}">${LESSONS[i].lesson} ${r.name}</option>`).join('');
  $('dateInput').value = today();
  $('createBoardBtn').onclick = async () => {
    try {
      await api('POST', { action: 'createBoard', level: Number($('levelSelect').value), date: $('dateInput').value, title: $('titleInput').value.trim() });
      $('titleInput').value = '';
      await loadBoardList();
      toast('게시판을 열었어요!', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };
  $('teacherBoards').addEventListener('click', e => {
    const open = e.target.closest('[data-open]');
    const lock = e.target.closest('[data-lock]');
    if (open) openBoard(open.dataset.open);
    if (lock) setLock(lock.dataset.lock, lock.dataset.locked !== '1');
  });

  // 게시판 화면
  $('backBtn').onclick = backToList;
  $('makeBtn').onclick = openMaker;
  $('closeMakerBtn').onclick = closeMaker;
  $('presentBtn').onclick = () => {
    const on = document.body.classList.toggle('present');
    $('presentBtn').textContent = on ? '🖥️ 보통 보기' : '🖥️ 크게 보기';
  };
  $('lockBtn').onclick = () => setLock(state.board.id, !state.board.locked);
  $('sortBtn').onclick = () => {
    state.sort = state.sort === 'like' ? 'new' : 'like';
    renderCards(true);
    renderSortBtn();
  };

  // 확대보기 닫기: ✕ 버튼, 바깥 누르기, Esc
  $('zoomCloseBtn').onclick = closeZoom;
  $('zoomView').addEventListener('click', e => { if (e.target === $('zoomView')) closeZoom(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.zoomId) closeZoom(); });

  $('cards').addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.solve) solve(t.dataset.solve);
    if (t.dataset.like) toggleLike(t.dataset.like, t.dataset.liked !== '1');
    if (t.dataset.zoom) openZoom(t.dataset.zoom);
    if (t.dataset.comment) addComment(t.dataset.comment);
    if (t.dataset.delPost) teacherDelete('post', t.dataset.delPost);
    if (t.dataset.delComment) teacherDelete('comment', t.dataset.post, t.dataset.delComment);
  });
  $('cards').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const key = e.target.dataset?.keep || '';
    const postId = key.slice(2);
    if (key.startsWith('c-')) addComment(postId);
    if (key.startsWith('q-') || key.startsWith('r-')) solve(postId);
  });

  // 문제 설계 도우미
  $('maker').addEventListener('click', e => {
    const h = e.target.closest('[data-help]');
    if (h) toggleHelp(h.dataset.help, h);
  });
  document.querySelectorAll('.mode-card').forEach(card => {
    card.onclick = () => {
      document.querySelectorAll('.mode-card').forEach(c => c.classList.toggle('on', c === card));
      state.maker.mode = card.dataset.mode;
      updateMaker();
    };
  });
  ['itemInput', 'unitInput', 'totalInput', 'divisorInput', 'targetInput', 'questionInput'].forEach(id => $(id).addEventListener('input', updateMaker));
  $('aiPolishBtn').onclick = aiPolish;
  $('postBtn').onclick = submitPost;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.board) refreshBoard();
  });
}

// ===== 시작 =====
async function init() {
  setupEvents();
  const saved = Number(storage.get('myNumber'));
  if (saved) setMe(saved);
  const pw = storage.get('teacherPw');
  if (pw) await teacherLogin(pw);
  aiAvailable().then(on => { state.aiOn = on; });
  loadBoardList();
}

init();
