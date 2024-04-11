import { Component, OnInit } from '@angular/core';
import { MainPage } from '../main/main.page';
import { IonNav } from "@ionic/angular/standalone";

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss'],
  standalone: true,
  imports: [IonNav]
})
export class NavComponent {
  mainComponent = MainPage;
  constructor() { }
}
