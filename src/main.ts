import { APP_INITIALIZER, enableProdMode, importProvidersFrom, isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { HttpClientModule } from '@angular/common/http';
import { MapkitService } from './app/shared/services/mapkit.service';
import { provideServiceWorker } from '@angular/service-worker';
import 'hammerjs';
import { provideLottieOptions } from 'ngx-lottie';
import player from 'lottie-web';

export function initializeMapKit(mapkitService: MapkitService): () => Promise<void> {
  return () => mapkitService.loadMapkit();  // Returns a Promise
}

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes),
    importProvidersFrom(HttpClientModule),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeMapKit,
      deps: [MapkitService],
      multi: true
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
    provideLottieOptions({
      player: () => import('lottie-web'),
    }),
  ],
});
