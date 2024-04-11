import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonSpinner } from '@ionic/angular/standalone';

import { AirplaneDataService } from 'src/app/shared/services/airplane-data.service';
import { AnnotationData, MapAnnotationService } from 'src/app/shared/services/map-annotation.service';
import { MapStateService } from 'src/app/shared/services/map-state.service';

@Component({
  selector: 'app-airplane-card',
  templateUrl: './airplane-card.component.html',
  styleUrls: ['./airplane-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonSpinner, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonCard]
})
export class AirplaneCardComponent implements OnInit {
  @Input() data?: AnnotationData;
  image?: string;
  imageLoaded = false;
  constructor(private airplaneDataService: AirplaneDataService, private cdr: ChangeDetectorRef, private mapAnnotationService: MapAnnotationService, private mapStateService: MapStateService) { }

  ngOnInit(): void {
    this.mapStateService.selectedAnnotation$.subscribe((annoData: AnnotationData | undefined) => {
      if (!annoData || !annoData.aircraftDetails?.model) return;
      this.image = this.airplaneDataService.retrieveAirplaneImage(annoData.aircraftDetails.model);
      this.cdr.detectChanges();
    });
  }

  onImageLoad(event: any): void {
    event.target.style.visibility = 'visible';
    this.imageLoaded = true;
  }
}
