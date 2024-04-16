import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonSpinner, IonIcon, IonButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { MaterialModule } from 'src/app/shared/modules/material.module';

import { AirplaneDataService } from 'src/app/shared/services/airplane-data.service';
import { AnnotationData, MapAnnotationService } from 'src/app/shared/services/map-annotation.service';
import { MapStateService } from 'src/app/shared/services/map-state.service';
import { WatchListService } from 'src/app/shared/services/watch-list.service';

@Component({
  selector: 'app-airplane-card',
  templateUrl: './airplane-card.component.html',
  styleUrls: ['./airplane-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon, CommonModule, IonSpinner, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonCard, MaterialModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AirplaneCardComponent implements OnInit {
  @Input() data?: AnnotationData;
  image?: string;
  imageLoaded = false;

  icons = addIcons({
    'glasses': 'https://unpkg.com/ionicons@7.1.0/dist/svg/glasses.svg',
    'add': 'https://unpkg.com/ionicons@7.1.0/dist/svg/add.svg',
  });

  constructor(private airplaneDataService: AirplaneDataService, private cdr: ChangeDetectorRef, private mapAnnotationService: MapAnnotationService, private watchListService: WatchListService, private mapStateService: MapStateService) { }

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

  startCardExitTransition(event: MouseEvent): void {
    console.log('startCardExitTransition', event);

  }

  addToWatchlist(data: AnnotationData | undefined): void {
    if (!data) return;
    this.watchListService.updateWatchList(data);
  }
}
