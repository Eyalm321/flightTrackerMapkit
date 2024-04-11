import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Http } from '@capacitor-community/http';
import { Platform } from '@ionic/angular';
import { environment } from 'src/environments/environment.prod';

export interface Aircraft {
    alert: number;
    alt_baro: number;
    alt_geom: number;
    baro_rate: number;
    category: string;
    emergency: string;
    flight: string;
    gs: number;
    gva: number;
    hex: string;
    lat: number;
    lon: number;
    messages: number;
    mlat: string[];
    nac_p: number;
    nac_v: number;
    nav_altitude_mcp: number;
    nav_heading: number;
    nav_qnh: number;
    nic: number;
    nic_baro: number;
    r: string;
    rc: number;
    rssi: number;
    sda: number;
    seen: number;
    seen_pos: number;
    sil: number;
    sil_type: string;
    spi: number;
    squawk: string;
    t: string;
    tisb: string[];
    track: number;
    type: string;
    version: number;
    geom_rate: number;
    dbFlags: number;
    nav_modes: string[];
    true_heading: number;
    ias: number;
    mach: number;
    mag_heading: number;
    oat: number;
    roll: number;
    tas: number;
    tat: number;
    track_rate: number;
    wd: number;
    ws: number;
    gpsOkBefore: number;
    gpsOkLat: number;
    gpsOkLon: number;
    lastPosition: {
        lat: number;
        lon: number;
        nic: number;
        rc: number;
        seen_pos: number;
    };
    rr_lat: number;
    rr_lon: number;
    calc_track: number;
    nav_altitude_fms: number;
}

export type Airport = {
    alt_feet: number;
    alt_meters: number;
    countryiso2: string;
    iata: string;
    icao: string;
    lat: number;
    location: string;
    lon: number;
    name: string;
};

export type FlightRoute = {
    _airport_codes_iata: string;
    _airports: Airport[];
    airline_code: string;
    airport_codes: string;
    callsign: string;
    number: string;
    plausible: number;
};

export type FlightRoutes = FlightRoute[];

export interface ApiResponse {
    ac: Aircraft[];
    ctime: number;
    msg: string;
    now: number;
    ptime: number;
    total: number;
}

@Injectable({
    providedIn: 'root'
})
export class AdsbService {
    private baseUrl = environment.adsb.baseUrl;
    private proxyPath = environment.adsb.proxyPath;

    constructor(private httpClient: HttpClient, private platform: Platform) { }

    getHeaders() {
        return {
            'Content-Type': 'application/json'
        };
    }

    getPiaAircrafts(): Observable<ApiResponse> {
        return this.sendHttpRequest(`/v2/pia`);
    }

    getMilAircrafts(): Observable<ApiResponse> {
        return this.sendHttpRequest(`/v2/mil`);
    }

    getLaddAircrafts(): Observable<ApiResponse> {
        return this.sendHttpRequest(`/v2/ladd`);
    }

    getSquawkAircrafts(squawk: string): Observable<ApiResponse> {
        return this.sendHttpRequest(`/v2/squawk/${squawk}`);
    }

    getAircraftType(type: string): Observable<ApiResponse> {
        return this.sendHttpRequest(`/v2/type/${type}`);
    }

    getAircraftRegistration(registration: string): Observable<ApiResponse> {
        return this.sendHttpRequest(`/v2/registration/${registration}`);
    }

    getAircraftIcao(icao: string): Observable<ApiResponse> {
        return this.sendHttpRequest(`/v2/icao/${icao}`);
    }

    getAircraftsByCallsign(callsign: string): Observable<ApiResponse> {
        return this.sendHttpRequest(`/v2/callsign/${callsign}`);
    }

    getAircraftsByLocation(lat: number, lon: number, radius: number = 250): Observable<ApiResponse> {
        let url = `/v2/lat/${lat}/lon/${lon}/dist/${radius}`;
        return this.sendHttpRequest(url);
    }

    getClosestAircraft(lat: number, lon: number, radius: number): Observable<ApiResponse> {
        return this.sendHttpRequest(`/v2/closest/${lat}/${lon}/${radius}`);
    }

    getAircraftsRouteset(arr: { callsign: string, lat: number, lon: number; }[]): Observable<FlightRoutes> {
        const body = {
            planes: arr.map(plane => ({
                callsign: plane.callsign.trim(),
                lat: plane.lat,
                lng: plane.lon
            }))
        };

        return this.sendHttpRequest(`/api/0/routeset`, 'POST', body);
    }

    private sendHttpRequest(url: string, method: 'GET' | 'POST' = 'GET', body?: any): Observable<any> {
        if (method === 'POST' && !body) {
            throw new Error('POST request requires a body.');
        }
        if (this.platform.is('capacitor')) {
            return new Observable(subscriber => {
                Http.request({
                    method: method,
                    url: `${this.baseUrl}${url}`,
                    headers: this.getHeaders(),
                    data: body ? JSON.stringify(body) : undefined,
                }).then(response => {
                    subscriber.next(response.data);
                    subscriber.complete();
                }).catch(error => {
                    subscriber.error(error);
                });
            });
        } else {
            if (method === 'GET') {
                return this.httpClient.get<ApiResponse>(`${this.proxyPath}${url}`);
            } else if (method === 'POST') {
                return this.httpClient.post<ApiResponse>(`${this.proxyPath}${url}`, body);
            } else {
                throw new Error(`HTTP method ${method} not implemented.`);
            }
        }
    }
}