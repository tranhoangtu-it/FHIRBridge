import * as net from 'net';

// Ports for Docker test containers (started by test-setup.sh --test)
const CONTAINERS = [
  { name: 'Postgres (test)', host: 'localhost', port: 5433 },
  { name: 'Redis (test)', host: 'localhost', port: 6380 },
] as const;

const TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;

/**
 * Attempt a TCP connection to verify a service is listening.
 * Returns true on success, false on ECONNREFUSED.
 */
function tcpProbe(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onError = () => {
      socket.destroy();
      resolve(false);
    };
    socket.setTimeout(1000);
    socket.once('error', onError);
    socket.once('timeout', onError);
    socket.connect(port, host, () => {
      socket.destroy();
      resolve(true);
    });
  });
}

/**
 * Wait for a service to become reachable via TCP within TIMEOUT_MS.
 */
async function waitForService(name: string, host: string, port: number): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ok = await tcpProbe(host, port);
    if (ok) {
      console.log(`[global-setup] ${name} is healthy on ${host}:${port}`);
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    `[global-setup] Timed out waiting for ${name} on ${host}:${port} after ${TIMEOUT_MS}ms.\n` +
      `Run 'bash scripts/test-setup.sh --test' to start Docker test containers.`,
  );
}

export default async function globalSetup(): Promise<void> {
  console.log('[global-setup] Verifying Docker test containers...');
  await Promise.all(CONTAINERS.map(({ name, host, port }) => waitForService(name, host, port)));
  console.log('[global-setup] All test containers are healthy.');
}
