import { EditorValidationError } from "./editors";

export interface SectionReferenceRepository {
  countServices(ids: string[], requirePublished: boolean): Promise<number>;
  countProductCategories(ids: string[], requirePublished: boolean): Promise<number>;
  countHomepageItems(ids: string[], requirePublished: boolean): Promise<number>;
}

function uniqueIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))];
}

export async function validateSectionReferences(
  repository: SectionReferenceRepository,
  config: unknown,
  requirePublished: boolean,
) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return;
  const value = config as Record<string, unknown>;
  const services = uniqueIds(value.serviceIds);
  const categories = uniqueIds(value.categoryIds);
  const homepageItems = uniqueIds(value.itemIds);
  const [serviceCount, categoryCount, homepageItemCount] = await Promise.all([
    services.length ? repository.countServices(services, requirePublished) : Promise.resolve(0),
    categories.length ? repository.countProductCategories(categories, requirePublished) : Promise.resolve(0),
    homepageItems.length ? repository.countHomepageItems(homepageItems, requirePublished) : Promise.resolve(0),
  ]);
  if (serviceCount !== services.length) throw new EditorValidationError("Referenced services must be active and available");
  if (categoryCount !== categories.length) throw new EditorValidationError("Referenced product categories must be active and available");
  if (homepageItemCount !== homepageItems.length) throw new EditorValidationError("Referenced homepage items must be active and available");
}
