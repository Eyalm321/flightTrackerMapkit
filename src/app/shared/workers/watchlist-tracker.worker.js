const trackFlightsInBackground = async (resolve, reject, completed) => {
    let activeFlights = true;
    console.log('Tracking service started, checking for active flights');

    const intervalDuration = 20000; // Interval duration in milliseconds (120 seconds)
    const maxConcurrentFlights = 5; // Limit of concurrent flight requests

    const interval = setInterval(async () => {
        let flightsData = await CapacitorKV.get('flight_ids').value;
        const flights = flightsData.split(',').filter(id => id.trim() !== '');

        console.log(`Checking ${flights.length} flights`);
        console.log(`Flight IDs: ${JSON.stringify(flights)}`);

        if (flights.length > 0 && activeFlights) {
            activeFlights = false;

            for (let i = 0; i < flights.length; i += maxConcurrentFlights) {
                const flightBatch = flights.slice(i, i + maxConcurrentFlights);

                await Promise.all(flightBatch.map(id => fetchFlightData(id)))
                    .then((results) => {
                        results.forEach(({ id, currentStatus, currentAltitude, callsign }) => {
                            processFlightStatus(id, currentStatus, currentAltitude, callsign);
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

async function fetchFlightData(id) {
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
}

async function processFlightStatus(id, currentStatus, currentAltitude, callsign) {
    console.log(`Data retrieved for flight ${id}: Altitude: ${currentAltitude}`);
    const storedStatus = await CapacitorKV.get(id).value;

    if (currentStatus !== storedStatus) {
        console.log(`Status change detected for flight ${id}: from ${storedStatus} to ${currentStatus}`);
        await storeData(id, currentStatus);
        notifyStatusChange(id, currentStatus, callsign);
    }
}

async function notifyStatusChange(id, currentStatus, callsign) {
    let scheduleDate = new Date();
    scheduleDate.setSeconds(scheduleDate.getSeconds() + 5);
    await CapacitorNotifications.schedule({
        notifications: [{
            title: 'Flight Status Change',
            body: `Flight ${callsign} is now ${currentStatus}`,
            id,
            scheduleAt: scheduleDate,
        }]
    });
}

const storeData = async (key, value) => {
    console.log(`Storing data for ${key}`);
    try {
        console.log(`Storing data for ${key}: ${value}`);
        await CapacitorKV.set(key, value);
        const savedData = await CapacitorKV.get(key);
        console.log(`Data stored for ${key}: ${savedData.value}`);
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
