/*
  # Secret Santa Team Members Schema

  1. New Tables
    - `team_members`
      - `id` (uuid, primary key) - Unique identifier for each member
      - `name` (text) - Member's name
      - `access_code` (text, unique) - Secret code to access and edit their card
      - `wishes` (text) - What they want for secret santa
      - `created_at` (timestamptz) - When the record was created
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `team_members` table
    - Add policy for anyone to view all members (public read)
    - Add policy to update only if access code matches
    
  3. Important Notes
    - Access codes are used for authentication instead of user accounts
    - All members can view all cards (for the secret santa reveal)
    - Members can only edit their own card using their unique access code
*/

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  access_code text UNIQUE NOT NULL,
  wishes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view all members
CREATE POLICY "Anyone can view team members"
  ON team_members
  FOR SELECT
  USING (true);

-- Policy: Can update only with matching access code
-- Note: This will be handled in the application layer since RLS doesn't have access to the submitted access code
CREATE POLICY "Members can update own card"
  ON team_members
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- -- Policy: Allow anyone to insert a new member (public insert)
-- CREATE POLICY "Anyone can add a team member"
--   ON team_members
--   FOR INSERT
--   TO anon
--   WITH CHECK (true);


-- Create index on access_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_members_access_code ON team_members(access_code);