import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  User,
  X,
  ChevronDown,
  FileText,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import BrandLogo from "@/components/BrandLogo";
import {
  fetchPublicContentPage,
  getDefaultContentPage,
  type ContentPageRecord,
  type ContentPageSlug,
} from "@/lib/contentPages";

type ToastState = {
  type: "error" | "success" | "info";
  title: string;
  message: string;
};

type DzongkhagOption = {
  id: string;
  name: string;
};

const PHONE_ONLY_EMAIL_DOMAIN = "phone.shop2bhutan.com";

function makePhoneOnlyAuthEmail(phone8: string) {
  return `${phone8}@${PHONE_ONLY_EMAIL_DOMAIN}`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeBhutanPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const phone8 = digits.startsWith("975") ? digits.slice(3) : digits;
  if (!/^(17|77)\d{6}$/.test(phone8)) return null;
  return phone8;
}

function isDuplicateError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("already registered") ||
    lower.includes("already exists") ||
    lower.includes("duplicate key") ||
    lower.includes("unique constraint")
  );
}

function isEmailRateLimitError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("email rate limit") || lower.includes("rate limit exceeded")
  );
}

function getFriendlySignupError(message: string, hasRealEmail: boolean) {
  if (isEmailRateLimitError(message)) {
    return hasRealEmail
      ? "Supabase email limit is temporarily reached. Please wait a few minutes and try again."
      : "Phone-only registration is being blocked by Supabase email confirmation/rate limit. Turn off email confirmation for this MVP flow, then try again.";
  }
  if (!hasRealEmail && message.toLowerCase().includes("email")) {
    return "Phone-only registration needs the internal auth-email fix. Please use the latest patch and make sure email confirmation is disabled in Supabase.";
  }
  return message;
}

function normalizeDzongkhagOptions(data: unknown): DzongkhagOption[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : "";
      const name = typeof row.name === "string" ? row.name : "";
      return id && name ? { id, name } : null;
    })
    .filter((item): item is DzongkhagOption => Boolean(item));
}

function RegistrationToast({
  toast,
  onClose,
}: {
  toast: ToastState;
  onClose: () => void;
}) {
  const isError = toast.type === "error";
  const isSuccess = toast.type === "success";

  return (
    <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 animate-[fadeIn_0.2s_ease-out]">
      <div
        className={`rounded-2xl border bg-white/95 px-4 py-3 shadow-xl ${
          isError
            ? "border-red-100"
            : isSuccess
              ? "border-emerald-100"
              : "border-orange-100"
        }`}
      >
        <div className="flex gap-3">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              isError
                ? "bg-red-50 text-red-600"
                : isSuccess
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-orange-50 text-orange-600"
            }`}
          >
            {isSuccess ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">{toast.title}</p>
            <p className="mt-0.5 text-xs leading-5 text-gray-500">
              {toast.message}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 text-gray-400 hover:text-gray-600"
            aria-label="Close notification"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function PolicyContentModal({
  page,
  loading,
  error,
  onClose,
}: {
  page: ContentPageRecord;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-4 pb-4 sm:items-center sm:pb-0">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close policy information"
        onClick={onClose}
      />

      <div className="relative z-10 max-h-[82vh] w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <FileText size={22} strokeWidth={2.3} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-orange-500">
                Shop2Bhutan Policy
              </p>
              <h2 className="mt-0.5 truncate text-lg font-black text-gray-900">
                {page.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 active:scale-95"
            aria-label="Close"
          >
            <X size={17} strokeWidth={2.5} />
          </button>
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 size={18} className="animate-spin text-orange-500" />
              Loading latest information...
            </div>
          ) : (
            <div className="space-y-3 text-sm leading-relaxed text-gray-600">
              {page.content.split("\n").map((line, index) => {
                const cleanLine = line.trim();
                if (!cleanLine)
                  return <div key={`gap-${index}`} className="h-1" />;

                const looksLikeHeading =
                  /^\d+\.|^[A-Z][A-Za-z\s&]+$/.test(cleanLine) &&
                  cleanLine.length < 80;

                return looksLikeHeading ? (
                  <h3
                    key={`${cleanLine}-${index}`}
                    className="pt-2 text-base font-bold text-gray-900"
                  >
                    {cleanLine}
                  </h3>
                ) : (
                  <p key={`${cleanLine}-${index}`}>{cleanLine}</p>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-2xl bg-orange-500 text-sm font-bold text-white transition active:scale-[0.98]"
          >
            I understand
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const { refreshContext } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    dzongkhag: "",
    password: "",
    confirmPassword: "",
  });

  const [dzongkhagOptions, setDzongkhagOptions] = useState<DzongkhagOption[]>(
    [],
  );
  const [loadingDzongkhags, setLoadingDzongkhags] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isDzongkhagOpen, setIsDzongkhagOpen] = useState(false);
  const [policyModalSlug, setPolicyModalSlug] =
    useState<ContentPageSlug | null>(null);
  const [policyPage, setPolicyPage] = useState<ContentPageRecord | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState("");
  const dzongkhagRef = useRef<HTMLDivElement>(null);

  const normalizedPreviewPhone = useMemo(
    () => normalizeBhutanPhone(form.phone),
    [form.phone],
  );
  const selectedDzongkhag =
    dzongkhagOptions.find((item) => item.id === form.dzongkhag) || null;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    let active = true;
    async function loadDzongkhags() {
      setLoadingDzongkhags(true);
      const { data, error } = await supabase.rpc("get_dzongkhag_options");
      if (!active) return;
      if (error) {
        console.warn("Failed to load dzongkhags:", error.message);
        setDzongkhagOptions([]);
      } else {
        setDzongkhagOptions(normalizeDzongkhagOptions(data));
      }
      setLoadingDzongkhags(false);
    }
    void loadDzongkhags();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dzongkhagRef.current &&
        !dzongkhagRef.current.contains(event.target as Node)
      ) {
        setIsDzongkhagOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!policyModalSlug) {
      setPolicyPage(null);
      setPolicyError("");
      setPolicyLoading(false);
      return;
    }

    const activeSlug = policyModalSlug;
    let active = true;

    async function loadPolicyPage() {
      setPolicyLoading(true);
      setPolicyError("");

      try {
        const loaded = await fetchPublicContentPage(activeSlug);
        if (active) setPolicyPage(loaded);
      } catch (error) {
        console.warn("[Register] policy content load skipped:", error);
        if (active) {
          setPolicyPage(getDefaultContentPage(activeSlug));
          setPolicyError(
            "Unable to load the latest content. Showing default information.",
          );
        }
      } finally {
        if (active) setPolicyLoading(false);
      }
    }

    void loadPolicyPage();

    const handleContentUpdated = () => {
      void loadPolicyPage();
    };

    window.addEventListener(
      "shop2bhutan:content-updated",
      handleContentUpdated,
    );

    return () => {
      active = false;
      window.removeEventListener(
        "shop2bhutan:content-updated",
        handleContentUpdated,
      );
    };
  }, [policyModalSlug]);

  const showToast = (nextToast: ToastState) => {
    setToast(nextToast);
  };

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
    setSubmitError("");
    setSuccessMessage("");
  };

  const checkDuplicateRegistration = async (
    email: string | null,
    phone: string,
  ) => {
    const { data, error } = await supabase.rpc("check_registration_duplicate", {
      p_email: email,
      p_phone: phone,
    });
    if (error) {
      console.warn("Duplicate registration check skipped:", error.message);
      return { emailExists: false, phoneExists: false };
    }
    const result = data as {
      email_exists?: boolean;
      phone_exists?: boolean;
    } | null;
    return {
      emailExists: Boolean(result?.email_exists),
      phoneExists: Boolean(result?.phone_exists),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    const normalizedPhone = normalizeBhutanPhone(form.phone);

    if (!form.name.trim()) newErrors.name = "Name is required";
    const optionalEmail = form.email.trim().toLowerCase();
    if (optionalEmail && !isValidEmail(optionalEmail))
      newErrors.email = "Invalid email";
    if (!form.phone.trim()) newErrors.phone = "Phone number is required";
    else if (!normalizedPhone)
      newErrors.phone =
        "Enter a valid Bhutan mobile number. Example: 17123456 or 77123456";
    if (!form.dzongkhag) newErrors.dzongkhag = "Select your dzongkhag";
    if (!form.password) newErrors.password = "Password is required";
    else if (form.password.length < 6) newErrors.password = "Min 6 characters";
    if (form.password !== form.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";
    if (!agreed) newErrors.agreed = "You must agree to the terms";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast({
        type: "error",
        title: "Please check your details",
        message:
          "Some information is missing or invalid. Fix the highlighted fields and try again.",
      });
      return;
    }

    if (!normalizedPhone) return;

    setSubmitting(true);
    setSubmitError("");
    setSuccessMessage("");

    const cleanEmail = form.email.trim().toLowerCase();
    const hasRealEmail = cleanEmail.length > 0;
    const authEmail = hasRealEmail
      ? cleanEmail
      : makePhoneOnlyAuthEmail(normalizedPhone);
    const cleanName = form.name.trim();

    const { emailExists, phoneExists } = await checkDuplicateRegistration(
      hasRealEmail ? cleanEmail : null,
      normalizedPhone,
    );

    if (emailExists || phoneExists) {
      const duplicateErrors: Record<string, string> = {};
      if (emailExists)
        duplicateErrors.email = "This email is already registered";
      if (phoneExists)
        duplicateErrors.phone = "This phone number is already registered";
      setErrors((prev) => ({ ...prev, ...duplicateErrors }));
      setSubmitting(false);
      showToast({
        type: "error",
        title: "Account already exists",
        message:
          emailExists && phoneExists
            ? "This email and phone number are already registered. Please sign in instead."
            : emailExists
              ? "This email is already registered. Please sign in or use forgot password."
              : "This phone number is already registered. Please sign in with phone number instead.",
      });
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: form.password,
      options: {
        data: {
          full_name: cleanName,
          name: cleanName,
          phone: normalizedPhone,
          default_dzongkhag_id: form.dzongkhag,
          default_dzongkhag_name: selectedDzongkhag?.name ?? null,
          has_real_email: hasRealEmail,
        },
      },
    });

    if (error) {
      setSubmitting(false);
      const rawMessage =
        error.message || "Unable to create account. Please try again.";
      const friendlyMessage = getFriendlySignupError(rawMessage, hasRealEmail);
      setSubmitError(friendlyMessage);
      showToast({
        type: "error",
        title: isDuplicateError(rawMessage)
          ? "Account already exists"
          : "Registration failed",
        message: isDuplicateError(rawMessage)
          ? hasRealEmail
            ? "This email or phone number is already registered. Please sign in instead."
            : "This phone number is already registered. Please sign in with phone number instead."
          : friendlyMessage,
      });
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: data.user.id,
            full_name: cleanName,
            phone: normalizedPhone,
            default_dzongkhag_id: form.dzongkhag,
          },
          { onConflict: "id" },
        );
      if (profileError) {
        console.warn("Profile creation skipped:", profileError.message);
        if (isDuplicateError(profileError.message)) {
          setSubmitting(false);
          setErrors((prev) => ({
            ...prev,
            phone: "This phone number is already registered",
          }));
          showToast({
            type: "error",
            title: "Phone already registered",
            message:
              "This phone number is already linked to another account. Please use a different number.",
          });
          return;
        }
      }
    }

    setSubmitting(false);

    if (data.session) {
      showToast({
        type: "success",
        title: "Welcome to Shop2Bhutan",
        message: "Your account has been created successfully.",
      });
      await refreshContext();
      navigate("/");
      return;
    }

    const successText = hasRealEmail
      ? "Account created. Please check your email to confirm your account, then sign in."
      : "Account created. Please sign in with your phone number and password.";
    setSuccessMessage(successText);
    showToast({
      type: "success",
      title: hasRealEmail ? "Check your email" : "Account created",
      message: successText,
    });
  };

  return (
    <div className="min-h-[100dvh] bg-white pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]">
      {toast && (
        <RegistrationToast toast={toast} onClose={() => setToast(null)} />
      )}

      {policyModalSlug && (
        <PolicyContentModal
          page={policyPage ?? getDefaultContentPage(policyModalSlug)}
          loading={policyLoading}
          error={policyError}
          onClose={() => setPolicyModalSlug(null)}
        />
      )}

      <div className="mx-auto w-full max-w-md px-5">
        <div className="flex justify-center">
          <div className="origin-center scale-[0.78]">
            <BrandLogo variant="full" className="justify-center" />
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[30px] border border-neutral-100 bg-white shadow-[0_22px_65px_rgba(15,23,42,0.08)]">
          <div className="border-b border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 px-6 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-500">
                  New customer
                </p>
                <h1 className="mt-1 text-[26px] font-black tracking-tight text-neutral-950">
                  Create your account
                </h1>
                <p className="mt-2 max-w-xs text-sm leading-6 text-neutral-500">
                  Register once to request quotations, manage orders, save addresses, and receive updates.
                </p>
              </div>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white text-orange-500 shadow-sm ring-1 ring-orange-100">
                <User size={24} strokeWidth={2.1} />
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {submitError && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertCircle size={16} strokeWidth={2.5} />
                </div>
                <p className="text-sm font-medium leading-5 text-red-700">
                  {submitError}
                </p>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-sm font-medium leading-5 text-emerald-700">
                    {successMessage}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="mt-1 text-sm font-extrabold text-emerald-700 underline decoration-emerald-400 underline-offset-2"
                  >
                    Go to sign in
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <section className="rounded-[24px] border border-neutral-100 bg-neutral-50/60 p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
                    <User size={19} strokeWidth={2.1} />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-neutral-900">
                      Personal details
                    </h2>
                    <p className="text-xs text-neutral-400">
                      Tell us how to identify and contact you.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="register-name"
                      className="mb-2 block text-[13px] font-bold text-neutral-800"
                    >
                      Full name
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                        <User size={18} strokeWidth={1.9} />
                      </div>
                      <input
                        id="register-name"
                        type="text"
                        value={form.name}
                        autoComplete="name"
                        onChange={(e) => update("name", e.target.value)}
                        placeholder="Your full name"
                        className={`h-[52px] w-full rounded-2xl border bg-white pl-11 pr-4 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:ring-[3px] ${
                          errors.name
                            ? "border-red-400 bg-red-50/50 focus:border-red-400 focus:ring-red-500/10"
                            : "border-neutral-200 focus:border-orange-500 focus:ring-orange-500/10"
                        }`}
                      />
                    </div>
                    {errors.name && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-500">
                        <AlertCircle size={12} strokeWidth={2.5} />
                        {errors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label
                        htmlFor="register-email"
                        className="text-[13px] font-bold text-neutral-800"
                      >
                        Email address
                      </label>
                      <span className="rounded-full bg-neutral-200/70 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-neutral-500">
                        Optional
                      </span>
                    </div>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                        <Mail size={18} strokeWidth={1.9} />
                      </div>
                      <input
                        id="register-email"
                        type="email"
                        value={form.email}
                        autoComplete="email"
                        onChange={(e) => update("email", e.target.value)}
                        placeholder="your@email.com"
                        className={`h-[52px] w-full rounded-2xl border bg-white pl-11 pr-4 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:ring-[3px] ${
                          errors.email
                            ? "border-red-400 bg-red-50/50 focus:border-red-400 focus:ring-red-500/10"
                            : "border-neutral-200 focus:border-orange-500 focus:ring-orange-500/10"
                        }`}
                      />
                    </div>
                    {errors.email ? (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-500">
                        <AlertCircle size={12} strokeWidth={2.5} />
                        {errors.email}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs leading-5 text-neutral-400">
                        Recommended for password recovery and order updates.
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="register-phone"
                      className="mb-2 block text-[13px] font-bold text-neutral-800"
                    >
                      Bhutan mobile number
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                        <Phone size={18} strokeWidth={1.9} />
                      </div>
                      <input
                        id="register-phone"
                        type="tel"
                        value={form.phone}
                        autoComplete="tel"
                        inputMode="numeric"
                        onChange={(e) => update("phone", e.target.value)}
                        placeholder="17xxxxxx or 77xxxxxx"
                        className={`h-[52px] w-full rounded-2xl border bg-white pl-11 pr-4 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:ring-[3px] ${
                          errors.phone
                            ? "border-red-400 bg-red-50/50 focus:border-red-400 focus:ring-red-500/10"
                            : "border-neutral-200 focus:border-orange-500 focus:ring-orange-500/10"
                        }`}
                      />
                    </div>
                    {errors.phone ? (
                      <p className="mt-1.5 flex items-start gap-1 text-xs font-semibold leading-5 text-red-500">
                        <AlertCircle size={12} strokeWidth={2.5} className="mt-1 shrink-0" />
                        {errors.phone}
                      </p>
                    ) : normalizedPreviewPhone ? (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-emerald-600">
                        <CheckCircle size={12} strokeWidth={2.5} />
                        Valid number: {normalizedPreviewPhone}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs leading-5 text-neutral-400">
                        Enter 8 digits beginning with 17 or 77.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-[13px] font-bold text-neutral-800">
                      Dzongkhag
                    </label>
                    <div className="relative" ref={dzongkhagRef}>
                      <div className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-neutral-400">
                        <MapPin size={18} strokeWidth={1.9} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsDzongkhagOpen((current) => !current)}
                        disabled={loadingDzongkhags}
                        aria-expanded={isDzongkhagOpen}
                        className={`flex h-[52px] w-full items-center justify-between rounded-2xl border bg-white pl-11 pr-4 text-[15px] outline-none transition focus:ring-[3px] disabled:bg-neutral-100 ${
                          errors.dzongkhag
                            ? "border-red-400 bg-red-50/50 focus:border-red-400 focus:ring-red-500/10"
                            : "border-neutral-200 focus:border-orange-500 focus:ring-orange-500/10"
                        }`}
                      >
                        <span
                          className={
                            form.dzongkhag
                              ? "truncate font-medium text-neutral-900"
                              : "truncate text-neutral-400"
                          }
                        >
                          {form.dzongkhag
                            ? selectedDzongkhag?.name
                            : loadingDzongkhags
                              ? "Loading dzongkhags..."
                              : "Select your dzongkhag"}
                        </span>
                        {loadingDzongkhags ? (
                          <Loader2 size={17} className="shrink-0 animate-spin text-orange-500" />
                        ) : (
                          <ChevronDown
                            size={18}
                            strokeWidth={2}
                            className={`shrink-0 text-neutral-400 transition-transform duration-200 ${
                              isDzongkhagOpen ? "rotate-180" : ""
                            }`}
                          />
                        )}
                      </button>

                      {isDzongkhagOpen && (
                        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-black/10">
                          <div className="max-h-64 overflow-y-auto p-1.5">
                            {dzongkhagOptions.map((option) => {
                              const selected = form.dzongkhag === option.id;
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => {
                                    update("dzongkhag", option.id);
                                    setIsDzongkhagOpen(false);
                                  }}
                                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-left text-sm transition ${
                                    selected
                                      ? "bg-orange-50 font-bold text-orange-600"
                                      : "font-medium text-neutral-700 hover:bg-neutral-50"
                                  }`}
                                >
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                                    {selected && <CheckCircle size={16} strokeWidth={2.5} />}
                                  </span>
                                  {option.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {errors.dzongkhag ? (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-500">
                        <AlertCircle size={12} strokeWidth={2.5} />
                        {errors.dzongkhag}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs leading-5 text-neutral-400">
                        Used for your order records. Delivery and pickup currently operate in selected hubs.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-neutral-100 bg-neutral-50/60 p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
                    <Lock size={19} strokeWidth={2.1} />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-neutral-900">
                      Account security
                    </h2>
                    <p className="text-xs text-neutral-400">
                      Create a password with at least 6 characters.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="register-password"
                      className="mb-2 block text-[13px] font-bold text-neutral-800"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                        <Lock size={18} strokeWidth={1.9} />
                      </div>
                      <input
                        id="register-password"
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        autoComplete="new-password"
                        onChange={(e) => update("password", e.target.value)}
                        placeholder="Minimum 6 characters"
                        className={`h-[52px] w-full rounded-2xl border bg-white pl-11 pr-12 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:ring-[3px] ${
                          errors.password
                            ? "border-red-400 bg-red-50/50 focus:border-red-400 focus:ring-red-500/10"
                            : "border-neutral-200 focus:border-orange-500 focus:ring-orange-500/10"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 active:scale-95"
                        aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                      >
                        {showPassword ? (
                          <EyeOff size={18} strokeWidth={1.9} />
                        ) : (
                          <Eye size={18} strokeWidth={1.9} />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-500">
                        <AlertCircle size={12} strokeWidth={2.5} />
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="register-confirm-password"
                      className="mb-2 block text-[13px] font-bold text-neutral-800"
                    >
                      Confirm password
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                        <Lock size={18} strokeWidth={1.9} />
                      </div>
                      <input
                        id="register-confirm-password"
                        type={showPassword ? "text" : "password"}
                        value={form.confirmPassword}
                        autoComplete="new-password"
                        onChange={(e) => update("confirmPassword", e.target.value)}
                        placeholder="Re-enter your password"
                        className={`h-[52px] w-full rounded-2xl border bg-white pl-11 pr-4 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:ring-[3px] ${
                          errors.confirmPassword
                            ? "border-red-400 bg-red-50/50 focus:border-red-400 focus:ring-red-500/10"
                            : "border-neutral-200 focus:border-orange-500 focus:ring-orange-500/10"
                        }`}
                      />
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-500">
                        <AlertCircle size={12} strokeWidth={2.5} />
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <div className={`rounded-2xl border p-4 ${
                errors.agreed
                  ? "border-red-200 bg-red-50/60"
                  : "border-neutral-100 bg-white"
              }`}>
                <div className="flex items-start gap-3">
                  <label htmlFor="terms-agreement" className="relative mt-0.5 flex shrink-0 cursor-pointer">
                    <input
                      id="terms-agreement"
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => {
                        setAgreed(e.target.checked);
                        setErrors((previous) => ({ ...previous, agreed: "" }));
                      }}
                      className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-[1.5px] border-neutral-300 bg-neutral-50 transition checked:border-orange-500 checked:bg-orange-500 focus:outline-none focus:ring-[3px] focus:ring-orange-500/20"
                    />
                    <svg
                      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </label>

                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-6 text-neutral-600">
                      I agree to the{" "}
                      <button
                        type="button"
                        onClick={() => setPolicyModalSlug("terms")}
                        className="font-extrabold text-orange-500 underline decoration-orange-300 underline-offset-2 hover:text-orange-600"
                      >
                        Terms of Service
                      </button>{" "}
                      and{" "}
                      <button
                        type="button"
                        onClick={() => setPolicyModalSlug("privacy")}
                        className="font-extrabold text-orange-500 underline decoration-orange-300 underline-offset-2 hover:text-orange-600"
                      >
                        Privacy Policy
                      </button>
                      .
                    </p>
                    {errors.agreed && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-500">
                        <AlertCircle size={12} strokeWidth={2.5} />
                        {errors.agreed}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || loadingDzongkhags}
                className="flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-[15px] font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 hover:shadow-orange-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              >
                {submitting && (
                  <Loader2 size={18} strokeWidth={2.5} className="animate-spin" />
                )}
                {submitting ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <div className="mt-5 rounded-2xl bg-orange-50/70 px-4 py-3 text-center">
              <p className="text-sm font-medium text-neutral-600">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="font-extrabold text-orange-500 transition hover:text-orange-600"
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] font-medium text-neutral-400">
          <ShieldCheck size={13} strokeWidth={2} />
          Your information is protected
        </div>
      </div>
    </div>
  );
}
