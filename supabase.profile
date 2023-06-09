-- Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  avatar_url text,
  website text,
  twitter text,
  facebook text,
  about text,
  company text,
  job_title text,
  push_notifications boolean default false,
  email_notifications boolean default false,
  email_notification_new_activity boolean default false,
  constraint username_length check (char_length(username) >= 3)
);
-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security for more details.
alter table profiles
  enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- This trigger automatically creates a profile entry when a new user signs up via Supabase Auth.
-- See https://supabase.com/docs/guides/auth/managing-user-data#using-triggers for more details.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email, new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ====================
-- Set up Storage
-- ====================
-- See https://supabase.com/docs/guides/storage for more details.


-- Set up the 'avatars' bucket in Storage.
insert into storage.buckets (id, name)
  values ('avatars', 'avatars');

-- Set up access controls for storage.

-- Policy 1: Allow public access to avatar images.
-- This policy allows anyone to view avatars in the 'avatars' bucket.
create policy "Avatar images are publicly accessible." on storage.objects
  for select using (bucket_id = 'avatars');

-- Policy 2: Allow users to insert their own image avatars into the 'public' folder of the 'avatars' bucket.
-- This policy allows a user to upload their own avatar if the file is an image of specific types (jpg, jpeg, png, gif, bmp, webp, or svg),
-- and is being uploaded to the 'public' folder of the 'avatars' bucket.
create policy "User can insert own image avatar." on storage.objects
  for insert with check (
    auth.uid() = owner
    and bucket_id = 'avatars'
    and LOWER((storage.foldername(name))[1]) = 'public'
    and (
      storage."extension"(name) = 'jpg'
      or storage."extension"(name) = 'jpeg'
      or storage."extension"(name) = 'png'
      or storage."extension"(name) = 'gif'
      or storage."extension"(name) = 'bmp'
      or storage."extension"(name) = 'webp'
      or storage."extension"(name) = 'svg'
    )
);

-- Policy 3: Allow users to update their own avatars.
-- This policy allows a user to update their own avatar in the 'avatars' bucket.
create policy "User can update own avatar." on storage.objects
  for update using (auth.uid() = owner and bucket_id = 'avatars');

-- Policy 4: Allow users to delete their own avatars.
-- This policy allows a user to delete their own avatar from the 'avatars' bucket.
create policy "User can delete own avatar." on storage.objects
  for delete using (auth.uid() = owner and bucket_id = 'avatars');
