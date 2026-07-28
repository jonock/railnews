import assert from 'node:assert/strict';
import test from 'node:test';

import { config } from '../src/config.js';
import { createBriefingText, LlmRequestError } from '../src/llm.js';

const articles = [{
  id: 1,
  title: 'Neue Nachtzugverbindung',
  url: 'https://example.com/nachtzug',
  source_name: 'Testquelle',
  matched_topics: '["Nachtzug"]'
}];

async function withOpenAi({ apiKey = 'test-key', fetch }, callback) {
  const previousApiKey = config.openai.apiKey;
  const previousFetch = globalThis.fetch;
  config.openai.apiKey = apiKey;
  globalThis.fetch = fetch;
  try {
    await callback();
  } finally {
    config.openai.apiKey = previousApiKey;
    globalThis.fetch = previousFetch;
  }
}

test('uses the extractive fallback only when OpenAI is not configured', async () => {
  await withOpenAi({ apiKey: '', fetch: () => assert.fail('fetch must not be called') }, async () => {
    const text = await createBriefingText(articles);
    assert.match(text, /Automatisch erzeugtes deutschsprachiges Kurzbriefing/);
  });
});

test('returns briefing text from OpenAI', async () => {
  await withOpenAi({
    fetch: async () => new Response(JSON.stringify({
      choices: [{ message: { content: '## Nachtzüge\nEine neue Verbindung.' } }]
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }, async () => {
    assert.equal(await createBriefingText(articles), '## Nachtzüge\nEine neue Verbindung.');
  });
});

test('surfaces an OpenAI API error instead of silently saving a fallback', async () => {
  await withOpenAi({
    fetch: async () => new Response('{"error":{"message":"invalid key"}}', { status: 401 })
  }, async () => {
    await assert.rejects(
      createBriefingText(articles),
      (error) => error instanceof LlmRequestError
        && /HTTP 401/.test(error.message)
        && /invalid key/.test(error.message)
    );
  });
});

for (const status of [200, 500]) {
  test(`classifies a stalled HTTP ${status} response body as a timeout`, async () => {
    await withOpenAi({
      fetch: async () => ({
        ok: status === 200,
        status,
        text: async () => {
          throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        }
      })
    }, async () => {
      await assert.rejects(
        createBriefingText(articles),
        (error) => error instanceof LlmRequestError
          && /Zeitüberschreitung/.test(error.message)
          && !/gültiges JSON/.test(error.message)
      );
    });
  });
}
