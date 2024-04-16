import * as runner from '@capacitor/background-runner';
import { LocalNotifications } from '@capacitor/local-notifications';
import CapacitorKV from '@capacitor/kv-storage';

const trackFlightsInBackground = async () => {
    const taskId = await runner.run({
        startTracking: async () => {
            let flights = JSON.parse(await CapacitorKV.get('watchlist') || '[]');
            if (flights.length > 0) {
                let activeFlights = false; // Track if any flights still need monitoring

                flights.forEach(async id => {
                    try {
                        const baseUrl = 'https://api.adsb.lol';
                        const response = await fetch(`${baseUrl}/v2/icao/${id}`);
                        const data = await response.json();

                        if (data.ac && data.ac.length > 0) {
                            const currentAltitude = data.ac[0].alt_baro;
                            const currentStatus = mapAltitudeToStatus(currentAltitude);
                            const storedData = JSON.parse(await CapacitorKV.get(`flight_${id}`) || '{}');
                            const storedStatus = storedData.status;

                            // Update the stored data
                            await storeData(`flight_${id}`, JSON.stringify({
                                status: currentStatus,
                                altitude: currentAltitude
                            }));

                            // Check for status change
                            if (currentStatus !== storedStatus) {
                                await LocalNotifications.schedule({
                                    notifications: [
                                        {
                                            title: 'Flight Status Change',
                                            body: `Flight ${id} is now ${currentStatus}`,
                                            id: id,
                                            schedule: { at: new Date(Date.now() + 1000) },
                                        }
                                    ]
                                });
                            }

                            // Determine if the flight still needs monitoring
                            if (currentStatus !== 'Grounded' && currentStatus !== 'Landing / Take off') {
                                activeFlights = true;
                            }
                        }
                    } catch (error) {
                        console.error('Error fetching flight data:', error);
                    }
                });

                // Stop the background task if no active flights
                if (!activeFlights) {
                    runner.stop(taskId);
                    console.log('All flights are landed or data not available. Stopping background tracking.');
                }
            } else {
                // No flights in the watchlist
                runner.stop(taskId);
                console.log('No flights to track. Stopping background tracking.');
            }
        },
        stop: () => {
            console.log('Background tracking stopped');
        }
    });

    return taskId;
};

const storeData = async (key, value) => {
    try {
        await CapacitorKV.set(key, value);
    } catch (error) {
        console.error('Failed to save data:', error);
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
        const hasData = !!args && Array.isArray(args.trackIds) && args.tracklist.length > 0;
        if (hasData) {
            for (flight of tracklist) {
                const key = flight.id;
                const value = JSON.stringify({
                    status: flight.status,
                    altitude: flight.altitude
                });
            }
            storeData(key, value).then(() => {
                trackFlightsInBackground();
            });
        }
        console.log('Tracking initiated.');
    } catch (error) {
        console.error('Failed:', error);
    }
});



// example response
// {"ac":[
// { "hex": "a13854", "type": "adsb_icao", "flight": "EJA178  ", "r": "N178QS", "t": "GL7T", "alt_baro": 47000, "alt_geom": 48300, "gs": 406.1, "ias": 223, "tas": 488, "mach": 0.856, "track": 248.17, "track_rate": 0.00, "roll": -0.18, "mag_heading": 250.49, "true_heading": 250.24, "baro_rate": 64, "geom_rate": 0, "squawk": "1602", "emergency": "none", "category": "A3", "nav_qnh": 1012.8, "nav_altitude_mcp": 47008, "nav_heading": 253.12, "lat": 34.628720, "lon": -92.327900, "nic": 8, "rc": 186, "seen_pos": 0.475, "version": 2, "nic_baro": 1, "nac_p": 10, "nac_v": 1, "sil": 3, "sil_type": "perhour", "gva": 2, "sda": 2, "alert": 0, "spi": 0, "mlat": [], "tisb": [], "messages": 82829, "seen": 0.5, "rssi": -30.0; }
// ]
// , "msg": "No error"
//     , "now": 1713301060425
//         , "total": 1
//             , "ctime": 1713301060425
//                 , "ptime": 0
// }
