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
