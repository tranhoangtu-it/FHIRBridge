/**
 * @fhirbridge/api entry point.
 * Loads config, creates Fastify server, and starts listening.
 * Handles graceful shutdown on SIGTERM/SIGINT.
 */

import { loadConfig } from './config.js';
import { createServer } from './server.js';

export { createServer } from './server.js';
export { loadConfig } from './config.js';
export type { ApiConfig } from './config.js';

/** Start the server and bind to configured host/port */
export async function startServer(): Promise<void> {
  const config = loadConfig();
  const server = await createServer(config);

  // Graceful shutdown handler
  const shutdown = async (signal: string): Promise<void> => {
    server.log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await server.close();
      server.log.info('Server closed');
      process.exit(0);
    } catch (err) {
      server.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await server.listen({ port: config.port, host: config.host });
    server.log.info(`FHIRBridge API listening on ${config.host}:${config.port}`);
  } catch (err) {
    server.log.error(err, 'Failed to start server');
    process.exit(1);
  }
}

// Auto-start when executed directly
if (process.argv[1]?.endsWith('index.js')) {
  void startServer();
}
