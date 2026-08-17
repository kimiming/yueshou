UPDATE "SiteSetting" AS setting
SET value = jsonb_set(
  jsonb_set(setting.value::jsonb, '{logoMediaId}', to_jsonb(logo.id::text), true),
  '{faviconMediaId}',
  to_jsonb(favicon.id::text),
  true
)
FROM "MediaAsset" AS logo,
     "MediaAsset" AS favicon
WHERE setting.key = 'brand'
  AND setting."deletedAt" IS NULL
  AND logo.id = 'cmsu99t6l000101kd7a9g96ku'
  AND logo.visibility = 'PUBLIC'
  AND logo.status = 'PUBLISHED'
  AND logo."deletedAt" IS NULL
  AND favicon.id = 'cmsm3u4ic000801mjcre2mqkv'
  AND favicon.visibility = 'PUBLIC'
  AND favicon.status = 'PUBLISHED'
  AND favicon."deletedAt" IS NULL;
