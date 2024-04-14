/// <reference lib="webworker" />

interface LatLng {
  lat: number;
  lng: number;
}

self.addEventListener('message', (event: MessageEvent<{ task: string; payload: { id: string; waypoints: LatLng[]; duration: number; }; }>) => {
  const { task, payload } = event.data;

  if (task === 'startTransition') {
    const { id, waypoints, duration } = payload;
    let startTime: number | null = null;
    let currentWaypointIndex = 0;

    const updatePosition = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsedTime = timestamp - startTime;
      const fraction = elapsedTime / duration;
      const index = Math.floor(fraction * (waypoints.length - 1));

      if (index !== currentWaypointIndex) {
        postMessage({ type: 'updateCoordinate', id, coordinate: waypoints[index] });
        currentWaypointIndex = index;
      }

      if (fraction < 1) {
        requestAnimationFrame(updatePosition);
      } else {
        postMessage({ type: 'finalCoordinate', id, coordinate: waypoints[waypoints.length - 1] });
      }
    };

    requestAnimationFrame(updatePosition);
  }
});
