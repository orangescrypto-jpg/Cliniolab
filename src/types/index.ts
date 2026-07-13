// ============================================
// USERS & ROLES
// ============================================

export type UserRole = 'user' | 'moderator' | 'admin';

export interface AppUser {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  emailQuizResults: boolean;
  emailNewsletter: boolean;
  currentStreakDays: number;
  longestStreakDays: number;
  lastActivityDate: string | null;
  creatorBalanceKobo: number;
  payoutBankCode: string | null;
  payoutBankName: string | null;
  payoutAccountNumber: string | null;
  payoutAccountName: string | null;
  createdAt: string;
}

// ============================================
// CATEGORIES
// ============================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

// ============================================
// QUIZZES
// ============================================

export type QuizMode = 'study' | 'quiz' | 'exam';
export type QuizDifficulty = 'easy' | 'medium' | 'hard';
export type QuizVisibility = 'public' | 'private';
export type QuizStatus = 'draft' | 'published' | 'archived';
export type RetakePolicy = 'unlimited' | 'single' | 'daily_limit' | 'cooldown';
export type QuestionType = 'mcq' | 'true_false' | 'fill_blank';
export type LinkExpiryOption = '1d' | '3d' | '7d' | 'custom';

export interface Quiz {
  id: string;
  subcategoryId: string;
  creatorId: string;
  title: string;
  description: string | null;
  mode: QuizMode;
  difficulty: QuizDifficulty;
  visibility: QuizVisibility;
  shareSlug: string | null;
  linkExpiresAt: string | null;
  timeLimitSeconds: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  antiCheatEnabled: boolean;
  retakePolicy: RetakePolicy;
  retakeLimit: number | null;
  status: QuizStatus;
  pricing: 'free' | 'paid';
  priceKobo: number | null;
  allowFlagging: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuizWithStats extends Quiz {
  questionCount: number;
  attemptCount: number;
  averageScorePercent: number | null;
  commentCount: number;
  categoryName?: string;
  subcategoryName?: string;
  creatorName?: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  type: QuestionType;
  prompt: string;
  options: QuestionOption[] | null;
  correctAnswer: string;
  explanation: string | null;
  sortOrder: number;
}

export interface QuestionOption {
  id: string;
  text: string;
}

// Input shape used when creating/bulk-uploading quizzes
export interface QuizInput {
  subcategoryId: string;
  title: string;
  description?: string;
  mode: QuizMode;
  difficulty: QuizDifficulty;
  visibility: QuizVisibility;
  linkExpiry?: LinkExpiryOption;
  customExpiryDate?: string; // ISO, required when linkExpiry === 'custom'
  timeLimitSeconds?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  antiCheatEnabled: boolean;
  retakePolicy: RetakePolicy;
  retakeLimit?: number;
  pricing?: 'free' | 'paid';
  priceKobo?: number;
  allowFlagging?: boolean;
  questions: QuizQuestionInput[];
}

export interface QuizQuestionInput {
  type: QuestionType;
  prompt: string;
  options?: QuestionOption[];
  correctAnswer: string;
  explanation?: string;
}

// ============================================
// ATTEMPTS
// ============================================

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  score: number;
  totalQuestions: number;
  timeTakenSeconds: number | null;
  countsForLeaderboard: boolean;
  startedAt: string;
  completedAt: string | null;
}

export interface AttemptAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  submittedAnswer: string | null;
  isCorrect: boolean;
}

export interface AttemptSubmission {
  quizId: string;
  answers: { questionId: string; submittedAnswer: string }[];
  timeTakenSeconds: number;
}

export interface AttemptResult {
  attemptId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  countedForLeaderboard: boolean;
  perQuestion: {
    questionId: string;
    prompt: string;
    submittedAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string | null;
    options: QuestionOption[];
  }[];
}

// ============================================
// LEADERBOARD
// ============================================

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalScore: number;
  quizzesTaken: number;
  averagePercentage: number;
  rank: number;
}

// ============================================
// COMMENTS
// ============================================

export interface Comment {
  id: string;
  quizId: string | null;
  blogPostId: string | null;
  userId: string;
  authorName: string;
  parentCommentId: string | null;
  body: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  replies?: Comment[];
}

// ============================================
// REPORTS
// ============================================

export type ReportStatus = 'open' | 'reviewed' | 'dismissed';

export interface QuestionReport {
  id: string;
  questionId: string;
  userId: string;
  reason: string | null;
  status: ReportStatus;
  createdAt: string;
}

/** A report joined with question/quiz context for creator and admin dashboards. */
export interface QuestionReportWithContext extends QuestionReport {
  questionPrompt: string;
  quizId: string;
  quizTitle: string;
  reporterName: string | null;
}

// ============================================
// BLOG / CMS
// ============================================

export type BlogStatus = 'draft' | 'published';

export type BlogContentFormat = 'markdown' | 'html';

export interface BlogPost {
  id: string;
  authorId: string;
  title: string;
  slug: string;
  content: string;
  contentFormat: BlogContentFormat;
  excerpt: string | null;
  category: string | null; // legacy free-text tag, kept for old posts
  blogCategoryId: string | null;
  blogSubcategoryId: string | null;
  featuredImageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  status: BlogStatus;
  isSponsored: boolean;
  isPinned: boolean;
  sendAsNewsletter: boolean;
  newsletterSentAt: string | null;
  createdAt: string;
}

export interface StaticPage {
  id: string; // 'about' | 'contact' | 'terms' | 'privacy' | 'faq' | 'disclaimer'
  title: string;
  content: string;
  updatedAt: string;
}

// ============================================
// FEATURE FLAGS
// ============================================

export type FeatureFlagKey =
  | 'leaderboard_general'
  | 'leaderboard_category'
  | 'leaderboard_per_quiz'
  | 'comments'
  | 'public_quiz_creation'
  | 'certificates'
  | 'homepage_video'
  | 'resources'
  | 'email_welcome'
  | 'email_leaderboard_recognition'
  | 'email_newsletter'
  | 'email_quiz_results'
  | 'email_comment_reply'
  | 'email_inactivity_nudge'
  | 'email_certificate_issued'
  | 'daily_quiz'
  | 'jobs_page'
  | 'scholarships_page'
  | 'medical_abbreviations'
  | 'scholar_of_the_day'
  | 'bookmarks'
  | 'site_search'
  | 'feedback_widget'
  | 'paid_quizzes'
  | 'banners_header'
  | 'banners_footer';

export interface FeatureFlag {
  key: FeatureFlagKey;
  enabled: boolean;
  label: string | null;
}

// ============================================
// CERTIFICATES
// ============================================

export interface Certificate {
  id: string;
  userId: string;
  quizId: string;
  quizTitle: string;
  issuedAt: string;
}

// ============================================
// SITE SETTINGS (small admin-editable content blocks)
// ============================================

export interface CookieConsentSetting {
  enabled: boolean;
  message: string;
  policyLinkText: string;
  policyUrl: string;
  acceptButtonText: string;
  declineButtonText: string;
}

export interface HomepageVideoSetting {
  youtubeUrl: string;
  title: string;
  description: string;
}

/** How many related quizzes to show, and whether the section is shown at
 *  all, on the quiz detail page and blog post page respectively. */
export interface RelatedQuizzesSetting {
  enabled: boolean;
  count: number;
}

// ============================================
// BANNERS (admin-managed CTA / advertising banners)
// ============================================

export type BannerPlacement = 'header' | 'footer';

export interface Banner {
  id: string;
  placement: BannerPlacement;
  title: string;
  imagePath: string;
  linkUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Impression/click counts for a banner, shown in the admin list so you can report performance to a sponsor. */
export interface BannerStats {
  bannerId: string;
  impressionCount: number;
  clickCount: number;
  /** Click-through rate as a percentage, e.g. 2.35. Null if there have been no impressions yet. */
  ctrPercent: number | null;
}

// ============================================
// RESOURCES (Books & Past Question Packs)
// ============================================

export type ResourceKind = 'book' | 'past_question_pack';
export type ResourcePricing = 'free' | 'paid';
export type ResourceStatus = 'draft' | 'published' | 'archived';

export interface Resource {
  id: string;
  kind: ResourceKind;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  institutionName: string | null;
  subjectTag: string | null;
  pricing: ResourcePricing;
  priceKobo: number | null;
  uploadedBy: string;
  status: ResourceStatus;
  createdAt: string;
  // Never includes driveLink unless the requesting user is entitled to it
  // (free resource, or paid + confirmed purchase, or admin/moderator).
}

export type PurchaseStatus = 'pending' | 'confirmed' | 'rejected';

export interface ResourcePurchase {
  id: string;
  resourceId: string;
  userId: string;
  proofImageUrl: string | null;
  txRef: string | null;
  flwTransactionId: string | null;
  status: PurchaseStatus;
  confirmedBy: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

/** Site-wide setting controlling how ALL resource purchases are collected. */
export type ResourcePaymentMode = 'manual' | 'flutterwave';

/** What the client needs to render the correct download/pay button state. */
export interface ResourceAccessState {
  resource: Resource;
  access: 'download' | 'pay_to_unlock' | 'payment_pending' | 'payment_rejected';
}

// ============================================
// QUIZ PURCHASES (paid quizzes, Flutterwave — platform collects, creators withdraw via payout request)
// ============================================

export type PurchaseTransactionStatus = 'pending' | 'completed' | 'failed';

export interface QuizPurchase {
  id: string;
  quizId: string;
  buyerId: string;
  amountKobo: number;
  platformFeeKobo: number;
  creatorEarningKobo: number;
  txRef: string;
  flwTransactionId: string | null;
  status: PurchaseTransactionStatus;
  createdAt: string;
}

export type PayoutMethod = 'flutterwave' | 'manual';
export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

export interface PayoutRequest {
  id: string;
  creatorId: string;
  amountKobo: number;
  method: PayoutMethod | null;
  status: PayoutStatus;
  flwTransferId: string | null;
  adminNote: string | null;
  actionedBy: string | null;
  createdAt: string;
  actionedAt: string | null;
}

// ============================================
// FEEDBACK
// ============================================

export type FeedbackCategory = 'bug' | 'suggestion' | 'general';
export type FeedbackStatus = 'open' | 'reviewed' | 'resolved';

export interface Feedback {
  id: string;
  userId: string | null;
  category: FeedbackCategory;
  message: string;
  pageUrl: string | null;
  status: FeedbackStatus;
  createdAt: string;
}

// ============================================
// DASHBOARD
// ============================================

export interface UserDashboardStats {
  totalAttempts: number;
  averagePercentage: number;
  bestPercentage: number;
  quizzesCreated: number;
  certificatesEarned: number;
  scoreHistory: { date: string; percentage: number; quizTitle: string }[];
}

// ============================================
// BOOKMARKS
// ============================================

export type BookmarkKind = 'quiz' | 'resource';

export interface Bookmark {
  id: string;
  userId: string;
  kind: BookmarkKind;
  targetId: string;
  createdAt: string;
}

// ============================================
// MEDICAL ABBREVIATIONS
// ============================================

export interface MedicalAbbreviation {
  id: string;
  abbreviation: string;
  meaning: string;
  category: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// SCHOLAR OF THE DAY
// ============================================

export interface ScholarOfTheDay {
  id: string;
  studentUserId: string | null;
  name: string;
  photoUrl: string | null;
  bio: string | null;
  achievement: string | null;
  quote: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}
