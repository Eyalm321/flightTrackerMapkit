import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { IonicSharedModule } from '../shared/modules/ionic-shared.module';
import { IonList, IonItem, IonListHeader } from "@ionic/angular/standalone";

export interface Flight {
  id: string;
  flight: string;
  origin: string;
  destination: string;
  status: string;
}

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonListHeader, IonItem, IonList,
    CommonModule,
    IonicSharedModule,
  ],
})
export class MenuComponent {
  @Input() contentId?: string;
  flights?: Flight[] = [
    {
      id: '1',
      flight: 'AA123',
      origin: 'New York',
      destination: 'Los Angeles',
      status: 'On Time',
    },
    {
      id: '2',
      flight: 'DL456',
      origin: 'Chicago',
      destination: 'Miami',
      status: 'Delayed',
    },
    {
      id: '3',
      flight: 'UA789',
      origin: 'San Francisco',
      destination: 'Seattle',
      status: 'Cancelled',
    },
    {
      id: '4',
      flight: 'BA234',
      origin: 'London',
      destination: 'Paris',
      status: 'On Time',
    },
    {
      id: '5',
      flight: 'LH567',
      origin: 'Berlin',
      destination: 'Rome',
      status: 'On Time',
    },
  ];

  constructor() { }

  navigateToGithub(): void {
    window.open('https://github.com/Eyalm321/flightTrackerMapkit', '_blank');
  }

}
