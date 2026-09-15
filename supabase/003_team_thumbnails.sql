-- Atelier 3D : gestion de l'équipe dans l'atelier, archivage et vignettes des versions.
-- Exécuter une seule fois, après 002_self_signup.sql.
begin;

-- Versions : archivage réversible (rien n'est supprimé) et vignette facultative.
alter table public.atelier_versions
 add column archived_at timestamptz,
 add column archived_by uuid references public.atelier_members(user_id),
 add column thumb_path text;

drop policy versions_insert on public.atelier_versions;
create policy versions_insert on public.atelier_versions for insert to authenticated
 with check (public.atelier_is_member() and author_id=auth.uid()
 and object_path=auth.uid()::text || '/' || id::text || '.json'
 and (thumb_path is null or thumb_path=auth.uid()::text || '/' || id::text || '.jpg')
 and archived_at is null and archived_by is null);

-- La vignette déclarée doit exister ; l'archivage ne peut pas être posé à la création.
create or replace function public.atelier_stamp_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from storage.objects where bucket_id='atelier-versions' and name=new.object_path) then
  raise exception 'Le fichier de cette version est absent.';
 end if;
 if new.thumb_path is not null and not exists(select 1 from storage.objects where bucket_id='atelier-versions' and name=new.thumb_path) then
  new.thumb_path=null;
 end if;
 select display_name into strict new.author_name from public.atelier_members where user_id=new.author_id and active;
 new.created_at=now();new.archived_at=null;new.archived_by=null;
 return new;
end;
$$;
revoke all on function public.atelier_stamp_version() from public, anon, authenticated;

update storage.buckets set allowed_mime_types=array['application/json','image/jpeg'] where id='atelier-versions';
drop policy atelier_objects_insert on storage.objects;
create policy atelier_objects_insert on storage.objects for insert to authenticated
 with check (bucket_id='atelier-versions' and public.atelier_is_member()
 and name ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.(json|jpg)$'));

create function public.atelier_archive_version(target_id uuid, archive boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.atelier_is_admin() then raise exception 'Accès administrateur requis.'; end if;
 if archive and exists(select 1 from public.atelier_reference where version_id=target_id) then
  raise exception 'La version de référence ne peut pas être archivée. Choisissez d’abord une autre référence.';
 end if;
 update public.atelier_versions
 set archived_at=case when archive then now() end, archived_by=case when archive then auth.uid() end
 where id=target_id;
 if not found then raise exception 'Version introuvable.'; end if;
end;
$$;
revoke all on function public.atelier_archive_version(uuid,boolean) from public, anon, authenticated;
grant execute on function public.atelier_archive_version(uuid,boolean) to authenticated;

-- Membres : liste avec adresse e-mail et modification du rôle ou de l'accès, réservées aux administrateurs.
create function public.atelier_list_members()
returns table(user_id uuid, display_name text, role text, active boolean, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.atelier_is_admin() then raise exception 'Accès administrateur requis.'; end if;
 return query select m.user_id, m.display_name, m.role, m.active, coalesce(u.email,'')::text
  from public.atelier_members m join auth.users u on u.id=m.user_id
  order by m.active desc, m.role, m.display_name;
end;
$$;
revoke all on function public.atelier_list_members() from public, anon, authenticated;
grant execute on function public.atelier_list_members() to authenticated;

create function public.atelier_update_member(target_id uuid, new_role text, new_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.atelier_is_admin() then raise exception 'Accès administrateur requis.'; end if;
 if new_role not in ('admin','member') then raise exception 'Rôle inconnu.'; end if;
 if target_id=auth.uid() and (new_role<>'admin' or not new_active) then
  raise exception 'Vous ne pouvez pas retirer vos propres droits d’administrateur.';
 end if;
 update public.atelier_members set role=new_role, active=new_active where user_id=target_id;
 if not found then raise exception 'Membre introuvable.'; end if;
 if not exists(select 1 from public.atelier_members where role='admin' and active) then
  raise exception 'L’atelier doit garder au moins un administrateur actif.';
 end if;
end;
$$;
revoke all on function public.atelier_update_member(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.atelier_update_member(uuid,text,boolean) to authenticated;
commit;
