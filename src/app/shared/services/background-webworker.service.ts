import { Injectable } from '@angular/core';
import { BackgroundRunner } from '@capacitor/background-runner';

@Injectable({
  providedIn: 'root'
})
export class BackgroundWebworkerService {
  private tasks: Map<string, { workerId: string; }> = new Map();

  constructor() { }

  public async startBackgroundTask(workerId: string, eventName: string, data: { [key: string]: string; }): Promise<any> {
    console.log(`Starting background task for event: ${eventName}, workerId: ${workerId}, data: ${JSON.stringify(data)}`);

    if (!this.tasks.has(eventName)) {
      const value = await BackgroundRunner.dispatchEvent({
        label: workerId,
        event: eventName,
        details: data,
      });

      this.tasks.set(eventName, { workerId });
      console.log(`Watchlist Value: ${JSON.stringify(value)}`);
      console.log(`Background task started for event: ${eventName} with wokerId: ${workerId}`);
      return value;
    } else {
      console.log(`Task already running for event: ${eventName}`);
    }
  }
}
