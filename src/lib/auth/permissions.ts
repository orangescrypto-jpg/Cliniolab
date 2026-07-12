import type { UserRole } from '@/types';

/** Central place for role-based permission checks used across API routes and pages. */
export const permissions = {
  canAttemptQuizzes: (role: UserRole | null) => role !== null, // any logged-in user
  canCreateQuizzes: (role: UserRole | null) => role !== null, // any logged-in user
  canManageBlog: (role: UserRole | null) => role === 'admin' || role === 'moderator',
  canManageLearningContent: (role: UserRole | null) => role === 'admin' || role === 'moderator',
  canAccessAdminPanel: (role: UserRole | null) => role === 'admin' || role === 'moderator',
  canManageFeatureFlags: (role: UserRole | null) => role === 'admin',
  canManageUsers: (role: UserRole | null) => role === 'admin',
  canDeleteAnyQuiz: (role: UserRole | null) => role === 'admin',
  canEditStaticPages: (role: UserRole | null) => role === 'admin',
};

/** True if the user owns the resource, or is an admin/moderator (full control over any user's content). */
export function isOwnerOrStaff(role: UserRole | null, resourceOwnerId: string, userId: string | null): boolean {
  if (role === 'admin' || role === 'moderator') return true;
  return userId !== null && userId === resourceOwnerId;
}
