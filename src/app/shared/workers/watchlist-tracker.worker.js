const trackFlightsInBackground = async (resolve, reject, completed) => {
    let activeFlights = true;
    console.log('Tracking service started, checking for active flights');

    const intervalDuration = 120000; // Increased interval to 120 seconds
    const maxConcurrentFlights = 5; // Limit concurrent requests

    const interval = setInterval(async () => {
        let flights = await getAllFlightIds(); // Retrieve all flight IDs
        console.log('All flight IDs:', flights);
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
                        resolve();
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

const getAllFlightIds = async () => {
    try {
        const idsJson = await CapacitorKV.get('flight_ids');
        return JSON.parse(idsJson || '[]');
    } catch (error) {
        console.error('Failed to retrieve flight IDs:', error);
        return [];
    }
};

const storeData = async (key, value) => {
    console.log(`Storing data for ${key}`);
    try {
        await CapacitorKV.set(key, value);
        const savedData = await CapacitorKV.get(key);
        console.log(`Data stored for ${key}: ${savedData}`);
        if (key.startsWith('flight_')) {
            const existingIdsArr = JSON.parse(await CapacitorKV.get('flight_ids') || '[]');
            if (!existingIdsArr.includes(key)) {
                existingIdsArr.push(key);
            }
            console.log(existingIdsArr);
            const str = JSON.stringify(existingIdsArr);
            console.log(`Storing flight IDs: ${str}`);
            await CapacitorKV.set('flight_ids', JSON.stringify(existingIdsArr));
        }

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
        console.log('Received startTracking event with args:', JSON.stringify(args));
        const trackIds = Object.keys(args);
        console.log(`Start tracking called with ${trackIds.length} flights`);
        if (Object.keys(args).length > 0) {
            for (const id of trackIds) {
                const key = `flight_${id}`;
                const value = args[id];
                console.log(`Storing data for flight ID: ${key}, value: ${JSON.stringify(value)}`);
                await storeData(key, value);
            }
            await trackFlightsInBackground(resolve, reject, () => {
                console.log('Background tracking completed');
            });
        }
        console.log('Tracking initiated.');
        resolve();
    } catch (error) {
        console.error('Failed to initiate tracking:', error);
        reject();
    }
});
