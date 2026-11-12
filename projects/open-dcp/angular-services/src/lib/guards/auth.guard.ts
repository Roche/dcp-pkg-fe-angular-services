import { Injectable } from '@angular/core';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import {uiStore, userStore} from "@open-dcp/services";

@Injectable()
export class AuthGuard  {

  constructor(
    private readonly router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    if (userStore.getState().token) {
      // logged in so return true
      return true;
    }

    // Populate store.ui.redirectTo based on current url,
    // so it can be used for redirect after user login
    const href = window.location.href;
    const host = window.location.host;
    const hostLength = host.length;
    const startIndex = href.indexOf(host) + hostLength;
    const url = href.substr(startIndex);
    if (url && url !== '/app' && url !== '/') {
      uiStore.setRedirectTo(url);
    }

    // not logged in so redirect to login page with the return url
    this.router.navigate(['/login']);
    return false;
  }
}
