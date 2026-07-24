import { getSessionUser } from '../../utils/auth';

// GET /api/auth/me — who am I? Used by the frontend to hydrate login state.
export default defineEventHandler((event) => {
  const user = getSessionUser(event);
  return { loggedIn: !!user, user };
});
