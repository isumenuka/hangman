# 🗄️ Supabase Database Setup Guide

Welcome to the database configuration for the **Haunted Hangman**.
This guide will help you set up your database tables, security policies, and automation.

---

## 🚀 Quick Start (Recommended)

If you want to set up everything in one go (or reset your database), use the **Complete Setup** script.

1.  Navigate to your **Supabase Dashboard**.
2.  Go to the **SQL Editor** (Sidebar icon with `>_`).
3.  Copy the content of:
    📂 `supabase/sql/complete_setup.sql`
4.  Paste it into the editor and click **RUN**.

✅ **This will create:**
*   `player_stats` (Stores Username, Email, Wins, Scares)
*   `daily_challenges` (Stores the Daily Word & Hints)
*   `daily_attempts` (Leaderboard for Daily Challenge)
*   `game_history` (Log of all games played)

---

## 📂 File Structure Explained

We have organized the SQL scripts for clarity:

| File | Purpose |
| :--- | :--- |
| **`complete_setup.sql`** | **The Master Script.** Running this builds the entire database schema from scratch. |

---

## 🔧 Troubleshooting

### "Table already exists" Error
If you run the script and get errors about tables existing, you can uncomment the **DROP TABLE** lines at the top of `complete_setup.sql` to force a wipe and rebuild.


### "Permission denied"
Ensure you are running the SQL scripts as the `postgres` or `service_role` user in the Supabase Dashboard.

### Missing Daily Word?
If the Daily Challenge isn't loading:
1.  Check the `daily_challenges` table.
2.  If empty, run the server manually or insert a dummy row using the specific section in `complete_setup.sql`.

---

Happy Haunting! 👻
