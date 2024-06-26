import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eyalmizrachi.flightTrackerMapKit',
  appName: 'flightTrackerMapkit',
  webDir: 'www/browser',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    BackgroundRunner: {
      label: 'com.eyalmizrachi.flightTracker.watchlistTracker',
      src: 'shared/workers/watchlist-tracker.worker.js',
      event: 'startTracking',
      repeat: false,
      interval: 0,
      autoStart: false
    }
  }
};

export default config;
