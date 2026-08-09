import { EditorValidationError } from "./editors";

export function assertExactLiveSet(orderedIds: readonly string[], liveIds: readonly string[], label: string) {
  const requested = new Set(orderedIds);
  const live = new Set(liveIds);
  if (requested.size !== orderedIds.length || live.size !== liveIds.length || requested.size !== live.size || [...requested].some((id) => !live.has(id))) {
    throw new EditorValidationError(`${label} collection changed; reload and try again`);
  }
}
