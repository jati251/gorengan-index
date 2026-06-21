import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://gorengan-index.cekcok.my.id',
      lastModified: new Date(),
      changeFrequency: 'hourly', // Since market prices fluctuate
      priority: 1,
    },
  ];
}
