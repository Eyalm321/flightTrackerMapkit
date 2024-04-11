import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AnnotationData } from './map-annotation.service';

@Injectable({
  providedIn: 'root'
})
export class MapStateService {
  private _markers = new BehaviorSubject<AnnotationData[]>([]);
  private selectedAnnotationSubject: BehaviorSubject<AnnotationData | undefined> = new BehaviorSubject<AnnotationData | undefined>(undefined);

  markers$: Observable<AnnotationData[]> = this._markers.asObservable();
  selectedAnnotation$: Observable<AnnotationData | undefined> = this.selectedAnnotationSubject.asObservable();
  // Method to update markers, called by MapDataService
  updateMarkers(markers: AnnotationData[]): void {
    this._markers.next(markers);
  }

  updateSelectedAnnotation(annotation: AnnotationData | undefined): void {
    this.selectedAnnotationSubject.next(annotation);
  }
}
