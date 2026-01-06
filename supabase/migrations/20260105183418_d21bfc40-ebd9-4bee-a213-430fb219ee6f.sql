-- Drop existing public policies
DROP POLICY IF EXISTS "Config is readable by everyone" ON public.config;
DROP POLICY IF EXISTS "Cantieri are readable by everyone" ON public.cantieri;
DROP POLICY IF EXISTS "Rifornimenti are readable by everyone" ON public.rifornimenti;
DROP POLICY IF EXISTS "Rifornimenti can be inserted by everyone" ON public.rifornimenti;
DROP POLICY IF EXISTS "Rifornimenti can be updated by everyone" ON public.rifornimenti;
DROP POLICY IF EXISTS "Rifornimenti can be deleted by everyone" ON public.rifornimenti;

-- Config table: only authenticated users can read
CREATE POLICY "Config is readable by authenticated users" 
ON public.config 
FOR SELECT 
TO authenticated
USING (true);

-- Cantieri table: only authenticated users can read
CREATE POLICY "Cantieri are readable by authenticated users" 
ON public.cantieri 
FOR SELECT 
TO authenticated
USING (true);

-- Rifornimenti table: only authenticated users can perform CRUD
CREATE POLICY "Rifornimenti are readable by authenticated users" 
ON public.rifornimenti 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Rifornimenti can be inserted by authenticated users" 
ON public.rifornimenti 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Rifornimenti can be updated by authenticated users" 
ON public.rifornimenti 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Rifornimenti can be deleted by authenticated users" 
ON public.rifornimenti 
FOR DELETE 
TO authenticated
USING (true);