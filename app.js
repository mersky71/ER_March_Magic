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
  if (moreBtn) {
    moreBtn.disabled = !enabled;
    moreBtn.style.display = enabled ? "inline-flex" : "none";
  }
  if (counterPill) counterPill.style.display = enabled ? "inline-flex" : "none";
  if (!enabled && roundBar) roundBar.innerHTML = "";
}

function setupMoreMenu() {
  if (!moreBtn || !moreMenu) return;

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

  shareUpdateMenuBtn?.addEventListener("click", () => {
    closeMore();
    if (!active) return;
    openBracketImageDialog().catch(() => {});
});

  settingsMenuBtn?.addEventListener("click", () => {
    closeMore();
    if (!active) return;
    openSettingsDialog();
  });

  endToStartBtn?.addEventListener("click", () => {
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
    openStartingBracketDialog().catch(() => {});
  });

  document.getElementById("rulesBtn")?.addEventListener("click", () => {
    openRulesDialog();
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
  const advStyle = decided && isTightLabelRide(m.winner) ? "font-size:12px;" : "";
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
            <span style="${isTightLabelRide(m.a) ? 'font-size:12px;' : ''}">${escapeHtml(shortNameFor(m.a))} (${pointsA} pts)</span>
          </button>

          <button class="pickBtn ${bWinner ? "isWinner" : ""} ${bLoser ? "isLoser" : ""}"
            type="button" data-round="${roundId}" data-match="${m.id}" data-pick="${m.b}" data-land="${escapeHtml(ridesById.get(m.b)?.land || "TL")}">
            <span style="${isTightLabelRide(m.b) ? 'font-size:12px;' : ''}">${escapeHtml(shortNameFor(m.b))} (${pointsB} pts)</span>
          </button>
        </div>

        <div class="afterRow">
          ${decided ? `
            <div>
              <div class="advancePill pickBtn winner" style="${advStyle}" data-land="${escapeHtml(winnerLand)}">${escapeHtml(advLabel)}</div>
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



function isTightLabelRide(rideId) {
  return rideId === "Belle" || rideId === "Fairyt. Hall";
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


function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}
async function openStartingBracketDialog() {
  try {
    // Starting bracket does not depend on an active run.
    let bgImg = null;
    let qrAppImg = null;
    let qrDonateImg = null;

    try { bgImg = await loadImage("mkpark15.jpg"); } catch { bgImg = null; }
    try { qrAppImg = await loadImage("mersky_app.png"); } catch { qrAppImg = null; }
    try { qrDonateImg = await loadImage("ER_donation.png"); } catch { qrDonateImg = null; }

    const dataUrl = buildStartingBracketImage(bgImg, qrAppImg, qrDonateImg);

    openDialog({
      title: "Every Ride March Magic",
      body: "",
      content: `
        <div style="display:flex; justify-content:center;">
          <img src="${dataUrl}" alt="Every Ride March Magic bracket" style="max-width:100%; border-radius:16px; border:1px solid rgba(0,0,0,.15);" />
        </div>
      `,
      buttons: [
        {
          text: "Share",
          className: "btn btnPrimary",
          action: async () => {
            try {
              const blob = await (await fetch(dataUrl)).blob();
              const file = new File([blob], "ER_March_Magic_starting_bracket.png", { type: "image/png" });

              const canShare =
                !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] }));

              if (!canShare) {
                showToast("Sharing isn't available on this device.");
                return;
              }

              await navigator.share({
                files: [file],
                title: "Every Ride March Magic"
              });
            } catch {
              // cancelled or failed
            }
          }
        },
        {
          text: "Download",
          className: "btn",
          action: () => {
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = "ER_March_Magic_starting_bracket.png";
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
    showToast("Could not build starting bracket.");
  }
}

function openRulesDialog() {
  openDialog({
    title: "Rules",
    body: "",
    content: `
      <div style="max-height:70vh; overflow:auto; padding-right:2px; line-height:1.35;">
        <div style="font-weight:900; font-size:16px; margin-top:2px;">The Challenge</div>
        <ul style="margin:8px 0 14px 18px;">
          <li>A new event from the Every Ride Challenge team!</li>
          <li>March Magic is a 32-attraction bracket-style event - complete attractions to advance them to the next round. Which ride will win your bracket?!</li>
          <li>Earn points, try to score the most!</li>
        </ul>

        <div style="font-weight:900; font-size:16px; margin-top:2px;">Required Elements</div>
        <ul style="margin:8px 0 14px 18px;">
          <li>Take a selfie while in the ride vehicle (or show seat or with character) and tweet with hashtags #ERMarchMagic and tag @RideEvery for credit for each</li>
          <li>If you use a LL, include screenshot showing ride and your name in the tweet</li>
          <li>An attraction can advance to the next round only if it has an “opponent” (no riding Space Mountain as your first 2 rides to advance it to Round 3)</li>
          <li>For attractions where you could “hop off,” include proof you experienced the attraction (mid-ride/show video or photo)</li>
        </ul>

        <div style="font-weight:900; font-size:16px; margin-top:2px;">Strongly Encouraged</div>
        <ul style="margin:8px 0 14px 18px;">
          <li>Use a time stamp camera to help out the official scorers</li>
          <li>Use the app to draft your tweets and track your run <span style="color:#6b7280;">[add link]</span></li>
          <li>Create a fundraising page to support Give Kids the World Village and include the link in your tweets <span style="color:#6b7280;">[add link]</span>. Share to family and friends!</li>
          <li>Meet in the Hub at end of night for group photo!</li>
        </ul>

        <div style="font-weight:900; font-size:16px; margin-top:2px;">Other considerations</div>
        <ul style="margin:8px 0 0 18px;">
          <li>Points in later rounds = Round 1 points multiplied by round number</li>
          <li>Main St Entertainment: Each of these can be done once: 1) Main St Vehicles, 2) Dapper Dans (watch 5 min), 3) Festival of Fantasy Parade, 4) Starlight Parade, 5) Happily Ever After. Take selfies at beginning and end of each</li>
          <li>No Early Entry (but okay to ride Main St Vehicles prior to park open)</li>
          <li>LL Multi Pass and LL Single Pass are allowed; no LLs carried over from a previous day</li>
        <li>LL Premier Pass, VIP tours, etc. are not allowed!</li>
          <li>A multi-experience (anytime) pass must be used for its original ride</li>
          
        </ul>
      </div>
    `,
    buttons: [{ text: "Close", className: "btn btnPrimary", action: () => closeDialog() }]
  });
}

async function openBracketImageDialog() {
  try {
    // Make sure downstream rounds are synced so later-round slots populate when ready.
    syncDownstreamRounds();
    saveActiveRun(active);

    let bgImg = null;
    try { bgImg = await loadImage("mkpark15.jpg"); } catch (e) { bgImg = null; }
    const dataUrl = buildBracketUpdateImage(active, bgImg);
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

function buildStartingBracketImage(bgImg, qrAppImg, qrDonateImg) {
  // Printable starting bracket: 32 teams in R1 only, full bracket lines through CHAMP.
  const W = 2200;
  const H = 1600;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background (cover crop)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  if (bgImg) {
    const iw = bgImg.naturalWidth || bgImg.width;
    const ih = bgImg.naturalHeight || bgImg.height;
    const scale = Math.max(W / iw, H / ih);
    const sw = W / scale;
    const sh = H / scale;
    const sx = (iw - sw) / 2;
    const sy = (ih - sh) / 2;
    try { ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, W, H); } catch (e) { /* ignore */ }
  }

  // Title + headers (match update image style)
  ctx.fillStyle = "#000";
  ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ER March Magic Bracket Challenge", W / 2, 42);

  // Geometry
  const marginTop = 160;
  const marginBottom = 80;
  const usableH = H - marginTop - marginBottom;

  const teams = 32;
  const matchups = teams / 2;
  const matchGapFactor = 0.5;
  const halfGapFactor = 1.0;
  const totalUnits = (teams - 1) + matchGapFactor * (matchups - 1) + halfGapFactor;
  const teamStep = usableH / totalUnits;

  const yBase = Array.from({ length: teams }, (_, i) => {
    const matchGap = Math.floor(i / 2) * (matchGapFactor * teamStep);
    const halfGap = (i >= 16) ? (halfGapFactor * teamStep) : 0;
    return marginTop + (i * teamStep) + matchGap + halfGap;
  });

  function pairCenters(arr) {
    const out = [];
    for (let i = 0; i < arr.length; i += 2) out.push((arr[i] + arr[i + 1]) / 2);
    return out;
  }
  const yEntries = [
    yBase,
    pairCenters(yBase),
    pairCenters(pairCenters(yBase)),
    pairCenters(pairCenters(pairCenters(yBase))),
    pairCenters(pairCenters(pairCenters(pairCenters(yBase))))
  ];

  // Columns
  const x0 = 70;

  // R1 stays as-is; shrink R2+ (and CHAMP) widths by 40% to open space on the right.
  const colTextW_base = 210;
  const colTextW_R1 = Math.round(colTextW_base * 1.25);
  const otherScale = 0.60; // 40% shrink
  const colTextW = Math.round(colTextW_base * otherScale);

  const connW_base = 25;
  const colGap_base = 15;
  const connW_R1 = connW_base;
  const connW = Math.max(10, Math.round(connW_base * otherScale));
  const colGap = Math.max(8, Math.round(colGap_base * otherScale));
  const linePad = 10;

  const roundIds = ["R1", "R2", "R3", "R4", "R5"];
  const xCols = [x0];

  // R2 starts after the widened R1 column
  xCols.push(xCols[0] + colTextW_R1 + connW_R1 + colGap);

  // R3+ use original width
  for (let i = 2; i < roundIds.length; i++) xCols.push(xCols[i - 1] + colTextW + connW + colGap);

  const xChamp = xCols[xCols.length - 1] + colTextW + connW + colGap;

  // Typography
  const fontEntry = "700 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const fontLabel = "800 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";

  // Helpers
  function seedOf(id) {
    const r = ridesById.get(id);
    return r?.seed ?? "";
  }
  function labelFor(id) {
    if (!id) return "";
    const rawSeed = seedOf(id);
    const s = shortNameFor(id);
    const seedStr0 = (rawSeed === null || rawSeed === undefined) ? "" : String(rawSeed).trim();
    if (!seedStr0) return s;
    const before = (seedStr0.length === 1) ? "  " : "";
    const after = "  ";
    return `${before}${seedStr0}${after}${s}`;
  }
  const roundMetaR1 = ROUNDS.find(r => r.id === "R1") || ROUNDS[0];

  // Drawing primitives
  ctx.strokeStyle = "rgba(17,24,39,.22)";
  ctx.lineWidth = 3;

  function drawLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawR1EntryText(x, y, id) {
    if (!id) return;
    const base = labelFor(id);
    const pts = pointsForRideInRound(ridesById.get(id), roundMetaR1);
    const text = `${base} (${pts} pts)`;
    ctx.fillStyle = "#000";
    ctx.font = isTightLabelRide(id) ? "700 20px system-ui, -apple-system, Segoe UI, Roboto, Arial" : fontEntry;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(text, x, y - 4);
  }

  // Round headers
  ctx.fillStyle = "#000";
  ctx.font = fontLabel;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < roundIds.length; i++) {
    const tw = (i === 0) ? colTextW_R1 : colTextW;
    ctx.fillText(roundIds[i], xCols[i] + tw / 2, 78);

    // Points multiplier labels (starting bracket only)
    if (i >= 1) {
      const mult = i + 1; // R2->2, R3->3, R4->4, R5->5
      ctx.font = "700 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(`(Points x${mult})`, xCols[i] + tw / 2, 102);
      ctx.font = fontLabel;
    }
  }
  ctx.fillText("CHAMP", xChamp + colTextW / 2, 78);

// Bracket structure comes from the canonical initial bracket (same seeds/matchups as the app)
  const run = { bracket: buildInitialBracket() };
  const rounds = run?.bracket?.rounds || {};

  // Draw full bracket; populate ONLY R1 entries
  for (let r = 0; r < roundIds.length; r++) {
    const rid = roundIds[r];
    const matches = rounds[rid] || [];
    const entryYs = yEntries[r];
    const xText = xCols[r];
    const tw = (r === 0) ? colTextW_R1 : colTextW;
    const joinX = xText + tw + connW;
    const nameStartX = xText - linePad;

    const nextNameStartX = (r < roundIds.length - 1)
      ? (xCols[r + 1] - linePad)
      : (xChamp - linePad);

    const matchCount = entryYs.length / 2;

    for (let m = 0; m < matchCount; m++) {
      const yA = entryYs[m * 2];
      const yB = entryYs[m * 2 + 1];
      const yMid = (yA + yB) / 2;

      // Bracket lines
      drawLine(nameStartX, yA, joinX, yA);
      drawLine(nameStartX, yB, joinX, yB);
      drawLine(joinX, yA, joinX, yB);
      drawLine(joinX, yMid, nextNameStartX, yMid);

      // R1 labels only
      if (r === 0) {
        const mm = matches[m];
        if (mm) {
          drawR1EntryText(xText, yA, mm.a || null);
          drawR1EntryText(xText, yB, mm.b || null);
        }
      }
    }
  }

  // Champion line (blank)
  const yChamp = (yEntries[4][0] + yEntries[4][1]) / 2;
  drawLine(xChamp - linePad, yChamp, xChamp + colTextW, yChamp);

  // ---- Rules block (lower-right) ----
  // Full-height rules block on the right.
  const sideMargin = 60;
  const topY = 120;
  const bottomY = H - 60;
  const boxY = topY;
  const boxH = bottomY - topY;

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // Text wrapping helper
  function wrapLines(text, maxWidth, font) {
    ctx.font = font;
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? (line + " " + w) : w;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // ---- QR codes (right side, stacked next to Rules) ----
  // Reserve a QR column just left of the Rules box.
  const qrTarget = 280;
  const qrPad = 14;
  const qrGapY = 28;
  const qrLabelFont = "800 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const qrLabelLineH = 22;
  const qrLabelMaxLines = 3;
  const qrLabelH = qrLabelLineH * qrLabelMaxLines;
  const qrCardH = qrTarget + 12 + qrLabelH;

  // Keep QR cards within the same vertical span as the bracket area.
  const bracketTop = marginTop - 40;
  const bracketBottom = marginTop + usableH + 10;
  const qrColTop = Math.max(topY, bracketTop);
  const qrColBottom = Math.min(bottomY, bracketBottom);
  const qrColH = qrColBottom - qrColTop;

  // Compute QR size so two stacked cards fit.
  const maxQrSizeByHeight = Math.floor((qrColH - qrGapY - (12 + qrLabelH) * 2) / 2);
  const qrSize = Math.max(160, Math.min(qrTarget, maxQrSizeByHeight));
  const qrCardW = qrSize + qrPad * 2;

  // Rules box width: consume remaining right-side space after QR column.
  const rightAvailW = W - xChamp - sideMargin;
  const qrToRulesGap = 24;
  const boxW = Math.max(520, rightAvailW - qrCardW - qrToRulesGap);
  const boxX = W - sideMargin - boxW;

  // QR column x
  const qrColX = boxX - qrToRulesGap - qrCardW;

  // Place one QR above and one below the CHAMP line y.
  const champY = yChamp;
  const qr1Y = Math.max(qrColTop, Math.floor(champY - qrGapY / 2 - qrCardH));
  const qr2Y = Math.min(qrColBottom - qrCardH, Math.floor(champY + qrGapY / 2));

  function drawQrCard(x, y, img, label) {
    // Backing (slightly translucent)
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#ffffff";
    roundRect(x, y, qrCardW, qrSize + 12 + qrLabelH, 18);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    roundRect(x, y, qrCardW, qrSize + 12 + qrLabelH, 18);
    ctx.stroke();
    ctx.restore();

    // Image
    const ix = x + qrPad;
    const iy = y + qrPad;
    try { if (img) ctx.drawImage(img, ix, iy, qrSize, qrSize); } catch {}

    // Label
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const centerX = ix + qrSize / 2;
    const ly = iy + qrSize + 12;
    const lines = wrapLines(label, qrSize, qrLabelFont);
    ctx.font = qrLabelFont;
    let yy = ly;
    for (const line of lines.slice(0, qrLabelMaxLines)) {
      ctx.fillText(line, centerX, yy);
      yy += qrLabelLineH;
    }
  }

  drawQrCard(qrColX, qr1Y, qrAppImg, "Use this web app to track your run and generate your tweets!");
  drawQrCard(qrColX, qr2Y, qrDonateImg, "Make your fundraising page here!");

  // Backing so black text is readable on the map
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#ffffff";
  roundRect(boxX, boxY, boxW, boxH, 18);
  ctx.fill();
  ctx.restore();

  // Subtle outline so the box edge is visible while still letting the map show through
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  roundRect(boxX, boxY, boxW, boxH, 18);
  ctx.stroke();
  ctx.restore();

  const pad = 26;
  let x = boxX + pad;
  let y = boxY + pad;

  const fontTitle = "900 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const fontH = "900 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const fontB = "700 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const fontS = "700 17px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const maxTextW = boxW - pad * 2;

  // Centered title
  ctx.fillStyle = "#000";
  ctx.font = fontTitle;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Rules", boxX + boxW / 2, y);
  y += 40;


  function drawHeader(t) {
    ctx.fillStyle = "#000";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = fontH;
    ctx.fillText(t, x, y);
    y += 28;
  }

  function drawBullets(items) {
    for (const item of items) {
      const bullet = "•";
      ctx.font = fontB;
      const lines = wrapLines(item, maxTextW - 18, fontB);
      ctx.fillStyle = "#000";
      ctx.fillText(bullet, x, y);
      let yy = y;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x + 18, yy);
        yy += 19;
      }
      y = yy + 4;
      // stop if we're running out of vertical space
      if (y > boxY + boxH - 30) return;
    }
  }

  drawHeader("The Challenge");
  drawBullets([
    "A new event from the Every Ride Challenge team!",
    "March Magic is a 32-attraction bracket-style event — complete attractions to advance them to the next round. Which ride will win your bracket?!",
    "Earn points, try to score the most!"
  ]);

  drawHeader("Required Elements");
  drawBullets([
    "Take a selfie while in the ride vehicle (or show seat/with character) and tweet with hashtags #ERMarchMagic and tag @RideEvery for credit for each",
    "If you use a LL, include a screenshot showing the ride and your name in the tweet",
    "An attraction can advance to the next round only if it has an opponent (no riding Space Mountain as your first 2 rides to advance it to Round 3)",
    "For attractions where you could “hop off,” include proof you experienced the attraction (mid-ride/show photo or video)"
  ]);

  drawHeader("Strongly Encouraged");
  drawBullets([
    "Use a time stamp camera to help out the official scorers",
    "Use the app to draft your tweets and track your run [add link]",
    "Create a fundraising page to support Give Kids the World Village and include the link in your tweets [add link]. Share to family and friends!",
    "Meet in the Hub at end of night for group photo!"
  ]);

  drawHeader("Other considerations");
  ctx.font = fontS;
  drawBullets([
    "Points in later rounds = Round 1 points multiplied by round number",
    "Main St Entertainment: Each of these can be done once: 1) Main St Vehicles, 2) Dapper Dans (watch 5 min), 3) Festival of Fantasy Parade, 4) Starlight Parade, 5) Happily Ever After. Take selfies at beginning and end of each",
    "No Early Entry (but okay to ride Main St Vehicles prior to park open)",
    "LL Multi Pass and LL Single Pass are allowed; no LLs carried over from a previous day",
    "LL Premier Pass, VIP tours, etc. are not allowed!",
    "A multi-experience (anytime) pass must be used for its original ride"
  ]);

return canvas.toDataURL("image/png");
}


function buildBracketUpdateImage(run, bgImg) {
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
  if (bgImg) {
    const iw = bgImg.naturalWidth || bgImg.width;
    const ih = bgImg.naturalHeight || bgImg.height;
    const scale = Math.max(W / iw, H / ih);
    const sw = W / scale;
    const sh = H / scale;
    const sx = (iw - sw) / 2;
    const sy = (ih - sh) / 2;
    try { ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, W, H); } catch (e) { /* ignore */ }
    // Fade it heavily so it stays a background
    }

  // Title
  ctx.fillStyle = "#111827";
  ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ER March Magic Bracket Challenge", W / 2, 42);

  // Geometry
  const marginTop = 160;
  const marginBottom = 80;
  const marginR = 70;
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
  const colTextW = 210; // tighter columns
  const connW = 25;
  const colGap = 15;
  const linePad = 10;

  const roundIds = ["R1", "R2", "R3", "R4", "R5"];
  const xCols = [x0];
  for (let i = 1; i < roundIds.length; i++) xCols.push(xCols[i - 1] + colTextW + connW + colGap);
  const xChamp = xCols[xCols.length - 1] + colTextW + connW + colGap;

  // Stats box (top-right)
  const totalMatchups = 31;
  const matchupsDone = countDecisions(run);
  const pointsTotal = computePointsTotal(run);

  const lastDecisionISO = (() => {
    const evs = Array.isArray(run?.events) ? run.events : [];
    let best = null;
    for (const e of evs) {
      if (e && e.type === "match_decided" && typeof e.timeISO === "string") {
        if (!best || e.timeISO > best) best = e.timeISO;
      }
    }
    return best;
  })();

  const asOfDate = (matchupsDone >= totalMatchups && lastDecisionISO)
    ? new Date(lastDecisionISO)
    : new Date();

  const asOfStr = asOfDate.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  // Stats box position: top-right, spanning the visual space over the R5 + CHAMP columns.
  // We anchor the left edge to the start of the R5 column and let the box extend to the
  // right margin so it doesn't drift back over the R4 geometry.
  const statsY = 120;
  const statsX = Math.min(xCols[4] + 40, W - marginR - 320); // xCols[4] == R5 column start
  const statsW = Math.max(320, W - marginR - statsX);
  const statsH = 170;

  const statsPad = 16;
  const pointsBoxH = 56;
  const pointsBoxY = statsY + 92;

  ctx.save();
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 2;
  ctx.strokeRect(statsX, statsY, statsW, statsH);

  // Centered, bold text for all lines
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  ctx.font = "700 20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(`As of ${asOfStr} ET`, statsX + statsW / 2, statsY + 16);
  ctx.fillText(
    `${matchupsDone} of ${totalMatchups} matchups complete`,
    statsX + statsW / 2,
    statsY + 48
  );

  // Inset points box (more prominent)
  ctx.strokeRect(statsX + statsPad, pointsBoxY, statsW - statsPad * 2, pointsBoxH);
  ctx.font = "800 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textBaseline = "middle";
  ctx.fillText(
    `${pointsTotal} points`,
    statsX + statsW / 2,
    pointsBoxY + pointsBoxH / 2
  );

  ctx.restore();


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

  function drawEntryText(x, y, id, isWinner, pts, decided = false) {
    if (!id) return;
    const base = labelFor(id);
    const text = (isWinner && pts) ? `${base} (${pts})` : base;

    ctx.fillStyle = decided ? (isWinner ? "#16a34a" : "#dc2626") : "rgba(17,24,39,.80)";
    ctx.font = isTightLabelRide(id) ? "700 18px system-ui, -apple-system, Segoe UI, Roboto, Arial" : fontEntry;
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
  const originalRounds = run?.bracket?.rounds || {};

// For the bracket image we want to show advancement as soon as a winner exists,
// even if the next-round matchup isn't "enabled" yet in the UI.
// So we derive a rounds structure by propagating winners forward (without setting next-round winners).
const rounds = (() => {
      // Start from whatever the run has saved…
      const originalRounds = run?.bracket?.rounds || {};

      // …but for the image we ALSO want to show advancement as soon as a winner exists,
      // even if the next-round matchup is still “locked” in the UI.
      //
      // The saved bracket uses arrays per round: rounds.R1[matchIndex] = {a,b,winner,loser,...}
      // So we build a deep-cloned set of arrays and then push winners forward into the next round.
      const derived = JSON.parse(JSON.stringify(originalRounds));

      const ensureRoundArray = (rid) => {
        if (!Array.isArray(derived[rid])) derived[rid] = [];
        return derived[rid];
      };

      const ensureMatch = (rid, matchIndex) => {
        const arr = ensureRoundArray(rid);
        if (!arr[matchIndex]) arr[matchIndex] = { a: null, b: null, winner: null, loser: null };
        return arr[matchIndex];
      };

      // Propagate winners forward one round at a time
      for (let r = 1; r <= 4; r++) {
        const srcRid = `R${r}`;
        const tgtRid = `R${r + 1}`;
        const srcArr = ensureRoundArray(srcRid);

        for (let matchIndex = 0; matchIndex < srcArr.length; matchIndex++) {
          const src = srcArr[matchIndex];
          if (!src || !src.winner) continue;

          const win = src.winner;
          const tgtMatchIndex = Math.floor(matchIndex / 2);
          const slot = matchIndex % 2 === 0 ? "a" : "b";

          const tgt = ensureMatch(tgtRid, tgtMatchIndex);

          // Only fill if empty; don't overwrite an already-populated slot.
          if (!tgt[slot]) tgt[slot] = win;
        }
      }

      return derived;
    })();;

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

        drawEntryText(xText, yA, a, win === a, (win === a) ? pts : 0, !!win);
        drawEntryText(xText, yB, b, win === b, (win === b) ? pts : 0, !!win);
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
