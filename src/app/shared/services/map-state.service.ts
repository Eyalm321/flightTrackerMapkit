import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AnnotationData } from './map-annotation.service';

@Injectable({
  providedIn: 'root'
})
export class MapStateService {
  private selectedAnnotationSubject: BehaviorSubject<AnnotationData | undefined> = new BehaviorSubject<AnnotationData | undefined>(undefined);

  selectedAnnotation$: Observable<AnnotationData | undefined> = this.selectedAnnotationSubject.asObservable();
  // Method to update markers, called by MapDataService


  updateSelectedAnnotation(annotation: AnnotationData | undefined): void {
    this.selectedAnnotationSubject.next(annotation);
  }
}
