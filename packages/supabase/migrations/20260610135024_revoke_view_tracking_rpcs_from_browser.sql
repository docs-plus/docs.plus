-- Pair of scripts/09-document-views.sql + 29-lint-hardening.sql §7: document
-- views are recorded server-side by Hocuspocus with the service_role key.
-- Revoke the browser roles so a page/bot can't call these RPCs directly and
-- inflate view counts. Idempotent — a no-op where the grant was never present.

revoke execute on function public.enqueue_document_view(text, text, uuid, boolean, text)
    from anon, authenticated;
revoke execute on function public.update_view_duration(uuid, integer)
    from anon, authenticated;
