# AGENTS.md - Angular Services

## Project Overview

**@open-dcp/angular-services** is a **collection of Angular HTTP interceptors, guards, and service utilities** that integrate the Open DCP core services (`@open-dcp/services`) with Angular's dependency injection system. It handles authentication, authorization, GXP compliance tracking, and site context management.

## Architecture

### Project Structure
```
angular-services/
├── projects/open-dcp/angular-services/src/
│   ├── lib/
│   │   ├── interceptors/       # HTTP interceptors
│   │   ├── guards/             # Route guards
│   │   ├── services/           # HTTP client wrapper
│   │   └── shared/             # Shared utilities
│   ├── interceptors.ts         # Interceptor exports
│   ├── guards.ts               # Guard exports
│   ├── services.ts             # Service exports
│   ├── public-api.ts           # Main entry point
│   └── shared.ts               # Shared exports
├── angular.json
└── package.json
```

### Core Components

#### HTTP Interceptors
```
Interceptor Chain (execution order):
1. AuthorizationInterceptor
   ├── Inject Bearer token from userStore.getState().token
   └── Set Authorization header

2. SiteIdInterceptor
   ├── Subscribe to uiStore.currentSite
   └── Add siteId to query params or payload

3. GxpInfoInterceptor
   ├── Register app in gxpStore
   └── Track request history (compliance)

4. NonAuthInterceptor
   ├── Catch 401 errors
   └── Call userStore.logout()
```

#### Route Guards
```
GlobalContextGuard
  - Disables site selection
  - Sets route context to /global/

SiteContextGuard
  - Verifies site is selected
  - Blocks navigation if no site context
```

#### HTTP Services
```
HttpClientService (wrapper)
  - Wrapper around Angular HttpClient
  - Pre-configured interceptors
  - Error handling via uiStore.setMessage()
```

## Interceptors

### 1. AuthorizationInterceptor
Injects JWT Bearer token from userStore:

```typescript
@Injectable()
export class AuthorizationInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler):
    Observable<HttpEvent<any>> {
    const token = userStore.getState().token;
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next.handle(authReq);
  }
}
```

**When to use**: Always needed for authenticated APIs

### 2. SiteIdInterceptor
Adds siteId from uiStore to requests (excludes .json files, GetUserSite, SetUserSite):

```typescript
@Injectable()
export class SiteIdInterceptor implements HttpInterceptor {
  constructor(@Inject(SITE_ID_INTERCEPTOR_FORMAT) private format: string) {
    // format: 'siteId' (query param) or 'body' (payload field)
  }

  intercept(req: HttpRequest<any>, next: HttpHandler):
    Observable<HttpEvent<any>> {
    const siteId = uiStore.getState().currentSite?.id;
    
    if (this.format === 'siteId') {
      req = req.clone({
        params: req.params.set('siteId', siteId)
      });
    }
    return next.handle(req);
  }
}
```

**Requires provider**:
```typescript
{ 
  provide: SITE_ID_INTERCEPTOR_FORMAT, 
  useValue: 'siteId'  // or 'body'
}
```

### 3. GxpInfoInterceptor
Registers app with gxpStore and tracks compliance requests:

```typescript
@Injectable()
export class GxpInfoInterceptor implements HttpInterceptor, OnDestroy {
  constructor(
    @Optional() @Inject(GxpApp) private appData: GxpAppData
  ) {
    // appData: { name, isValidated, version }
    gxpStore.registerApp(this.appData.name, this.appData.isValidated);
  }

  intercept(req: HttpRequest<any>, next: HttpHandler):
    Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      map(event => {
        if (event instanceof HttpResponse) {
          // Track successful request
          gxpStore.addRequestHistoryEntry(this.appData.name, {
            url: req.url,
            method: req.method,
            backend: true,
            tag: 'data-fetch'
          });
        }
        return event;
      })
    );
  }

  ngOnDestroy() {
    gxpStore.unregisterApp(this.appData.name);
  }
}
```

**Requires provider**:
```typescript
{ 
  provide: GxpApp, 
  useValue: { 
    name: 'myApp', 
    isValidated: true, 
    version: '1.0.0' 
  } 
}
```

### 4. NonAuthInterceptor
Catches 401 errors and logs out:

```typescript
@Injectable()
export class NonAuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler):
    Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError(err => {
        if (err instanceof HttpErrorResponse && err.status === 401) {
          userStore.logout();
        }
        return throwError(() => err);
      })
    );
  }
}
```

## Guards

### GlobalContextGuard
Disables site selection and sets context to /global/:

```typescript
@Injectable()
export class GlobalContextGuard {
  constructor(private router: Router) {
    uiStore.disableSiteSelection();
  }

  ngOnDestroy() {
    uiStore.enableSiteSelection();
  }
}
```

**Usage in routing**:
```typescript
{
  path: ':siteContext/:menu/module',
  canActivate: [GlobalContextGuard],  // Sets context = /global/
  loadChildren: () => import('./module').then(m => m.Module)
}
```

## HTTP Client Service

Wrapper around Angular HttpClient with built-in error handling:

```typescript
@Injectable()
export class HttpClientService {
  constructor(private http: HttpClient) {}

  get(url: string, options?: any): Observable<any> {
    return this.http.get(url, options).pipe(
      catchError(this.handleError)
    );
  }

  post(url: string, data: any, options?: any): Observable<any> {
    return this.http.post(url, data, options).pipe(
      catchError(this.handleError)
    );
  }

  private handleError = (res: HttpErrorResponse) => {
    if (res.error?.errors) {
      // PHP-style errors: { errors: { field: 'message' } }
      const message = this.buildErrorMessages(res.error.errors);
      uiStore.setMessage('error', message);
    } else if (res.error?.info?.text) {
      uiStore.setMessage('error', res.error.info.text);
    }
    return throwError(() => new Error(message));
  }
}
```

## App Module Setup

### Interceptor Configuration
```typescript
import { ApplicationConfig } from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import {
  AuthorizationInterceptor,
  SiteIdInterceptor,
  GxpInfoInterceptor,
  NonAuthInterceptor,
  SITE_ID_INTERCEPTOR_FORMAT,
  GxpApp
} from '@open-dcp/angular-services';

export const appConfig: ApplicationConfig = {
  providers: [
    // Interceptors (order matters)
    { provide: HTTP_INTERCEPTORS, useClass: AuthorizationInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: SiteIdInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: GxpInfoInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: NonAuthInterceptor, multi: true },

    // Interceptor configuration
    { provide: SITE_ID_INTERCEPTOR_FORMAT, useValue: 'siteId' },
    { 
      provide: GxpApp, 
      useValue: { 
        name: 'myDashboard', 
        isValidated: true, 
        version: '17.0.0' 
      } 
    },

    // Guards (optional)
    GlobalContextGuard
  ]
};

bootstrapApplication(AppComponent, appConfig);
```

## Developer Workflow

### Build & Test
```bash
npm install
npm run watch              # ng build --watch
npm run build              # ng build (production)
npm test                   # Karma + Jasmine
```

### Testing Interceptors
```typescript
describe('AuthorizationInterceptor', () => {
  let httpMock: HttpTestingController;
  let interceptor: AuthorizationInterceptor;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthorizationInterceptor]
    });
    httpMock = TestBed.inject(HttpTestingController);
    interceptor = TestBed.inject(AuthorizationInterceptor);
  });

  it('should add Authorization header', () => {
    const testRequest = httpMock.expectOne('/api/data');
    expect(testRequest.request.headers.has('Authorization')).toBe(true);
    expect(testRequest.request.headers.get('Authorization')).toBe('Bearer token');
    testRequest.flush({});
  });
});
```

## Common Integration Patterns

### 1. **Global API Error Handling**
All errors automatically set uiStore message:
```typescript
// In component
this.httpService.get('/api/users').subscribe(
  data => console.log(data),
  // Error already displayed via uiStore by interceptor
);
```

### 2. **Site Context Routing**
```typescript
// Route structure respects site context
/app/:siteContext/:menu/module  // siteContext = siteId or 'global'

// Navigate with site
this.router.navigate(['/app', 1, 'dashboard', 'data']);  // siteId = 1
```

### 3. **GXP Compliance Tracking**
```typescript
// Automatically tracked by GxpInfoInterceptor
const history = gxpStore.getRequestHistory('myApp');
// [{ url: '/api/data', method: 'GET', timestamp: ..., tag: 'data-fetch' }, ...]
```

## Pitfalls & Solutions

| Issue | Solution |
|-------|----------|
| Token not injected in requests | Verify `userStore.getState().token` is set; check interceptor order (AuthorizationInterceptor first) |
| SiteId not added to requests | Provide `SITE_ID_INTERCEPTOR_FORMAT` token; verify uiStore.currentSite is set |
| 401 errors not logging out | Ensure `NonAuthInterceptor` is registered (last in chain) |
| GXP tracking not working | Provide `GxpApp` token with app name; check gxpStore.registerApp called |
| Guards not preventing navigation | Verify guard is in `canActivate` array; check guard provider registered |

## References

- **Interceptors**: `projects/open-dcp/angular-services/src/lib/interceptors/`
- **Guards**: `projects/open-dcp/angular-services/src/lib/guards/`
- **Services**: `projects/open-dcp/angular-services/src/lib/services/`
- **Core stores**: `@open-dcp/services` (userStore, uiStore, gxpStore)
- **Angular HTTP**: https://angular.io/guide/http

