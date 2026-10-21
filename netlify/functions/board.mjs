// ===== 문제 공유 게시판 서버 함수 (/api/board) =====
// 저장소: Netlify Blobs   선생님 비밀번호: Netlify 환경 변수 TEACHER_PASSWORD
//
// 여러 학생이 동시에 써도 글이 사라지지 않도록, 글·풀이·댓글을 '각자 다른 칸(key)'에 저장합니다.
// (같은 칸에 동시에 쓰면 마지막 것만 남기 때문)
//
//   index                               게시판 목록 (선생님만 씀)
//   meta/<게시판>                        게시판 정보: 차시, 제목, 날짜, 잠금 (선생님만 씀)
//   log/<게시판>/p/<번호>-<id>           학생이 만든 문제
//   log/<게시판>/s/<문제id>/<번호>-<id>  풀이 기록
//   log/<게시판>/c/<문제id>/<id>         댓글
//   log/<게시판>/d/<id>                  선생님 삭제 표시 (원본은 남김)
//   snap/<게시판>                        위 기록을 모아 둔 사본 (읽기를 빠르게 하는 용도, 없어져도 다시 만듦)

import { getStore } from '@netlify/blobs';
import { LEVEL_RULES } from '../../src/divisionRules.js';

const MAX_POSTS_PER_STUDENT = 3;
const MAX_COMMENT_LENGTH = 100;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });

class UserError extends Error {}

// 미리보기(시험) 배포와 실제 사이트의 데이터를 분리
function openStore(req, context) {
  const host = new URL(req.url).hostname;
  const deployContext = context?.deploy?.context || process.env.CONTEXT || '';
  const isProduction = deployContext === 'production' && !host.startsWith('deploy-preview-');
  return getStore({ name: isProduction ? 'board' : 'board-preview', consistency: 'strong' });
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const cleanText = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const isStudentNumber = n => Number.isInteger(n) && n >= 1 && n <= 40;
const safeId = v => /^[0-9a-z-]{1,40}$/.test(String(v || ''));

function isTeacher(req) {
  const pw = process.env.TEACHER_PASSWORD;
  return Boolean(pw) && req.headers.get('x-teacher-password') === pw;
}

async function listKeys(store, prefix) {
  const keys = [];
  for await (const page of store.list({ prefix, paginate: true })) {
    for (const b of page.blobs) keys.push(b.key);
  }
  return keys;
}

async function getMeta(store, boardId) {
  if (!safeId(boardId)) throw new UserError('게시판을 찾을 수 없어요.');
  const meta = await store.get(`meta/${boardId}`, { type: 'json' });
  if (!meta) throw new UserError('게시판을 찾을 수 없어요.');
  return meta;
}

// 기록을 모아 게시판 모습으로 만들기
async function loadBoard(store, meta, { clientRev } = {}) {
  const prefix = `log/${meta.id}/`;
  const keys = await listKeys(store, prefix);
  const rev = `${keys.length}-${meta.updatedAt || meta.createdAt}`;
  if (clientRev && clientRev === rev) return { unchanged: true, rev };

  const snap = (await store.get(`snap/${meta.id}`, { type: 'json' })) || { events: {} };
  const missing = keys.filter(k => !(k in snap.events));
  if (missing.length) {
    const loaded = await Promise.all(missing.map(k => store.get(k, { type: 'json' })));
    missing.forEach((k, i) => { if (loaded[i]) snap.events[k] = loaded[i]; });
    await store.setJSON(`snap/${meta.id}`, snap); // 사본 갱신 (경쟁해도 원본 기록은 그대로라 안전)
  }

  const deleted = new Set();
  const posts = new Map();
  const solves = [];
  const comments = [];
  for (const [key, ev] of Object.entries(snap.events)) {
    const type = key.slice(prefix.length).split('/')[0];
    if (type === 'd') deleted.add(ev.targetId);
    else if (type === 'p') posts.set(ev.id, { ...ev, solves: {}, comments: [] });
    else if (type === 's') solves.push(ev);
    else if (type === 'c') comments.push(ev);
  }
  for (const s of solves.sort((a, b) => a.at - b.at)) {
    const p = posts.get(s.postId);
    if (!p) continue;
    const prev = p.solves[s.number] || { number: s.number, correct: false, tries: 0 };
    prev.tries += 1;
    prev.correct = prev.correct || s.correct;
    p.solves[s.number] = prev;
  }
  for (const c of comments) {
    if (!deleted.has(c.id) && posts.get(c.postId)) posts.get(c.postId).comments.push(c);
  }
  const list = [...posts.values()]
    .filter(p => !deleted.has(p.id))
    .map(p => ({ ...p, solves: Object.values(p.solves), comments: p.comments.sort((a, b) => a.at - b.at) }))
    .sort((a, b) => a.createdAt - b.createdAt);

  return { ...meta, rev, posts: list };
}

// 학생에게 보낼 때는 정답을 숨김 (자기 문제와 선생님은 보임)
function forViewer(board, { teacher, me }) {
  if (board.unchanged) return board;
  return {
    ...board,
    posts: board.posts.map(p => {
      if (teacher || p.number === me) return p;
      const { quotient, remainder, ...rest } = p;
      return rest;
    })
  };
}

// 게시판 목록 (선생님만 쓰므로 동시 저장 걱정 없음)
async function saveMeta(store, meta) {
  meta.updatedAt = Date.now();
  await store.setJSON(`meta/${meta.id}`, meta);
  const index = (await store.get('index', { type: 'json' })) || { boards: [] };
  const i = index.boards.findIndex(b => b.id === meta.id);
  if (i >= 0) index.boards[i] = meta; else index.boards.push(meta);
  await store.setJSON('index', index);
}

export default async (req, context) => {
  const store = openStore(req, context);
  const teacher = isTeacher(req);
  const url = new URL(req.url);

  try {
    // ----- 읽기 -----
    if (req.method === 'GET') {
      if (url.searchParams.has('list')) {
        return json((await store.get('index', { type: 'json' })) || { boards: [] });
      }
      const meta = await getMeta(store, url.searchParams.get('board'));
      const board = await loadBoard(store, meta, { clientRev: url.searchParams.get('rev') });
      return json(forViewer(board, { teacher, me: Number(url.searchParams.get('me')) }));
    }

    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ----- 선생님 기능 -----
    if (action === 'teacherCheck') {
      if (!process.env.TEACHER_PASSWORD) return json({ ok: false, error: 'Netlify에 TEACHER_PASSWORD가 아직 설정되지 않았어요.' }, 503);
      return teacher ? json({ ok: true }) : json({ ok: false, error: '선생님 비밀번호가 맞지 않아요.' }, 401);
    }

    if (['createBoard', 'setLock', 'renameBoard', 'deletePost', 'deleteComment'].includes(action)) {
      if (!teacher) return json({ error: '선생님 비밀번호가 맞지 않아요.' }, 401);

      if (action === 'createBoard') {
        const level = Number(body.level);
        if (!LEVEL_RULES[level]) throw new UserError('차시를 골라 주세요.');
        const meta = {
          id: newId(), level,
          date: /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : new Date().toISOString().slice(0, 10),
          title: cleanText(body.title, 40) || LEVEL_RULES[level].name,
          locked: false, createdAt: Date.now()
        };
        await saveMeta(store, meta);
        return json(await loadBoard(store, meta));
      }

      const meta = await getMeta(store, body.boardId);
      if (action === 'setLock') { meta.locked = Boolean(body.locked); await saveMeta(store, meta); }
      if (action === 'renameBoard') { meta.title = cleanText(body.title, 40) || meta.title; await saveMeta(store, meta); }
      if (action === 'deletePost' || action === 'deleteComment') {
        const targetId = action === 'deletePost' ? body.postId : body.commentId;
        if (!safeId(targetId)) throw new UserError('대상을 찾을 수 없어요.');
        await store.setJSON(`log/${meta.id}/d/${newId()}`, { targetId, at: Date.now() });
      }
      return json(await loadBoard(store, meta));
    }

    // ----- 학생 기능 -----
    const number = Number(body.number);
    if (!isStudentNumber(number)) throw new UserError('번호(1~40)를 확인해 주세요.');
    const meta = await getMeta(store, body.boardId);
    if (meta.locked) throw new UserError('이 게시판은 잠겨 있어요.');

    if (action === 'post') {
      const total = Number(body.total);
      const divisor = Number(body.divisor);
      const item = cleanText(body.item, 12);
      const question = cleanText(body.question, 300);
      if (!item || !question) throw new UserError('빈칸을 모두 채워 주세요.');
      if (!LEVEL_RULES[meta.level].test(total, divisor)) throw new UserError('이 시간에 만드는 나눗셈과 맞지 않는 수예요.');
      const nums = (question.match(/\d+/g) || []).map(Number);
      if (!nums.includes(total) || !nums.includes(divisor)) throw new UserError('문장에 두 수가 모두 들어가야 해요.');
      const mine = await listKeys(store, `log/${meta.id}/p/${number}-`);
      if (mine.length >= MAX_POSTS_PER_STUDENT) throw new UserError(`문제는 한 사람이 ${MAX_POSTS_PER_STUDENT}개까지 올릴 수 있어요.`);

      const id = `${number}-${newId()}`;
      await store.setJSON(`log/${meta.id}/p/${id}`, {
        id, number, item, total, divisor,
        unit: cleanText(body.unit, 4) || '개',
        mode: body.mode === 'group' ? 'group' : 'share',
        question,
        quotient: Math.floor(total / divisor), remainder: total % divisor,
        createdAt: Date.now()
      }, { onlyIfNew: true });
      return json(forViewer(await loadBoard(store, meta), { teacher, me: number }));
    }

    if (!safeId(body.postId)) throw new UserError('문제를 찾을 수 없어요.');
    const post = await store.get(`log/${meta.id}/p/${body.postId}`, { type: 'json' });
    if (!post) throw new UserError('문제를 찾을 수 없어요.');

    if (action === 'solve') {
      const q = Number(body.quotient);
      const r = Number(body.remainder || 0);
      const result = { quotientCorrect: q === post.quotient, remainderCorrect: r === post.remainder };
      result.correct = result.quotientCorrect && result.remainderCorrect;
      if (post.number !== number) { // 자기 문제 풀이는 기록하지 않음
        await store.setJSON(`log/${meta.id}/s/${post.id}/${number}-${newId()}`, {
          postId: post.id, number, correct: result.correct, at: Date.now()
        });
      }
      return json(result);
    }

    if (action === 'comment') {
      const text = cleanText(body.text, MAX_COMMENT_LENGTH);
      if (!text) throw new UserError('댓글을 써 주세요.');
      const id = newId();
      await store.setJSON(`log/${meta.id}/c/${post.id}/${id}`, { id, postId: post.id, number, text, at: Date.now() });
      return json(forViewer(await loadBoard(store, meta), { teacher, me: number }));
    }

    return json({ error: '알 수 없는 요청' }, 400);
  } catch (err) {
    if (err instanceof UserError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: '잠시 문제가 생겼어요. 다시 눌러 주세요.' }, 500);
  }
};

export const config = { path: '/api/board' };
