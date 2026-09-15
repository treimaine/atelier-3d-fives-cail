-- Atelier 3D : exécuter une seule fois dans le SQL Editor du projet Supabase.
begin;
create table public.atelier_members (
 user_id uuid primary key references auth.users(id),
 display_name text not null check (length(trim(display_name)) between 1 and 100),
 role text not null default 'member' check (role in ('admin','member')),
 active boolean not null default true
);
alter table public.atelier_members enable row level security;

create function public.atelier_is_member() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.atelier_members where user_id=auth.uid() and active);
$$;
create function public.atelier_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.atelier_members where user_id=auth.uid() and active and role='admin');
$$;
revoke all on function public.atelier_is_member(), public.atelier_is_admin() from public, anon, authenticated;
grant execute on function public.atelier_is_member(), public.atelier_is_admin() to authenticated;
create policy members_read on public.atelier_members for select to authenticated
 using (public.atelier_is_member());
revoke all on public.atelier_members from anon, authenticated;
grant select on public.atelier_members to authenticated;

create table public.atelier_versions (
 id uuid primary key,
 title text not null check (length(trim(title)) between 1 and 100),
 comment text not null default '' check (length(comment)<=2000),
 author_id uuid not null references public.atelier_members(user_id),
 author_name text not null default '',
 created_at timestamptz not null default now(),
 object_path text not null unique,
 byte_size bigint not null check (byte_size between 1 and 51380224),
 parent_id uuid references public.atelier_versions(id)
);
create index atelier_versions_created on public.atelier_versions(created_at desc, id);
alter table public.atelier_versions enable row level security;
create policy versions_read on public.atelier_versions for select to authenticated
 using (public.atelier_is_member());
create policy versions_insert on public.atelier_versions for insert to authenticated
 with check (public.atelier_is_member() and author_id=auth.uid()
 and object_path=auth.uid()::text || '/' || id::text || '.json');
revoke all on public.atelier_versions from anon, authenticated;
grant select, insert on public.atelier_versions to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('atelier-versions','atelier-versions',false,51380224,array['application/json']);
create policy atelier_objects_read on storage.objects for select to authenticated
 using (bucket_id='atelier-versions' and public.atelier_is_member());
create policy atelier_objects_insert on storage.objects for insert to authenticated
 with check (bucket_id='atelier-versions' and public.atelier_is_member()
 and name ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.json$'));
-- Aucune modification ni suppression via le navigateur : versions immuables.
create function public.atelier_stamp_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from storage.objects where bucket_id='atelier-versions' and name=new.object_path) then
  raise exception 'Le fichier de cette version est absent.';
 end if;
 select display_name into strict new.author_name from public.atelier_members where user_id=new.author_id and active;
 new.created_at=now();
 return new;
end;
$$;
revoke all on function public.atelier_stamp_version() from public, anon, authenticated;
create trigger atelier_version_stamp before insert on public.atelier_versions
 for each row execute function public.atelier_stamp_version();

create table public.atelier_reference (
 id integer primary key check(id=1),
 version_id uuid references public.atelier_versions(id),
 revision integer not null default 0,
 changed_by uuid references public.atelier_members(user_id),
 changed_at timestamptz not null default now()
);
insert into public.atelier_reference(id) values(1);
alter table public.atelier_reference enable row level security;
create policy reference_read on public.atelier_reference for select to authenticated
 using(public.atelier_is_member());
revoke all on public.atelier_reference from anon, authenticated;
grant select on public.atelier_reference to authenticated;
create function public.atelier_set_reference(target_id uuid, expected_revision integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.atelier_is_admin() then raise exception 'Accès administrateur requis.'; end if;
 update public.atelier_reference set version_id=target_id,revision=revision+1,changed_by=auth.uid(),changed_at=now()
 where id=1 and revision=expected_revision;
 if not found then raise exception 'La référence a changé. Actualisez avant de recommencer.'; end if;
end;
$$;
revoke all on function public.atelier_set_reference(uuid,integer) from public, anon, authenticated;
grant execute on function public.atelier_set_reference(uuid,integer) to authenticated;
commit;
