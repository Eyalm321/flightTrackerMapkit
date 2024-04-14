import { Inject, Injectable } from '@angular/core';
import { MapDataService } from './map-data.service';
import { take, filter, of, Observable, switchMap, tap, Subscription, BehaviorSubject, interval, startWith, takeUntil, map, catchError, combineLatest, forkJoin, mergeMap } from 'rxjs';
import { MapStateService } from './map-state.service';
import { AdsbService, Aircraft } from './adsb.service';
import { AirplaneDataService } from './airplane-data.service';
import { GeolocationService } from './geolocation.service';

interface LatLng {
  lat: number;
  lng: number;
}
export interface AnnotationData {
  id?: string;
  title?: string;
  coordinates?: { lat: number, lng: number; };
  flightDetails?: { callsign?: string, airlineCode?: string; };
  aircraftDetails?: { registration?: string, icao24?: string; model?: string; };
  originAirport?: { iata?: string, name?: string, location?: string, lat?: number, lng?: number; };
  destinationAirport?: { iata?: string, name?: string, location?: string, lat?: number, lng?: number; };
  dynamic?: { last_updated?: number, gs?: number, geom_rate?: number, rssi?: number, altitude?: number | string, heading?: number; };
  last_pos?: { lat?: number, lng?: number; };
}

@Injectable({
  providedIn: 'root'
})
export class MapAnnotationService implements OnDestroy {
  annotations: { [key: string]: mapkit.Annotation; } = {};
  annotationTrackView = false;
  private updateAnnotationsIntervalSubject = new BehaviorSubject<Observable<number | undefined>>(of(undefined));
  updateAnnotationsInterval$: Observable<Observable<number | undefined>> = this.updateAnnotationsIntervalSubject.asObservable();
  selectedAnnotationDataChangedSubject: BehaviorSubject<AnnotationData | undefined> = new BehaviorSubject<AnnotationData | undefined>(undefined);
  selectedAnnotationDataChanged$: Observable<AnnotationData | undefined> = this.selectedAnnotationDataChangedSubject.asObservable();

  private transitionWorker;

  constructor(
    private mapDataService: MapDataService,
    private mapStateService: MapStateService,
    private adsbService: AdsbService,
    private airplaneDataService: AirplaneDataService,
  ) {
    this.transitionWorker = new Worker(new URL('./annotation-transition.worker', import.meta.url), { type: 'module' });
    this.initTransitionWorkerTasks();
    this.mapStateService.markers$.subscribe(markers => {
      this.updateMarkers(markers);
    });

    this.mapStateService.selectedAnnotation$.subscribe(annotation => {
      if (!annotation) return;
      this.mergeAnnotationData(annotation);
    });
  }

  initTransitionWorkerTasks(): void {
    this.transitionWorker.onmessage = (event) => {
      const data = event.data;
      console.log('Received message from worker:', data.type, data);
      switch (data.type) {
        case 'updateAnnotation':
          // this.updateAnnotationPosition(data.coordinate, data.id);
          break;
        case 'finalPosition':
          // this.updateAnnotationPosition(data.coordinate, data.id);
          console.log('Received final position:', data.coordinate);
          break;
        case 'transitionReady':
          this.updateAnnotationPosition(data.waypoints[0], data.id);
          console.log('Transition is ready, first waypoint:', data.waypoints[0]);
          break;
        default:
          console.error('Received unknown message type from worker:', data.type);
      }
    };
  }

  updateAnnotationPosition(coordinate: LatLng, id: string): void {
    if (!this.annotations[id] || !coordinate) return;
    console.log('Updating annotation position', coordinate);
    console.log('Annotation ID:', id);
    const c = new mapkit.Coordinate(coordinate.lat, coordinate.lng);
    this.annotations[id].coordinate = c;
  }

  setupAllPlanesUpdates(): void {
    const newInterval = interval(3000).pipe(
      startWith(0),
      mergeMap(_ => {
        return this.fetchAnnotationData();
      }),
      switchMap((annotationsData: AnnotationData[], number: number) => {
        this.updateMarkers(annotationsData);
        return of(number);
      }),
    );
    this.setInterval(newInterval);
  }

  fetchAnnotationData(coords?: mapkit.Coordinate): Observable<AnnotationData[]> {
    let lat, lon, radius;
    if (coords) {
      lat = coords.latitude;
      lon = coords.longitude;
      radius = 150;
    } else {
      const mapInstance = this.mapDataService?.getMapInstance();
      if (!mapInstance) return of([]);
      const mapRect: mapkit.MapRect = mapInstance.visibleMapRect;
      ({ lat, lon, radius } = this.mapDataService.calculateBoundsCenterAndRadius(mapRect));
    }

    return combineLatest([
      this.adsbService.getAircraftsByLocation(lat, lon, radius).pipe(catchError(() => of({ ac: [] }))),
      this.adsbService.getMilAircrafts().pipe(catchError(() => of({ ac: [] })))
    ]).pipe(
      map(([allAircraftData, milAircraftData]) => {
        const uniqueAircrafts = [...allAircraftData.ac, ...milAircraftData.ac].reduce((acc: Aircraft[], aircraft) => {
          if (!acc.some(a => a.hex === aircraft.hex)) {
            acc.push(aircraft);
          }
          return acc;
        }, []);
        const result = this.mapDataService.mapAnnotationDataFromAll(uniqueAircrafts);

        return result;
      }),
    );
  }


  mergeAnnotationData(data: AnnotationData): void {
    if (!data?.id) return;
    const selectedAnnotation = this.annotations[data.id];
    this.annotations[data.id].data = Object.assign({}, selectedAnnotation.data, data);

  }

  createAnnotations(mapInstance: mapkit.Map, annotationsData: AnnotationData[]): Observable<mapkit.Annotation[] | undefined> {
    // Early return if mapInstance is not provided
    if (!mapInstance) return of(undefined);


    // Collect all annotation creation observables
    const annotationObservables = annotationsData
      .filter(data => !!data.id) // Ensure we have an id to work with
      .map(data =>
        this.createAnnotationElement(data).pipe(
          take(1),
          switchMap(annotation => {
            if (!annotation || !data.id) return of(undefined);
            const imgSource = annotation.element.getElementsByTagName('img')[0].src;
            if (!imgSource) return of(undefined);
            this.annotations[data.id] = annotation;

            if (!data.dynamic?.heading) return of(annotation);
            this.rotateAnnotation(annotation, data.dynamic?.heading);

            return of(annotation);
          })
        )
      );

    // Use forkJoin to wait for all observables to emit and complete
    return forkJoin(annotationObservables).pipe(
      switchMap(annotations => {
        const validAnnotations = annotations.filter(annotation => !!annotation) as mapkit.Annotation[];
        mapInstance.addAnnotations(validAnnotations);
        return of(validAnnotations as mapkit.Annotation[]);
      })
    );
  }

  createPlaneAnnotation(mapInstance: mapkit.Map, data: AnnotationData): Observable<mapkit.Annotation | undefined> {
    return this.createAnnotationElement(data).pipe(
      take(1),
      switchMap(annotation => {
        if (!annotation || !data.id) return of(undefined);
        this.annotations[data.id] = annotation;
        return of(annotation);
      }),
      tap(annotation => annotation && mapInstance.addAnnotation(annotation))
    );
  }


  createAnnotationElement(data: AnnotationData): Observable<mapkit.Annotation | undefined> {
    if (!data || !data.coordinates) return of(undefined);
    const coordinate = new mapkit.Coordinate(data.coordinates.lat, data.coordinates.lng);
    const factory = this.createAnnotationElementFactory(data);
    // Create a new MarkerAnnotation instance.
    const annotation = new mapkit.Annotation(coordinate, factory);
    annotation.data = data;
    annotation.anchorOffset = new DOMPoint(-16, -16);
    annotation.addEventListener('select', _ => {
      this.handleAnnotationSelection(data);
    });
    return of(annotation);
  }

  createAnnotationElementFactory(data: AnnotationData): () => HTMLElement {
    const factory = () => {
      const img = document.createElement("img");
      if (data.aircraftDetails?.model) {
        img.src = this.airplaneDataService.getAircraftTypeMarkerIcon(data.aircraftDetails.model);
      } else {
        img.src = 'assets/icons/airplane.svg';
      }
      img.classList.add('plane-icon');
      img.style.transform = `rotate(${data.dynamic?.heading ?? 0}deg)`;
      img.style.scale = `${this.getScaleByAltitude(data.dynamic?.altitude ?? 0)}`;
      return img;
    };
    return factory;
  }

  createMyLocationAnnotation(mapInstance: mapkit.Map, coordinates: mapkit.Coordinate): void {
    const factory = () => {
      const img = document.createElement("img");
      img.src = 'assets/icons/blue-dot.png';
      img.classList.add('my-location-icon');
      return img;
    };

    const annotation = new mapkit.Annotation(coordinates, factory);
    mapInstance.addAnnotation(annotation);
  }


  handleAnnotationSelection(annotationData: AnnotationData): void {
    if (!annotationData.coordinates || !annotationData.id) return;
    const getAircraftByIcao = () => {
      if (!annotationData.id) return;
      this.mapDataService.mapAnnotationDataFromIcao(annotationData.id).subscribe(data => {
        if (!data || !data.id) return;

        this.updateAnnotationData(data);
        const selectedAnnotation = this.annotations[data.id];
        const selectedData: AnnotationData = selectedAnnotation?.data;
        const existingAnnotation = this.annotations[data.id];
        if (!selectedAnnotation || !selectedData || !selectedData.coordinates || !selectedData.dynamic) return;
        const annotationLocation: mapkit.Coordinate[] = [new mapkit.Coordinate(selectedData.coordinates.lat, selectedData.coordinates.lng)];
        this.mapDataService.centerMapByLatLng(selectedData.coordinates.lat, selectedData.coordinates.lng);
        this.startMarkerTransition(existingAnnotation, selectedData);
        this.mapDataService.changePathMiddleWaypoints(annotationLocation);
      });
    };

    this.setInterval();
    this.removeAllOtherAnnotations(annotationData.id).pipe(
      take(1),
      tap(() => {
        this.mapStateService.updateSelectedAnnotation(annotationData);
        this.annotationTrackView = true;
        this.mapDataService.createAircraftRoute(annotationData);
        const mapInstance = this.mapDataService?.getMapInstance();
        if (!mapInstance) return;
        mapInstance.setCameraDistanceAnimated(100000);
        const newInterval = interval(3000).pipe(
          startWith(0),
          tap(_ => {
            getAircraftByIcao();
            this.updateAnnotationData(annotationData);
          })
        );
        this.setInterval(newInterval);
      })
    ).subscribe();
  }

  setInterval(interval: Observable<number | undefined> = new Observable<undefined>): void {
    this.updateAnnotationsIntervalSubject.next(interval);
  }

  getAnnotations(): mapkit.Annotation[] {
    return Object.values(this.annotations);
  }

  removeAllOtherAnnotations(id: string): Observable<void> {
    // Map each annotation removal to an Observable, except for the one with the specified id
    const removalObservables = Object.keys(this.annotations)
      .filter(annoId => annoId !== id)
      .map(annoId => {
        return new Observable<void>(observer => {
          this.removeAnnotation(annoId);
          observer.next();
          observer.complete();
        });
      });

    // If there are no annotations to remove, immediately complete
    if (removalObservables.length === 0) {
      return of(undefined);
    }

    // Use forkJoin to wait for all removal Observables to complete
    return forkJoin(removalObservables).pipe(
      map(() => undefined) // Ensure the Observable<void> type is matched
    );
  }

  initAllAnnotationData(annotationsData: AnnotationData[]): void {
    annotationsData.forEach(data => {
      const factory = this.createAnnotationElementFactory(data);
      if (!data.id || !data.coordinates) return;
      const annotation = new mapkit.Annotation(new mapkit.Coordinate(data.coordinates.lat, data.coordinates.lng), factory);
      annotation.data = data;
      annotation.anchorOffset = new DOMPoint(-16, -16);
      annotation.addEventListener('select', _ => {
        this.handleAnnotationSelection(data);
      });

      this.annotations[data.id] = annotation;
    });
  }

  updateAnnotationData(data: AnnotationData): void {
    if (!data.id) return;
    const existingAnnotation = this.annotations[data.id];
    if (!existingAnnotation) return;
    this.annotations[data.id].data = { ...existingAnnotation.data, ...data };
    this.selectedAnnotationDataChangedSubject.next(this.annotations[data.id].data);
  }

  updateMarkers(annotationsData: AnnotationData[]): void {
    const mapInstance = this.mapDataService.getMapInstance();
    if (!mapInstance) return;

    const newDataMap = new Map(annotationsData.map(item => [item.id, item]));
    const annotationsToRemove: string[] = [];
    const newAnnotations: Observable<mapkit.Annotation>[] = [];

    // Identify existing annotations to update or remove
    Object.keys(this.annotations).forEach(id => {
      if (newDataMap.has(id)) {
        const newAnnotationData = newDataMap.get(id);
        if (!newAnnotationData) return;
        const existingAnnotation = this.annotations[id];
        this.startMarkerTransition(existingAnnotation, newAnnotationData);
        if (!newAnnotationData || !existingAnnotation) return;
        this.addOrUpdateAnnotation(newAnnotationData); // Reuse the logic for updating existing annotations
        newDataMap.delete(id); // Remove the processed annotation from newDataMap
      } else {
        annotationsToRemove.push(id); // Mark for removal
      }
    });

    // Remove annotations that are no longer present
    annotationsToRemove.forEach(id => this.removeAnnotation(id));

    // Prepare new annotations for addition
    newDataMap.forEach((annotationData, id) => {
      newAnnotations.push(this.createPlaneAnnotation(mapInstance, annotationData).pipe(
        tap((annotation: any) => {
          if (annotation && id) {
            this.annotations[id] = annotation; // Add to local cache
          }
        }),
      ));
    });

    // Add all new annotations in bulk after creation
    forkJoin(newAnnotations).subscribe();
  }

  addOrUpdateAnnotation(annotationData: AnnotationData): void {
    if (!annotationData.id) return;
    const existingAnnotation = this.annotations[annotationData.id];
    if (existingAnnotation) {
      this.startMarkerTransition(existingAnnotation, annotationData);

      if (existingAnnotation.element && annotationData.dynamic && annotationData.dynamic.altitude) {
        const element = existingAnnotation.element as HTMLElement;
        if (annotationData.dynamic.heading) {
          this.rotateAnnotation(existingAnnotation, annotationData.dynamic.heading);
        }
        element.style.scale = `${this.getScaleByAltitude(annotationData.dynamic.altitude)}`;
      }
    } else {
      const mapInstance = this.mapDataService?.getMapInstance();
      if (mapInstance && annotationData && annotationData.coordinates) {


        this.createPlaneAnnotation(mapInstance, annotationData).pipe(
          take(1),
          filter(newAnnotation => !!newAnnotation))
          .subscribe(
            annotation => {
              if (annotation && annotationData.id) {
                this.annotations[annotationData.id] = annotation;
              }
            });
      }
    }
  }

  removeAnnotation(annoId: string): void {
    const annotation = this.annotations[annoId];
    const mapInstance = this.mapDataService?.getMapInstance();
    if (!annotation || !mapInstance) return;

    mapInstance.removeAnnotation(annotation);
    delete this.annotations[annoId];
  }

  transitionMarkerPosition(existingAnnotation: mapkit.Annotation, newAnnotationData: AnnotationData): void {
    if (!existingAnnotation || !newAnnotationData.coordinates) {
      return;
    }

    const startLat = existingAnnotation.data.last_pos ? existingAnnotation.data.last_pos.lat : existingAnnotation.coordinate.latitude;
    const startLng = existingAnnotation.data.last_pos ? existingAnnotation.data.last_pos.lng : existingAnnotation.coordinate.longitude;
    const endLat = newAnnotationData.coordinates.lat;
    const endLng = newAnnotationData.coordinates.lng;

    const duration = 4000; // Duration of the transition in milliseconds
    let startTime: number;
    const waypoints: any[] = []; // Pre-calculate waypoints for efficiency

    const easeInOutQuad = (t: number) => {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    };

    const precalculateWaypoints = () => {
      for (let t = 0; t <= 1; t += 0.05) { // Adjust granularity as needed
        const easedT = easeInOutQuad(t);
        const lat = startLat + (endLat - startLat) * easedT;
        const lng = startLng + (endLng - startLng) * easedT;
        waypoints.push(new mapkit.Coordinate(lat, lng));
      }
    };

    const changePathMiddleWaypoints = (waypoints: mapkit.Coordinate[]) => {
      this.mapDataService.changePathMiddleWaypoints(waypoints);
    };

    precalculateWaypoints();

    const updatePosition = (time: number) => {
      if (!startTime) startTime = time;
      const elapsedTime = time - startTime;
      const fraction = elapsedTime / duration;
      const index = Math.floor(fraction * (waypoints.length - 1));

      if (fraction < 1) {
        existingAnnotation.coordinate = waypoints[index];
        requestAnimationFrame(updatePosition);
      } else {
        existingAnnotation.coordinate = waypoints[waypoints.length - 1];
      }
      // Update the line less frequently or based on significant changes
      changePathMiddleWaypoints([waypoints[0], waypoints[index], waypoints[waypoints.length - 1]]);
    };

    requestAnimationFrame(updatePosition);
  }


  startMarkerTransition(existingAnnotation: mapkit.Annotation, newAnnotationData: AnnotationData) {

    if (!existingAnnotation || !newAnnotationData.coordinates) {
      return;
    }

    const start = {
      lat: existingAnnotation.coordinate.latitude,
      lng: existingAnnotation.coordinate.longitude
    };
    const end = {
      lat: newAnnotationData.coordinates.lat,
      lng: newAnnotationData.coordinates.lng
    };
    const duration = 4000; // Duration of the transition in milliseconds

    this.transitionWorker.postMessage({ start, end, duration, id: newAnnotationData.id });

    const updatePosition = (position) => {
      if (position && this.annotations[newAnnotationData.id]) {
        this.annotations[newAnnotationData.id].coordinate = new mapkit.Coordinate(position.lat, position.lng);
        requestAnimationFrame(() => updatePosition(position));
      }
    };

    this.transitionWorker.onmessage = (event) => {
      if (event.data.id === newAnnotationData.id) {
        updatePosition(event.data.position);
      }
    };
  }



  rotateAnnotation(annotation: mapkit.Annotation, heading: number): void {
    if (!annotation) {
      console.error('No annotation available');
      return;
    }

    const element = annotation.element as HTMLElement;
    if (!element) {
      console.error('Annotation element is not available');
      return;
    }

    // Extract the current transform property value
    const currentTransform = element.style.transform;

    // Use a regular expression to find an existing rotate() transformation
    const rotateRegex = /rotate\(-?\d+(\.\d+)?deg\)/;

    // Check if a rotate transformation already exists
    if (rotateRegex.test(currentTransform)) {
      // Replace the existing rotate transformation
      element.style.transform = currentTransform.replace(rotateRegex, `rotate(${heading}deg)`);
    } else {
      // If no rotate transformation exists, append a new rotate transformation
      element.style.transform += ` rotate(${heading}deg)`;
    }
  }

  private getScaleByAltitude(altitude: number | string): number {
    if (typeof altitude === 'string') return 0;
    if (altitude < 10000) {
      return 1;
    } else if (altitude >= 10000 && altitude < 20000) {
      return 1.2;
    } else if (altitude >= 20000 && altitude < 30000) {
      return 1.4;
    } else if (altitude >= 30000 && altitude < 40000) {
      return 1.5;
    } else {
      return 1.6;
    }
  }

  getAnnotationsLength(): number {
    return Object.keys(this.annotations).length;
  }
}

