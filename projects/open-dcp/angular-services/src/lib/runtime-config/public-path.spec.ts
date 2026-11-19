import { assetUrl, getBaseAppUrl, publicPathUrl, resolvePublicPath } from './public-path';

describe('getBaseAppUrl', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['https://app.example.com', 'https://app.example.com/'],
    ['https://app.example.com:8443', 'https://app.example.com:8443/'],
    ['http://localhost:4200', 'http://localhost:4200/'],
  ])('returns the host origin %s with a trailing slash', (origin, expected) => {
    jest.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      origin,
      pathname: '/nested/app/login',
      search: '?redirect=/other',
      hash: '#section',
    });

    expect(getBaseAppUrl()).toBe(expected);
  });

  it('uses the actual browser origin when called without arguments', () => {
    expect(getBaseAppUrl()).toBe(`${window.location.origin}/`);
  });

  it('uses an explicit base URL override and preserves its subfolder', () => {
    expect(getBaseAppUrl('https://example.com/dcp')).toBe('https://example.com/dcp/');
    expect(getBaseAppUrl(' https://example.com/dcp/ ')).toBe('https://example.com/dcp/');
  });

  it('does not use the current route or query as an explicit base path', () => {
    expect(getBaseAppUrl('https://example.com/dcp/')).toBe('https://example.com/dcp/');
  });

  it.each(['', ' ', '/dcp/', 'ftp://example.com/dcp/', 'https://example.com/dcp/?a=1', 'https://example.com/dcp/#route'])(
    'rejects invalid explicit base URL %p',
    override => {
      expect(() => getBaseAppUrl(override)).toThrow();
    }
  );

  it.each(['', 'null'])('rejects an unavailable or opaque origin %p', origin => {
    jest.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, origin });

    expect(() => getBaseAppUrl()).toThrow('A browser origin is required');
  });

  it('fails explicitly when no browser window is available', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true });

    try {
      expect(() => getBaseAppUrl()).toThrow('A browser origin is required');
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'window', descriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'window');
      }
    }
  });
});

describe('resolvePublicPath', () => {
  it('resolves the supplied import-map name instead of a package-global app name', () => {
    const system = { resolve: jest.fn(() => 'http://localhost:4200/main.js') };

    expect(resolvePublicPath(system, '@dcp/example')).toBe('http://localhost:4200/');
    expect(system.resolve).toHaveBeenCalledWith('@dcp/example');
  });

  it('keeps nested deployment folders and ignores slashes in queries and fragments', () => {
    const system = {
      resolve: () => 'https://cdn.example.com/apps/example/main.123.js?origin=/other/path#nested/fragment',
    };

    expect(resolvePublicPath(system, '@dcp/example')).toBe('https://cdn.example.com/apps/example/');
  });

  it('throws when SystemJS is unavailable', () => {
    expect(() => resolvePublicPath(undefined, '@dcp/example')).toThrow('SystemJS is not available');
  });

  it('requires an explicit module name', () => {
    const system = { resolve: jest.fn() };

    expect(() => resolvePublicPath(system, ' ')).toThrow('An import-map module name is required');
    expect(system.resolve).not.toHaveBeenCalled();
  });

  it('propagates an import-map resolution failure', () => {
    const error = new Error('Module not found');
    const system = { resolve: () => { throw error; } };

    expect(() => resolvePublicPath(system, '@dcp/missing')).toThrow(error);
  });

  it('rejects an invalid module URL instead of using the host page directory', () => {
    expect(() => resolvePublicPath({ resolve: () => 'main.js' }, '@dcp/example')).toThrow();
  });
});

describe('publicPathUrl', () => {
  it.each([
    ['https://cdn.example.com/app/', 'config.json', 'https://cdn.example.com/app/config.json'],
    ['https://cdn.example.com/app', '/config.json', 'https://cdn.example.com/app/config.json'],
    ['https://cdn.example.com/app/', '//config.json', 'https://cdn.example.com/app/config.json'],
    ['/app/', 'config.json', '/app/config.json'],
    ['', 'config.json', '/config.json'],
    ['https://cdn.example.com/app', '', 'https://cdn.example.com/app/'],
  ])('joins %s and %s', (base, path, expected) => {
    expect(publicPathUrl(base, path)).toBe(expected);
  });
});

describe('assetUrl', () => {
  it.each([
    ['i18n/', 'https://cdn.example.com/app/assets/i18n/'],
    ['/images/loader.json', 'https://cdn.example.com/app/assets/images/loader.json'],
    ['//translations/en.json', 'https://cdn.example.com/app/assets/translations/en.json'],
    ['', 'https://cdn.example.com/app/assets/'],
  ])('resolves %s inside the bundle assets directory', (path, expected) => {
    expect(assetUrl('https://cdn.example.com/app/', path)).toBe(expected);
  });
});
