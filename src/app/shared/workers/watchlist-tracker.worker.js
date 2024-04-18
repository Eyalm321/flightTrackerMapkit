const trackFlightsInBackground = async (completed) => {
    let activeFlights = false;

    const intervalDuration = 20000;
    const maxConcurrentFlights = 5;

    const interval = setInterval(async () => {
        let flightsData = await CapacitorKV.get('flight_ids').value;
        const flights = flightsData.split(',').filter(id => id.trim() !== '');
        if (flights.length > 0) {
            for (let i = 0; i < flights.length; i += maxConcurrentFlights) {
                const flightBatch = flights.slice(i, i + maxConcurrentFlights);
                try {
                    const results = await Promise.all(flightBatch.map(id => fetchFlightData(id)));
                    results.forEach(({ id, currentStatus, callsign }) => {
                        processFlightStatus(id, currentStatus, callsign);
                        if (currentStatus !== 'Grounded' && currentStatus !== 'Unknown') {
                            activeFlights = true;
                        }
                    });
                } catch (error) {
                    console.error('Failed to process flight batch:', error);
                }
            }

            console.log('Processing watchlist...');
            clearInterval(interval);
            const watchlist = await retrieveFlightsFromStorage();
            console.log('Watchlist processed:', watchlist);
            completed(watchlist);

            if (!activeFlights) {
                await deleteFlightsFromStorage();
                clearInterval(interval);
                completed(watchlist);
            }
        } else {
            const watchlist = await retrieveFlightsFromStorage();
            await deleteFlightsFromStorage();
            clearInterval(interval);
            completed(watchlist);
        }
    }, intervalDuration);
};


const retrieveFlightsFromStorage = async () => {
    let watchlist = {};
    const watchlistIds = await CapacitorKV.get('flight_ids').value;

    if (watchlistIds) {
        const ids = watchlistIds.split(',').filter(id => id.trim() !== '');

        for (const id of ids) {
            const value = await CapacitorKV.get(`flight_${id}`).value;
            watchlist[id] = value;  // Assign the retrieved value directly to the watchlist object.
        }
    }

    return watchlist;
};

const deleteFlightsFromStorage = async () => {
    const watchlistIds = await CapacitorKV.get('flight_ids').value;

    if (watchlistIds) {
        const ids = watchlistIds.split(',').filter(id => id.trim() !== '');

        for (const id of ids) {
            await CapacitorKV.delete(`flight_${id}`);  // Delete the flight entry after processing.
        }

        // Optionally reset the flight_ids after all individual flights are deleted.
        await CapacitorKV.set('flight_ids', '');
    }
};

const fetchFlightData = async (id) => {
    const response = await fetch(`https://api.adsb.lol/v2/icao/${id}`);
    if (!response.ok) throw new Error(`Failed to fetch data for flight ${id}: ${response.statusText}`);
    const data = await response.json();
    flightDetails = data['ac'][0];
    const currentAltitude = flightDetails.alt_baro || 'ground';
    const currentStatus = mapAltitudeToStatus(currentAltitude);
    const callsign = flightDetails.flight || 'N/A';
    return { id, currentStatus, callsign };
};

const processFlightStatus = async (id, currentStatus, callsign) => {
    let storedStatus = await CapacitorKV.get(`flight_${id}`).value.trim().replace(/^"|"$/g, '');
    storedStatus = storedStatus || 'Unknown';
    notifyStatusChange(id, currentStatus, callsign);
    if (currentStatus !== storedStatus) {
        await storeData(id, currentStatus);
        notifyStatusChange(id, currentStatus, callsign);
    }
};

const notifyStatusChange = async (id, currentStatus, callsign) => {
    return new Promise((resolve, reject) => {
        try {
            let scheduleDate = new Date();
            scheduleDate.setSeconds(scheduleDate.getSeconds() + 5);
            const notificationId = getRandomInt(100000, 999999);
            CapacitorNotifications.schedule([
                {
                    id: notificationId,
                    title: `Flight Status Change for ${callsign}`,
                    body: `Status: ${currentStatus}`,
                    scheduleAt: scheduleDate,
                },
            ]);
            resolve();
        } catch (err) {
            console.error(`An error occurred in notifyStatusChange: ${err}`);
            reject(err);
        }
    });
};

const getRandomInt = (min, max) => {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    const range = max - min + 1;
    return min + (buffer[0] % range);
};

const storeData = async (key, value) => {
    try {
        await CapacitorKV.set(key, value);
        const savedData = await CapacitorKV.get(key);

        if (key.startsWith('flight_') && savedData.value === undefined && value === undefined) {
            await CapacitorKV.set(`${key}`, 'Unknown');
        } else if (key.startsWith('flight_') && savedData.value === undefined && value !== undefined) {
            await CapacitorKV.set(`${key}`, value);
        }

        if (key.startsWith('flight_')) {
            let existingIdsData = await CapacitorKV.get('flight_ids').value;
            if (!existingIdsData.includes(key.replace('flight_', ''))) {
                existingIdsData += `,${key.replace('flight_', '')}`;
                await CapacitorKV.set('flight_ids', existingIdsData);
            }
        }
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
        if (Object.keys(args).length > 0) {
            CapacitorKV.set('flight_ids', '');
            const storePromises = trackIds.map(id => {
                const key = `flight_${id}`;
                const value = JSON.stringify(args[id]);
                return storeData(key, value);
            });

            await Promise.all(storePromises);
            await trackFlightsInBackground((watchlist) => {
                console.log('Flight tracking completed.', watchlist);
                resolve(watchlist);
            });
        } else {
            console.log('No flights to track. Stopping background tracking.');
            reject();
        }
    } catch (error) {
        console.error('Failed to initiate tracking:', error);
        reject();
    }
});