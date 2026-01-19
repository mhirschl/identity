# Supabase Setup Guide for Identity v2

To enable cross-device synchronization, follow these steps to set up your Supabase project.

## 1. Create a Project
- Go to [Supabase.com](https://supabase.com/).
- Create a new project named **Identity**.

## 2. Initialize Database
Go to the **SQL Editor** in your Supabase dashboard and run the following command:

```sql
-- Create the habits table
create table habits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  identity text not null,
  anchor text not null,
  history jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security (RLS)
alter table habits enable row level security;

-- Create a policy so users can only see their own habits
create policy "Users can manage their own habits" 
on habits for all 
using (auth.uid() = user_id);
```

## 3. Get Your API Keys
- Go to **Project Settings** > **API**.
- Copy the `Project URL` and `anon public` key.
- Open your Identity v2 app, tap the **Cloud** icon in the top right, and paste them in.

## 4. Enable Google Login (Optional but Recommended)
- Go to **Authentication** > **Providers**.
- Enable **Google**.
- You'll need to follow the Supabase guide to provide your Google Client ID and Secret from the [Google Console](https://console.cloud.google.com/).
