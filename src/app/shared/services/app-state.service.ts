import { Injectable } from '@angular/core';
import { App } from '@capacitor/app';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  private appStateChangesSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);
  appStateChanges$: Observable<boolean> = this.appStateChangesSubject.asObservable();

  constructor() { }

  private initializeAppStateListener(): void {
    App.addListener('appStateChange', async (state) => {
      this.appStateChangesSubject.next(state.isActive);
    });
  }
}
