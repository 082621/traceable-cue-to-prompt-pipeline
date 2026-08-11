# Recorded technical results

## Main three-condition ablation

The main experiment used all 30 deterministic synthetic cases, three repeated generations per case, and randomised run order with seed `20260805`. Each raw model candidate was shared by the model-only and full-pipeline conditions, so differences are paired and the validator did not obtain an easier second first attempt. Generated text was represented only by length and a truncated SHA-256 hash; message content was not persisted.

| Condition | Accepted | Mean cue-ID coverage | Mean exact cue-text coverage | p50 latency | p95 latency | Repeat-consistent cases |
|---|---:|---:|---:|---:|---:|---:|
| Deterministic v1 | 90/90 (100%) | 100% | 100% | 0.032 ms | 0.0565 ms | 30/30 |
| Structured model, no recovery | 80/90 (88.89%) | 100% | 98.67% | 1,844.05 ms | 3,552.17 ms | 0/30 |
| Validated repair/fallback pipeline | 90/90 (100%) | 100% | 100% | 1,850.47 ms | 4,115.01 ms | 0/30 |

The 90 paired runs required 100 provider calls. Of the ten raw outputs rejected across nine unique cases, eight passed one repair attempt and two required deterministic fallback. The complete pipeline therefore added ten calls (11.11%) and increased mean latency by 273.37 ms. Median overhead was only 6.42 ms because validation is local when the first output passes; p95 overhead was 562.85 ms because repair adds a second network/model call.

## Why the independent validator mattered

All raw model outputs claimed every required cue ID, so cue-ID coverage alone was 100%. Nevertheless, seven runs omitted at least one required source phrase, one run triggered a safety flag, and three rejected runs failed another required constraint without an ID or cue-text omission. Structured schema adherence therefore did not imply semantic faithfulness.

The full pipeline returned 100% cue-ID and cue-text coverage with no unknown IDs or residual safety flags. Its recovery distribution was:

- 80 first-pass model outputs;
- 8 model outputs accepted after one repair;
- 2 validated deterministic fallbacks.

Raw failures were observed in 10/90 runs across 9/30 cases. Eight of the ten occurred in runs containing custom text, and seven used two simultaneous support needs. These are exploratory associations only: the corpus was not balanced or powered to infer that those factors caused failure.

## Output length and repeatability

Mean draft length was 324.80 characters for deterministic v1, 136.34 for raw model output, and 141.56 for the full pipeline. Deterministic output produced the same hash in all three repeats for every case. Neither model condition produced an identical hash across all three repeats for any case, showing that model-backed wording was variable even when all required content survived.

## Supporting evaluations

| Evaluation | Scope | Result |
|---|---:|---|
| Automated test suite | 31 tests across 9 files | 31 passed |
| Offline fault injection | 30 cases | 30/30 accepted after bounded recovery |
| Initial live feasibility pilot | 8 cases × 1 | 8/8 first-pass accepted |
| Supplementary edge evidence | 20 reconstructed case records | 20/20 accepted; 18 first pass, 1 repair, 1 fallback |
| Blinded language comparison | 20 pairs × 2 raters | Pipeline preferred 19/20 by each rater; 1 no preference |

The dissertation snapshot recorded 93.64% statements, 70.96% branches, 95.06% functions, and 96.03% lines. The synchronized recovery run passes the same 31-test count with 94.71% statements, 79.06% branches, 98.05% functions, and 97.30% lines; the difference reflects the recovered edge-corpus assertions and current V8 instrumentation rather than a weaker threshold.

The expanded offline fault-injection run cycled through clean, missing-text, missing-ID, unknown-ID, provider-error, and persistent-invalid modes. It produced 5 first-pass results, 15 repaired results, and 10 deterministic fallbacks; every returned output reached exact cue-ID/text coverage of 1.0.

In the provenance-labelled reconstruction of the 20-case edge record, baseline and accepted pipeline outputs both reached 20/20 cue-ID coverage, exact cue-text coverage, and support-need preservation. Mean message length was 264.35 characters for the deterministic baseline and 114.45 for the accepted pipeline. The aggregate report records 22 provider calls and latency of 1,788.69 ms p50, 4,296.54 ms p95, and 2,284.58 ms mean. The preserved blind materials identify `edge-16` in the contradictory category as the single fallback; the aggregate report places one repair in the sensitive/safety category but does not identify the individual case.

Both blinded raters preferred the pipeline output in 19/20 cases and selected no preference for `edge-16`, where fallback made the pair identical. For each rater, the pipeline's mean naturalness advantage was +2.40 points. Concision also favoured the pipeline, while coherence is reported separately by rater because the two raters applied that construct differently.

## Claim boundary

The main result supports a software-engineering claim: under these synthetic cases, independent semantic validation plus bounded recovery eliminated observed invalid returns that remained possible under Structured Outputs alone. The supplementary ratings support a bounded naturalness, concision, and preference claim for the 20 preserved synthetic pairs. Neither result demonstrates clinical effectiveness, population language preference, or universal model reliability. Results should therefore be reported descriptively rather than as population-level estimates.

Machine-readable evidence is stored in:

- `benchmark/results/ablation-live-latest.json` — 90 paired runs;
- `benchmark/results/ablation-summary.csv` — condition-level table;
- `benchmark/results/offline-latest.json` — 30 fault-injection cases;
- `benchmark/results/live-latest.json` — initial 8-case pilot;
- `benchmark/results/edge-benchmark-latest.json` — provenance-labelled reconstruction of the 20-case record;
- `benchmark/results/naturalness-condition-key-latest.json` — locked A/B mapping;
- `benchmark/results/naturalness-ratings-latest.json` — decoded two-rater results;
- `benchmark/results/naturalness-summary.csv` — per-rater descriptive table.

Dissertation figures are stored in `docs/figures/`, including the ablation, edge-method, and blind-rating summaries.
