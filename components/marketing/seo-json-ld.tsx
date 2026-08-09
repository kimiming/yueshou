import { serializeJsonLd, type JsonLdValue } from "@/features/seo/json-ld";

type SeoJsonLdProps = {
  data: JsonLdValue | JsonLdValue[];
};

export function SeoJsonLd({ data }: SeoJsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
