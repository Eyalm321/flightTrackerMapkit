import { Injectable } from '@angular/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import { Observable, Observer, from } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GeolocationService {

  constructor() { }

  async getCurrentPosition(): Promise<Position> {
    return await Geolocation.getCurrentPosition();
  }

  async checkGeolocationPermission(): Promise<boolean> {
    const result_1 = await Geolocation.checkPermissions();
    if (result_1.location === 'granted') {
      return true;
    }
    return false;
  }
}
