/**
 * Haversine Formula for calculating distance between two coordinates
 * Useful as fallback when database distance data is not available
 */

interface Coordinate {
  latitude: number;
  longitude: number;
}

class HaversineService {
  /**
   * Calculate distance between two points using Haversine formula
   * @param coord1 First coordinate {latitude, longitude}
   * @param coord2 Second coordinate {latitude, longitude}
   * @returns Distance in kilometers
   */
  static calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
    
    const R = 6371; // Earth's radius in kilometers

    const dLat = this.toRad(coord2.latitude - coord1.latitude);
    const dLon = this.toRad(coord2.longitude - coord1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(coord1.latitude)) *
        Math.cos(this.toRad(coord2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return  Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Convert degrees to radians
   */
  private static toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Validate if coordinates are valid
   */
  static isValidCoordinate(coord: Partial<Coordinate>): coord is Coordinate {
    return (
      typeof coord.latitude === 'number' &&
      typeof coord.longitude === 'number' &&
      coord.latitude >= -90 &&
      coord.latitude <= 90 &&
      coord.longitude >= -180 &&
      coord.longitude <= 180
    );
  }

  /**
   * Calculate multiple distances from one point
   */
  static calculateDistances(
    baseCoord: Coordinate,
    destinationCoords: Coordinate[]
  ): number[] {
    return destinationCoords.map(coord => this.calculateDistance(baseCoord, coord));
  }
}

export default HaversineService;
