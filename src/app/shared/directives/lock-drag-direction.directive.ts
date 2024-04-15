import { Directive, ElementRef, HostListener } from '@angular/core';
import * as Hammer from 'hammerjs';

@Directive({
    selector: '[appLockDragDirection]'
})
export class LockDragDirectionDirective {
    private hammer: HammerManager;

    constructor(private el: ElementRef) {
        this.hammer = new Hammer(this.el.nativeElement), { reconizers: [[Hammer.Swipe, { direction: Hammer.DIRECTION_DOWN }], [Hammer.Pan, { direction: Hammer.DIRECTION_DOWN }]] };
        this.hammer.get('pan').set({ direction: Hammer.DIRECTION_DOWN });

    }

    @HostListener('pan', ['$event'])
    onPan(event: HammerInput) {
        console.log('Panning', event);

        const deltaY = event.deltaY;
        const isDraggingDown = deltaY > 0;

        if (isDraggingDown) {
            this.el.nativeElement.style.transform = `translateY(${deltaY}px)`;
        }
    }
}
