import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { assertRpcEndpointReachable } from '../blockchain/rpc-preflight';

function listen(server: net.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function close(server: net.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

test('fails fast with clear message when RPC endpoint is unavailable at startup', async () => {
  const server = net.createServer();
  await listen(server);

  const address = server.address();
  assert(address && typeof address !== 'string', 'expected tcp server address');
  const rpcUrl = `http://127.0.0.1:${address.port}`;

  await close(server);

  await assert.rejects(
    () => assertRpcEndpointReachable(rpcUrl, 300),
    /RPC endpoint is not reachable at startup/,
  );
});
