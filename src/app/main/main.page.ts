/// <reference path="../../typings/mapkit-js.d.ts" />

import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonChip, IonFab, IonFabButton, IonIcon, IonProgressBar, IonButtons, IonButton } from '@ionic/angular/standalone';
import { MapDataService } from '../shared/services/map-data.service';
import { Observable, ObservableInput, Subscription, last, map, of, switchMap, take, tap } from 'rxjs';
import { ThemeWatcherService } from '../shared/services/theme-watcher.service';
import { AnnotationData, MapAnnotationService } from '../shared/services/map-annotation.service';
import { addIcons } from 'ionicons';
import { MapStateService } from '../shared/services/map-state.service';
import { AirplaneStatsCardComponent } from '../common/cards/airplane-stats-card/airplane-stats-card';
import { AirplaneCardComponent } from '../common/cards/airplane-card/airplane-card.component';
import { NavController } from '@ionic/angular';
import { GeolocationService } from '../shared/services/geolocation.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonChip,
    IonFab,
    IonFabButton,
    IonIcon,
    AirplaneStatsCardComponent,
    AirplaneCardComponent,
    IonProgressBar,
    IonButtons,
    IonButton
  ],
})
export class MainPage implements AfterViewInit {
  @ViewChild('mapContainer') mapContainer?: ElementRef;
  visiblePlanesSum: number = 0;
  private mapInstance?: mapkit.Map;
  private updateAnnotationsInterval?: Subscription;
  selectedAnnotationData?: AnnotationData;
  trackView: boolean = false;
  isLoading: boolean = true;

  icons = addIcons({
    'arrow-back': 'https://unpkg.com/ionicons@7.1.0/dist/svg/arrow-back.svg',
    'navigate': 'https://unpkg.com/ionicons@7.1.0/dist/svg/navigate.svg',
    'logo-github': 'https://unpkg.com/ionicons@7.1.0/dist/svg/logo-github.svg',
    'help-circle': 'https://unpkg.com/ionicons@7.1.0/dist/svg/help-circle.svg'
  });

  constructor(private mapDataService: MapDataService,
    private themeWatcher: ThemeWatcherService,
    private mapStateService: MapStateService,
    private mapAnnotationService: MapAnnotationService,
    private cdr: ChangeDetectorRef,
    private navigationController: NavController,
    private geolocationService: GeolocationService
  ) { }

  navigateToGithub(): void {
    window.open('https://github.com/Eyalm321/flightTrackerMapkit', '_blank');
  }

  navigateToAbout() {
    console.log('Navigating to about page');

    this.navigationController.navigateForward('main/about');
  }


  ngAfterViewInit(): void {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    this.mapDataService.initializeLibrary().pipe(
      take(1),
      switchMap(({ library, data }: { library: typeof mapkit; data: any; }): ObservableInput<mapkit.Map | undefined> => {
        if (!library || !data) return of(undefined);
        const theme = prefersDark ? 'dark' : 'light';
        const mapkit = library;
        const mapContainer = this.mapContainer?.nativeElement;

        this.mapInstance = new mapkit.Map(mapContainer, { colorScheme: theme, showsUserLocation: true });

        return of(this.mapInstance);
      }),
      switchMap((instance) => {
        this.cdr.detectChanges();
        if (!instance) return of(instance);
        return this.updateLocationAndDistanceOnMap(instance).pipe(
          last(),
          map(() => instance));
      }),
    ).subscribe(
      instance => {
        if (!instance) return;
        this.mapDataService.setMapInstance(instance);
        this.mapAnnotationService.setupAllPlanesUpdates();
      }
    );


    this.themeWatcher.themeChanged$.pipe(
      tap((isDark) => {
        if (!this.mapInstance) return;
        this.mapInstance.colorScheme = isDark ? 'dark' : 'light';

      })).subscribe();

    this.mapAnnotationService.updateAnnotationsInterval$.subscribe(interval => {
      if (this.updateAnnotationsInterval) this.updateAnnotationsInterval.unsubscribe();
      if (!interval) return;
      this.updateAnnotationsInterval = interval.subscribe();
    });

    this.mapStateService.markers$.pipe(
      tap(markers => {
        this.startLoading();
        this.updateNumOfVisiblePlanes(markers.length);
      })
    ).subscribe();

    this.mapStateService.selectedAnnotation$.pipe(
      tap(annotation => {
        if (!annotation) return;
        this.trackView = true;
        this.selectedAnnotationData = { ...this.selectedAnnotationData, ...annotation };
        this.mapInstance?.setCameraDistanceAnimated(300000, true);
        console.log('Selected annotation:', annotation);

        this.cdr.detectChanges();
      })
    ).subscribe();

    this.mapAnnotationService.selectedAnnotationDataChanged$.subscribe(annotation => {
      this.selectedAnnotationData = { ...this.selectedAnnotationData, ...annotation };
      this.cdr.detectChanges();
      console.log('Selected annotation:', annotation);

    });
  }

  private updateLocationAndDistanceOnMap(instance: mapkit.Map): Observable<boolean> {
    console.log('Updating location and distance on map');

    return this.geolocationService.getCurrentPosition().pipe(
      switchMap((position) => {
        console.log('Got position:', position);

        const { latitude, longitude } = position.coords;
        if (!instance || !position) return of(false);

        instance.setCameraDistanceAnimated(1000000, true);
        setTimeout(() => {
          instance.setCenterAnimated(new mapkit.Coordinate(latitude, longitude), true);
        }, 1000);
        this.cdr.detectChanges();
        return of(true);
      })
    );
  }

  private startLoading(): void {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }, Math.random() * 2000 + 500);
  }


  updateNumOfVisiblePlanes(length?: number): void {
    if (length && length > 0) {
      this.visiblePlanesSum = length;
      this.cdr.detectChanges();
      return;
    }
    const num = this.mapAnnotationService.getAnnotationsLength();
    if (!num || num === 0) return;
    this.visiblePlanesSum = num;
    this.cdr.detectChanges();
  }

  exitTrackView(): void {
    this.trackView = false;
    this.selectedAnnotationData = undefined;
    this.mapAnnotationService.setupAllPlanesUpdates();
    const polyline = this.mapDataService.getPolyline();
    if (polyline) this.mapInstance?.removeOverlay(polyline);
    this.mapInstance?.setCameraDistanceAnimated(1000000, true);
  }

  async centerMapOnUser(): Promise<void> {
    this.geolocationService.getCurrentPosition().subscribe({
      next: (position) => {
        if (!this.mapInstance) return;
        const { latitude, longitude } = position.coords;
        this.mapInstance.setCenterAnimated(new mapkit.Coordinate(latitude, longitude), true);
      }
    });
  }
}
