import { haversineDistanceMeters, kmhToMs, msToKmh } from './geo.util';

describe('haversineDistanceMeters', () => {
  it('returns 0 for the same point', () => {
    const point = { latitude: 20.0056, longitude: 73.7891 };
    expect(haversineDistanceMeters(point, point)).toBeCloseTo(0, 3);
  });

  it('matches the known ~111.19km per degree of longitude at the equator', () => {
    const a = { latitude: 0, longitude: 0 };
    const b = { latitude: 0, longitude: 1 };
    expect(haversineDistanceMeters(a, b)).toBeCloseTo(111_195, -2);
  });

  it('is symmetric', () => {
    const a = { latitude: 20.0056, longitude: 73.7891 };
    const b = { latitude: 20.02, longitude: 73.795 };
    expect(haversineDistanceMeters(a, b)).toBeCloseTo(
      haversineDistanceMeters(b, a),
      6,
    );
  });

  it('computes a small realistic movement in the tens of meters', () => {
    const a = { latitude: 20.0056, longitude: 73.7891 };
    const b = { latitude: 20.0059, longitude: 73.7898 };
    const distance = haversineDistanceMeters(a, b);
    expect(distance).toBeGreaterThan(10);
    expect(distance).toBeLessThan(100);
  });
});

describe('speed unit conversions', () => {
  it('converts km/h to m/s and back', () => {
    expect(kmhToMs(36)).toBeCloseTo(10, 5);
    expect(msToKmh(10)).toBeCloseTo(36, 5);
  });
});
