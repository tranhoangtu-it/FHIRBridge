import { Client } from 'pg';

// Tables to truncate between E2E test runs to avoid data pollution
const TABLES_TO_TRUNCATE = ['audit_logs', 'usage_tracking'];

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://fhirbridge_test:testpass@localhost:5433/fhirbridge_test';

export default async function globalTeardown(): Promise<void> {
  console.log('[global-teardown] Truncating test tables...');

  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    for (const table of TABLES_TO_TRUNCATE) {
      await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      console.log(`[global-teardown] Truncated: ${table}`);
    }
  } catch (err) {
    // Log but do not throw — teardown failures should not mask test failures
    console.warn('[global-teardown] Warning: could not truncate tables:', err);
  } finally {
    await client.end();
  }

  console.log('[global-teardown] Done. Docker containers left running.');
}
