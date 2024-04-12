/// <reference path="../../../typings/mapkit-js.d.ts" />

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment.prod';


@Injectable({
  providedIn: 'root'
})
export class MapkitService {
  private mapkitScriptLoaded: boolean = false;
  private mapkit?: typeof mapkit;

  constructor() { }


  loadMapkit(): Promise<void> {
    if (this.mapkitScriptLoaded && this.mapkit) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js'; // Consider specifying libraries if needed
      script.async = true;
      script.crossOrigin = "anonymous";

      script.onload = async () => {
        this.mapkitScriptLoaded = true;
        this.mapkit = window.mapkit;

        try {
          const token = await this.getDeveloperToken();
          this.mapkit.init({
            authorizationCallback: (done) => done(token)
          });
          resolve();
        } catch (error) {
          console.error('Error initializing mapkit with token:', error);
          reject(error);
        }
      };

      script.onerror = (error) => {
        console.error('Script loading error:', error);
        reject(error);
      };

      document.head.appendChild(script);
    });
  }

  private getDeveloperToken(): Promise<string> {
    return fetch(environment.mapkit.jwtEndpoint)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch developer token');
        }
        return response.json();
      })
      .then(data => data.token)
      .catch(error => {
        console.error('HTTP request error:', error);
        throw error;
      });
  }

  getMapkit(): Observable<typeof mapkit> {
    if (!this.mapkit) {
      throw new Error('MapKit JS is not loaded yet. Call loadMapkit() first.');
    }
    return of(this.mapkit);
  }
}
