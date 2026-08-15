import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  ContentLocale,
  LegalReviewStatus,
  PageSectionType,
  Prisma,
  PrismaClient,
  PublishStatus,
} from "@prisma/client";
import { createBootstrapAdmin, parseBootstrapAdmin } from "./bootstrap-admin";

function requiredSeedEnvironment(name: "DATABASE_URL"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to seed the database`);
  }

  return value;
}

const databaseUrl = requiredSeedEnvironment("DATABASE_URL");
const bootstrapAdmin = parseBootstrapAdmin(process.env);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const locales: ContentLocale[] = [
  ContentLocale.en,
  ContentLocale.zh_CN,
  ContentLocale.de,
  ContentLocale.fr,
  ContentLocale.es,
];

const translated = (titles: Record<ContentLocale, string>, bodies: Record<ContentLocale, string>) =>
  locales.map((locale) => ({ locale, title: titles[locale], body: bodies[locale] }));

const legalPages = [
  {
    slug: "terms",
    translations: translated(
      { en: "Terms of Service", zh_CN: "服务条款", de: "Nutzungsbedingungen", fr: "Conditions d’utilisation", es: "Términos del servicio" },
      {
        en: "This draft page describes the terms for using yueshou’s website. It requires legal review before publication.",
        zh_CN: "此草稿页面说明使用 yueshou 网站的条款。发布前需要法律审核。",
        de: "Diese Entwurfsseite beschreibt die Bedingungen für die Nutzung der Website von yueshou. Vor der Veröffentlichung ist eine rechtliche Prüfung erforderlich.",
        fr: "Cette page de travail décrit les conditions d’utilisation du site yueshou. Elle nécessite un examen juridique avant publication.",
        es: "Esta página de borrador describe las condiciones de uso del sitio web de yueshou. Requiere revisión legal antes de su publicación.",
      },
    ),
  },
  {
    slug: "privacy",
    translations: translated(
      { en: "Privacy Policy", zh_CN: "隐私政策", de: "Datenschutzerklärung", fr: "Politique de confidentialité", es: "Política de privacidad" },
      {
        en: "This draft page describes how yueshou intends to handle website inquiries and consent records. It requires legal review before publication.",
        zh_CN: "此草稿页面说明 yueshou 拟如何处理网站询盘和同意记录。发布前需要法律审核。",
        de: "Diese Entwurfsseite beschreibt, wie yueshou Website-Anfragen und Einwilligungsnachweise behandeln möchte. Vor der Veröffentlichung ist eine rechtliche Prüfung erforderlich.",
        fr: "Cette page de travail décrit la manière dont yueshou prévoit de traiter les demandes du site et les preuves de consentement. Elle nécessite un examen juridique avant publication.",
        es: "Esta página de borrador describe cómo yueshou pretende tratar las consultas del sitio web y los registros de consentimiento. Requiere revisión legal antes de su publicación.",
      },
    ),
  },
  {
    slug: "ruo-policy",
    translations: translated(
      { en: "Research Use Only Policy", zh_CN: "仅限科研用途政策", de: "Richtlinie nur für Forschungszwecke", fr: "Politique réservée à la recherche", es: "Política solo para investigación" },
      {
        en: "yueshou website content is provided for scientific research discussions. Products must not be represented as intended for human diagnostic or therapeutic use.",
        zh_CN: "yueshou 网站内容用于科学研究交流。产品不得被表述为用于人体诊断或治疗。",
        de: "Die Inhalte der yueshou-Website dienen wissenschaftlichen Forschungsgesprächen. Produkte dürfen nicht als für diagnostische oder therapeutische Anwendungen am Menschen bestimmt dargestellt werden.",
        fr: "Le contenu du site yueshou est fourni pour les échanges liés à la recherche scientifique. Les produits ne doivent pas être présentés comme destinés au diagnostic ou au traitement humain.",
        es: "El contenido del sitio web de yueshou se proporciona para conversaciones sobre investigación científica. Los productos no deben presentarse como destinados al diagnóstico o tratamiento humano.",
      },
    ),
  },
  {
    slug: "shipping-compliance",
    translations: translated(
      { en: "Shipping and Compliance Notice", zh_CN: "运输与合规说明", de: "Versand- und Compliance-Hinweis", fr: "Avis d’expédition et de conformité", es: "Aviso de envío y cumplimiento" },
      {
        en: "Shipping options and compliance requirements depend on the order and destination. Customers are responsible for providing accurate order and delivery information.",
        zh_CN: "运输方式和合规要求取决于订单及目的地。客户负责提供准确的订单和交付信息。",
        de: "Versandoptionen und Compliance-Anforderungen hängen von Bestellung und Zielort ab. Kundinnen und Kunden sind für korrekte Bestell- und Lieferinformationen verantwortlich.",
        fr: "Les options d’expédition et les exigences de conformité dépendent de la commande et de la destination. Les clients sont responsables de l’exactitude des informations de commande et de livraison.",
        es: "Las opciones de envío y los requisitos de cumplimiento dependen del pedido y del destino. Los clientes son responsables de proporcionar información precisa sobre el pedido y la entrega.",
      },
    ),
  },
  {
    slug: "cookie-policy",
    translations: translated(
      { en: "Cookie Policy", zh_CN: "Cookie 政策", de: "Cookie-Richtlinie", fr: "Politique relative aux cookies", es: "Política de cookies" },
      {
        en: "This draft page describes necessary cookies and any optional analytics cookies. Visitors can change optional choices through the site’s cookie settings.",
        zh_CN: "此草稿页面说明必要 Cookie 和任何可选的分析 Cookie。访客可通过网站的 Cookie 设置更改可选选择。",
        de: "Diese Entwurfsseite beschreibt notwendige Cookies und optionale Analyse-Cookies. Besucher können optionale Einstellungen über die Cookie-Einstellungen der Website ändern.",
        fr: "Cette page de travail décrit les cookies nécessaires et les cookies analytiques facultatifs. Les visiteurs peuvent modifier leurs choix facultatifs dans les paramètres de cookies du site.",
        es: "Esta página de borrador describe las cookies necesarias y las cookies analíticas opcionales. Los visitantes pueden cambiar sus opciones en la configuración de cookies del sitio.",
      },
    ),
  },
] as const;

const aboutCompanyBody = `<p>粤首股份有限公司成立于2015年，主要从事多肽产品的研发、生产、销售及相关服务，是一家具备先进、高效的多肽合成、纯化和规模化生产能力的国家级专精特新“小巨人”企业，设有广东省博士后工作站和院士专家工作站。公司以关注人类健康、美丽为经营宗旨，凭借业内领先的多肽合成和修饰核心技术优势，为下游客户供应多肽化妆品原料和多肽医药产品及提供相关服务。</p>
<p>经过多年的技术积累和工艺探索，公司已拥有业内领先的多肽药物合成与生产技术平台，掌握了一系列多肽原料药规模化生产的核心技术，包括功能树脂修饰技术、特殊氨基酸片段合成技术、长肽分段合成技术、多环肽定向合成技术、长肽聚集物控制技术、多肽特定基团修饰技术等多肽合成和修饰类自主核心技术。多肽原料药的工艺研发和生产能力是公司主要竞争优势和业务发展的基础，公司挑选在国内外具有较大市场容量及较强市场竞争力的多肽原料药品种进行研发，已搭建了丰富的产品管线，完成了多种多肽原料药的研发布局，产品管线涵盖亮丙瑞林、司美格鲁肽、利拉鲁肽、利那洛肽等知名品种。</p>
<p>自设立以来，公司先后为华润双鹤、先声药业等知名创新药企提供多肽 CDMO/CRO 服务，多肽原料药/高级医院中间体产品出口至美国、俄罗斯、巴基斯坦和韩国等多个国家和地区。</p>
<p>根据弗若斯特沙利文统计，2021年公司为国内市场份额最大的多肽化妆品原料生产企业。公司持续进行多肽原料产品的技术创新，并通过工艺改进等方式进一步发挥成本优势，为客户提供具有显著优势的定制化产品。同时，公司在行业深耕多年，对多肽产品具备较深的理解和技术积累，具备了从多肽化妆品原料早期产品开发、研发、实验、粉末生产、原液调配、稳定性检测和功效测评的全链条服务能力，能够在客户早期设计产品时即介入，针对最终产品定位和用途为客户量身定制多肽原料产品，并在产品设计和销售过程中针对客户需求进行升级。</p>
<p>公司坚持自主创新，持续围绕多肽化妆品原料领域布局在研项目，并积极与珀莱雅、华熙生物、丸美等头部化妆品企业达成战略合作，运用科研专业优势和在多肽原料应用的成功经验，为多肽在化妆品原料领域的发展赋能。</p>
<h2>联系方式</h2>
<p><strong>地址：</strong>广州市白云区太和镇广从三路55号3层332室<br><strong>电话：</strong><a href="tel:+8613435855558">+8613435855558</a><br><strong>网址：</strong><a href="https://www.yueshou-peptide.com" target="_blank" rel="noopener noreferrer">www.yueshou-peptide.com</a></p>`;

const aboutCompanyBodyEn = `<p>Founded in 2015, Yueshou Co., Ltd. specializes in the research, development, manufacturing, and sale of peptide products and related services. Recognized as a national-level specialized and innovative “Little Giant” enterprise, the company has advanced, efficient capabilities in peptide synthesis, purification, and large-scale production, as well as a Guangdong Postdoctoral Workstation and an Academician and Expert Workstation. Guided by its commitment to human health and beauty, Yueshou draws on industry-leading peptide synthesis and modification technologies to supply peptide-based cosmetic ingredients and pharmaceutical products and to provide related services.</p>
<p>Through years of technical development and process exploration, the company has established an industry-leading platform for peptide drug synthesis and manufacturing. Its proprietary core technologies for the large-scale production of peptide active pharmaceutical ingredients include functional resin modification, special amino acid fragment synthesis, segmented synthesis of long peptides, directed synthesis of polycyclic peptides, control of long-peptide aggregates, and modification of specific peptide functional groups. Process development and manufacturing capabilities for peptide APIs form the foundation of the company’s competitive strength and business growth. Yueshou selects peptide API candidates with strong market potential and competitiveness in China and internationally, and has built a broad pipeline that includes well-known products such as leuprolide, semaglutide, liraglutide, and linaclotide.</p>
<p>Since its establishment, the company has provided peptide CDMO/CRO services to prominent innovative pharmaceutical companies, including China Resources Double-Crane and Simcere Pharmaceutical. Its peptide APIs and advanced pharmaceutical intermediates are exported to the United States, Russia, Pakistan, South Korea, and other countries and regions.</p>
<p>According to Frost &amp; Sullivan, the company held the largest share of China’s peptide cosmetic ingredient market in 2021. Yueshou continues to innovate in peptide ingredient technologies and further strengthens its cost advantages through process improvements, enabling it to offer highly competitive customized products. Drawing on years of industry experience and extensive technical expertise, the company provides end-to-end services covering early product development, research, experimentation, powder production, stock-solution formulation, stability testing, and efficacy evaluation for peptide cosmetic ingredients. This enables Yueshou to participate from the earliest stages of a customer’s product design, tailor peptide ingredients to the intended positioning and application of the final product, and refine solutions throughout product design and commercialization in response to customer needs.</p>
<p>The company remains committed to independent innovation, continuously advancing research projects in peptide cosmetic ingredients. It has also established strategic collaborations with leading cosmetics companies such as Proya, Bloomage Biotech, and Marubi, applying its scientific expertise and proven experience in peptide ingredient applications to support the continued development of peptides in cosmetics.</p>
<h2>Contact Information</h2>
<p><strong>Address:</strong> Room 332, 3rd Floor, No. 55 Guangcong 3rd Road, Taihe Town, Baiyun District, Guangzhou, China<br><strong>Telephone:</strong> <a href="tel:+8613435855558">+8613435855558</a><br><strong>Website:</strong> <a href="https://www.yueshou-peptide.com" target="_blank" rel="noopener noreferrer">www.yueshou-peptide.com</a></p>`;

const aboutCompanyBodyDe = `<p>Die 2015 gegründete Yueshou Co., Ltd. ist auf Forschung, Entwicklung, Herstellung und Vertrieb von Peptidprodukten sowie damit verbundene Dienstleistungen spezialisiert. Als staatlich anerkanntes, spezialisiertes und innovatives „Little Giant“-Unternehmen verfügt Yueshou über fortschrittliche und effiziente Kapazitäten für Peptidsynthese, Reinigung und Produktion im großen Maßstab sowie über eine Postdoktorandenstation der Provinz Guangdong und eine Akademiker- und Expertenstation. Mit dem Ziel, Gesundheit und Schönheit der Menschen zu fördern, nutzt das Unternehmen seine branchenführenden Kerntechnologien für Peptidsynthese und -modifikation, um kosmetische Peptidwirkstoffe und pharmazeutische Peptidprodukte zu liefern und entsprechende Dienstleistungen anzubieten.</p>
<p>Durch langjährige technische Entwicklung und Prozessforschung hat das Unternehmen eine branchenführende Plattform für die Synthese und Herstellung von Peptidarzneimitteln aufgebaut. Zu den eigenen Kerntechnologien für die großtechnische Produktion peptidischer Wirkstoffe zählen die Modifikation funktioneller Harze, die Synthese spezieller Aminosäurefragmente, die segmentierte Synthese langer Peptide, die gezielte Synthese polyzyklischer Peptide, die Kontrolle von Aggregaten langer Peptide und die Modifikation spezifischer funktioneller Gruppen. Die Prozessentwicklung und Produktionskompetenz für Peptidwirkstoffe bilden die Grundlage der Wettbewerbsfähigkeit und Geschäftsentwicklung. Yueshou entwickelt Wirkstoffkandidaten mit großem Marktpotenzial und hoher Wettbewerbsfähigkeit in China und auf internationalen Märkten und hat eine umfangreiche Pipeline aufgebaut, darunter bekannte Produkte wie Leuprorelin, Semaglutid, Liraglutid und Linaclotid.</p>
<p>Seit seiner Gründung erbringt das Unternehmen Peptid-CDMO/CRO-Dienstleistungen für namhafte innovative Pharmaunternehmen, darunter China Resources Double-Crane und Simcere Pharmaceutical. Peptidwirkstoffe und fortgeschrittene pharmazeutische Zwischenprodukte werden unter anderem in die USA, nach Russland, Pakistan und Südkorea exportiert.</p>
<p>Laut Frost &amp; Sullivan hatte das Unternehmen 2021 den größten Marktanteil bei kosmetischen Peptidwirkstoffen in China. Yueshou entwickelt seine Technologien für Peptidwirkstoffe kontinuierlich weiter und stärkt durch Prozessverbesserungen seine Kostenvorteile, um maßgeschneiderte Produkte mit klaren Wettbewerbsvorteilen anzubieten. Dank langjähriger Branchenerfahrung und umfassender technischer Kompetenz deckt das Unternehmen die gesamte Wertschöpfungskette ab: frühe Produktentwicklung, Forschung, Versuche, Pulverproduktion, Formulierung von Stammlösungen, Stabilitätsprüfung und Wirksamkeitsbewertung. So kann Yueshou bereits in der frühen Produktkonzeption mitwirken, Peptidwirkstoffe an Positionierung und Anwendung des Endprodukts anpassen und Lösungen während Produktgestaltung und Vermarktung entsprechend den Kundenanforderungen weiterentwickeln.</p>
<p>Das Unternehmen setzt konsequent auf eigenständige Innovation und treibt Forschungsprojekte im Bereich kosmetischer Peptidwirkstoffe voran. Darüber hinaus bestehen strategische Kooperationen mit führenden Kosmetikunternehmen wie Proya, Bloomage Biotech und Marubi. Mit wissenschaftlicher Kompetenz und erfolgreicher Anwendungserfahrung unterstützt Yueshou die weitere Entwicklung von Peptiden in Kosmetikprodukten.</p>
<h2>Kontaktinformationen</h2>
<p><strong>Adresse:</strong> Raum 332, 3. Etage, Guangcong 3rd Road 55, Taihe, Bezirk Baiyun, Guangzhou, China<br><strong>Telefon:</strong> <a href="tel:+8613435855558">+8613435855558</a><br><strong>Website:</strong> <a href="https://www.yueshou-peptide.com" target="_blank" rel="noopener noreferrer">www.yueshou-peptide.com</a></p>`;

const aboutCompanyBodyFr = `<p>Fondée en 2015, Yueshou Co., Ltd. se consacre à la recherche, au développement, à la fabrication et à la commercialisation de produits peptidiques, ainsi qu’aux services associés. Reconnue au niveau national comme entreprise spécialisée et innovante « Little Giant », elle dispose de capacités avancées et efficaces de synthèse, de purification et de production de peptides à grande échelle, ainsi que d’une station postdoctorale de la province du Guangdong et d’une station d’académiciens et d’experts. Animée par sa volonté de contribuer à la santé et à la beauté, Yueshou s’appuie sur des technologies de pointe en synthèse et en modification des peptides pour fournir des ingrédients peptidiques cosmétiques, des produits pharmaceutiques peptidiques et les services correspondants.</p>
<p>Au fil de nombreuses années de développement technique et d’exploration des procédés, l’entreprise a mis en place une plateforme de référence pour la synthèse et la fabrication de médicaments peptidiques. Ses technologies propriétaires destinées à la production à grande échelle de principes actifs peptidiques comprennent la modification de résines fonctionnelles, la synthèse de fragments d’acides aminés spéciaux, la synthèse segmentée de peptides longs, la synthèse dirigée de peptides polycycliques, la maîtrise des agrégats de peptides longs et la modification de groupes fonctionnels spécifiques. Les capacités de développement des procédés et de fabrication des API peptidiques constituent le socle de sa compétitivité et de sa croissance. Yueshou sélectionne des candidats présentant un fort potentiel de marché et une solide compétitivité en Chine comme à l’international, et a constitué un vaste portefeuille comprenant notamment le leuproréline, le sémaglutide, le liraglutide et le linaclotide.</p>
<p>Depuis sa création, l’entreprise fournit des services CDMO/CRO dans le domaine des peptides à des sociétés pharmaceutiques innovantes de premier plan, notamment China Resources Double-Crane et Simcere Pharmaceutical. Ses API peptidiques et intermédiaires pharmaceutiques avancés sont exportés vers les États-Unis, la Russie, le Pakistan, la Corée du Sud et d’autres pays et régions.</p>
<p>Selon Frost &amp; Sullivan, l’entreprise détenait en 2021 la plus grande part du marché chinois des ingrédients peptidiques cosmétiques. Yueshou poursuit l’innovation technologique dans ce domaine et renforce ses avantages de coûts grâce à l’amélioration continue des procédés, afin de proposer des produits personnalisés particulièrement compétitifs. Forte de nombreuses années d’expérience et d’une expertise technique approfondie, l’entreprise offre des services couvrant toute la chaîne de valeur : développement initial, recherche, expérimentation, production de poudres, formulation de solutions mères, essais de stabilité et évaluation de l’efficacité. Elle peut ainsi intervenir dès les premières étapes de conception, adapter les ingrédients peptidiques au positionnement et à l’usage du produit final, puis faire évoluer les solutions au cours de la conception et de la commercialisation selon les besoins du client.</p>
<p>L’entreprise reste attachée à l’innovation indépendante et poursuit activement ses projets de recherche sur les ingrédients peptidiques cosmétiques. Elle a également noué des partenariats stratégiques avec de grands groupes cosmétiques tels que Proya, Bloomage Biotech et Marubi. Son expertise scientifique et son expérience reconnue des applications peptidiques contribuent au développement continu des peptides dans les cosmétiques.</p>
<h2>Coordonnées</h2>
<p><strong>Adresse :</strong> Bureau 332, 3e étage, 55 Guangcong 3rd Road, Taihe, district de Baiyun, Guangzhou, Chine<br><strong>Téléphone :</strong> <a href="tel:+8613435855558">+8613435855558</a><br><strong>Site web :</strong> <a href="https://www.yueshou-peptide.com" target="_blank" rel="noopener noreferrer">www.yueshou-peptide.com</a></p>`;

const aboutCompanyBodyEs = `<p>Fundada en 2015, Yueshou Co., Ltd. se dedica a la investigación, el desarrollo, la fabricación y la venta de productos peptídicos, así como a los servicios relacionados. Reconocida a nivel nacional como empresa especializada e innovadora «Little Giant», cuenta con capacidades avanzadas y eficientes de síntesis, purificación y producción de péptidos a gran escala, además de una estación posdoctoral de la provincia de Guangdong y una estación de académicos y expertos. Con el propósito de contribuir a la salud y la belleza, Yueshou aprovecha sus tecnologías líderes de síntesis y modificación de péptidos para suministrar ingredientes peptídicos cosméticos, productos farmacéuticos peptídicos y los servicios correspondientes.</p>
<p>Tras años de desarrollo técnico y exploración de procesos, la empresa ha establecido una plataforma líder para la síntesis y fabricación de fármacos peptídicos. Sus tecnologías propias para la producción a gran escala de principios activos peptídicos incluyen la modificación de resinas funcionales, la síntesis de fragmentos especiales de aminoácidos, la síntesis segmentada de péptidos largos, la síntesis dirigida de péptidos policíclicos, el control de agregados de péptidos largos y la modificación de grupos funcionales específicos. Las capacidades de desarrollo de procesos y fabricación de API peptídicos constituyen la base de su competitividad y crecimiento. Yueshou selecciona candidatos con gran potencial de mercado y sólida competitividad tanto en China como a escala internacional, y ha desarrollado una amplia cartera que incluye productos conocidos como leuprorelina, semaglutida, liraglutida y linaclotida.</p>
<p>Desde su fundación, la empresa presta servicios CDMO/CRO de péptidos a destacadas compañías farmacéuticas innovadoras, entre ellas China Resources Double-Crane y Simcere Pharmaceutical. Sus API peptídicos e intermediarios farmacéuticos avanzados se exportan a Estados Unidos, Rusia, Pakistán, Corea del Sur y otros países y regiones.</p>
<p>Según Frost &amp; Sullivan, en 2021 la empresa tenía la mayor cuota del mercado chino de ingredientes peptídicos cosméticos. Yueshou continúa innovando en tecnologías de ingredientes peptídicos y refuerza sus ventajas de costes mediante mejoras de procesos para ofrecer productos personalizados altamente competitivos. Gracias a años de experiencia sectorial y a una amplia capacidad técnica, la empresa presta servicios integrales que abarcan el desarrollo inicial, la investigación, la experimentación, la producción de polvo, la formulación de soluciones madre, las pruebas de estabilidad y la evaluación de eficacia. Esto permite a Yueshou intervenir desde las primeras fases del diseño, adaptar los ingredientes peptídicos al posicionamiento y uso del producto final y perfeccionar las soluciones durante el diseño y la comercialización según las necesidades del cliente.</p>
<p>La empresa mantiene su compromiso con la innovación independiente y sigue impulsando proyectos de investigación en ingredientes peptídicos cosméticos. También ha establecido colaboraciones estratégicas con empresas cosméticas líderes como Proya, Bloomage Biotech y Marubi. Su experiencia científica y su trayectoria en aplicaciones de ingredientes peptídicos contribuyen al desarrollo continuo de los péptidos en el sector cosmético.</p>
<h2>Información de contacto</h2>
<p><strong>Dirección:</strong> Sala 332, 3.ª planta, n.º 55 de Guangcong 3rd Road, Taihe, distrito de Baiyun, Guangzhou, China<br><strong>Teléfono:</strong> <a href="tel:+8613435855558">+8613435855558</a><br><strong>Sitio web:</strong> <a href="https://www.yueshou-peptide.com" target="_blank" rel="noopener noreferrer">www.yueshou-peptide.com</a></p>`;

const corePages = [
  {
    slug: "home",
    translations: translated(
      { en: "Precision Peptide Research", zh_CN: "精准多肽研究", de: "Präzise Peptidforschung", fr: "Recherche peptidique de précision", es: "Investigación peptídica de precisión" },
      {
        en: "Peptide synthesis and analytical support for scientific research programs.",
        zh_CN: "为科学研究项目提供多肽合成与分析支持。",
        de: "Peptidsynthese und analytische Unterstützung für wissenschaftliche Forschungsprogramme.",
        fr: "Synthèse peptidique et soutien analytique pour les programmes de recherche scientifique.",
        es: "Síntesis de péptidos y apoyo analítico para programas de investigación científica.",
      },
    ),
  },
  {
    slug: "about",
    translations: translated(
      { en: "About Us", zh_CN: "关于我们", de: "Über uns", fr: "À propos de nous", es: "Sobre nosotros" },
      {
        en: aboutCompanyBodyEn,
        zh_CN: aboutCompanyBody,
        de: aboutCompanyBodyDe,
        fr: aboutCompanyBodyFr,
        es: aboutCompanyBodyEs,
      },
    ),
  },
  {
    slug: "services",
    translations: translated(
      { en: "Services", zh_CN: "服务", de: "Dienstleistungen", fr: "Services", es: "Servicios" },
      {
        en: "Focusing on beauty and research peptides, we offer factory direct supply and customized services to meet diverse needs.",
        zh_CN: "了解可配置的多肽合成、修饰、分析与项目支持。",
        de: "Entdecken Sie konfigurierbare Peptidsynthese, Modifikation, Analytik und Projektunterstützung.",
        fr: "Découvrez la synthèse, la modification, l’analyse et le soutien de projet configurables.",
        es: "Explore síntesis, modificación, análisis y apoyo de proyectos configurables.",
      },
    ),
  },
  {
    slug: "products",
    translations: translated(
      { en: "Products", zh_CN: "产品", de: "Produkte", fr: "Produits", es: "Productos" },
      {
        en: "Browse research peptide categories and available catalog information.",
        zh_CN: "浏览科研多肽分类与可用的目录信息。",
        de: "Durchsuchen Sie Forschungspeptid-Kategorien und verfügbare Kataloginformationen.",
        fr: "Parcourez les catégories de peptides de recherche et les informations de catalogue disponibles.",
        es: "Explore categorías de péptidos de investigación e información de catálogo disponible.",
      },
    ),
  },
  {
    slug: "quality",
    translations: translated(
      { en: "Quality", zh_CN: "质量", de: "Qualität", fr: "Qualité", es: "Calidad" },
      {
        en: "Review the quality controls and analytical information available for research projects.",
        zh_CN: "了解科研项目可用的质量控制与分析信息。",
        de: "Informieren Sie sich über Qualitätskontrollen und analytische Informationen für Forschungsprojekte.",
        fr: "Consultez les contrôles qualité et les informations analytiques disponibles pour les projets de recherche.",
        es: "Revise los controles de calidad y la información analítica disponible para proyectos de investigación.",
      },
    ),
  },
  {
    slug: "news",
    translations: translated(
      { en: "News", zh_CN: "新闻", de: "Neuigkeiten", fr: "Actualités", es: "Noticias" },
      {
        en: "Read updates about peptide research support and company activities.",
        zh_CN: "阅读多肽科研支持与公司动态。",
        de: "Lesen Sie Neuigkeiten über Peptidforschungsunterstützung und Unternehmensaktivitäten.",
        fr: "Lisez les actualités sur le soutien à la recherche peptidique et les activités de l’entreprise.",
        es: "Lea novedades sobre apoyo a la investigación de péptidos y actividades de la empresa.",
      },
    ),
  },
  {
    slug: "contact",
    translations: translated(
      { en: "Contact", zh_CN: "联系我们", de: "Kontakt", fr: "Contact", es: "Contacto" },
      {
        en: "Contact yueshou to discuss a scientific research requirement.",
        zh_CN: "联系粤首，讨论您的科学研究需求。",
        de: "Kontaktieren Sie yueshou, um eine wissenschaftliche Forschungsanforderung zu besprechen.",
        fr: "Contactez yueshou pour discuter d’un besoin de recherche scientifique.",
        es: "Contacte con yueshou para hablar de una necesidad de investigación científica.",
      },
    ),
  },
  {
    slug: "request-a-quote",
    translations: translated(
      { en: "Request a Quote", zh_CN: "申请报价", de: "Angebot anfordern", fr: "Demander un devis", es: "Solicitar presupuesto" },
      {
        en: "Share your research requirements so our team can prepare a project discussion.",
        zh_CN: "提交您的科研需求，以便我们的团队准备项目沟通。",
        de: "Teilen Sie Ihre Forschungsanforderungen mit, damit unser Team ein Projektgespräch vorbereiten kann.",
        fr: "Partagez vos besoins de recherche afin que notre équipe prépare un échange sur votre projet.",
        es: "Comparta sus requisitos de investigación para que nuestro equipo prepare una conversación sobre el proyecto.",
      },
    ),
  },
] as const;

const serviceSeeds = [
  {
    slug: "custom-peptide-synthesis",
    position: 10,
    translations: translated(
      { en: "Custom Peptide Synthesis", zh_CN: "定制多肽合成", de: "Kundenspezifische Peptidsynthese", fr: "Synthèse peptidique sur mesure", es: "Síntesis personalizada de péptidos" },
      {
        en: "Configurable peptide synthesis support for scientific research requirements.",
        zh_CN: "为科学研究需求提供可配置的多肽合成支持。",
        de: "Konfigurierbare Peptidsynthese-Unterstützung für wissenschaftliche Forschungsanforderungen.",
        fr: "Soutien configurable à la synthèse peptidique pour les besoins de recherche scientifique.",
        es: "Apoyo configurable de síntesis de péptidos para requisitos de investigación científica.",
      },
    ),
  },
  {
    slug: "peptide-modification",
    position: 20,
    translations: translated(
      { en: "Peptide Modification", zh_CN: "多肽修饰", de: "Peptidmodifikation", fr: "Modification peptidique", es: "Modificación de péptidos" },
      {
        en: "Discuss research-oriented peptide modification options with the project team.",
        zh_CN: "与项目团队讨论面向科研的多肽修饰方案。",
        de: "Besprechen Sie forschungsorientierte Peptidmodifikationen mit dem Projektteam.",
        fr: "Discutez des options de modification peptidique pour la recherche avec l’équipe projet.",
        es: "Analice opciones de modificación de péptidos para investigación con el equipo del proyecto.",
      },
    ),
  },
  {
    slug: "analytical-support",
    position: 30,
    translations: translated(
      { en: "Analytical Support", zh_CN: "分析支持", de: "Analytische Unterstützung", fr: "Soutien analytique", es: "Apoyo analítico" },
      {
        en: "Analytical information and documentation support can be aligned with project needs.",
        zh_CN: "分析信息与文件支持可根据项目需求进行配置。",
        de: "Analytische Informationen und Dokumentation können auf Projektanforderungen abgestimmt werden.",
        fr: "Les informations analytiques et la documentation peuvent être adaptées aux besoins du projet.",
        es: "La información analítica y la documentación pueden adaptarse a las necesidades del proyecto.",
      },
    ),
  },
  {
    slug: "project-consultation",
    position: 40,
    translations: translated(
      { en: "Project Consultation", zh_CN: "项目咨询", de: "Projektberatung", fr: "Conseil de projet", es: "Consultoría de proyectos" },
      {
        en: "Start a technical discussion about sequence, scale, timeline, and research documentation.",
        zh_CN: "围绕序列、规模、周期与科研文件开展技术沟通。",
        de: "Beginnen Sie ein technisches Gespräch über Sequenz, Maßstab, Zeitplan und Forschungsdokumentation.",
        fr: "Démarrez un échange technique sur la séquence, l’échelle, le calendrier et la documentation de recherche.",
        es: "Inicie una conversación técnica sobre secuencia, escala, calendario y documentación de investigación.",
      },
    ),
  },
] as const;

const corePageTranslations = (slug: string) => corePages.find((page) => page.slug === slug)!.translations;

const homeAboutTranslations = translated(
  { en: "About Us", zh_CN: "关于我们", de: "Über uns", fr: "À propos de nous", es: "Sobre nosotros" },
  {
    en: "Yueshou Bio is a national-level specialized, refined, distinctive, and innovative \"Little Giant\" enterprise focused on peptide research, development, production, and application. The company hosts a national postdoctoral research station and an academician-expert workstation, as well as a provincial enterprise research institute. It is also Guangdong Province's first Peptide Synthesis Engineering Research Center and has been granted 108 related invention patents, making it one of the leading enterprises in large-scale peptide production in China. The company has established a \"one core, two wings, dual-wheel drive\" development strategy, with drug peptides and their technical services as the core, and cosmetic peptides and other peptides as the two supporting wings. This strategy drives growth through both pharmaceutical and non-pharmaceutical peptides, while simultaneously advancing innovation capabilities and expanding market channels and customer base.",
    zh_CN: "粤首生物是一家专注于多肽研发、生产和应用的国家级专精特新“小巨人”企业。公司设有国家级博士后科研工作站、院士专家工作站以及省级企业研究院，同时也是广东省首家多肽合成工程研究中心，已获得108项相关发明专利，是国内多肽规模化生产领域的领先企业之一。公司确立了“一核两翼、双轮驱动”的发展战略，以药物多肽及其技术服务为核心，以化妆品多肽和其他多肽为两翼，通过医药与非医药多肽双轮驱动发展，同时提升创新能力，拓展市场渠道与客户群体。",
    de: "Yueshou Bio ist ein auf nationaler Ebene anerkanntes, spezialisiertes und innovatives „Little Giant“-Unternehmen mit Schwerpunkt auf Forschung, Entwicklung, Produktion und Anwendung von Peptiden. Das Unternehmen verfügt über eine nationale Postdoktoranden-Forschungsstation, eine Akademiker- und Expertenstation sowie ein Forschungsinstitut auf Provinzebene. Darüber hinaus ist es das erste Forschungszentrum für Peptidsynthese-Engineering in der Provinz Guangdong und besitzt 108 einschlägige Erfindungspatente, womit es zu den führenden Unternehmen für die großtechnische Peptidproduktion in China zählt. Yueshou verfolgt die Entwicklungsstrategie „ein Kern, zwei Flügel, dualer Antrieb“: Arzneimittelpeptide und die zugehörigen technischen Dienstleistungen bilden den Kern, kosmetische Peptide und andere Peptide die beiden unterstützenden Flügel. Das Wachstum wird sowohl durch pharmazeutische als auch durch nicht pharmazeutische Peptide vorangetrieben, während zugleich die Innovationsfähigkeit gestärkt und Marktkanäle sowie Kundenbasis erweitert werden.",
    fr: "Yueshou Bio est une entreprise nationale spécialisée et innovante de type « Little Giant », axée sur la recherche, le développement, la production et l’application des peptides. L’entreprise dispose d’une station nationale de recherche postdoctorale, d’une station d’académiciens et d’experts, ainsi que d’un institut de recherche d’entreprise de niveau provincial. Elle est également le premier centre de recherche en ingénierie de la synthèse peptidique de la province du Guangdong et détient 108 brevets d’invention dans ce domaine, ce qui en fait l’une des entreprises chinoises de référence pour la production de peptides à grande échelle. Yueshou a adopté une stratégie de développement « un cœur, deux ailes, double moteur » : les peptides pharmaceutiques et les services techniques associés constituent le cœur, tandis que les peptides cosmétiques et les autres peptides forment les deux ailes. Cette stratégie stimule la croissance grâce aux peptides pharmaceutiques et non pharmaceutiques, tout en renforçant les capacités d’innovation et en élargissant les canaux commerciaux et la clientèle.",
    es: "Yueshou Bio es una empresa nacional especializada e innovadora del tipo «Little Giant», centrada en la investigación, el desarrollo, la producción y la aplicación de péptidos. La empresa cuenta con una estación nacional de investigación posdoctoral, una estación de académicos y expertos y un instituto empresarial de investigación de ámbito provincial. También es el primer Centro de Investigación en Ingeniería de Síntesis de Péptidos de la provincia de Guangdong y posee 108 patentes de invención relacionadas, lo que la convierte en una de las empresas líderes de China en la producción de péptidos a gran escala. Yueshou ha establecido una estrategia de desarrollo de «un núcleo, dos alas y doble motor»: los péptidos farmacéuticos y sus servicios técnicos constituyen el núcleo, mientras que los péptidos cosméticos y otros péptidos forman las dos alas de apoyo. Esta estrategia impulsa el crecimiento mediante péptidos farmacéuticos y no farmacéuticos, al tiempo que fortalece la capacidad de innovación y amplía los canales de mercado y la base de clientes.",
  },
);

const homeSectionSeeds = [
  { type: PageSectionType.HERO, config: { primaryCta: { label: "Request a quote", href: "/request-a-quote" }, secondaryCta: { label: "Explore services", href: "/services" } }, translations: corePageTranslations("home") },
  { type: PageSectionType.SERVICES, config: {}, translations: corePageTranslations("services") },
  { type: PageSectionType.ABOUT, config: {}, translations: homeAboutTranslations },
  { type: PageSectionType.FACTORY, config: { imageIds: [] }, translations: translated(
    { en: "Our Factory", zh_CN: "我们的工厂", de: "Unsere Fabrik", fr: "Notre usine", es: "Nuestra fábrica" },
    { en: "Standardized production workshops equipped with advanced synthesis and purification technology.", zh_CN: "配备先进合成与纯化技术的标准化生产车间。", de: "Standardisierte Produktionswerkstätten mit fortschrittlicher Synthese- und Reinigungstechnologie.", fr: "Des ateliers de production standardisés équipés de technologies avancées de synthèse et de purification.", es: "Talleres de producción estandarizados equipados con tecnología avanzada de síntesis y purificación." },
  ) },
  { type: PageSectionType.CAPABILITIES, config: {}, translations: translated(
    { en: "Research Capabilities", zh_CN: "科研能力", de: "Forschungskapazitäten", fr: "Capacités de recherche", es: "Capacidades de investigación" },
    { en: "Configure project requirements with our peptide research team.", zh_CN: "与我们的多肽科研团队配置项目需求。", de: "Konfigurieren Sie Projektanforderungen mit unserem Peptidforschungsteam.", fr: "Configurez les besoins du projet avec notre équipe de recherche peptidique.", es: "Configure los requisitos del proyecto con nuestro equipo de investigación de péptidos." },
  ) },
  { type: PageSectionType.QUALITY, config: {}, translations: corePageTranslations("quality") },
  { type: PageSectionType.STATS, config: { items: [] }, translations: translated(
    { en: "Project Information", zh_CN: "项目信息", de: "Projektinformationen", fr: "Informations projet", es: "Información del proyecto" },
    { en: "Replace these editable placeholders with verified operating information.", zh_CN: "请使用经核实的运营信息替换这些可编辑占位内容。", de: "Ersetzen Sie diese bearbeitbaren Platzhalter durch geprüfte Betriebsinformationen.", fr: "Remplacez ces éléments modifiables par des informations opérationnelles vérifiées.", es: "Sustituya estos elementos editables por información operativa verificada." },
  ) },
  { type: PageSectionType.NEWS, config: { count: 3 }, translations: corePageTranslations("news") },
  { type: PageSectionType.CTA, config: { primaryCta: { label: "Request a quote", href: "/request-a-quote" } }, translations: corePageTranslations("request-a-quote") },
] as const;

const navigation = [
  { slug: "home", href: "/", position: 0, titles: { en: "Home", zh_CN: "首页", de: "Startseite", fr: "Accueil", es: "Inicio" } },
  { slug: "about", href: "/about", position: 10, titles: { en: "About", zh_CN: "关于我们", de: "Über uns", fr: "À propos", es: "Nosotros" } },
  { slug: "services", href: "/services", position: 20, titles: { en: "Services", zh_CN: "服务", de: "Leistungen", fr: "Services", es: "Servicios" } },
  { slug: "products", href: "/products", position: 30, titles: { en: "Products", zh_CN: "产品", de: "Produkte", fr: "Produits", es: "Productos" } },
  { slug: "news", href: "/news", position: 50, titles: { en: "News", zh_CN: "新闻", de: "Neuigkeiten", fr: "Actualités", es: "Noticias" } },
  { slug: "contact", href: "/contact", position: 60, titles: { en: "Contact", zh_CN: "联系我们", de: "Kontakt", fr: "Contact", es: "Contacto" } },
] as const;

const pageTranslationData = (translations: ReturnType<typeof translated>) => translations.map(({ locale, title, body }) => ({
  locale,
  title,
  body,
  seoTitle: title,
  seoDescription: body,
}));

async function seedServices(seededAt: Date) {
  const seeded = [] as Array<{ id: string; slug: string; position: number; status: PublishStatus; deletedAt: Date | null }>;
  for (const serviceSeed of serviceSeeds) {
    const existing = await prisma.service.findUnique({
      where: { slug: serviceSeed.slug },
      select: { id: true, slug: true, position: true, status: true, deletedAt: true },
    });
    if (existing) {
      seeded.push(existing);
      continue;
    }
    seeded.push(await prisma.service.create({
      data: {
        slug: serviceSeed.slug,
        position: serviceSeed.position,
        status: PublishStatus.PUBLISHED,
        publishedAt: seededAt,
        translations: {
          create: serviceSeed.translations.map(({ locale, title, body }) => ({ locale, title, body })),
        },
      },
      select: { id: true, slug: true, position: true, status: true, deletedAt: true },
    }));
  }
  return seeded;
}

async function seedCorePages(seededAt: Date) {
  const seeded = new Map<string, { id: string }>();
  for (const pageSeed of corePages) {
    const existing = await prisma.page.findUnique({ where: { slug: pageSeed.slug }, select: { id: true } });
    if (existing) {
      seeded.set(pageSeed.slug, existing);
      continue;
    }
    const created = await prisma.page.create({
      data: {
        slug: pageSeed.slug,
        status: PublishStatus.PUBLISHED,
        publishedAt: seededAt,
        translations: { create: pageTranslationData([...pageSeed.translations]) },
      },
      select: { id: true },
    });
    seeded.set(pageSeed.slug, created);
  }
  return seeded;
}

async function seedHomeSections(homePageId: string, serviceIds: string[], seededAt: Date) {
  const existing = await prisma.pageSection.findMany({
    where: { pageId: homePageId },
    select: { type: true, position: true },
  });
  const existingTypes = new Set(existing.map((section) => section.type));
  let nextPosition = existing.reduce((highest, section) => Math.max(highest, section.position), -1) + 1;

  for (const sectionSeed of homeSectionSeeds) {
    if (existingTypes.has(sectionSeed.type)) continue;
    const config = sectionSeed.type === PageSectionType.SERVICES
      ? { serviceIds }
      : sectionSeed.config;
    await prisma.pageSection.create({
      data: {
        pageId: homePageId,
        type: sectionSeed.type,
        position: nextPosition,
        isEnabled: true,
        config: config as Prisma.InputJsonValue,
        status: PublishStatus.PUBLISHED,
        publishedAt: seededAt,
        translations: {
          create: sectionSeed.translations.map(({ locale, title, body }) => ({ locale, title, body })),
        },
      },
    });
    existingTypes.add(sectionSeed.type);
    nextPosition += 1;
  }
}

async function main() {
  if (bootstrapAdmin) {
    const passwordHash = await argon2.hash(bootstrapAdmin.password, { type: argon2.argon2id });
    await prisma.$transaction(
      (transaction) => createBootstrapAdmin(transaction, { email: bootstrapAdmin.email, passwordHash }),
      { isolationLevel: "Serializable" },
    );
  }

  const seededAt = new Date();
  const brandTranslations = translated(
      { en: "yueshou", zh_CN: "yueshou", de: "yueshou", fr: "yueshou", es: "yueshou" },
      {
        en: "Precision Peptide Synthesis for Global Scientific Research",
        zh_CN: "面向全球科学研究的精准多肽合成",
        de: "Präzise Peptidsynthese für die globale wissenschaftliche Forschung",
        fr: "Synthèse peptidique de précision pour la recherche scientifique mondiale",
        es: "Síntesis precisa de péptidos para la investigación científica global",
      },
    );
  const existingBrand = await prisma.siteSetting.findUnique({ where: { key: "brand" }, select: { id: true } });
  if (!existingBrand) {
    await prisma.siteSetting.create({
      data: {
        key: "brand",
        value: {
          socialLinks: [
            { label: "Facebook", href: "https://www.facebook.com" },
            { label: "Instagram", href: "https://www.instagram.com" },
            { label: "X", href: "https://x.com" },
            { label: "TikTok", href: "https://www.tiktok.com" },
            { label: "WhatsApp", href: "https://wa.me/8613435855558" },
          ],
        },
        status: PublishStatus.PUBLISHED,
        publishedAt: seededAt,
        translations: {
          create: brandTranslations.map(({ locale, title, body }) => ({ locale, title, body })),
        },
      },
    });
  }

  for (const item of navigation) {
    const { titles, ...navigationData } = item;
    const existingNavigation = await prisma.navigationItem.findUnique({ where: { slug: item.slug }, select: { id: true } });
    if (existingNavigation) continue;
    await prisma.navigationItem.create({
      data: {
        ...navigationData,
        status: PublishStatus.PUBLISHED,
        publishedAt: seededAt,
        translations: { create: locales.map((locale) => ({ locale, title: titles[locale] })) },
      },
    });
  }

  const services = await seedServices(seededAt);
  const pages = await seedCorePages(seededAt);
  const home = pages.get("home");
  if (!home) throw new Error("The home page seed is missing");
  await seedHomeSections(
    home.id,
    services
      .filter((service) => service.status === PublishStatus.PUBLISHED && service.deletedAt === null)
      .sort((left, right) => left.position - right.position)
      .map((service) => service.id),
    seededAt,
  );

  for (const legalPage of legalPages) {
    const existingLegalPage = await prisma.page.findUnique({ where: { slug: legalPage.slug }, select: { id: true } });
    if (existingLegalPage) continue;
    await prisma.page.create({
      data: {
        slug: legalPage.slug,
        status: PublishStatus.DRAFT,
        legalReviewStatus: LegalReviewStatus.PENDING,
        translations: { create: pageTranslationData([...legalPage.translations]) },
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
