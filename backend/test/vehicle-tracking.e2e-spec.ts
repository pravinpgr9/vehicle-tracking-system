import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { TripDetectionService } from '../src/trips/trip-detection.service';

const HOME = { latitude: 20.0056, longitude: 73.7891 };
const AWAY = { latitude: 20.02, longitude: 73.8 };
const SECONDS = 1000;

/**
 * End-to-end: register -> login -> vehicle -> device -> GPS ingestion ->
 * trip start (2 consecutive moving points) -> geofence exit -> alert ->
 * trip completion (sweep, invoked directly rather than waiting out the
 * real interval). Runs against a real database (see DEVELOPMENT.md).
 */
describe('Vehicle tracking (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `e2e-${Date.now()}@example.com`;

  let accessToken: string;
  let vehicleId: string;
  let deviceToken: string;

  beforeAll(async () => {
    // Short-circuits the trip-completion sweep to well under a second so
    // the test doesn't wait out the real TRIP_END_STOP_MINUTES.
    process.env.TRIP_END_STOP_MINUTES = '0.01';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('registers a user', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'E2E Test User', email, password: 'Str0ngPass!' })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    accessToken = response.body.data.accessToken;
  });

  it('creates a vehicle', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'E2E Car', registrationNumber: 'E2E-0001' })
      .expect(201);

    vehicleId = response.body.data.id;
    expect(vehicleId).toEqual(expect.any(String));
  });

  it('registers a device and receives a one-time token', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/vehicles/${vehicleId}/devices`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        deviceType: 'PHONE',
        deviceIdentifier: `e2e-device-${Date.now()}`,
      })
      .expect(201);

    deviceToken = response.body.data.token;
    expect(deviceToken).toEqual(expect.any(String));
  });

  it('creates a Home geofence', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/geofences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Home', ...HOME, radiusMeters: 200 })
      .expect(201);
  });

  it('rejects a GPS point authenticated with the wrong device token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tracking/location')
      .set('Authorization', 'Device not-a-real-token')
      .send({
        deviceId: 'whatever',
        vehicleId,
        ...HOME,
        speed: 20,
        recordedAt: new Date().toISOString(),
      })
      .expect(401);
  });

  it('ingests GPS points, starts a trip, and exits the Home geofence', async () => {
    let deviceIdentifier: string;
    {
      const devices = await request(app.getHttpServer())
        .get(`/api/v1/vehicles/${vehicleId}/devices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      deviceIdentifier = devices.body.data[0].deviceIdentifier;
    }

    const send = (
      point: { latitude: number; longitude: number },
      speed: number,
      recordedAt: Date,
    ) =>
      request(app.getHttpServer())
        .post('/api/v1/tracking/location')
        .set('Authorization', `Device ${deviceToken}`)
        .send({
          deviceId: deviceIdentifier,
          vehicleId,
          ...point,
          speed,
          recordedAt: recordedAt.toISOString(),
        })
        .expect(201);

    const now = Date.now();
    // Two consecutive moving points inside the geofence: starts a trip.
    await send(HOME, 20, new Date(now - 30 * SECONDS));
    await send(
      { latitude: 20.006, longitude: 73.7895 },
      22,
      new Date(now - 20 * SECONDS),
    );
    // Far enough away, and >10s later (past GPS_MAX_JUMP_SECONDS), to exit
    // the geofence without tripping the implausible-jump check.
    await send(AWAY, 40, new Date(now - 5 * SECONDS));

    const currentLocation = await request(app.getHttpServer())
      .get(`/api/v1/vehicles/${vehicleId}/location`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(currentLocation.body.data.latitude).toBeCloseTo(AWAY.latitude, 5);

    const trips = await request(app.getHttpServer())
      .get(`/api/v1/vehicles/${vehicleId}/trips`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(trips.body.data.items).toHaveLength(1);
    expect(trips.body.data.items[0].status).toBe('ACTIVE');
    expect(trips.body.data.items[0].distanceMeters).toBeGreaterThan(0);

    const alerts = await request(app.getHttpServer())
      .get('/api/v1/alerts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(
      alerts.body.data.items.some(
        (alert: { type: string }) => alert.type === 'GEOFENCE_EXIT',
      ),
    ).toBe(true);
  });

  it('completes the trip once the vehicle has been stopped long enough', async () => {
    const tripDetection = app.get(TripDetectionService);
    await tripDetection.endStaleTrips();

    const trips = await request(app.getHttpServer())
      .get(`/api/v1/vehicles/${vehicleId}/trips`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(trips.body.data.items[0].status).toBe('COMPLETED');
    expect(trips.body.data.items[0].endedAt).not.toBeNull();
  });

  it('rejects an unauthenticated request to a user-facing endpoint', async () => {
    await request(app.getHttpServer()).get('/api/v1/vehicles').expect(401);
  });
});
