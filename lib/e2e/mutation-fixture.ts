import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { z } from "zod";

export const E2E_LOGO_STORAGE_KEY = "e2e/fixtures/logo.png";
export const E2E_HERO_STORAGE_KEY = "e2e/fixtures/hero.png";
export const E2E_HOME_PAGE_SLUG = "home";
export const E2E_ARTICLE_SLUG = "e2e-release-article";

const fixtureSchema = z.object({
  logoMediaId: z.string().min(1),
  heroMediaId: z.string().min(1),
  homePageId: z.string().min(1),
  articleId: z.string().min(1),
  articleSlug: z.literal(E2E_ARTICLE_SLUG),
}).superRefine((fixture, context) => {
  if (fixture.logoMediaId === fixture.heroMediaId) {
    context.addIssue({ code: "custom", path: ["heroMediaId"], message: "HERO and logo media fixtures must differ" });
  }
});

export type E2eMutationFixture = z.infer<typeof fixtureSchema>;

export type E2eMutationFixtureRepository = {
  findPublishedMediaByStorageKey(storageKey: string): Promise<{ id: string } | null>;
  findPublishedPageBySlug(slug: string): Promise<{ id: string } | null>;
  findPublishedArticleBySlug(slug: string): Promise<{ id: string; slug: string } | null>;
};

export function e2eMutationFixturePath(root = process.cwd()) {
  return resolve(root, "test-results", "e2e-release-fixture.json");
}

export async function resolveE2eMutationFixture(
  repository: E2eMutationFixtureRepository,
): Promise<E2eMutationFixture> {
  const [logo, hero, home, article] = await Promise.all([
    repository.findPublishedMediaByStorageKey(E2E_LOGO_STORAGE_KEY),
    repository.findPublishedMediaByStorageKey(E2E_HERO_STORAGE_KEY),
    repository.findPublishedPageBySlug(E2E_HOME_PAGE_SLUG),
    repository.findPublishedArticleBySlug(E2E_ARTICLE_SLUG),
  ]);
  if (!logo) throw new Error("Post-seed E2E logo media fixture is missing");
  if (!hero) throw new Error("Post-seed E2E HERO media fixture is missing");
  if (!home) throw new Error("Post-seed E2E home page fixture is missing");
  if (!article) throw new Error("Post-seed E2E article fixture is missing");
  return fixtureSchema.parse({
    logoMediaId: logo.id,
    heroMediaId: hero.id,
    homePageId: home.id,
    articleId: article.id,
    articleSlug: article.slug,
  });
}

export function writeE2eMutationFixture(path: string, fixture: E2eMutationFixture) {
  const parsed = fixtureSchema.parse(fixture);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(parsed, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

export function readE2eMutationFixture(path: string): E2eMutationFixture {
  try {
    return fixtureSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    throw new Error("Post-seed E2E mutation fixture file is missing or invalid", { cause: error });
  }
}
