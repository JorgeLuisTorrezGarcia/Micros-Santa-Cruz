import React, { useEffect, useRef, useState } from 'react';
import { UserProfile } from '../types.ts';
import { authenticateWithGoogleToken } from '../services/communityService.ts';
import {
  ApiClientError,
  getUserFriendlyError,
} from '../services/apiClient.ts';
import { X, LogOut, ShieldCheck, Cloud, CloudOff, User } from 'lucide-react';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>
          ) => void;
        };
      };
    };
  }
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  dbConfigured: boolean;
  onAuthSuccess: (user: UserProfile) => void;
  onSignOut: () => void;
  onOpenModeration?: () => void;
}

interface AuthAccountSectionProps {
  user: UserProfile;
  onClose: () => void;
  onSignOut: () => void;
  onOpenModeration?: () => void;
}

function AuthAccountSection({
  user,
  onClose,
  onSignOut,
  onOpenModeration,
}: AuthAccountSectionProps) {
  return (
    <>
      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/70">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            className="w-11 h-11 rounded-full object-cover border border-slate-600"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-100 truncate">
            {user.displayName}
          </p>
          <p className="text-xs text-slate-400 truncate">{user.email}</p>
          <p className="text-[11px] text-emerald-400 mt-0.5">
            {user.role === 'admin'
              ? 'Administrador · Moderación habilitada'
              : 'Pasajero · Lugares privados y favoritos activos'}
          </p>
        </div>
      </div>

      {user.role === 'admin' && onOpenModeration && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenModeration();
          }}
          className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition min-h-[44px]"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Abrir Panel de Moderación</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          onSignOut();
          onClose();
        }}
        className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition min-h-[44px]"
      >
        <LogOut className="w-4 h-4 text-rose-400" />
        <span>Cerrar sesión</span>
      </button>
    </>
  );
}

interface AuthLoginSectionProps {
  dbConfigured: boolean;
  googleClientId: string;
  googleBtnRef: React.RefObject<HTMLDivElement | null>;
  isSubmitting: boolean;
  errorMsg: string | null;
}

function AuthLoginSection({
  dbConfigured,
  googleClientId,
  googleBtnRef,
  isSubmitting,
  errorMsg,
}: AuthLoginSectionProps) {
  return (
    <>
      <p className="text-xs text-slate-300 leading-relaxed">
        Guarda tus lugares personales privados, propón nuevos puntos y
        categorías para Santa Cruz y guarda tus líneas y viajes{' '}
        <strong className="text-slate-100">A → B</strong> favoritos en
        tu cuenta.
      </p>

      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/70 flex items-center gap-2.5 text-xs">
        {dbConfigured ? (
          <>
            <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-slate-200">
              Tu cuenta está lista para guardar y sincronizar tus favoritos.
            </span>
          </>
        ) : (
          <>
            <CloudOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-slate-300">
              El acceso a cuentas no está disponible por ahora. Puedes seguir usando las funciones principales sin iniciar sesión.
            </span>
          </>
        )}
      </div>

      {dbConfigured && googleClientId ? (
        <div className="flex flex-col items-center py-2">
          <div ref={googleBtnRef} className="min-h-[44px]" />
          {isSubmitting && (
            <p className="text-xs text-emerald-400 mt-2">
              Conectando tu cuenta...
            </p>
          )}
        </div>
      ) : (
        dbConfigured && (
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-slate-100">
              El inicio de sesión no está disponible por ahora
            </p>
            <p className="text-[11px] text-slate-400">
              Puedes seguir usando las funciones principales de la aplicación sin iniciar sesión.
            </p>
          </div>
        )
      )}

      {errorMsg && (
        <p className="text-xs text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded-lg px-3 py-2">
          {errorMsg}
        </p>
      )}
    </>
  );
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  user,
  dbConfigured,
  onAuthSuccess,
  onSignOut,
  onOpenModeration,
}) => {
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const googleClientId =
    typeof import.meta.env.VITE_GOOGLE_CLIENT_ID === 'string'
      ? import.meta.env.VITE_GOOGLE_CLIENT_ID.trim()
      : '';

  useEffect(() => {
    if (!isOpen || user || !googleClientId || !dbConfigured) return;

    let cancelled = false;

    const initGsi = () => {
      if (cancelled || !googleBtnRef.current || !window.google?.accounts?.id) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (resp) => {
          if (!resp.credential) {
            setErrorMsg('No pudimos confirmar tu acceso con Google. Inténtalo nuevamente.');
            return;
          }
          setIsSubmitting(true);
          setErrorMsg(null);
          try {
            const { user: signedInUser } = await authenticateWithGoogleToken(
              resp.credential
            );
            onAuthSuccess(signedInUser);
            onClose();
          } catch (err: unknown) {
            console.error('Error al iniciar sesión con Google:', err);
            setErrorMsg(
              err instanceof ApiClientError && err.status === 401
                ? 'No pudimos validar tu acceso con Google. Inténtalo nuevamente.'
                : getUserFriendlyError(
                    err,
                    'No pudimos iniciar sesión. Inténtalo nuevamente.'
                  )
            );
          } finally {
            setIsSubmitting(false);
          }
        },
      });

      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'rectangular',
        text: 'signin_with',
        locale: 'es',
        width: 300,
      });
    };

    let existingScript: HTMLScriptElement | null = null;
    let createdScript: HTMLScriptElement | null = null;
    const handleScriptLoad = () => initGsi();
    const handleScriptError = () => {
      if (!cancelled) {
        console.warn('No se pudo cargar el servicio de inicio de sesión con Google.');
        setErrorMsg('No pudimos cargar el inicio de sesión. Revisa tu conexión e inténtalo nuevamente.');
      }
    };

    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      existingScript = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]'
      ) as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener('load', handleScriptLoad);
        existingScript.addEventListener('error', handleScriptError);
      } else {
        createdScript = document.createElement('script');
        createdScript.src = 'https://accounts.google.com/gsi/client';
        createdScript.async = true;
        createdScript.defer = true;
        createdScript.addEventListener('load', handleScriptLoad);
        createdScript.addEventListener('error', handleScriptError);
        document.head.appendChild(createdScript);
      }
    }

    return () => {
      cancelled = true;
      existingScript?.removeEventListener('load', handleScriptLoad);
      existingScript?.removeEventListener('error', handleScriptError);
      createdScript?.removeEventListener('load', handleScriptLoad);
      createdScript?.removeEventListener('error', handleScriptError);
    };
  }, [isOpen, user, googleClientId, dbConfigured, onAuthSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-100">
              {user ? 'Tu cuenta' : 'Iniciar sesión con Google'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Cerrar ventana de cuenta"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {user ? (
            <AuthAccountSection
              user={user}
              onClose={onClose}
              onSignOut={onSignOut}
              onOpenModeration={onOpenModeration}
            />
          ) : (
            <AuthLoginSection
              dbConfigured={dbConfigured}
              googleClientId={googleClientId}
              googleBtnRef={googleBtnRef}
              isSubmitting={isSubmitting}
              errorMsg={errorMsg}
            />
          )}
        </div>
      </div>
    </div>
  );
};
