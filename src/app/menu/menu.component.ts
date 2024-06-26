import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { IonicSharedModule } from '../shared/modules/ionic-shared.module';
import { IonList, IonItem, IonListHeader, IonRow, IonCol } from "@ionic/angular/standalone";
import { AnnotationData } from '../shared/services/map-annotation.service';
import { WatchListService } from '../shared/services/watch-list.service';
import { AnimationOptions, LottieComponent } from 'ngx-lottie';
import { AnimationItem } from 'lottie-web';
import { LocalNotificationsService } from '../shared/services/local-notifications.service';

export interface Flight {
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
  imports: [IonCol, IonRow, IonListHeader, IonItem, IonList,
    CommonModule,
    IonicSharedModule,
    LottieComponent,
  ],
})
export class MenuComponent implements OnInit {
  @Input() contentId?: string;
  watchList: Flight[] = [];

  lottieOptions: AnimationOptions;

  constructor(private watchListService: WatchListService, private cdr: ChangeDetectorRef, private localNotificationsService: LocalNotificationsService) {
    this.lottieOptions = {
      path: '/assets/animations/lottie/radar.json',
    };
  }

  ngOnInit(): void {
    this.watchListService.watchList$.subscribe((watchList: Flight[]) => {
      this.watchList = watchList;
      this.localNotificationsService.displayLocalNotification({
        title: `Flight ${watchList[0].flight} Added`, body: 'You will get a notification when the flight status changes',
        id: watchList[0].flight,
        data: undefined
      });
      this.cdr.detectChanges();
    });
  }

  navigateToGithub(): void {
    window.open('https://github.com/Eyalm321/flightTrackerMapkit', '_blank');
  }

  animationCreated(animationItem: AnimationItem): void {
    console.log(animationItem);
  }
}
