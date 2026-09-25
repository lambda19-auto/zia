import { appendFileSync } from 'node:fs';
// Loaded only in the integration-test child process; no external requests.
globalThis.fetch = async (url, options) => {
  if (url !== 'https://api.openai.com/v1/responses') throw new Error('Unexpected provider URL');
  appendFileSync(process.env.TEST_CAPTURE_PATH, options.body + '\n');
  return Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({
    recommendations: [{ title: 'Test destination', description: 'Test', whyFits: 'Test', estimatedCost: 'RUB 100,000', sources: [{ title: 'Source', url: 'https://example.com' }] }],
  }) }] }] });
};
