import {Injectable} from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import {uiStore} from "@open-dcp/services";
import {ActiveModules} from "@open-dcp/services/dist/types/stores";
import {Subscription} from "rxjs";
/**
 * To use this guard need to add also data.moduleName in router, which will be checked to be present in store.ui.activeModules
 */
@Injectable()
export class IsModuleActiveGuard  {

  subscription = new Subscription();

  constructor(private readonly router: Router) { }

  async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const activeModules =  await this.getActiveModules();
    const result = !(
      route.data['moduleName']
      && activeModules.findIndex(activeModule => (activeModule.name === route.data['moduleName'] && activeModule.enabled)) === -1
    );
    if (!result) {
      const siteContext = uiStore.getState().site.id;
      this.router.navigate([`app`, siteContext, `dashboard`]);
    }
    return result;
  }

  async getActiveModules(): Promise<ActiveModules[]> {
    return new Promise(resolve => {
      this.subscription.add(uiStore.subscribe(state => {
        if (state.activeModules.length > 0) {
          resolve(state.activeModules);
          this.subscription.unsubscribe();
        }
      }));
    });
  }
}
