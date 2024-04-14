/// <reference path="../../../typings/mapkit-js.d.ts" />

import { Injectable, OnDestroy } from '@angular/core';
import { MapkitService } from './mapkit.service';
import { EMPTY, Observable, Subject, Subscription, catchError, combineLatest, interval, map, of, startWith, switchMap, take, takeUntil, tap } from 'rxjs';
import { AdsbService, Aircraft, ApiResponse, FlightRoutes } from './adsb.service';
import { AnnotationData } from './map-annotation.service';
import { MapStateService } from './map-state.service';

@Injectable({
  providedIn: 'root'
})
export class MapDataService implements OnDestroy {
  private mapInstance?: mapkit.Map;
  private polyline?: mapkit.PolylineOverlay;
  destroy$: Subject<void> = new Subject<void>();


  constructor(
    private adsbService: AdsbService,
    private mapStateService: MapStateService,
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setMapInstance(mapInstance: mapkit.Map): void {
    this.mapInstance = mapInstance;
  }

  getMapInstance(): mapkit.Map | undefined {
    if (!this.mapInstance) {
      console.error('Map instance not initialized');
    }
    return this.mapInstance;
  }


  mapAnnotationDataFromAll(ac: Aircraft[]): AnnotationData[] {
    if (!ac || ac.length === 0) return [];
    return ac.map(aircraft => {
      let annotation: AnnotationData = {
        id: aircraft.hex,
      };

      // Optional fields
      if (aircraft.lat && aircraft.lon) {
        annotation.coordinates = { lat: aircraft.lat, lng: aircraft.lon };
      }

      if (aircraft.flight) {
        annotation.title = aircraft.flight.trim();
        annotation.flightDetails = { callsign: aircraft.flight.trim() };
      }

      // Aircraft details are added independently if they exist
      let aircraftDetails: { model?: string; registration?: string; icao24?: string; } = {};
      if (aircraft.r) aircraftDetails['registration'] = aircraft.r;
      if (aircraft.hex) aircraftDetails['icao24'] = aircraft.hex;
      if (aircraft.t) aircraftDetails['model'] = aircraft.t;
      if (Object.keys(aircraftDetails).length > 0) {
        annotation.aircraftDetails = aircraftDetails;
      }

      // Dynamic details
      const dynamicDetails: { [key: string]: any; } = {};
      if (aircraft.seen) dynamicDetails['last_updated'] = aircraft.seen;
      if (aircraft.track) dynamicDetails['heading'] = aircraft.track;
      if (aircraft.gs) dynamicDetails['gs'] = aircraft.gs;
      if (aircraft.geom_rate) dynamicDetails['geom_rate'] = aircraft.geom_rate;
      if (aircraft.rssi) dynamicDetails['rssi'] = aircraft.rssi;
      if (aircraft.alt_baro) dynamicDetails['altitude'] = aircraft.alt_baro;
      if (Object.keys(dynamicDetails).length > 0) {
        annotation.dynamic = dynamicDetails;
      }

      // Last position
      if (aircraft.lastPosition && aircraft.lastPosition.lat && aircraft.lastPosition.lon) {
        annotation.last_pos = { lat: aircraft.lastPosition.lat, lng: aircraft.lastPosition.lon };
      }

      return annotation;
    });
  }


  calculateBoundsCenterAndRadius(mapRect: mapkit.MapRect): { lat: number, lon: number, radius: number; } {
    const coordinateRegion = mapRect.toCoordinateRegion();
    const center = coordinateRegion.center;
    const radiusInMeters = coordinateRegion.radius;

    const radiusInNM = radiusInMeters / 1852;
    const radiusLimitInNM = 250;
    let radius = parseInt((radiusInNM > radiusLimitInNM ? radiusLimitInNM : radiusInNM).toFixed(0));



    return {
      lat: center.latitude,
      lon: center.longitude,
      radius: radius
    };
  }

  mapAnnotationDataFromIcao(icao: string): Observable<AnnotationData | undefined> {
    return this.adsbService.getAircraftIcao(icao).pipe(
      map((response: ApiResponse) => {
        const aircraft = response.ac[0];
        if (!aircraft) return undefined;
        return this.mapAnnotationDataFromAll([aircraft])[0];
      })
    );
  }

  centerMapByLatLng(lat: number, lng: number): void {
    if (!this.mapInstance) return;
    const coordinate = new mapkit.Coordinate(lat, lng);
    this.mapInstance.setCenterAnimated(coordinate, true);
  }

  createAircraftRoute(annotationData: AnnotationData): void {
    if (!annotationData || !annotationData.coordinates || !annotationData.flightDetails?.callsign) return;
    this.adsbService.getAircraftsRouteset([{ callsign: annotationData.flightDetails.callsign, lat: annotationData.coordinates?.lat, lon: annotationData.coordinates.lng }])
      .pipe(
        take(1),
        map(routes => this.mapAnnotationDataFromRouteset(routes)),
        tap(mappedRoutes => {
          this.mapStateService.updateSelectedAnnotation(mappedRoutes);
        }),
        map(routes => {
          if (!routes || !routes.originAirport || !routes.destinationAirport || !routes.originAirport.lat || !routes.originAirport.lng || !routes.destinationAirport.lat || !routes.destinationAirport.lng) return EMPTY;
          const origin: mapkit.Coordinate = new mapkit.Coordinate(routes.originAirport.lat, routes.originAirport.lng);
          const destination: mapkit.Coordinate = new mapkit.Coordinate(routes.destinationAirport.lat, routes.destinationAirport.lng);
          return { origin, destination };
        }),
        catchError(async () => {
          return EMPTY;
        })
      )
      .subscribe({
        next: (route) => {
          if ('origin' in route && 'destination' in route) {
            const { origin, destination } = route;
            const annotationCoordinates = annotationData.coordinates;
            if (!annotationCoordinates) return;
            const coordinates: mapkit.Coordinate[] = [new mapkit.Coordinate(annotationCoordinates.lat, annotationCoordinates.lng)];
            this.addFlightpathPolyline(origin, destination, coordinates);
          }
        },
        error: (error) => {
          console.error('Unexpected error:', error);
        },
      });
  }

  mapAnnotationDataFromRouteset(routes: FlightRoutes): AnnotationData | undefined {
    return {
      flightDetails: {
        callsign: routes[0].callsign,
        airlineCode: routes[0].airline_code,
      },
      originAirport: {
        iata: routes[0]._airports[0]?.iata,
        name: routes[0]._airports[0]?.name,
        location: routes[0]._airports[0]?.location,
        lat: routes[0]._airports[0]?.lat,
        lng: routes[0]._airports[0]?.lon,
      },
      destinationAirport: {
        iata: routes[0]._airports[1]?.iata,
        name: routes[0]._airports[1]?.name,
        location: routes[0]._airports[1]?.location,
        lat: routes[0]._airports[1]?.lat,
        lng: routes[0]._airports[1]?.lon,
      },
    };
  }

  addFlightpathPolyline(origin: mapkit.Coordinate, destination: mapkit.Coordinate, midWaypoints: mapkit.Coordinate[]): void {
    if (!this.mapInstance) return;
    const coordinates = [origin, ...midWaypoints, destination];
    this.polyline = new mapkit.PolylineOverlay(coordinates, {
      style: new mapkit.Style({
        lineWidth: 2,
        lineCap: 'round',
        lineJoin: 'round',
      })
    });
    this.mapInstance.addOverlay(this.polyline);
  }

  getPolyline(): mapkit.PolylineOverlay | undefined {
    if (!this.polyline) {
      console.error('Polyline not initialized');
    }
    return this.polyline;
  }

  setPolyline(polyline: mapkit.PolylineOverlay): void {
    this.polyline = polyline;
  }

  changePathMiddleWaypoints(coordinates: mapkit.Coordinate[], index?: number): void {
    if (!this.polyline) return;
    let path = this.polyline.points;
    if (index) {
      // replace the middle waypoint
      path.splice(index, 1, ...coordinates);
      return;
    }
    // replace all middle waypoints
    path = [path[0], ...coordinates, path[path.length - 1]];
    this.polyline.points = path;
  }
}
