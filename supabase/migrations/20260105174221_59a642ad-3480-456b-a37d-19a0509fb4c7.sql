-- Tabella config per la password unica di accesso
CREATE TABLE public.config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserisci la password di default (da cambiare in produzione)
INSERT INTO public.config (key, value) VALUES ('app_password', 'rifornimenti2024');

-- Tabella cantieri
CREATE TABLE public.cantieri (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  attivo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserisci alcuni cantieri di esempio
INSERT INTO public.cantieri (nome) VALUES 
  ('Cantiere Milano Centro'),
  ('Cantiere Roma Nord'),
  ('Cantiere Torino Sud'),
  ('Cantiere Napoli Est'),
  ('Cantiere Bologna Ovest');

-- Tabella rifornimenti
CREATE TABLE public.rifornimenti (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  targa TEXT,
  punto_vendita TEXT,
  data_rifornimento DATE NOT NULL,
  tipo_carburante TEXT,
  quantita DECIMAL(10,2),
  prezzo_unitario DECIMAL(10,4),
  importo_totale DECIMAL(10,2),
  chilometraggio INTEGER,
  cantiere_id UUID NOT NULL REFERENCES public.cantieri(id),
  note TEXT,
  immagine_url TEXT,
  data_inserimento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create storage bucket for receipt images
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true);

-- RLS per config (solo lettura pubblica per verificare password)
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Config is readable by everyone" 
ON public.config 
FOR SELECT 
USING (true);

-- RLS per cantieri (lettura pubblica)
ALTER TABLE public.cantieri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cantieri are readable by everyone" 
ON public.cantieri 
FOR SELECT 
USING (true);

-- RLS per rifornimenti (lettura e scrittura pubblica - sistema senza autenticazione utente)
ALTER TABLE public.rifornimenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rifornimenti are readable by everyone" 
ON public.rifornimenti 
FOR SELECT 
USING (true);

CREATE POLICY "Rifornimenti can be inserted by everyone" 
ON public.rifornimenti 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Rifornimenti can be updated by everyone" 
ON public.rifornimenti 
FOR UPDATE 
USING (true);

CREATE POLICY "Rifornimenti can be deleted by everyone" 
ON public.rifornimenti 
FOR DELETE 
USING (true);

-- Storage policies for receipts bucket
CREATE POLICY "Receipts are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'receipts');

CREATE POLICY "Anyone can upload receipts" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'receipts');

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_config_updated_at
BEFORE UPDATE ON public.config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rifornimenti_updated_at
BEFORE UPDATE ON public.rifornimenti
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();