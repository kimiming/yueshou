import {
  contentRepository,
  type PublicationActor,
  type PublicationRepository,
  type PublishEntityInput,
} from "@/features/content/repository";
import { invalidatePublishedEntity } from "@/features/publishing/cache";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

export { LegalReviewRequiredError } from "@/features/content/repository";
export type {
  PublicationActor,
  PublishEntityInput,
} from "@/features/content/repository";

type PublishDependencies = {
  repository: PublicationRepository;
  invalidate: typeof invalidatePublishedEntity;
  now: () => Date;
};

const defaultDependencies: PublishDependencies = {
  repository: contentRepository,
  invalidate: invalidatePublishedEntity,
  now: () => new Date(),
};

export async function publishEntity(
  input: PublishEntityInput,
  actor: PublicationActor,
  dependencies: PublishDependencies = defaultDependencies,
) {
  if (!input.id.trim()) {
    throw new Error("Entity id is required");
  }
  if (!actor.id.trim()) {
    throw new Error("Publication actor id is required");
  }

  const publishedAt = dependencies.now();
  const entity = await dependencies.repository.publishEntity(input, actor, publishedAt);

  dependencies.invalidate(input.type, entity.slug, SUPPORTED_LOCALES);

  return {
    id: entity.id,
    slug: entity.slug,
    type: input.type,
    status: "PUBLISHED" as const,
    publishedAt: entity.publishedAt.toISOString(),
  };
}
