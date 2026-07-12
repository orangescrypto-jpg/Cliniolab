-- Categories
INSERT INTO categories (id, name, slug, description, sort_order) VALUES
('cat_core_sciences', 'Core Sciences', 'core-sciences', 'Foundational scientific knowledge for clinical practice', 1),
('cat_nursing_practice', 'Clinical Practice', 'clinical-practice', 'Practical clinical skills and specialty care across nursing, medicine, and allied health', 2),
('cat_clinical_specialties', 'Clinical Specialties', 'clinical-specialties', 'Focused clinical disease areas', 3),
('cat_exam_prep', 'Exam Prep', 'exam-prep', 'Board and licensing exam preparation', 4),
('cat_other', 'Other', 'other', 'Supplementary topics', 5);

-- Subcategories: Core Sciences
INSERT INTO subcategories (id, category_id, name, slug, sort_order) VALUES
('sub_anatomy_physiology', 'cat_core_sciences', 'Anatomy & Physiology', 'anatomy-physiology', 1),
('sub_pharmacology', 'cat_core_sciences', 'Pharmacology', 'pharmacology', 2),
('sub_microbiology', 'cat_core_sciences', 'Microbiology', 'microbiology', 3),
('sub_pathophysiology', 'cat_core_sciences', 'Pathophysiology', 'pathophysiology', 4),
('sub_biochemistry', 'cat_core_sciences', 'Biochemistry', 'biochemistry', 5);

-- Subcategories: Clinical Practice
INSERT INTO subcategories (id, category_id, name, slug, sort_order) VALUES
('sub_fundamentals_nursing', 'cat_nursing_practice', 'Fundamentals of Nursing', 'fundamentals-of-nursing', 1),
('sub_medsurg', 'cat_nursing_practice', 'Medical-Surgical Nursing', 'medical-surgical-nursing', 2),
('sub_maternal_child', 'cat_nursing_practice', 'Maternal & Child Health', 'maternal-child-health', 3),
('sub_mental_health', 'cat_nursing_practice', 'Mental Health / Psychiatric Nursing', 'mental-health-psychiatric-nursing', 4),
('sub_community_health', 'cat_nursing_practice', 'Community Health Nursing', 'community-health-nursing', 5),
('sub_critical_care', 'cat_nursing_practice', 'Critical Care / ICU Nursing', 'critical-care-icu-nursing', 6),
('sub_emergency_trauma', 'cat_nursing_practice', 'Emergency & Trauma Nursing', 'emergency-trauma-nursing', 7);

-- Subcategories: Clinical Specialties
INSERT INTO subcategories (id, category_id, name, slug, sort_order) VALUES
('sub_cardiology', 'cat_clinical_specialties', 'Cardiology', 'cardiology', 1),
('sub_oncology', 'cat_clinical_specialties', 'Oncology', 'oncology', 2),
('sub_nephrology', 'cat_clinical_specialties', 'Nephrology', 'nephrology', 3),
('sub_endocrinology', 'cat_clinical_specialties', 'Endocrinology', 'endocrinology', 4),
('sub_infectious_diseases', 'cat_clinical_specialties', 'Infectious Diseases', 'infectious-diseases', 5);

-- Subcategories: Exam Prep (Clinical Exams added)
INSERT INTO subcategories (id, category_id, name, slug, sort_order) VALUES
('sub_nclex', 'cat_exam_prep', 'NCLEX-style Practice', 'nclex-style-practice', 1),
('sub_nigeria_council', 'cat_exam_prep', 'Nigeria Nursing Council Exam Prep', 'nigeria-nursing-council-exam-prep', 2),
('sub_clinical_procedures', 'cat_exam_prep', 'Clinical Procedures & Skills', 'clinical-procedures-skills', 3),
('sub_medical_terminology', 'cat_exam_prep', 'Medical Terminology', 'medical-terminology', 4),
('sub_clinical_exams', 'cat_exam_prep', 'Clinical Exams', 'clinical-exams', 5);

-- Subcategories: Other
INSERT INTO subcategories (id, category_id, name, slug, sort_order) VALUES
('sub_nutrition', 'cat_other', 'Nutrition & Dietetics', 'nutrition-dietetics', 1),
('sub_ethics_law', 'cat_other', 'Health Ethics & Law', 'health-ethics-law', 2),
('sub_first_aid', 'cat_other', 'First Aid & BLS/CPR', 'first-aid-bls-cpr', 3);

-- Feature flags
INSERT INTO feature_flags (key, enabled, label) VALUES
('leaderboard_general', 1, 'Top Quiz Takers'),
('leaderboard_category', 1, 'Category Leaders'),
('leaderboard_per_quiz', 1, 'Quiz Leaderboard'),
('comments', 1, 'Comments'),
('public_quiz_creation', 1, 'User Quiz Publishing'),
('certificates', 1, 'Certificates'),
('homepage_video', 1, 'Latest Video'),
('resources', 1, 'Books & Past Questions'),
('email_welcome', 1, 'Welcome Email'),
('email_leaderboard_recognition', 1, 'Leaderboard Recognition Email'),
('email_newsletter', 1, 'Newsletter Emails'),
('email_quiz_results', 1, 'Quiz Result Emails'),
('email_comment_reply', 1, 'Comment Reply Emails'),
('email_inactivity_nudge', 1, 'Inactivity Nudge Emails'),
('daily_quiz', 1, 'Question of the Day'),
('jobs_page', 1, 'Jobs Page'),
('scholarships_page', 1, 'Scholarships Page'),
('medical_abbreviations', 1, 'Medical Abbreviations'),
('scholar_of_the_day', 1, 'Scholar of the Day'),
('bookmarks', 1, 'Bookmarks'),
('site_search', 1, 'Site Search'),
('feedback_widget', 1, 'Feedback Widget'),
('paid_quizzes', 1, 'Paid Quizzes'),
('banners_header', 1, 'Header Banner'),
('banners_footer', 1, 'Footer Banner');

-- Homepage video block default (admin editable via Admin > Homepage)
INSERT INTO site_settings (key, value) VALUES
('homepage_video', '{"youtubeUrl":"","title":"Our Latest Video","description":""}');

-- Platform commission on paid quizzes, admin-editable via Admin > Payments.
-- Stored as a plain number (percent) rather than JSON since it's a single value.
INSERT INTO site_settings (key, value) VALUES
('platform_fee_percent', '15');

-- Related-quizzes section settings, admin-editable via Admin > Related Content.
-- Controls whether the "related quizzes" widget shows on quiz pages and
-- blog posts, and how many quizzes it displays (rendered as a 2-column grid).
INSERT INTO site_settings (key, value) VALUES
('related_quizzes_quiz_page', '{"enabled":true,"count":6}'),
('related_quizzes_blog_page', '{"enabled":true,"count":6}');

-- Default static pages (admin-editable via Admin > Pages)
INSERT INTO static_pages (id, title, content) VALUES
('about', 'About Cliniolab', 'Cliniolab is a nursing and clinical education platform offering quizzes and timed exams across core sciences, nursing practice, clinical specialties, and board exam preparation.'),
('contact', 'Contact Us', 'Reach out to us at support@cliniolab.com.'),
('faq', 'Frequently Asked Questions', 'Q: Do I need an account to take a quiz?\nA: Yes, login is required to attempt any quiz or exam.'),
('terms', 'Terms of Service', 'By using Cliniolab, you agree to use the platform for educational purposes only.'),
('privacy', 'Privacy Policy', 'We collect only the information necessary to provide the quiz and exam platform.'),
('disclaimer', 'Disclaimer', 'Cliniolab content is for educational purposes and does not substitute professional clinical training or certification.');
