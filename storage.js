// storage.js (Bracket Ride Tweet App)
// Simple localStorage persistence with Active + History (Saved + Recent pattern)

const KEY_ACTIVE = "brw_activeBracket_v1";
const KEY_HISTORY = "brw_bracketHistory_v1";

export const MAX_RECENT_HISTORY = 20;

function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function loadActiveRun() {
  return safeJsonParse(localStorage.getItem(KEY_ACTIVE), null);
}

export function saveActiveRun(run) {
  localStorage.setItem(KEY_ACTIVE, JSON.stringify(run));
}

export function clearActiveRun() {
  localStorage.removeItem(KEY_ACTIVE);
}

export function loadHistory() {
  const arr = safeJsonParse(localStorage.getItem(KEY_HISTORY), []);
  return Array.isArray(arr) ? arr : [];
}

export function saveHistory(hist) {
  localStorage.setItem(KEY_HISTORY, JSON.stringify(hist));
}

export function getRunLastDecisionISO(run) {
  if (!run) return null;
  const ev = Array.isArray(run.events) ? run.events : [];
  if (ev.length > 0) {
    const last = ev[ev.length - 1];
    if (last?.timeISO) return last.timeISO;
  }
  return run.startedAt || null;
}

export function hoursSinceISO(isoString) {
  if (!isoString) return Infinity;
  const t = Date.parse(isoString);
  if (!Number.isFinite(t)) return Infinity;
  const diffMs = Date.now() - t;
  return diffMs / (1000 * 60 * 60);
}

function normalizeHistory(history) {
  // De-dupe by id, keep newest first
  const seen = new Set();
  const out = [];
  for (const item of history) {
    if (!item || !item.id) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }

  const saved = out.filter(x => x.saved === true);
  const recent = out.filter(x => x.saved !== true);

  const trimmedRecent = recent.slice(0, MAX_RECENT_HISTORY);

  return [...saved, ...trimmedRecent].sort((a, b) => {
    const ta = Date.parse(getRunLastDecisionISO(a) || "") || 0;
    const tb = Date.parse(getRunLastDecisionISO(b) || "") || 0;
    return tb - ta;
  });
}

export function archiveRunToHistory(run, { saved = false } = {}) {
  if (!run || !run.id) return;

  const nowISO = new Date().toISOString();
  const entry = safeClone(run);
  entry.endedAt = entry.endedAt || nowISO;
  entry.saved = !!saved;
  if (saved && !entry.savedAt) entry.savedAt = nowISO;

  const hist = loadHistory();
  const next = normalizeHistory([entry, ...hist]);
  saveHistory(next);
}

export function deleteRunFromHistory(id) {
  const hist = loadHistory();
  const next = hist.filter(h => h && h.id !== id);
  saveHistory(normalizeHistory(next));
}

export function setRunSaved(id, saved = true) {
  const hist = loadHistory();
  const now = new Date().toISOString();

  const next = hist.map(h => {
    if (!h || h.id !== id) return h;
    const copy = safeClone(h);
    copy.saved = !!saved;
    if (saved && !copy.savedAt) copy.savedAt = now;
    if (!saved) delete copy.savedAt;
    return copy;
  });

  saveHistory(normalizeHistory(next));
}

export function getMostRecentHistoryRun() {
  const hist = loadHistory();
  if (!hist.length) return null;

  let best = null;
  let bestT = -Infinity;
  for (const h of hist) {
    const iso = getRunLastDecisionISO(h);
    const t = Date.parse(iso || "") || 0;
    if (t > bestT) {
      bestT = t;
      best = h;
    }
  }
  return best;
}

export function popMostRecentHistoryRun() {
  const hist = loadHistory();
  if (!hist.length) return null;

  const best = getMostRecentHistoryRun();
  if (!best?.id) return null;

  const next = hist.filter(h => h && h.id !== best.id);
  saveHistory(normalizeHistory(next));
  return best;
}

export function startNewRun({ tagsText }) {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    startedAt: now.toISOString(),
    settings: {
      tagsText: (tagsText ?? "").trim()
    },
    // bracket is deterministic and stored to avoid recompute
    bracket: null,
    events: [] // authoritative for decisions
  };
}
