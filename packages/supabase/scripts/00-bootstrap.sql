-- Bootstrap: schemas and extensions required by later scripts.
-- Must sort first so 07-* push/email notification scripts (pgmq + internal.*)
-- and 16-cron-jobs.sql (pg_cron) have their dependencies ready.

create schema if not exists internal;

create extension if not exists pg_cron;
create extension if not exists pgmq;
-- `pg_net` is relocatable and names no schema of its own, unlike pg_cron and
-- pgmq above. The CLI seeds this file with an empty `search_path`, so without
-- an explicit schema Postgres raises `3F000: no schema has been selected to
-- create in` and the whole reset fails. `extensions` holds the other ones.
create extension if not exists pg_net with schema extensions;
