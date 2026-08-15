UPDATE "PageSectionTranslation" AS translation
SET title = localized.title,
    body = localized.title
FROM "PageSection" AS section,
     "Page" AS page,
     (VALUES
       ('de'::"ContentLocale", 'Kernvorteile'),
       ('fr'::"ContentLocale", 'Avantages clés'),
       ('es'::"ContentLocale", 'Ventajas clave')
     ) AS localized(locale, title)
WHERE page.slug = 'home'
  AND section."pageId" = page.id
  AND section.type = 'CAPABILITIES'
  AND section."deletedAt" IS NULL
  AND translation."pageSectionId" = section.id
  AND translation.locale = localized.locale;

UPDATE "SiteSettingTranslation" AS translation
SET title = localized.title,
    body = localized.body
FROM "SiteSetting" AS setting,
     (VALUES
       ('homepage-advantage-production-system', 'de'::"ContentLocale", 'GMP-konforme Peptidherstellung', 'Wir liefern hochwertige Peptidrohstoffe, die unter strengen GMP-konformen Qualitätsmanagementsystemen hergestellt werden. Unser Produktionsprozess folgt standardisierten Verfahren für Rohstoffkontrolle, Peptidsynthese, Reinigung, Qualitätsprüfung und Chargendokumentation.'),
       ('homepage-advantage-production-system', 'fr'::"ContentLocale", 'Fabrication de peptides conforme aux BPF', 'Nous fournissons des matières premières peptidiques de haute qualité, fabriquées selon des systèmes stricts de gestion de la qualité conformes aux BPF. Notre processus de production suit des procédures normalisées couvrant le contrôle des matières premières, la synthèse et la purification des peptides, les essais qualité et la documentation des lots.'),
       ('homepage-advantage-production-system', 'es'::"ContentLocale", 'Fabricación de péptidos conforme a las BPF', 'Suministramos materias primas peptídicas de alta calidad, fabricadas bajo estrictos sistemas de gestión de calidad conformes a las BPF. Nuestro proceso de producción sigue procedimientos normalizados que abarcan el control de materias primas, la síntesis y purificación de péptidos, las pruebas de calidad y la documentación de lotes.'),

       ('homepage-advantage-product-pipeline', 'de'::"ContentLocale", 'Umfangreiche Produktpipeline', 'Mehr als 60 Peptidwirkstoffe decken wichtige Therapiegebiete wie Adipositas, Diabetes und Magen-Darm-Erkrankungen ab. Mehrere zentrale Peptidwirkstoffe sind in verschiedenen Ländern registriert oder zugelassen. Unser Portfolio umfasst außerdem mehr als 40 kosmetische Peptidwirkstoffe für Anti-Falten-, Anti-Aging-, Reparatur-, Aufhellungs- und weitere Anwendungen.'),
       ('homepage-advantage-product-pipeline', 'fr'::"ContentLocale", 'Vaste portefeuille de produits', 'Plus de 60 principes actifs peptidiques couvrent des domaines thérapeutiques majeurs, notamment l’obésité, le diabète et les maladies gastro-intestinales. Plusieurs API peptidiques phares ont été enregistrés ou approuvés dans différents pays. Notre portefeuille comprend également plus de 40 ingrédients peptidiques cosmétiques destinés aux applications antirides, anti-âge, réparatrices, éclaircissantes et autres.'),
       ('homepage-advantage-product-pipeline', 'es'::"ContentLocale", 'Amplia cartera de productos', 'Más de 60 principios activos peptídicos cubren áreas terapéuticas clave, como la obesidad, la diabetes y las enfermedades gastrointestinales. Varios API peptídicos destacados han sido registrados o aprobados en distintos países. Nuestra cartera también incluye más de 40 ingredientes peptídicos cosméticos para aplicaciones antiarrugas, antienvejecimiento, reparadoras, iluminadoras y otras.'),

       ('homepage-advantage-production-capacity', 'de'::"ContentLocale", 'Stabile Produktionskapazität im großen Maßstab', 'Unsere großtechnischen Produktionsanlagen bieten eine Jahreskapazität von 8.000 kg Peptidpulver und 2.000 Tonnen Peptidlösungen. Eine stabile und termingerechte Versorgung sowie wettbewerbsfähige Preise ermöglichen es uns, die Beschaffungsanforderungen von Kunden weltweit zu erfüllen.'),
       ('homepage-advantage-production-capacity', 'fr'::"ContentLocale", 'Capacité stable de production à grande échelle', 'Nos installations de production à grande échelle offrent une capacité annuelle de 8 000 kg de poudre peptidique et de 2 000 tonnes de solutions peptidiques. Un approvisionnement stable et ponctuel, associé à des prix compétitifs, nous permet de répondre aux besoins d’achat de clients dans le monde entier.'),
       ('homepage-advantage-production-capacity', 'es'::"ContentLocale", 'Capacidad estable de producción a gran escala', 'Nuestras instalaciones de producción a gran escala ofrecen una capacidad anual de 8.000 kg de polvo peptídico y 2.000 toneladas de soluciones peptídicas. Un suministro estable y puntual, junto con precios competitivos, nos permite satisfacer las necesidades de compra de clientes de todo el mundo.'),

       ('homepage-advantage-global-market', 'de'::"ContentLocale", 'Globale Marktpräsenz', 'Wir bauen unsere globale Marktpräsenz aktiv aus. Unsere Produkte werden in die USA, die Europäische Union, Kanada, Südkorea, Japan, Russland und weitere Märkte exportiert. Zudem haben wir stabile Partnerschaften mit international anerkannten Unternehmen aufgebaut.'),
       ('homepage-advantage-global-market', 'fr'::"ContentLocale", 'Présence sur les marchés mondiaux', 'Nous développons activement notre présence sur les marchés mondiaux. Nos produits sont exportés vers les États-Unis, l’Union européenne, le Canada, la Corée du Sud, le Japon, la Russie et d’autres marchés, et nous avons établi des partenariats durables avec des entreprises de renommée internationale.'),
       ('homepage-advantage-global-market', 'es'::"ContentLocale", 'Presencia en los mercados mundiales', 'Ampliamos activamente nuestra presencia en los mercados mundiales. Nuestros productos se exportan a Estados Unidos, la Unión Europea, Canadá, Corea del Sur, Japón, Rusia y otros mercados, y hemos establecido colaboraciones estables con empresas reconocidas internacionalmente.')
     ) AS localized(setting_key, locale, title, body)
WHERE translation."siteSettingId" = setting.id
  AND setting.key = localized.setting_key
  AND setting."deletedAt" IS NULL
  AND translation.locale = localized.locale;
