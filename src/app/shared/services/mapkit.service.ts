/// <reference path="../../../typings/mapkit-js.d.ts" />

import { Injectable } from '@angular/core';
import { Observable, catchError, from, map, of, tap } from 'rxjs';
import { Http } from '@capacitor-community/http';
import { environment } from 'src/environments/environment.prod';


@Injectable({
  providedIn: 'root'
})
export class MapkitService {
  private mapkitScriptLoaded: boolean = false;
  private mapkit: any;

  constructor() { }


  loadMapkit(): Observable<typeof mapkit> {
    return new Observable((subscriber) => {
      if (this.mapkitScriptLoaded) {
        subscriber.next(this.mapkit);
        subscriber.complete();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js'; // Consider specifying libraries if needed
      script.async = true; // Load the script asynchronously
      script.crossOrigin = "anonymous"; // Recommended for CORS settings

      script.onload = () => {
        this.mapkitScriptLoaded = true;
        this.mapkit = window.mapkit;

        this.mapkit.init({
          authorizationCallback: (done: (token: string) => void) => {
            this.getDeveloperToken().subscribe({
              next: (token: string) => {
                const obj = JSON.parse(token);
                const tokenStr = obj.token;

                done(tokenStr);

                subscriber.next(this.mapkit);
                subscriber.complete();
              },
              error: error => {
                console.error('Error fetching developer token:', error);
                subscriber.error(error); // Notify the observable of the error
              },
            });
          }
        });
      };

      script.onerror = error => {
        console.error('Script loading error:', error);
        subscriber.error(error); // Handle script loading errors
      };

      document.head.appendChild(script);
    });
  }

  getDeveloperToken(): Observable<string> {
    return from(Http.request({
      method: 'GET',
      url: environment.mapkit.jwtEndpoint,
    })).pipe(
      map(response => response.data),
      catchError(error => {
        console.error('HTTP request error: ', error);
        throw new Error('Failed to fetch developer token');
      })
    );
  }

  getMapkit(): Observable<any> {
    if (!this.mapkit) {
      throw new Error('MapKit JS is not loaded yet. Call loadMapkit() first.');
    }
    return of(this.mapkit);
  }
}
