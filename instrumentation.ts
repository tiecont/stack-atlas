export function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;
  // Next's instrumentation runtime split uses a conditional CommonJS load.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- needed to keep Node-only startup validation out of Edge.
  return require('./lib/platform/register.node').validateRuntimePlatform();
}
