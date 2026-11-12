import { NgZone } from '@angular/core';
import { NgxPermissionsService } from 'ngx-permissions';

jest.mock('@open-dcp/services', () => ({
  uiStore: {
    getState: jest.fn(),
    subscribe: jest.fn(),
  },
  userStore: {
    getPermissionsPerSite: jest.fn(),
    subscribe: jest.fn(),
  },
}));

import { uiStore, userStore } from '@open-dcp/services';
import { OdcpPermissionsService } from './odcp-permissions.service';

describe('OdcpPermissionsService', () => {
  let service: OdcpPermissionsService;
  let ngZone: NgZone;
  let permissionsServiceMock: jest.Mocked<Pick<NgxPermissionsService, 'flushPermissions' | 'loadPermissions'>>;
  const mockedUiStore = uiStore as jest.Mocked<typeof uiStore>;
  const mockedUserStore = userStore as jest.Mocked<typeof userStore>;

  let permissionsSubscriber: ((permissions: unknown) => void) | undefined;
  let siteSubscriber: ((site: { id?: number } | null | undefined) => void) | undefined;

  beforeEach(() => {
    ngZone = new NgZone({ enableLongStackTrace: false });

    permissionsServiceMock = {
      flushPermissions: jest.fn(),
      loadPermissions: jest.fn(),
    };

    mockedUserStore.subscribe.mockImplementation((storeField: any, callback?: any) => {
      if (storeField === 'permissions') {
        permissionsSubscriber = callback;
      }
      return () => undefined;
    });

    mockedUiStore.subscribe.mockImplementation((storeField: any, callback?: any) => {
      if (storeField === 'site') {
        siteSubscriber = callback as (site: { id?: number } | null | undefined) => void;
      }
      return () => undefined;
    });

    mockedUiStore.getState.mockReturnValue({
      site: { id: 42, name: 'Test Site', timeZone: 'UTC', utcOffset: 0 },
    } as never);

    mockedUserStore.getPermissionsPerSite.mockReturnValue(['READ', 'WRITE'] as never);

    service = new OdcpPermissionsService(
      permissionsServiceMock as unknown as NgxPermissionsService,
      ngZone
    );
  });

  afterEach(() => {
    permissionsSubscriber = undefined;
    siteSubscriber = undefined;
    jest.clearAllMocks();
  });

  it('subscribes to user permissions and initializes permissions for current site', () => {
    const initPermissionsSpy = jest.spyOn(service, 'initPermissions');

    permissionsSubscriber?.([]);

    expect(userStore.subscribe).toHaveBeenCalledWith('permissions', expect.any(Function));
    expect(initPermissionsSpy).toHaveBeenCalledWith(42);
    expect(permissionsServiceMock.flushPermissions).toHaveBeenCalled();
    expect(permissionsServiceMock.loadPermissions).toHaveBeenCalledWith(['READ', 'WRITE']);
  });

  it('subscribes to site changes and initializes permissions when site has an id', () => {
    const initPermissionsSpy = jest.spyOn(service, 'initPermissions');

    // Reset dedup counter so a different site id triggers a load
    (service as any).lastLoadedSiteId = 0;
    siteSubscriber?.({ id: 7 });

    expect(uiStore.subscribe).toHaveBeenCalledWith('site', expect.any(Function));
    expect(initPermissionsSpy).toHaveBeenCalledWith(7);
    expect(mockedUserStore.getPermissionsPerSite).toHaveBeenCalledWith(7);
  });

  it('does not initialize permissions when site is missing from state or event', () => {
    mockedUiStore.getState.mockReturnValue({ site: null } as never);
    mockedUserStore.getPermissionsPerSite.mockClear();
    permissionsServiceMock.flushPermissions.mockClear();
    const initPermissionsSpy = jest.spyOn(service, 'initPermissions');

    permissionsSubscriber?.([]);
    siteSubscriber?.({});
    siteSubscriber?.(undefined);

    expect(initPermissionsSpy).not.toHaveBeenCalled();
    expect(mockedUserStore.getPermissionsPerSite).not.toHaveBeenCalled();
    expect(permissionsServiceMock.flushPermissions).not.toHaveBeenCalled();
  });

  it('skips reloading permissions for the same site id', () => {
    mockedUserStore.getPermissionsPerSite.mockClear();
    permissionsServiceMock.flushPermissions.mockClear();
    permissionsServiceMock.loadPermissions.mockClear();

    service.initPermissions(101);
    service.initPermissions(101);

    expect(mockedUserStore.getPermissionsPerSite).toHaveBeenCalledTimes(1);
    expect(permissionsServiceMock.flushPermissions).toHaveBeenCalledTimes(1);
    expect(permissionsServiceMock.loadPermissions).toHaveBeenCalledTimes(1);
  });

  it('flushes permissions when no permission list is available for a site', () => {
    mockedUserStore.getPermissionsPerSite.mockReturnValue(undefined as never);
    permissionsServiceMock.flushPermissions.mockClear();
    permissionsServiceMock.loadPermissions.mockClear();

    service.initPermissions(202);

    expect(permissionsServiceMock.flushPermissions).toHaveBeenCalledTimes(1);
    expect(permissionsServiceMock.loadPermissions).not.toHaveBeenCalled();
  });
});



