export type E2eDatabaseLifecycle = {
  authenticate(phase: "setup" | "teardown"): Promise<void>;
  reset(): void;
  seed(): void;
};

/**
 * Both setup and teardown leave the disposable fixture in the same migrated,
 * seeded state. Authentication must use a database-level marker because a
 * schema reset deliberately removes every table-level sentinel.
 */
export async function runE2eDatabaseLifecycle(
  lifecycle: E2eDatabaseLifecycle,
  phase: "setup" | "teardown",
) {
  await lifecycle.authenticate(phase);
  lifecycle.reset();
  lifecycle.seed();
}
