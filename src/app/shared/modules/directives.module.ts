import { Injectable, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LockDragDirectionDirective } from '../directives/lock-drag-direction.directive';
import { HAMMER_GESTURE_CONFIG, HammerGestureConfig } from '@angular/platform-browser';



@Injectable()
export class MyHammerConfig extends HammerGestureConfig {
  override overrides = <any>{
    'pan': { direction: Hammer.DIRECTION_DOWN },
    'swipe': { direction: Hammer.DIRECTION_DOWN }
  };
}


@NgModule({
  providers: [
    {
      provide: HAMMER_GESTURE_CONFIG,
      useClass: MyHammerConfig
    }
  ]
})
export class DirectivesModule { }
