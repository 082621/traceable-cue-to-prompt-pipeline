# Traceable Cue-to-Prompt Pipeline

This repository extends the original University of Leeds COMP3931 Cue-to-Prompt interaction prototype into an identifiable, testable software system. The six-screen interface is retained, but the final text is now produced through a bounded fault-tolerant pipeline:

```text
UI selections → schema validation → cue planner → structured model output
              → coverage/safety validator → one repair attempt → deterministic fallback
```

The original deterministic generator is still present as both the study baseline and the guaranteed fallback. This separation allows the original HCI result to remain interpretable while adding technical research questions about traceability, output correctness, failure recovery, latency, and model availability.

This is a research prototype, not a clinical or crisis-support system.

## What is technically new

- A versioned Zod input contract rejects malformed or catalogue-tampered selections before an API call.
- A planner converts selections and participant-authored text into stable cue IDs and an immutable prompt plan.
- The server uses the OpenAI Responses API with Structured Outputs; the API key never enters the browser bundle.
- The model must return its cue/support/style trace alongside the draft.
- An independent validator checks exact ID coverage, exact source-text preservation, support/style constraints, optional-text preservation, and limited fabrication flags.
- One bounded repair attempt receives the validation report. Persistent invalid output or provider failure activates a separately validated deterministic fallback.
- Logs contain request IDs, method, fallback class, and latency—not emotional-support text.
- Unit, orchestration, and HTTP tests run without network access or API cost.
- Offline fault injection and the main ablation write metric-only results; the separate edge study retains synthetic messages for blinded rating.

The implementation follows OpenAI's official [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) and defaults to the current lower-latency `gpt-5.4-mini` alias. Pin a dated snapshot with `OPENAI_MODEL` when model-version reproducibility matters and the API organization has access.

## Quick start

Requirements: Node.js 20 or later.

```bash
npm ci
cp .env.example .env.local
# Add OPENAI_API_KEY to .env.local if live generation is required.
npm run dev
```

Open `http://localhost:5173`. The Vite server proxies `/api` to the local API on `http://localhost:8787`.

If no key, credit, model permission, or network is available, the interface still returns the validated deterministic draft. `.env.local` is git-ignored and must never be submitted or committed.

## Verification commands

```bash
npm run lint             # static checks
npm test                 # offline unit/integration/API tests
npm run test:coverage    # coverage report
npm run build            # production client build
npm run benchmark        # synthetic offline fault injection
npm run benchmark:live   # optional; uses API credits, never persists message text
npm run benchmark:ablation # 30 cases × 3 paired live repeats with checkpointing
npm run benchmark:edge   # optional live 20-case edge run; persists synthetic messages
npm run benchmark:edge:reconstruct # validate preserved edge/rating evidence
```

The offline suite contains 31 tests across nine files and a 30-case injected-fault benchmark. The main paired ablation contains 90 runs: raw Structured Outputs passed 80/90, while validation plus bounded repair/fallback returned 90/90 accepted outputs. Exact cue-text coverage rose from 98.67% to 100%; eight failures were repaired and two used deterministic fallback.

The supplementary edge evidence was reconstructed from preserved synthetic messages, recovered requests, a locked condition key, and aggregate values in the submitted report because the original per-case machine telemetry was absent. Across 20 cases, the record contains 18 first-pass model outputs, one repaired output, and one validated fallback; both the baseline and final pipeline preserved all cues and support needs in 20/20 cases. Two blinded Chinese-reading raters each preferred the pipeline in 19/20 comparisons and selected no preference for the identical fallback pair. See [`docs/RESULTS.md`](docs/RESULTS.md), [`docs/ABLATION-STUDY.md`](docs/ABLATION-STUDY.md), and `benchmark/results/`.

## Repository structure

```text
traceable-cue-to-prompt-pipeline/
├── src/
│   ├── App.jsx                     retained React interaction flow
│   └── services/promptApi.js       browser-to-server boundary
├── shared/
│   ├── catalogue.js               single source of cue definitions
│   ├── contracts.js               versioned input/output schemas
│   ├── promptPlanner.js            stable ID and prompt-plan construction
│   ├── outputValidator.js          independent correctness checks
│   └── deterministicGenerator.js   study baseline and safe fallback
├── server/
│   ├── openaiGenerator.js          Structured Outputs adapter
│   ├── orchestrator.js             retry/repair/fallback state machine
│   ├── app.js                      testable Express API
│   └── index.js                    environment and process entry point
├── tests/                          offline automated tests
├── benchmark/                      synthetic cases and runners
└── docs/                           architecture and evaluation guidance
```

## API contract

`POST /api/v1/prompts/generate` accepts three selected concerns, their situation/emotion/impact cues, one or two support needs, one response style, and optional text. The response contains:

- `message`: the accepted model draft or deterministic fallback;
- `trace`: cue, support, and style IDs claimed by the generator;
- `validation`: exact coverage and invariant results;
- `metadata`: request ID, plan digest, generation method, attempt count, fallback reason, model, and latency.

`GET /api/health` reports configuration state and model name, but never returns credentials.

## Privacy and limitations

Input is held in memory for request processing and is not written by this code. Live mode sends the prompt plan to the configured OpenAI API, so a study protocol must disclose third-party processing and use approved data-handling settings. Benchmark cases are synthetic. The small safety-pattern layer is an experimental fabrication guard, not a comprehensive safety classifier.

For thesis claims, distinguish clearly between: (1) the original N=23 interface study, (2) offline component/fault-injection evidence, (3) the 30-case/90-run synthetic ablation, and (4) the 20-case/two-rater supplementary comparison. These support bounded claims for the evaluated artefacts and synthetic cases, not general model reliability, population language preference, clinical safety, or effectiveness with participants.

## Academic context

This repository accompanies *Design and Evaluation of a Fault-Tolerant and Traceable Cue-to-Prompt Generation Pipeline* (University of Leeds, COMP3931, 2025/26). The earlier N=23 interface study used the deterministic browser prototype; it did not expose participants to the revised live LLM pipeline.

This clean reproducibility repository was assembled on 12 August 2026 from the original prototype and the evaluated v2 artefact. Its commits group implementation components into auditable stages; they do not claim to reproduce the original chronological development history.
