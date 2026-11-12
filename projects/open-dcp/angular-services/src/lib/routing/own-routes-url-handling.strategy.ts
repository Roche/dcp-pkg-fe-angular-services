import { Provider } from '@angular/core';
import { UrlHandlingStrategy, UrlTree } from '@angular/router';
/**
 * Configuration for {@link OwnRoutesUrlHandlingStrategy}.
 */
export interface OwnRoutesConfig {
  /**
   * The URL patterns this micro-frontend OWNS and whose navigations its Angular
   * Router should process. A URL is processed when it matches ANY entry:
   *  - `string` -> substring match via `String.includes` (e.g. "/menu/my-favorites")
   *  - `RegExp` -> `RegExp.test`
   *
   * Everything else is ignored, so this router does not navigate or stamp a
   * `navigationId` into the shared `window.history.state` for routes owned by
   * OTHER single-spa Angular applications.
   */
  own: ReadonlyArray<string | RegExp>;
  /**
   * Also process the root URL (`""` / `"/"`) - usually needed when the app has a
   * `{ path: "", redirectTo: ... }` route. Defaults to `true`.
   */
  includeRoot?: boolean;
}
/**
 * A `UrlHandlingStrategy` for single-spa micro-frontends.
 *
 * In a single-spa setup several Angular applications are mounted at once and
 * share ONE `window.history`. Each Angular `Router` (typically with a
 * `{ path: "**" }` catch-all, as the single-spa-angular docs recommend) would
 * otherwise process EVERY url change and write its own `navigationId` into the
 * shared `history.state` - so two mounted apps corrupt each other's history
 * restoration and can ping-pong between routes.
 *
 * This strategy makes a router process ONLY the URLs the app actually owns and
 * ignore the rest. Keep the `{ path: "**", component: EmptyRouteComponent }`
 * route (it still prevents 404s during single-spa transitions); this simply
 * stops the router from ACTING on foreign URLs.
 */
export class OwnRoutesUrlHandlingStrategy implements UrlHandlingStrategy {
  constructor(private readonly config: OwnRoutesConfig) {}
  shouldProcessUrl(url: UrlTree): boolean {
    const path = url.toString();
    if ((this.config.includeRoot ?? true) && (path === '' || path === '/')) {
      return true;
    }
    return this.config.own.some((matcher) =>
      typeof matcher === 'string' ? path.includes(matcher) : matcher.test(path)
    );
  }
  extract(url: UrlTree): UrlTree {
    return url;
  }
  merge(_newUrlPart: UrlTree, rawUrl: UrlTree): UrlTree {
    return rawUrl;
  }
}
/**
 * Provider that installs an {@link OwnRoutesUrlHandlingStrategy} for the app's
 * Router. Add it to your `RouterModule.forRoot(...)` providers (NgModule) or your
 * `provideRouter(...)` providers (standalone `bootstrapApplication`).
 *
 * @example NgModule
 * ```ts
 * providers: [ provideOwnRoutesUrlHandlingStrategy({ own: ["/menu/my-favorites"] }) ]
 * ```
 *
 * @example Standalone
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideRouter(routes),
 *     provideOwnRoutesUrlHandlingStrategy({ own: ["/menu/my-favorites"] }),
 *   ],
 * });
 * ```
 */
export function provideOwnRoutesUrlHandlingStrategy(config: OwnRoutesConfig): Provider {
  return {
    provide: UrlHandlingStrategy,
    useValue: new OwnRoutesUrlHandlingStrategy(config),
  };
}
/**
 * Provider for a SHELL micro-frontend that owns no routable content (e.g.
 * top-navigation, side-menu). Its router ignores every URL - it never navigates
 * or stamps a `navigationId`. Perform any navigation such shells need via
 * `history.pushState(...)` / single-spa so the owning app handles it.
 */
export function provideInertUrlHandlingStrategy(): Provider {
  return provideOwnRoutesUrlHandlingStrategy({ own: [], includeRoot: false });
}