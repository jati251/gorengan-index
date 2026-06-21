import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/', // Prevent indexing internal APIs
    },
    sitemap: 'https://gorengan-index.cekcok.my.id/sitemap.xml',
  };
}
