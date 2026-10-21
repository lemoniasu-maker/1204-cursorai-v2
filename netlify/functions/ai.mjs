// ===== AI 중계 서버 함수 (/api/ai) =====
// - API 키: Netlify 환경 변수 OPENAI_API_KEY
// - 모델: Netlify 환경 변수 AI_MODEL (없으면 gpt-4o-mini)
// 키·모델을 바꿀 때는 Netlify 환경 변수만 바꾸면 됩니다.

const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_TOKENS_LIMIT = 500;     // 한 번 답변 길이 상한 (요금 보호)
const MAX_INPUT_CHARS = 6000;     // 보내는 글자 수 상한 (요금 보호)

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (req.method === 'GET') {
    return json({ enabled: Boolean(apiKey) });
  }
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!apiKey) return json({ error: 'AI가 아직 연결되지 않았어요.' }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

  // 요청 검사: 대화 메시지만 받고, 길이와 답변 길이를 제한
  const messages = Array.isArray(body.messages) ? body.messages.slice(0, 4) : [];
  const valid = messages.every(m => ['system', 'user', 'assistant'].includes(m?.role) && typeof m.content === 'string');
  const totalChars = messages.reduce((n, m) => n + (m.content?.length || 0), 0);
  if (!messages.length || !valid || totalChars > MAX_INPUT_CHARS) return json({ error: 'bad request' }, 400);

  const temperature = Math.min(Math.max(Number(body.temperature ?? 0.5), 0), 1);
  const max_tokens = Math.min(Math.max(Number(body.max_tokens ?? 300), 1), MAX_TOKENS_LIMIT);

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.AI_MODEL || DEFAULT_MODEL,
      messages: messages.map(({ role, content }) => ({ role, content })),
      temperature,
      max_tokens
    })
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    console.error('OpenAI 오류', upstream.status, data?.error?.message);
    return json({ error: 'AI 응답 실패' }, 502);
  }
  return json(data);
};

export const config = { path: '/api/ai' };
