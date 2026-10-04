/**
 * Routes the student web app must never reach.
 *
 * `admin/` is the obvious one, but the backend mounts plenty of staff surface
 * outside that prefix. The backend's RolesGuard is authoritative and will deny
 * these regardless — blocking them here is defence in depth, and it turns "a
 * student token relayed into a staff endpoint" from a 403 in the logs into a
 * request that is never made. The read paths of `catalog/`, `subjects/` and
 * `search/` stay allowed on purpose: they are public browsing.
 */
export const BLOCKED_PREFIXES = [
  'auth/login',
  'auth/register',
  'auth/refresh',
  'auth/logout',
  'payments/webhooks',
  'admin',
  'analytics',
  'audit',
  'security-events',
  'sessions',
  'master',
  'storage/admin',
  'storage/internal',
  'users/admin',
  'enrollments/admin',
  'courses/admin',
  'notifications/broadcast',
  'notifications/announcements',
  'notifications/course',
];

export function isBlockedPath(pathStr: string): boolean {
  const normalized = pathStr.replace(/^\/+|\/+$/g, '');
  if (
    BLOCKED_PREFIXES.some(
      (p) => normalized === p || normalized.startsWith(p + '/')
    )
  ) {
    return true;
  }
  // Prevent access to staff breakdown/export routes
  const segments = normalized.split('/');
  if (segments.includes('admin') || segments.includes('students')) {
    return true;
  }
  return false;
}
