-- -- 1/ message preview and praivcy
-- -- 2/ when user delete, all data that belong to user will be deleted, like message, channel, channel_member, notification, etc
-- -- 3/ channel_invites table

-- -- Table: public.user_roles
-- -- Description: This table defines the roles assigned to each user. Roles are used to manage access and permissions within the application.
-- CREATE TABLE public.user_roles (
--     id        VARCHAR(36) DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
--     user_id   VARCHAR(36) NOT NULL REFERENCES public.users ON DELETE CASCADE,
--     role      app_role NOT NULL,
--     UNIQUE (user_id, role)
-- );

-- COMMENT ON TABLE public.user_roles IS 'Stores the roles assigned to each user, linking to the users table.';

-- -- Table: public.role_permissions
-- -- Description: This table maps each role to its respective permissions, defining what actions each role can perform within the application.
-- CREATE TABLE public.role_permissions (
--     id           VARCHAR(36) DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
--     role         app_role NOT NULL,
--     permission   app_permission NOT NULL,
--     UNIQUE (role, permission)
-- );

-- COMMENT ON TABLE public.role_permissions IS 'Details the specific permissions associated with each role, used for access control.';

-- -- Secure the tables
-- alter table public.users enable row level security;
-- alter table public.channels enable row level security;
-- alter table public.messages enable row level security;
-- alter table public.user_roles enable row level security;
-- alter table public.role_permissions enable row level security;
-- create policy "Allow logged-in read access" on public.users for select using ( auth.role() = 'authenticated' );
-- create policy "Allow individual insert access" on public.users for insert with check ( auth.uid() = id );
-- create policy "Allow individual update access" on public.users for update using ( auth.uid() = id );
-- create policy "Allow logged-in read access" on public.channels for select using ( auth.role() = 'authenticated' );
-- create policy "Allow individual insert access" on public.channels for insert with check ( auth.uid() = created_by );
-- create policy "Allow individual delete access" on public.channels for delete using ( auth.uid() = created_by );
-- create policy "Allow authorized delete access" on public.channels for delete using ( authorize('channels.delete', auth.uid()) );
-- create policy "Allow logged-in read access" on public.messages for select using ( auth.role() = 'authenticated' );
-- create policy "Allow individual insert access" on public.messages for insert with check ( auth.uid() = user_id );
-- create policy "Allow individual update access" on public.messages for update using ( auth.uid() = user_id );
-- create policy "Allow individual delete access" on public.messages for delete using ( auth.uid() = user_id );
-- create policy "Allow authorized delete access" on public.messages for delete using ( authorize('messages.delete', auth.uid()) );
-- create policy "Allow individual read access" on public.user_roles for select using ( auth.uid() = user_id );

-- insert into public.role_permissions (role, permission)
-- values
--     ('admin', 'channels.delete'),
--     ('admin', 'messages.delete'),
--     ('moderator', 'messages.delete');


-- -- Indexes on public.user_roles Table
-- -- Optimizes query performance for user_id.
-- CREATE INDEX idx_user_roles_user_id ON public.user_roles (user_id);


-- -- Indexes on public.role_permissions Table
-- -- Optimizes query performance for role.
-- CREATE INDEX idx_role_permissions_role ON public.role_permissions (role);

-- /*
--   Function: authorize
--   Description: Authorizes user actions based on role-based access control (RBAC).
-- */
-- CREATE OR REPLACE FUNCTION authorize(
--   requested_permission app_permission,
--   user_id VARCHAR(36)
-- )
-- RETURNS BOOLEAN AS $$
-- DECLARE
--   permission_count INT;
-- BEGIN
--   SELECT COUNT(*)
--   INTO permission_count
--   FROM public.role_permissions
--   INNER JOIN public.user_roles ON role_permissions.role = user_roles.role
--   WHERE role_permissions.permission = requested_permission
--     AND user_roles.user_id = user_id;

--   RETURN permission_count > 0;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- /*
--   Realtime Subscriptions Setup
--   Description: Configures the realtime publication for the database.
-- */
-- BEGIN;
--   -- Drop existing publication if exists
--   DROP PUBLICATION IF EXISTS supabase_realtime;
--   -- Create a new publication without enabling it for any tables
--   CREATE PUBLICATION supabase_realtime;
-- COMMIT;

