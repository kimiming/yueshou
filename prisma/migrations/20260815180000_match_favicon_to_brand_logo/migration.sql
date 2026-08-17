UPDATE "SiteSetting" AS setting
SET value = jsonb_set(
  setting.value::jsonb,
  '{faviconMediaId}',
  to_jsonb(media.id::text),
  true
)
FROM "MediaAsset" AS media
WHERE setting.key = 'brand'
  AND setting."deletedAt" IS NULL
  AND media.id = 'cmsu99t6l000101kd7a9g96ku'
  AND media.visibility = 'PUBLIC'
  AND media.status = 'PUBLISHED'
  AND media."deletedAt" IS NULL;
