import { useState } from "react";
import { Fuel, Lock, Mail, AlertCircle, Loader2, UserPlus, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { z } from "zod";

const emailSchema = z.string().email("Inserisci un indirizzo email valido");
const passwordSchema = z.string().min(6, "La password deve essere di almeno 6 caratteri");

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  useAuthRedirect({ redirectTo: "/dashboard", requireAuth: false });

  const validateInputs = (): boolean => {
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        setError(e.errors[0].message);
        return false;
      }
    }
    
    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        setError(e.errors[0].message);
        return false;
      }
    }
    
    return true;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!validateInputs()) {
      return;
    }
    
    setIsLoading(true);

    try {
      if (isSignUp) {
        const redirectUrl = `${window.location.origin}/`;
        
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl
          }
        });

        if (signUpError) {
          if (signUpError.message.includes("already registered")) {
            setError("Questa email è già registrata. Prova ad accedere.");
          } else {
            setError(signUpError.message);
          }
          return;
        }

        toast({
          title: "Registrazione completata",
          description: "Account creato con successo. Accesso in corso...",
        });
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          if (signInError.message.includes("Invalid login credentials")) {
            setError("Email o password non corretti");
          } else {
            setError(signInError.message);
          }
          return;
        }

        toast({
          title: "Accesso effettuato",
          description: "Benvenuto in FuelFlow",
        });
      }
    } catch (err) {
      setError("Errore durante l'operazione. Riprova.");
      console.error("Auth error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/30">
      {/* Logo and branding */}
      <div className="mb-8 text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary mb-4">
          <Fuel className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          FuelFlow
        </h1>
        <p className="text-muted-foreground mt-2">
          Sistema centralizzato per la gestione dei rifornimenti aziendali
        </p>
      </div>

      {/* Auth card */}
      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-card rounded-2xl shadow-card p-6 sm:p-8 border border-border">
          <div className="flex gap-2 mb-6">
            <Button
              type="button"
              variant={!isSignUp ? "default" : "outline"}
              className="flex-1 gap-2"
              onClick={() => { setIsSignUp(false); setError(""); }}
            >
              <LogIn className="w-4 h-4" />
              Accedi
            </Button>
            <Button
              type="button"
              variant={isSignUp ? "default" : "outline"}
              className="flex-1 gap-2"
              onClick={() => { setIsSignUp(true); setError(""); }}
            >
              <UserPlus className="w-4 h-4" />
              Registrati
            </Button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Inserisci la tua email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 h-12"
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder={isSignUp ? "Crea una password (min 6 caratteri)" : "Inserisci la password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 h-12"
                  disabled={isLoading}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 btn-hero"
              disabled={isLoading || !email || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {isSignUp ? "Registrazione..." : "Accesso in corso..."}
                </>
              ) : (
                isSignUp ? "Crea account" : "Accedi"
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              {isSignUp 
                ? "Registrandoti accetti i termini e le condizioni del servizio."
                : "Per richiedere le credenziali di accesso, contatta l'amministratore di sistema."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
