import { createRuntimeConfigLoader, parseRuntimeConfig } from './runtime-config';

const valid = {
  production: false,
  gatewayUrl: 'https://gateway.example.com',
};

const parsedConfig = { ...valid, baseAppUrl: `${window.location.origin}/` };

describe('parseRuntimeConfig', () => {
  it('accepts shared fields and preserves app-specific fields without mutating the input', () => {
    const raw = Object.freeze({
      ...valid,
      apiUrl: 'https://api.example.com',
      baseAppUrl: 'https://other.example.com',
      privacyPolicyUrl: 'https://example.com/privacy',
      backendPortCheckUrl: 'https://gateway.example.com/health',
      tenantId: 'example',
    });

    expect(parseRuntimeConfig(raw)).toEqual({ ...raw, baseAppUrl: 'https://other.example.com/' });
    expect(raw.baseAppUrl).toBe('https://other.example.com');
  });

  it.each([
    [true, true],
    [false, false],
    ['true', true],
    ['false', false],
  ])('normalizes production %p to %p', (input, expected) => {
    expect(parseRuntimeConfig({ ...valid, production: input }).production).toBe(expected);
  });

  it.each([undefined, null, 0, 1, '', 'TRUE', 'yes'])('rejects invalid production %p', production => {
    expect(() => parseRuntimeConfig({ ...valid, production }, 'app/config.json'))
      .toThrow(/app\/config.json: production must be true or false/);
  });

  it('requires a non-empty string for gatewayUrl', () => {
    for (const value of [undefined, null, '', ' ', 42]) {
      expect(() => parseRuntimeConfig({ ...valid, gatewayUrl: value })).toThrow('missing or empty gatewayUrl');
    }
  });

  it('does not require apiUrl', () => {
    expect(parseRuntimeConfig(valid)).not.toHaveProperty('apiUrl');
  });

  it.each(['apiUrl', 'privacyPolicyUrl', 'backendPortCheckUrl'])('validates optional %s when present', key => {
    expect(parseRuntimeConfig({ ...valid, [key]: '' })).toEqual({ ...parsedConfig, [key]: '' });
    expect(() => parseRuntimeConfig({ ...valid, [key]: 42 })).toThrow(`${key} must be a string`);
  });

  it('rejects non-object JSON values', () => {
    for (const raw of [null, undefined, [], true, 42, 'config']) {
      expect(() => parseRuntimeConfig(raw)).toThrow('expected a JSON object');
    }
  });

  it('derives baseAppUrl without requiring it in the config JSON', () => {
    expect(parseRuntimeConfig(valid)).toEqual(parsedConfig);
  });

  it('preserves a configured subdirectory for the host app', () => {
    expect(parseRuntimeConfig({ ...valid, baseAppUrl: 'https://app.example.com/dcp' }))
      .toEqual({ ...valid, baseAppUrl: 'https://app.example.com/dcp/' });
  });

  it('rejects invalid optional baseAppUrl values', () => {
    for (const baseAppUrl of [null, 42, true]) {
      expect(() => parseRuntimeConfig({ ...valid, baseAppUrl })).toThrow('baseAppUrl must be a string');
    }
  });
});

type ConfigResponse = Pick<Response, 'ok' | 'status' | 'json'>;

function response(raw: unknown = valid, status = 200): ConfigResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => raw };
}

describe('createRuntimeConfigLoader', () => {
  const url = 'https://cdn.example.com/app/config.json';
  const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  let fetchMock: jest.Mock<Promise<ConfigResponse>, [string, RequestInit?]>;

  beforeEach(() => {
    fetchMock = jest.fn<Promise<ConfigResponse>, [string, RequestInit?]>().mockResolvedValue(response());
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });
  });

  afterEach(() => {
    if (originalFetch) {
      Object.defineProperty(globalThis, 'fetch', originalFetch);
    } else {
      Reflect.deleteProperty(globalThis, 'fetch');
    }
  });

  it('does not fetch or resolve a lazy URL until load is called', async () => {
    let publicPath = '';
    const source = jest.fn(() => `${publicPath}config.json`);
    const loader = createRuntimeConfigLoader(source);

    expect(source).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(() => loader.get()).toThrow('before load() resolved');

    publicPath = 'https://cdn.example.com/app/';
    await loader.load();

    expect(fetchMock).toHaveBeenCalledWith(url, { cache: 'no-store' });
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('shares in-flight and successful loads and provides synchronous access after success', async () => {
    const loader = createRuntimeConfigLoader(url);
    const first = loader.load();

    expect(loader.load()).toBe(first);
    expect(() => loader.get()).toThrow('before load() resolved');

    const config = await first;

    expect(config).toEqual(parsedConfig);
    expect(loader.get()).toBe(config);
    expect(loader.load()).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('isolates caches between apps even when they request the same URL', async () => {
    const otherConfig = { ...valid, gatewayUrl: 'https://other.example.com' };
    fetchMock.mockResolvedValueOnce(response()).mockResolvedValueOnce(response(otherConfig));
    const first = createRuntimeConfigLoader(url);
    const second = createRuntimeConfigLoader(url);

    await Promise.all([first.load(), second.load()]);

    expect(first.get()).toEqual(parsedConfig);
    expect(second.get()).toEqual({ ...otherConfig, baseAppUrl: parsedConfig.baseAppUrl });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('propagates network errors and retries on the next load', async () => {
    const error = new TypeError('Network unavailable');
    fetchMock.mockImplementationOnce(async () => { throw error; });
    const loader = createRuntimeConfigLoader(url);
    const failed = loader.load();

    expect(loader.load()).toBe(failed);
    await expect(failed).rejects.toBe(error);
    expect(() => loader.get()).toThrow('before load() resolved');
    await expect(loader.load()).resolves.toEqual(parsedConfig);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports the URL and HTTP status and retries after an HTTP failure', async () => {
    const failedResponse = { ...response(undefined, 404), json: jest.fn() };
    fetchMock.mockResolvedValueOnce(failedResponse);
    const loader = createRuntimeConfigLoader(url);

    await expect(loader.load()).rejects.toThrow(`${url} (HTTP 404)`);
    expect(failedResponse.json).not.toHaveBeenCalled();
    await expect(loader.load()).resolves.toEqual(parsedConfig);
  });

  it('reports invalid JSON and retries instead of caching the failed response', async () => {
    fetchMock.mockResolvedValueOnce({
      ...response(),
      json: async () => { throw new SyntaxError('Unexpected token'); },
    });
    const loader = createRuntimeConfigLoader(url);

    await expect(loader.load()).rejects.toThrow(`${url} is not valid JSON: Unexpected token`);
    await expect(loader.load()).resolves.toEqual(parsedConfig);
  });

  it('does not cache a config that fails validation', async () => {
    fetchMock.mockResolvedValueOnce(response({ ...valid, gatewayUrl: '' }));
    const loader = createRuntimeConfigLoader(url);

    await expect(loader.load()).rejects.toThrow('missing or empty gatewayUrl');
    expect(() => loader.get()).toThrow('before load() resolved');
    await expect(loader.load()).resolves.toEqual(parsedConfig);
  });

  it('uses the supplied parser with type inference for app-specific fields', async () => {
    const parse = jest.fn((raw: unknown, source: string) => ({
      ...parseRuntimeConfig(raw, source),
      tenantId: 'example',
    }));
    const loader = createRuntimeConfigLoader(url, parse);
    const config = await loader.load();
    const tenantId: string = loader.get().tenantId;

    expect(tenantId).toBe('example');
    expect(config.tenantId).toBe('example');
    expect(parse).toHaveBeenCalledWith(valid, url);
    expect(loader.get()).toBe(config);
  });

  it('propagates custom parser failures and retries', async () => {
    const parse = jest.fn(parseRuntimeConfig).mockImplementationOnce(() => {
      throw new Error('Missing app-specific field');
    });
    const loader = createRuntimeConfigLoader(url, parse);

    await expect(loader.load()).rejects.toThrow('Missing app-specific field');
    await expect(loader.load()).resolves.toEqual(parsedConfig);
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it('rejects URL resolution errors asynchronously and allows retry', async () => {
    const error = new Error('Public path not set');
    const source = jest.fn(() => url).mockImplementationOnce(() => { throw error; });
    const loader = createRuntimeConfigLoader(source);

    await expect(loader.load()).rejects.toBe(error);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(loader.load()).resolves.toEqual(parsedConfig);
    expect(source).toHaveBeenCalledTimes(2);
  });

  it('rejects an empty URL without fetching and re-evaluates it on retry', async () => {
    const source = jest.fn(() => url).mockReturnValueOnce(' ');
    const loader = createRuntimeConfigLoader(source);

    await expect(loader.load()).rejects.toThrow('A non-empty config URL is required');
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(loader.load()).resolves.toEqual(parsedConfig);
  });
});
