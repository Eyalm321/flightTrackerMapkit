import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonChip, IonFab, IonFabButton, IonIcon, IonProgressBar, IonButtons, IonButton } from '@ionic/angular/standalone';


@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonChip,
    IonFab,
    IonFabButton,
    IonIcon,
    IonProgressBar,
    IonButtons,
    IonButton,
  ],
  exports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonChip,
    IonFab,
    IonFabButton,
    IonIcon,
    IonProgressBar,
    IonButtons,
    IonButton,
  ]
})
export class IonicSharedModule { }
