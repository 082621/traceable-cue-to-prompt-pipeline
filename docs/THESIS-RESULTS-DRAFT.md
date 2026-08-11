# Dissertation-ready technical evaluation draft

## Evaluation design

To isolate the contribution of the proposed validation and recovery architecture, a paired three-condition ablation was conducted. The conditions were: (C1) the deterministic v1 template generator; (C2) a single schema-constrained model output without independent recovery; and (C3) the complete pipeline comprising semantic validation, one bounded repair attempt, and deterministic fallback. The corpus contained all ten combinations of three concern categories, with three deterministic variants per combination. Each of the 30 cases was executed three times in seeded random order, producing 90 paired runs. C2 and C3 shared the same initial model candidate, preventing the full pipeline from benefiting from a different first generation.

## Correctness and recovery

The deterministic baseline satisfied all invariants in 90/90 runs. The model-only condition was accepted in 80/90 runs (88.89%), despite all 90 outputs conforming to the structured schema and claiming 100% of required cue IDs. Mean exact cue-text coverage was 98.67%; seven runs omitted at least one required source phrase, one contained a configured safety flag, and three failed another required constraint without an ID or cue-text omission. This demonstrates that syntactic schema compliance did not guarantee semantic faithfulness.

The complete pipeline accepted 90/90 outputs with 100% exact cue-ID and cue-text coverage and no residual unknown IDs or safety flags. Eight of the ten rejected initial candidates were corrected by the single repair attempt; the remaining two activated the deterministic fallback. Thus, bounded recovery eliminated all invalid returns observed in the experiment while adding ten provider calls to the 90 initial calls.

## Performance and repeatability

Median latency was 1,844.05 ms for model-only generation and 1,850.47 ms for the full pipeline, an increase of 6.42 ms because first-pass validation was local. At p95, latency rose from 3,552.17 ms to 4,115.01 ms, reflecting the additional model call required by repair. Mean full-pipeline latency was 273.37 ms higher than model-only latency. The deterministic baseline had a median latency of 0.032 ms and produced byte-identical output across all three repetitions for every case. Neither model-backed condition produced an identical hash across all repetitions for any of the 30 cases, indicating wording variability despite invariant preservation.

## Interpretation and limitations

The results support the technical claim that independent semantic validation and bounded recovery improve output correctness relative to schema-constrained generation alone for the evaluated synthetic cases. They do not show that model-backed drafts are more useful than deterministic drafts, nor do they establish clinical effectiveness or population-level reliability. The repeated observations are clustered within 30 synthetic cases, the model was accessed through a moving alias, and generated text was not retained for qualitative fluency assessment. Accordingly, the findings are reported descriptively and separately from the original participant study.
