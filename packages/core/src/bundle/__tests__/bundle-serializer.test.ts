/**
 * Tests for the FHIR R4 BundleSerializer.
 * Verifies JSON, NDJSON output, and round-trip parsing.
 */

import { describe, it, expect } from 'vitest';
import { BundleBuilder } from '../bundle-builder.js';
import {
  serializeToJson,
  serializeToNdjson,
  parseNdjson,
  createReadableStream,
} from '../bundle-serializer.js';
import type { Bundle } from '@fhirbridge/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function buildTestBundle(): Bundle {
  const builder = new BundleBuilder();
  builder.addResource({
    resourceType: 'Patient',
    id: 'patient-001',
    name: [{ family: 'Doe', given: ['Jane'] }],
    gender: 'female',
  });
  builder.addResource({
    resourceType: 'Condition',
    id: 'condition-001',
    subject: { reference: 'urn:uuid:placeholder' },
  });
  return builder.build();
}

const emptyBundle: Bundle = {
  resourceType: 'Bundle',
  type: 'collection',
  entry: [],
};

// ── JSON serialization ────────────────────────────────────────────────────────

describe('serializeToJson', () => {
  it('returns a valid JSON string', () => {
    const bundle = buildTestBundle();
    const json = serializeToJson(bundle);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('includes the Bundle resourceType', () => {
    const bundle = buildTestBundle();
    const parsed = JSON.parse(serializeToJson(bundle)) as Bundle;
    expect(parsed.resourceType).toBe('Bundle');
  });

  it('preserves all entries', () => {
    const bundle = buildTestBundle();
    const parsed = JSON.parse(serializeToJson(bundle)) as Bundle;
    expect(parsed.entry?.length).toBe(2);
  });

  it('produces pretty-printed output (contains newlines)', () => {
    const bundle = buildTestBundle();
    const json = serializeToJson(bundle);
    expect(json).toContain('\n');
  });

  it('handles empty bundle', () => {
    const json = serializeToJson(emptyBundle);
    const parsed = JSON.parse(json) as Bundle;
    expect(parsed.entry).toHaveLength(0);
  });
});

// ── NDJSON serialization ──────────────────────────────────────────────────────

describe('serializeToNdjson', () => {
  it('produces one line per resource', () => {
    const bundle = buildTestBundle();
    const ndjson = serializeToNdjson(bundle);
    const lines = ndjson.split('\n').filter((l) => l.trim());
    expect(lines).toHaveLength(2);
  });

  it('each line is valid JSON', () => {
    const bundle = buildTestBundle();
    const lines = serializeToNdjson(bundle)
      .split('\n')
      .filter((l) => l.trim());
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it('each line contains resourceType', () => {
    const bundle = buildTestBundle();
    const lines = serializeToNdjson(bundle)
      .split('\n')
      .filter((l) => l.trim());
    for (const line of lines) {
      const resource = JSON.parse(line) as Record<string, unknown>;
      expect(resource['resourceType']).toBeTruthy();
    }
  });

  it('skips entries without resources', () => {
    const bundle: Bundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        { fullUrl: 'urn:uuid:no-resource' },
        { fullUrl: 'urn:uuid:has-resource', resource: { resourceType: 'Patient', id: 'p1' } },
      ],
    };
    const lines = serializeToNdjson(bundle)
      .split('\n')
      .filter((l) => l.trim());
    expect(lines).toHaveLength(1);
  });

  it('returns empty string for empty bundle', () => {
    const result = serializeToNdjson(emptyBundle);
    expect(result).toBe('');
  });
});

// ── NDJSON round-trip ─────────────────────────────────────────────────────────

describe('parseNdjson', () => {
  it('round-trips resources through NDJSON serialization', () => {
    const bundle = buildTestBundle();
    const ndjson = serializeToNdjson(bundle);
    const resources = parseNdjson(ndjson);
    expect(resources).toHaveLength(2);
  });

  it('skips blank lines without error', () => {
    const ndjson = '\n{"resourceType":"Patient","id":"p1"}\n\n';
    const resources = parseNdjson(ndjson);
    expect(resources).toHaveLength(1);
  });

  it('skips malformed JSON lines without throwing', () => {
    const ndjson = '{"resourceType":"Patient"}\nNOT_JSON\n{"resourceType":"Condition"}';
    expect(() => parseNdjson(ndjson)).not.toThrow();
    const resources = parseNdjson(ndjson);
    expect(resources).toHaveLength(2);
  });
});

// ── ReadableStream ────────────────────────────────────────────────────────────

describe('createReadableStream', () => {
  async function consumeStream(stream: ReadableStream<string>): Promise<string> {
    const reader = stream.getReader();
    let result = '';
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += value;
    }
    return result;
  }

  it('json format emits the full bundle JSON', async () => {
    const bundle = buildTestBundle();
    const stream = createReadableStream(bundle, 'json');
    const content = await consumeStream(stream);
    const parsed = JSON.parse(content) as Bundle;
    expect(parsed.resourceType).toBe('Bundle');
  });

  it('ndjson format emits one resource per chunk', async () => {
    const bundle = buildTestBundle();
    const stream = createReadableStream(bundle, 'ndjson');
    const content = await consumeStream(stream);
    const lines = content.split('\n').filter((l) => l.trim());
    expect(lines).toHaveLength(2);
  });
});
