-- Check availability of 'pg_cron' extension in PostgreSQL.
-- SELECT * FROM pg_available_extensions WHERE name = 'pg_cron';

-- Enable 'pg_cron' extension for scheduling tasks within the database.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Confirm that 'pg_cron' extension is activated.
-- SELECT * FROM pg_extension WHERE extname = 'pg_cron';
