-- One row per ticked Done when test. A row existing means ticked, so
-- unticking deletes it. The slugs are the permanent IDs from CONTENT in
-- public/index.html. ticked_at is Unix time in seconds.
CREATE TABLE ticks (
  level_slug TEXT NOT NULL,
  test_slug TEXT NOT NULL,
  ticked_at INTEGER NOT NULL,
  PRIMARY KEY (level_slug, test_slug)
);
