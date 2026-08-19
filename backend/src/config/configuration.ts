import { parseDurationToSeconds } from '../common/utils/duration.util';

export interface AppConfig {
  env: string;
  port: number;
  corsOrigin: string;
}

export interface ReportConfig {
  utcOffsetMinutes: number;
}

export interface DatabaseConfig {
  url: string;
  poolMax: number;
}

export interface JwtConfig {
  secret: string;
  expiresInSeconds: number;
}

export interface TripConfig {
  startSpeedKmh: number;
  endStopMinutes: number;
}

export interface AlertConfig {
  overspeedLimitKmh: number;
  deviceOfflineMinutes: number;
  longStopMinutes: number;
}

export interface GpsConfig {
  maxJumpMeters: number;
  maxJumpSeconds: number;
}

export interface ThrottleConfig {
  ttlSeconds: number;
  limit: number;
}

export interface Configuration {
  app: AppConfig;
  database: DatabaseConfig;
  jwt: JwtConfig;
  trip: TripConfig;
  alert: AlertConfig;
  gps: GpsConfig;
  throttle: ThrottleConfig;
  report: ReportConfig;
}

export default (): Configuration => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
    poolMax: Number(process.env.DATABASE_POOL_MAX ?? 20),
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresInSeconds: parseDurationToSeconds(
      process.env.JWT_EXPIRES_IN ?? '7d',
    ),
  },
  trip: {
    startSpeedKmh: Number(process.env.TRIP_START_SPEED_KMH ?? 5),
    endStopMinutes: Number(process.env.TRIP_END_STOP_MINUTES ?? 5),
  },
  alert: {
    overspeedLimitKmh: Number(process.env.OVERSPEED_LIMIT_KMH ?? 80),
    deviceOfflineMinutes: Number(process.env.DEVICE_OFFLINE_MINUTES ?? 10),
    longStopMinutes: Number(process.env.LONG_STOP_MINUTES ?? 15),
  },
  gps: {
    maxJumpMeters: Number(process.env.GPS_MAX_JUMP_METERS ?? 2000),
    maxJumpSeconds: Number(process.env.GPS_MAX_JUMP_SECONDS ?? 10),
  },
  throttle: {
    ttlSeconds: Number(process.env.THROTTLE_TTL_SECONDS ?? 60),
    limit: Number(process.env.THROTTLE_LIMIT ?? 300),
  },
  report: {
    utcOffsetMinutes: Number(process.env.REPORT_UTC_OFFSET_MINUTES ?? 0),
  },
});
