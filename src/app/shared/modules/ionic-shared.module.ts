import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonChip, IonFab, IonFabButton, IonIcon, IonProgressBar, IonButtons, IonButton, IonMenu, IonMenuButton, IonMenuToggle, IonGrid, IonList, IonLabel } from '@ionic/angular/standalone';


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
    IonMenu,
    IonMenuButton,
    IonMenuToggle,
    IonList,
    IonLabel,
    IonGrid
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
    IonMenu,
    IonMenuButton,
    IonMenuToggle,
    IonList,
    IonLabel,
    IonGrid
  ]
})
export class IonicSharedModule { }
