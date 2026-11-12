import {Injectable, OnDestroy} from '@angular/core';
import {Subject, Subscription} from 'rxjs';

/**
 * OnDestroySubject abstract class contained all onDestroy$ Subject, that can be used for Unsubscribe onDestroy
 * @example
 * this.uiFacade.current$.pipe(takeUntil(this.onDestroy$)).subscribe(user => {...});
 */
@Injectable()
export abstract class OnDestroySubject implements OnDestroy {
  public readonly onDestroy$ = new Subject();
  public readonly subscription = new Subscription();
  ngOnDestroy() {
    this.onDestroy$.next(false);
    this.onDestroy$.complete();
    this.subscription.unsubscribe();
  }
}
