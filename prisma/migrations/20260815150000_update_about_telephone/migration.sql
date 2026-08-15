UPDATE "PageTranslation" AS translation
SET body = replace(
  replace(translation.body, 'tel:057583835818', 'tel:+8613435855558'),
  '0575-83835818',
  '+8613435855558'
)
FROM "Page" AS page
WHERE page.slug = 'about'
  AND translation."pageId" = page.id
  AND translation.locale IN ('en', 'zh-CN', 'de', 'fr', 'es');
