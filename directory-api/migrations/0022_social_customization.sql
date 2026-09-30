-- 2.23.0: profile banners, customizable spaces and flexible social posts.
ALTER TABLE profiles ADD COLUMN banner TEXT NOT NULL DEFAULT '';

ALTER TABLE social_posts ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]';
ALTER TABLE social_posts ADD COLUMN shift_note TEXT;

ALTER TABLE social_groups ADD COLUMN icon TEXT NOT NULL DEFAULT '';
ALTER TABLE social_groups ADD COLUMN accent TEXT NOT NULL DEFAULT '#2563eb';
ALTER TABLE social_groups ADD COLUMN cover TEXT NOT NULL DEFAULT '';
ALTER TABLE social_groups ADD COLUMN rules TEXT NOT NULL DEFAULT '';

ALTER TABLE company_channels ADD COLUMN icon TEXT NOT NULL DEFAULT '';
ALTER TABLE company_channels ADD COLUMN accent TEXT NOT NULL DEFAULT '#2563eb';
ALTER TABLE company_channels ADD COLUMN cover TEXT NOT NULL DEFAULT '';
ALTER TABLE company_channels ADD COLUMN topic TEXT NOT NULL DEFAULT '';
