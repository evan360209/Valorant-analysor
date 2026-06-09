'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let allPlayers = [];
let sortKey = 'acs';
let sortDir = 'desc';
let modalRadarChart = null;
let cmpRadarChart = null;

// ── Archetype display map ──────────────────────────────────────────────────
const ARCHETYPE_DISPLAY = {
  'First Blood Hunter': { sub: '开路先锋',      color: '#ff4655' },
  'Calculated Risk':    { sub: '冒险突破手',    color: '#ff7875' },
  'Glass Cannon':       { sub: '风险高爆',      color: '#ff9a8b' },
  'Silent Assassin':    { sub: '效率收割机',    color: '#ff8c42' },
  'Reliable Fragger':   { sub: '靠谱输出',      color: '#ffaa60' },
  'Misfiring':          { sub: '状态起伏',      color: '#ffcc99' },
  'Comeback King':      { sub: '逆风之王',      color: '#fbbf24' },
  'Pressure Player':    { sub: '压力担当',      color: '#fcd95a' },
  'Lucky Shot':         { sub: '偶尔高光',      color: '#fde99a' },
  'The Enabler':        { sub: '幕后推手',      color: '#4ade80' },
  'Team Player':        { sub: '团队支柱',      color: '#86efac' },
  'Role Question Mark': { sub: '定位模糊',      color: '#6ee7b7' },
  'Swiss Army Knife':   { sub: '全能战士',      color: '#60a5fa' },
  'Jack of All Trades': { sub: '样样通，样样松', color: '#93c5fd' },
  'Dead Weight':        { sub: '团队的负担',    color: '#8892a4' },
};

function archetypeInfo(archetype) {
  return ARCHETYPE_DISPLAY[archetype] || { sub: '', color: '#8892a4' };
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const data = window.VALORANT_DATA;
  if (!data) {
    document.getElementById('table-body').innerHTML =
      '<tr><td colspan="14" class="no-results">⚠ data.js not found — run <strong>python3 scraper.py</strong> first, then refresh.</td></tr>';
    return;
  }
  allPlayers = data.players || [];
  document.getElementById('updated-at').textContent = data.updated_at || '—';
  document.getElementById('player-count').textContent = allPlayers.length + ' players';
  populateCompareSelects();
  populateTeamFilter();
  renderTable();

  document.getElementById('search-input').addEventListener('input', renderTable);
  document.getElementById('team-filter').addEventListener('change', renderTable);
  document.getElementById('role-filter').addEventListener('change', renderTable);
  document.getElementById('cmp-a').addEventListener('change', renderComparison);
  document.getElementById('cmp-b').addEventListener('change', renderComparison);

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

  // Close modal on backdrop click
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
});

// ── Table rendering ────────────────────────────────────────────────────────
function filteredSorted() {
  const q = document.getElementById('search-input').value.toLowerCase().trim();
  const team = document.getElementById('team-filter').value;
  const role = document.getElementById('role-filter').value;

  let list = allPlayers.filter(p => {
    if (q && !p.name.toLowerCase().includes(q)) return false;
    if (team && p.team !== team) return false;
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

  document.querySelectorAll('thead th[data-key]').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.key === sortKey) th.classList.add('sorted-' + sortDir);
  });

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="14" class="no-results">No players match your search.</td></tr>';
    return;
  }

  const info = p => archetypeInfo(p.archetype);

  tbody.innerHTML = list.map(p => `
    <tr data-name="${esc(p.name)}">
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
      <td>
        <span style="font-size:11px;font-weight:700;color:${info(p).color}">${esc(p.archetype || '—')}</span>
        ${info(p).sub ? `<div style="font-size:10px;color:var(--text-muted)">${esc(info(p).sub)}</div>` : ''}
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr[data-name]').forEach(row => {
    row.addEventListener('click', () => {
      const player = allPlayers.find(p => p.name === row.dataset.name);
      if (player) showModal(player);
    });
  });
}

// ── Modal ──────────────────────────────────────────────────────────────────
function showModal(p) {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  const info = archetypeInfo(p.archetype);

  const statsMap = [
    ['ACS', fmt(p.acs)],
    ['K/D', fmt(p.kd, 2)],
    ['KAST', fmt(p.kast, 1) + '%'],
    ['ADR', fmt(p.adr, 1)],
    ['KPR', fmt(p.kpr, 2)],
    ['APR', fmt(p.apr, 2)],
    ['FKPR', fmt(p.fkpr, 2)],
    ['FDPR', fmt(p.fdpr, 2)],
    ['HS%', fmt(p.hs_pct, 1) + '%'],
    ['Clutch%', fmt(p.clutch_pct, 1) + '%'],
  ];

  const bars = [
    ['Firepower', 'bar-firepower', p.firepower],
    ['Entry',     'bar-entry',     p.entry],
    ['Survival',  'bar-survival',  p.survivability],
    ['Clutch',    'bar-clutch',    p.clutch],
    ['Teamplay',  'bar-teamplay',  p.teamplay],
  ];

  const vs = p.vs_role || {};
  const avg = p.role_avg || {};
  const benchStats = [
    { key: 'acs', label: 'ACS', val: fmt(p.acs) },
    { key: 'adr', label: 'ADR', val: fmt(p.adr, 1) },
    { key: 'fkpr', label: 'FKPR', val: fmt(p.fkpr, 2) },
    { key: 'kast', label: 'KAST', val: fmt(p.kast, 1) + '%' },
    { key: 'clutch_pct', label: 'Clutch%', val: fmt(p.clutch_pct, 1) + '%' },
  ];

  const summaryHTML = generateSummary(p);

  box.innerHTML = `
    <!-- Header -->
    <div class="modal-header">
      <div class="modal-header-left">
        <div class="modal-player-name">${esc(p.name)}</div>
        <div class="modal-player-meta">
          <span style="color:var(--text-muted);font-size:13px">${esc(p.team)}</span>
          <span class="role-badge role-${p.role}">${p.role}</span>
          <span style="font-size:12px;color:var(--text-muted)">Agents: ${(p.agents || []).join(', ') || '—'}</span>
        </div>
        <div class="modal-archetype-wrap">
          <span class="modal-archetype-badge" style="background:${info.color}">${esc(p.archetype || '—')}</span>
          ${info.sub ? `<span class="modal-archetype-sub">${esc(info.sub)}</span>` : ''}
        </div>
        <div class="modal-role-focus">Role focus: ${(p.role_key_dims || []).map(k => SCORE_LABELS[k]).join(' · ')}</div>
      </div>
      <button class="modal-close-btn" id="modal-close-btn" aria-label="Close">&#x2715;</button>
    </div>

    <!-- Top: Radar (left) + Summary & Bars (right) -->
    <div class="modal-body-top">
      <div class="modal-radar-col">
        <canvas id="modal-radar-canvas" width="380" height="380"></canvas>
      </div>
      <div class="modal-right-col">
        <div class="modal-summary-text">${summaryHTML.text}</div>
        <div class="modal-summary-divider"></div>
        <div class="modal-summary-text modal-summary-zh">${summaryHTML.textZh}</div>
        <div class="modal-strengths-row">
          <div class="modal-strengths-block">
            <div class="modal-label">Strengths</div>
            <ul>${summaryHTML.strengths.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
          </div>
          <div class="modal-strengths-block">
            <div class="modal-label">Weaknesses</div>
            <ul>${summaryHTML.weaknesses.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
          </div>
        </div>
        <div>
          <div class="modal-label" style="margin-bottom:8px">Strength Scores</div>
          ${bars.map(([label, cls, val]) => `
            <div class="score-row">
              <div class="score-label">${label}</div>
              <div class="score-bar-bg">
                <div class="score-bar-fill ${cls}" style="width:${val || 0}%"></div>
              </div>
              <div class="score-num">${Math.round(val || 0)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Bottom: Stats + Benchmark -->
    <div class="modal-body-bottom">
      <div>
        <div class="section-title">Statistics</div>
        <div class="stats-detail-grid">
          ${statsMap.map(([label, val]) => `
            <div class="stat-box">
              <div class="s-label">${label}</div>
              <div class="s-val">${val}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div>
        <div class="section-title">vs ${esc(p.role)} Average</div>
        <div class="benchmark-grid">
          ${benchStats.map(s => {
            const delta = vs[s.key] || '—';
            const isPos = delta.startsWith('+');
            const isNeg = delta.startsWith('-');
            const cls = isPos ? 'positive' : isNeg ? 'negative' : 'neutral';
            return `
              <div class="benchmark-item">
                <div class="b-stat">${s.label}</div>
                <div class="b-val">${s.val}</div>
                <div class="b-delta ${cls}">avg ${avg[s.key] !== undefined ? fmt(avg[s.key], 1) : '—'} &nbsp;${delta}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // Wire close button
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);

  // Show
  overlay.style.display = 'flex';

  // Draw radar after DOM is ready
  requestAnimationFrame(() => {
    const ctx = document.getElementById('modal-radar-canvas').getContext('2d');
    if (modalRadarChart) modalRadarChart.destroy();
    modalRadarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Firepower', 'Entry', 'Survivability', 'Clutch', 'Teamplay'],
        datasets: [{
          label: p.name,
          data: [p.firepower, p.entry, p.survivability, p.clutch, p.teamplay],
          backgroundColor: 'rgba(255,70,85,0.18)',
          borderColor: info.color || '#ff4655',
          borderWidth: 2.5,
          pointBackgroundColor: info.color || '#ff4655',
          pointRadius: 5,
        }]
      },
      options: {
        responsive: false,
        animation: { duration: 250 },
        scales: {
          r: {
            min: 0, max: 100,
            ticks: { stepSize: 25, color: '#8892a4', font: { size: 11 }, backdropColor: 'transparent' },
            grid: { color: '#2a3147' },
            pointLabels: { color: '#c8cdd8', font: { size: 13, weight: 'bold' } },
            angleLines: { color: '#2a3147' },
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  });
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  if (modalRadarChart) { modalRadarChart.destroy(); modalRadarChart = null; }
}

// ── Summary (reads from data.js, generated by scraper + DeepSeek API) ──────
const SCORE_NAMES = ['firepower', 'entry', 'survivability', 'clutch', 'teamplay'];
const SCORE_LABELS = { firepower: 'Firepower', entry: 'Entry', survivability: 'Survivability', clutch: 'Clutch', teamplay: 'Teamplay' };

function generateSummary(p) {
  const keyDims = p.role_key_dims || ['firepower', 'survivability', 'teamplay'];
  const keySorted = keyDims
    .map(k => ({ key: k, val: p[k] || 0 }))
    .sort((a, b) => b.val - a.val);

  return {
    text:      p.summary_en || '',
    textZh:    p.summary_zh || '',
    strengths:  keySorted.slice(0, 2).map(s => SCORE_LABELS[s.key]),
    weaknesses: keySorted.slice(-1).map(s => SCORE_LABELS[s.key]),
  };
}

// ── Player Comparison ──────────────────────────────────────────────────────
function populateTeamFilter() {
  const teams = [...new Set(allPlayers.map(p => p.team).filter(Boolean))].sort();
  const sel = document.getElementById('team-filter');
  teams.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  });
}

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
    { key: 'acs',         label: 'ACS',         higher: true,  fmt: v => fmt(v) },
    { key: 'kd',          label: 'K/D',         higher: true,  fmt: v => fmt(v, 2) },
    { key: 'kast',        label: 'KAST',        higher: true,  fmt: v => fmt(v, 1) + '%' },
    { key: 'adr',         label: 'ADR',         higher: true,  fmt: v => fmt(v, 1) },
    { key: 'fkpr',        label: 'FKPR',        higher: true,  fmt: v => fmt(v, 2) },
    { key: 'fdpr',        label: 'FDPR',        higher: false, fmt: v => fmt(v, 2) },
    { key: 'hs_pct',      label: 'HS%',         higher: true,  fmt: v => fmt(v, 1) + '%' },
    { key: 'clutch_pct',  label: 'Clutch%',     higher: true,  fmt: v => fmt(v, 1) + '%' },
    { key: 'firepower',   label: 'Firepower',   higher: true,  fmt: v => Math.round(v) },
    { key: 'entry',       label: 'Entry',       higher: true,  fmt: v => Math.round(v) },
    { key: 'survivability',label: 'Survival',   higher: true,  fmt: v => Math.round(v) },
    { key: 'clutch',      label: 'Clutch Score',higher: true,  fmt: v => Math.round(v) },
    { key: 'teamplay',    label: 'Teamplay',    higher: true,  fmt: v => Math.round(v) },
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

  renderCmpRadar(pA, pB);

  let aWins = 0, bWins = 0;
  CMP_STATS.forEach(s => {
    const va = pA[s.key] ?? 0;
    const vb = pB[s.key] ?? 0;
    if (s.higher ? va > vb : va < vb) aWins++;
    if (s.higher ? vb > va : vb < va) bWins++;
  });
  const winner = aWins > bWins ? pA : bWins > aWins ? pB : null;
  document.getElementById('cmp-summary').innerHTML = winner
    ? `<b>${winner.name}</b> holds the edge, winning ${Math.max(aWins, bWins)} of ${CMP_STATS.length} categories.`
    : `${pA.name} and ${pB.name} are statistically neck-and-neck.`;

  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCmpRadar(pA, pB) {
  const ctx = document.getElementById('cmp-radar-canvas').getContext('2d');
  if (cmpRadarChart) cmpRadarChart.destroy();

  const infoA = archetypeInfo(pA.archetype);
  const infoB = archetypeInfo(pB.archetype);

  cmpRadarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Firepower', 'Entry', 'Survivability', 'Clutch', 'Teamplay'],
      datasets: [
        {
          label: pA.name,
          data: [pA.firepower, pA.entry, pA.survivability, pA.clutch, pA.teamplay],
          backgroundColor: 'rgba(255,70,85,0.15)',
          borderColor: infoA.color || '#ff4655',
          borderWidth: 2,
          pointBackgroundColor: infoA.color || '#ff4655',
          pointRadius: 4,
        },
        {
          label: pB.name,
          data: [pB.firepower, pB.entry, pB.survivability, pB.clutch, pB.teamplay],
          backgroundColor: 'rgba(123,94,167,0.15)',
          borderColor: infoB.color || '#7b5ea7',
          borderWidth: 2,
          pointBackgroundColor: infoB.color || '#7b5ea7',
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
