import type { E2eMutationFixture } from "./mutation-fixture";

export type E2eDatabaseLifecycle = {
  authenticate(phase: "setup" | "teardown"): Promise<void>;
  reset(): void;
  seedDatabase(): void;
  seedStorage(): void;
  resolveFixture(): Promise<E2eMutationFixture>;
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
  lifecycle.seedDatabase();
  lifecycle.seedStorage();
  return lifecycle.resolveFixture();
}
