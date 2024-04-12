import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AirplaneDataService {
  aircraftTypes = {
    A21N: 'airplane',
    CL30: 'business-jet',
    A321: 'airplane',
    A20N: 'airplane',
    A320: 'airplane',
    PC12: 'airplane',
    B739: 'airplane',
    B763: 'airplane',
    B737: 'airplane',
    AS50: 'helicopter',
    B39M: 'airplane',
    LJ35: 'business-jet',
    B407: 'helicopter',
    C172: 'airplane',
    AT8T: 'airplane',
    C750: 'business-jet',
    GLF4: 'business-jet',
    B77L: 'airplane',
    E75L: 'airplane',
    B38M: 'airplane',
    GLEX: 'business-jet',
    B752: 'airplane',
    A310: 'airplane',
    C25C: 'business-jet',
    CRJ9: 'airplane',
    A319: 'airplane',
    C525: 'business-jet',
    E545: 'airplane',
    B350: 'airplane',
    CRJ7: 'airplane',
    C560: 'business-jet',
    F2TH: 'business-jet',
    C700: 'airplane',
    BE20: 'airplane',
    RV7: 'airplane',
    BE9L: 'airplane',
    C82S: 'airplane',
    P28A: 'airplane',
    EA50: 'business-jet',
    C56X: 'business-jet',
    DA40: 'airplane',
    C310: 'airplane',
    C550: 'business-jet',
    PA46: 'airplane',
    SR20: 'airplane',
    TBM7: 'airplane',
    PZ4M: 'airplane',
    BCS3: 'airplane',
    G280: 'business-jet',
    BE30: 'airplane',
    C425: 'airplane',
    P32R: 'airplane',
    BE36: 'airplane',
    SR22: 'airplane',
    C25B: 'business-jet',
    PA18: 'airplane',
    BE35: 'airplane',
    H25B: 'business-jet',
    LJ45: 'business-jet',
    M20P: 'airplane',
    C72R: 'airplane',
    BT36: 'airplane',
    BE33: 'airplane',
    VELO: 'airplane',
    C152: 'airplane',
    T206: 'airplane',
    BE19: 'airplane',
    PA38: 'airplane',
    R22: 'business-jet',
    PA24: 'airplane',
    C68A: 'airplane',
    BE58: 'airplane',
    RV10: 'airplane',
    BE40: 'business-jet',
    C182: 'airplane',
    C180: 'airplane',
    TEX2: 'military-jet',
    C82T: 'airplane',
    LNP4: 'airplane',
    PA44: 'airplane',
    C208: 'airplane',
    BE18: 'airplane',
    S22T: 'airplane',
    B788: 'airplane',
    C150: 'airplane',
    GLF6: 'business-jet',
    A333: 'airplane',
    F900: 'business-jet',
    B789: 'airplane',
    BE95: 'airplane',
    RV14: 'airplane',
    FA50: 'business-jet',
    RV8: 'airplane',
    E55P: 'business-jet',
    SW4: 'airplane',
    C177: 'airplane',
    PA32: 'airplane',
    E50P: 'business-jet',
    A359: 'airplane',
    GL5T: 'business-jet',
    PA31: 'airplane',
    E6: 'military-jet',
    C17: 'military-jet',
    C130: 'military-jet',
    B762: 'airplane',
    H60: 'business-jet',
    K35R: 'military-jet',
    A400: 'military-jet',
    DHC6: 'airplane',
  };
  constructor() { }

  retrieveAirplaneImage(airplaneModel: string): string {
    const imagePath = `assets/images/card/models/${airplaneModel}.png`;
    const imageExists = this.checkIfImageExists(imagePath);
    if (imageExists) {
      return imagePath;
    } else {
      return this.getDefaultImage(airplaneModel);
    }
  }

  private checkIfImageExists(imagePath: string): boolean {
    try {
      const http = new XMLHttpRequest();
      http.open('HEAD', imagePath, false);
      http.send();
      return http.status !== 404;
    } catch (error) {
      return false;
    }
  }

  getDefaultImage(airplaneModel: string): string {
    const typeofAircraft = this.aircraftTypes[airplaneModel as keyof typeof this.aircraftTypes];
    if (typeofAircraft === 'airplane' || typeofAircraft === 'business-jet' || typeofAircraft === 'helicopter' || typeofAircraft === 'military-jet') {
      return `assets/images/card/${typeofAircraft}-silhouette.png`;
    } else {
      return `assets/images/card/airplane-silhouette.png`;
    }
  }

  isModelExists(airplaneModel: string): boolean {
    return this.aircraftTypes.hasOwnProperty(airplaneModel);
  }

  getAircraftTypeMarkerIcon(airplaneModel: string): string {
    const typeofAircraft = this.aircraftTypes[airplaneModel as keyof typeof this.aircraftTypes];
    if (typeofAircraft === 'airplane' || typeofAircraft === 'business-jet' || typeofAircraft === 'helicopter' || typeofAircraft === 'military-jet') {
      return `assets/icons/${typeofAircraft}.svg`;
    } else {
      return `assets/icons/airplane.svg`;
    }
  }
}