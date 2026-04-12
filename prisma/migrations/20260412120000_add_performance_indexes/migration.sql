-- Performance indexes for frequently queried columns

-- Comments: filtered by newsId, authorId, parentId
CREATE INDEX IF NOT EXISTS "comments_news_id_idx" ON "comments"("news_id");
CREATE INDEX IF NOT EXISTS "comments_author_id_idx" ON "comments"("author_id");
CREATE INDEX IF NOT EXISTS "comments_parent_id_idx" ON "comments"("parent_id");

-- News: filtered by isPublished + publishedDate (main listing query), category
CREATE INDEX IF NOT EXISTS "news_is_published_published_date_idx" ON "news"("is_published", "published_date");
CREATE INDEX IF NOT EXISTS "news_category_idx" ON "news"("category");

-- ForumPost: filtered by topicId
CREATE INDEX IF NOT EXISTS "forum_posts_topic_id_idx" ON "forum_posts"("topic_id");
