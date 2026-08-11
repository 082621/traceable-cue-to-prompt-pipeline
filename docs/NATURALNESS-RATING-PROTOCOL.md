# Blinded paired naturalness-rating protocol

This supplementary evaluation compares the old deterministic template with the accepted output of the structured LLM pipeline.

**Completion status:** Two Chinese-reading raters completed all 20 paired preference decisions. One sheet omitted coherence and concision for edge-16 Message B; those values are retained as missing and are not imputed. The decoded results are stored in `benchmark/results/naturalness-ratings-latest.json` and `benchmark/results/naturalness-summary.csv`.

## Sampling and blinding

- Use all 20 synthetic edge cases.
- Export the two messages for each case as randomly ordered `A` and `B`; hide condition, model, latency and validation metadata from raters.
- Ask at least two raters who can read Chinese to score independently. Do not use participant-authored or study data.
- Resolve the randomisation key only after the rating sheet is locked.

## Per-message ratings

Use a five-point scale for each construct:

1. **Naturalness:** sounds like a person opening a support conversation rather than a concatenated form.
2. **Coherence:** situation, emotions, impacts and requested support form a readable whole.
3. **Concision:** communicates the selected content without avoidable repetition.

Also ask a forced-choice item: `Which message would you rather send as the first message? A / B / No preference`.

## Claim boundary

Report medians and paired differences by case, rater agreement, and condition preference counts. Keep exact-cue coverage and support-need preservation as separate automated measures. A naturalness result cannot establish therapeutic quality, safety or clinical effectiveness.

Because the two raters interpreted coherence differently, report coherence by rater and do not claim a unanimous coherence advantage. Naturalness, concision and first-message preference may be described only within the 20 synthetic cases and two-rater boundary.
