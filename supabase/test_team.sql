-- Test transactionnel de 003 : aucun compte ni fichier de test n'est conservé.
begin;
insert into auth.users(id,email) values
 ('40000000-0000-4000-8000-000000000001','admin@atelier-test.invalid'),
 ('40000000-0000-4000-8000-000000000002','paul@atelier-test.invalid');
insert into public.atelier_members(user_id,display_name,role) values
 ('40000000-0000-4000-8000-000000000001','Admin test','admin'),
 ('40000000-0000-4000-8000-000000000002','Paul test','member');
create function pg_temp.expect_error(q text, fragment text) returns void language plpgsql as $$
begin
 begin execute q; exception when others then if position(fragment in sqlerrm)>0 or sqlstate='42501' then return; else raise; end if; end;
 raise exception 'Opération acceptée à tort : %',q;
end; $$;

-- Un associé : envoie une vignette, ne peut ni archiver, ni lister les e-mails, ni se promouvoir.
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000002',true);
set local role authenticated;
insert into storage.objects(bucket_id,name) values
 ('atelier-versions','40000000-0000-4000-8000-000000000002/50000000-0000-4000-8000-000000000001.json'),
 ('atelier-versions','40000000-0000-4000-8000-000000000002/50000000-0000-4000-8000-000000000001.jpg');
insert into public.atelier_versions(id,title,author_id,object_path,byte_size,thumb_path) values
 ('50000000-0000-4000-8000-000000000001','Avec vignette','40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002/50000000-0000-4000-8000-000000000001.json',10,'40000000-0000-4000-8000-000000000002/50000000-0000-4000-8000-000000000001.jpg');
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name) values('atelier-versions','40000000-0000-4000-8000-000000000002/x.png')$q$,'row-level security');
select pg_temp.expect_error($q$insert into public.atelier_versions(id,title,author_id,object_path,byte_size,archived_at) values('50000000-0000-4000-8000-000000000002','Archivée d''office','40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002/50000000-0000-4000-8000-000000000002.json',10,now())$q$,'row-level security');
select pg_temp.expect_error($q$select public.atelier_archive_version('50000000-0000-4000-8000-000000000001',true)$q$,'Accès administrateur requis');
select pg_temp.expect_error($q$select * from public.atelier_list_members()$q$,'Accès administrateur requis');
select pg_temp.expect_error($q$select public.atelier_update_member('40000000-0000-4000-8000-000000000002','admin',true)$q$,'Accès administrateur requis');
reset role;

-- L'administrateur : archive puis restaure, ne peut pas archiver la référence, gère les membres.
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare rev integer; begin
 perform public.atelier_archive_version('50000000-0000-4000-8000-000000000001',true);
 if not exists(select 1 from public.atelier_versions where id='50000000-0000-4000-8000-000000000001' and archived_at is not null) then raise exception 'Archivage absent'; end if;
 perform public.atelier_archive_version('50000000-0000-4000-8000-000000000001',false);
 select revision into rev from public.atelier_reference where id=1;
 perform public.atelier_set_reference('50000000-0000-4000-8000-000000000001',rev);
 begin perform public.atelier_archive_version('50000000-0000-4000-8000-000000000001',true);
  raise exception 'La référence a été archivée';
 exception when raise_exception then if sqlerrm not like 'La version de référence%' then raise; end if; end;
 if (select count(*) from public.atelier_list_members() where email like '%atelier-test.invalid')<>2 then raise exception 'Liste des membres incomplète'; end if;
 perform public.atelier_update_member('40000000-0000-4000-8000-000000000002','admin',true);
 perform public.atelier_update_member('40000000-0000-4000-8000-000000000002','member',false);
 if exists(select 1 from public.atelier_members where user_id='40000000-0000-4000-8000-000000000002' and active) then raise exception 'Accès non retiré'; end if;
 begin perform public.atelier_update_member('40000000-0000-4000-8000-000000000001','member',true);
  raise exception 'Un administrateur a pu se rétrograder';
 exception when raise_exception then if sqlerrm not like 'Vous ne pouvez pas%' then raise; end if; end;
end $$;
reset role;
rollback;
select 'PASS : vignettes, archivage, liste et gestion des membres' as tests;
