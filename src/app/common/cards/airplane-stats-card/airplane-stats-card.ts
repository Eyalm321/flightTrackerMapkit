import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { IonIcon, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonCardSubtitle } from "@ionic/angular/standalone";
import { addIcons } from 'ionicons';
import { AnnotationData } from 'src/app/shared/services/map-annotation.service';

@Component({
  selector: 'app-airplane-stats-card',
  templateUrl: './airplane-stats-card.html',
  styleUrls: ['./airplane-stats-card.scss'],
  standalone: true,
  imports: [IonIcon, CommonModule, IonCard, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonCardSubtitle]
})
export class AirplaneStatsCardComponent {
  @Input() selectedAnnotation?: AnnotationData;

  icons = addIcons({
    'stopwatch-outline': 'https://unpkg.com/ionicons@7.1.0/dist/svg/stopwatch-outline.svg'
  });

  constructor() { }

}
