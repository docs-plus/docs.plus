-- Enable required PostgreSQL extensions for the application
-- These extensions provide critical functionality for scheduling and message queuing

-- Enable 'pg_cron' extension for scheduling periodic database tasks
create extension if not exists pg_cron;

-- Enable 'pgmq' extension for reliable message queuing within PostgreSQL
create extension if not exists pgmq;

-- Enable 'pg_net' extension for async HTTP requests from the database
-- Used for calling Edge Functions from triggers (e.g., push notifications)
create extension if not exists pg_net;

-- Additional extensions may be enabled here as needed

-- Note: Verify these extensions are available in your PostgreSQL installation.
-- If you encounter errors, you may need to install them first or request them
-- from your database provider.

-- Check availability of extensions in PostgreSQL.
-- SELECT * FROM pg_available_extensions WHERE name IN ('pg_cron', 'pgmq', 'pg_net');

-- Confirm that extensions are activated.
-- SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pgmq', 'pg_net');
