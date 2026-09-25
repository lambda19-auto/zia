import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { test } from 'node:test';

async function freePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  socket.close();
  await once(socket, 'close');
  return port;
}

test('production server serves the frontend and handles API errors', async () => {
  const port = await freePort();
  const server = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(port), OPENAI_API_KEY: '' },
    stdio: 'ignore',
  });

  try {
    const base = `http://127.0.0.1:${port}`;
    let health;
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        health = await fetch(`${base}/api/health`);
        break;
      } catch {
        if (server.exitCode !== null) throw new Error('Server exited during startup');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    assert.equal(health?.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });

    const homepage = await fetch(base);
    assert.equal(homepage.status, 200);
    assert.match(await homepage.text(), /<div id="root"><\/div>/);
    assert.equal((await fetch(`${base}/api/unknown`)).status, 404);
    assert.equal((await fetch(`${base}/missing.js`)).status, 404);

    const invalid = await fetch(`${base}/api/recommendations`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 123 }),
    });
    assert.equal(invalid.status, 400);

    const noKey = await fetch(`${base}/api/recommendations`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'mountains' }),
    });
    assert.equal(noKey.status, 503);
    assert.deepEqual(await noKey.json(), { error: 'Service is not configured.' });
  } finally {
    server.kill();
  }
});

test('API selects English and Russian agent instructions and validates language', async () => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'zia-language-'));
  const capture = join(directory, 'requests.jsonl');
  const port = await freePort();
  const server = spawn(process.execPath, ['--import', './test/fixtures/mock-openai.js', 'server.js'], {
    env: { ...process.env, PORT: String(port), OPENAI_API_KEY: 'test-key', TEST_CAPTURE_PATH: capture },
    stdio: 'ignore',
  });
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 50; attempt++) {
      try { await fetch(`${base}/api/health`); break; }
      catch {
        if (server.exitCode !== null) throw new Error('Server exited during startup');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    const post = body => fetch(`${base}/api/recommendations`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    for (const language of ['en', 'ru', undefined]) {
      const response = await post({ query: 'mountains', language, budget: 'low', season: 'winter', travelers: 3, hasChildren: true });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).recommendations[0].title, 'Test destination');
    }
    for (const language of ['de', '', null, 1, ['en']]) {
      assert.equal((await post({ query: 'mountains', language })).status, 400);
    }
    const payloads = (await readFile(capture, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(payloads.length, 3, 'invalid languages must never call the provider');
    const [english, russian, defaultLanguage] = payloads;
    assert.doesNotMatch(JSON.stringify(english), /[А-Яа-яЁё]/);
    assert.match(english.instructions, /every human-readable value in English/);
    assert.match(english.input, /Number of travelers: 3/);
    assert.match(english.input, /Including children: Yes/);
    assert.match(english.input, /under RUB 100,000/);
    assert.match(english.input, /Season: winter/);
    assert.equal(english.text.format.schema.properties.recommendations.items.properties.title.description, 'Destination name');
    assert.match(russian.instructions, /на русском языке/);
    assert.match(russian.input, /Количество человек: 3/);
    assert.deepEqual(defaultLanguage, russian);
  } finally {
    server.kill();
    await once(server, 'exit');
    await rm(directory, { recursive: true, force: true });
  }
});
