/// <reference path="../../typings/mapkit-js.d.ts" />

import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { AnnotationData, MapAnnotationService } from '../shared/services/map-annotation.service';
import { IonChip } from "@ionic/angular/standalone";
import { IonicSharedModule } from '../shared/modules/ionic-shared.module';
import { AirplaneCardComponent } from '../common/cards/airplane-card/airplane-card.component';
import { AirplaneStatsCardComponent } from '../common/cards/airplane-stats-card/airplane-stats-card';
import { CommonModule } from '@angular/common';
import { take, switchMap, ObservableInput, of, tap, last, map, Observable, Subscription, catchError, combineLatest, takeUntil, Subject } from 'rxjs';
import { MapDataService } from '../shared/services/map-data.service';
import { ThemeWatcherService } from '../shared/services/theme-watcher.service';
import { GeolocationService } from '../shared/services/geolocation.service';
import { MapStateService } from '../shared/services/map-state.service';
import { MapkitService } from '../shared/services/mapkit.service';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonicSharedModule,
    AirplaneStatsCardComponent,
    AirplaneCardComponent,
  ]
})
export class MapComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() trackView: boolean = false;
  @Input() selectedAnnotationData?: AnnotationData;
  @Output() isLoading: EventEmitter<void> = new EventEmitter<void>();
  @ViewChild('mapContainer') mapContainer?: ElementRef;

  visiblePlanesSum: number = 0;
  private mapInstance?: mapkit.Map;
  private updateAnnotationsInterval?: Subscription;
  private destroy$: Subject<void> = new Subject<void>();
  private initialMapLocation: mapkit.Coordinate = new mapkit.Coordinate(36.7783, -119.4179);

  constructor(
    private mapkitService: MapkitService,
    private mapDataService: MapDataService,
    private themeWatcher: ThemeWatcherService,
    private geolocationService: GeolocationService,
    private mapAnnotationService: MapAnnotationService,
    private mapStateService: MapStateService,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    console.log('Initializing map component');

    this.mapkitService.getMapkit().pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.geolocationService.getCurrentPosition()),
      switchMap(position => {
        console.log('Got position:', position);

        this.initialMapLocation = new mapkit.Coordinate(position.coords.latitude, position.coords.longitude);
        return this.mapAnnotationService.fetchAnnotationData(this.initialMapLocation);
      }),
      tap(annotationData => {
        this.mapAnnotationService.initAllAnnotationData(annotationData);
        this.cdr.detectChanges();
      })
    ).subscribe();
  }

  ngAfterViewInit(): void {
    this.mapkitService.getMapkit().pipe(
      takeUntil(this.destroy$),
      switchMap((library) => {
        console.log('Got mapkit library:', library);

        const mapkit = library;
        const mapContainer = this.mapContainer?.nativeElement;
        const theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        this.mapInstance = new mapkit.Map(mapContainer, { colorScheme: theme, center: this.initialMapLocation });
        return of(this.mapInstance);
      }),
      tap(instance => this.mapDataService.setMapInstance(instance)),
      switchMap(instance => {
        return this.updateLocationAndDistanceOnMap(instance).pipe(
          tap((myLocation) => {
            if (myLocation) {
              this.mapAnnotationService.createMyLocationAnnotation(instance, myLocation);
            }
          }),
          last(),
          map(() => instance)
        );
      }),
    ).subscribe((instance) => {
      const annotations = this.mapAnnotationService.getAnnotations();
      instance.addAnnotations(annotations);
      this.mapAnnotationService.setupAllPlanesUpdates();
    });

    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSubscriptions(): void {
    this.themeWatcher.themeChanged$.subscribe(isDark => {
      if (!this.mapInstance) return;
      this.mapInstance.colorScheme = isDark ? 'dark' : 'light';
    });

    this.mapStateService.selectedAnnotation$.subscribe(annotation => {
      if (!annotation) return;
      this.trackView = true;
      this.selectedAnnotationData = { ...this.selectedAnnotationData, ...annotation };
      this.mapInstance?.setCameraDistanceAnimated(300000, true);
      this.cdr.detectChanges();
    });

    this.mapAnnotationService.updateAnnotationsInterval$.subscribe(interval => {
      if (this.updateAnnotationsInterval) this.updateAnnotationsInterval.unsubscribe();
      if (!interval) return;
      this.updateAnnotationsInterval = interval.subscribe();
    });

    this.mapStateService.markers$.pipe(
      tap(markers => {
        this.isLoading.emit();
        this.updateNumOfVisiblePlanes(markers.length);
      })
    ).subscribe();

    this.mapAnnotationService.selectedAnnotationDataChanged$.subscribe(annotation => {
      this.selectedAnnotationData = { ...this.selectedAnnotationData, ...annotation };
      this.cdr.detectChanges();
      console.log('Selected annotation:', annotation);
    });
  }


  private updateLocationAndDistanceOnMap(instance: mapkit.Map): Observable<mapkit.Coordinate | null> {
    console.log('Updating location and distance on map');

    return this.geolocationService.getCurrentPosition().pipe(
      switchMap((position) => {
        console.log('Got position:', position);

        const { latitude, longitude } = position.coords;
        if (!instance || !position) return of(null);

        instance.setCameraDistanceAnimated(1000000, true);
        const myLocation = new mapkit.Coordinate(latitude, longitude);
        setTimeout(() => {
          instance.setCenterAnimated(myLocation, true);
        }, 1000);
        this.cdr.detectChanges();
        return of(myLocation);
      })
    );
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

  centerMapOnUser(): Observable<boolean | undefined> {
    if (!this.mapInstance) return of(false);
    return this.geolocationService.getCurrentPosition().pipe(
      switchMap((position) => {
        const { latitude, longitude } = position.coords;
        this.mapInstance?.setCenterAnimated(new mapkit.Coordinate(latitude, longitude), true);
        return of(true);
      })
    );
  }
}
