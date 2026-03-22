/**
 * Utility to mark a Fastify plugin as non-encapsulated.
 * Equivalent to fastify-plugin's skip-override feature.
 * This makes the plugin's decorators and hooks visible to the parent scope.
 */

/** Symbol used by avvio/Fastify to skip plugin encapsulation */
const SKIP_OVERRIDE = Symbol.for('skip-override');

type AnyFn = (...args: never[]) => unknown;

/** Mark plugin function as non-encapsulated (global scope) */
export function skipOverride<T extends AnyFn>(plugin: T): T {
  (plugin as unknown as Record<symbol, boolean>)[SKIP_OVERRIDE] = true;
  return plugin;
}
