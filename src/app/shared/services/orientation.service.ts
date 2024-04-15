import { Injectable } from '@angular/core';
import { fromEvent, Observable } from 'rxjs';
import { map, distinctUntilChanged, startWith } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class OrientationService {
  private orientationChange$: Observable<'landscape' | 'portrait'>;

  constructor() {
    this.orientationChange$ = fromEvent(window, 'resize').pipe(
      startWith(this.getCurrentOrientation()),
      map(() => this.getCurrentOrientation()),
      distinctUntilChanged()
    );
  }

  getCurrentOrientation(): 'landscape' | 'portrait' {
    const isLandscape = window.innerWidth > window.innerHeight;
    return isLandscape ? 'landscape' : 'portrait';
  }

  getOrientationChange(): Observable<'landscape' | 'portrait'> {
    return this.orientationChange$;
  }
}
