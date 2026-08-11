export async function requestGeneratedPrompt(request, { signal } = {}) {
  const response = await fetch('/api/v1/prompts/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message || `Generation failed with status ${response.status}`);
  }
  return body.data;
}
