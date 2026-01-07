import { useState } from "react";
import { Lock, Mail, AlertCircle, Loader2, UserPlus, LogIn } from "lucide-react";
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
  const [isForgotPassword, setIsForgotPassword] = useState(false);
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        setError(e.errors[0].message);
        return;
      }
    }

    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      toast({
        title: "Email inviata",
        description: "Controlla la tua casella email per il link di recupero password",
      });

      setIsForgotPassword(false);
      setEmail("");
    } catch (err) {
      setError("Errore durante l'invio dell'email. Riprova.");
      console.error("Forgot password error:", err);
    } finally {
      setIsLoading(false);
    }
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
          description: "Controlla la tua email e clicca sul link di conferma per attivare l'account.",
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
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary mb-4 p-0">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="FuelFlow Logo" className="w-20 h-20 drop-shadow-[0_0_3px_rgba(234,88,12,0.25)]" />
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
          {!isForgotPassword && (
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
          )}

          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Password dimenticata?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Inserisci la tua email e ti invieremo un link per reimpostare la password
                </p>
              </div>

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

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 btn-hero"
                disabled={isLoading || !email}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Invio in corso...
                  </>
                ) : (
                  "Invia link di recupero"
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setIsForgotPassword(false);
                  setError("");
                  setEmail("");
                }}
                disabled={isLoading}
              >
                Torna al login
              </Button>
            </form>
          ) : (
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

            {!isSignUp && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setError("");
                    setPassword("");
                  }}
                  className="text-sm text-primary hover:underline"
                  disabled={isLoading}
                >
                  Password dimenticata?
                </button>
              </div>
            )}
          </form>
          )}

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
