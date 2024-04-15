/// <reference path="../../typings/mapkit-js.d.ts" />

import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, Renderer2, ViewChild } from '@angular/core';
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
import { DirectivesModule } from '../shared/modules/directives.module';

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
    DirectivesModule
  ]
})
export class MapComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() trackView: boolean = false;
  @Input() selectedAnnotationData?: AnnotationData;
  @Output() isLoading: EventEmitter<void> = new EventEmitter<void>();
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('draggableContainer') draggableCard?: ElementRef<HTMLDivElement>;
  @ViewChild('cardElement', { read: ElementRef }) cardEl?: ElementRef<HTMLDivElement>;

  visiblePlanesSum: number = 0;
  private mapInstance?: mapkit.Map;
  private updateAnnotationsInterval?: Subscription;
  private destroy$: Subject<void> = new Subject<void>();
  private initialMapLocation: mapkit.Coordinate = new mapkit.Coordinate(36.7783, -119.4179);
  private hammer?: HammerManager;

  constructor(
    private mapkitService: MapkitService,
    private mapDataService: MapDataService,
    private themeWatcher: ThemeWatcherService,
    private geolocationService: GeolocationService,
    private mapAnnotationService: MapAnnotationService,
    private mapStateService: MapStateService,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2
  ) { }

  ngOnInit() {
    this.mapkitService.getMapkit().pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.geolocationService.getCurrentPosition()),
      switchMap(position => {
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
        const mapkit = library;
        const mapContainer = this.mapContainer?.nativeElement as Element;
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

    if (this.draggableCard) {
      console.log('draggable card', this.draggableCard.nativeElement);

      this.hammer = new Hammer(this.draggableCard.nativeElement, { recognizers: [[Hammer.Swipe, { direction: Hammer.DIRECTION_DOWN }], [Hammer.Pan, { direction: Hammer.DIRECTION_DOWN }]] });
      console.log('Hammer', this.hammer);
      this.hammer.on('pan', (event: HammerInput) => {
        const deltaY = event.deltaY;
        const isDraggingDown = deltaY > 0;
        if (isDraggingDown) {
          console.log('Panning down', deltaY);
          this.draggableCard!.nativeElement.style.transform = `translateY(${deltaY}px)`;
          this.cdr.detectChanges();
        }
      });

      this.hammer.on('panend', (event: HammerInput) => {
        const deltaY = event.deltaY;
        const isDraggingDown = deltaY > 0;
        if (isDraggingDown) {

          console.log('Panning ended', deltaY);
          // Remove the code below to prevent the card from going back up
          this.exitTrackView();
        }
      });
    }
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
      this.cdr.detectChanges();
      console.log('Card element', this.cardEl?.nativeElement);

      if (!annotation || !this.cardEl?.nativeElement) return;
      console.log('Card element', this.cardEl?.nativeElement);

      this.renderer.addClass(this.cardEl?.nativeElement, 'track-view');
      this.renderer.addClass(this.cardEl?.nativeElement, 'portrait');
      console.log('Card element classList', this.cardEl?.nativeElement);

      this.trackView = true;
      this.selectedAnnotationData = { ...this.selectedAnnotationData, ...annotation };
      this.mapInstance?.setCameraDistanceAnimated(300000, true);
      this.cdr.detectChanges();
    });

    this.mapAnnotationService.updateAnnotationsInterval$.subscribe(interval => {
      console.log('Update interval', interval);
      console.log('this.updateAnnotationsInterval', this.updateAnnotationsInterval);
      this.cdr.detectChanges();
      if (this.updateAnnotationsInterval) this.updateAnnotationsInterval.unsubscribe();
      this.updateAnnotationsInterval = undefined;
      if (!interval) return;
      this.updateAnnotationsInterval = interval.subscribe();
    });

    this.mapAnnotationService.annotationsChanged$.pipe(
      tap(markers => {
        this.isLoading.emit();
        this.updateNumOfVisiblePlanes(markers.length);
      })
    ).subscribe();

    this.mapAnnotationService.selectedAnnotationDataChanged$.subscribe(annotation => {
      this.selectedAnnotationData = { ...this.selectedAnnotationData, ...annotation };
      this.cdr.detectChanges();
    });
  }


  private updateLocationAndDistanceOnMap(instance: mapkit.Map): Observable<mapkit.Coordinate | null> {
    return this.geolocationService.getCurrentPosition().pipe(
      switchMap((position) => {
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
    this.renderer.removeClass(this.cardEl?.nativeElement, 'track-view');
    this.trackView = false;
    this.selectedAnnotationData = undefined;
    this.mapAnnotationService.setupAllPlanesUpdates();
    const polyline = this.mapDataService.getPolyline();
    if (polyline) this.mapInstance?.removeOverlay(polyline);
    this.mapInstance?.setCameraDistanceAnimated(1000000, true);
    setTimeout(() => {
      this.draggableCard!.nativeElement.style.transform = 'unset';
    }, 500);
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
