# Angular Services

This library was generated with [Angular CLI](https://github.com/angular/angular-cli) version 17.3.0.

## Build

Run `npm run build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Runtime configuration

The package exports `createRuntimeConfigLoader`, `parseRuntimeConfig`, `DcpRuntimeConfig`,
`APP_CONFIG`, `provideRuntimeConfig`, `getBaseAppUrl`, `resolvePublicPath`, `publicPathUrl`
and `assetUrl`.
These helpers let each app load a public `config.json` next to its bundle before Angular
starts, so the same build can be promoted between environments.

### Config format

```json
{
  "production": false,
  "gatewayUrl": "https://gateway.example.com",
  "privacyPolicyUrl": "https://example.com/privacy"
}
```

`production` and `gatewayUrl` are required; `gatewayUrl` must be a non-empty
string. `production` accepts booleans and the strings `"true"`
and `"false"` emitted by CI tools such as `jq --arg`; missing or invalid values
are rejected rather than silently selecting development mode. `apiUrl`,
`privacyPolicyUrl` and `backendPortCheckUrl` are optional strings; `apiUrl` is
only for apps that call their own backend and is not used by `DcHttp`.
Additional app-specific fields are preserved.

`baseAppUrl` is optional. When omitted, it is derived by `getBaseAppUrl()` from
`window.location.origin`, with a trailing slash. The current route, query and
fragment are not included. Ports are preserved, including localhost development
ports, even if the microfrontend bundle is on a different CDN origin.

Set `baseAppUrl` in `config.json` only when the host app has a deployment path
that differs from its origin, for example `"baseAppUrl": "https://app.example.com/dcp/"`.
The value must be an absolute HTTP(S) URL without a query or fragment; it is
normalized to end with `/`. Do not put an app's CDN or microfrontend bundle path
here.

The helper is also available directly, without loading config or using Angular DI:

```typescript
import { getBaseAppUrl } from '@open-dcp/angular-services';

const baseAppUrl = getBaseAppUrl();
const subfolderBaseAppUrl = getBaseAppUrl('https://app.example.com/dcp/');
```

When no override is supplied, the helper and default config parser require a
browser with a non-opaque origin; they throw explicitly when no browser origin is available.

Config is browser-readable: never put credentials or secrets in it.

### Create one loader per app

```typescript
// src/app/runtime-config.ts
import { createRuntimeConfigLoader, publicPathUrl } from '@open-dcp/angular-services';

declare const __webpack_public_path__: string;

export const runtimeConfig = createRuntimeConfigLoader(
  () => publicPathUrl(__webpack_public_path__, 'config.json')
);
```

A URL factory is evaluated only when `load()` runs, after the app sets its public
path. For a non-webpack app, pass an explicit URL instead. Creating a loader does
not fetch anything. Each loader caches its own successful config and in-flight
promise; it never shares state with another app, even if the package is shared
through an import map. Failed requests, JSON parsing and validation are not cached,
so the next `load()` retries. Requests use `cache: 'no-store'`.

### Resolve the single-spa public path in the app

```typescript
// src/single-spa/set-public-path.ts
import { resolvePublicPath, SystemJsLike } from '@open-dcp/angular-services';

declare const System: SystemJsLike | undefined;
declare let __webpack_public_path__: string;

__webpack_public_path__ = resolvePublicPath(
  typeof System === 'undefined' ? undefined : System,
  '@dcp/example'
);
```

Keep `import './single-spa/set-public-path';` as the **first import** in
`main.single-spa.ts`. The module name and `__webpack_public_path__` assignment must
remain in the consuming app, not in this package. The resolver uses the bundle URL
from SystemJS, not the host page URL, and removes query strings and fragments.

Inside the existing single-spa `bootstrapFunction`, await `runtimeConfig.load()`
before bootstrapping Angular. If `config.production` is true, call Angular's
`enableProdMode()` before creating the platform. Keep existing store registration,
router providers and other lifecycle wiring unchanged. A standalone Angular app
must likewise await the loader before `bootstrapApplication()` or `bootstrapModule()`.

Failures reject the load promise. The app should show its localized bootstrap
error using its existing notification mechanism and rethrow the error; the package
does not display hard-coded messages or change Angular's production mode.

### Register providers in the app injector

```typescript
import { NgModule } from '@angular/core';
import { provideRuntimeConfig } from '@open-dcp/angular-services';
import { runtimeConfig } from './runtime-config';

@NgModule({
  providers: [...provideRuntimeConfig(runtimeConfig)],
})
export class AppModule {}
```

The same providers work in a standalone application's `providers` array.
`provideRuntimeConfig()` provides `APP_CONFIG` and derives the existing `HttpConfig`
token (`gatewayUrl`) from it. `DcHttpConfig.apiUrl` is optional and deprecated
because `DcHttp` only uses `gatewayUrl`. It does **not** load the config or register
an `APP_INITIALIZER`. Config must already be loaded because other providers may
need it while Angular constructs the injector. `runtimeConfig.get()` and injection
before a successful load throw explicitly.

Register these providers in each app's injector, never in the shared platform
injector. Components can read the config with `inject(APP_CONFIG)` or
`@Inject(APP_CONFIG) config: DcpRuntimeConfig`.

### App-specific fields

Pass a typed parser as the second argument to validate and expose additional fields:

```typescript
import {
  createRuntimeConfigLoader,
  DcpRuntimeConfig,
  parseRuntimeConfig,
} from '@open-dcp/angular-services';

interface AppRuntimeConfig extends DcpRuntimeConfig {
  tenantId: string;
}

function parseAppConfig(raw: unknown, source: string): AppRuntimeConfig {
  const config = parseRuntimeConfig(raw, source);
  if (
    !raw || typeof raw !== 'object' || !('tenantId' in raw) ||
    typeof raw.tenantId !== 'string' || !raw.tenantId.trim()
  ) {
    throw new Error(`Missing tenantId in ${source}`);
  }
  return { ...config, tenantId: raw.tenantId };
}

const runtimeConfig = createRuntimeConfigLoader('https://cdn.example.com/app/config.json', parseAppConfig);
```

The loader's `load()` and `get()` infer `AppRuntimeConfig`. The shared `APP_CONFIG`
token retains the common `DcpRuntimeConfig` type.

### Asset URLs and deployment

Use `assetUrl(publicPath, 'i18n/')` for resources inside the bundle's `assets/`
directory, and `publicPathUrl(publicPath, 'config.json')` for resources beside the
bundle. Leading slashes on the resource are ignored so paths stay bundle-relative.
Neither helper reads or writes `__webpack_public_path__`; supply the app's value.

Each app still owns its `config.example.json`, local ignored `config.json`, Angular
asset-copy rule, webpack configuration and deployment-time config generation.
For the SystemJS/webpack setup above, leave webpack's output public path empty
and set it with the first-import shim; do not replace it with `publicPath: 'auto'`.
