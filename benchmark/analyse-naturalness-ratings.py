#!/usr/bin/env python3
"""Decode and summarise the two blinded Word rating sheets.

The script requires pandoc for DOCX-to-plain-text extraction. It keeps missing
ratings as null, resolves A/B only through the locked condition key, and writes
machine-readable JSON, a compact CSV summary and an SVG figure.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import statistics
import subprocess
from pathlib import Path


METRICS = ("naturalness", "coherence", "concision")
CONDITIONS = ("baseline", "pipeline")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_docx(path: Path) -> str:
    return subprocess.run(
        ["pandoc", str(path), "-t", "plain"],
        check=True,
        text=True,
        capture_output=True,
    ).stdout


def parse_document(text: str) -> dict:
    cases = {}
    matches = list(re.finditer(r"^## (edge-\d{2})\b", text, re.MULTILINE))
    for index, match in enumerate(matches):
        case_id = match.group(1)
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.end() : end]
        messages = {}
        message_matches = list(re.finditer(r"\*\*Message ([AB])\*\*", block))
        for message_index, message_match in enumerate(message_matches):
            label = message_match.group(1)
            message_end = (
                message_matches[message_index + 1].start()
                if message_index + 1 < len(message_matches)
                else len(block)
            )
            message_block = block[message_match.end() : message_end]
            scores = {}
            for metric in METRICS:
                score_match = re.search(
                    rf"{metric.title()}:\s*\*{{0,2}}\s*(\d)\s*/\s*5",
                    message_block,
                )
                scores[metric] = int(score_match.group(1)) if score_match else None
            messages[label] = scores

        preference_match = re.search(
            r"Preferred first message:\*{0,2}\s*(A|B|No preference)", block
        )
        if set(messages) != {"A", "B"} or not preference_match:
            raise ValueError(f"Incomplete rating block for {case_id}")
        cases[case_id] = {
            "messages": messages,
            "preference": preference_match.group(1),
        }
    return cases


def mean(values: list[int]) -> float:
    return round(statistics.mean(values), 3)


def summarise(cases: dict, condition_key: dict) -> dict:
    scores = {
        condition: {metric: [] for metric in METRICS} for condition in CONDITIONS
    }
    paired = {metric: [] for metric in METRICS}
    preferences = {"baseline": 0, "pipeline": 0, "no_preference": 0}
    per_case = {}
    missing = []

    for case_id in sorted(condition_key):
        row = cases[case_id]
        mapping = condition_key[case_id]
        condition_scores = {}
        for label, condition in mapping.items():
            condition_scores[condition] = row["messages"][label]
            for metric in METRICS:
                value = row["messages"][label][metric]
                if value is None:
                    missing.append(
                        {
                            "caseId": case_id,
                            "message": label,
                            "condition": condition,
                            "metric": metric,
                        }
                    )
                else:
                    scores[condition][metric].append(value)

        for metric in METRICS:
            pipeline_value = condition_scores["pipeline"][metric]
            baseline_value = condition_scores["baseline"][metric]
            if pipeline_value is not None and baseline_value is not None:
                paired[metric].append(pipeline_value - baseline_value)

        selected = row["preference"]
        preference = (
            mapping[selected] if selected in ("A", "B") else "no_preference"
        )
        preferences[preference] += 1
        per_case[case_id] = {
            "preference": preference,
            "baseline": condition_scores["baseline"],
            "pipeline": condition_scores["pipeline"],
        }

    return {
        "conditionScores": {
            condition: {
                metric: {
                    "mean": mean(values),
                    "median": statistics.median(values),
                    "n": len(values),
                }
                for metric, values in by_metric.items()
            }
            for condition, by_metric in scores.items()
        },
        "pairedDifferencesPipelineMinusBaseline": {
            metric: {
                "mean": mean(values),
                "median": statistics.median(values),
                "pipelineHigher": sum(value > 0 for value in values),
                "tie": sum(value == 0 for value in values),
                "baselineHigher": sum(value < 0 for value in values),
                "n": len(values),
            }
            for metric, values in paired.items()
        },
        "preference": preferences,
        "missingRatings": missing,
        "perCase": per_case,
    }


def write_csv(path: Path, raters: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "rater",
                "metric",
                "baseline_mean",
                "baseline_n",
                "pipeline_mean",
                "pipeline_n",
                "paired_mean_difference",
                "pipeline_higher",
                "tie",
                "baseline_higher",
                "paired_n",
            ]
        )
        for index, rater in enumerate(raters, start=1):
            for metric in METRICS:
                baseline = rater["conditionScores"]["baseline"][metric]
                pipeline = rater["conditionScores"]["pipeline"][metric]
                paired = rater["pairedDifferencesPipelineMinusBaseline"][metric]
                writer.writerow(
                    [
                        index,
                        metric,
                        baseline["mean"],
                        baseline["n"],
                        pipeline["mean"],
                        pipeline["n"],
                        paired["mean"],
                        paired["pipelineHigher"],
                        paired["tie"],
                        paired["baselineHigher"],
                        paired["n"],
                    ]
                )


def write_svg(path: Path, raters: list[dict]) -> None:
    width, height = 960, 520
    baseline_colour = "#8D99AE"
    pipeline_colour = "#8B5CF6"
    panels = []
    for rater_index, rater in enumerate(raters):
        panel_x = 88 + rater_index * 440
        panel_width = 340
        bars = []
        labels = []
        for metric_index, metric in enumerate(METRICS):
            group_x = panel_x + 28 + metric_index * 108
            for condition_index, condition in enumerate(CONDITIONS):
                score = rater["conditionScores"][condition][metric]
                value = score["mean"]
                bar_height = value / 5 * 300
                x = group_x + condition_index * 34
                y = 398 - bar_height
                colour = baseline_colour if condition == "baseline" else pipeline_colour
                bars.append(
                    f'<rect x="{x}" y="{y:.1f}" width="27" height="{bar_height:.1f}" '
                    f'rx="3" fill="{colour}"/>'
                    f'<text x="{x + 13.5}" y="{y - 7:.1f}" text-anchor="middle" '
                    f'class="value">{value:.2f}</text>'
                )
                if score["n"] != 20:
                    bars.append(
                        f'<text x="{x + 13.5}" y="415" text-anchor="middle" '
                        f'class="missing">n={score["n"]}</text>'
                    )
            labels.append(
                f'<text x="{group_x + 30}" y="445" text-anchor="middle" '
                f'class="axis">{metric.title()}</text>'
            )
        grid = []
        for tick in range(6):
            y = 398 - tick * 60
            grid.append(
                f'<line x1="{panel_x}" y1="{y}" x2="{panel_x + panel_width}" y2="{y}" '
                f'class="grid"/><text x="{panel_x - 14}" y="{y + 5}" '
                f'text-anchor="end" class="axis">{tick}</text>'
            )
        panels.append(
            f'<text x="{panel_x + panel_width / 2}" y="76" text-anchor="middle" '
            f'class="panel">Rater {rater_index + 1}</text>'
            + "".join(grid + bars + labels)
        )

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <rect width="100%" height="100%" fill="white"/>
  <style>
    text {{ font-family: Arial, Helvetica, sans-serif; fill: #20242B; }}
    .title {{ font-size: 22px; font-weight: 700; }}
    .panel {{ font-size: 17px; font-weight: 700; }}
    .axis {{ font-size: 12px; }}
    .value {{ font-size: 12px; font-weight: 700; }}
    .missing {{ font-size: 10px; fill: #6B7280; }}
    .grid {{ stroke: #E5E7EB; stroke-width: 1; }}
    .legend {{ font-size: 13px; }}
  </style>
  <text x="480" y="34" text-anchor="middle" class="title">Blind human ratings by rater (mean score, 1–5)</text>
  <rect x="354" y="51" width="14" height="14" rx="2" fill="{baseline_colour}"/>
  <text x="376" y="63" class="legend">Deterministic baseline</text>
  <rect x="526" y="51" width="14" height="14" rx="2" fill="{pipeline_colour}"/>
  <text x="548" y="63" class="legend">Structured LLM pipeline</text>
  {''.join(panels)}
  <text x="480" y="492" text-anchor="middle" class="axis">Rater 1 baseline coherence and concision use n=19 because two edge-16 scores were missing.</text>
</svg>
'''
    path.write_text(svg, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("rater_1", type=Path)
    parser.add_argument("rater_2", type=Path)
    parser.add_argument("condition_key", type=Path)
    parser.add_argument("output_json", type=Path)
    parser.add_argument("output_csv", type=Path)
    parser.add_argument("output_svg", type=Path)
    args = parser.parse_args()

    key_document = json.loads(args.condition_key.read_text(encoding="utf-8"))
    condition_key = {
        row["id"]: {"A": row["A"], "B": row["B"]}
        for row in key_document["ratingKey"]
    }
    parsed = [
        parse_document(extract_docx(args.rater_1)),
        parse_document(extract_docx(args.rater_2)),
    ]
    if any(set(document) != set(condition_key) for document in parsed):
        raise ValueError("Rating sheets and condition key contain different case IDs")

    raters = [summarise(document, condition_key) for document in parsed]
    preferences = [rater["preference"] for rater in raters]
    result = {
        "analysisVersion": "1.0",
        "caseCount": len(condition_key),
        "raterCount": len(raters),
        "sources": {
            "rater1": {
                "filename": args.rater_1.name,
                "sha256": sha256(args.rater_1),
            },
            "rater2": {
                "filename": args.rater_2.name,
                "sha256": sha256(args.rater_2),
            },
            "conditionKey": {
                "filename": args.condition_key.name,
                "sha256": sha256(args.condition_key),
            },
        },
        "missingValuePolicy": "Keep missing scores as null; use available-case and paired-case denominators without imputation.",
        "raters": raters,
        "preferenceAgreement": {
            "sameDecisionCases": sum(
                raters[0]["perCase"][case_id]["preference"]
                == raters[1]["perCase"][case_id]["preference"]
                for case_id in condition_key
            ),
            "totalCases": len(condition_key),
            "bothPipeline": min(
                preferences[0]["pipeline"], preferences[1]["pipeline"]
            ),
            "bothNoPreference": min(
                preferences[0]["no_preference"],
                preferences[1]["no_preference"],
            ),
        },
        "claimBoundary": {
            "supported": [
                "Naturalness advantage within the 20 synthetic cases",
                "Concision advantage within the 20 synthetic cases",
                "First-message preference within the 20 synthetic cases",
            ],
            "notSupported": [
                "Unanimous coherence advantage",
                "Clinical effectiveness or safety",
                "Population-level or cross-model generalisation",
            ],
        },
    }

    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_csv.parent.mkdir(parents=True, exist_ok=True)
    args.output_svg.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    write_csv(args.output_csv, raters)
    write_svg(args.output_svg, raters)


if __name__ == "__main__":
    main()
