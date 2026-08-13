"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import type { MediaViewModel } from "@/features/content/view-models";
import { publicMediaUrl } from "@/features/media/public-url";

export function ProductGallery({ media }: { media: MediaViewModel[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (media.length < 2) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % media.length), 3_000);
    return () => window.clearInterval(timer);
  }, [media.length]);

  useEffect(() => {
    if (active >= media.length) setActive(0);
  }, [active, media.length]);

  if (!media.length) return <div className="product-gallery product-gallery--empty" />;
  const selected = media[active] ?? media[0];

  return (
    <div className="product-gallery">
      <div className="product-gallery__main" aria-live="polite">
        <Image
          src={publicMediaUrl(selected.id)}
          alt={selected.alt}
          width={selected.width ?? 768}
          height={selected.height ?? 768}
          priority
        />
      </div>
      {media.length > 1 ? <div className="product-gallery__thumbs" aria-label="Product images">
        {media.map((item, index) => <button
          type="button"
          className={index === active ? "is-active" : ""}
          onClick={() => setActive(index)}
          aria-label={`Show image ${index + 1}`}
          aria-current={index === active ? "true" : undefined}
          key={item.id}
        >
          <Image src={publicMediaUrl(item.id)} alt="" width={96} height={96} />
        </button>)}
      </div> : null}
    </div>
  );
}
