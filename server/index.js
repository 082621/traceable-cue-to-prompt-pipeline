import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

const [{ createApp }, { createOpenAIGenerator }] = await Promise.all([
  import('./app.js'),
  import('./openaiGenerator.js'),
]);

const port = Number.parseInt(process.env.PORT || '8787', 10);
const generator = createOpenAIGenerator();
const app = createApp({ generator });

app.listen(port, () => {
  console.info(`Cue-to-Prompt API listening on http://localhost:${port}`);
  console.info(`Structured generator: ${generator.configured ? generator.model : 'not configured; deterministic fallback active'}`);
});
