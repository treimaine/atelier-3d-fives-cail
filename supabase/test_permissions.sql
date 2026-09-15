-- Test transactionnel : aucun compte ni fichier de test n'est conservé.
begin;
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','admin@atelier-test.invalid'),
 ('10000000-0000-4000-8000-000000000002','member@atelier-test.invalid'),
 ('10000000-0000-4000-8000-000000000003','outsider@atelier-test.invalid');
insert into public.atelier_members(user_id,display_name,role) values
 ('10000000-0000-4000-8000-000000000001','Admin test','admin'),
 ('10000000-0000-4000-8000-000000000002','Membre test','member');
create function pg_temp.denied(q text) returns void language plpgsql as $$
begin
 begin execute q; exception when insufficient_privilege then return; end;
 raise exception 'Une opération interdite a été acceptée : %',q;
end; $$;
set local role anon;
select pg_temp.denied('select * from public.atelier_versions');
select pg_temp.denied('select * from public.atelier_members');
select pg_temp.denied('select public.atelier_set_reference(null,0)');
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
 if public.atelier_is_member() or exists(select 1 from public.atelier_reference) then raise exception 'Un non-membre peut lire le projet'; end if;
end $$;
select pg_temp.denied($q$insert into storage.objects(bucket_id,name) values('atelier-versions','10000000-0000-4000-8000-000000000003/20000000-0000-4000-8000-000000000001.json')$q$);
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
set local role authenticated;
insert into storage.objects(bucket_id,name) values('atelier-versions','10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000001.json');
insert into public.atelier_versions(id,title,author_id,author_name,created_at,object_path,byte_size) values
 ('20000000-0000-4000-8000-000000000001','Version test','10000000-0000-4000-8000-000000000002','Faux auteur','2000-01-01','10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000001.json',10);
do $$ begin
 if not exists(select 1 from public.atelier_versions where id='20000000-0000-4000-8000-000000000001' and author_name='Membre test' and created_at>now()-interval '1 minute') then raise exception 'Auteur/date non fiables'; end if;
end $$;
select pg_temp.denied($q$update public.atelier_versions set title='Ecrasé'$q$);
select pg_temp.denied('delete from public.atelier_versions');
select pg_temp.denied($q$update public.atelier_members set role='admin'$q$);
select pg_temp.denied($q$insert into storage.objects(bucket_id,name) values('atelier-versions','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002.json')$q$);
do $$ declare n integer; begin
 update storage.objects set name='changed.json' where bucket_id='atelier-versions';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Fichiers modifiables'; end if;
 begin perform public.atelier_set_reference('20000000-0000-4000-8000-000000000001',0);
 exception when raise_exception then if sqlerrm='Accès administrateur requis.' then return; else raise; end if; end;
 raise exception 'Un membre peut changer la référence';
end $$;
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare rev integer; begin
 select revision into rev from public.atelier_reference where id=1;
 perform public.atelier_set_reference('20000000-0000-4000-8000-000000000001',rev);
 begin perform public.atelier_set_reference('20000000-0000-4000-8000-000000000001',rev);
 exception when raise_exception then if sqlerrm='La référence a changé. Actualisez avant de recommencer.' then return; else raise; end if; end;
 raise exception 'Conflit de référence ignoré';
end $$;
reset role;
update public.atelier_members set active=false where user_id='10000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.atelier_versions) or exists(select 1 from storage.objects where bucket_id='atelier-versions') then raise exception 'Un membre révoqué peut lire les données'; end if;
end $$;
reset role;
rollback;
select 'PASS : anonyme, non-membre, membre, admin, révocation, auteur, immutabilité et concurrence' as tests;
