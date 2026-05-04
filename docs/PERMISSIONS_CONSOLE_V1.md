# Permissions Console v1

This is the first non-coder friendly version of role-based access control.

## Where to open

- Go to `Super Admin`
- Click `Permissions` in the left menu
- Or open: `/super-admin/permissions`

## One-time database setup

Run this SQL migration in Supabase SQL Editor:

- `C:/Users/USER/Desktop/realtimeplanners/supabase/migrations/20260501_permissions_console_v1.sql`

This creates:

- `roles`
- `app_features`
- `role_permissions`

## How to use

1. Pick a module from the dropdown (or keep `All modules`).
2. For each feature and role:
   - Toggle `Allowed` ON/OFF
   - Pick `scope` from dropdown:
     - `none`
     - `own`
     - `org`
     - `all`

## Notes

- This v1 console stores permissions in DB.
- Existing page logic still works while we progressively migrate checks into the new permissions model.
- Next iteration will bind more screens directly to these feature toggles.

