const trackFlightsInBackground = async () => {
    let activeFlights = true;
    console.log('Tracking service started, checking for active flights');

    const intervalDuration = 120000; // Increased interval to 120 seconds
    const maxConcurrentFlights = 5; // Limit concurrent requests

    const interval = setInterval(async () => {
        const flights = JSON.parse(await CapacitorKV.get('watchlist') || '[]');
        console.log(`Checking ${flights.length} flights for updates`);

        if (flights.length > 0 && activeFlights) {
            activeFlights = false;

            // Process flights in batches
            for (let i = 0; i < flights.length; i += maxConcurrentFlights) {
                const flightBatch = flights.slice(i, i + maxConcurrentFlights);
                await Promise.all(flightBatch.map(async (id) => {
                    console.log(`Fetching data for flight ID: ${id}`);
                    try {
                        const baseUrl = 'https://api.adsb.lol';
                        const response = await fetch(`${baseUrl}/v2/icao/${id}`);
                        const data = await response.json();

                        if (data.ac && data.ac.length > 0) {
                            const currentAltitude = data.ac[0].alt_baro;
                            console.log(`Data retrieved for flight ${id}: Altitude: ${currentAltitude}`);
                            const currentStatus = mapAltitudeToStatus(currentAltitude);
                            const storedData = JSON.parse(await CapacitorKV.get(`flight_${id}`) || '{}');
                            const storedStatus = storedData.status;

                            // Consider using a more efficient storage solution for larger datasets
                            await storeData(`flight_${id}`, JSON.stringify({
                                status: currentStatus,
                                altitude: currentAltitude
                            }));

                            console.log('Flight updated:', id, currentStatus, currentAltitude);

                            if (currentStatus !== storedStatus) {
                                console.log(`Status change detected for flight ${id}: from ${storedStatus} to ${currentStatus}`);
                                let scheduleDate = new Date();
                                scheduleDate.setSeconds(scheduleDate.getSeconds() + 5);

                                await CapacitorNotifications.schedule({
                                    notifications: [{
                                        title: 'Flight Status Change',
                                        body: `Flight ${id} is now ${currentStatus}`,
                                        id: id,
                                        scheduleAt: scheduleDate,
                                    }]
                                });
                            }

                            if (currentStatus !== 'Grounded' && currentStatus !== 'Landing / Take off') {
                                activeFlights = true;
                            }
                        }
                    } catch (error) {
                        console.error('Error fetching flight data for flight ID', id, ':', error);
                    }
                }));
            }

            if (!activeFlights) {
                clearInterval(interval);
                console.log('All flights are landed or data not available. Stopping background tracking.');
                // Call completed() to signal task completion
                completed(); // Assuming this function exists within your background task framework
            }
        } else {
            clearInterval(interval);
            console.log('No flights to track. Stopping background tracking.');
            completed();
        }
    }, intervalDuration);
};

const storeData = async (key, value) => {
    console.log(`Storing data for ${key}`);
    try {
        await CapacitorKV.set(key, value);
        console.log(`Data stored for ${key}`);
    } catch (error) {
        console.error('Failed to save data:', key, error);
    }
};

const mapAltitudeToStatus = (altitude) => {
    if (altitude === 'ground') return 'Grounded';
    if (typeof altitude === 'number') {
        if (altitude < 5000) return 'Landing / Take off';
        if (altitude < 10000) return 'Ascending / Descending';
        if (altitude > 10000) return 'Cruising';
    }
    return 'Unknown';
};

addEventListener('startTracking', async (resolve, reject, args) => {
    try {
        const trackIds = Object.keys(args);
        console.log(`Start tracking called with ${trackIds.length} flights`);
        if (Object.keys(args).length > 0) {
            for (const id of trackIds) {
                const key = id;
                const value = args[id];
                await storeData(key, value);
            }
            await trackFlightsInBackground();
        }
        console.log('Tracking initiated.');
    } catch (error) {
        console.error('Failed to initiate tracking:', error);
    }
});
