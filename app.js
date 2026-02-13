// app.js (Bracket Ride Tweet App)
import {
  loadActiveRun,
  saveActiveRun,
  clearActiveRun,
  startNewRun,
  archiveRunToHistory,
  loadHistory,
  setRunSaved,
  deleteRunFromHistory,
  getMostRecentHistoryRun,
  popMostRecentHistoryRun,
  getRunLastDecisionISO,
  hoursSinceISO
} from "./storage.js";

const RESUME_WINDOW_HOURS = 36;

const appEl = document.getElementById("app");
const dialogHost = document.getElementById("dialogHost");

const moreBtn = document.getElementById("moreBtn");
const moreMenu = document.getElementById("moreMenu");
const shareUpdateMenuBtn = document.getElementById("shareUpdateMenuBtn");
const settingsMenuBtn = document.getElementById("settingsMenuBtn");
const endToStartBtn = document.getElementById("endToStartBtn");

const roundBar = document.getElementById("roundBar");
const counterPill = document.getElementById("counterPill");

let rides = [];
let ridesById = new Map();

let active = null;

// Round metadata
const ROUNDS = [
  { id: "R1", label: "Round 1", matchups: 16, multiplier: 1 },
  { id: "R2", label: "Round 2", matchups: 8, multiplier: 2 },
  { id: "R3", label: "Round 3", matchups: 4, multiplier: 3 },
  { id: "R4", label: "Round 4", matchups: 2, multiplier: 4 },
  { id: "R5", label: "Round 5", matchups: 1, multiplier: 5 }
];

init();

async function init() {
  setupMoreMenu();

  rides = await fetch("./rides.json").then(r => r.json());
  // Normalize ride schema
  rides = (Array.isArray(rides) ? rides : []).map(r => ({
    ...r,
    basePoints: Number(r?.basePoints ?? r?.pointsRound1 ?? r?.points ?? 10),
    seed: Number(r?.seed ?? 0),
    land: String(r?.land ?? "TL")
  }));
  ridesById = new Map(rides.map(r => [r.id, r]));

  active = loadActiveRun();

  if (active?.bracket && !Array.isArray(active.events)) {
    active.events = [];
    saveActiveRun(active);
  }

  if (active) {
    setHeaderEnabled(true);
    renderBracketPage();
  } else {
    setHeaderEnabled(false);
    renderStartPage();
  }
}

function setHeaderEnabled(enabled) {
  moreBtn.disabled = !enabled;
  counterPill.style.display = enabled ? "inline-flex" : "none";
  moreBtn.style.display = enabled ? "inline-flex" : "none";
  if (!enabled) roundBar.innerHTML = "";
}

function setupMoreMenu() {
  moreBtn.addEventListener("click", (e) => {
    if (moreBtn.disabled) return;
    e.stopPropagation();
    const expanded = moreBtn.getAttribute("aria-expanded") === "true";
    moreBtn.setAttribute("aria-expanded", String(!expanded));
    moreMenu.setAttribute("aria-hidden", String(expanded));
  });

  document.addEventListener("click", () => {
    moreBtn.setAttribute("aria-expanded", "false");
    moreMenu.setAttribute("aria-hidden", "true");
  });

  shareUpdateMenuBtn.addEventListener("click", () => {
    closeMore();
    if (!active) return;
    openBracketImageDialog();
  });

  settingsMenuBtn.addEventListener("click", () => {
    closeMore();
    if (!active) return;
    openSettingsDialog();
  });

  endToStartBtn.addEventListener("click", () => {
    closeMore();
    if (!active) return;
    openConfirmDialog({
      title: "End challenge?",
      body: "This will save this bracket into Recent history, clear the active run, and return to Start.",
      confirmText: "End and return to Start",
      confirmClass: "btnDanger",
      onConfirm: () => {
        if (active && (active.events?.length ?? 0) > 0) {
          archiveRunToHistory({ ...active, endedAt: new Date().toISOString() }, { saved: false });
        }
        clearActiveRun();
        active = null;
        setHeaderEnabled(false);
        renderStartPage();
      }
    });
  });
}

function closeMore() {
  moreBtn.setAttribute("aria-expanded", "false");
  moreMenu.setAttribute("aria-hidden", "true");
}

/* =========================
   Start page
   ========================= */

function getResumeCandidate() {
  const mostRecent = getMostRecentHistoryRun();
  if (!mostRecent) return null;

  const events = Array.isArray(mostRecent.events) ? mostRecent.events : [];
  if (events.length <= 0) return null;

  const lastISO = getRunLastDecisionISO(mostRecent);
  if (!lastISO) return null;

  const hoursAgo = hoursSinceISO(lastISO);
  if (!(hoursAgo <= RESUME_WINDOW_HOURS)) return null;

  const lastLabel = formatDateShort(new Date(lastISO)) + " at " + formatTime12(new Date(lastISO));
  const decided = countDecisions(mostRecent);

  return { run: mostRecent, lastLabel, decided };
}

function renderStartPage() {
  document.body.dataset.page = "start";

  applyRoundTheme("R1");

  const resume = getResumeCandidate();

  appEl.innerHTML = `
    <div class="stack">
      <div class="card">
        <div class="h1">Welcome</div>
        <p class="p">Run the Every Ride March Magic Bracket Challenge on March 14, 2026. Experience attractions, earn points, and auto-open tweet drafts.</p>
        <div class="btnRow" style="margin-top:12px;">
          <button id="rulesBtn" class="btn" type="button">Rules</button>
          <button id="bracketBtn" class="btn" type="button">Bracket</button>
        </div>

      </div>

      ${resume ? `
        <div class="card">
          <div class="h1">Resume run</div>
          <p class="p" style="margin-top:6px;">Last attraction: ${escapeHtml(resume.lastLabel)}<br/>${resume.decided}/31 attractions completed</p>
          <div class="btnRow" style="margin-top:12px;">
            <button id="resumeBtn" class="btn btnPrimary" type="button">Resume</button>
          </div>
        </div>
      ` : ""}

      <div class="card">
        <div class="h1">Start a new challenge</div>

        <div class="fieldLabel">Tags and hashtags (modify as needed)</div>
        <textarea id="tagsText" class="textarea tagsBox">#ERMarchMagic @RideEvery\n\nHelp me support @GKTWVillage by donating at the link below</textarea>

        <div class="fieldLabel">My fundraising link (modify as needed)</div>
        <input id="fundLinkText" class="fundBox" type="text" value="${escapeHtml(active?.settings?.fundraisingLink || "")}" placeholder="https://…">
<div class="btnRow" style="margin-top:12px;">
          <button id="startBtn" class="btn btnPrimary" type="button">Start new challenge</button>
            <button id="historyBtn" class="btn" type="button">Previous brackets</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("startBtn")?.addEventListener("click", () => {
    const tagsText = (document.getElementById("tagsText")?.value ?? "").trim();
    const fundraisingLink = (document.getElementById("fundLinkText")?.value ?? "").trim();
    active = startNewRun({ tagsText, fundraisingLink });
    active.bracket = buildInitialBracket();
    saveActiveRun(active);

    setHeaderEnabled(true);
    renderBracketPage();
  });

  document.getElementById("resumeBtn")?.addEventListener("click", () => {
    const candidate = getResumeCandidate();
    if (!candidate) return;

    openConfirmDialog({
      title: "Resume run?",
      body: `Last attraction: ${candidate.lastLabel}`,
      confirmText: "Resume run",
      confirmClass: "",
      onConfirm: () => handleResumeMostRecent()
    });
  });

  document.getElementById("bracketBtn")?.addEventListener("click", () => {
    openDialog({
      title: "Bracket",
      body: "Bracket view coming next (and will support printing).",
      buttons: [{ text: "Close", className: "btn btnPrimary", action: () => closeDialog() }]
    });
  });

  document.getElementById("rulesBtn")?.addEventListener("click", () => {
    openDialog({
      title: "Rules",
      body: "",
      content: `<div class="card" style="border:1px solid rgba(17,24,39,.12);">
        <div style="font-weight:900; margin-bottom:6px;">(Placeholder)</div>
        <div class="p">We\'ll put the official ER March Magic Bracket Challenge rules here.</div>
      </div>`,
      buttons: [{ text: "Close", className: "btn btnPrimary", action: () => closeDialog() }]
    });
  });

  document.getElementById("historyBtn")?.addEventListener("click", () => openHistoryDialog());
}

function handleResumeMostRecent() {
  const run = popMostRecentHistoryRun();
  if (!run) {
    showToast("No recent run available to resume.");
    return;
  }

  // Re-open: clear ended/saved markers
  delete run.endedAt;
  delete run.saved;
  delete run.savedAt;

  // Ensure structure exists
  run.settings = run.settings || {};
  run.events = Array.isArray(run.events) ? run.events : [];
  run.bracket = run.bracket || buildInitialBracket();

  active = run;
  saveActiveRun(active);

  setHeaderEnabled(true);
  renderBracketPage();
}

/* =========================
   Bracket model
   ========================= */

function buildInitialBracket() {
  // Expect rides.json already has Ride1..Ride32 in order. We'll trust that order for now.
  // R1 matchups: (0,1), (2,3), ... (30,31)
  const ids = rides.map(r => r.id);

  const rounds = {};
  rounds.R1 = [];
  for (let i = 0; i < 32; i += 2) {
    rounds.R1.push({
      id: crypto.randomUUID(),
      a: ids[i],
      b: ids[i + 1],
      winner: null,
      loser: null,
      decidedAt: null
    });
  }

  // Later rounds exist as empty arrays until unlocked
  rounds.R2 = [];
  rounds.R3 = [];
  rounds.R4 = [];
  rounds.R5 = [];

  return {
    currentRoundId: "R1",
    rounds
  };
}

function isRoundComplete(roundId) {
  if (!active?.bracket?.rounds?.[roundId]) return false;
  return active.bracket.rounds[roundId].every(m => !!m.winner);
}

function currentRoundId() {
  return active?.bracket?.currentRoundId || "R1";
}


function syncDownstreamRounds() {
  // Build each round progressively based on available winners from previous round.
  const order = ["R1","R2","R3","R4","R5"];
  for (let i = 0; i < order.length - 1; i++) {
    const prevId = order[i];
    const nextId = order[i+1];

    const prev = active.bracket.rounds[prevId] || [];
    const next = active.bracket.rounds[nextId] || [];

    // winners list may include nulls if matches undecided
    const winners = prev.map(m => m?.winner || null);

    // next has matchups = prev.length/2
    const needed = Math.floor(prev.length / 2);
    if (!Array.isArray(active.bracket.rounds[nextId])) active.bracket.rounds[nextId] = [];

    // ensure array has length needed; create empty shells if needed
    while (active.bracket.rounds[nextId].length < needed) {
      active.bracket.rounds[nextId].push({
        id: crypto.randomUUID(),
        a: null,
        b: null,
        winner: null,
        loser: null,
        decidedAt: null
      });
    }
    if (active.bracket.rounds[nextId].length > needed) {
      active.bracket.rounds[nextId] = active.bracket.rounds[nextId].slice(0, needed);
    }

    // populate each matchup's a/b if both prerequisites are decided
    for (let k = 0; k < needed; k++) {
      const left = winners[2*k];
      const right = winners[2*k + 1];
      const mm = active.bracket.rounds[nextId][k];

      if (left && right) {
        // Only set if not already set; if changed due to undo, clear downstream decisions
        if (mm.a !== left || mm.b !== right) {
          mm.a = left;
          mm.b = right;
          mm.winner = null;
          mm.loser = null;
          mm.decidedAt = null;

          // Also clear all further rounds, because their inputs might change.
          for (let j = i+2; j < order.length; j++) {
            active.bracket.rounds[order[j]] = [];
          }
        }
      } else {
        // Not ready: clear matchup participants/decision
        mm.a = null;
        mm.b = null;
        mm.winner = null;
        mm.loser = null;
        mm.decidedAt = null;
      }
    }
  }
}

function ensureNextRoundIfReady(roundIdJustCompleted) {
  const idx = ROUNDS.findIndex(r => r.id === roundIdJustCompleted);
  if (idx < 0) return;

  const next = ROUNDS[idx + 1];
  if (!next) {
    // Champion decided
    active.bracket.currentRoundId = "R5";
    return;
  }

  // If already built, do nothing
  if (Array.isArray(active.bracket.rounds[next.id]) && active.bracket.rounds[next.id].length > 0) {
    active.bracket.currentRoundId = next.id;
    return;
  }

  // Build next round from winners of prior
  const prior = active.bracket.rounds[roundIdJustCompleted];
  const winners = prior.map(m => m.winner).filter(Boolean);
  if (winners.length !== next.matchups * 2) return; // not ready

  const out = [];
  for (let i = 0; i < winners.length; i += 2) {
    out.push({
      id: crypto.randomUUID(),
      a: winners[i],
      b: winners[i + 1],
      winner: null,
      loser: null,
      decidedAt: null
    });
  }

  active.bracket.rounds[next.id] = out;
  active.bracket.currentRoundId = next.id;
}

/* =========================
   Rendering: bracket page
   ========================= */

function renderBracketPage() {
  document.body.dataset.page = "bracket";

  if (!active?.bracket) {
    // Safety: if somehow missing, rebuild
    active.bracket = buildInitialBracket();
    saveActiveRun(active);
  }

  syncDownstreamRounds();

  const roundId = currentRoundId();
  const roundMeta = ROUNDS.find(r => r.id === roundId) || ROUNDS[0];

  // header
  const pts = computePointsTotal();
  const roundDone = countRoundDecisions(roundId);
  const roundTotal = (active.bracket.rounds[roundId]?.length ?? roundMeta.matchups);
  counterPill.textContent = `Pts: ${pts}`;
  renderRoundBar(roundId);
  applyRoundTheme(roundId);
  // Round dropdown lives in the top bar

  const roundArr = active.bracket.rounds[roundId] || [];
  const matchups = roundArr.length ? roundArr : new Array(roundMeta.matchups).fill(null).map((_, i) => ({ __placeholder: true, index: i }));
  const matchHtml = `
    <div class="matchups">
      ${matchups.map((m, i) => (m.__placeholder ? renderLockedMatchCard(roundId, i, roundMeta) : renderMatchCard(roundId, m, i))).join("")}
    </div>
  `;

  appEl.innerHTML = `
    <div class="stack">
      ${matchHtml}
    </div>
  `;


  // wire match picks + undo
  appEl.querySelectorAll("[data-pick]").forEach(btn => {
    btn.addEventListener("click", () => {
      const matchId = btn.getAttribute("data-match");
      const pickId = btn.getAttribute("data-pick");
      const rId = btn.getAttribute("data-round");
      if (!matchId || !pickId || !rId) return;
      handlePickWinner(rId, matchId, pickId);
    });
  });

  appEl.querySelectorAll("[data-undo]").forEach(btn => {
    btn.addEventListener("click", () => {
      const matchId = btn.getAttribute("data-undo");
      const rId = btn.getAttribute("data-round");
      if (!matchId || !rId) return;
      undoDecision(rId, matchId);
    });
  });
}


function renderRoundBar(selectedRoundId) {
  roundBar.innerHTML = ROUNDS.map(r => {
    const enabled = isRoundUnlocked(r.id);
    const activeClass = r.id === selectedRoundId ? "isActive" : "";
    return `<button class="roundBtn ${activeClass}" type="button" data-round="${r.id}" ${enabled ? "" : "disabled"}>${r.id}</button>`;
  }).join("");

  roundBar.querySelectorAll("[data-round]").forEach(btn => {
    btn.addEventListener("click", () => {
      const rid = btn.getAttribute("data-round");
      if (!rid) return;
      if (!isRoundUnlocked(rid)) return;
      active.bracket.currentRoundId = rid;
      saveActiveRun(active);
      renderBracketPage();
    });
  });
}

function applyRoundTheme(roundId) {
  const map = {
    R1: "var(--roundR1)",
    R2: "var(--roundR2)",
    R3: "var(--roundR3)",
    R4: "var(--roundR4)",
    R5: "var(--roundR5)"
  };
  document.documentElement.style.setProperty("--roundColor", map[roundId] || "var(--roundR1)");
}

function isRoundUnlocked(roundId) {
  // Navigation is always allowed; matchups will only populate when prerequisites are met.
  return true;
}

function renderMatchCard(roundId, m, idx) {
  if (!m?.a || !m?.b) {
    const roundMeta2 = ROUNDS.find(r => r.id === roundId) || ROUNDS[0];
    return renderLockedMatchCard(roundId, idx, roundMeta2);
  }

  const roundMeta = ROUNDS.find(r => r.id === roundId) || ROUNDS[0];
  const a = ridesById.get(m.a);
  const b = ridesById.get(m.b);

  const seedText = (a?.seed && b?.seed) ? `${a.seed} vs. ${b.seed} seed` : "";

  const pointsA = pointsForRideInRound(a, roundMeta);
  const pointsB = pointsForRideInRound(b, roundMeta);

  const decided = !!m.winner;
  const completedLine = decided && m.decidedAt ? `Completed ${formatTime12(new Date(m.decidedAt))}` : "";

  const aWinner = decided && m.winner === m.a;
  const bWinner = decided && m.winner === m.b;
  const aLoser = decided && m.loser === m.a;
  const bLoser = decided && m.loser === m.b;

  const advLabel = decided ? `${shortNameFor(m.winner)} (${pointsForWinnerFromMatch(roundId, m)})` : "—";
  const winnerLand = decided ? (ridesById.get(m.winner)?.land || "TL") : "TL";

  return `
    <div class="matchCard">
      <div class="matchHeader">
        <div class="matchTitle">Matchup ${idx + 1} · ${escapeHtml(roundMeta.label)}${seedText ? " · " + escapeHtml(seedText) : ""}</div>
      </div>

      <div class="matchBody">
        <div class="pickRow">
          <button class="pickBtn ${aWinner ? "isWinner" : ""} ${aLoser ? "isLoser" : ""}"
            type="button" data-round="${roundId}" data-match="${m.id}" data-pick="${m.a}" data-land="${escapeHtml(ridesById.get(m.a)?.land || "TL")}">
            <span>${escapeHtml(shortNameFor(m.a))} (${pointsA} pts)</span>
          </button>

          <button class="pickBtn ${bWinner ? "isWinner" : ""} ${bLoser ? "isLoser" : ""}"
            type="button" data-round="${roundId}" data-match="${m.id}" data-pick="${m.b}" data-land="${escapeHtml(ridesById.get(m.b)?.land || "TL")}">
            <span>${escapeHtml(shortNameFor(m.b))} (${pointsB} pts)</span>
          </button>
        </div>

        <div class="afterRow">
          ${decided ? `
            <div>
              <div class="advancePill pickBtn winner" data-land="${escapeHtml(winnerLand)}">${escapeHtml(advLabel)}</div>
              <div class="smallText">${escapeHtml(completedLine)}</div>
            </div>
            <button class="smallBtn" type="button" data-round="${roundId}" data-undo="${m.id}">Undo</button>
          ` : `
            <div class="smallText">Pick a ride to advance</div>
          `}
        </div>
        </div>
      </div>
    </div>
  `;
}


function lockMessageForRound(roundId) {
  if (roundId === "R2") return "Complete both Round 1 matchups to enable this matchup.";
  if (roundId === "R3") return "Complete both Round 2 matchups to enable this matchup.";
  if (roundId === "R4") return "Complete both Round 3 matchups to enable this matchup.";
  if (roundId === "R5") return "Complete both Round 4 matchups to enable this matchup.";
  return "Complete prerequisite matchups to enable this matchup.";
}

function renderLockedMatchCard(roundId, idx, roundMeta) {
  return `
    <div class="matchCard">
      <div class="matchHeader">
        <div class="matchTitle">Matchup ${idx + 1} · ${escapeHtml(roundMeta.label)}</div>
        <div class="matchMeta">${escapeHtml(roundId)}</div>
      </div>
      <div class="smallText" style="margin-top:6px;">
        ${escapeHtml(lockMessageForRound(roundId))}
      </div>
    </div>
  `;
}

function shortNameFor(rideId) {
  return ridesById.get(rideId)?.shortName || ridesById.get(rideId)?.name || rideId;
}

function pointsForRideInRound(ride, roundMeta) {
  const base = Number(ride?.basePoints ?? 10);
  const mult = Number(roundMeta?.multiplier ?? 1);
  return base * mult;
}

function pointsForWinnerFromMatch(roundId, match) {
  const roundMeta = ROUNDS.find(r => r.id === roundId) || ROUNDS[0];
  const winnerRide = ridesById.get(match.winner);
  return pointsForRideInRound(winnerRide, roundMeta);
}

function handlePickWinner(roundId, matchId, pickId) {
  if (!active?.bracket) return;

  // lock later rounds until earlier complete
  if (!isRoundUnlocked(roundId)) return;

  const round = active.bracket.rounds[roundId] || [];
  const m = round.find(x => x.id === matchId);
  if (!m) return;

  // If already decided, allow re-pick only via Undo (safer)
  if (m.winner) {
    showToast("Use Undo to change a decision.");
    return;
  }

  const winner = pickId;
  const loser = (winner === m.a) ? m.b : m.a;

  m.winner = winner;
  m.loser = loser;
  m.decidedAt = new Date().toISOString();

  // Record event (authoritative history)
  const roundMeta = ROUNDS.find(r => r.id === roundId) || ROUNDS[0];
  const pts = pointsForRideInRound(ridesById.get(winner), roundMeta);

  active.events = Array.isArray(active.events) ? active.events : [];
  active.events.push({
    id: crypto.randomUUID(),
    type: "match_decided",
    roundId,
    matchId,
    winnerId: winner,
    loserId: loser,
    points: pts,
    timeISO: m.decidedAt
  });

  saveActiveRun(active);

  // Tweet
  const attractionNumber = countDecisions(active);
  const matchupNumber = round.findIndex(x => x.id === matchId) + 1;
  const tagsText = active?.settings?.tagsText ?? active?.settings?.tweetTags ?? "";
  const fundraisingLink = active?.settings?.fundraisingLink ?? "";
  const tweet = buildDecisionTweet(attractionNumber, roundId, matchupNumber, winner, loser, pts, m.decidedAt, tagsText, fundraisingLink);
  openTweetDraft(tweet);

  // Populate downstream rounds opportunistically
  syncDownstreamRounds();
  saveActiveRun(active);

  renderBracketPage();
}


  
function undoDecision(roundId, matchId) {
  const round = active?.bracket?.rounds?.[roundId] || [];
  const m = round.find(x => x.id === matchId);
  if (!m || !m.winner) return;

  openConfirmDialog({
    title: "Undo this decision?",
    body: "This will clear the winner for this matchup. Later rounds may also be reset if they depended on this winner.",
    confirmText: "Undo",
    confirmClass: "",
    onConfirm: () => {
      // Remove event(s) for this match
      active.events = (active.events || []).filter(e => !(e.type === "match_decided" && e.roundId === roundId && e.matchId === matchId));

      // Clear this match
      m.winner = null;
      m.loser = null;
      m.decidedAt = null;

      // Rebuild all later rounds from scratch to guarantee correctness
      rebuildRoundsFromEvents();

      saveActiveRun(active);
      renderBracketPage();
    }
  });
}

function rebuildRoundsFromEvents() {
  // Reset bracket to initial, then replay events in order
  const tagsText = active?.settings?.tagsText ?? "";
  const events = Array.isArray(active.events) ? [...active.events] : [];

  active.bracket = buildInitialBracket();
  active.settings = active.settings || {};
  active.settings.tagsText = tagsText;

  // sort by timeISO just in case
  events.sort((a, b) => (Date.parse(a.timeISO || "") || 0) - (Date.parse(b.timeISO || "") || 0));

  // Replay each event if still valid in this structure
  for (const ev of events) {
    if (ev.type !== "match_decided") continue;
    const roundId = ev.roundId;
    const round = active.bracket.rounds[roundId];
    const m = Array.isArray(round) ? round.find(x => x.id === ev.matchId) : null;

    // If matchId no longer exists (because we rebuilt), try to match by participants
    let match = m;
    if (!match && Array.isArray(round)) {
      match = round.find(x => (x.a === ev.winnerId && x.b === ev.loserId) || (x.a === ev.loserId && x.b === ev.winnerId));
    }
    if (!match) continue;

    if (!match.winner) {
      match.winner = ev.winnerId;
      match.loser = ev.loserId;
      match.decidedAt = ev.timeISO || new Date().toISOString();
    }

    if (isRoundComplete(roundId)) {
      ensureNextRoundIfReady(roundId);
    }
  }

  // Populate downstream rounds based on replayed winners
  syncDownstreamRounds();

  // Keep current round at the earliest round that still has an undecided matchup with participants
  const order = ["R1","R2","R3","R4","R5"];
  for (const rid of order) {
    const arr = active.bracket.rounds[rid] || [];
    if (arr.some(m => m?.a && m?.b && !m?.winner)) {
      active.bracket.currentRoundId = rid;
      return;
    }
  }
  // Otherwise, default to the deepest round with any populated matchup
  for (let i = order.length - 1; i >= 0; i--) {
    const arr = active.bracket.rounds[order[i]] || [];
    if (arr.some(m => m?.a && m?.b)) {
      active.bracket.currentRoundId = order[i];
      return;
    }
  }
  active.bracket.currentRoundId = "R1";
}

function buildDecisionTweet(attractionNumber, roundId, matchupNumber, winnerId, loserId, points, timeISO, tagsText, fundraisingLink) {
  const w = shortNameFor(winnerId);
  const l = shortNameFor(loserId);
  const timeStr = formatTime12(new Date(timeISO));
  const totalPts = computePointsTotal(); // already includes this decision
  const roundNum = String(roundId).replace(/^R/, "");

  const base = `Attraction ${attractionNumber}. ${w} at ${timeStr}
(Round ${roundNum} Matchup ${matchupNumber} vs ${l})
This ride: ${points} points
Total today: ${totalPts} points`;

  const tags = (tagsText || "").trim();
  const link = (fundraisingLink || "").trim();

  // Append hashtags block (and link if present) separated by blank line, like the old app.
  let tail = "";
  if (tags) tail += `\n\n${tags}`;
  if (link) tail += `${tail ? "\n" : "\n\n"}${link}`;
  return base + tail;
}

function openTweetDraft(fullText) {
  const text = (fullText ?? "").trim();
  const url = new URL("https://twitter.com/intent/tweet");
  url.searchParams.set("text", text);
  window.open(url.toString(), "_blank", "noopener,noreferrer");
}

/* =========================
   Settings + history dialogs
   ========================= */

function openSettingsDialog() {
  const currentTags = (active?.settings?.tagsText ?? "").trim();

  openDialog({
    title: "Tweet text",
    body: "This is appended to every tweet (hashtags, etc.).",
    content: `
      <div class="formRow">
        <div class="label">Tags and hashtags (modify as needed)</div>
        <textarea id="settingsTags" class="textarea" style="min-height:120px;">${escapeHtml(currentTags)}</textarea>
      </div>
    `,
    buttons: [
      {
        text: "Save",
        className: "btn btnPrimary",
        action: () => {
          const newTags = (document.getElementById("settingsTags")?.value ?? "").trim();
          active.settings = active.settings || {};
          active.settings.tagsText = newTags;
          saveActiveRun(active);
          closeDialog();
          showToast("Saved.");
        }
      },
      { text: "Cancel", className: "btn", action: () => closeDialog() }
    ]
  });
}

function openBracketImageDialog() {
  try {
    // Make sure downstream rounds are synced so later-round slots populate when ready.
    syncDownstreamRounds();
    saveActiveRun(active);

    const dataUrl = buildBracketUpdateImage(active);
    openDialog({
      title: "Bracket update image",
      body: "Tap and hold to save, or use Download.",
      content: `
        <div style="display:flex; justify-content:center;">
          <img src="${dataUrl}" alt="Bracket update image" style="max-width:100%; border-radius:16px; border:1px solid rgba(0,0,0,.15);" />
        </div>
      `,
      buttons: [
        {
          text: "Download PNG",
          className: "btn btnPrimary",
          action: () => {
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = `ER_March_Magic_bracket_${active?.startedAt || "update"}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
          }
        },
        { text: "Close", className: "btn", action: () => closeDialog() }
      ]
    });
  } catch (e) {
    console.error(e);
    showToast("Could not build bracket image.");
  }
}

function buildBracketUpdateImage(run) {
  // Single, left-to-right 32-attraction bracket image
  const W = 1600;
  const H = 1600;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = "#111827";
  ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ER March Magic Bracket Challenge", W / 2, 42);

  // Geometry
  const marginTop = 160;
  const marginBottom = 80;
  const usableH = H - marginTop - marginBottom;

  // Keep text readable; tighten by using the available height efficiently
  const teams = 32;
  // --- vertical spacing: keep the 2 rides in a matchup tight, add extra space between matchups,
// and add a slightly larger gap between the two bracket halves (between teams 16 and 17).
const matchups = teams / 2;
const matchGapFactor = 0.5;   // +50% spacing between matchups vs within-match spacing
const halfGapFactor = 1.0;    // extra gap between halves (in units of teamStep)
const totalUnits = (teams - 1) + matchGapFactor * (matchups - 1) + halfGapFactor;
const teamStep = usableH / totalUnits;

const yBase = Array.from({ length: teams }, (_, i) => {
  const matchGap = Math.floor(i / 2) * (matchGapFactor * teamStep);
  const halfGap = (i >= 16) ? (halfGapFactor * teamStep) : 0;
  return marginTop + (i * teamStep) + matchGap + halfGap;
});

  // Round entry Y levels: entries for each round are the centers of the previous round's matchups
  function pairCenters(arr) {
    const out = [];
    for (let i = 0; i < arr.length; i += 2) out.push((arr[i] + arr[i + 1]) / 2);
    return out;
  }
  const yEntries = [
    yBase,                  // R1 entries (32)
    pairCenters(yBase),     // R2 entries (16)
    pairCenters(pairCenters(yBase)),              // R3 entries (8)
    pairCenters(pairCenters(pairCenters(yBase))), // R4 entries (4)
    pairCenters(pairCenters(pairCenters(pairCenters(yBase)))) // R5 entries (2)
  ];

  // Column widths (compact; leaves room for a champion column)
  const x0 = 70;
  const colTextW = 200; // tighter columns
  const connW = 25;
  const colGap = 15;
  const linePad = 10;

  const roundIds = ["R1", "R2", "R3", "R4", "R5"];
  const xCols = [x0];
  for (let i = 1; i < roundIds.length; i++) xCols.push(xCols[i - 1] + colTextW + connW + colGap);
  const xChamp = xCols[xCols.length - 1] + colTextW + connW + colGap;

  // Typography
  const fontEntry = "700 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const fontLabel = "800 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";

  // Helpers (ride label + points)
  function seedOf(id) {
    const r = ridesById.get(id);
    return r?.seed ?? "";
  }
  function labelFor(id) {
  if (!id) return "";
  const rawSeed = seedOf(id);
  const s = shortNameFor(id);

  // Requested "visual" alignment using literal spaces (even though font isn't monospace).
  // - Add 2 spaces BEFORE single-digit seeds
  // - Add 2 spaces AFTER every seed
  const seedStr0 = (rawSeed === null || rawSeed === undefined) ? "" : String(rawSeed).trim();
  if (!seedStr0) return s;

  const before = (seedStr0.length === 1) ? "  " : "";
  const after = "  ";
  return `${before}${seedStr0}${after}${s}`;
}
  function winnerPoints(roundId, match) {
    try { return pointsForWinnerFromMatch(roundId, match) || 0; } catch { return 0; }
  }

  // Drawing primitives
  ctx.strokeStyle = "rgba(17,24,39,.22)";
  ctx.lineWidth = 2;

  function drawLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawEntryText(x, y, id, isWinner, pts) {
    if (!id) return;
    const base = labelFor(id);
    const text = (isWinner && pts) ? `${base} (${pts})` : base;

    ctx.fillStyle = isWinner ? "#111827" : "rgba(17,24,39,.80)";
    ctx.font = fontEntry;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    const textOffset = 4;
    ctx.fillText(text, x, y - textOffset);
  }

  // Round headers
  ctx.fillStyle = "rgba(17,24,39,.70)";
  ctx.font = fontLabel;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < roundIds.length; i++) ctx.fillText(roundIds[i], xCols[i] + colTextW / 2, 78);
  ctx.fillText("CHAMP", xChamp + colTextW / 2, 78);

  // Draw blank bracket + entries round by round (fully connected), left-to-right
  const rounds = run?.bracket?.rounds || {};

  for (let r = 0; r < roundIds.length; r++) {
    const rid = roundIds[r];
    const matches = rounds[rid] || [];
    const entryYs = yEntries[r]; // length = 32 / (2^r)
    const xText = xCols[r];
    const joinX = xText + colTextW + connW;
    const nameStartX = xText - linePad;

    const nextNameStartX = (r < roundIds.length - 1)
      ? (xCols[r + 1] - linePad)
      : (xChamp - linePad);

    const matchCount = entryYs.length / 2;

    for (let m = 0; m < matchCount; m++) {
      const yA = entryYs[m * 2];
      const yB = entryYs[m * 2 + 1];
      const yMid = (yA + yB) / 2;

      // Always draw the blank bracket lines for this matchup
      drawLine(nameStartX, yA, joinX, yA);
      drawLine(nameStartX, yB, joinX, yB);
      drawLine(joinX, yA, joinX, yB);
      drawLine(joinX, yMid, nextNameStartX, yMid);

      // Draw names on top
      const mm = matches[m];
      if (mm) {
        const a = mm.a || null;
        const b = mm.b || null;
        const win = mm.winner || null;
        const pts = win ? winnerPoints(rid, mm) : 0;

        drawEntryText(xText, yA, a, win === a, (win === a) ? pts : 0);
        drawEntryText(xText, yB, b, win === b, (win === b) ? pts : 0);
      }
    }
  }

  // Champion text (winner of R5 if present)
  const finalMatch = (rounds.R5 && rounds.R5[0]) ? rounds.R5[0] : null;
  const champId = finalMatch?.winner || null;
  const yChamp = (yEntries[4][0] + yEntries[4][1]) / 2;

  // Draw a visible champ line even before a winner is decided
  drawLine(xChamp - linePad, yChamp, xChamp + colTextW, yChamp);

  if (champId) {
    // Draw a bold champion name on top of the champion line
    ctx.fillStyle = "#111827";
    ctx.font = "900 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(labelFor(champId), xChamp, yChamp);
  }

  return canvas.toDataURL("image/png");
}

function openHistoryDialog() {
  const hist = loadHistory();
  const sorted = [...hist].sort((a, b) => {
    const ta = Date.parse(a.endedAt || a.startedAt || "") || 0;
    const tb = Date.parse(b.endedAt || b.startedAt || "") || 0;
    return tb - ta;
  });

  const saved = sorted.filter(x => x.saved === true);
  const recent = sorted.filter(x => x.saved !== true).slice(0, 20);

  const rowHtml = (run, section) => {
    const started = run.startedAt ? new Date(run.startedAt) : null;
    const label = started ? `${formatDateShort(started)} ${formatTime12(started)}` : "—";
    const decided = countDecisions(run);

    const viewBtn = `<button class="smallBtn" type="button" data-hview="${run.id}">View</button>`;
    const saveBtn = section === "recent"
      ? `<button class="smallBtn" type="button" data-hsave="${run.id}">Save</button>`
      : `<button class="smallBtn" type="button" disabled style="opacity:.35;">Save</button>`;
    const delBtn = `<button class="smallBtn" type="button" data-hdel="${run.id}">Delete</button>`;

    return `
      <tr>
        <td style="white-space:nowrap;">${escapeHtml(label)}</td>
        <td style="text-align:center; white-space:nowrap;">${decided}/31</td>
        <td style="white-space:nowrap; text-align:right; display:flex; gap:8px; justify-content:flex-end;">
          ${saveBtn}
          ${viewBtn}
          ${delBtn}
        </td>
      </tr>
    `;
  };

  const tableHtml = (title, rows) => `
    <div style="margin-top:10px;">
      <div style="font-weight:900; margin:8px 0;">${escapeHtml(title)}</div>
      <div style="overflow:auto; border:1px solid rgba(17,24,39,.12); border-radius:12px;">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:rgba(34,211,238,.18);">
              <th style="text-align:left; padding:10px;">Started</th>
              <th style="text-align:center; padding:10px;">Decided</th>
              <th style="text-align:right; padding:10px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="3" style="padding:12px; color:#6b7280;">None yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  openDialog({
    title: "Brackets on this device",
    body: "",
    content: `
      ${tableHtml("Saved", saved.map(r => rowHtml(r, "saved")).join(""))}
      ${tableHtml("Recent (last 20)", recent.map(r => rowHtml(r, "recent")).join(""))}
    `,
    buttons: [{ text: "Close", className: "btn btnPrimary", action: () => closeDialog() }]
  });

  dialogHost.querySelectorAll("[data-hview]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-hview");
      const run = loadHistory().find(x => x.id === id);
      if (!run) return;

      openDialog({
        title: "Bracket summary",
        body: "",
        content: `
          <div class="card" style="border:1px solid rgba(17,24,39,.12);">
            <div style="font-weight:900;">Decided</div>
            <div style="margin-top:6px;">${countDecisions(run)}/31</div>
            <div style="margin-top:10px;font-weight:900;">Points</div>
            <div style="margin-top:6px;">${computePointsTotal(run)}</div>
          </div>
        `,
        buttons: [{ text: "Close", className: "btn btnPrimary", action: () => closeDialog() }]
      });
    });
  });

  dialogHost.querySelectorAll("[data-hsave]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-hsave");
      setRunSaved(id, true);
      closeDialog();
      openHistoryDialog();
      showToast("Saved.");
    });
  });

  dialogHost.querySelectorAll("[data-hdel]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-hdel");
      openConfirmDialog({
        title: "Delete this bracket?",
        body: "This will remove it from your device.",
        confirmText: "Delete",
        confirmClass: "btnDanger",
        onConfirm: () => {
          deleteRunFromHistory(id);
          closeDialog();
          openHistoryDialog();
        }
      });
    });
  });
}

/* =========================
   Stats helpers
   ========================= */

function countDecisions(run = active) {
  const ev = Array.isArray(run?.events) ? run.events : [];
  return ev.filter(e => e.type === "match_decided").length;
}

function countRoundDecisions(roundId) {
  const round = active?.bracket?.rounds?.[roundId] || [];
  return round.filter(m => !!m.winner).length;
}

function computePointsTotal(run = active) {
  const ev = Array.isArray(run?.events) ? run.events : [];
  return ev.filter(e => e.type === "match_decided").reduce((sum, e) => sum + (Number(e.points) || 0), 0);
}

/* =========================
   Dialog + toast
   ========================= */

function openConfirmDialog({ title, body, confirmText, confirmClass, onConfirm }) {
  openDialog({
    title,
    body: body || "",
    content: "",
    buttons: [
      {
        text: confirmText || "Confirm",
        className: `btn btnPrimary ${confirmClass || ""}`.trim(),
        action: () => { closeDialog(); onConfirm(); }
      },
      { text: "Cancel", className: "btn", action: () => closeDialog() }
    ]
  });
}

function openDialog({ title, body, content, buttons }) {
  dialogHost.innerHTML = `
    <div class="dialogBackdrop" role="presentation">
      <div class="dialog" role="dialog" aria-modal="true">
        <h3>${escapeHtml(title)}</h3>
        ${body ? `<p>${escapeHtml(body).replaceAll("\n", "<br/>")}</p>` : ""}
        ${content || ""}
        <div class="btnRow" style="margin-top:10px;">
          ${buttons.map((b, i) => `<button data-dbtn="${i}" type="button" class="${b.className || "btn"}">${escapeHtml(b.text)}</button>`).join("")}
        </div>
      </div>
    </div>
  `;

  dialogHost.querySelector(".dialogBackdrop")?.addEventListener("click", (e) => {
    if (e.target.classList.contains("dialogBackdrop")) closeDialog();
  });

  buttons.forEach((b, i) => {
    dialogHost.querySelector(`[data-dbtn="${i}"]`)?.addEventListener("click", b.action);
  });
}

function closeDialog() {
  dialogHost.innerHTML = "";
}

function showToast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

/* =========================
   Formatting + utils
   ========================= */

function formatDateShort(d) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function formatTime12(d) {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
