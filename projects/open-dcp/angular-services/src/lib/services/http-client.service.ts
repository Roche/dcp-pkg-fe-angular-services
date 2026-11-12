import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Inject, Injectable, InjectionToken, OnDestroy, Optional } from '@angular/core';
import { uiStore, userStore } from '@open-dcp/services';
import { EMPTY, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface DcHttpConfig {
  apiUrl: string;
  gatewayUrl: string;
}

export const HttpConfig = new InjectionToken<DcHttpConfig>('HttpConfig');

@Injectable({
  providedIn: 'root',
})
export class DcHttp implements OnDestroy {

  /**
   * True while THIS app is being torn down (single-spa unmount / app shutdown)
   * or the whole page is unloading. While set, aborted (status 0) requests are
   * swallowed silently instead of surfacing a bogus toast + uncaught error.
   *
   * It is per-app on purpose: each micro-frontend bundles its own DcHttp (its own
   * class statics), and the flag is driven by this app's own Angular lifecycle —
   * so one app unmounting never affects another app mounted on the same screen.
   */
  private static pageIsUnloading = false;
  private static unloadBound = false;

  constructor(
    @Optional() @Inject(HttpConfig) private config: DcHttpConfig,
    private readonly http: HttpClient
  ) {
    // A new instance means this app is (re)mounting — clear any teardown flag
    // left over from a previous unmount of the same (re-used) bundle.
    DcHttp.pageIsUnloading = false;
    DcHttp.bindUnloadListeners();
  }

  /**
   * Called when THIS app's Angular injector is destroyed — i.e. single-spa
   * unmounts this specific app (or it shuts down). This is how DcHttp knows the
   * teardown is for *this* app, rather than reacting to a global event that could
   * also fire for other apps mounted at the same time.
   */
  ngOnDestroy(): void {
    DcHttp.pageIsUnloading = true;
    DcHttp.clearLoadingState();
  }

  /**
   * On teardown, any in-flight requests are cancelled, so the matching
   * uiStore.removeLoading(key) calls never run and the shared (shell) loading
   * spinner stays stuck after this app unmounts. Clear every remaining loading
   * key so the spinner is reset out of the box for every consuming app.
   */
  private static clearLoadingState(): void {
    const loading = (uiStore.getState?.() as any)?.loading;
    if (loading && typeof loading === 'object') {
      Object.keys(loading).forEach(key => uiStore.removeLoading(key));
    }
  }

  /**
   * Manual override for non-standard shells. Not needed in a standard single-spa
   * setup — teardown is detected automatically via the Angular destroy lifecycle
   * (ngOnDestroy) and the page unload events.
   */
  static setUnloading(value: boolean): void {
    DcHttp.pageIsUnloading = value;
  }

  /**
   * Heuristic for Angular runtime errors that indicate the app is being torn
   * down (injector destroyed / view already destroyed). An in-flight effect can
   * keep running during single-spa unmount and touch the destroyed injector,
   * producing NG0205 "Injector has already been destroyed" (or NG0911). These
   * are not server errors, so they should be swallowed rather than surfaced as a
   * generic error toast.
   */
  private static isTeardownError(res: any): boolean {
    if (res?.code === 205) {
      return true;
    }
    const text = (res?.message ?? res?.toString?.() ?? '') as string;
    return /NG0205|NG0911|Injector has already been destroyed|destroyed view/i.test(text);
  }

  private static bindUnloadListeners(): void {
    if (DcHttp.unloadBound || typeof window === 'undefined') {
      return;
    }
    DcHttp.unloadBound = true;

    // Full page teardown: hard redirect, reload, tab/window close. Suppressing
    // for every request here is correct — the whole page is going away.
    const mark = () => { DcHttp.pageIsUnloading = true; };
    window.addEventListener('pagehide', mark);
    window.addEventListener('beforeunload', mark);
  }

  gatewayModuleUrl(module: string): string {
    return `${this.config.gatewayUrl}/${module}`;
  }

  createAuthorizationHeader(headers: HttpHeaders) {
    const token = userStore.getState().token;
    return headers.append('Authorization', `Bearer ${token}`);
  }

  get(url: string, options = { headers: new HttpHeaders() }): Observable<any> {
    options.headers = this.createAuthorizationHeader(options.headers);
    return this.http.get<any>(url, options).pipe(catchError(this.handleError));
  }

  getWebWorker(
    url: string,
    options = { headers: new HttpHeaders() }
  ): Observable<any> {
    options.headers = this.createAuthorizationHeader(options.headers);
    return this.http.get<any>(url, options).pipe(catchError(this.handleError));
  }

  post(
    url: string,
    data: any,
    options = { headers: new HttpHeaders() }
  ): Observable<any> {
    options.headers = this.createAuthorizationHeader(options.headers);
    return this.http.post<any>(url, data, options).pipe(catchError(this.handleError));
  }

  put(
    url: string,
    data: any,
    options = { headers: new HttpHeaders() }
  ): Observable<any> {
    options.headers = this.createAuthorizationHeader(options.headers);
    return this.http.put<any>(url, data, options).pipe(catchError(this.handleError));
  }

  delete(url: string, options = { headers: new HttpHeaders() }) {
    options.headers = this.createAuthorizationHeader(options.headers);
    return this.http.delete(url, options).pipe(catchError(this.handleError));
  }

  handleError = (res: HttpErrorResponse) => {
    // Not an HttpErrorResponse at all. This happens during navigation /
    // single-spa unmount when an in-flight effect keeps running and touches the
    // injector AFTER it was destroyed -> Angular throws NG0205 "Injector has
    // already been destroyed" (or a destroyed-view error). These are not server
    // errors and are not actionable, so don't show the generic toast.
    if (!(res instanceof HttpErrorResponse)) {
      if (DcHttp.pageIsUnloading || DcHttp.isTeardownError(res)) {
        // Tearing down -> swallow silently (no toast, no uncaught error).
        return EMPTY;
      }
      // Anything else that isn't an HTTP error: surface it so real bugs are not
      // hidden behind a generic "There is an error".
      return throwError(() => res);
    }

    // status 0 = the request never reached/returned from the server: it was
    // aborted (navigation to another app / unmount / hard redirect / tab close),
    // or it's a network/CORS failure. There is no actionable server message, so
    // the generic "There is an error" toast is just noise.
    if (res?.status === 0) {
      // While the page/app is tearing down, swallow silently so there is no
      // toast and no uncaught error for requests the browser is aborting.
      if (DcHttp.pageIsUnloading) {
        return EMPTY;
      }
      // Genuine network failure while the app is alive: propagate so callers can
      // react, but don't show the unhelpful generic toast.
      return throwError(() => res);
    }

    const error = this.parseErrorMessage(res.error);

    let message = '';

    if (error?.errors) {
      message = this.buildPHPErrorMessages(error?.errors);
      return throwError(new Error(message));
    }

    if (error?.info?.text) {
      message = error?.info?.text;
      uiStore.setMessage('error', message);
      return throwError(new Error(message));
    }

    message = error?.Message ? error?.Message : 'There is an error';

    uiStore.setMessage('error', message);
    return throwError(new Error(message));
  }

  buildPHPErrorMessages(errors: { [key: string]: string} = {}) {

    const defaultMessage = 'There is an error';

    Object.values(errors).forEach( message => {
      uiStore.setMessage('error', message[0] || defaultMessage);
    });
    return defaultMessage;
  }

  parseErrorMessage(error: any) {
    try {
      return JSON.parse(error);
    } catch (e) {
      return error;
    }
  }
}
