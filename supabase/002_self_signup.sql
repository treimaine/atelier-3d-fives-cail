-- Atelier 3D : inscription libre et validation par l'administrateur.
-- Exécuter une seule fois, après 001_shared_projects.sql.
-- Un compte créé n'a accès à rien tant qu'un administrateur n'a pas accepté sa demande.
begin;
create table public.atelier_access_requests (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null default '',
 display_name text not null check (length(trim(display_name)) between 1 and 100),
 status text not null default 'pending' check (status in ('pending','rejected')),
 created_at timestamptz not null default now(),
 reviewed_by uuid references public.atelier_members(user_id),
 reviewed_at timestamptz
);
create index atelier_access_requests_pending on public.atelier_access_requests(created_at) where status='pending';
alter table public.atelier_access_requests enable row level security;
create policy requests_read on public.atelier_access_requests for select to authenticated
 using (user_id=auth.uid() or public.atelier_is_admin());
revoke all on public.atelier_access_requests from anon, authenticated;
grant select on public.atelier_access_requests to authenticated;

-- Nom affiché : saisi à l'inscription, sinon début de l'adresse e-mail.
create function public.atelier_request_name(meta jsonb, email text) returns text
language sql immutable set search_path = '' as $$
 select coalesce(nullif(left(trim(meta->>'display_name'),100),''), nullif(left(split_part(coalesce(email,''),'@',1),100),''), 'Associé');
$$;
revoke all on function public.atelier_request_name(jsonb,text) from public, anon, authenticated;

create function public.atelier_on_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.atelier_access_requests(user_id,email,display_name)
 values (new.id, coalesce(new.email,''), public.atelier_request_name(new.raw_user_meta_data, new.email))
 on conflict (user_id) do nothing;
 return new;
end;
$$;
revoke all on function public.atelier_on_signup() from public, anon, authenticated;
create trigger atelier_signup_request after insert on auth.users
 for each row execute function public.atelier_on_signup();

-- Nouvelle demande pour un compte sans accès (ex. accès retiré). Une demande refusée n'est pas relancée.
create function public.atelier_request_access() returns text
language plpgsql security definer set search_path = '' as $$
declare u record;
begin
 if auth.uid() is null then raise exception 'Connexion requise.'; end if;
 if public.atelier_is_member() then return 'member'; end if;
 select id,email,raw_user_meta_data into strict u from auth.users where id=auth.uid();
 insert into public.atelier_access_requests(user_id,email,display_name)
 values (u.id, coalesce(u.email,''), public.atelier_request_name(u.raw_user_meta_data, u.email))
 on conflict (user_id) do nothing;
 return (select status from public.atelier_access_requests where user_id=auth.uid());
end;
$$;
revoke all on function public.atelier_request_access() from public, anon, authenticated;
grant execute on function public.atelier_request_access() to authenticated;

create function public.atelier_review_request(target_id uuid, approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare request record;
begin
 if not public.atelier_is_admin() then raise exception 'Accès administrateur requis.'; end if;
 select * into request from public.atelier_access_requests where user_id=target_id and status='pending' for update;
 if not found then raise exception 'Cette demande a déjà été traitée. Actualisez la liste.'; end if;
 if approve then
  insert into public.atelier_members(user_id,display_name,role,active)
  values (target_id, request.display_name, 'member', true)
  on conflict (user_id) do update set display_name=excluded.display_name, role='member', active=true;
  delete from public.atelier_access_requests where user_id=target_id;
 else
  update public.atelier_access_requests set status='rejected', reviewed_by=auth.uid(), reviewed_at=now()
  where user_id=target_id;
 end if;
end;
$$;
revoke all on function public.atelier_review_request(uuid,boolean) from public, anon, authenticated;
grant execute on function public.atelier_review_request(uuid,boolean) to authenticated;
commit;
