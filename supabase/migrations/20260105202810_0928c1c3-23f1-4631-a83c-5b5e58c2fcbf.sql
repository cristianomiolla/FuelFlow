-- Create fuel types lookup table (shared across all users)
CREATE TABLE public.tipi_carburante (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  descrizione text,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tipi_carburante ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read (public lookup table)
CREATE POLICY "Anyone can view fuel types"
ON public.tipi_carburante
FOR SELECT
TO authenticated
USING (true);

-- Insert common Italian fuel types
INSERT INTO public.tipi_carburante (nome, descrizione) VALUES
  ('Benzina', 'Benzina senza piombo'),
  ('Diesel', 'Gasolio per autotrazione'),
  ('GPL', 'Gas di petrolio liquefatto'),
  ('Metano', 'Gas naturale compresso (CNG)'),
  ('Benzina Premium', 'Benzina ad alto ottanaggio'),
  ('Diesel Premium', 'Gasolio premium/additivato'),
  ('AdBlue', 'Additivo per motori diesel'),
  ('Elettrico', 'Ricarica elettrica');