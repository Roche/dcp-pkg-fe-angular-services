/**
 * Runtime theme values (platform colours) from the settings API.
 *
 * Currently provided via `globalThis.__DCP_ENV__.THEME`.
 */
export interface DcpRuntimeTheme {
  /** Any valid CSS colour (hex, rgb(), hsl(), named colour, ...). */
  PRIMARY_COLOR?: string;
  /** Any valid CSS colour (hex, rgb(), hsl(), named colour, ...). */
  BACKGROUND_COLOR?: string;
}

/** Options for {@link applyRuntimeTheme}. */
export interface ApplyRuntimeThemeOptions {
  /**
   * Theme to apply. When omitted, the current runtime theme is used
   * (see {@link getRuntimeTheme}).
   */
  theme?: DcpRuntimeTheme | null;
  /** Prefix for console errors, e.g. `'[Favorites]'`. Defaults to `'[RuntimeTheme]'`. */
  logPrefix?: string;
}

/**
 * CSS custom properties written on `document.documentElement` by
 * {@link applyRuntimeTheme} and consumed by `@open-dcp/styles` /
 * `@open-dcp/angular-styles`.
 */
export const RUNTIME_THEME_CSS_VARS = {
  primary: '--dcp-branding-primary-color',
  primaryLight: '--dcp-branding-primary-light',
  primarySubtle: '--dcp-branding-primary-subtle',
  background: '--dcp-background-color',
} as const;

const DEFAULT_LOG_PREFIX = '[RuntimeTheme]';

/**
 * Returns the runtime theme loaded from the settings API, or `undefined` when
 * none is available. Currently read from `globalThis.__DCP_ENV__.THEME`.
 */
export function getRuntimeTheme(): DcpRuntimeTheme | undefined {
  return (globalThis as any).__DCP_ENV__?.THEME;
}

/**
 * Returns the trimmed value when it is a valid CSS color (hex, rgb(), hsl(),
 * named colors, ...), otherwise null. Same validation as dcp-mind
 * (CSS.supports('color', ...)).
 */
function toValidCssColor(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const color = value.trim();
  return color && CSS.supports('color', color) ? color : null;
}

/**
 * Applies a runtime theme as CSS custom properties on
 * `document.documentElement`, so the look can change without rebuilding the
 * app. The theme is `options.theme` when given, otherwise the current runtime
 * theme ({@link getRuntimeTheme}). Values that are missing are skipped,
 * so the styles keep their build-time fallbacks.
 *
 * Plain function (no DI) - call it in `main.single-spa.ts` at module load and
 * again inside `bootstrapFunction`. Never throws; no-op when `document` or
 * `CSS.supports` is unavailable (SSR / tests).
 *
 * @example
 * ```ts
 * import { applyRuntimeTheme } from '@open-dcp/angular-services';
 * applyRuntimeTheme({ logPrefix: '[Favorites]' });
 * ```
 */
export function applyRuntimeTheme(options?: ApplyRuntimeThemeOptions): void {
  const logPrefix = options?.logPrefix ?? DEFAULT_LOG_PREFIX;

  if (
    typeof document === 'undefined' ||
    !document.documentElement ||
    typeof CSS === 'undefined' ||
    typeof CSS.supports !== 'function'
  ) {
    return;
  }

  try {
    const theme = options?.theme !== undefined ? options.theme : getRuntimeTheme();
    const rootStyle = document.documentElement.style;

    const primaryValue = theme?.PRIMARY_COLOR;
    const primaryColor = toValidCssColor(primaryValue);
    if (primaryColor) {
      rootStyle.setProperty(RUNTIME_THEME_CSS_VARS.primary, primaryColor);
      rootStyle.setProperty(RUNTIME_THEME_CSS_VARS.primaryLight, `color-mix(in srgb, ${primaryColor} 70%, white)`);
      rootStyle.setProperty(RUNTIME_THEME_CSS_VARS.primarySubtle, `color-mix(in srgb, ${primaryColor} 25%, white)`);
    } else if (primaryValue !== undefined) {
      console.error(`${logPrefix} Rejected invalid THEME.PRIMARY_COLOR:`, primaryValue);
    }

    const backgroundValue = theme?.BACKGROUND_COLOR;
    const backgroundColor = toValidCssColor(backgroundValue);
    if (backgroundColor) {
      rootStyle.setProperty(RUNTIME_THEME_CSS_VARS.background, backgroundColor);
    } else if (backgroundValue !== undefined) {
      console.error(`${logPrefix} Rejected invalid THEME.BACKGROUND_COLOR:`, backgroundValue);
    }
  } catch (error) {
    console.error(`${logPrefix} Failed to apply runtime theme:`, error);
  }
}

