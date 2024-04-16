import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'flightTrackerMapkit',
  webDir: 'www/browser',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    BackgroundRunner: {
      label: 'com.eyalmizrachi.flightTracker.watchlistTracker',
      src: '../shared/workers/watchlist-tracker.worker.js',
      event: 'track',
      repeat: true,
      interval: 5,
      autoStart: false
    }
  }
};

export default config;
