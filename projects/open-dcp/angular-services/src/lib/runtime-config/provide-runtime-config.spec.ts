jest.mock('@open-dcp/services', () => ({
  uiStore: { setMessage: jest.fn(), getState: jest.fn(), removeLoading: jest.fn() },
  userStore: { getState: jest.fn(() => ({ token: '' })) },
}));

import { Injector } from '@angular/core';
import { HttpConfig } from '../services/http-client.service';
import { APP_CONFIG, provideRuntimeConfig } from './provide-runtime-config';
import { createRuntimeConfigLoader, DcpRuntimeConfig } from './runtime-config';

const config: DcpRuntimeConfig = {
  production: false,
  gatewayUrl: 'https://gateway.example.com',
  baseAppUrl: 'https://app.example.com/',
};

describe('provideRuntimeConfig', () => {
  it('provides APP_CONFIG lazily without starting a fetch', () => {
    const loader = {
      load: jest.fn(async () => config),
      get: jest.fn(() => config),
    };
    const injector = Injector.create({ providers: provideRuntimeConfig(loader) });

    expect(loader.get).not.toHaveBeenCalled();
    expect(injector.get(APP_CONFIG)).toBe(config);
    expect(injector.get(APP_CONFIG)).toBe(config);
    expect(loader.get).toHaveBeenCalledTimes(1);
    expect(loader.load).not.toHaveBeenCalled();
  });

  it('derives HttpConfig from the same app config through Angular dependency injection', () => {
    const configWithApiUrl = { ...config, apiUrl: 'https://api.example.com' };
    const loader = { load: async () => configWithApiUrl, get: jest.fn(() => configWithApiUrl) };
    const injector = Injector.create({ providers: provideRuntimeConfig(loader) });

    expect(injector.get(HttpConfig)).toStrictEqual({ gatewayUrl: config.gatewayUrl });
    expect(injector.get(APP_CONFIG)).toBe(configWithApiUrl);
    expect(loader.get).toHaveBeenCalledTimes(1);
  });

  it('keeps different app injectors isolated even when they share a platform injector', () => {
    const otherConfig = { ...config, gatewayUrl: 'https://other.example.com' };
    const parent = Injector.create({ providers: [] });
    const first = Injector.create({
      parent,
      providers: provideRuntimeConfig({ load: async () => config, get: () => config }),
    });
    const second = Injector.create({
      parent,
      providers: provideRuntimeConfig({ load: async () => otherConfig, get: () => otherConfig }),
    });

    expect(first.get(APP_CONFIG)).toBe(config);
    expect(second.get(APP_CONFIG)).toBe(otherConfig);
    expect(first.get(HttpConfig).gatewayUrl).toBe(config.gatewayUrl);
    expect(second.get(HttpConfig).gatewayUrl).toBe(otherConfig.gatewayUrl);
    expect(() => parent.get(APP_CONFIG)).toThrow();
  });

  it('fails explicitly when config is injected before loading has completed', () => {
    const injector = Injector.create({
      providers: provideRuntimeConfig(createRuntimeConfigLoader('config.json')),
    });

    expect(() => injector.get(HttpConfig)).toThrow('before load() resolved');
  });
});
