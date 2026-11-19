import { InjectionToken, Provider } from '@angular/core';
import { DcHttpConfig, HttpConfig } from '../services/http-client.service';
import { DcpRuntimeConfig, RuntimeConfigLoader } from './runtime-config';

export const APP_CONFIG = new InjectionToken<DcpRuntimeConfig>('APP_CONFIG');

/**
 * Register in the app injector, not the shared platform injector.
 * Await loader.load() before bootstrapping Angular; these providers do not fetch.
 */
export function provideRuntimeConfig(loader: RuntimeConfigLoader): Provider[] {
  return [
    { provide: APP_CONFIG, useFactory: () => loader.get() },
    {
      provide: HttpConfig,
      useFactory: (config: DcpRuntimeConfig): DcHttpConfig => ({
        gatewayUrl: config.gatewayUrl,
      }),
      deps: [APP_CONFIG],
    },
  ];
}
