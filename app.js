'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let allPlayers = [];
let sortKey = 'acs';
let sortDir = 'desc';
let activePlayerName = null;
let radarChart = null;
let cmpRadarChart = null;

// ── Bootstrap ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const data = window.VALORANT_DATA;
  if (!data) {
    document.getElementById('table-body').innerHTML =
      '<tr><td colspan="14" class="no-results">⚠ data.js not found — run <strong>python3 scraper.py</strong> first, then refresh this page.</td></tr>';
    return;
  }
  allPlayers = data.players || [];
  document.getElementById('updated-at').textContent = data.updated_at || '—';
  document.getElementById('player-count').textContent = allPlayers.length + ' players';
  populateCompareSelects();
  renderTable();

  document.getElementById('search-input').addEventListener('input', renderTable);
  document.getElementById('role-filter').addEventListener('change', renderTable);

  document.getElementById('cmp-a').addEventListener('change', renderComparison);
  document.getElementById('cmp-b').addEventListener('change', renderComparison);

  // Sortable headers
  document.querySelectorAll('thead th[data-key]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (sortKey === key) {
        sortDir = sortDir === 'desc' ? 'asc' : 'desc';
      } else {
        sortKey = key;
        sortDir = 'desc';
      }
      renderTable();
    });
  });
});

// ── Table rendering ────────────────────────────────────────────────────────
function filteredSorted() {
  const q = document.getElementById('search-input').value.toLowerCase().trim();
  const role = document.getElementById('role-filter').value;

  let list = allPlayers.filter(p => {
    if (q && !p.name.toLowerCase().includes(q) && !p.team.toLowerCase().includes(q)) return false;
    if (role && p.role !== role) return false;
    return true;
  });

  list.sort((a, b) => {
    let va = a[sortKey] ?? 0;
    let vb = b[sortKey] ?? 0;
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return list;
}

function renderTable() {
  const list = filteredSorted();
  const tbody = document.getElementById('table-body');

  // Update sort indicators
  document.querySelectorAll('thead th[data-key]').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.key === sortKey) th.classList.add('sorted-' + sortDir);
  });

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="14" class="no-results">No players match your search.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(p => `
    <tr class="${p.name === activePlayerName ? 'active' : ''}" data-name="${esc(p.name)}">
      <td>
        <div class="player-name-cell">
          <span class="p-name">${esc(p.name)}</span>
          <span class="p-team">${esc(p.team)}</span>
        </div>
      </td>
      <td><span class="role-badge role-${p.role}">${p.role}</span></td>
      <td>${(p.agents || []).map(a => `<span class="agent-chip">${esc(a)}</span>`).join('')}</td>
      <td class="stat-val">${fmt(p.acs)}</td>
      <td class="stat-val">${fmt(p.kd, 2)}</td>
      <td class="stat-val">${fmt(p.kast, 1)}%</td>
      <td class="stat-val">${fmt(p.adr, 1)}</td>
      <td class="stat-val">${fmt(p.kpr, 2)}</td>
      <td class="stat-val">${fmt(p.apr, 2)}</td>
      <td class="stat-val">${fmt(p.fkpr, 2)}</td>
      <td class="stat-val">${fmt(p.fdpr, 2)}</td>
      <td class="stat-val">${fmt(p.hs_pct, 1)}%</td>
      <td class="stat-val">${fmt(p.clutch_pct, 1)}%</td>
      <td class="stat-val">${p.archetype || '—'}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr[data-name]').forEach(row => {
    row.addEventListener('click', () => {
      const name = row.dataset.name;
      activePlayerName = name;
      const player = allPlayers.find(p => p.name === name);
      if (player) showProfile(player);
      // refresh row highlights
      tbody.querySelectorAll('tr[data-name]').forEach(r => r.classList.toggle('active', r.dataset.name === name));
    });
  });
}

// ── Player Profile ─────────────────────────────────────────────────────────
function showProfile(p) {
  const section = document.getElementById('profile-section');
  section.style.display = 'block';

  // Identity
  document.getElementById('profile-name').textContent = p.name;
  document.getElementById('profile-team').textContent = p.team;
  document.getElementById('profile-role-badge').className = 'role-badge role-' + p.role;
  document.getElementById('profile-role-badge').textContent = p.role;
  document.getElementById('profile-archetype').textContent = p.archetype || '—';

  // Agents
  document.getElementById('profile-agents').textContent = (p.agents || []).join(', ') || '—';

  // Stat boxes
  const statsMap = [
    ['acs', 'ACS', fmt(p.acs)],
    ['kd', 'K/D', fmt(p.kd, 2)],
    ['kast', 'KAST', fmt(p.kast, 1) + '%'],
    ['adr', 'ADR', fmt(p.adr, 1)],
    ['kpr', 'KPR', fmt(p.kpr, 2)],
    ['apr', 'APR', fmt(p.apr, 2)],
    ['fkpr', 'FKPR', fmt(p.fkpr, 2)],
    ['fdpr', 'FDPR', fmt(p.fdpr, 2)],
    ['hs_pct', 'HS%', fmt(p.hs_pct, 1) + '%'],
    ['clutch_pct', 'Clutch%', fmt(p.clutch_pct, 1) + '%'],
  ];

  document.getElementById('profile-stats-grid').innerHTML = statsMap.map(([, label, val]) => `
    <div class="stat-box">
      <div class="s-label">${label}</div>
      <div class="s-val">${val}</div>
    </div>
  `).join('');

  // Strength bars
  const bars = [
    ['firepower', 'Firepower', 'bar-firepower', p.firepower],
    ['entry', 'Entry', 'bar-entry', p.entry],
    ['survivability', 'Survival', 'bar-survival', p.survivability],
    ['clutch', 'Clutch', 'bar-clutch', p.clutch],
    ['teamplay', 'Teamplay', 'bar-teamplay', p.teamplay],
  ];

  document.getElementById('strength-bars').innerHTML = bars.map(([, label, cls, val]) => `
    <div class="score-row">
      <div class="score-label">${label}</div>
      <div class="score-bar-bg">
        <div class="score-bar-fill ${cls}" style="width:${val || 0}%"></div>
      </div>
      <div class="score-num">${Math.round(val || 0)}</div>
    </div>
  `).join('');

  // Radar chart
  renderRadar(p, null);

  // Role benchmark
  renderBenchmark(p);

  // AI summary
  document.getElementById('ai-summary').innerHTML = generateSummary(p);

  // Scroll into view
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderRadar(p1, p2) {
  const ctx = document.getElementById('radar-canvas').getContext('2d');
  if (radarChart) radarChart.destroy();

  const labels = ['Firepower', 'Entry', 'Survivability', 'Clutch', 'Teamplay'];
  const datasets = [{
    label: p1.name,
    data: [p1.firepower, p1.entry, p1.survivability, p1.clutch, p1.teamplay],
    backgroundColor: 'rgba(255,70,85,0.15)',
    borderColor: '#ff4655',
    borderWidth: 2,
    pointBackgroundColor: '#ff4655',
    pointRadius: 4,
  }];

  if (p2) {
    datasets.push({
      label: p2.name,
      data: [p2.firepower, p2.entry, p2.survivability, p2.clutch, p2.teamplay],
      backgroundColor: 'rgba(123,94,167,0.15)',
      borderColor: '#7b5ea7',
      borderWidth: 2,
      pointBackgroundColor: '#7b5ea7',
      pointRadius: 4,
    });
  }

  radarChart = new Chart(ctx, {
    type: 'radar',
    data: { labels, datasets },
    options: {
      responsive: true,
      animation: { duration: 300 },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { stepSize: 25, color: '#8892a4', font: { size: 10 }, backdropColor: 'transparent' },
          grid: { color: '#2a3147' },
          pointLabels: { color: '#c8cdd8', font: { size: 12, weight: 'bold' } },
          angleLines: { color: '#2a3147' },
        }
      },
      plugins: {
        legend: { labels: { color: '#c8cdd8', font: { size: 12 } } }
      }
    }
  });
}

function renderBenchmark(p) {
  const vs = p.vs_role || {};
  const avg = p.role_avg || {};
  const stats = [
    { key: 'acs', label: 'ACS', val: fmt(p.acs) },
    { key: 'adr', label: 'ADR', val: fmt(p.adr, 1) },
    { key: 'fkpr', label: 'FKPR', val: fmt(p.fkpr, 2) },
    { key: 'kast', label: 'KAST', val: fmt(p.kast, 1) + '%' },
    { key: 'clutch_pct', label: 'Clutch%', val: fmt(p.clutch_pct, 1) + '%' },
  ];

  document.getElementById('benchmark-role').textContent = p.role + ' Average';

  document.getElementById('benchmark-grid').innerHTML = stats.map(s => {
    const delta = vs[s.key] || '—';
    const isPos = delta.startsWith('+');
    const isNeg = delta.startsWith('-');
    const cls = isPos ? 'positive' : isNeg ? 'negative' : 'neutral';
    return `
      <div class="benchmark-item">
        <div class="b-stat">${s.label}</div>
        <div class="b-val">${s.val}</div>
        <div class="b-delta ${cls}">vs avg ${avg[s.key] !== undefined ? fmt(avg[s.key], 1) : '—'} &nbsp;${delta}</div>
      </div>
    `;
  }).join('');
}

// ── AI Summary (template-based) ────────────────────────────────────────────
const SCORE_NAMES = ['firepower', 'entry', 'survivability', 'clutch', 'teamplay'];
const SCORE_LABELS = { firepower: 'Firepower', entry: 'Entry', survivability: 'Survivability', clutch: 'Clutch', teamplay: 'Teamplay' };

const ARCHETYPE_TEMPLATES = {
  'Aggressive Entry': (p, top2, bot2) => `
    <b>${p.name}</b> is a relentless entry fragger who thrives on opening duels.
    Their willingness to take the first fight creates space for the entire team and puts opponents on the back foot.
    Playing against ${p.name} means constantly accounting for an opponent who initiates contact on their own terms.`,

  'Smart Carry': (p, top2, bot2) => `
    <b>${p.name}</b> is a high-efficiency carry who generates value through elite damage output and sharp positioning.
    Rather than forcing first engagements, ${p.name} converts advantageous situations into round wins with methodical precision.
    Among ${p.role}s at this event, their consistency and decision-making set them apart.`,

  'Clutch Specialist': (p, top2, bot2) => `
    <b>${p.name}</b> is a pressure player who performs at their best when the stakes are highest.
    Low-player situations seem to unlock something in ${p.name} — their composure and mechanical execution in clutch rounds is a consistent team asset.
    Opponents underestimate them in disadvantaged situations at their own peril.`,

  'Team Facilitator': (p, top2, bot2) => `
    <b>${p.name}</b> is a team-first player whose value extends well beyond the scoreboard.
    High assist rates and round participation reflect a player who creates opportunities for their teammates and keeps rounds alive.
    While raw frag numbers may not headline, ${p.name}'s presence elevates the entire roster.`,

  'Flexible Playmaker': (p, top2, bot2) => `
    <b>${p.name}</b> is a complete, well-rounded player with no significant weakness to exploit.
    Across firepower, entry, survivability, clutch, and teamplay, their scores are balanced — making them unpredictable and adaptable.
    This versatility makes ${p.name} a critical piece regardless of the game state.`,
};

function generateSummary(p) {
  const sorted = SCORE_NAMES
    .map(k => ({ key: k, val: p[k] || 0 }))
    .sort((a, b) => b.val - a.val);

  const top2 = sorted.slice(0, 2).map(s => SCORE_LABELS[s.key]);
  const bot2 = sorted.slice(-2).map(s => SCORE_LABELS[s.key]);

  const templateFn = ARCHETYPE_TEMPLATES[p.archetype] || ARCHETYPE_TEMPLATES['Flexible Playmaker'];
  const summaryText = templateFn(p, top2, bot2);

  return `
    <div class="section-label">Strengths</div>
    <ul>${top2.map(s => `<li>${s}</li>`).join('')}</ul>
    <div class="section-label">Weaknesses</div>
    <ul>${bot2.map(s => `<li>${s}</li>`).join('')}</ul>
    <div class="summary-text">${summaryText.trim()}</div>
  `;
}

// ── Player Comparison ──────────────────────────────────────────────────────
function populateCompareSelects() {
  const opts = allPlayers.map(p =>
    `<option value="${esc(p.name)}">${esc(p.name)} (${esc(p.team)})</option>`
  ).join('');

  const base = '<option value="">— Select player —</option>';
  document.getElementById('cmp-a').innerHTML = base + opts;
  document.getElementById('cmp-b').innerHTML = base + opts;
}

function renderComparison() {
  const nameA = document.getElementById('cmp-a').value;
  const nameB = document.getElementById('cmp-b').value;
  const section = document.getElementById('comparison-section');

  if (!nameA || !nameB || nameA === nameB) {
    section.style.display = 'none';
    return;
  }

  const pA = allPlayers.find(p => p.name === nameA);
  const pB = allPlayers.find(p => p.name === nameB);
  if (!pA || !pB) return;

  section.style.display = 'block';

  const CMP_STATS = [
    { key: 'acs', label: 'ACS', higher: true, fmt: v => fmt(v) },
    { key: 'kd', label: 'K/D', higher: true, fmt: v => fmt(v, 2) },
    { key: 'kast', label: 'KAST', higher: true, fmt: v => fmt(v, 1) + '%' },
    { key: 'adr', label: 'ADR', higher: true, fmt: v => fmt(v, 1) },
    { key: 'fkpr', label: 'FKPR', higher: true, fmt: v => fmt(v, 2) },
    { key: 'fdpr', label: 'FDPR', higher: false, fmt: v => fmt(v, 2) },
    { key: 'hs_pct', label: 'HS%', higher: true, fmt: v => fmt(v, 1) + '%' },
    { key: 'clutch_pct', label: 'Clutch%', higher: true, fmt: v => fmt(v, 1) + '%' },
    { key: 'firepower', label: 'Firepower', higher: true, fmt: v => Math.round(v) },
    { key: 'entry', label: 'Entry', higher: true, fmt: v => Math.round(v) },
    { key: 'survivability', label: 'Survival', higher: true, fmt: v => Math.round(v) },
    { key: 'clutch', label: 'Clutch Score', higher: true, fmt: v => Math.round(v) },
    { key: 'teamplay', label: 'Teamplay', higher: true, fmt: v => Math.round(v) },
  ];

  document.getElementById('cmp-name-a').textContent = pA.name;
  document.getElementById('cmp-meta-a').textContent = pA.team + ' · ' + pA.role;
  document.getElementById('cmp-name-b').textContent = pB.name;
  document.getElementById('cmp-meta-b').textContent = pB.team + ' · ' + pB.role;

  document.getElementById('comparison-rows').innerHTML = CMP_STATS.map(s => {
    const va = pA[s.key] ?? 0;
    const vb = pB[s.key] ?? 0;
    const aWins = s.higher ? va > vb : va < vb;
    const bWins = s.higher ? vb > va : vb < va;
    return `
      <div class="cmp-comparison-row">
        <div class="cmp-val-a ${aWins ? 'winner' : bWins ? 'loser' : ''}">${s.fmt(va)}</div>
        <div class="cmp-stat-label">${s.label}</div>
        <div class="cmp-val-b ${bWins ? 'winner' : aWins ? 'loser' : ''}">${s.fmt(vb)}</div>
      </div>
    `;
  }).join('');

  // Comparison radar
  renderCmpRadar(pA, pB);

  // Comparison summary
  let aWins = 0, bWins = 0;
  CMP_STATS.forEach(s => {
    const va = pA[s.key] ?? 0;
    const vb = pB[s.key] ?? 0;
    if (s.higher ? va > vb : va < vb) aWins++;
    if (s.higher ? vb > va : vb < va) bWins++;
  });
  const winner = aWins > bWins ? pA : bWins > aWins ? pB : null;
  const summaryText = winner
    ? `<b>${winner.name}</b> has the statistical edge, winning ${Math.max(aWins, bWins)} of ${CMP_STATS.length} categories. ${generateCompSummary(pA, pB, aWins, bWins)}`
    : `${pA.name} and ${pB.name} are closely matched across all statistical categories.`;

  document.getElementById('cmp-summary').innerHTML = summaryText;

  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCmpRadar(pA, pB) {
  const ctx = document.getElementById('cmp-radar-canvas').getContext('2d');
  if (cmpRadarChart) cmpRadarChart.destroy();

  const labels = ['Firepower', 'Entry', 'Survivability', 'Clutch', 'Teamplay'];
  cmpRadarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [
        {
          label: pA.name,
          data: [pA.firepower, pA.entry, pA.survivability, pA.clutch, pA.teamplay],
          backgroundColor: 'rgba(255,70,85,0.15)',
          borderColor: '#ff4655',
          borderWidth: 2,
          pointBackgroundColor: '#ff4655',
          pointRadius: 4,
        },
        {
          label: pB.name,
          data: [pB.firepower, pB.entry, pB.survivability, pB.clutch, pB.teamplay],
          backgroundColor: 'rgba(123,94,167,0.15)',
          borderColor: '#7b5ea7',
          borderWidth: 2,
          pointBackgroundColor: '#7b5ea7',
          pointRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      animation: { duration: 300 },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { stepSize: 25, color: '#8892a4', font: { size: 10 }, backdropColor: 'transparent' },
          grid: { color: '#2a3147' },
          pointLabels: { color: '#c8cdd8', font: { size: 12, weight: 'bold' } },
          angleLines: { color: '#2a3147' },
        }
      },
      plugins: {
        legend: { labels: { color: '#c8cdd8', font: { size: 12 } } }
      }
    }
  });
}

function generateCompSummary(pA, pB, aWins, bWins) {
  const winner = aWins > bWins ? pA : pB;
  const loser = aWins > bWins ? pB : pA;
  const wFire = winner.firepower > loser.firepower;
  const wEntry = winner.entry > loser.entry;

  if (wFire && wEntry) {
    return `${winner.name}'s advantage is clear both in raw firepower and entry impact, making them the more dominant all-around performer here.`;
  }
  if (wFire) {
    return `${winner.name} outperforms in damage output while ${loser.name} holds their own in other areas — the edge lies in consistent round impact.`;
  }
  return `${winner.name}'s profile stands out for role contribution and game sense, even if individual stats are close.`;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(val, decimals = 0) {
  if (val === null || val === undefined) return '—';
  return Number(val).toFixed(decimals);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
