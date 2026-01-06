-- =============================================
-- STEP 1: Aggiungere user_id alle tabelle
-- =============================================

-- Aggiungi user_id a cantieri
ALTER TABLE public.cantieri 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Aggiungi user_id a rifornimenti
ALTER TABLE public.rifornimenti 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- =============================================
-- STEP 2: Rimuovere le vecchie RLS policy
-- =============================================

-- Cantieri
DROP POLICY IF EXISTS "Cantieri are readable by authenticated users" ON public.cantieri;
DROP POLICY IF EXISTS "Cantieri can be inserted by authenticated users" ON public.cantieri;
DROP POLICY IF EXISTS "Cantieri can be updated by authenticated users" ON public.cantieri;
DROP POLICY IF EXISTS "Cantieri can be deleted by authenticated users" ON public.cantieri;

-- Rifornimenti
DROP POLICY IF EXISTS "Rifornimenti are readable by authenticated users" ON public.rifornimenti;
DROP POLICY IF EXISTS "Rifornimenti can be inserted by authenticated users" ON public.rifornimenti;
DROP POLICY IF EXISTS "Rifornimenti can be updated by authenticated users" ON public.rifornimenti;
DROP POLICY IF EXISTS "Rifornimenti can be deleted by authenticated users" ON public.rifornimenti;

-- =============================================
-- STEP 3: Creare nuove RLS policy per user_id
-- =============================================

-- Cantieri - ogni utente vede solo i propri
CREATE POLICY "Users can view their own cantieri" 
  ON public.cantieri FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cantieri" 
  ON public.cantieri FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cantieri" 
  ON public.cantieri FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cantieri" 
  ON public.cantieri FOR DELETE TO authenticated 
  USING (auth.uid() = user_id);

-- Rifornimenti - ogni utente vede solo i propri
CREATE POLICY "Users can view their own rifornimenti" 
  ON public.rifornimenti FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rifornimenti" 
  ON public.rifornimenti FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rifornimenti" 
  ON public.rifornimenti FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rifornimenti" 
  ON public.rifornimenti FOR DELETE TO authenticated 
  USING (auth.uid() = user_id);