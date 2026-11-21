// Written by scripts/about.py; never edit by hand. Run it again after a PR lands.

export const ABOUT = {
  "measuredOn": "2026-11-21",
  "vantageVersion": "1.14.9",
  "code": {
    "backend_lines": 1129,
    "tables": 12,
    "pages": 3,
    "actions": 18,
    "frontend_lines": 1276,
    "frontend_files": 13,
    "generated_lines": 884,
    "scenario_steps": 9
  },
  "odooTables": [
    "mail_followers",
    "mail_followers_mail_message_subtype_rel",
    "project_tags",
    "project_tags_project_task_rel",
    "project_task",
    "project_task_type",
    "project_task_user_rel",
    "res_partner",
    "res_users"
  ],
  "pullRequests": 4,
  "vantage": {
    "features": [
      "Sign-ins kept in the server's memory, so nothing is added to Odoo's database",
      "Odoo's password hashes (passlib pbkdf2-sha512) checked and written"
    ],
    "issues": 5
  }
} as const;
