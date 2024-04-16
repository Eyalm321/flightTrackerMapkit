import { Injectable } from '@angular/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

@Injectable({
  providedIn: 'root'
})
export class LocalNotificationsService {

  constructor() {
    this.initPushNotifications().catch(console.error);
  }

  async initPushNotifications(): Promise<void> {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      throw new Error('User denied permissions!');
    }

    await PushNotifications.register();
    this.setupListeners();
  }

  private setupListeners(): void {
    PushNotifications.addListener('pushNotificationReceived',
      async (notification: PushNotificationSchema) => {
        console.log('Notification received: ' + JSON.stringify(notification));
        // Displaying the notification using Local Notifications
        await this.displayLocalNotification(notification);
      }
    );
  }

  async displayLocalNotification(notification: PushNotificationSchema): Promise<void> {
    await LocalNotifications.schedule({
      notifications: [{
        title: notification.title || "No title",
        body: notification.body || "No body",
        id: new Date().getTime(),
        schedule: { at: new Date(new Date().getTime() + 1000) }, // Schedule for immediate display
        actionTypeId: "",
        extra: null
      }]
    });
  }
}
