export interface SystemJsLike {
  resolve(id: string): string;
}

/** Returns the host page origin, or normalizes an explicit host base URL. */
export function getBaseAppUrl(override?: string): string {
  if (override !== undefined) {
    const value = override.trim();
    if (!value) {
      throw new Error('[RuntimeConfig] An explicit base app URL cannot be empty.');
    }

    let url: URL;
    try {
      url = new URL(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[RuntimeConfig] Invalid explicit base app URL ${value}: ${message}`);
    }

    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.search || url.hash) {
      throw new Error('[RuntimeConfig] An explicit base app URL must be an HTTP(S) URL without a query or fragment.');
    }
    return url.href.endsWith('/') ? url.href : `${url.href}/`;
  }

  const origin = typeof window === 'undefined' ? undefined : window.location.origin;
  if (!origin || origin === 'null') {
    throw new Error('[RuntimeConfig] A browser origin is required to resolve the base app URL.');
  }
  return `${origin}/`;
}

/** Resolves the bundle directory without reading browser or webpack globals. */
export function resolvePublicPath(system: SystemJsLike | undefined, moduleName: string): string {
  if (!system || typeof system.resolve !== 'function') {
    throw new Error(`[RuntimeConfig] SystemJS is not available, cannot resolve the public path of ${moduleName}.`);
  }
  if (!moduleName.trim()) {
    throw new Error('[RuntimeConfig] An import-map module name is required.');
  }

  return new URL('.', system.resolve(moduleName)).href;
}

/** Joins a bundle public path and a relative resource path, ignoring leading slashes on the resource. */
export function publicPathUrl(publicPath: string, path: string): string {
  const suffix = publicPath.endsWith('/') ? '' : '/';
  return `${publicPath}${suffix}${path.replace(/^\/+/, '')}`;
}

export function assetUrl(publicPath: string, path: string): string {
  return publicPathUrl(publicPath, `assets/${path.replace(/^\/+/, '')}`);
}
