import { applyRuntimeTheme, getRuntimeTheme, RUNTIME_THEME_CSS_VARS } from './runtime-theme';

/**
 * jsdom does not implement `CSS.supports`, so a minimal stand-in is installed
 * for the tests: it accepts hex colours and a small set of named colours.
 */
const VALID_NAMED_COLORS = ['teal', 'red', 'white', 'black'];
function fakeSupports(property: string, value?: string): boolean {
  if (property !== 'color' || typeof value !== 'string') {
    return false;
  }
  return /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) || VALID_NAMED_COLORS.includes(value.toLowerCase());
}

const ALL_VARS = Object.values(RUNTIME_THEME_CSS_VARS);

function rootVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name);
}

describe('applyRuntimeTheme', () => {
  const g = globalThis as any;
  const originalCss = g.CSS;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    g.CSS = { supports: jest.fn(fakeSupports) };
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete g.__DCP_ENV__;
    ALL_VARS.forEach((name) => document.documentElement.style.removeProperty(name));
    errorSpy.mockRestore();
    if (originalCss === undefined) {
      delete g.CSS;
    } else {
      g.CSS = originalCss;
    }
  });

  it('exposes the CSS variable names', () => {
    expect(RUNTIME_THEME_CSS_VARS).toEqual({
      primary: '--dcp-branding-primary-color',
      primaryLight: '--dcp-branding-primary-light',
      primarySubtle: '--dcp-branding-primary-subtle',
      background: '--dcp-background-color',
    });
  });

  it('sets all 4 variables for a valid hex colour (trimmed)', () => {
    g.__DCP_ENV__ = { THEME: { PRIMARY_COLOR: '  #ff0000 ', BACKGROUND_COLOR: '#f4f7f9' } };

    applyRuntimeTheme();

    expect(rootVar(RUNTIME_THEME_CSS_VARS.primary)).toBe('#ff0000');
    expect(rootVar(RUNTIME_THEME_CSS_VARS.primaryLight)).toBe('color-mix(in srgb, #ff0000 70%, white)');
    expect(rootVar(RUNTIME_THEME_CSS_VARS.primarySubtle)).toBe('color-mix(in srgb, #ff0000 25%, white)');
    expect(rootVar(RUNTIME_THEME_CSS_VARS.background)).toBe('#f4f7f9');
    expect(g.CSS.supports).toHaveBeenCalledWith('color', '#ff0000');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('sets all 4 variables for a named colour', () => {
    g.__DCP_ENV__ = { THEME: { PRIMARY_COLOR: 'teal', BACKGROUND_COLOR: 'white' } };

    applyRuntimeTheme();

    expect(rootVar(RUNTIME_THEME_CSS_VARS.primary)).toBe('teal');
    expect(rootVar(RUNTIME_THEME_CSS_VARS.primaryLight)).toBe('color-mix(in srgb, teal 70%, white)');
    expect(rootVar(RUNTIME_THEME_CSS_VARS.primarySubtle)).toBe('color-mix(in srgb, teal 25%, white)');
    expect(rootVar(RUNTIME_THEME_CSS_VARS.background)).toBe('white');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid values with console.error and sets nothing', () => {
    g.__DCP_ENV__ = { THEME: { PRIMARY_COLOR: 'not-a-colour', BACKGROUND_COLOR: 42 } };

    applyRuntimeTheme();

    ALL_VARS.forEach((name) => expect(rootVar(name)).toBe(''));
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith('[RuntimeTheme] Rejected invalid THEME.PRIMARY_COLOR:', 'not-a-colour');
    expect(errorSpy).toHaveBeenCalledWith('[RuntimeTheme] Rejected invalid THEME.BACKGROUND_COLOR:', 42);
  });

  it('rejects an empty / whitespace-only value', () => {
    g.__DCP_ENV__ = { THEME: { PRIMARY_COLOR: '   ' } };

    applyRuntimeTheme();

    ALL_VARS.forEach((name) => expect(rootVar(name)).toBe(''));
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('only sets the variables of the valid value', () => {
    g.__DCP_ENV__ = { THEME: { PRIMARY_COLOR: 'teal', BACKGROUND_COLOR: 'nope' } };

    applyRuntimeTheme();

    expect(rootVar(RUNTIME_THEME_CSS_VARS.primary)).toBe('teal');
    expect(rootVar(RUNTIME_THEME_CSS_VARS.background)).toBe('');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('does nothing when __DCP_ENV__ is missing', () => {
    applyRuntimeTheme();

    ALL_VARS.forEach((name) => expect(rootVar(name)).toBe(''));
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('does nothing when THEME is missing', () => {
    g.__DCP_ENV__ = {};

    applyRuntimeTheme();

    ALL_VARS.forEach((name) => expect(rootVar(name)).toBe(''));
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('uses the custom logPrefix', () => {
    g.__DCP_ENV__ = { THEME: { PRIMARY_COLOR: 'nope' } };

    applyRuntimeTheme({ logPrefix: '[Favorites]' });

    expect(errorSpy).toHaveBeenCalledWith('[Favorites] Rejected invalid THEME.PRIMARY_COLOR:', 'nope');
  });

  it('uses an explicitly passed theme instead of the shared one', () => {
    g.__DCP_ENV__ = { THEME: { PRIMARY_COLOR: 'red', BACKGROUND_COLOR: 'black' } };

    applyRuntimeTheme({ theme: { PRIMARY_COLOR: 'teal' } });

    expect(rootVar(RUNTIME_THEME_CSS_VARS.primary)).toBe('teal');
    expect(rootVar(RUNTIME_THEME_CSS_VARS.background)).toBe('');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('does nothing for an explicit null theme', () => {
    g.__DCP_ENV__ = { THEME: { PRIMARY_COLOR: 'red' } };

    applyRuntimeTheme({ theme: null });

    ALL_VARS.forEach((name) => expect(rootVar(name)).toBe(''));
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('getRuntimeTheme returns the shared theme or undefined', () => {
    expect(getRuntimeTheme()).toBeUndefined();
    g.__DCP_ENV__ = { THEME: { PRIMARY_COLOR: 'teal' } };
    expect(getRuntimeTheme()).toEqual({ PRIMARY_COLOR: 'teal' });
  });

  it('is a no-op (does not throw) when CSS.supports is unavailable', () => {
    delete g.CSS;
    g.__DCP_ENV__ = { THEME: { PRIMARY_COLOR: 'teal' } };

    expect(() => applyRuntimeTheme()).not.toThrow();
    ALL_VARS.forEach((name) => expect(rootVar(name)).toBe(''));
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('never throws when reading the theme fails', () => {
    Object.defineProperty(g, '__DCP_ENV__', {
      configurable: true,
      get: () => {
        throw new Error('boom');
      },
    });

    expect(() => applyRuntimeTheme()).not.toThrow();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
