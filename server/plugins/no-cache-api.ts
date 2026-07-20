import { setResponseHeader } from 'h3';

// Force API responses to be un-cacheable by shared/edge caches (Cloudflare).
// defineCachedEventHandler emits `s-maxage`, which makes CF cache API responses
// at the edge — serving stale data after deploys and ignoring our origin-side
// day-key + daily sync. Overriding in `beforeResponse` runs AFTER the handler,
// so it reliably wins. Origin caching (fs driver) still makes responses fast.
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('beforeResponse', (event) => {
    if (event.path?.startsWith('/api/')) {
      setResponseHeader(event, 'cache-control', 'no-store');
    }
  });
});
