# Valorant Pro Player Insight Dashboard
## Product Requirements Document (Current Version)

**Version:** 1.0  
**Last Updated:** 2026-06-11  
**Data Source:** VLR.gg — Masters London 2026

---

## 1. Product Overview

### 1.1 Background

Current Valorant statistics websites (e.g., VLR.gg) provide accurate and detailed data, but present raw numbers without interpretation. Most viewers can see *that* a player has a high ACS, but cannot answer:

- Why is this player strong?
- What is their specific competitive strength?
- How do they compare to other players in the same role?
- What type of player are they?

This dashboard bridges that gap by transforming raw statistics into structured, readable player insights.

### 1.2 Target Users

| User Type | Use Case |
|---|---|
| Esports fans | Understand why a player is considered strong |
| Content creators | Quickly get analytical framing for videos/articles |
| Coaches / analysts | Cross-compare players, validate role performance |
| Students / portfolio viewers | Demonstrate data product capabilities |

### 1.3 Design Principles

- **No installation required** — open `index.html` in any browser
- **No backend server** — pure HTML/JS/CSS, data loaded from local files
- **Role-aware analysis** — Controllers are not penalized for low Entry scores
- **Bilingual** — all AI-generated analysis is in English + Chinese

---

## 2. Current Features

### 2.1 Player Statistics Table

**Location:** Main page, always visible

**Columns:**

| Column | Description |
|---|---|
| Player | Name + Team |
| Role | Duelist / Initiator / Controller / Sentinel |
| Agents | Agent pool used at this event |
| ACS | Average Combat Score |
| K/D | Kill/Death ratio |
| KAST | % rounds with Kill / Assist / Survive / Trade |
| ADR | Average Damage per Round |
| KPR | Kills per Round |
| APR | Assists per Round |
| FKPR | First Kills per Round |
| FDPR | First Deaths per Round |
| HS% | Headshot percentage |
| Clutch% | Win rate in 1vX situations |
| Archetype | Player type label (see §2.5) |

**Interactions:**
- Click any column header → sort ascending / descending
- Search box → real-time filter by player name
- Team dropdown → filter by team (populated dynamically from data)
- Role dropdown → filter by role (Duelist / Initiator / Controller / Sentinel)
- All three filters work simultaneously (AND logic)

---

### 2.2 Player Profile Modal

**Trigger:** Click any row in the table

**Layout:**

```
┌──────────────────────────────────────────────────────┐
│  [Player Name]     [Team] · [Role Badge]        [✕] │
│  [Archetype Badge + Chinese tagline]                 │
│  Role focus: Teamplay · Survivability · Firepower    │
├─────────────────────┬────────────────────────────────┤
│                     │  [AI Analysis — English]       │
│  [Radar Chart]      │  ─────────────────────         │
│   380 × 380 px      │  [AI Analysis — Chinese]       │
│                     │                                │
│                     │  Strengths  │  Weaknesses      │
│                     │  • ...      │  • ...           │
│                     │                                │
│                     │  Strength Score Bars           │
│                     │  Firepower  ████████░  78      │
│                     │  Entry      █████░░░░  60      │
│                     │  Survival   ████████░  85      │
│                     │  Clutch     ██░░░░░░░  16      │
│                     │  Teamplay   ████████░  72      │
├─────────────────────┴────────────────────────────────┤
│  STATISTICS                                          │
│  [ACS] [K/D] [KAST] [ADR] [KPR] [APR] [FKPR] ...   │
├──────────────────────────────────────────────────────┤
│  VS [ROLE] AVERAGE                                   │
│  ACS +27.6%  ADR +29.6%  KAST -5.1%  ...            │
└──────────────────────────────────────────────────────┘
```

**Close:** Click ✕ button, or click the dark backdrop, or press Escape.

---

### 2.3 Radar Chart (Skill Radar)

Five dimensions displayed:

| Dimension | What it measures |
|---|---|
| Firepower | Damage output, kills, efficiency |
| Entry | First-blood impact |
| Survivability | Staying alive, round participation |
| Clutch | Performance in 1vX situations |
| Teamplay | Assists, enabling teammates |

**Scale:** 0–100, **relative to the current tournament field** (dynamic normalization).  
The player with the highest value in a dimension gets 100; the lowest gets 0.  
Scores reflect standing within this specific tournament, not a fixed pro-level benchmark.

Radar chart color matches the player's Archetype color.

---

### 2.4 Strength Score Bars

Five horizontal bars showing the same five scores (0–100), color-coded:

| Dimension | Color |
|---|---|
| Firepower | Red → Orange |
| Entry | Purple → Lavender |
| Survival | Blue → Light Blue |
| Clutch | Gold → Yellow |
| Teamplay | Green → Mint |

---

### 2.5 Archetype Classification

Players are classified by **Style × Tier** (15 possible labels):

**Performance Tier** (from role-weighted average score):

| Tier | Condition |
|---|---|
| Strong | weighted avg ≥ 60 |
| Average | 35 ≤ weighted avg < 60 |
| Struggling | weighted avg < 35 |

Role weights ensure Controllers are evaluated on Teamplay/Survivability, not Entry/Clutch.

**Play Style** (which dimension dominates):

| Style | Condition |
|---|---|
| Entry | Entry > 50 AND FKPR > FDPR |
| Clutch | Clutch > 60 AND is highest score |
| Support | Teamplay > 65 AND is highest score |
| Carry | Firepower > 55 AND is highest score |
| Balanced | None of the above |

**15 Archetype Labels:**

|  | Strong | Average | Struggling |
|---|---|---|---|
| **Entry** | First Blood Hunter 开路先锋 | Calculated Risk 冒险突破手 | Glass Cannon 风险高爆 |
| **Carry** | Silent Assassin 效率收割机 | Reliable Fragger 靠谱输出 | Misfiring 状态起伏 |
| **Clutch** | Comeback King 逆风之王 | Pressure Player 压力担当 | Lucky Shot 偶尔高光 |
| **Support** | The Enabler 幕后推手 | Team Player 团队支柱 | Role Question Mark 定位模糊 |
| **Balanced** | Swiss Army Knife 全能战士 | Jack of All Trades 样样通，样样松 | Dead Weight 团队的负担 |

Each archetype has a unique color shown in the badge and radar chart.

---

### 2.6 Role Benchmark Section

Compares a player's key stats against the average of all players in the same role at this tournament.

**Stats compared:** ACS, ADR, FKPR, KAST, Clutch%

**Display:** Each stat shows the player's value, the role average, and the delta (e.g., `+27.6%` in green, `-5.1%` in red).

---

### 2.7 AI Player Analysis (On-Demand)

**Trigger:** Automatically when a player modal opens.

**Process:**
1. Modal opens immediately showing stats, radar, scores
2. Summary area shows "Analyzing [name]…" with spinner
3. Browser calls DeepSeek API (`deepseek-chat`) with player stats + archetype + role context
4. Analysis appears in ~1–2 seconds
5. Result cached — clicking same player again shows instantly (no new API call)

**Output format:** 2–3 sentence analysis in English, followed by the same content in Chinese.

**Role-aware prompt:** The prompt explicitly instructs DeepSeek not to criticize dimensions that are not primary for the player's role (e.g., will not criticize a Controller for low Entry score).

**Fallback:** If API key is not set or the API call fails, a pre-written template matching the player's archetype is shown instead.

---

### 2.8 Player Comparison

**Location:** Below the stats table (appears when two players are selected)

**How to use:** Select Player A and Player B from the two dropdown menus.

**Display:**
- Side-by-side stat comparison (13 stats + 5 scores)
- Green = better value, Red = worse value
- Overlay radar chart showing both players simultaneously
- Summary sentence declaring which player has the overall statistical edge

---

### 2.9 Header & Data Freshness

The header shows:
- **Last scraped:** timestamp from most recent scraper run
- **↺ Refresh button:** reloads the page to pick up new `data.js`
- **Hint text:** `Run python3 scraper.py to get latest data, then click ↺`

---

## 3. Technical Architecture

### 3.1 File Structure

```
valorant analysis/
├── index.html                  ← dashboard UI
├── style.css                   ← all styling (dark gaming theme)
├── app.js                      ← all frontend logic
├── data.js                     ← player data (auto-generated by scraper)
├── data.json                   ← same data in JSON format (backup)
├── api_config.js               ← DeepSeek API key for browser (auto-generated)
├── scraper.py                  ← data collection + score computation
├── config.py                   ← API key (never committed to git)
├── requirements.txt            ← pip install -r requirements.txt
├── strength_scores_formula.md  ← formula documentation with changelog
└── .gitignore                  ← excludes config.py and api_config.js
```

### 3.2 Data Flow

```
VLR.gg
  ↓ requests + BeautifulSoup
scraper.py
  ↓ dynamic score normalization
  ↓ role-weighted archetype classification
  ↓ role benchmark computation
  → data.js / data.json    (player stats + scores, no summaries)
  → api_config.js          (DeepSeek key propagated to browser)

Browser loads index.html
  → reads data.js (window.VALORANT_DATA)
  → reads api_config.js (window.DEEPSEEK_API_KEY)
  → user clicks player
    → browser → DeepSeek API → AI summary rendered
    → cached for session
```

### 3.3 Third-Party Dependencies

| Dependency | Where | Purpose |
|---|---|---|
| Chart.js 4.4.4 | CDN in index.html | Radar charts |
| requests | Python (pip) | HTTP requests to VLR.gg |
| beautifulsoup4 | Python (pip) | HTML parsing |
| DeepSeek API | Browser fetch | AI summary generation |

---

## 4. Setup & Usage

### 4.1 Initial Setup (one-time)

```bash
# 1. Install Python dependencies
pip3 install -r requirements.txt

# 2. Add DeepSeek API key to config.py
# Edit config.py: DEEPSEEK_API_KEY = "sk-your-key-here"
# Get key at: platform.deepseek.com/api_keys
```

### 4.2 Daily Usage

```bash
# Refresh data (takes ~5 seconds)
python3 scraper.py
```

Then open `index.html` in browser and click **↺ Refresh**.

### 4.3 Key Behaviors

| Action | Result |
|---|---|
| Click table header | Sort by that column |
| Select team / role | Filter table |
| Type in search box | Filter by player name |
| Click a table row | Open player profile modal |
| Click backdrop or Esc | Close modal |
| Re-click same player | Instant summary (cached) |
| Select 2 players in comparison | Comparison section appears |

---

## 5. Score Formula Reference

See [strength_scores_formula.md](strength_scores_formula.md) for the complete formula documentation including:
- Normalization function definition
- Per-dimension input stats and weights
- Role weights for archetype tier computation
- Archetype classification decision tree
- Changelog (v1 fixed ranges → v2 dynamic ranges)

---

## 6. Known Limitations

| Limitation | Notes |
|---|---|
| Manual data refresh | No auto-update; user must run `python3 scraper.py` manually |
| Session-only cache | AI summaries cached in browser memory only; cleared on page reload |
| Local file only | No hosted URL; must be opened as a local file |
| Single tournament | Currently scoped to Masters London 2026 only |
| Role inference | Based on agent pool; may misclassify flex players who play multiple roles |
| VLR.gg dependency | Scraper breaks if VLR.gg changes their HTML structure |
