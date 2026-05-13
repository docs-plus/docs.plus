-- Bootstrap: schemas and extensions required by later scripts.
-- Must sort first so 07-* push/email notification scripts (pgmq + internal.*)
-- and 16-cron-jobs.sql (pg_cron) have their dependencies ready.

create schema if not exists internal;

create extension if not exists pg_cron;
create extension if not exists pgmq;
create extension if not exists pg_net;
