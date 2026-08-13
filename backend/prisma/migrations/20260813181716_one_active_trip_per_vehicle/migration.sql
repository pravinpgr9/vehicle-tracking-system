-- Two GPS points ingested close enough together can both reach
-- TripDetectionService.handleLocationIngested before either finishes
-- inserting a new trip, so each sees no ACTIVE trip yet and both create one
-- ("Recent trips" then shows two simultaneous "in progress" entries for the
-- same vehicle). A partial unique index makes the second insert fail with a
-- constraint violation instead of silently succeeding, so the application
-- can safely detect and reconcile the race.
CREATE UNIQUE INDEX "trips_one_active_per_vehicle" ON "trips" ("vehicleId") WHERE "status" = 'ACTIVE';
