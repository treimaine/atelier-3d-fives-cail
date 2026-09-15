-- Test transactionnel de l'inscription libre : aucun compte de test n'est conservé.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('30000000-0000-4000-8000-000000000001','admin@atelier-test.invalid','{}'),
 ('30000000-0000-4000-8000-000000000002','paul@atelier-test.invalid','{"display_name":"Paul"}'),
 ('30000000-0000-4000-8000-000000000003','intrus@atelier-test.invalid','{}');
insert into public.atelier_members(user_id,display_name,role) values
 ('30000000-0000-4000-8000-000000000001','Admin test','admin');
delete from public.atelier_access_requests where user_id='30000000-0000-4000-8000-000000000001';
do $$ begin
 if not exists(select 1 from public.atelier_access_requests where user_id='30000000-0000-4000-8000-000000000002' and display_name='Paul' and status='pending') then raise exception 'Demande non créée à l''inscription'; end if;
 if not exists(select 1 from public.atelier_access_requests where user_id='30000000-0000-4000-8000-000000000003' and display_name='intrus') then raise exception 'Nom de repli absent'; end if;
end $$;
create function pg_temp.denied(q text) returns void language plpgsql as $$
begin
 begin execute q; exception when insufficient_privilege then return; end;
 raise exception 'Une opération interdite a été acceptée : %',q;
end; $$;
set local role anon;
select pg_temp.denied('select * from public.atelier_access_requests');
select pg_temp.denied('select public.atelier_review_request(null,true)');
reset role;

-- Un compte en attente ne voit que sa propre demande, rien du projet, et ne peut pas s'accepter.
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 if public.atelier_is_member() or exists(select 1 from public.atelier_versions) or exists(select 1 from public.atelier_members) then raise exception 'Un compte en attente lit le projet'; end if;
 if (select count(*) from public.atelier_access_requests)<>1 then raise exception 'Un compte en attente voit les autres demandes'; end if;
 if public.atelier_request_access()<>'pending' then raise exception 'Statut de demande inattendu'; end if;
 begin perform public.atelier_review_request('30000000-0000-4000-8000-000000000002',true);
 exception when raise_exception then if sqlerrm='Accès administrateur requis.' then return; else raise; end if; end;
 raise exception 'Un compte en attente peut s''accepter';
end $$;
select pg_temp.denied($q$insert into public.atelier_members(user_id,display_name) values('30000000-0000-4000-8000-000000000002','Paul')$q$);
select pg_temp.denied($q$update public.atelier_access_requests set status='pending'$q$);
reset role;

-- L'administrateur voit les demandes, accepte Paul et refuse l'intrus.
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.atelier_access_requests where status='pending')<>2 then raise exception 'L''administrateur ne voit pas les demandes'; end if;
 perform public.atelier_review_request('30000000-0000-4000-8000-000000000002',true);
 perform public.atelier_review_request('30000000-0000-4000-8000-000000000003',false);
 if not exists(select 1 from public.atelier_members where user_id='30000000-0000-4000-8000-000000000002' and role='member' and active) then raise exception 'Membre non créé'; end if;
 begin perform public.atelier_review_request('30000000-0000-4000-8000-000000000003',true);
 exception when raise_exception then if sqlerrm like 'Cette demande a déjà été traitée%' then return; else raise; end if; end;
 raise exception 'Une demande refusée a été acceptée';
end $$;
reset role;

select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 if not public.atelier_is_member() then raise exception 'Le membre accepté n''a pas accès'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
 if public.atelier_is_member() or public.atelier_request_access()<>'rejected' then raise exception 'Le refus n''est pas conservé'; end if;
end $$;
reset role;
rollback;
select 'PASS : inscription, attente, isolement, validation, refus' as tests;
