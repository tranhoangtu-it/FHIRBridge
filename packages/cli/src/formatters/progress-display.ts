/**
 * Progress display — wraps cli-progress for long-running operations.
 * Writes to process.stdout; safe to redirect stderr for errors.
 */

import cliProgress from 'cli-progress';
import chalk from 'chalk';

export interface ProgressBar {
  update(current: number, payload?: Record<string, unknown>): void;
  increment(delta?: number, payload?: Record<string, unknown>): void;
  stop(): void;
}

/**
 * Create and start a CLI progress bar.
 * @param total - total number of steps
 * @param label - label shown next to bar
 * @returns ProgressBar control handle
 */
export function createProgressBar(total: number, label: string): ProgressBar {
  const bar = new cliProgress.SingleBar(
    {
      format: `${chalk.cyan('{bar}')} | ${label} | {percentage}% | {value}/{total} | ETA: {eta}s`,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
      clearOnComplete: false,
    },
    cliProgress.Presets.shades_classic,
  );

  bar.start(total, 0);

  return {
    update(current, payload) {
      bar.update(current, payload);
    },
    increment(delta = 1, payload) {
      bar.increment(delta, payload);
    },
    stop() {
      bar.stop();
    },
  };
}

/**
 * No-op progress bar for non-TTY environments (CI/piped output).
 */
export function createNoopProgressBar(): ProgressBar {
  return {
    update() {},
    increment() {},
    stop() {},
  };
}

/**
 * Create appropriate progress bar based on TTY availability.
 */
export function createProgress(total: number, label: string): ProgressBar {
  if (!process.stdout.isTTY) return createNoopProgressBar();
  return createProgressBar(total, label);
}
