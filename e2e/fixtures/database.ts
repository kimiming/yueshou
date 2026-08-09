import { createE2eReleaseConfigIfRequested } from "../../lib/e2e/release-config";

/**
 * Browser journeys deliberately use an operator-provisioned, disposable
 * database.  They never fall back to a developer's DATABASE_URL or mock the
 * content layer: doing either would make a release check look useful while it
 * was exercising different data from the deployed application.
 */
const REQUIRED_E2E_ENVIRONMENT = [
  "E2E_DATABASE_URL",
  "E2E_AUTH_SECRET",
  "E2E_INQUIRY_HASH_SECRET",
  "E2E_STORAGE_ENDPOINT",
  "E2E_STORAGE_BUCKET",
  "E2E_STORAGE_ACCESS_KEY_ID",
  "E2E_STORAGE_SECRET_ACCESS_KEY",
  "E2E_ADMIN_EMAIL",
  "E2E_ADMIN_PASSWORD",
] as const;

type RequiredE2eEnvironment = (typeof REQUIRED_E2E_ENVIRONMENT)[number];

const missing = REQUIRED_E2E_ENVIRONMENT.filter((key) => !process.env[key]);

export const hasE2eDatabase = missing.length === 0;
export const e2eSkipReason = hasE2eDatabase
  ? ""
  : `E2E integration requires a disposable seeded database and explicit credentials. Missing: ${missing.join(", ")}.`;

/**
 * Environment passed only to the Playwright-managed local server. The
 * `E2E_*` prefix prevents an accidental production/developer database from
 * being selected just because DATABASE_URL happens to be set in a shell.
 */
export function e2eServerEnvironment(): Record<string, string> {
  if (!hasE2eDatabase) return {};

  const required = (key: RequiredE2eEnvironment) => {
    const value = process.env[key];
    if (!value) throw new Error(`Missing required E2E environment variable: ${key}`);
    return value;
  };
  return {
    NODE_ENV: "production",
    DATABASE_URL: required("E2E_DATABASE_URL"),
    AUTH_SECRET: required("E2E_AUTH_SECRET"),
    INQUIRY_HASH_SECRET: required("E2E_INQUIRY_HASH_SECRET"),
    // The browser supplies a single canonical test IP in the Playwright
    // configuration, matching the Nginx deployment boundary without relaxing
    // production's trusted-header requirement.
    INQUIRY_PROXY_MODE: "nginx",
    STORAGE_BACKEND: "minio",
    STORAGE_ENDPOINT: required("E2E_STORAGE_ENDPOINT"),
    STORAGE_REGION: process.env.E2E_STORAGE_REGION || "us-east-1",
    STORAGE_BUCKET: required("E2E_STORAGE_BUCKET"),
    STORAGE_ACCESS_KEY_ID: required("E2E_STORAGE_ACCESS_KEY_ID"),
    STORAGE_SECRET_ACCESS_KEY: required("E2E_STORAGE_SECRET_ACCESS_KEY"),
    NEXT_PUBLIC_SITE_URL: process.env.E2E_SITE_URL || "http://localhost:3000",
  };
}

export const e2eAdmin = {
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
};

/** Mutation journeys use the complete fail-closed release boundary. */
const releaseConfig = createE2eReleaseConfigIfRequested(process.env);

export const hasE2eMutationFixture = releaseConfig !== null;
export const e2eMutationSkipReason = hasE2eMutationFixture
  ? ""
  : "Mutation journeys run only through pnpm test:e2e:release with its complete validated resettable fixture.";

export const e2eMutationFixture = releaseConfig?.mutationFixture ?? {
  logoMediaId: undefined,
  heroMediaId: undefined,
  homePageId: undefined,
  articleId: undefined,
  articleSlug: undefined,
};
