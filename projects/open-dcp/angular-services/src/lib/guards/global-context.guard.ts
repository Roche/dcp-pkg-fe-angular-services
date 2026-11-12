import {Injectable, OnDestroy} from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import {uiStore} from '@open-dcp/services';
/**
 * Guard can be used when the application should use Global Context and not Site Context
 *
 * GlobalContextGuard will change url /:siteContext/ parameter to /global/ and will disable
 * Site Selection on load and will enable it On Destroy
 *
 * @usage:
 *
 * inside app-routing:
 *
 * {
 *   path: 'app',
 *   canActivate: [],
 *   children: [
 *     {
 *       path: ':siteContext/:menu/module',
 *       loadChildren: () => import('./app-routing/app-routing.module').then(m => m.AppRoutingModule),
 *       canActivate: [...., GlobalContextGuard]
 *     }
 *   ]
 * }
 *
 * ......
 *
 * providers: [
 *   ...
 *   GlobalContextGuard
 * ]
 *
 */
@Injectable()
export class GlobalContextGuard  implements OnDestroy {

  constructor(
    private readonly router: Router
  ) {
    uiStore.disableSiteSelection();
  }

  ngOnDestroy() {
    uiStore.enableSiteSelection();
  }

  async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    if (route.params['siteContext'] !== undefined && route.params['siteContext'] !== 'global') {
      return this.router.navigate([
        state.url.replace(`/${route.params['siteContext']}/`, '/global/')
      ]);
    }

    return true;
  }
}
