ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_users (user_id)
SELECT id FROM public.users WHERE email = '<marzban98@gmail.com>';

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
