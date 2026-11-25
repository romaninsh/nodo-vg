-- Temporary: an id column on Odoo's tag link table, so Vantage can insert and delete tag links.
-- Vantage's write guard stamps its own id on rows of a table whose id the database computes
-- from the pair, and the insert is then refused (vantage-ui spec
-- agents/specs/2026-11-25-nodo-direct-writes-feedback-design.md, F-1). Until that's fixed, the
-- link rows get a plain serial id. Odoo's own writes name only the two columns, so the default
-- fills `v_id` and Odoo is unaffected.
--
-- Safe to run again. To remove it once F-1 is fixed:
--   ALTER TABLE project_tags_project_task_rel DROP COLUMN v_id;

ALTER TABLE project_tags_project_task_rel ADD COLUMN IF NOT EXISTS v_id bigserial;
CREATE UNIQUE INDEX IF NOT EXISTS project_tags_project_task_rel_v_id
  ON project_tags_project_task_rel (v_id);
