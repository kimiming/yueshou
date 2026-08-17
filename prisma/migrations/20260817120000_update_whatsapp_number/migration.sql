UPDATE "SiteSetting"
SET
  value = jsonb_set(
    value::jsonb,
    '{socialLinks}',
    (
      SELECT jsonb_agg(
        CASE
          WHEN lower(trim(link ->> 'label')) = 'whatsapp'
            OR link ->> 'href' LIKE 'https://wa.me/%'
            OR link ->> 'href' LIKE 'https://api.whatsapp.com/%'
          THEN jsonb_set(link, '{href}', to_jsonb('https://wa.me/+8613438855558'::text))
          ELSE link
        END
        ORDER BY position
      )
      FROM jsonb_array_elements(value::jsonb -> 'socialLinks') WITH ORDINALITY AS social_link(link, position)
    ),
    false
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE key = 'brand'
  AND "deletedAt" IS NULL
  AND jsonb_typeof(value::jsonb -> 'socialLinks') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(value::jsonb -> 'socialLinks') AS social_link(link)
    WHERE lower(trim(link ->> 'label')) = 'whatsapp'
      OR link ->> 'href' LIKE 'https://wa.me/%'
      OR link ->> 'href' LIKE 'https://api.whatsapp.com/%'
  );
