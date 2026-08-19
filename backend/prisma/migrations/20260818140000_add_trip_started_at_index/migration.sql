-- CreateIndex
-- Applied directly via `prisma db execute` rather than `prisma migrate dev`
-- because this database's schema has drifted from its recorded migration
-- history (pre-existing, not caused by this change) — `migrate dev` would
-- have proposed resetting (dropping) the whole schema to reconcile it. This
-- statement is purely additive and safe to run against the live schema; it
-- is included here as a migration file for the repo's record even though it
-- wasn't applied through the normal migrate workflow.
CREATE INDEX IF NOT EXISTS "trips_vehicleId_startedAt_idx" ON "trips"("vehicleId", "startedAt");
