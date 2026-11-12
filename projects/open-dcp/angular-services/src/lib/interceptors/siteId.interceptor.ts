import {Inject, Injectable, InjectionToken, OnDestroy} from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable, Subject, Subscription} from 'rxjs';
import {takeUntil} from "rxjs/operators";
import {uiStore} from "@open-dcp/services";

export const SITE_ID_INTERCEPTOR_FORMAT = new InjectionToken<string>('Site Id interceptor format');


/**
 * HTTP Interceptor that add site id to pyload or query params excluding API calls for .json files, GetUserSite and SetUserSite
 * To be used in the app module need to be added provider for SITE_ID_INTERCEPTOR_FORMAT depending on BE implementation
 * @example:
 * {
 *   provide: SITE_ID_INTERCEPTOR_FORMAT,
 *   useValue: 'siteId'
 * }
 */
@Injectable()
export class SiteIdInterceptor implements HttpInterceptor, OnDestroy {

  private siteIdFormat: string;

  private siteId = 0;

  private siteIdSubscription = new Subscription();

  private cancelSubscription = new Subject<void>();

  constructor(
    @Inject(SITE_ID_INTERCEPTOR_FORMAT) siteIdFormat: string
  ) {
    if (siteIdFormat === undefined) {
      throw new Error('SITE_ID_INTERCEPTOR_FORMAT is not defined');
    }
    this.siteIdFormat = siteIdFormat;
    this.subscribeToSiteId();
  }

  ngOnDestroy() {
    this.cancelSubscription.next();
    this.cancelSubscription.complete();
    this.siteIdSubscription.unsubscribe();
  }

  intercept(req: HttpRequest<any>, next: HttpHandler):
    Observable<HttpEvent<any>> {
    const siteId = uiStore.getState().site?.id || 0;
    this.checkSiteId(siteId);

    if (siteId && !this.shouldSkipSiteId(req.url)) {
      return next.handle(this.addSiteId(req, siteId)).pipe(takeUntil(this.cancelSubscription));
    }
// send the cloned, "secure" request to the next handler.
    return next.handle(req);
  }

  private addSiteId(req: HttpRequest<any>, siteId: number): HttpRequest<any> {
    if (this.siteIdFormat === 'body') {
      return this.addSiteIdToBody(req, siteId);
    }

    if (req.params.has(this.siteIdFormat)) {
      return req;
    }

    return req.clone({
      setParams: {
        [this.siteIdFormat]: String(siteId),
      }
    });
  }

  private addSiteIdToBody(req: HttpRequest<any>, siteId: number): HttpRequest<any> {
    if (!this.canUseBodySiteId(req) || this.bodyAlreadyContainsSiteId(req.body)) {
      return req;
    }

    return req.clone({
      body: {
        ...req.body,
        siteId,
      }
    });
  }

  private canUseBodySiteId(req: HttpRequest<any>) {
    return (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')
      && this.isPlainObject(req.body);
  }

  private bodyAlreadyContainsSiteId(body: Record<string, unknown>) {
    return Object.prototype.hasOwnProperty.call(body, 'siteId');
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null
      && typeof value === 'object'
      && !(value instanceof FormData)
      && !(value instanceof Blob)
      && !(value instanceof ArrayBuffer);
  }

  private shouldSkipSiteId(url: string) {
    return url.endsWith('.json')
      || url.includes('GetUserSite')
      || url.includes('SetUserSite');
  }

  private checkSiteId(siteId: number) {
    if (this.siteId === siteId) {
      return;
    }
    this.siteId = siteId;
    this.cancelSubscription.next();
  }

  private subscribeToSiteId() {
    this.siteIdSubscription.add(
      uiStore.subscribe('site', site => this.checkSiteId(site?.id || 0))
    );
  }
}
