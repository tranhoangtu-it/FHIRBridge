/**
 * Tests for file-writer utility — write output data to file or stdout.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeOutput, serialize } from '../file-writer.js';

// Silence logger output
vi.mock('../logger.js', () => ({
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  print: vi.fn(),
  configureLogger: vi.fn(),
}));

describe('writeOutput', () => {
  let tmpFile: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpFile = join(
      tmpdir(),
      `file-writer-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    try {
      unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  });

  it('writes data to a temp file', () => {
    const content = '{"test": true}';
    writeOutput(content, tmpFile);
    expect(existsSync(tmpFile)).toBe(true);
    const written = readFileSync(tmpFile, 'utf8');
    expect(written).toBe(content);
  });

  it('writes to stdout when no path provided', () => {
    writeOutput('hello stdout');
    expect(stdoutSpy).toHaveBeenCalled();
    const written = stdoutSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(written).toContain('hello stdout');
  });

  it('appends newline to stdout when data does not end with newline', () => {
    writeOutput('no newline');
    const written = stdoutSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(written).toContain('\n');
  });

  it('does not double-append newline when data already ends with newline', () => {
    writeOutput('with newline\n');
    // Should call write once (the data), not twice
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
  });

  it('overwrites existing file content', () => {
    writeOutput('first content', tmpFile);
    writeOutput('second content', tmpFile);
    const written = readFileSync(tmpFile, 'utf8');
    expect(written).toBe('second content');
  });

  it('rejects path with null byte', () => {
    const badPath = '/tmp/test\0evil.json';
    expect(() => writeOutput('data', badPath)).toThrow(/null byte/);
  });

  it('path traversal "../" is normalized but does not throw for valid resolved path', () => {
    // The safePath function normalizes "../" — it should not throw for paths that resolve
    // to valid locations. The key security check is null bytes.
    const normalizedPath = join(tmpdir(), 'subdir', '..', `safe-file-${Date.now()}.json`);
    expect(() => writeOutput('data', normalizedPath)).not.toThrow();
    try {
      unlinkSync(join(tmpdir(), `safe-file-${Date.now()}.json`));
    } catch {
      /* ignore */
    }
  });
});

describe('serialize', () => {
  it('serializes object to JSON by default', () => {
    const result = serialize({ key: 'value' });
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('serializes to compact JSON with format json (pretty-printed)', () => {
    const result = serialize({ a: 1 }, 'json');
    const parsed = JSON.parse(result) as { a: number };
    expect(parsed.a).toBe(1);
  });

  it('serializes array to ndjson', () => {
    const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = serialize(data, 'ndjson');
    const lines = result.split('\n').filter(Boolean);
    expect(lines.length).toBe(3);
    lines.forEach((line) => {
      expect(() => JSON.parse(line)).not.toThrow();
    });
  });

  it('serializes non-array to JSON string for ndjson format', () => {
    const result = serialize({ single: true }, 'ndjson');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('returns string as-is for markdown format', () => {
    const result = serialize('# Heading', 'markdown');
    expect(result).toBe('# Heading');
  });

  it('returns string as-is for text format', () => {
    const result = serialize('plain text', 'text');
    expect(result).toBe('plain text');
  });

  it('serializes object to JSON for text format', () => {
    const result = serialize({ data: 42 }, 'text');
    expect(() => JSON.parse(result)).not.toThrow();
  });
});
