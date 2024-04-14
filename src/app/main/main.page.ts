/// <reference path="../../typings/mapkit-js.d.ts" />

import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AnnotationData } from '../shared/services/map-annotation.service';
import { addIcons } from 'ionicons';
import { NavController } from '@ionic/angular';
import { MapComponent } from '../map/map.component';
import { IonicSharedModule } from '../shared/modules/ionic-shared.module';
import { MenuComponent } from '../menu/menu.component';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MapComponent,
    IonicSharedModule,
    MenuComponent
  ],
})
export class MainPage {
  visiblePlanesSum: number = 0;
  selectedAnnotationData?: AnnotationData;
  trackView: boolean = false;
  isLoading: boolean = true;
  contentId: string = "main-content";

  icons = addIcons({
    'arrow-back': 'https://unpkg.com/ionicons@7.1.0/dist/svg/arrow-back.svg',
    'navigate': 'https://unpkg.com/ionicons@7.1.0/dist/svg/navigate.svg',
    'logo-github': 'https://unpkg.com/ionicons@7.1.0/dist/svg/logo-github.svg',
    'help-circle': 'https://unpkg.com/ionicons@7.1.0/dist/svg/help-circle.svg'
  });

  constructor(
    private cdr: ChangeDetectorRef,
    private navigationController: NavController,
  ) { }


  navigateToAbout() {
    this.navigationController.navigateForward('main/about');
  }

  startLoading(): void {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }, Math.random() * 2000 + 500);
  }

}

