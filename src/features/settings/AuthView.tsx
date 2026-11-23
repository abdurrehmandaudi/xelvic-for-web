import { useState } from "react";
import { BadgeCheck, Cake, CircleUserRound, Mail, Phone } from "lucide-react";
import { Modal } from "@/components/overlays/Modal";
import { SettingsRow, SettingsRows } from "@/features/settings/parts";
import { cn } from "@/utils/cn";
import { ApiError, errorMessage } from "@/utils/errors";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/hooks/useToast";
import { authService } from "@/services/auth.service";
import type { Me } from "@/types/api";

type Identity = Me & { email_verified?: boolean; phone_verified?: boolean; gender?: string | null };
type Action = "email" | "phone" | "dob" | "gender" | null;
type Step = "password" | "value" | "code";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dobLabel(raw: string | null | undefined, none: string): string {
  if (!raw) return none;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return none;
  return `${parsed.getDate()} ${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

function genderLabel(value: string | null | undefined, t: (word: string) => string): string {
  if (value === "girl") return t("Girl");
  if (value === "boy") return t("Boy");
  if (value === "other") return t("Other");
  return t("Not said");
}

function codeLine(answer: Record<string, unknown>, t: (word: string) => string): string {
  const target = String(answer.target_hint ?? answer.target ?? "");
  const via = String(answer.sent_via ?? answer.channel ?? "");
  if (via === "sms") return t(`We texted a code to ${target}.`);
  if (via === "whatsapp") return t(`We sent a code on WhatsApp to ${target}.`);
  if (via === "email") return t(`We emailed a code to ${target}.`);
  return t(`We sent a code to ${target}.`);
}

function refusal(error: unknown, email: boolean, t: (word: string) => string): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "bad_credentials":
        return t("That password is not right.");
      case "contact_is_yours":
        return email ? t("That email is already on your account.") : t("That number is already on your account.");
      case "contact_taken":
        return email ? t("That email belongs to another account.") : t("That number belongs to another account.");
      case "invalid_contact":
        return email ? t("Enter a valid email address.") : t("Enter a valid mobile number.");
      case "otp_wrong":
        return t("That code is not right.");
      case "otp_expired":
        return t("That code has expired. Send a new one.");
      case "otp_locked":
        return t("Too many wrong tries. Send a new code.");
      case "otp_cooldown":
        return t("Wait a moment before asking for another code.");
      case "too_young":
        return t("You have to be 13 or older.");
      default:
        return error.message;
    }
  }
  return errorMessage(error);
}

const fieldClass =
  "w-full min-h-10 rounded-control border border-line bg-card px-4 py-3 text-ink transition-[border-color,box-shadow] duration-[160ms] placeholder:text-dim-80 focus:border-accent focus:shadow-field-focus focus:outline-none";

export function AuthView() {
  const { user, updateUser } = useAuth();
  const { t } = usePreferences();
  const { toast } = useToast();

  const [action, setAction] = useState<Action>(null);
  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const me = user as Identity | null;
  const email = String(me?.email ?? "").trim();
  const phone = String(me?.phone ?? "").trim();

  function open(next: Action) {
    setAction(next);
    setStep("password");
    setPassword("");
    setValue("");
    setCode("");
    setNote("");
    setError("");
  }

  function close() {
    if (busy) return;
    setAction(null);
  }

  function finish(next: Me) {
    updateUser(next);
    toast({ title: t("Saved."), tone: "success" });
    setAction(null);
  }

  const isEmail = action === "email";

  function submitPassword() {
    if (!password) return;
    setError("");
    setStep("value");
  }

  async function sendContact() {
    if (busy || !value.trim()) return;
    setBusy(true);
    setError("");
    try {
      const answer = await authService.askContact(value.trim(), password);
      setValue(value.trim());
      setNote(codeLine(answer, t));
      setStep("code");
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "bad_credentials") {
        setError(t("That password is not right."));
        setStep("password");
      } else {
        setError(refusal(caught, isEmail, t));
      }
    } finally {
      setBusy(false);
    }
  }

  async function verifyContact() {
    if (busy || !code.trim()) return;
    setBusy(true);
    setError("");
    try {
      const next = await authService.verifyContact(value.trim(), password, code.trim());
      finish(next);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "bad_credentials") {
        setError(t("That password is not right."));
        setStep("password");
      } else {
        setError(refusal(caught, isEmail, t));
      }
    } finally {
      setBusy(false);
    }
  }

  async function writeIdentity(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await authService.setIdentity({ ...body, password });
      finish(next);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "bad_credentials") {
        setError(t("That password is not right."));
        setStep("password");
      } else {
        setError(refusal(caught, true, t));
      }
    } finally {
      setBusy(false);
    }
  }

  const title =
    action === "email"
      ? email
        ? t("Change email")
        : t("Add email")
      : action === "phone"
        ? phone
          ? t("Change number")
          : t("Add a number")
        : action === "dob"
          ? t("Date of birth")
          : t("Gender");

  return (
    <div className="pb-10">
      <p className="px-[18px] pb-2.5 pt-5 text-[12.5px] leading-[1.4] text-dim">
        {t("This confirms it is you.")}
      </p>
      <SettingsRows>
        <SettingsRow
          icon={<Mail className="size-5" />}
          title={t("Email")}
          value={email || t("Add email")}
          note={email ? (me?.email_verified ? t("Verified") : t("Not verified")) : t("No email on this account yet.")}
          onClick={() => open("email")}
        />
        <SettingsRow
          icon={<Phone className="size-5" />}
          title={t("Phone number")}
          value={phone || t("Add a number")}
          note={phone ? (me?.phone_verified ? t("Verified") : t("Not verified")) : t("No number on this account yet.")}
          onClick={() => open("phone")}
        />
        <SettingsRow
          icon={<Cake className="size-5" />}
          title={t("Date of birth")}
          note={t("Used to choose what you are shown. Never shown to anyone.")}
          value={dobLabel(me?.dob, t("Not said"))}
          onClick={() => open("dob")}
        />
        <SettingsRow
          icon={<BadgeCheck className="size-5" />}
          title={t("Gender")}
          note={t("Only you ever see this. It is used to choose what you are offered.")}
          value={genderLabel(me?.gender, t)}
          onClick={() => open("gender")}
        />
      </SettingsRows>

      <Modal open={action !== null} onClose={close} title={title} size="sm">
        <div className="space-y-3 px-5 py-4">
          {step === "password" ? (
            <>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("Your password")}
                autoComplete="current-password"
                className={fieldClass}
                autoFocus
              />
              {error ? <p className="text-[12px] font-semibold text-[var(--bad)]">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex min-h-11 items-center rounded-control border border-line bg-card px-[1.1rem] text-[14px] font-bold text-ink"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="button"
                  onClick={submitPassword}
                  disabled={!password}
                  className="inline-flex min-h-11 items-center rounded-control bg-accent px-[1.1rem] text-[14px] font-bold text-on-accent disabled:opacity-45"
                >
                  {t("Continue")}
                </button>
              </div>
            </>
          ) : null}

          {step === "value" && (action === "email" || action === "phone") ? (
            <>
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                inputMode={isEmail ? "email" : "tel"}
                autoCapitalize="none"
                spellCheck={false}
                placeholder={isEmail ? t("Email address") : t("Mobile number")}
                className={fieldClass}
                autoFocus
              />
              {error ? <p className="text-[12px] font-semibold text-[var(--bad)]">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStep("password")}
                  className="inline-flex min-h-11 items-center rounded-control border border-line bg-card px-[1.1rem] text-[14px] font-bold text-ink"
                >
                  {t("Back")}
                </button>
                <button
                  type="button"
                  onClick={() => void sendContact()}
                  disabled={busy || !value.trim()}
                  className="inline-flex min-h-11 items-center rounded-control bg-accent px-[1.1rem] text-[14px] font-bold text-on-accent disabled:opacity-45"
                >
                  {busy ? t("Working...") : t("Send code")}
                </button>
              </div>
            </>
          ) : null}

          {step === "value" && action === "dob" ? (
            <>
              <input
                type="date"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                max={youngestDob()}
                className={fieldClass}
                autoFocus
              />
              {error ? <p className="text-[12px] font-semibold text-[var(--bad)]">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStep("password")}
                  className="inline-flex min-h-11 items-center rounded-control border border-line bg-card px-[1.1rem] text-[14px] font-bold text-ink"
                >
                  {t("Back")}
                </button>
                <button
                  type="button"
                  onClick={() => void writeIdentity({ dob: value })}
                  disabled={busy || !value}
                  className="inline-flex min-h-11 items-center rounded-control bg-accent px-[1.1rem] text-[14px] font-bold text-on-accent disabled:opacity-45"
                >
                  {busy ? t("Working...") : t("Save")}
                </button>
              </div>
            </>
          ) : null}

          {step === "value" && action === "gender" ? (
            <>
              <div className="flex flex-col">
                {[
                  { value: "", label: t("Not said") },
                  { value: "girl", label: t("Girl") },
                  { value: "boy", label: t("Boy") },
                  { value: "other", label: t("Other") },
                ].map((row) => {
                  const on = String(me?.gender ?? "") === row.value;
                  return (
                    <button
                      key={row.value || "none"}
                      type="button"
                      disabled={busy}
                      onClick={() => void writeIdentity({ gender: row.value })}
                      className={cn(
                        "flex items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-semibold transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]",
                        on && "text-accent",
                      )}
                    >
                      <CircleUserRound className={cn("size-5 shrink-0", on ? "text-accent" : "text-dim")} aria-hidden />
                      {row.label}
                    </button>
                  );
                })}
              </div>
              {error ? <p className="text-[12px] font-semibold text-[var(--bad)]">{error}</p> : null}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep("password")}
                  className="inline-flex min-h-11 items-center rounded-control border border-line bg-card px-[1.1rem] text-[14px] font-bold text-ink"
                >
                  {t("Back")}
                </button>
              </div>
            </>
          ) : null}

          {step === "code" ? (
            <>
              <p className="text-[13px] leading-5 text-dim">{note}</p>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                maxLength={8}
                placeholder={t("Verification code")}
                className={fieldClass}
                autoFocus
              />
              {error ? <p className="text-[12px] font-semibold text-[var(--bad)]">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setStep("value");
                  }}
                  className="inline-flex min-h-11 items-center rounded-control border border-line bg-card px-[1.1rem] text-[14px] font-bold text-ink"
                >
                  {t("Change")}
                </button>
                <button
                  type="button"
                  onClick={() => void verifyContact()}
                  disabled={busy || !code.trim()}
                  className="inline-flex min-h-11 items-center rounded-control bg-accent px-[1.1rem] text-[14px] font-bold text-on-accent disabled:opacity-45"
                >
                  {busy ? t("Working...") : t("Verify")}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

function youngestDob(): string {
  const now = new Date();
  const youngest = new Date(now.getFullYear() - 13, now.getMonth(), now.getDate());
  const month = String(youngest.getMonth() + 1).padStart(2, "0");
  const day = String(youngest.getDate()).padStart(2, "0");
  return `${youngest.getFullYear()}-${month}-${day}`;
}

export default AuthView;
