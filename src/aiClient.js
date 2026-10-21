// ===== AI 연결 도우미 =====
// 브라우저는 OpenAI에 직접 연결하지 않고, Netlify 서버 함수(/api/ai)를 거칩니다.
// API 키와 모델 이름은 Netlify 환경 변수에만 있어서 학생 화면에 드러나지 않습니다.

let statusPromise = null;

// AI가 연결되어 있는지 확인 (한 번만 물어보고 결과를 기억)
export function aiAvailable() {
  if (!statusPromise) {
    statusPromise = fetch('/api/ai')
      .then(r => (r.ok ? r.json() : { enabled: false }))
      .then(d => Boolean(d.enabled))
      .catch(() => false);
  }
  return statusPromise;
}

// OpenAI 형식의 요청을 서버로 보내고, OpenAI 형식의 응답을 그대로 돌려받음
export function aiChat(body) {
  return fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}
