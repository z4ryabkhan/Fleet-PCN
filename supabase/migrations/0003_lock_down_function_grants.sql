-- Postgres grants EXECUTE to PUBLIC by default on function creation, which
-- silently gave the anon role RPC access to every function in 0002. None of
-- these are meant to be called anonymously, and handle_new_user is only
-- ever meant to run as the on_auth_user_created trigger, not via RPC at all.

revoke execute on function is_org_member(uuid) from public;
grant execute on function is_org_member(uuid) to authenticated;

revoke execute on function is_org_admin(uuid) from public;
grant execute on function is_org_admin(uuid) to authenticated;

revoke execute on function create_organisation(text) from public;
grant execute on function create_organisation(text) to authenticated;

revoke execute on function handle_new_user() from public;
revoke execute on function handle_new_user() from authenticated;
