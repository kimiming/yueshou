import type { ProductViewModel } from "./view-models";

export function productCoverMedia(product: Pick<ProductViewModel, "media" | "specifications">) {
  const coverId = product.specifications && typeof product.specifications === "object" && !Array.isArray(product.specifications) && "coverMediaId" in product.specifications
    ? (product.specifications as { coverMediaId?: unknown }).coverMediaId
    : undefined;
  return typeof coverId === "string" ? product.media.find((media) => media.id === coverId) ?? product.media[0] : product.media[0];
}
