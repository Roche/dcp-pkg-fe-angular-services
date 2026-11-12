import {Injectable, NgZone} from '@angular/core';
import {NgxPermissionsService} from 'ngx-permissions';
import {uiStore, userStore} from "@open-dcp/services";

/**
 * Service responsible for managing and synchronizing user permissions
 * within the application based on the currently active site.
 *
 * It listens to changes in both the `userStore` (permissions) and the `uiStore` (site),
 * and reloads the NgxPermissions permission set whenever either changes.
 *
 * ---
 *
 * ## Setup
 *
 * This service is provided at root level (`providedIn: 'root'`), so **no manual
 * registration in any `NgModule` or `ApplicationConfig` providers array is needed**.
 *
 * However, because Angular services are lazy by default, the service will not
 * instantiate (and therefore will not set up its store subscriptions) until something
 * first injects it. You must eagerly inject it in your root component or app
 * initializer to guarantee it starts listening from application boot.
 *
 * ### Option 1 – Inject in the root `AppComponent` (recommended)
 *
 * ```typescript
 * // app.component.ts
 * import { Component } from '@angular/core';
 * import { OdcpPermissionsService } from '@open-dcp/angular-services';
 *
 * @Component({
 * selector: 'app-root',
 * templateUrl: './app.component.html',
 * })
 * export class AppComponent {
 * // Injecting the service here forces Angular to instantiate it
 * // at application start, activating all store subscriptions.
 * constructor(private readonly _permissions: OdcpPermissionsService) {}
 * }
 */
@Injectable({
  providedIn: 'root'
})
export class OdcpPermissionsService {

  /**
   *  Tracks the site ID for which permissions were last loaded,
   *  to avoid redundant permission reloads for the same site.
   */
  private lastLoadedSiteId: null | number = null;

  /**
   * Creates an instance of `OdcpPermissionsService` and sets up
   * reactive subscriptions to both the `userStore` and `uiStore`.
   *
   * - When the user's permissions change in `userStore`, permissions are
   * re-initialized for the currently active site (if available).
   * - When the active site changes in `uiStore`, permissions are
   * re-initialized for the new site (if available).
   *
   * All store callbacks are executed inside Angular's `NgZone` to ensure
   * proper change detection.
   *
   * @param permissionsService - The NgxPermissionsService used to load/flush permissions.
   * @param ngZone - Angular's NgZone, used to run store callbacks inside the Angular zone.
   *
   */
  constructor(
    private readonly permissionsService: NgxPermissionsService,
    private readonly ngZone: NgZone
  ) {
    const siteId = uiStore.getState().site?.id;
    if (typeof siteId === 'number') {
      this.initPermissions(siteId);
    }
    userStore.subscribe('permissions', permissions => {
      this.ngZone.run(() => {
        const site = uiStore.getState().site;
        if (!site || site?.id === null || site?.id === undefined) {
          return;
        }
        this.initPermissions(site?.id);
      })
    });
    uiStore.subscribe('site', site => {
      this.ngZone.run(() => {
        if (!site || site?.id === null || site?.id === undefined) {
          return;
        }
        this.initPermissions(site?.id);
      })
    });
  }

  /**
   *  Loads the permissions for the given site into NgxPermissionsService.
   *
   *  This method is a no-op if the provided `siteId` matches the last loaded
   *  site ID, preventing unnecessary permission reloads.
   *
   *  If valid permissions are found for the site, all existing permissions are
   *  flushed and replaced with the new set. If no valid permissions are found,
   *  all permissions are flushed and none are loaded.
   *
   *  @param siteId - The numeric ID of the site for which to load permissions.
   */
  initPermissions(siteId: number): void {
    if (siteId === this.lastLoadedSiteId) {
      return;
    }
    this.lastLoadedSiteId = siteId;
    const permissions = userStore.getPermissionsPerSite(siteId);
    if (permissions && Array.isArray(permissions)) {
      this.permissionsService.flushPermissions();
      this.permissionsService.loadPermissions(permissions);
    } else {
      this.permissionsService.flushPermissions();
    }
  }
}
