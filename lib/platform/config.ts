export type WebPlatform = 'learner' | 'admin';

export interface PlatformConfig {
  platform: WebPlatform;
  environment: string;
}

export function parseWebPlatform(value: string | undefined, environment: string): WebPlatform {
  const configured = value?.trim();
  if (configured === 'learner' || configured === 'admin') return configured;
  if (configured === undefined && environment === 'development') return 'learner';

  throw new Error('STACK_ATLAS_WEB_PLATFORM must be set to "learner" or "admin".');
}

export function getPlatformConfig(): PlatformConfig {
  const runtimeEnvironment = process.env;
  const environment = runtimeEnvironment['NODE_ENV'] ?? 'production';

  return {
    platform: parseWebPlatform(runtimeEnvironment['STACK_ATLAS_WEB_PLATFORM'], environment),
    environment,
  };
}
