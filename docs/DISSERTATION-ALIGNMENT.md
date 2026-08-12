# Dissertation v2.3.0 alignment note

## Version identity

The final dissertation v2.3.0 describes the evaluated software release `v2.0.0`, archived at commit `57d77530fe401dc0e689a11e04a290c0e4c3b963`. The dissertation version number identifies the report revision; it does not rename the evaluated software or change its recorded results. The `v2.0.0` tag and release should remain immutable for reproducibility.

This note records terminology and evidence boundaries clarified during the final report audit. No new experiment is claimed here, and the clarifications do not require a change to the evaluated generation, validation, recovery, or benchmark logic.

## Paper-to-code contract mapping

| Dissertation term | Executable representation | Scope |
|---|---|---|
| cue-state contract | `CueRequestSchema` in `shared/contracts.js` | Public request schema |
| semantic plan | `buildPromptPlan()` in `shared/promptPlanner.js` | Internal canonical representation; contains `schemaVersion` |
| candidate output | `ModelOutputSchema` in `shared/contracts.js` | Model message plus cue, support, and response-style IDs |
| accepted response | `GenerationResponseSchema` in `shared/contracts.js` | Public response envelope; does not include `schemaVersion` |
| independent validator | `validateModelOutput()` in `shared/outputValidator.js` | Checks candidate against the canonical plan |
| bounded recovery | `createGenerationOrchestrator()` in `server/orchestrator.js` | First attempt, at most one repair, then deterministic fallback |

The public generation methods are exactly `model`, `model-repair`, and `deterministic-fallback`.

## Traceability boundary

The returned `trace` links an accepted message to the cue, support-need, and response-style IDs claimed by the generator. The independent validator compares those IDs and the required source strings with the canonical plan before acceptance. This is message-level provenance.

The implementation does not store a sentence-to-source alignment, does not prove which individual sentence arose from which cue, and does not expose hidden model reasoning. Conceptual fragment-to-source examples in the dissertation illustrate intended correspondence; they are not runtime sentence-level evidence.

## Validation-field mapping

The public `validation` object contains:

- `accepted`;
- cue-ID and cue-text coverage;
- missing and unknown cue IDs;
- missing cue-text IDs;
- missing and unknown support-need IDs;
- `styleMatched`;
- `optionalTextPreserved`; and
- `safetyFlags`.

Support text is checked internally through the local `supportTextPreserved` variable. When required support text is absent, acceptance fails and `support-text-missing` is appended to `safetyFlags`. `supportTextPreserved` itself is not part of the public response schema. The public field is `styleMatched`, not `toneMatched`.

## Evidence boundary

The repository keeps four evidence sources separate:

1. the original `N=23` interface study, which used the deterministic browser prototype and did not expose participants to the live LLM pipeline;
2. offline automated tests and 30-case fault injection;
3. the 30-case, 90-run paired live ablation; and
4. the 20-case synthetic edge comparison rated by two Chinese-reading raters.

The edge evidence is a reconstruction from preserved synthetic requests, blinded A/B messages, a locked condition key, and aggregate values reported in the dissertation. Its trace IDs are reconstructed from the canonical recovered plan. The original per-case machine telemetry was not available, so the record does not claim original sentence-level provenance.

For the blind comparison, both raters completed all preference decisions. One rater omitted the baseline coherence and concision scores for the identical `edge-16` fallback pair. The corresponding summaries therefore use available-case denominators (`n=19`) without imputation. Coherence is reported separately by rater.

These results support bounded software-engineering and descriptive language-quality claims for the recorded synthetic cases. They do not establish clinical effectiveness, deployment readiness, population language preference, or universal model reliability.

## Reproducibility commands

The canonical package commands are:

```bash
npm ci
npm test
npm run test:coverage
npm run lint
npm run build
npm run benchmark
npm run benchmark:live
npm run benchmark:ablation
npm run benchmark:edge
npm run benchmark:edge:reconstruct
```

The benchmark package scripts map to these entry points:

```bash
node benchmark/runBenchmark.js
node benchmark/runBenchmark.js --live
node benchmark/runAblation.js
node benchmark/runEdgeBenchmark.js
node benchmark/reconstructEdgeEvidence.js
```

Live commands require an approved server-side provider credential and may incur API usage. Offline tests, coverage, lint, build, fault injection, and edge-evidence reconstruction do not require a provider credential.
