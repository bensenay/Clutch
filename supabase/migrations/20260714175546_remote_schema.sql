drop extension if exists "pg_net";


  create policy "Directors update their own school"
  on "public"."schools"
  as permissive
  for update
  to public
using (((public.get_my_role() = 'director'::public.user_role) AND (id = public.get_my_school_id())));


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


