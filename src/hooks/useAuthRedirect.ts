import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface UseAuthRedirectOptions {
  redirectTo: string;
  requireAuth: boolean;
  onSessionReady?: () => void;
}

export const useAuthRedirect = ({ redirectTo, requireAuth, onSessionReady }: UseAuthRedirectOptions) => {
  const [session, setSession] = useState<Session | null>(null);
  const navigate = useNavigate();
  const callbackExecutedRef = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);

        if (requireAuth && !currentSession?.user) {
          navigate(redirectTo);
        } else if (!requireAuth && currentSession?.user) {
          navigate(redirectTo);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);

      if (requireAuth && !currentSession?.user) {
        navigate(redirectTo);
      } else if (!requireAuth && currentSession?.user) {
        navigate(redirectTo);
      } else if (requireAuth && currentSession?.user && !callbackExecutedRef.current && onSessionReady) {
        callbackExecutedRef.current = true;
        onSessionReady();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, redirectTo, requireAuth]);

  return { session };
};
