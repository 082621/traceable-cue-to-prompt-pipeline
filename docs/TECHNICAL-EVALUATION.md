# Technical evaluation plan

## Research questions

- **TRQ1 — Traceability:** Can an accepted message be linked to its required cue, support, and response-style IDs and checked against the corresponding source strings?
- **TRQ2 — Robustness:** Does bounded validation, repair, and fallback preserve all required information under omission, fabrication, parser, and provider faults?
- **TRQ3 — Performance:** What first-pass, repair, fallback, and p50/p95 latency trade-offs arise under a fixed model version?
- **TRQ4 — Reproducibility:** Do identical inputs produce byte-identical baseline/fallback outputs and stable plan digests?

These are computer-science questions about contracts, algorithms, fault tolerance, and empirical system behaviour. The original perceived-burden experiment can remain a separate HCI evaluation; it should not be used as a substitute for these component-level results.

## Measures

For required cue set `R`, returned trace set `T`, and source texts present in message `P`:

- Cue-ID coverage: `|R ∩ T| / |R|`.
- Cue-text coverage: `|R ∩ P| / |R|`, where presence requires exact source-text preservation.
- Unknown-ID count: `|T − R|`.
- First-pass rate: accepted attempts at attempt 1 / all cases.
- Repair rate: accepted attempts at attempt 2 / all cases.
- Fallback rate: deterministic fallbacks / all cases.
- End-to-end latency: client-visible or runner wall-clock milliseconds; report median and p95.

Acceptance requires 100% ID and text coverage, no unknown IDs, exact required support/style IDs and literal text, optional-text preservation, and no flagged fabricated safety claim.

## Experiments already implemented

1. **Schema/planner tests:** stable IDs, custom-source IDs, and tamper rejection.
2. **Validator tests:** full coverage, claimed-but-omitted text, missing IDs, and invented IDs.
3. **State-machine tests:** first-pass acceptance, successful repair, two-failure fallback, and immediate fallback for non-retryable quota errors.
4. **HTTP boundary tests:** valid response, malformed-input rejection, configuration reporting, and credential non-disclosure.
5. **Offline fault injection:** 30 synthetic cases across clean, omission, unknown-ID, provider-error, and persistent-invalid modes.
6. **Paired live ablation:** 30 cases × 3 randomised repeats across deterministic v1, structured model without recovery, and the full validated pipeline.
7. **Balanced edge corpus:** 20 synthetic cases across normal, schema-minimal, multi-concern, contradictory, and sensitive/safety categories.
8. **Blinded language comparison:** two Chinese-reading raters compare locked A/B baseline and accepted-pipeline messages for all 20 edge cases.

Run `npm run test:coverage` and `npm run benchmark`. Archive the command, commit hash or submitted ZIP checksum, Node version, result JSON, and machine specification with the dissertation.

## Live-model experiment

Run `npm run benchmark:live` only after API credit and model access are confirmed. Pin `OPENAI_MODEL` to a dated snapshot before collecting dissertation results. Repeat each synthetic case enough times to estimate variance; randomise case order and report temperature/reasoning settings, SDK version, date, model ID, account tier, and failure exclusions.

The runner intentionally stores metrics only, not generated emotional-support text. A run that only exercised deterministic fallback demonstrates availability/fault containment, not model quality or model adherence.

## Paired comparison implemented for the dissertation

The ablation runner evaluates three conditions on the same synthetic cases:

1. deterministic v1 baseline;
2. structured model output without independent validation/repair;
3. full validated pipeline.

It compares coverage, constraint failures, repair/fallback rate, latency, length, and repeatability. The exact same first model candidate is reused by conditions 2 and 3. See `docs/ABLATION-STUDY.md`. The implemented supplementary comparison uses two blinded raters and reports per-rater descriptive results without an inferential population claim.

## Current evidence and honest boundary

The expanded offline suite accepted all 30 fault-injection cases after controlled recovery. In the main 90-run live ablation, model-only Structured Outputs passed 80/90 runs with mean exact cue-text coverage of 98.67%. The full pipeline accepted 90/90 with 100% coverage: 80 first-pass, 8 repaired, and 2 deterministic fallback results. Model-only/full p50 latency was 1,844.05/1,850.47 ms and p95 was 3,552.17/4,115.01 ms. See `docs/RESULTS.md` and `benchmark/results/ablation-live-latest.json`.

The message-level provenance reconstruction of the 20-case edge record contains 20/20 accepted final outputs with complete cue and support preservation: 18 first-pass model outputs, one repaired output, and one deterministic fallback. The reconstruction links each accepted message to the canonical recovered plan and rechecks its required IDs and strings; it is not original per-sentence trace telemetry. The original per-case machine telemetry was unavailable, so aggregate method and latency values were transcribed from the submitted report. Each blinded rater preferred the pipeline in 19/20 pairs and selected no preference for the identical fallback pair. The pipeline's mean naturalness advantage was +2.40 for each rater; coherence remains separated by rater.

This supports the limited claim that independent validation and bounded recovery removed the invalid returns observed under Structured Outputs alone for these synthetic runs. It does not establish performance on participant-authored data, a population failure probability, comparative fluency, or clinical benefit. A final dissertation should retain those boundaries and, if access permits, repeat the experiment with a pinned model snapshot.
