-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Cantieri are readable by authenticated users" ON public.cantieri;

-- Create comprehensive policies for authenticated users
CREATE POLICY "Cantieri are readable by authenticated users" 
ON public.cantieri 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Cantieri can be inserted by authenticated users" 
ON public.cantieri 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Cantieri can be updated by authenticated users" 
ON public.cantieri 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Cantieri can be deleted by authenticated users" 
ON public.cantieri 
FOR DELETE 
TO authenticated
USING (true);