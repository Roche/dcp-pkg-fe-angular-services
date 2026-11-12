jest.mock('@open-dcp/services', () => ({
  uiStore: {
    setMessage: jest.fn(),
    getState: jest.fn(),
    removeLoading: jest.fn(),
  },
  userStore: {
    getState: jest.fn(() => ({ token: '' })),
  },
}));

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { uiStore } from '@open-dcp/services';
import { DcHttp } from './http-client.service';

interface HandleErrorResult {
  completed: boolean;
  error?: any;
  emitted: boolean;
  value?: any;
}

describe('DcHttp.handleError', () => {
  let service: DcHttp;
  const mockedUiStore = uiStore as jest.Mocked<typeof uiStore>;

  beforeEach(() => {
    service = new DcHttp(null as unknown as any, {} as HttpClient);
    DcHttp.setUnloading(false);
  });

  afterEach(() => {
    DcHttp.setUnloading(false);
    jest.clearAllMocks();
  });

  function run(res: HttpErrorResponse): Promise<HandleErrorResult> {
    return new Promise(resolve => {
      let value: any;
      let emitted = false;
      service.handleError(res).subscribe({
        next: v => { value = v; emitted = true; },
        error: err => resolve({ completed: false, error: err, emitted, value }),
        complete: () => resolve({ completed: true, emitted, value }),
      });
    });
  }

  it('swallows aborted (status 0) requests silently while the app is unloading', async () => {
    DcHttp.setUnloading(true);

    const res = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });
    const result = await run(res);

    expect(result.completed).toBe(true);
    expect(result.emitted).toBe(false);
    expect(mockedUiStore.setMessage).not.toHaveBeenCalled();
  });

  it('propagates a status 0 error without a toast when the app is alive', async () => {
    const res = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });
    const result = await run(res);

    expect(result.completed).toBe(false);
    expect(result.error).toBe(res);
    expect(mockedUiStore.setMessage).not.toHaveBeenCalled();
  });

  it('shows a toast and rethrows for a server error carrying a Message', async () => {
    const res = new HttpErrorResponse({ status: 500, error: JSON.stringify({ Message: 'Boom' }) });
    const result = await run(res);

    expect(result.completed).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('Boom');
    expect(mockedUiStore.setMessage).toHaveBeenCalledWith('error', 'Boom');
  });

  it('falls back to the generic message for an unparseable server error', async () => {
    const res = new HttpErrorResponse({ status: 500, error: 'not json' });
    const result = await run(res);

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('There is an error');
    expect(mockedUiStore.setMessage).toHaveBeenCalledWith('error', 'There is an error');
  });

  it('setUnloading toggles the teardown window', async () => {
    const res = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });

    DcHttp.setUnloading(true);
    expect((await run(res)).completed).toBe(true);

    DcHttp.setUnloading(false);
    expect((await run(res)).completed).toBe(false);
  });

  it('suppresses aborted errors once THIS app is destroyed (single-spa unmount)', async () => {
    const res = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });

    // app is alive -> error propagates
    expect((await run(res)).completed).toBe(false);

    // this app's injector is destroyed -> swallow silently, no toast
    service.ngOnDestroy();
    const result = await run(res);
    expect(result.completed).toBe(true);
    expect(mockedUiStore.setMessage).not.toHaveBeenCalled();
  });

  it('a newly constructed instance (re-mount) clears a prior teardown flag', async () => {
    service.ngOnDestroy(); // flag = true

    // re-mounting creates a fresh DcHttp, which resets the flag in its constructor
    const remounted = new DcHttp(null as unknown as any, {} as HttpClient);
    expect(remounted).toBeInstanceOf(DcHttp);

    const res = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });
    expect((await run(res)).completed).toBe(false);
  });

  it('swallows a non-HTTP teardown error (NG0205 injector destroyed) silently', async () => {
    // Simulate an effect touching the injector after unmount.
    const ng0205: any = new Error('NG0205: Injector has already been destroyed.');
    ng0205.code = 205;

    const result = await run(ng0205);

    expect(result.completed).toBe(true);
    expect(result.emitted).toBe(false);
    expect(mockedUiStore.setMessage).not.toHaveBeenCalled();
  });

  it('swallows a non-HTTP teardown error detected by message when unloading', async () => {
    DcHttp.setUnloading(true);
    const err: any = new Error('NG0911: The provided value for a destroyed view');

    const result = await run(err);

    expect(result.completed).toBe(true);
    expect(mockedUiStore.setMessage).not.toHaveBeenCalled();
  });

  it('rethrows a non-HTTP error that is not a teardown error (real bug surfaces)', async () => {
    const bug: any = new TypeError('Cannot read properties of undefined');

    const result = await run(bug);

    expect(result.completed).toBe(false);
    expect(result.error).toBe(bug);
    expect(mockedUiStore.setMessage).not.toHaveBeenCalled();
  });

  it('clears all loading keys on teardown so the shell spinner is reset', () => {
    mockedUiStore.getState.mockReturnValueOnce({
      loading: { GetAllReports: true, GetParameters: true, RouterChange: true },
    } as any);

    service.ngOnDestroy();

    expect(mockedUiStore.removeLoading).toHaveBeenCalledWith('GetAllReports');
    expect(mockedUiStore.removeLoading).toHaveBeenCalledWith('GetParameters');
    expect(mockedUiStore.removeLoading).toHaveBeenCalledWith('RouterChange');
    expect(mockedUiStore.removeLoading).toHaveBeenCalledTimes(3);
  });

  it('does not fail teardown when there are no loading keys', () => {
    mockedUiStore.getState.mockReturnValueOnce({ loading: {} } as any);

    expect(() => service.ngOnDestroy()).not.toThrow();
    expect(mockedUiStore.removeLoading).not.toHaveBeenCalled();
  });
});


