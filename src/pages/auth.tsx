import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BrandMark } from "../components/brand-mark";
import { Button, Field, Page, PhoneField, TextInput, inputClass } from "../components/ui";
import { PinPad } from "../components/pads";
import { AuthShell } from "../components/shell";
import { useOnline } from "../hooks/useOnline";
import { ApiError } from "../lib/api";
import { useApi } from "../lib/api-context";
import { canPromptInstall, isIos, promptInstall, subscribeInstall } from "../lib/install";
import { postBlockReason } from "../lib/offline";
import { CATEGORIES, pinConfirmError, validateShop, type ShopDraft } from "../lib/validation";
import { useSession } from "../stores/session";
import { useToast } from "../stores/toast";

function AuthBrandHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <div className="mb-5 flex items-center gap-2.5 lg:hidden">
        <BrandMark size={36} />
        <p className="text-lg font-bold tracking-tight text-primary">JaayKat</p>
      </div>
      <h1 className="font-display text-[28px] leading-[34px] font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
    </div>
  );
}

export function InstallPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(canPromptInstall());
  useEffect(() => subscribeInstall(() => setReady(canPromptInstall())), []);

  return (
    <AuthShell>
      <Page
        action={
          <div className="flex flex-col gap-2">
            {ready ? (
              <Button
                type="button"
                onClick={() => {
                  void promptInstall().then(() => {
                    useToast.getState().show("Installation lancée");
                    navigate("/app/register");
                  });
                }}
              >
                Installer
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                localStorage.setItem("jk.installLater", "1");
                navigate("/app/register");
              }}
            >
              Plus tard
            </Button>
          </div>
        }
      >
        <AuthBrandHeader title="Installer Jaaykat" subtitle="Ajoutez l'app sur votre écran d'accueil." />
        <p>Installez Jaaykat sur votre téléphone.</p>
        {isIos() ? (
          <p className="mt-4 rounded-xl bg-surface p-4 text-sm">
            Sur iPhone : Partager, puis « Sur l'écran d'accueil ».
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted">
            Sinon : menu du navigateur, puis « Ajouter à l'écran d'accueil ».
          </p>
        )}
        <Link to="/app/login" className="mt-6 inline-flex min-h-12 items-center text-primary">
          J'ai déjà une boutique
        </Link>
      </Page>
    </AuthShell>
  );
}

const EMPTY_SHOP: ShopDraft = {
  shopName: "",
  category: "",
  firstName: "",
  lastName: "",
  phone: "",
  acceptTerms: false,
};

export function RegisterPage() {
  const api = useApi();
  const online = useOnline();
  const navigate = useNavigate();
  const [step, setStep] = useState<"shop" | "pin">("shop");
  const [draft, setDraft] = useState<ShopDraft>(EMPTY_SHOP);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phase, setPhase] = useState<"edit" | "confirm" | "submit">("edit");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const block = postBlockReason("register", online);

  function continueShop() {
    const result = validateShop(draft);
    if (!result.ok) {
      setFields(result.fields);
      return;
    }
    setFields({});
    setStep("pin");
  }

  function onPin(next: string) {
    setError(null);
    if (phase === "edit") {
      setPin(next);
      if (next.length === 6) {
        const pinIssue = pinConfirmError(next, next);
        if (pinIssue && pinIssue !== "Les deux codes sont différents.") {
          setError(pinIssue);
          setShake(true);
          setPin("");
          return;
        }
        setPhase("confirm");
      }
      return;
    }
    setConfirm(next);
    if (next.length === 6) {
      const issue = pinConfirmError(pin, next);
      if (issue) {
        setError(issue);
        setShake(true);
        setConfirm("");
        if (issue === "Les deux codes sont différents.") setPhase("edit");
        setPin("");
        return;
      }
      void submit(next);
    }
  }

  async function submit(confirmed: string) {
    if (block) {
      setError(block);
      return;
    }
    const result = validateShop(draft);
    if (!result.ok) {
      setStep("shop");
      setFields(result.fields);
      return;
    }
    setPhase("submit");
    try {
      const auth = await api.register({ ...result.value, pin: confirmed });
      useSession.getState().setAuth(auth);
      useToast.getState().show("Boutique créée");
      navigate("/app/charge", { replace: true });
    } catch (caught) {
      setPhase("edit");
      setPin("");
      setConfirm("");
      if (caught instanceof ApiError && caught.code === "PHONE_TAKEN") {
        setStep("shop");
        setFields({ phone: "Ce numéro est déjà utilisé." });
        return;
      }
      if (caught instanceof ApiError && caught.code === "BITNOB_UNAVAILABLE") {
        setError("La création a échoué, rien n'a été enregistré.");
        return;
      }
      setError(caught instanceof ApiError ? caught.message : "La création a échoué. Réessayez.");
    }
  }

  if (step === "shop") {
    return (
      <AuthShell>
        <Page
          action={
            <div>
              {block ? <p className="mb-2 text-sm text-warning">{block}</p> : null}
              <Button type="button" onClick={continueShop} disabled={Boolean(block)}>
                Continuer
              </Button>
            </div>
          }
        >
          <AuthBrandHeader title="Créer ma boutique" subtitle="Bienvenue sur JaayKat, créons votre compte." />
          <p className="mb-4 text-sm text-muted">Étape 1 sur 2.</p>
          <div className="flex flex-col gap-4">
            <Field id="shopName" label="Nom de la boutique" error={fields.shopName}>
              <TextInput
                id="shopName"
                value={draft.shopName}
                aria-invalid={Boolean(fields.shopName)}
                onChange={(event) => setDraft({ ...draft, shopName: event.target.value })}
              />
            </Field>
            <Field id="category" label="Catégorie" error={fields.category}>
              <select
                id="category"
                className={inputClass}
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value })}
              >
                <option value="">Choisir</option>
                {CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="firstName" label="Prénom" hint="Utilisé pour vos retraits" error={fields.firstName}>
              <TextInput
                id="firstName"
                value={draft.firstName}
                onChange={(event) => setDraft({ ...draft, firstName: event.target.value })}
              />
            </Field>
            <Field id="lastName" label="Nom" error={fields.lastName}>
              <TextInput
                id="lastName"
                value={draft.lastName}
                onChange={(event) => setDraft({ ...draft, lastName: event.target.value })}
              />
            </Field>
            <PhoneField
              id="phone"
              hint="Votre numéro sert d'identifiant."
              error={fields.phone}
              value={draft.phone}
              onChange={(value) => setDraft({ ...draft, phone: value })}
            />
            <label className="flex min-h-12 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.acceptTerms}
                onChange={(event) => setDraft({ ...draft, acceptTerms: event.target.checked })}
              />
              J&apos;accepte les conditions de la démo
            </label>
            <p className="text-xs text-muted">Ce code PIN ne peut pas être récupéré.</p>
            {fields.acceptTerms ? <p className="text-sm text-danger">{fields.acceptTerms}</p> : null}
          </div>
          <Link to="/app/login" className="mt-6 inline-flex min-h-12 items-center text-primary">
            J'ai déjà une boutique
          </Link>
        </Page>
      </AuthShell>
    );
  }

  if (phase === "submit") {
    return (
      <AuthShell>
        <Page>
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
            <BrandMark size={56} />
            <p className="mt-6 text-lg font-semibold">Nous créons votre boutique…</p>
            <p className="mt-2 text-sm text-muted">Sécurité, simplement.</p>
            <div className="mt-8 h-2 w-full max-w-xs overflow-hidden rounded-full bg-black/10">
              <div className="jk-progress-bar h-full rounded-full bg-primary" />
            </div>
            <p className="mt-6 text-xs text-subtle">Génération des clés · Catégories · Score</p>
          </div>
        </Page>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Page>
        <AuthBrandHeader
          title="Code PIN"
          subtitle={
            phase === "confirm"
              ? "Confirmez votre code à 6 chiffres."
              : "Ce code protège vos ventes et vos retraits. Notez-le, il ne peut pas être récupéré."
          }
        />
        <p className="mb-2 text-sm font-medium">{phase === "confirm" ? "Confirmez le code" : "Choisissez 6 chiffres"}</p>
        {error ? (
          <p role="alert" className="mb-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {block ? <p className="mb-3 text-sm text-warning">{block}</p> : null}
        <PinPad value={phase === "confirm" ? confirm : pin} onChange={onPin} disabled={Boolean(block)} shake={shake} />
      </Page>
    </AuthShell>
  );
}

export function LoginPage() {
  const api = useApi();
  const online = useOnline();
  const navigate = useNavigate();
  const location = useLocation();
  const expired = Boolean((location.state as { expired?: boolean } | null)?.expired);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const block = postBlockReason("login", online);

  async function submit() {
    if (block) {
      setError(block);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const auth = await api.login({ phone, pin });
      useSession.getState().setAuth(auth);
      navigate("/app/charge", { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        if (caught.code === "LOCKED" || caught.code === "RATE_LIMITED") setLocked(true);
        else setPin("");
      } else {
        setError("Connexion impossible. Réessayez.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <Page
        action={
          <div>
            {block ? <p className="mb-2 text-sm text-warning">{block}</p> : null}
            <Button type="button" onClick={() => void submit()} busy={busy} disabled={locked || pin.length < 6 || phone.trim() === "" || Boolean(block)}>
              Se connecter
            </Button>
          </div>
        }
      >
        <AuthBrandHeader title="Se connecter" subtitle="Entrez vos identifiants pour accéder à votre boutique." />
        {expired ? (
          <p role="status" className="mb-4 rounded-xl bg-warning-bg px-3 py-2 text-sm text-warning">
            Votre session a expiré, reconnectez-vous.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mb-4 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <PhoneField id="login-phone" value={phone} onChange={setPhone} />
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Code PIN</p>
          <PinPad value={pin} onChange={setPin} disabled={locked || busy} />
        </div>
        <div className="mt-4 flex flex-col">
          <Link to="/app/forgot" className="inline-flex min-h-12 items-center text-primary">
            PIN oublié ?
          </Link>
          <Link to="/app/register" className="inline-flex min-h-12 items-center font-medium text-primary">
            Créer ma boutique
          </Link>
        </div>
      </Page>
    </AuthShell>
  );
}

export function ForgotPage() {
  return (
    <AuthShell>
      <Page
        action={
          <Link to="/app/login" className="inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-navy font-semibold text-white">
            Retour à la connexion
          </Link>
        }
      >
        <AuthBrandHeader title="PIN oublié" subtitle="Le code ne peut pas être récupéré à distance." />
        <p>Pendant la démo, l&apos;équipe le réinitialise sur place.</p>
      </Page>
    </AuthShell>
  );
}
