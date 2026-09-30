import { getPlatformConfig } from './config';
import { platformRouteDecision } from './routes';

export function getPlatformRouteDecision(pathname: string) {
  return platformRouteDecision(getPlatformConfig().platform, pathname);
}
