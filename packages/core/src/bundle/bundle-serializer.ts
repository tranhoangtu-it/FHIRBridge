/**
 * FHIR R4 Bundle serializer.
 * Converts Bundles to JSON, NDJSON, and Node.js ReadableStream.
 */

import type { Bundle, Resource } from '@fhirbridge/types';

/**
 * Serialize a Bundle to a pretty-printed JSON string.
 */
export function serializeToJson(bundle: Bundle): string {
  return JSON.stringify(bundle, null, 2);
}

/**
 * Serialize a Bundle to NDJSON (Newline Delimited JSON).
 * Each entry's resource is serialized on its own line.
 * Empty entries (no resource) are skipped.
 */
export function serializeToNdjson(bundle: Bundle): string {
  const lines: string[] = [];

  for (const entry of bundle.entry ?? []) {
    if (entry.resource) {
      lines.push(JSON.stringify(entry.resource));
    }
  }

  return lines.join('\n');
}

/**
 * Parse NDJSON text back into an array of Resources.
 * Skips blank lines and malformed JSON (logged as warnings).
 */
export function parseNdjson(ndjson: string): Resource[] {
  const resources: Resource[] = [];

  for (const line of ndjson.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const resource = JSON.parse(trimmed) as Resource;
      resources.push(resource);
    } catch {
      // Malformed line — skip silently (no PHI in error)
    }
  }

  return resources;
}

/**
 * Create a ReadableStream that emits the Bundle in the requested format.
 * Uses Node.js Web Streams API (available in Node 18+).
 *
 * @param bundle - The Bundle to stream
 * @param format - 'json' emits the full JSON Bundle; 'ndjson' emits one resource per chunk
 */
export function createReadableStream(
  bundle: Bundle,
  format: 'json' | 'ndjson' = 'json',
): ReadableStream<string> {
  if (format === 'json') {
    const content = serializeToJson(bundle);
    return new ReadableStream({
      start(controller) {
        controller.enqueue(content);
        controller.close();
      },
    });
  }

  // NDJSON — stream one resource per chunk for backpressure support
  const entries = bundle.entry ?? [];
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      // Find next entry with a resource
      while (index < entries.length) {
        const entry = entries[index++];
        if (entry?.resource) {
          controller.enqueue(JSON.stringify(entry.resource) + '\n');
          return;
        }
      }
      controller.close();
    },
  });
}
