# Scientific Muscle Volume Model

## Purpose

The Weekly Summary uses an evidence-informed **fractional-set** accounting model instead of counting every involved muscle as a full set.

### Set weights

- **Direct / primary muscle:** `1.00 × sets`
- **Indirect / secondary muscle:** `0.50 × sets`
- **Stability / corrective exercise:** tracked separately and **not included** in hypertrophy effective-set totals.

Example:

- 3 Hack Squat sets → Quads `3.0` effective sets
- 3 Hack Squat sets → Glutes `1.5` effective sets

Formula:

`Effective Sets = Σ(sets × muscle contribution coefficient)`

The 0.5 fractional treatment is based on the 2026 dose-response meta-regression that compared direct, total, and fractional counting of indirect sets and found the strongest relative evidence for the fractional method.

## Important interpretation

This is a **volume-accounting model**, not a claim that a secondary muscle receives exactly 50% of the physiological stimulus of the primary muscle. Exercise biomechanics, range of motion, load, technique, proximity to failure, and individual anatomy can change actual stimulus.

RIR is therefore kept as a separate training-quality variable in Chieftain rather than being converted into an arbitrary volume multiplier.

## Stability / corrective work

Exercises such as planks, dead bugs, bird dogs, wall slides, scapular-control drills and similar corrective/isometric movements are reported as stability exposure but do not inflate the hypertrophy volume number.

This avoids presenting three sets of a corrective drill as equivalent to three hard hypertrophy sets.

## Sources

1. The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains. Sports Medicine, 2026. PMID 41343037.
2. Exploring the Dose-Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy. Sports Medicine, 2024. PMID 38970765.

Last model revision: `2026.10-fractional-v1`.
