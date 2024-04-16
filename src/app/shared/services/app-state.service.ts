import { Injectable } from '@angular/core';
import { App } from '@capacitor/app';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  private appStateChangesSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);
  appStateChanges$: Observable<boolean> = this.appStateChangesSubject.asObservable();

  constructor() {
    this.initializeAppStateListener();
  }

  private initializeAppStateListener(): void {
    App.addListener('appStateChange', async (state) => {
      console.log('App state changed. Is active?', state.isActive);

      this.appStateChangesSubject.next(state.isActive);
    });
  }
}
