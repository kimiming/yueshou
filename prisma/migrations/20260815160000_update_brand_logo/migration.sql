UPDATE "SiteSetting" AS setting
SET value = jsonb_set(
  jsonb_set(setting.value::jsonb, '{logoMediaId}', to_jsonb(media.id::text), true),
  '{faviconMediaId}',
  to_jsonb(media.id::text),
  true
)
FROM "MediaAsset" AS media
WHERE setting.key = 'brand'
  AND setting."deletedAt" IS NULL
  AND media.id = 'cmsu8x3g6000101nze7rfjxf5'
  AND media.visibility = 'PUBLIC'
  AND media.status = 'PUBLISHED'
  AND media."deletedAt" IS NULL;
