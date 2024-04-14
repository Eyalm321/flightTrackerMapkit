import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Observable, Subject, map, of } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ThemeWatcherService {
    private themeChangedSubject: Subject<boolean> = new Subject<boolean>();
    themeChanged$: Observable<boolean> = this.themeChangedSubject.asObservable();

    constructor(@Inject(DOCUMENT) private document: Document) {
        this.listenToColorSchemeChanges();
    }


    listenToColorSchemeChanges(): Observable<boolean> {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        this.emitThemeChange(prefersDark.matches);
        prefersDark.addEventListener('change', (e) => this.emitThemeChange(e.matches));
        return of(prefersDark.matches);
    }

    private emitThemeChange(isDarkMode: boolean): void {
        this.themeChangedSubject.next(isDarkMode);
    }
}