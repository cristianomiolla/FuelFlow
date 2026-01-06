-- Fix Issue 1: Nullable user_id columns - RLS bypass vulnerability
DELETE FROM public.cantieri WHERE user_id IS NULL;
DELETE FROM public.rifornimenti WHERE user_id IS NULL;

ALTER TABLE public.cantieri ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.rifornimenti ALTER COLUMN user_id SET NOT NULL;

-- Fix Issue 2: Public storage bucket - make private with user-scoped policies
UPDATE storage.buckets SET public = false WHERE id = 'receipts';

-- Drop permissive policies
DROP POLICY IF EXISTS "Receipts are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload receipts" ON storage.objects;

-- Create user-scoped storage policies (files stored as: {user_id}/filename)
CREATE POLICY "Users can view own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload own receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);