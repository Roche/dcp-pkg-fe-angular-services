import { HttpEvent, HttpHandler, HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, firstValueFrom, of } from 'rxjs';

jest.mock('@open-dcp/services', () => ({
  uiStore: {
    getState: jest.fn(),
    subscribe: jest.fn(),
  },
}));

import { uiStore } from '@open-dcp/services';
import { SiteIdInterceptor } from './siteId.interceptor';

class MockHttpHandler implements HttpHandler {
  handledRequest?: HttpRequest<unknown>;

  handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    this.handledRequest = req;
    return of(new HttpResponse({ status: 200 }));
  }
}

describe('SiteIdInterceptor', () => {
  const mockedUiStore = uiStore as jest.Mocked<typeof uiStore>;

  beforeEach(() => {
    mockedUiStore.getState.mockReturnValue({ site: { id: 254 } } as never);
    mockedUiStore.subscribe.mockReturnValue(jest.fn());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('subscribes to site changes on construction', () => {
    new SiteIdInterceptor('siteId');

    expect(mockedUiStore.subscribe).toHaveBeenCalledWith('site', expect.any(Function));
  });

  it('preserves existing HttpParams and appends siteId', async () => {
    const interceptor = new SiteIdInterceptor('siteId');
    const next = new MockHttpHandler();
    const req = new HttpRequest('GET', '/api/data', null, {
      params: new HttpParams()
        .set('dashboardTabId', 'bd5464d6-367c-f111-912a-e070b1f88779')
        .set('intervals', '660')
        .set('dashboardsLastDataPoints[0].value', '2026-07-14T13:31:09.466Z')
        .set('dashboardsLastDataPoints[0].key', '24d264ba-517c-f111-912a-e070b1f88779'),
    });

    await firstValueFrom(interceptor.intercept(req, next));

    expect(next.handledRequest?.params.get('dashboardTabId')).toBe('bd5464d6-367c-f111-912a-e070b1f88779');
    expect(next.handledRequest?.params.get('intervals')).toBe('660');
    expect(next.handledRequest?.params.get('dashboardsLastDataPoints[0].value')).toBe('2026-07-14T13:31:09.466Z');
    expect(next.handledRequest?.params.get('dashboardsLastDataPoints[0].key')).toBe('24d264ba-517c-f111-912a-e070b1f88779');
    expect(next.handledRequest?.params.get('siteId')).toBe('254');
  });

  it('preserves existing query string values already present in the URL', async () => {
    const interceptor = new SiteIdInterceptor('siteId');
    const next = new MockHttpHandler();
    const req = new HttpRequest(
      'GET',
      '/api/data?dashboardTabId=bd5464d6-367c-f111-912a-e070b1f88779&intervals=578&dashboardsLastDataPoints[0].value=2026-07-14T13:31:09.466Z&dashboardsLastDataPoints[0].key=24d264ba-517c-f111-912a-e070b1f88779'
    );

    await firstValueFrom(interceptor.intercept(req, next));

    expect(next.handledRequest?.urlWithParams).toContain('dashboardTabId=bd5464d6-367c-f111-912a-e070b1f88779');
    expect(next.handledRequest?.urlWithParams).toContain('intervals=578');
    expect(next.handledRequest?.urlWithParams).toContain('dashboardsLastDataPoints[0].value=2026-07-14T13:31:09.466Z');
    expect(next.handledRequest?.urlWithParams).toContain('dashboardsLastDataPoints[0].key=24d264ba-517c-f111-912a-e070b1f88779');
    expect(next.handledRequest?.urlWithParams).toContain('siteId=254');
  });

  it('adds siteId to the request body when configured for body mode', async () => {
    const interceptor = new SiteIdInterceptor('body');
    const next = new MockHttpHandler();
    const req = new HttpRequest('POST', '/api/data', {
      dashboardTabId: 'bd5464d6-367c-f111-912a-e070b1f88779',
      dashboardsLastDataPoints: [
        {
          key: '24d264ba-517c-f111-912a-e070b1f88779',
          value: '2026-07-14T13:31:09.466Z',
        },
      ],
    });

    await firstValueFrom(interceptor.intercept(req, next));

    expect(next.handledRequest?.body).toEqual({
      dashboardTabId: 'bd5464d6-367c-f111-912a-e070b1f88779',
      dashboardsLastDataPoints: [
        {
          key: '24d264ba-517c-f111-912a-e070b1f88779',
          value: '2026-07-14T13:31:09.466Z',
        },
      ],
      siteId: 254,
    });
    expect(next.handledRequest?.params.has('siteId')).toBe(false);
  });

  it('does not add siteId for excluded endpoints or json assets', async () => {
    const interceptor = new SiteIdInterceptor('siteId');
    const next = new MockHttpHandler();

    await firstValueFrom(interceptor.intercept(new HttpRequest('GET', '/api/GetUserSite'), next));
    expect(next.handledRequest?.params.has('siteId')).toBe(false);

    await firstValueFrom(interceptor.intercept(new HttpRequest('GET', '/assets/i18n/en.json'), next));
    expect(next.handledRequest?.params.has('siteId')).toBe(false);
  });
});


