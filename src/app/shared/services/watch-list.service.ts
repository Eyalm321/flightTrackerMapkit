import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AnnotationData, MapAnnotationService } from './map-annotation.service';
import { App, AppState } from '@capacitor/app';
import { BackgroundRunner } from '@capacitor/background-runner';
import { BackgroundWebworkerService } from './background-webworker.service';
import { AppStateService } from './app-state.service';

interface WatchDetails {
  flight: string;
  origin: string;
  destination: string;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class WatchListService {
  private watchListSubject: BehaviorSubject<WatchDetails[]> = new BehaviorSubject<WatchDetails[]>([]);
  watchList$ = this.watchListSubject.asObservable();

  constructor(private backgroundWebworkerService: BackgroundWebworkerService, private appStateService: AppStateService) {
    appStateService.appStateChanges$.subscribe((isActive: boolean) => {
      if (!isActive) {
        this.startBackgroundTask();
      }
    });
  }

  private trackProperties?: { [key: string]: string; };

  updateWatchList(annotationData: AnnotationData): void {
    const watchDetails = this.mapWatchDetailsFromAnnotationData(annotationData);
    const updatedWatchList = this.watchListSubject.value;
    updatedWatchList.unshift(watchDetails);

    this.trackProperties = updatedWatchList.reduce((acc, watch) => {
      return { ...acc, [watch.flight]: watch.status };
    }, {});

    this.watchListSubject.next(updatedWatchList);
  };

  private mapWatchDetailsFromAnnotationData(annotationData: AnnotationData): WatchDetails {
    return {
      flight: annotationData.flightDetails?.callsign || '',
      origin: annotationData.originAirport?.iata || '',
      destination: annotationData.destinationAirport?.iata || '',
      status: this.getStatusFromAltitude(annotationData.dynamic?.altitude || 'Unknown'),
    };
  }

  private getStatusFromAltitude(altitude: number | string): string {
    console.log(altitude);

    if (altitude === 'ground') return 'Grounded';
    if (typeof altitude === 'number') {
      if (altitude < 5000) return 'Landing / Take off';
      if (altitude < 10000) return 'Ascending / Descending';
      if (altitude > 10000) return 'Cruising';
    }
    return 'Unknown';
  }

  getTrackProperties(): { [key: string]: string; } {
    console.log('Getting track properties', this.trackProperties);

    return this.trackProperties || {};
  }

  startBackgroundTask(): void {
    console.log('Starting background task');

    this.backgroundWebworkerService.startBackgroundTask('com.eyalmizrachi.flightTracker.watchlistTracker', 'startTracking', this.getTrackProperties());
  }
}

