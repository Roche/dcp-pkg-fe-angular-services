import { getBaseAppUrl } from './public-path';

export interface DcpRuntimeConfig {
  production: boolean;
  gatewayUrl: string;
  /** Optional app-specific backend URL; not used by `DcHttp`. */
  apiUrl?: string;
  /** Derived from the host page's origin, with a trailing slash. */
  baseAppUrl: string;
  privacyPolicyUrl?: string;
  backendPortCheckUrl?: string;
}

export type RuntimeConfigParser<T extends DcpRuntimeConfig> = (raw: unknown, source: string) => T;

export interface RuntimeConfigLoader<T extends DcpRuntimeConfig = DcpRuntimeConfig> {
  load(): Promise<T>;
  /** Throws until load() has resolved successfully. */
  get(): T;
}

function isConfigObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(settings: Record<string, unknown>, key: string, source: string): string {
  const value = settings[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`[RuntimeConfig] Invalid runtime config in ${source}: missing or empty ${key}.`);
  }
  return value;
}

/**
 * Validates the shared DCP fields, derives baseAppUrl from the browser origin
 * and preserves additional app-specific fields.
 * CI-generated "true"/"false" values are accepted; other production values fail.
 */
export function parseRuntimeConfig(raw: unknown, source = 'config.json'): DcpRuntimeConfig {
  if (!isConfigObject(raw)) {
    throw new Error(`[RuntimeConfig] Invalid runtime config in ${source}: expected a JSON object.`);
  }

  const production = raw['production'];
  if (production !== true && production !== false && production !== 'true' && production !== 'false') {
    throw new Error(`[RuntimeConfig] Invalid runtime config in ${source}: production must be true or false.`);
  }

  for (const key of ['apiUrl', 'baseAppUrl', 'privacyPolicyUrl', 'backendPortCheckUrl']) {
    const value = raw[key];
    if (value !== undefined && typeof value !== 'string') {
      throw new Error(`[RuntimeConfig] Invalid runtime config in ${source}: ${key} must be a string.`);
    }
  }

  return {
    ...raw,
    production: production === true || production === 'true',
    gatewayUrl: requiredString(raw, 'gatewayUrl', source),
    baseAppUrl: getBaseAppUrl(raw['baseAppUrl'] as string | undefined),
  };
}

/**
 * Creates an app-local cache, sharing in-flight/successful loads and retrying
 * after failures. A URL factory is evaluated on load, after the app sets its
 * webpack public path. Custom parsers must validate any additional fields.
 */
export function createRuntimeConfigLoader(
  url: string | (() => string)
): RuntimeConfigLoader;
export function createRuntimeConfigLoader<T extends DcpRuntimeConfig>(
  url: string | (() => string),
  parse: RuntimeConfigParser<T>
): RuntimeConfigLoader<T>;
export function createRuntimeConfigLoader(
  url: string | (() => string),
  parse: RuntimeConfigParser<DcpRuntimeConfig> = parseRuntimeConfig
): RuntimeConfigLoader {
  let pending: Promise<DcpRuntimeConfig> | undefined;
  let loaded: DcpRuntimeConfig | undefined;

  async function fetchConfig(): Promise<DcpRuntimeConfig> {
    const source = typeof url === 'function' ? url() : url;
    if (typeof source !== 'string' || !source.trim()) {
      throw new Error('[RuntimeConfig] A non-empty config URL is required.');
    }

    const response = await fetch(source, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`[RuntimeConfig] Failed to load runtime config ${source} (HTTP ${response.status}).`);
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[RuntimeConfig] Runtime config ${source} is not valid JSON: ${message}`);
    }

    return parse(raw, source);
  }

  return {
    load(): Promise<DcpRuntimeConfig> {
      if (!pending) {
        pending = fetchConfig().then(
          config => {
            loaded = config;
            return config;
          },
          error => {
            pending = undefined;
            throw error;
          }
        );
      }
      return pending;
    },
    get(): DcpRuntimeConfig {
      if (!loaded) {
        throw new Error('[RuntimeConfig] Runtime config accessed before load() resolved.');
      }
      return loaded;
    },
  };
}
