-- Enable required PostgreSQL extensions for the application
-- These extensions provide critical functionality for scheduling and message queuing

-- Enable 'pg_cron' extension for scheduling periodic database tasks
create extension if not exists pg_cron;

-- Enable 'pgmq' extension for reliable message queuing within PostgreSQL
create extension if not exists pgmq;

-- Additional extensions may be enabled here as needed

-- Note: Verify these extensions are available in your PostgreSQL installation.
-- If you encounter errors, you may need to install them first or request them
-- from your database provider.

-- Check availability of 'pg_cron' extension in PostgreSQL.
-- SELECT * FROM pg_available_extensions WHERE name = 'pg_cron';

-- Confirm that 'pg_cron' extension is activated.
-- SELECT * FROM pg_extension WHERE extname = 'pg_cron';
