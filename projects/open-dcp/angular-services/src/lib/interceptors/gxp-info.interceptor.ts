import {Inject, Injectable, InjectionToken, OnDestroy, Optional} from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {gxpStore} from "@open-dcp/services";

export interface GxpAppData {
  name: string;
  isValidated: boolean;
  version?: string;
}

export const GxpApp = new InjectionToken<GxpAppData>('GxpApp');

@Injectable()
export class GxpInfoInterceptor implements HttpInterceptor, OnDestroy {

  constructor(
    @Optional() @Inject(GxpApp) private appData: GxpAppData,
  ) {
    if (gxpStore.getAppNames().includes(this.appData.name)) {
      this.ngOnDestroy();
    }
    gxpStore.registerApp(this.appData.name, this.appData.isValidated);
  }

  ngOnDestroy() {
    gxpStore.unregisterApp(this.appData.name);
  }

  intercept(req: HttpRequest<any>, next: HttpHandler):
    Observable<HttpEvent<any>> {
    return next.handle(req).pipe(map((event: HttpEvent<any>) => {
      if (
        event instanceof HttpResponse
        && event.headers && event.headers.get('isvalidated')
        // Skip the first GetGlobalFilter API response if the user doesn't have any selected filter yet
        && (!event.url || !event.url.endsWith('GetGlobalFilter'))
      ) {
        const isValidatedArr = event?.headers?.get('isvalidated')?.split(',')?.map(el => {
          switch (el.trim().toLowerCase()) {
            case 'true':
              return true;
            case 'false':
              return false;
            default:
              return undefined;
          }
        }) || [undefined, undefined, undefined, undefined];

        gxpStore.addRequestHistoryEntry(this.appData.name, {
          url: event.url || '',
          method: '',
          backend: isValidatedArr[0],
          dataSource: isValidatedArr[1],
          calculationEngine: isValidatedArr[2],
          entity: isValidatedArr[3]
        });
      }
      return event;
    }));
  }
}
