# Paired ablation study protocol

## Objective

The experiment isolates what each architectural layer contributes to correctness, availability, latency, and repeatability. It is a technical system evaluation, not a participant study.

## Conditions

1. **Deterministic v1:** the original rule-based template generator. It provides a reproducible correctness and latency reference.
2. **Structured model without independent recovery:** one `gpt-5.4-mini` Structured Outputs candidate, measured by the validator but returned without repair or fallback. This tests whether schema-constrained generation alone satisfies semantic invariants.
3. **Full pipeline:** the exact same first model candidate is checked by the independent validator. A rejected output receives at most one repair call; persistent failure activates the deterministic fallback.

The model-only and full-pipeline conditions are paired: they share the same first candidate. The implementation never generates a second, potentially easier first attempt for the full condition.

## Corpus and repetition

The corpus contains all ten combinations of three concern categories. Each combination has three deterministic variants that rotate catalogue cues, emotions, impacts, response style, one/two support needs, optional text, and synthetic custom text. This produces 30 cases with no participant data.

Every case is executed three times. The 90 tasks are shuffled by a seeded linear-congruential generator (`20260805`) to reduce simple ordering effects. A metrics-only checkpoint is atomically written after every completed task and supports restart with an identical configuration.

## Outcomes

Primary outcomes are acceptance, exact cue-ID coverage, exact cue-text coverage, unknown-ID count, repair rate, fallback rate, and p50/p95 wall-clock latency. Secondary outcomes are message length and within-case hash consistency across repeats.

The acceptance rule is fixed before evaluation: 100% required cue IDs and literal source text, exact support/style trace, optional-text preservation, no unknown IDs, and no configured fabricated safety phrase. The same validator is applied to all three conditions.

## Privacy and reproducibility

Only case ID, experimental factors, aggregate validation fields, message length, 16-hex-character SHA-256 prefix, latency, method, and error class are persisted. Generated emotional-support messages and the API key are never written to results. The result records model alias, SDK/Node versions, schema version, seed, and settings.

Run with:

```bash
npm run benchmark:ablation
# Optional overrides:
npm run benchmark:ablation -- --repeats 5 --seed 20260805 --limit 30
```

The default is 30 cases × 3 repeats. A different checkpoint configuration uses a distinct filename, preventing accidental cross-experiment resume.

## Threats to validity

- Cases are synthetic and may be easier or more regular than participant-authored content.
- Repeats are clustered within cases and should not be treated as 90 independent participant observations.
- The model alias can move over time; a dated snapshot is preferable when organization access permits.
- Exact literal preservation is deliberately strict and may reject semantically equivalent paraphrases.
- Hashes establish byte-level difference, not comparative fluency or quality.
- Because generated text was not retained, qualitative claims require a separate, ethically approved protocol.
