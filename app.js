'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let allPlayers = [];
let sortKey = 'acs';
let sortDir = 'desc';
let modalRadarChart = null;
let cmpRadarChart = null;
const summaryCache = new Map();   // player name → { text, textZh }

// ── Role context for AI prompt ─────────────────────────────────────────────
const ROLE_CONTEXT = {
  'Duelist':    'As a Duelist, Firepower and Entry are primary responsibilities. Clutch and Teamplay are secondary.',
  'Initiator':  'As an Initiator, Teamplay and Survivability are the primary job. Entry is secondary.',
  'Controller': 'As a Controller, Teamplay and Survivability are primary. Low Entry and Clutch are EXPECTED — do NOT criticize them.',
  'Sentinel':   'As a Sentinel, Survivability and Teamplay are primary. Entry is NOT expected to be high — do not criticize it.',
  'Unknown':    '',
};

// ── Fallback templates (used when API unavailable) ─────────────────────────
const EN_TEMPLATES = {
  'First Blood Hunter':  n => `${n} is a relentless first-blood specialist who consistently wins opening duels and shifts map control before most players have fired a shot.`,
  'Calculated Risk':     n => `${n} approaches entry with tactical aggression — not reckless, not passive — generating consistent pressure while keeping risk manageable.`,
  'Glass Cannon':        n => `${n} loves to take the first fight but hasn't converted that aggression into consistent round wins. High risk, inconsistent reward.`,
  'Silent Assassin':     n => `${n} is a high-efficiency carry: elite damage output, strong K/D, and the ability to close rounds without needing the highlight reel.`,
  'Reliable Fragger':    n => `${n} is a steady, dependable damage dealer — not flashy, but consistently present on the scoreboard when it matters.`,
  'Misfiring':           n => `${n} has the tools to carry but the numbers show inconsistency. Some rounds dominant, others absent — ceiling is higher with more stability.`,
  'Comeback King':       n => `${n} is the player opponents fear in 1vX situations. Exceptional clutch rate signals elite composure and the ability to convert rounds that should be lost.`,
  'Pressure Player':     n => `${n} shows up when the round is on the line. Reliable under pressure, with the composure to stay calm in late-round situations.`,
  'Lucky Shot':          n => `${n} has had standout clutch moments this tournament, though the sample is limited. A few more performances like those would change the narrative.`,
  'The Enabler':         n => `${n} makes teammates better. High assist rates and exceptional round participation show a player who creates opportunities and keeps rounds alive.`,
  'Team Player':         n => `${n} is a reliable team-first player whose consistent participation and assist numbers show clear role understanding and disciplined execution.`,
  'Role Question Mark':  n => `${n}'s numbers sit below role average without a clear standout category. Could reflect tough matchups, strategic sacrifice, or an off tournament.`,
  'Swiss Army Knife':    n => `${n} is a complete player with no exploitable weakness — elite across firepower, entry, clutch, and teamplay.`,
  'Jack of All Trades':  n => `${n} is well-rounded without dominating any single category. Versatile and adaptable — no obvious weak point for opponents to target.`,
  'Dead Weight':         n => `${n}'s numbers are significantly below role average across all dimensions. Whether matchup difficulty or form, the stats don't tell a flattering story this tournament.`,
};

const ZH_TEMPLATES = {
  'First Blood Hunter':  n => `${n}是本届赛事最具威胁性的开团选手之一，能够稳定赢得前期对枪，在大多数人开枪之前便已掌控地图节奏。`,
  'Calculated Risk':     n => `${n}的打法介于激进与保守之间，以可控风险换取稳定推进空间，即便数据不亮眼，对团队贡献切实存在。`,
  'Glass Cannon':        n => `${n}热衷于主动发起对枪，但尚未将进攻性转化为稳定回合胜率。高风险、高波动。`,
  'Silent Assassin':     n => `${n}是高效carry选手：顶级伤害输出、稳定K/D，不需要高光时刻便能锁定回合。`,
  'Reliable Fragger':    n => `${n}是稳定可靠的输出手，不花哨，但在关键时刻始终出现在计分板上。`,
  'Misfiring':           n => `${n}具备核心carry的实力，但数据显示发挥不稳定，某些回合强势，另一些几乎消失。`,
  'Comeback King':       n => `${n}是对手在1vX局面中最不想遇到的对手，超高clutch胜率体现了顶级心态与机械实力。`,
  'Pressure Player':     n => `关键回合来临时，${n}会站出来，在压力时刻保持稳定，为团队带来切实价值。`,
  'Lucky Shot':          n => `${n}在本届赛事中有过几次亮眼的clutch时刻，但样本有限，还不足以断定为稳定强项。`,
  'The Enabler':         n => `${n}能让队友变得更强，高助攻数与超高回合参与率体现了创造机会的价值。`,
  'Team Player':         n => `${n}是可靠的团队型选手，稳定的回合参与度和扎实的助攻数说明他清楚自己的定位。`,
  'Role Question Mark':  n => `${n}各维度数据均低于同位置平均水平，可能是对阵强队、战术牺牲，也可能只是本届状态欠佳。`,
  'Swiss Army Knife':    n => `${n}是无懈可击的全能型选手，火力、突破、clutch与团队协作均处于顶级水准。`,
  'Jack of All Trades':  n => `${n}全面均衡，但没有哪个维度形成统治力，稳定性是目前最大的优势。`,
  'Dead Weight':         n => `${n}在本届赛事中各项关键数据均明显低于同位置平均水平，本届数据难以给出正面评价。`,
};

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
  renderHighlights();

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

  document.getElementById('refresh-btn').addEventListener('click', () => location.reload());

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

  const swData = getStrengthsWeaknesses(p);

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
        <div id="modal-summary-area">
          <div class="modal-summary-loading">Analyzing ${esc(p.name)}…</div>
        </div>
        <div class="modal-strengths-row">
          <div class="modal-strengths-block">
            <div class="modal-label">Strengths</div>
            <ul>${swData.strengths.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
          </div>
          <div class="modal-strengths-block">
            <div class="modal-label">Weaknesses</div>
            <ul>${swData.weaknesses.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
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

  // Trigger async AI summary fetch after modal is visible
  fetchAISummary(p);
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  if (modalRadarChart) { modalRadarChart.destroy(); modalRadarChart = null; }
}

// ── On-demand AI Summary ───────────────────────────────────────────────────
async function fetchAISummary(p) {
  // Serve from cache if available
  if (summaryCache.has(p.name)) {
    renderSummaryInModal(p, summaryCache.get(p.name));
    return;
  }

  const key = window.DEEPSEEK_API_KEY;
  if (!key) {
    renderSummaryInModal(p, {
      text: EN_TEMPLATES[p.archetype]?.(p.name) || '',
      textZh: ZH_TEMPLATES[p.archetype]?.(p.name) || '',
    });
    return;
  }

  const vs = p.vs_role || {};
  const roleCtx = ROLE_CONTEXT[p.role] || '';
  const prompt = `You are a professional Valorant esports analyst. Write a concise player analysis for ${p.name}.

Player: ${p.name} | Team: ${p.team} | Role: ${p.role} | Archetype: ${p.archetype}

Stats:
- ACS: ${fmt(p.acs)} | ADR: ${fmt(p.adr,1)} | K/D: ${fmt(p.kd,2)} | KAST: ${fmt(p.kast,1)}%
- FKPR: ${fmt(p.fkpr,2)} | FDPR: ${fmt(p.fdpr,2)} | APR: ${fmt(p.apr,2)} | Clutch%: ${fmt(p.clutch_pct,1)}%

Strength Scores (0-100, relative to tournament field):
Firepower ${Math.round(p.firepower||0)} | Entry ${Math.round(p.entry||0)} | Survivability ${Math.round(p.survivability||0)} | Clutch ${Math.round(p.clutch||0)} | Teamplay ${Math.round(p.teamplay||0)}

vs Role Average: ACS ${vs.acs||'—'} | ADR ${vs.adr||'—'} | KAST ${vs.kast||'—'} | FKPR ${vs.fkpr||'—'}

Role context: ${roleCtx}

Return ONLY valid JSON: {"en": "2-3 sentence English analysis.", "zh": "2-3句中文分析。"}
Requirements:
- English: professional analyst tone, reference specific stats, explain WHY this player stands out or falls short
- Chinese: same content, natural Chinese, mention player name
- Respect role context — do NOT criticize dimensions not primary for this role
- Do NOT use markdown, no text outside the JSON`;

  try {
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });
    const data = await resp.json();
    let content = data.choices[0].message.content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
    }
    const result = JSON.parse(content);
    if (result.en && result.zh) {
      const summary = { text: result.en, textZh: result.zh };
      summaryCache.set(p.name, summary);
      renderSummaryInModal(p, summary);
      return;
    }
  } catch (e) {
    console.warn('AI summary failed:', e);
  }

  // Fallback on any error
  renderSummaryInModal(p, {
    text: EN_TEMPLATES[p.archetype]?.(p.name) || '',
    textZh: ZH_TEMPLATES[p.archetype]?.(p.name) || '',
  });
}

function renderSummaryInModal(p, { text, textZh }) {
  const area = document.getElementById('modal-summary-area');
  if (!area) return;
  area.innerHTML = `
    <div class="modal-summary-text">${esc(text)}</div>
    <div class="modal-summary-divider"></div>
    <div class="modal-summary-text modal-summary-zh">${esc(textZh)}</div>
  `;
}

// ── Strengths / Weaknesses (role-filtered) ─────────────────────────────────
const SCORE_NAMES = ['firepower', 'entry', 'survivability', 'clutch', 'teamplay'];
const SCORE_LABELS = { firepower: 'Firepower', entry: 'Entry', survivability: 'Survivability', clutch: 'Clutch', teamplay: 'Teamplay' };

function getStrengthsWeaknesses(p) {
  const keyDims = p.role_key_dims || ['firepower', 'survivability', 'teamplay'];
  const keySorted = keyDims
    .map(k => ({ key: k, val: p[k] || 0 }))
    .sort((a, b) => b.val - a.val);

  return {
    strengths:  keySorted.slice(0, 2).map(s => SCORE_LABELS[s.key]),
    weaknesses: keySorted.slice(-1).map(s => SCORE_LABELS[s.key]),
  };
}

// ── Player Comparison ──────────────────────────────────────────────────────
function renderHighlights() {
  if (!allPlayers.length) return;

  const top5 = [...allPlayers].sort((a, b) => b.acs - a.acs).slice(0, 5);

  const ROLES = ['Duelist', 'Initiator', 'Controller', 'Sentinel'];
  const bestByRole = {};
  ROLES.forEach(role => {
    const group = allPlayers.filter(p => p.role === role);
    if (group.length) bestByRole[role] = group.reduce((best, p) => p.acs > best.acs ? p : best);
  });

  const worst = [...allPlayers].sort((a, b) => a.acs - b.acs)[0];

  const rankColors = ['gold', 'silver', 'bronze', '', ''];
  const rankSymbols = ['#1', '#2', '#3', '#4', '#5'];

  const top5HTML = `
    <div>
      <div class="hl-section-title">Top 5 ACS</div>
      <div class="hl-top5">
        ${top5.map((p, i) => `
          <div class="hl-rank-row" data-name="${esc(p.name)}">
            <span class="hl-rank-num ${rankColors[i]}">${rankSymbols[i]}</span>
            <span class="hl-rank-name">${esc(p.name)}</span>
            <span class="hl-rank-team">${esc(p.team)}</span>
            <span class="role-badge role-${p.role}" style="font-size:10px">${p.role}</span>
            <span class="hl-rank-acs">${fmt(p.acs)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const roleIcons = { Duelist: '⚔', Initiator: '📡', Controller: '🌪', Sentinel: '🛡' };
  const bestByRoleHTML = `
    <div>
      <div class="hl-section-title">Best ACS by Role</div>
      <div class="hl-role-grid">
        ${ROLES.map(role => {
          const p = bestByRole[role];
          if (!p) return `<div class="hl-role-card"><div class="hl-card-team">${role} — no data</div></div>`;
          const info = archetypeInfo(p.archetype);
          return `
            <div class="hl-role-card" data-name="${esc(p.name)}">
              <span class="role-badge role-${role}">${roleIcons[role] || ''} ${role}</span>
              <div class="hl-card-acs">${fmt(p.acs)}</div>
              <div class="hl-card-name">${esc(p.name)}</div>
              <div class="hl-card-team">${esc(p.team)}</div>
              <div style="margin-top:2px">
                <span style="font-size:10px;font-weight:700;color:${info.color}">${esc(p.archetype || '')}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  const worstHTML = worst ? `
    <div>
      <div class="hl-section-title">最坑选手 · Lowest ACS</div>
      <div class="hl-worst-card" data-name="${esc(worst.name)}">
        <div>
          <div class="hl-worst-label">最坑选手 · Lowest ACS</div>
          <div class="hl-worst-name">${esc(worst.name)}</div>
          <div class="hl-worst-meta">${esc(worst.team)} · ${worst.role}</div>
        </div>
        <div class="hl-worst-acs">${fmt(worst.acs)}</div>
      </div>
    </div>
  ` : '';

  const body = document.getElementById('highlights-body');
  body.innerHTML = `<div style="padding:20px;display:flex;flex-direction:column;gap:24px">
    ${top5HTML}${bestByRoleHTML}${worstHTML}
  </div>`;

  // Wire clicks → open modal
  body.querySelectorAll('[data-name]').forEach(el => {
    el.addEventListener('click', () => {
      const p = allPlayers.find(x => x.name === el.dataset.name);
      if (p) showModal(p);
    });
  });
}

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
