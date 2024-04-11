import { Injectable } from '@angular/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import { Observable, Observer } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GeolocationService {

  constructor() { }

  getCurrentPosition(): Observable<Position> {
    return new Observable<Position>(observer => {
      const timeout = setTimeout(() => {
        observer.error('Timeout exceeded');
      }, 30000);

      Geolocation.getCurrentPosition()
        .then(coordinates => {
          clearTimeout(timeout); // Clear the timeout if the position is successfully obtained
          observer.next(coordinates);
          observer.complete();
        })
        .catch(error => {
          clearTimeout(timeout); // Clear the timeout if an error occurs
          console.error('Error getting location', error);
          observer.error(error);
        });
    });
  }

  async checkGeolocationPermission(): Promise<boolean> {
    const result_1 = await Geolocation.checkPermissions();
    if (result_1.location === 'granted') {
      return true;
    }
    return false;
  }
}
