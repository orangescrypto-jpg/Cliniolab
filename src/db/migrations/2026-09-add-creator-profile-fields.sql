-- Adds the two fields needed for a creator's public profile page
-- (/creator/[userId]): a short bio and an avatar image path. Both
-- nullable/optional - a creator with neither set still gets a working
-- profile page (falls back to initials avatar, no bio section).
--
-- avatar_path follows the same shape as other stored images in this
-- app: /api/images/avatars/<uuid>.<ext>, served via the existing
-- /api/images/[...key] route. Deliberately NOT run through the
-- watermark step that blog/resources/banners/scholars images get -
-- watermarking a user's own profile photo with the Cliniolab logo
-- would be wrong - see the 'avatars' keyPrefix branch in r2Client.ts.
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN avatar_path TEXT;
