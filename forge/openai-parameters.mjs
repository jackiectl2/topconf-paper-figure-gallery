// Normalize OpenAI reasoning-family Chat Completions at every request boundary.
// Relays exposing the same model IDs need the same payload, including default effort.
export function normalizeOpenAIChat(body) {
  if (!body || typeof body !== 'object' || body.input) return body;
  const model = String(body.model || '');
  if (!/^(?:gpt-(?:5|6)(?:[.\-]|$)|o[1-9](?:[.\-]|$))/i.test(model)) return body;
  const result = {...body};
  if (result.max_tokens !== undefined) {
    if (result.max_completion_tokens === undefined) result.max_completion_tokens = result.max_tokens;
    delete result.max_tokens;
  }
  delete result.temperature;
  delete result.top_p;
  return result;
}
