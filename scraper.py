import requests
from bs4 import BeautifulSoup
import json
import re
import time
from datetime import datetime

try:
    from config import DEEPSEEK_API_KEY
except ImportError:
    DEEPSEEK_API_KEY = None

URL = "https://www.vlr.gg/event/stats/2765/valorant-masters-london-2026"

ROLE_WEIGHTS = {
    'Duelist':    [1.4, 1.5, 0.7, 1.0, 0.4],  # fp, en, sv, cl, tp
    'Initiator':  [1.0, 0.8, 1.2, 0.8, 1.4],
    'Controller': [0.8, 0.3, 1.3, 0.4, 1.6],
    'Sentinel':   [0.9, 0.4, 1.5, 1.0, 1.4],
    'Unknown':    [1.0, 1.0, 1.0, 1.0, 1.0],
}

ROLE_KEY_DIMS = {
    'Duelist':    ['firepower', 'entry', 'clutch'],
    'Initiator':  ['firepower', 'survivability', 'teamplay'],
    'Controller': ['teamplay', 'survivability', 'firepower'],
    'Sentinel':   ['survivability', 'teamplay', 'clutch'],
    'Unknown':    ['firepower', 'survivability', 'teamplay'],
}

ROLE_CONTEXT = {
    'Duelist':    'As a Duelist, Firepower and Entry are primary responsibilities. Clutch and Teamplay are secondary.',
    'Initiator':  'As an Initiator, Teamplay and Survivability are the primary job. Entry is secondary.',
    'Controller': 'As a Controller, Teamplay and Survivability are primary. Low Entry and Clutch are EXPECTED — do NOT criticize them.',
    'Sentinel':   'As a Sentinel, Survivability and Teamplay are primary. Entry is NOT expected to be high — do not criticize it.',
    'Unknown':    '',
}

AGENT_ROLES = {
    "jett": "Duelist", "reyna": "Duelist", "neon": "Duelist",
    "phoenix": "Duelist", "iso": "Duelist", "yoru": "Duelist",
    "sova": "Initiator", "fade": "Initiator", "breach": "Initiator",
    "skye": "Initiator", "kayo": "Initiator", "kay/o": "Initiator",
    "gekko": "Initiator",
    "brimstone": "Controller", "astra": "Controller", "omen": "Controller",
    "clove": "Controller", "harbor": "Controller", "viper": "Controller",
    "killjoy": "Sentinel", "cypher": "Sentinel", "sage": "Sentinel",
    "chamber": "Sentinel", "deadlock": "Sentinel", "vyse": "Sentinel",
}


def normalize(val, lo, hi):
    if hi == lo:
        return 0.0
    return max(0.0, min(1.0, (val - lo) / (hi - lo))) * 100


def compute_stat_ranges(players):
    keys = ['acs', 'adr', 'kd', 'kpr', 'apr', 'fkpr', 'kast', 'clutch_pct', 'clutch_wins']
    ranges = {}
    for k in keys:
        vals = [p[k] for p in players]
        ranges[k] = {'lo': min(vals), 'hi': max(vals)}

    net_entry = [p['fkpr'] - p['fdpr'] for p in players]
    ranges['net_entry'] = {'lo': min(net_entry), 'hi': max(net_entry)}

    inv_deaths = [1 / p['deaths_per_round'] for p in players if p['deaths_per_round'] > 0]
    ranges['inv_deaths'] = {'lo': min(inv_deaths), 'hi': max(inv_deaths)}

    return ranges


def r(ranges, key):
    return ranges[key]['lo'], ranges[key]['hi']


def compute_scores(p, ranges):
    acs = p.get("acs", 0)
    adr = p.get("adr", 0)
    kd = p.get("kd", 1.0)
    kpr = p.get("kpr", 0)
    apr = p.get("apr", 0)
    fkpr = p.get("fkpr", 0)
    fdpr = p.get("fdpr", 0)
    kast = p.get("kast", 0)
    clutch_pct = p.get("clutch_pct", 0)
    clutch_wins = p.get("clutch_wins", 0)
    deaths_per_round = p.get("deaths_per_round", 0.8)

    # Firepower: ADR weight 35% (was 30%), KPR weight 10% (was 15%)
    firepower = (
        normalize(acs, *r(ranges, 'acs'))       * 0.35
        + normalize(adr, *r(ranges, 'adr'))     * 0.35
        + normalize(kd,  *r(ranges, 'kd'))      * 0.20
        + normalize(kpr, *r(ranges, 'kpr'))     * 0.10
    )

    entry = (
        normalize(fkpr,           *r(ranges, 'fkpr'))      * 0.60
        + normalize(fkpr - fdpr,  *r(ranges, 'net_entry')) * 0.40
    )

    survivability = (
        normalize(kast, *r(ranges, 'kast')) * 0.60
        + (normalize(1 / deaths_per_round, *r(ranges, 'inv_deaths')) * 0.40
           if deaths_per_round > 0 else 0)
    )

    clutch = (
        normalize(clutch_pct,   *r(ranges, 'clutch_pct'))   * 0.70
        + normalize(clutch_wins, *r(ranges, 'clutch_wins')) * 0.30
    )

    teamplay = (
        normalize(apr,  *r(ranges, 'apr'))  * 0.60
        + normalize(kast, *r(ranges, 'kast')) * 0.40
    )

    return {
        "firepower": round(firepower, 1),
        "entry": round(entry, 1),
        "survivability": round(survivability, 1),
        "clutch": round(clutch, 1),
        "teamplay": round(teamplay, 1),
    }


def classify_archetype(scores, p):
    fp = scores["firepower"]
    en = scores["entry"]
    sv = scores["survivability"]
    cl = scores["clutch"]
    tp = scores["teamplay"]
    fkpr = p.get("fkpr", 0)
    fdpr = p.get("fdpr", 0)

    role = p.get("role", "Unknown")
    weights = ROLE_WEIGHTS.get(role, ROLE_WEIGHTS['Unknown'])
    vals = [fp, en, sv, cl, tp]
    weighted_avg = sum(v * w for v, w in zip(vals, weights)) / sum(weights)
    tier = "strong" if weighted_avg >= 60 else ("struggling" if weighted_avg < 35 else "average")

    all_vals = [fp, en, sv, cl, tp]
    max_val = max(all_vals)

    # Style thresholds rescaled for dynamic 0–100 range
    if en > 50 and fkpr > fdpr:
        style = "entry"
    elif cl > 60 and cl == max_val:
        style = "clutch"
    elif tp > 65 and tp == max_val:
        style = "support"
    elif fp > 55 and fp == max_val:
        style = "carry"
    else:
        style = "balanced"

    labels = {
        ("entry",   "strong"):    "First Blood Hunter",
        ("entry",   "average"):   "Calculated Risk",
        ("entry",   "struggling"):"Glass Cannon",
        ("carry",   "strong"):    "Silent Assassin",
        ("carry",   "average"):   "Reliable Fragger",
        ("carry",   "struggling"):"Misfiring",
        ("clutch",  "strong"):    "Comeback King",
        ("clutch",  "average"):   "Pressure Player",
        ("clutch",  "struggling"):"Lucky Shot",
        ("support", "strong"):    "The Enabler",
        ("support", "average"):   "Team Player",
        ("support", "struggling"):"Role Question Mark",
        ("balanced","strong"):    "Swiss Army Knife",
        ("balanced","average"):   "Jack of All Trades",
        ("balanced","struggling"):"Dead Weight",
    }
    return labels[(style, tier)]


def infer_role(agents):
    role_counts = {}
    for agent in agents:
        role = AGENT_ROLES.get(agent.lower().replace("/", ""), None)
        if role:
            role_counts[role] = role_counts.get(role, 0) + 1
    if not role_counts:
        return "Unknown"
    return max(role_counts, key=role_counts.get)


def parse_pct(s):
    s = s.strip().replace("%", "").replace("+", "")
    try:
        return float(s)
    except Exception:
        return 0.0


def parse_num(s):
    s = s.strip().replace(",", "")
    try:
        return float(s)
    except Exception:
        return 0.0


def scrape():
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    try:
        resp = requests.get(URL, headers=headers, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        players = parse_table(soup)
        if players:
            print(f"Scraped {len(players)} players from VLR.gg")
            return players
    except Exception as e:
        print(f"Scraping failed: {e}")

    print("Using fallback sample data")
    return get_fallback_data()


def parse_table(soup):
    players = []
    table = soup.find("table", class_=re.compile(r"mod-overview"))
    if not table:
        table = soup.find("table")
    if not table:
        return []

    rows = table.find_all("tr")
    for row in rows[1:]:
        cells = row.find_all("td")
        if len(cells) < 10:
            continue

        # Player name  (class text-of)
        name_cell = cells[0]
        name_tag = name_cell.find("div", class_="text-of")
        name = name_tag.get_text(strip=True) if name_tag else name_cell.get_text(strip=True)

        # Team  (class stats-player-country contains team abbreviation on VLR stats page)
        team_tag = name_cell.find("div", class_="stats-player-country")
        team = team_tag.get_text(strip=True) if team_tag else "—"

        # VLR profile URL — already in the <a href="/player/11494/keiko"> tag
        link_tag = name_cell.find("a", href=True)
        vlr_path = link_tag["href"] if link_tag else ""
        vlr_url = f"https://www.vlr.gg{vlr_path}" if vlr_path else ""

        # Agents — parse from img src path, e.g. /img/vlr/game/agents/vyse.png → "Vyse"
        agent_imgs = cells[1].find_all("img") if len(cells) > 1 else []
        agents = []
        for img in agent_imgs:
            src = img.get("src", "")
            # extract filename without extension
            fname = src.rsplit("/", 1)[-1].replace(".png", "").replace("-", " ")
            if fname:
                agents.append(fname.title())

        # VLR stats page column order (0-indexed, after td[0]=player, td[1]=agents):
        # [2] rounds  [3] rating  [4] ACS  [5] K:D  [6] KAST  [7] ADR
        # [8] KPR  [9] APR  [10] FKPR  [11] FDPR  [12] HS%  [13] Clutch%  [14] Clutch (wins/att)
        def cell_val(idx):
            if idx < len(cells):
                return cells[idx].get_text(strip=True).split("\n")[0].strip()
            return "0"

        acs = parse_num(cell_val(4))
        kd = parse_num(cell_val(5))
        kast = parse_pct(cell_val(6))
        adr = parse_num(cell_val(7))
        kpr = parse_num(cell_val(8))
        apr = parse_num(cell_val(9))
        fkpr = parse_num(cell_val(10))
        fdpr = parse_num(cell_val(11))
        hs_pct = parse_pct(cell_val(12))
        clutch_raw = cell_val(13) if len(cells) > 13 else "0"
        clutch_wins_raw = cell_val(14) if len(cells) > 14 else "0"

        # Clutch% cell: "27%"
        clutch_pct = parse_pct(clutch_raw)

        # Clutch wins cell: "3/11" → 3 wins
        clutch_wins = 0
        m = re.match(r"(\d+)\s*/\s*\d+", clutch_wins_raw)
        if m:
            clutch_wins = int(m.group(1))

        deaths_per_round = (1 / kd) * kpr if kd > 0 else 0.8

        player = {
            "name": name,
            "team": team,
            "agents": agents,
            "role": infer_role(agents),
            "acs": acs,
            "kd": kd,
            "kast": kast,
            "adr": adr,
            "kpr": kpr,
            "apr": apr,
            "fkpr": fkpr,
            "fdpr": fdpr,
            "hs_pct": hs_pct,
            "clutch_pct": clutch_pct,
            "clutch_wins": clutch_wins,
            "deaths_per_round": deaths_per_round,
            "vlr_url": vlr_url,
        }

        players.append(player)

    return players


def add_role_benchmarks(players):
    roles = {}
    for p in players:
        r = p["role"]
        if r not in roles:
            roles[r] = []
        roles[r].append(p)

    for role, group in roles.items():
        n = len(group)
        avg = {
            "acs": sum(p["acs"] for p in group) / n,
            "adr": sum(p["adr"] for p in group) / n,
            "fkpr": sum(p["fkpr"] for p in group) / n,
            "kast": sum(p["kast"] for p in group) / n,
            "clutch_pct": sum(p["clutch_pct"] for p in group) / n,
        }
        for p in group:
            p["role_avg"] = {k: round(v, 2) for k, v in avg.items()}
            p["vs_role"] = {}
            for stat, av in avg.items():
                val = p[stat]
                if av > 0:
                    delta = round((val / av - 1) * 100, 1)
                    p["vs_role"][stat] = f"{'+' if delta >= 0 else ''}{delta}%"
                else:
                    p["vs_role"][stat] = "—"


def get_fallback_data():
    raw = [
        {"name": "aspas", "team": "LOUD", "agents": ["Jett", "Neon"], "acs": 282, "kd": 1.42, "kast": 74.2, "adr": 168, "kpr": 0.98, "apr": 0.18, "fkpr": 0.22, "fdpr": 0.14, "hs_pct": 28, "clutch_pct": 31, "clutch_wins": 5},
        {"name": "cNed", "team": "FUT", "agents": ["Jett", "Iso"], "acs": 265, "kd": 1.31, "kast": 71.8, "adr": 157, "kpr": 0.91, "apr": 0.21, "fkpr": 0.25, "fdpr": 0.19, "hs_pct": 33, "clutch_pct": 22, "clutch_wins": 3},
        {"name": "Derke", "team": "NIP", "agents": ["Jett", "Reyna"], "acs": 258, "kd": 1.28, "kast": 70.5, "adr": 153, "kpr": 0.88, "apr": 0.19, "fkpr": 0.21, "fdpr": 0.17, "hs_pct": 31, "clutch_pct": 19, "clutch_wins": 2},
        {"name": "Less", "team": "LOUD", "agents": ["Sova", "Fade"], "acs": 221, "kd": 1.15, "kast": 78.9, "adr": 138, "kpr": 0.79, "apr": 0.38, "fkpr": 0.16, "fdpr": 0.18, "hs_pct": 22, "clutch_pct": 14, "clutch_wins": 2},
        {"name": "Boaster", "team": "FNC", "agents": ["Omen", "Brimstone"], "acs": 198, "kd": 1.02, "kast": 76.4, "adr": 126, "kpr": 0.72, "apr": 0.45, "fkpr": 0.13, "fdpr": 0.15, "hs_pct": 18, "clutch_pct": 11, "clutch_wins": 1},
        {"name": "Chronicle", "team": "FNC", "agents": ["Killjoy", "Cypher"], "acs": 208, "kd": 1.18, "kast": 79.2, "adr": 132, "kpr": 0.76, "apr": 0.22, "fkpr": 0.14, "fdpr": 0.12, "hs_pct": 25, "clutch_pct": 28, "clutch_wins": 4},
        {"name": "Saadhak", "team": "LOUD", "agents": ["Astra", "Viper"], "acs": 195, "kd": 1.05, "kast": 80.1, "adr": 121, "kpr": 0.71, "apr": 0.52, "fkpr": 0.11, "fdpr": 0.13, "hs_pct": 17, "clutch_pct": 9, "clutch_wins": 1},
        {"name": "Alfajer", "team": "FNC", "agents": ["Jett", "Chamber"], "acs": 271, "kd": 1.38, "kast": 72.5, "adr": 162, "kpr": 0.94, "apr": 0.17, "fkpr": 0.24, "fdpr": 0.16, "hs_pct": 29, "clutch_pct": 25, "clutch_wins": 3},
        {"name": "jawgemo", "team": "EG", "agents": ["Jett", "Neon"], "acs": 248, "kd": 1.24, "kast": 69.8, "adr": 149, "kpr": 0.87, "apr": 0.20, "fkpr": 0.28, "fdpr": 0.22, "hs_pct": 26, "clutch_pct": 17, "clutch_wins": 2},
        {"name": "Demon1", "team": "EG", "agents": ["Iso", "Reyna"], "acs": 275, "kd": 1.41, "kast": 73.6, "adr": 165, "kpr": 0.96, "apr": 0.16, "fkpr": 0.20, "fdpr": 0.15, "hs_pct": 27, "clutch_pct": 35, "clutch_wins": 6},
        {"name": "Zest", "team": "DRX", "agents": ["Sova", "Gekko"], "acs": 229, "kd": 1.19, "kast": 77.3, "adr": 141, "kpr": 0.81, "apr": 0.35, "fkpr": 0.17, "fdpr": 0.19, "hs_pct": 23, "clutch_pct": 16, "clutch_wins": 2},
        {"name": "stax", "team": "DRX", "agents": ["Omen", "Astra"], "acs": 201, "kd": 1.08, "kast": 78.4, "adr": 127, "kpr": 0.74, "apr": 0.48, "fkpr": 0.12, "fdpr": 0.14, "hs_pct": 19, "clutch_pct": 10, "clutch_wins": 1},
    ]

    players = []
    for p in raw:
        p["role"] = infer_role(p["agents"])
        kd = p["kd"]
        kpr = p["kpr"]
        p["deaths_per_round"] = (1 / kd) * kpr if kd > 0 else 0.8
        players.append(p)

    return players


EN_TEMPLATES = {
    'First Blood Hunter':  lambda n: f"{n} is a relentless first-blood specialist who consistently wins opening duels and shifts map control before most players have fired a shot.",
    'Calculated Risk':     lambda n: f"{n} approaches entry with tactical aggression — not reckless, not passive — generating consistent pressure while keeping risk manageable.",
    'Glass Cannon':        lambda n: f"{n} loves to take the first fight but hasn't converted that aggression into consistent round wins. High risk, inconsistent reward.",
    'Silent Assassin':     lambda n: f"{n} is a high-efficiency carry: elite damage output, strong K/D, and the ability to close rounds without needing the highlight reel.",
    'Reliable Fragger':    lambda n: f"{n} is a steady, dependable damage dealer — not flashy, but consistently present on the scoreboard when it matters.",
    'Misfiring':           lambda n: f"{n} has the tools to carry but the numbers show inconsistency. Some rounds dominant, others absent — ceiling is higher with more stability.",
    'Comeback King':       lambda n: f"{n} is the player opponents fear in 1vX situations. Exceptional clutch rate signals elite composure and the ability to convert rounds that should be lost.",
    'Pressure Player':     lambda n: f"{n} shows up when the round is on the line. Reliable under pressure, with the composure to stay calm in late-round situations.",
    'Lucky Shot':          lambda n: f"{n} has had standout clutch moments this tournament, though the sample is limited. A few more performances like those would change the narrative.",
    'The Enabler':         lambda n: f"{n} makes teammates better. High assist rates and exceptional round participation show a player who creates opportunities and keeps rounds alive.",
    'Team Player':         lambda n: f"{n} is a reliable team-first player whose consistent participation and assist numbers show clear role understanding and disciplined execution.",
    'Role Question Mark':  lambda n: f"{n}'s numbers sit below role average without a clear standout category. Could reflect tough matchups, strategic sacrifice, or an off tournament.",
    'Swiss Army Knife':    lambda n: f"{n} is a complete player with no exploitable weakness — elite across firepower, entry, clutch, and teamplay. The kind of profile coaches build systems around.",
    'Jack of All Trades':  lambda n: f"{n} is well-rounded without dominating any single category. Versatile and adaptable — no obvious weak point for opponents to target.",
    'Dead Weight':         lambda n: f"{n}'s numbers are significantly below role average across all dimensions. Whether matchup difficulty or form, the stats don't tell a flattering story this tournament.",
}

ZH_TEMPLATES = {
    'First Blood Hunter':  lambda n: f"{n}是本届赛事最具威胁性的开团选手之一，能够稳定赢得前期对枪，在大多数人开枪之前便已掌控地图节奏。",
    'Calculated Risk':     lambda n: f"{n}的打法介于激进与保守之间，以可控风险换取稳定推进空间，即便数据不亮眼，对团队贡献切实存在。",
    'Glass Cannon':        lambda n: f"{n}热衷于主动发起对枪，但尚未将进攻性转化为稳定回合胜率。高风险、高波动，可以瞬间扭转局面，也可能送上早期优势。",
    'Silent Assassin':     lambda n: f"{n}是高效carry选手：顶级伤害输出、稳定K/D，不需要高光时刻便能锁定回合。当别人抢首杀时，{n}已悄悄完成最具价值的击杀。",
    'Reliable Fragger':    lambda n: f"{n}是稳定可靠的输出手，不花哨，但在关键时刻始终出现在计分板上，整个赛程都能交出稳健的数据表现。",
    'Misfiring':           lambda n: f"{n}具备核心carry的实力，但数据显示发挥不稳定，某些回合强势，另一些几乎消失。找到状态稳定性后，上限将会更高。",
    'Comeback King':       lambda n: f"{n}是对手在1vX局面中最不想遇到的对手，超高clutch胜率体现了顶级心态、扎实判断，以及将本该输掉的回合硬生生拿下的实力。",
    'Pressure Player':     lambda n: f"关键回合来临时，{n}会站出来。不一定是积分榜首位，但在压力时刻表现稳定，后期冷静处理局势的能力为团队带来切实价值。",
    'Lucky Shot':          lambda n: f"{n}在本届赛事中有过几次亮眼的clutch时刻，但样本有限，还不足以断定为稳定强项。再多几场类似表现，评价将会改变。",
    'The Enabler':         lambda n: f"{n}能让队友变得更强，高助攻数与超高回合参与率体现了善于创造机会、收集信息、在关键时刻撑住局面的能力。",
    'Team Player':         lambda n: f"{n}是可靠的团队型选手，稳定的回合参与度和扎实的助攻数说明他清楚自己的定位，并在不需要个人英雄主义的情况下持续执行到位。",
    'Role Question Mark':  lambda n: f"{n}各维度数据均低于同位置平均水平，且没有明显亮点解释这一差距。可能是对阵强队、战术牺牲，也可能只是本届状态欠佳。",
    'Swiss Army Knife':    lambda n: f"{n}是无懈可击的全能型选手，火力、突破、clutch与团队协作均处于顶级水准，这种均衡的能力图谱是教练团队构建体系的基础。",
    'Jack of All Trades':  lambda n: f"{n}全面均衡，但没有哪个维度形成统治力。灵活适应各种局面，对手也很难找到明显软肋，稳定性是目前最大的优势。",
    'Dead Weight':         lambda n: f"{n}在本届赛事中各项关键数据均明显低于同位置平均水平，无论是对阵强队、打法不契合还是状态欠佳，本届数据都难以给出正面评价。",
}


def generate_ai_summary(p):
    if not DEEPSEEK_API_KEY or DEEPSEEK_API_KEY == "sk-":
        return None

    vs = p.get("vs_role", {})
    prompt = f"""You are a professional Valorant esports analyst. Write a concise player analysis for {p['name']}.

Player: {p['name']} | Team: {p['team']} | Role: {p['role']} | Archetype: {p['archetype']}

Stats:
- ACS: {p['acs']:.0f} | ADR: {p['adr']:.1f} | K/D: {p['kd']:.2f} | KAST: {p['kast']:.1f}%
- FKPR: {p['fkpr']:.2f} | FDPR: {p['fdpr']:.2f} | APR: {p['apr']:.2f} | Clutch%: {p['clutch_pct']:.1f}%

Strength Scores (0-100, relative to tournament field):
Firepower {p['firepower']:.0f} | Entry {p['entry']:.0f} | Survivability {p['survivability']:.0f} | Clutch {p['clutch']:.0f} | Teamplay {p['teamplay']:.0f}

vs Role Average: ACS {vs.get('acs','—')} | ADR {vs.get('adr','—')} | KAST {vs.get('kast','—')} | FKPR {vs.get('fkpr','—')}

Role context: {ROLE_CONTEXT.get(p.get('role', 'Unknown'), '')}

Return ONLY valid JSON with this exact format:
{{"en": "2-3 sentence English analysis.", "zh": "2-3句中文分析。"}}

Requirements:
- English: professional esports analyst tone, reference specific stats, explain WHY this player stands out or falls short
- Chinese: same content in natural Chinese, engaging tone, mention the player name
- Respect the role context above — do NOT criticize dimensions that are not primary responsibilities for this role
- Do NOT use markdown, do NOT add any text outside the JSON object"""

    try:
        resp = requests.post(
            "https://api.deepseek.com/chat/completions",
            headers={
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                "max_tokens": 400,
            },
            timeout=20,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"].strip()
        # Strip markdown code fences if model wraps output
        if content.startswith("```"):
            content = re.sub(r"^```[a-z]*\n?", "", content)
            content = re.sub(r"\n?```$", "", content)
        result = json.loads(content)
        if "en" in result and "zh" in result:
            return result
    except Exception as e:
        print(f"    ! Failed: {e}")
    return None


def main():
    players = scrape()                          # pass 1: raw stats only
    ranges = compute_stat_ranges(players)       # compute dynamic bounds
    for p in players:                           # pass 2: scores + archetype
        scores = compute_scores(p, ranges)
        p.update(scores)
        p["archetype"] = classify_archetype(scores, p)
        p["role_key_dims"] = ROLE_KEY_DIMS.get(p["role"], ROLE_KEY_DIMS['Unknown'])
    add_role_benchmarks(players)

    # Summaries are now generated on-demand in the browser (no API calls here)
    for p in players:
        p["summary_en"] = ""
        p["summary_zh"] = ""

    output = {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "source": URL,
        "players": players,
    }
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"Saved data.json with {len(players)} players.")

    # Also write data.js so index.html works when opened as a local file
    # (browsers block fetch() for file:// URLs, but <script src="data.js"> always works)
    with open("data.js", "w", encoding="utf-8") as f:
        f.write("window.VALORANT_DATA = ")
        json.dump(output, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    print("Saved data.js (used by the dashboard).")

    # Write api_config.js so the browser can call DeepSeek on-demand
    api_key = DEEPSEEK_API_KEY or ""
    with open("api_config.js", "w", encoding="utf-8") as f:
        f.write(f"window.DEEPSEEK_API_KEY = {json.dumps(api_key)};\n")
    print("Saved api_config.js (browser uses this for on-demand AI summaries).")


if __name__ == "__main__":
    main()
