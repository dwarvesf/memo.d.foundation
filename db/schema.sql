


CREATE TABLE vault(file_path VARCHAR, md_content VARCHAR, tags VARCHAR[], title VARCHAR, date DATE, description VARCHAR, authors VARCHAR[], estimated_tokens BIGINT, embeddings_openai FLOAT[1536], total_tokens BIGINT, hide_frontmatter BOOLEAN, hide_title BOOLEAN, pinned VARCHAR, featured BOOLEAN, icy BIGINT, discord_id VARCHAR, status VARCHAR, hiring BOOLEAN, PICs VARCHAR, bounty VARCHAR, "function" VARCHAR, social VARCHAR, github VARCHAR, website VARCHAR, avatar VARCHAR, aliases VARCHAR[], spr_content VARCHAR, embeddings_spr_custom FLOAT[1024], draft BOOLEAN, short_title VARCHAR);



CREATE OR REPLACE TEMP MACRO markdown_link(title, file_path) AS '[' || COALESCE(title, '/' || REGEXP_REPLACE(LOWER(REGEXP_REPLACE(REPLACE(REPLACE(file_path, '.md', ''), ' ', '-'),'[^a-zA-Z0-9/_-]+', '-')), '(-/|-$|_index$)', '')) || '](/' || REGEXP_REPLACE(LOWER(REGEXP_REPLACE(REPLACE(REPLACE(file_path, '.md', ''), ' ', '-'),'[^a-zA-Z0-9/_-]+', '-')), '(-/|-$|_index$)', '') || ')';

