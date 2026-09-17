import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { createModelFetch, networkErrorCode } from '../src/model-transport.mjs';
import { DeepSeek } from '../src/deepseek.mjs';

async function endpoint(t) {
  const hits = [],
    tunnels = [],
    sockets = new Set();
  const target = http.createServer((req, res) => {
    hits.push(req.url);
    if (req.url === '/hang') return;
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: '/must-not-follow' });
      return res.end();
    }
    res.end(JSON.stringify({ connected: true }));
  });
  await new Promise((resolve) => target.listen(0, '127.0.0.1', resolve));
  const port = target.address().port;
  const proxy = http.createServer();
  proxy.on('connect', (req, socket, head) => {
    tunnels.push(req.url);
    const upstream = net.connect(port, '127.0.0.1', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    for (const stream of [socket, upstream]) {
      sockets.add(stream);
      stream.on('error', () => {
        socket.destroy();
        upstream.destroy();
      });
      stream.on('close', () => sockets.delete(stream));
    }
  });
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    target.closeAllConnections();
    await Promise.all(
      [target, proxy].map((server) => new Promise((resolve) => server.close(resolve))),
    );
  });
  return { hits, tunnels, port, proxy: `http://127.0.0.1:${proxy.address().port}` };
}

test('model fetch reaches a target through the configured proxy without changing global fetch', async (t) => {
  const fixture = await endpoint(t);
  const modelFetch = createModelFetch({
    httpProxy: fixture.proxy,
    httpsProxy: fixture.proxy,
    noProxy: '',
  });
  const globalFetch = globalThis.fetch;
  try {
    const response = await modelFetch(`http://model-fixture.invalid:${fixture.port}/models`);
    assert.deepEqual(await response.json(), { connected: true });
    assert.equal(fixture.tunnels[0], `model-fixture.invalid:${fixture.port}`);
    assert.deepEqual(fixture.hits, ['/models']);
    assert.equal(globalThis.fetch, globalFetch);
  } finally {
    await modelFetch.close();
  }
});

test('NO_PROXY bypasses the proxy for a matching local host', async (t) => {
  const fixture = await endpoint(t);
  const modelFetch = createModelFetch({
    httpProxy: fixture.proxy,
    httpsProxy: fixture.proxy,
    noProxy: '127.0.0.1',
  });
  try {
    const response = await modelFetch(`http://127.0.0.1:${fixture.port}/models`);
    await response.text();
    assert.equal(response.status, 200);
    assert.deepEqual(fixture.tunnels, []);
  } finally {
    await modelFetch.close();
  }
});

test('model fetch remains direct when no proxy is configured', async (t) => {
  const fixture = await endpoint(t);
  const modelFetch = createModelFetch({ httpProxy: '', httpsProxy: '', noProxy: '' });
  try {
    const response = await modelFetch(`http://127.0.0.1:${fixture.port}/models`);
    await response.text();
    assert.equal(response.status, 200);
    assert.deepEqual(fixture.tunnels, []);
  } finally {
    await modelFetch.close();
  }
});

test('proxied requests retain abort deadlines and do not follow redirects', async (t) => {
  const fixture = await endpoint(t);
  const modelFetch = createModelFetch({ httpProxy: fixture.proxy, noProxy: '' });
  try {
    await assert.rejects(
      modelFetch(`http://model-fixture.invalid:${fixture.port}/hang`, {
        signal: AbortSignal.timeout(150),
      }),
      { name: 'TimeoutError' },
    );
    await assert.rejects(
      modelFetch(`http://model-fixture.invalid:${fixture.port}/redirect`, {
        redirect: 'error',
        signal: AbortSignal.timeout(2000),
      }),
    );
    assert.ok(!fixture.hits.includes('/must-not-follow'));
  } finally {
    await modelFetch.close();
  }
});

test('network diagnostics retain only approved codes and never exception messages', async () => {
  const secret = 'fixture-secret-do-not-log';
  assert.equal(networkErrorCode({ cause: { code: secret } }), null);
  assert.equal(networkErrorCode({ message: secret }), null);
  const events = [];
  const provider = new DeepSeek({
    key: secret,
    fetchImpl: async () => {
      throw Object.assign(new Error(secret), {
        cause: { code: 'UND_ERR_CONNECT_TIMEOUT', message: secret },
      });
    },
  });
  await assert.rejects(provider.json('fixture', {}, { onTrace: (event) => events.push(event) }), {
    code: 'DEEPSEEK_CONNECTION_FAILED',
  });
  assert.equal(events.at(-1).network_error_code, 'UND_ERR_CONNECT_TIMEOUT');
  assert.ok(!JSON.stringify(events).includes(secret));
  await provider.close();
});
