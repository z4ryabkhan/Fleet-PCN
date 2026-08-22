-- 0003 revoked from PUBLIC, but Supabase's default privileges on the public
-- schema grant EXECUTE directly to anon/authenticated/service_role on every
-- new function, independent of the PUBLIC pseudo-role. Confirmed via
-- pg_proc.proacl that anon still had explicit EXECUTE after 0003. Revoke it
-- directly.

revoke execute on function is_org_member(uuid) from anon;
revoke execute on function is_org_admin(uuid) from anon;
revoke execute on function create_organisation(text) from anon;
revoke execute on function handle_new_user() from anon;
revoke execute on function handle_new_user() from authenticated;
