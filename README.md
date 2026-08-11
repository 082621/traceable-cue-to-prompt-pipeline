# Cue-to-Prompt

A high-fidelity research prototype developed for the BSc dissertation
**"Design and Evaluation of a Structured Cue-to-Prompt Interface for
Reducing Perceived Explanation Burden During First-Message Preparation
in a Hypothetical Emotional-Support Scenario"**
(University of Leeds, COMP3931, 2025/26).

## Overview

This prototype supports a within-subject A/B evaluation (N = 23)
comparing a blank text-input baseline (Condition A) against a
structured six-screen Cue-to-Prompt interface (Condition B). The
interface scaffolds emotional expression through concern selection,
cue-based information collection, and template-driven prompt synthesis.

The prototype is deliberately minimal and self-contained:

- **No backend.** Runs entirely in the browser.
- **No LLM integration.** Isolates the effect of interaction design
  from downstream model variance.
- **No persistence.** No participant input is stored or transmitted.
- **Deterministic output.** Identical selections produce byte-identical
  prompts.

See Figure 3 (§5.3) and Appendix E of the dissertation for the
rationale behind these methodological commitments.

## Tech stack

- React 19.2 with Hooks
- Vite 8.0 (dev server + bundler)
- Tailwind CSS utility classes (loaded at runtime via
  `@tailwindcss/browser` CDN; see Appendix E.1)
- `lucide-react` icon set

## Getting started

```bash
npm install
npm run dev        # development server (localhost:5173)
npm run build      # production build (outputs to dist/)
npm run preview    # preview the built output
npm run lint       # ESLint check
```

## Repository structure

```
cue-to-prompt/
├── index.html               HTML entry point
├── vite.config.js           Vite configuration
├── eslint.config.js         ESLint rules
├── package.json             Dependencies and scripts
├── public/
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── main.jsx             React root mount
    ├── App.jsx              Main component (see Appendix E of thesis)
    ├── App.css              Component-specific styles
    ├── index.css            Global base styles
    └── assets/
        └── hero.png
```

## The cue corpus

The five concern categories (academic pressure, future uncertainty,
family expectations, social relationships/loneliness, cultural
adaptation) and their associated cue sets were derived from prior
literature on stressors among Chinese international students in
English-speaking contexts. The complete corpus is encoded as a static
JavaScript constant (`CONCERNS_CONFIG` in `src/App.jsx`, lines 17–53).
It is not loaded from an external source, guaranteeing reproducibility
across participants.

## Interaction flow

The interface walks participants through six screen types. The
cue-collection stage is repeated once for each of the three selected
concerns. Full screen-by-screen descriptions are in Appendix D of the
dissertation.

| Step | Screen type                           | State updated                      |
|------|---------------------------------------|------------------------------------|
| 1    | Scenario entry                        | —                                  |
| 2    | Concern selection (3 of 5)            | `selectedConcerns`                 |
| 3    | Cue collection (repeated × 3)         | `concernData[concernId]`           |
| 4    | Support need                          | `supportNeeds`, `responseStyle`    |
| 5    | Optional free text                    | `optionalText`                     |
| 6    | Structured summary + generated prompt | —                                  |

## License and access

This repository is made available for academic marking and
reproducibility purposes. It is not intended for clinical deployment.

## Author

Rui Gu · BSc Computer Science with Artificial Intelligence ·
University of Leeds · 2025/26
