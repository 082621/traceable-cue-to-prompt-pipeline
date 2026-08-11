# Technical benchmark

`npm run benchmark` executes 30 synthetic cases against deterministic fault modes. It injects omitted cue text, missing or invented trace IDs, provider errors, and persistent invalid output. The pipeline gets at most one repair attempt and then uses the validated deterministic fallback.

`npm run benchmark:live` runs the same non-personal synthetic cases through the configured OpenAI model. It requires `.env.local` and may incur API usage. Results contain only case IDs and aggregate metrics; generated emotional-support text is not persisted.

Primary metrics are exact cue-ID coverage, exact cue-text coverage, first-pass rate, repair rate, fallback rate, and wall-clock p50/p95 latency. The offline benchmark demonstrates fault tolerance; the live benchmark measures model behaviour and network latency.

The recorded live run on 5 August 2026 used `gpt-5.4-mini`, OpenAI SDK 7.4.0, Node.js v24.14.0, and eight synthetic cases. All eight passed on the first attempt with exact cue-ID/text coverage of 1.0; p50 latency was 1,715.66 ms and p95 was 5,094.85 ms. Generated messages were not persisted. This is a feasibility run, not a statistically powered model comparison.

`npm run benchmark:ablation` runs the main paired experiment: 30 cases × 3 repeats across deterministic v1, a raw structured model candidate, and the full validation/recovery pipeline. The raw candidate is shared between the latter two conditions to avoid selection bias and unnecessary API calls. The runner randomises order, checkpoints metrics after each run, and stores no generated text. See `docs/ABLATION-STUDY.md` and `benchmark/results/ablation-live-latest.json`.

`npm run benchmark:edge` runs the supplementary 20-case corpus through the configured live provider. It covers five balanced categories and writes `benchmark/results/edge-benchmark-live-latest.json`. Unlike the main ablation, this runner persists synthetic messages because they are the inputs to the blinded naturalness comparison. It must never be used with participant or personal data.

The recovered source archive pre-dated the final edge run, so the original per-case machine telemetry was not present. `npm run benchmark:edge:reconstruct` therefore validates the preserved blinded A/B messages against the recovered 20 requests and locked condition key, then writes `edge-benchmark-latest.json`. That file clearly labels itself as reconstructed. Aggregate method and latency values come from the submitted report; the blind materials independently identify `edge-16` as fallback but do not identify which sensitive/safety case used repair.

The decoded two-rater evidence is in `naturalness-ratings-latest.json` and `naturalness-summary.csv`. The public rating sheet contains synthetic messages only. Raw rater DOCX files are not committed; their SHA-256 hashes remain in the decoded JSON.
