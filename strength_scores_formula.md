# Strength Scores Formula

All five scores are on a **0–100 scale**.

Each input stat is first **normalized** into 0–100 using:

```
normalize(val, lo, hi) = clamp((val - lo) / (hi - lo), 0, 1) × 100
```

**Ranges are dynamic** — `lo` and `hi` are computed from the actual player pool each time the scraper runs.
The player with the highest value in a stat receives 100; the lowest receives 0.
Scores reflect *where a player ranks within this specific tournament field*, not a fixed assumption about what pro stats look like.

---

## 1. Firepower Score

> How much damage and kills does this player generate?

| Input Stat | Range (lo → hi) | Weight |
|---|---|---|
| ACS (Average Combat Score) | dynamic (tournament min→max) | 35% |
| ADR (Average Damage per Round) | dynamic | **35%** |
| K/D Ratio | dynamic | 20% |
| KPR (Kills per Round) | dynamic | **10%** |

```
Firepower = normalize(ACS, lo, hi) × 0.35
          + normalize(ADR, lo, hi) × 0.35
          + normalize(KD,  lo, hi) × 0.20
          + normalize(KPR, lo, hi) × 0.10
```

---

## 2. Entry Score

> How effective is this player at winning opening duels?

| Input Stat | Range (lo → hi) | Weight |
|---|---|---|
| FKPR (First Kills per Round) | dynamic | 60% |
| FKPR − FDPR (net first-blood) | dynamic | 40% |

```
Entry = normalize(FKPR,        lo, hi) × 0.60
      + normalize(FKPR - FDPR, lo, hi) × 0.40
```

`FKPR − FDPR` measures whether the player wins more first duels than they lose.
A positive value means they're a net positive entry fragger.

---

## 3. Survivability Score

> How well does this player stay alive and contribute across rounds?

| Input Stat | Range (lo → hi) | Weight |
|---|---|---|
| KAST% (rounds with Kill/Assist/Survive/Trade) | dynamic | 60% |
| 1 / Deaths per Round (inverse death rate) | dynamic | 40% |

```
deaths_per_round = (1 / KD) × KPR

Survivability = normalize(KAST,                lo, hi) × 0.60
              + normalize(1 / deaths_per_round, lo, hi) × 0.40
```

Higher inverse death rate = fewer deaths per round = harder to kill.

---

## 4. Clutch Score

> How often does this player win low-HP or outnumbered situations?

| Input Stat | Range (lo → hi) | Weight |
|---|---|---|
| Clutch% (win rate in 1vX situations) | dynamic | 70% |
| Clutch Wins (absolute count) | dynamic | 30% |

```
Clutch = normalize(Clutch%,    lo, hi) × 0.70
       + normalize(ClutchWins, lo, hi) × 0.30
```

---

## 5. Teamplay Score

> How much does this player enable and support teammates?

| Input Stat | Range (lo → hi) | Weight |
|---|---|---|
| APR (Assists per Round) | dynamic | 60% |
| KAST% | dynamic | 40% |

```
Teamplay = normalize(APR,  lo, hi) × 0.60
         + normalize(KAST, lo, hi) × 0.40
```

KAST appears again here because surviving and trading also reflects team engagement,
not just individual kills.

---

## Archetype Classification

After computing all five scores, the player is classified by **Style × Tier**:

### Performance Tier (from average of 5 scores)

| Tier | Condition | Meaning |
|---|---|---|
| **Strong** | avg ≥ 43 | Top ~25% of players |
| **Average** | 22 ≤ avg < 43 | Middle ~55% |
| **Struggling** | avg < 22 | Bottom ~20% |

### Play Style (which dimension dominates)

| Style | Condition |
|---|---|
| **Entry** | Entry > 35 AND FKPR > FDPR |
| **Clutch** | Clutch > 45 AND is highest score |
| **Support** | Teamplay > 56 AND is highest score |
| **Carry** | Firepower > 38 AND is highest score |
| **Balanced** | None of the above |

### 15 Resulting Archetypes

|  | Strong | Average | Struggling |
|---|---|---|---|
| **Entry** | First Blood Hunter 开路先锋 | Calculated Risk 冒险突破手 | Glass Cannon 风险高爆 |
| **Carry** | Silent Assassin 效率收割机 | Reliable Fragger 靠谱输出 | Misfiring 状态起伏 |
| **Clutch** | Comeback King 逆风之王 | Pressure Player 压力担当 | Lucky Shot 偶尔高光 |
| **Support** | The Enabler 幕后推手 | Team Player 团队支柱 | Role Question Mark 定位模糊 |
| **Balanced** | Swiss Army Knife 全能战士 | Jack of All Trades 样样通，样样松 | Dead Weight 团队的负担 |

> With dynamic ranges, scores now span the full 0–100 scale relative to the tournament field.
> Tier thresholds: Strong ≥ 60 · Average 35–60 · Struggling < 35.

---

## Changelog

### v2 — 2026-06-09
- **Firepower weights updated:** ADR 30% → 35%, KPR 15% → 10% (ADR reflects sustained damage output more reliably than raw kill rate)
- **All normalization bounds are now dynamic** — derived from actual tournament min/max per stat on each scraper run
- **Archetype tier thresholds recalibrated** for full 0–100 dynamic scale: Strong ≥ 60, Struggling < 35
- **Style detection thresholds rescaled:** Entry > 50, Clutch > 60, Support > 65, Carry > 55

### v1 — 2026-06-09
- Initial formula with fixed normalization bounds (ACS: 150–350, ADR: 80–200, etc.)
- Firepower weights: ACS 35%, ADR 30%, KD 20%, KPR 15%
- Archetype tier thresholds calibrated to observed pro-player range (~5–50): Strong ≥ 43, Struggling < 22
