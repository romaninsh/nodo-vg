-- nodo's one change to Odoo's database: tell listeners when a table nodo shows has changed, so
-- open pages update without re-reading on a timer. A statement-level trigger per table runs
-- pg_notify('<table>_changed', ''); the payload is empty, so Postgres folds every write of one
-- transaction into a single notification. Odoo's own writes notify too. No tables are added,
-- and no row data leaves the database this way.
--
-- Safe to run again: it replaces the function and recreates each trigger. To remove it:
--   DROP FUNCTION nodo_notify_change() CASCADE;

CREATE OR REPLACE FUNCTION nodo_notify_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify(TG_TABLE_NAME || '_changed', '');
  RETURN NULL;
END
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'project_task', 'project_task_user_rel', 'project_task_type',
    'project_tags', 'project_tags_project_task_rel', 'res_users', 'res_partner',
    -- CRM
    'crm_lead', 'crm_stage', 'crm_stage_crm_team_rel', 'crm_tag', 'crm_tag_rel',
    'crm_lost_reason', 'crm_team', 'crm_team_member', 'mail_activity',
    -- Project
    'project_project', 'project_task_type_rel', 'project_milestone', 'project_update',
    'project_favorite_user_rel', 'project_project_project_tags_rel',
    'project_allowed_internal_users_rel', 'task_dependencies_rel', 'rating_rating',
    'account_analytic_line', 'mail_followers'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS nodo_notify ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER nodo_notify AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I '
      'FOR EACH STATEMENT EXECUTE FUNCTION nodo_notify_change()', t);
  END LOOP;
END
$$;
