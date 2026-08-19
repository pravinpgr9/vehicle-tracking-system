import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  DATABASE_URL: Joi.string().uri().required(),
  DATABASE_POOL_MAX: Joi.number().positive().default(20),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('7d'),

  CORS_ORIGIN: Joi.string().default('*'),

  TRIP_START_SPEED_KMH: Joi.number().positive().default(5),
  TRIP_END_STOP_MINUTES: Joi.number().positive().default(5),

  OVERSPEED_LIMIT_KMH: Joi.number().positive().default(80),
  DEVICE_OFFLINE_MINUTES: Joi.number().positive().default(10),
  LONG_STOP_MINUTES: Joi.number().positive().default(15),

  GPS_MAX_JUMP_METERS: Joi.number().positive().default(2000),
  GPS_MAX_JUMP_SECONDS: Joi.number().positive().default(10),

  THROTTLE_TTL_SECONDS: Joi.number().positive().default(60),
  THROTTLE_LIMIT: Joi.number().positive().default(300),
  THROTTLE_INGESTION_LIMIT: Joi.number().positive().default(600),
});
