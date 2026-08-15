UPDATE "SiteSetting"
SET
  value = jsonb_set(
    COALESCE(value::jsonb, '{}'::jsonb),
    '{socialLinks}',
    '[
      {"label":"Facebook","href":"https://www.facebook.com"},
      {"label":"Instagram","href":"https://www.instagram.com"},
      {"label":"X","href":"https://x.com"},
      {"label":"TikTok","href":"https://www.tiktok.com"},
      {"label":"WhatsApp","href":"https://wa.me/8613435855558"}
    ]'::jsonb,
    true
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE key = 'brand'
  AND "deletedAt" IS NULL
  AND COALESCE(jsonb_array_length(COALESCE(value::jsonb -> 'socialLinks', '[]'::jsonb)), 0) = 0;
