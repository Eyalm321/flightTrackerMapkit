/// <reference lib="webworker" />


interface LatLng {
  lat: number;
  lng: number;
}

self.addEventListener('message', (event: MessageEvent<{ existingAnnotation: { data: any, coordinate: LatLng; }; newAnnotationData: any; }>) => {
  const { existingAnnotation, newAnnotationData } = event.data;

  if (!existingAnnotation || !newAnnotationData.coordinates) {
    return;
  }

  const startLat = existingAnnotation.data.last_pos ? existingAnnotation.data.last_pos.lat : existingAnnotation.coordinate.lat;
  const startLng = existingAnnotation.data.last_pos ? existingAnnotation.data.last_pos.lng : existingAnnotation.coordinate.lng;
  const endLat = newAnnotationData.coordinates.lat;
  const endLng = newAnnotationData.coordinates.lng;

  const duration = 4000; // Duration of the transition in milliseconds

  const easeInOutQuad = (t: number) => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  };

  const waypoints: LatLng[] = [];

  const precalculateWaypoints = () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const easedT = easeInOutQuad(t);
      const lat = startLat + (endLat - startLat) * easedT;
      const lng = startLng + (endLng - startLng) * easedT;
      waypoints.push({ lat, lng });
    }
  };

  precalculateWaypoints();
  postMessage({ type: 'waypointsReady', waypoints });

  let startTime: number;

  const updatePosition = (timestamp: number) => {
    if (!startTime) startTime = timestamp;
    const elapsedTime = timestamp - startTime;
    const fraction = elapsedTime / duration;
    const index = Math.floor(fraction * (waypoints.length - 1));

    if (fraction < 1) {
      postMessage({ type: 'updateCoordinate', coordinate: waypoints[index] });
    } else {
      postMessage({ type: 'finalCoordinate', coordinate: waypoints[waypoints.length - 1] });
    }
  };

  // Simulate animation loop by posting messages at desired frame rate (e.g., 60fps)
  const frameRate = 60;
  const intervalId = setInterval(() => {
    self.postMessage({ timestamp: performance.now() });
  }, 1000 / frameRate);

  self.onmessage = (event: MessageEvent) => {
    if (event.data === 'stop') {
      clearInterval(intervalId);
    }
  };
});
// This will be the content of annotation-transition.worker.ts
addEventListener('message', (event) => {
  const { start, end, duration, id } = event.data;
  let startTime;

  const easeInOutQuad = (t) => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  };

  const calculatePosition = (currentTime) => {
    if (!startTime) {
      startTime = currentTime;
    }
    const elapsedTime = currentTime - startTime;
    const fraction = elapsedTime / duration;
    const easedT = easeInOutQuad(fraction);
    const lat = start.lat + (end.lat - start.lat) * easedT;
    const lng = start.lng + (end.lng - start.lng) * easedT;
    return { lat, lng };
  };

  const tick = (currentTime) => {
    const position = calculatePosition(currentTime);
    postMessage({ position, id });
    if (currentTime - startTime < duration) {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
});
