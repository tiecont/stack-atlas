import { getPlatformConfig } from './config';

export function validateRuntimePlatform() {
  try {
    getPlatformConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    // Next may log a rejected instrumentation hook but keep its Node server alive.
    process.exit(1);
  }
}
