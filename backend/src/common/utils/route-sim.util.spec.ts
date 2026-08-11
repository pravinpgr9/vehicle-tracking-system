import { buildLegLocations, summarizeTrip } from './route-sim.util';

const NASHIK = { latitude: 20.0056, longitude: 73.7891 };
const MALEGAON = { latitude: 20.5579, longitude: 74.5288 };

describe('buildLegLocations', () => {
  it('starts and ends exactly at the given points, at speed 0', () => {
    const locations = buildLegLocations(NASHIK, MALEGAON, new Date(0), 40);
    expect(locations[0]).toMatchObject({ ...NASHIK, speed: 0 });
    expect(locations.at(-1)).toMatchObject({ ...MALEGAON, speed: 0 });
  });

  it('includes a stop (repeated coordinates, speed 0) partway through', () => {
    const locations = buildLegLocations(NASHIK, MALEGAON, new Date(0), 40);
    const stopIndex = locations.findIndex(
      (loc, i) => i > 0 && i < locations.length - 1 && loc.speed === 0,
    );
    expect(stopIndex).toBeGreaterThan(0);
    expect(locations[stopIndex].latitude).toBe(
      locations[stopIndex + 1].latitude,
    );
    expect(locations[stopIndex].longitude).toBe(
      locations[stopIndex + 1].longitude,
    );
    expect(locations[stopIndex].recordedAt.getTime()).toBeLessThan(
      locations[stopIndex + 1].recordedAt.getTime(),
    );
  });

  it('produces strictly increasing timestamps', () => {
    const locations = buildLegLocations(NASHIK, MALEGAON, new Date(0), 40);
    for (let i = 1; i < locations.length; i++) {
      expect(locations[i].recordedAt.getTime()).toBeGreaterThan(
        locations[i - 1].recordedAt.getTime(),
      );
    }
  });
});

describe('summarizeTrip', () => {
  it('computes a total distance close to the direct distance for a cruise-speed trip', () => {
    const locations = buildLegLocations(NASHIK, MALEGAON, new Date(0), 40);
    const summary = summarizeTrip(locations);
    // ~98.5km straight-line; the summed per-segment haversine is very close.
    expect(summary.distanceMeters).toBeGreaterThan(97_000);
    expect(summary.distanceMeters).toBeLessThan(100_000);
    expect(summary.maxSpeed).toBe(40);
  });

  it('returns 0 average speed for a zero-duration single-point trip', () => {
    const summary = summarizeTrip([
      { ...NASHIK, speed: 0, recordedAt: new Date(0) },
    ]);
    expect(summary.averageSpeed).toBe(0);
    expect(summary.distanceMeters).toBe(0);
  });
});
