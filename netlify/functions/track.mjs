import { getStore } from "@netlify/blobs";

const MAX_BYTES = 200_000;
const num = (v, lo, hi, d = 0) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);
const str = (v, n) => String(v ?? "").slice(0, n).trim();

function cleanAttempt(a) {
  return {
    tp: str(a.tp, 8),
    m: a.m === "q" ? "q" : "p",
    ts: num(a.ts, 0, 9e15),
    eq: str(a.eq, 200),
    tries: Math.round(num(a.tries, 0, 999)),
    ft: !!a.ft,
    ok: !!a.ok,
    h: Math.round(num(a.h, 0, 99)),
    sol: !!a.sol,
  };
}
function cleanQuiz(q) {
  return {
    ts: num(q.ts, 0, 9e15),
    score: Math.round(num(q.score, 0, 100)),
    total: Math.round(num(q.total, 0, 100)),
  };
}

export default async (req) => {
  const text = await req.text();
  if (text.length > MAX_BYTES) return new Response("Too large", { status: 413 });
  let s;
  try { s = JSON.parse(text); } catch { return new Response("Bad JSON", { status: 400 }); }
  if (!s || typeof s.id !== "string" || !/^[a-z0-9-]{8,64}$/i.test(s.id)) {
    return new Response("Bad session id", { status: 400 });
  }
  const name = str(s.name, 60);
  if (!name) return new Response("Missing name", { status: 400 });

  const session = {
    id: s.id,
    name,
    period: str(s.period, 20),
    started: num(s.started, 0, 9e15, Date.now()),
    updated: Date.now(),
    activeSec: Math.round(num(s.activeSec, 0, 86400)),
    attempts: Array.isArray(s.attempts) ? s.attempts.slice(0, 400).map(cleanAttempt) : [],
    quizzes: Array.isArray(s.quizzes) ? s.quizzes.slice(0, 50).map(cleanQuiz) : [],
  };

  // One blob per session, written only by that student's browser, so writes never collide.
  await getStore("unit3-sessions").setJSON(session.id, session);
  return new Response(null, { status: 204 });
};

export const config = { path: "/api/track", method: "POST" };
