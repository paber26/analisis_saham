// Hydrate login state on every request (server: reads the cookie via SSR;
// client: confirms on navigation) so the session persists across reloads.
export default defineNuxtPlugin(async () => {
  await useAuth().refresh();
});
