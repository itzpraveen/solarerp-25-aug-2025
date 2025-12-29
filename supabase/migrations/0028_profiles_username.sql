-- Add username to profiles for username/password auth
alter table public.profiles
  add column if not exists username text;

update public.profiles p
set username = lower(split_part(u.email, '@', 1))
from auth.users u
where p.user_id = u.id
  and p.username is null
  and u.email is not null;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;
