import { mkdir, readFile, writeFile } from 'node:fs/promises';

const report = JSON.parse(
  await readFile('benchmark/results/ablation-live-latest.json', 'utf8'),
);
const conditions = report.summary.conditions;
const outputPath = 'docs/figures/ablation-comparison.svg';

const rateRows = [
  ['Deterministic v1', conditions.deterministic],
  ['Model only', conditions.modelOnly],
  ['Full pipeline', conditions.fullPipeline],
];
const latencyRows = [
  ['Model only', conditions.modelOnly.latencyMs],
  ['Full pipeline', conditions.fullPipeline.latencyMs],
];

const percentBar = (label, value, y, color) => {
  const width = value * 410;
  return `  <text x="90" y="${y + 20}" class="label">${label}</text>
    <rect x="250" y="${y}" width="410" height="28" rx="5" fill="#edf1f5"/>
    <rect x="250" y="${y}" width="${width.toFixed(2)}" height="28" rx="5" fill="${color}"/>
    <text x="675" y="${y + 20}" class="value">${(value * 100).toFixed(2)}%</text>`;
};

const latencyBar = (label, value, y, color) => {
  const width = (value / 4500) * 360;
  return `  <text x="760" y="${y + 20}" class="label">${label}</text>
    <rect x="880" y="${y}" width="360" height="28" rx="5" fill="#edf1f5"/>
    <rect x="880" y="${y}" width="${width.toFixed(2)}" height="28" rx="5" fill="${color}"/>
    <text x="1250" y="${y + 20}" class="value">${value.toFixed(2)} ms</text>`;
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="760" viewBox="0 0 1400 760" role="img" aria-labelledby="title desc">
  <title id="title">Cue-to-Prompt ablation results</title>
  <desc id="desc">Acceptance and cue-text coverage for three conditions, plus model-only and full-pipeline latency.</desc>
  <style>
    .title { font: 700 30px Inter, Arial, sans-serif; fill: #263238; }
    .subtitle { font: 400 16px Inter, Arial, sans-serif; fill: #607080; }
    .panel { font: 700 20px Inter, Arial, sans-serif; fill: #263238; }
    .label { font: 500 15px Inter, Arial, sans-serif; fill: #35424d; }
    .value { font: 600 14px Inter, Arial, sans-serif; fill: #263238; }
    .legend { font: 500 14px Inter, Arial, sans-serif; fill: #4f5d68; }
    .note { font: 400 14px Inter, Arial, sans-serif; fill: #687783; }
  </style>
  <rect width="1400" height="760" fill="#ffffff"/>
  <text x="70" y="60" class="title">Cue-to-Prompt: correctness gained, bounded latency cost</text>
  <text x="70" y="90" class="subtitle">30 synthetic cases × 3 repeats; paired first model candidates; n = 90 runs</text>

  <rect x="55" y="125" width="650" height="520" rx="16" fill="#fafbfc" stroke="#dfe5ea"/>
  <text x="85" y="165" class="panel">Acceptance and exact cue-text coverage</text>
  <rect x="87" y="190" width="14" height="14" rx="3" fill="#4776b4"/>
  <text x="108" y="202" class="legend">Accepted outputs</text>
  <rect x="240" y="190" width="14" height="14" rx="3" fill="#56a675"/>
  <text x="261" y="202" class="legend">Exact cue-text coverage</text>
  ${percentBar(rateRows[0][0], rateRows[0][1].acceptanceRate, 235, '#4776b4')}
  ${percentBar(rateRows[0][0], rateRows[0][1].meanCueTextCoverage, 271, '#56a675')}
  ${percentBar(rateRows[1][0], rateRows[1][1].acceptanceRate, 340, '#4776b4')}
  ${percentBar(rateRows[1][0], rateRows[1][1].meanCueTextCoverage, 376, '#56a675')}
  ${percentBar(rateRows[2][0], rateRows[2][1].acceptanceRate, 445, '#4776b4')}
  ${percentBar(rateRows[2][0], rateRows[2][1].meanCueTextCoverage, 481, '#56a675')}
  <text x="85" y="570" class="note">Model only: 80/90 accepted. Full pipeline: 80 first pass,</text>
  <text x="85" y="594" class="note">8 repaired, 2 deterministic fallbacks; all 90 accepted.</text>

  <rect x="730" y="125" width="620" height="520" rx="16" fill="#fafbfc" stroke="#dfe5ea"/>
  <text x="760" y="165" class="panel">Wall-clock latency</text>
  <rect x="762" y="190" width="14" height="14" rx="3" fill="#d68b42"/>
  <text x="783" y="202" class="legend">p50</text>
  <rect x="842" y="190" width="14" height="14" rx="3" fill="#a95c68"/>
  <text x="863" y="202" class="legend">p95</text>
  ${latencyBar(latencyRows[0][0], latencyRows[0][1].p50, 250, '#d68b42')}
  ${latencyBar(latencyRows[0][0], latencyRows[0][1].p95, 286, '#a95c68')}
  ${latencyBar(latencyRows[1][0], latencyRows[1][1].p50, 380, '#d68b42')}
  ${latencyBar(latencyRows[1][0], latencyRows[1][1].p95, 416, '#a95c68')}
  <text x="760" y="510" class="note">Median overhead: 6.42 ms</text>
  <text x="760" y="534" class="note">p95 overhead: 562.85 ms</text>
  <text x="760" y="558" class="note">Deterministic v1 p50: 0.032 ms (not plotted to scale)</text>

  <text x="70" y="700" class="note">Source: benchmark/results/ablation-live-latest.json · Generated text was not persisted · Descriptive synthetic evaluation</text>
</svg>`;

await mkdir('docs/figures', { recursive: true });
await writeFile(outputPath, svg, 'utf8');
console.info(`Saved ${outputPath}`);
