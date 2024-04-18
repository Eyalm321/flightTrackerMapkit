const trackFlightsInBackground = async (resolve, reject, completed) => {
    let activeFlights = true;
    console.log('Tracking service started, checking for active flights');

    const intervalDuration = 20000; // Interval duration in milliseconds (20 seconds)
    const maxConcurrentFlights = 5; // Limit of concurrent flight requests

    const interval = setInterval(async () => {
        let flightsData = await CapacitorKV.get('flight_ids').value;
        const flights = flightsData.split(',').filter(id => id.trim() !== '');

        console.log(`Checking ${flights.length} flights`);
        console.log(`Flight IDs: ${JSON.stringify(flights)}`);

        if (flights.length > 0) {
            activeFlights = false; // Assume no flights are active initially

            for (let i = 0; i < flights.length; i += maxConcurrentFlights) {
                const flightBatch = flights.slice(i, i + maxConcurrentFlights);

                await Promise.all(flightBatch.map(id => fetchFlightData(id)))
                    .then((results) => {
                        results.forEach(({ id, currentStatus, currentAltitude, callsign }) => {
                            processFlightStatus(id, currentStatus, currentAltitude, callsign);
                            if (currentStatus !== 'Grounded') {
                                activeFlights = true; // Mark as active if any flight is not grounded
                            }
                        });
                    })
                    .catch(error => {
                        console.error('Failed to process flight batch:', error);
                    });
            }

            if (!activeFlights) {
                clearInterval(interval);
                console.log('All flights are landed or data not available. Stopping background tracking.');
                completed();
            }
        } else {
            clearInterval(interval);
            console.log('No flights to track. Stopping background tracking.');
            completed();
        }
    }, intervalDuration);
};

const fetchFlightData = async (id) => {
    console.log(`Fetching data for flight ID: ${id}`);
    const response = await fetch(`https://api.adsb.lol/v2/icao/${id}`);
    if (!response.ok) throw new Error(`Failed to fetch data for flight ${id}: ${response.statusText}`);
    const data = await response.json();
    console.log(`Data retrieved for flight ${id}: ${JSON.stringify(data)}`);
    flightDetails = data['ac'][0];
    console.log(`Flight details for ${id}: ${JSON.stringify(flightDetails)}`);
    console.log(`Flight details for ${id}: ${JSON.stringify(flightDetails.alt_baro)}`);
    console.log(`Length of ac: ${data['ac'].length}`);
    const currentAltitude = flightDetails.alt_baro || 'ground';
    const currentStatus = mapAltitudeToStatus(currentAltitude);
    const callsign = flightDetails.flight || 'N/A';
    return { id, currentStatus, currentAltitude, callsign };
};

const processFlightStatus = async (id, currentStatus, currentAltitude, callsign) => {
    console.log(`Data retrieved for flight ${id}: Altitude: ${currentAltitude}`);
    let storedStatus = await CapacitorKV.get(`flight_${id}`).value.trim().replace(/^"|"$/g, '');
    console.log(`Stored status for flight ${id}: ${storedStatus}`);
    console.log(`Current status for flight ${id}: ${currentStatus}`);
    storedStatus = storedStatus || 'Unknown';  // Default to 'Unknown' if no value is stored
    notifyStatusChange(id, currentStatus, callsign);
    if (currentStatus !== storedStatus) {
        console.log(`Status change detected for flight ${id}: from ${storedStatus} to ${currentStatus}`);
        await storeData(id, currentStatus);
        notifyStatusChange(id, currentStatus, callsign);
    }
};


const notifyStatusChange = async (id, currentStatus, callsign) => {
    return new Promise((resolve, reject) => {
        try {
            let scheduleDate = new Date();
            scheduleDate.setSeconds(scheduleDate.getSeconds() + 5); // Schedules the notification 5 seconds from now

            // Generate a random integer ID for the notification
            const notificationId = getRandomInt(100000, 999999);
            console.log(`Scheduling notification for flight ${callsign} with notification ID ${notificationId}`);
            CapacitorNotifications.schedule([
                {
                    id: notificationId, // Randomly generated unique integer ID
                    title: `Flight Status Change for ${callsign}`,
                    body: `Status: ${currentStatus}`,
                    scheduleAt: scheduleDate,
                }
            ]);
        } catch (err) {
            console.error(`An error occurred in notifyStatusChange: ${err}`);
            reject(err); // Handle any unexpected errors
        }
    });
};

const getRandomInt = (min, max) => {
    // Create a buffer for one 32-bit unsigned integer
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);

    // Scale the number to the range (min, max)
    const range = max - min + 1;
    return min + (buffer[0] % range);
};

const storeData = async (key, value) => {
    console.log(`Storing data for ${key}`);
    try {
        console.log(`Storing data for ${key}: ${value}`);
        await CapacitorKV.set(key, value);
        const savedData = await CapacitorKV.get(key);
        console.log(`Data stored for ${key}: ${savedData.value}`);

        if (key.startsWith('flight_') && savedData.value === undefined && value === undefined) {
            await CapacitorKV.set(`${key}`, 'Unknown'); // Default status
        } else if (key.startsWith('flight_') && savedData.value === undefined && value !== undefined) {
            await CapacitorKV.set(`${key}`, value);
        }

        if (key.startsWith('flight_')) {
            let existingIdsData = await CapacitorKV.get('flight_ids').value;
            if (!existingIdsData.includes(key.replace('flight_', ''))) {
                existingIdsData += `,${key.replace('flight_', '')}`; // Append the new ID
                await CapacitorKV.set('flight_ids', existingIdsData);
                console.log("Stored flight_ids (raw):", await CapacitorKV.get('flight_ids').value);
            }
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
            CapacitorKV.set('flight_ids', '');
            const storePromises = trackIds.map(id => {
                const key = `flight_${id}`;
                const value = JSON.stringify(args[id]);
                console.log(`Storing data for flight ID: ${id} ${key}, value: ${value}`);
                return storeData(key, value);
            });

            await Promise.all(storePromises);

            await trackFlightsInBackground(resolve, reject, () => {
                console.log('Background tracking completed');
                resolve();
            });
        }
        console.log('Tracking initiated.');
        resolve();
    } catch (error) {
        console.error('Failed to initiate tracking:', error);
        reject();
    }
});
