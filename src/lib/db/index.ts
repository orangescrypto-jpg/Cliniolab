/**
 * Single import surface for all database access.
 *
 * Components, API routes, and server actions should import from
 * '@/lib/db' rather than reaching into individual service files or,
 * critically, the D1 client directly. This is what enforces the
 * service-abstraction requirement across the codebase.
 */

export * as categoryService from './services/categoryService';
export * as quizService from './services/quizService';
export * as attemptService from './services/attemptService';
export * as leaderboardService from './services/leaderboardService';
export * as commentService from './services/commentService';
export * as reportService from './services/reportService';
export * as cmsService from './services/cmsService';
export * as certificateService from './services/certificateService';
export * as userService from './services/userService';
export * as featureFlagService from './services/featureFlagService';
export * as siteSettingsService from './services/siteSettingsService';
export * as pushSubscriptionService from './services/pushSubscriptionService';
export * as resourceService from './services/resourceService';
export * as emailLogService from './services/emailLogService';
export * as searchService from './services/searchService';
export * as feedbackService from './services/feedbackService';
export * as analyticsService from './services/analyticsService';
export * as quizPurchaseService from './services/quizPurchaseService';
export * as bannerService from './services/bannerService';
export * as payoutRequestService from './services/payoutRequestService';
export * as bookmarkService from './services/bookmarkService';
export * as abbreviationService from './services/abbreviationService';
export * as scholarService from './services/scholarService';

export { RetakeNotAllowedError } from './services/attemptService';
