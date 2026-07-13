import { useEffect, useMemo, useState } from 'react';
import {
  Apple,
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Globe2,
  Monitor,
  MoreVertical,
  Share2,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

const SHOP2BHUTAN_HOME_URL = 'https://shop2bhutan.vercel.app';
const SHOP2BHUTAN_DOWNLOAD_URL = `${SHOP2BHUTAN_HOME_URL}/download`;

// Recommended: add VITE_ANDROID_APK_URL in Vercel when the APK is hosted
// in Supabase Storage, GitHub Releases, or another permanent public location.
// Until then, place the signed APK at:
// public/downloads/Shop2Bhutan.apk
const ANDROID_APK_URL =
  String(import.meta.env.VITE_ANDROID_APK_URL ?? '').trim() ||
  '/downloads/Shop2Bhutan.apk';

const ANDROID_APP_VERSION =
  String(import.meta.env.VITE_ANDROID_APP_VERSION ?? '').trim() || 'Beta';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
};

type Platform = 'android' | 'ios' | 'desktop';

function getPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';

  const userAgent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
  if (/android/.test(userAgent)) return 'android';
  return 'desktop';
}

function isStandalonePwa() {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function isIosSafari() {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent.toLowerCase();
  return (
    /iphone|ipad|ipod/.test(userAgent) &&
    /safari/.test(userAgent) &&
    !/crios|fxios|edgios|chrome/.test(userAgent)
  );
}

function Step({
  number,
  title,
  description,
  icon: Icon,
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
        <Icon size={18} strokeWidth={2.2} />
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-950 px-1 text-[10px] font-black text-white ring-2 ring-white">
          {number}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-slate-950">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>
    </div>
  );
}

export default function DownloadApp() {
  const platform = useMemo(getPlatform, []);
  const iosSafari = useMemo(isIosSafari, []);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalonePwa);
  const [copied, setCopied] = useState(false);
  const [installHint, setInstallHint] = useState('');

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setInstallHint('Shop2Bhutan has been added to your Home Screen.');
    };

    window.addEventListener(
      'beforeinstallprompt',
      handleBeforeInstallPrompt,
    );
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      );
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const copyDownloadLink = async () => {
    try {
      await navigator.clipboard.writeText(SHOP2BHUTAN_DOWNLOAD_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch (error) {
      console.warn('[DownloadApp] Copy link failed:', error);
      setInstallHint(`Copy this link: ${SHOP2BHUTAN_DOWNLOAD_URL}`);
    }
  };

  const installWebApp = async () => {
    if (installed) {
      window.location.assign(SHOP2BHUTAN_HOME_URL);
      return;
    }

    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;

        if (choice.outcome === 'accepted') {
          setInstalled(true);
          setInstallHint('Shop2Bhutan has been added to your Home Screen.');
        }
      } finally {
        setInstallPrompt(null);
      }
      return;
    }

    if (platform === 'ios') {
      setInstallHint(
        iosSafari
          ? 'Tap the Share button, then select Add to Home Screen.'
          : 'Open this page in Safari, tap Share, then select Add to Home Screen.',
      );
      return;
    }

    setInstallHint(
      'Open your browser menu and choose Install app or Add to Home screen.',
    );
  };

  const showAndroid = platform === 'android';
  const showIos = platform === 'ios';

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.85rem)]">
          <a
            href={SHOP2BHUTAN_HOME_URL}
            className="flex min-w-0 items-center gap-3"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-orange-400 shadow-sm">
              S2B
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black tracking-tight text-slate-950">
                Shop2Bhutan
              </span>
              <span className="block text-[11px] font-semibold text-slate-400">
                Official app access
              </span>
            </span>
          </a>

          <a
            href={SHOP2BHUTAN_HOME_URL}
            className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 transition active:scale-[0.98]"
          >
            Open app
            <ExternalLink size={14} strokeWidth={2.2} />
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <section className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-orange-50 text-orange-600 ring-1 ring-orange-100">
            {showIos ? (
              <Apple size={31} strokeWidth={2.1} />
            ) : showAndroid ? (
              <Smartphone size={31} strokeWidth={2.1} />
            ) : (
              <Monitor size={31} strokeWidth={2.1} />
            )}
          </div>

          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">
            Shop2Bhutan Beta
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {showIos
              ? 'Install on your iPhone'
              : showAndroid
                ? 'Get Shop2Bhutan on Android'
                : 'Open Shop2Bhutan on your phone'}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
            Shop from Amazon, Flipkart, Myntra and Meesho and get your
            orders delivered to Bhutan.
          </p>
        </section>

        {showAndroid && (
          <section className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-orange-100 bg-orange-50/60 p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-sm ring-1 ring-orange-100">
                <Download size={21} strokeWidth={2.4} />
              </span>

              <h2 className="mt-4 text-lg font-black tracking-tight text-slate-950">
                Download Android APK
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Install the native Android beta before Shop2Bhutan is
                available on Google Play.
              </p>

              <a
                href={ANDROID_APK_URL}
                download
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 text-sm font-extrabold text-white transition active:scale-[0.98]"
              >
                <Download size={17} strokeWidth={2.4} />
                Download APK · {ANDROID_APP_VERSION}
              </a>

              <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-white px-3 py-3 text-xs leading-5 text-slate-500 ring-1 ring-orange-100">
                <ShieldCheck
                  size={17}
                  className="mt-0.5 shrink-0 text-emerald-600"
                  strokeWidth={2.3}
                />
                <span>
                  Android may ask you to allow installation from your
                  browser. Download only from this official page.
                </span>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Globe2 size={21} strokeWidth={2.3} />
              </span>

              <h2 className="mt-4 text-lg font-black tracking-tight text-slate-950">
                Install the web app
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Add Shop2Bhutan to your Home Screen without downloading
                the APK.
              </p>

              <button
                type="button"
                onClick={installWebApp}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-extrabold text-white transition active:scale-[0.98]"
              >
                {installed ? (
                  <Check size={17} strokeWidth={2.5} />
                ) : (
                  <Smartphone size={17} strokeWidth={2.3} />
                )}
                {installed
                  ? 'Open installed app'
                  : installPrompt
                    ? 'Install Web App'
                    : 'Show installation help'}
              </button>

              <p className="mt-4 text-xs leading-5 text-slate-400">
                The web app works on Android, receives supported web
                notifications, and updates automatically.
              </p>
            </div>
          </section>
        )}

        {showIos && (
          <section className="mt-7 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Apple size={23} strokeWidth={2.1} />
              </span>
              <div>
                <h2 className="text-lg font-black tracking-tight text-slate-950">
                  Add Shop2Bhutan to Home Screen
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  The native iPhone version is still being prepared. Use
                  the installable web app now.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <Step
                number={1}
                title="Open this page in Safari"
                description={
                  iosSafari
                    ? 'You are already using Safari.'
                    : 'Copy this link and open it using the Safari browser.'
                }
                icon={Globe2}
              />
              <Step
                number={2}
                title="Tap the Share button"
                description="Use the Share icon in Safari’s toolbar."
                icon={Share2}
              />
              <Step
                number={3}
                title="Choose Add to Home Screen"
                description="Scroll through the Safari share options when necessary."
                icon={Smartphone}
              />
              <Step
                number={4}
                title="Tap Add"
                description="Shop2Bhutan will appear on your iPhone like an app."
                icon={Check}
              />
            </div>

            <button
              type="button"
              onClick={installWebApp}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-extrabold text-white transition active:scale-[0.98]"
            >
              <Share2 size={17} strokeWidth={2.3} />
              Show installation reminder
            </button>
          </section>
        )}

        {!showAndroid && !showIos && (
          <section className="mt-7 grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Smartphone size={21} strokeWidth={2.3} />
              </span>
              <h2 className="mt-4 text-xl font-black tracking-tight text-slate-950">
                Continue on your phone
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Scan the QR code using your phone. Android users can
                download the APK, while iPhone users will see the Home
                Screen installation guide.
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <a
                  href={SHOP2BHUTAN_HOME_URL}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-extrabold text-white transition active:scale-[0.98]"
                >
                  Open Shop2Bhutan
                  <ChevronRight size={16} strokeWidth={2.3} />
                </a>
                <button
                  type="button"
                  onClick={copyDownloadLink}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 transition active:scale-[0.98]"
                >
                  {copied ? (
                    <Check size={16} strokeWidth={2.4} />
                  ) : (
                    <Copy size={16} strokeWidth={2.2} />
                  )}
                  {copied ? 'Link copied' : 'Copy download link'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center rounded-[26px] border border-slate-200 bg-slate-50 p-5">
              <div className="rounded-[22px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
                <img
                  src="/shop2bhutan-download-qr.png"
                  alt="QR code for the Shop2Bhutan download page"
                  className="h-44 w-44"
                />
              </div>
            </div>
          </section>
        )}

        {installHint && (
          <div
            role="status"
            className="mt-5 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800"
          >
            <MoreVertical
              size={18}
              className="mt-1 shrink-0"
              strokeWidth={2.3}
            />
            <span>{installHint}</span>
          </div>
        )}

        {(showAndroid || showIos) && (
          <button
            type="button"
            onClick={copyDownloadLink}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 transition active:scale-[0.98]"
          >
            {copied ? (
              <Check size={16} strokeWidth={2.4} />
            ) : (
              <Copy size={16} strokeWidth={2.2} />
            )}
            {copied ? 'Download link copied' : 'Copy this download link'}
          </button>
        )}

        <section className="mt-7 rounded-[24px] bg-slate-950 p-5 text-white sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-orange-400">
              <ShieldCheck size={21} strokeWidth={2.3} />
            </span>
            <div>
              <h2 className="text-base font-black tracking-tight">
                Official Shop2Bhutan access
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Shop2Bhutan is currently in beta and has not yet launched
                publicly on Google Play or the Apple App Store. Always use
                this official page for installation links and instructions.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 px-4 py-6 text-center text-xs leading-5 text-slate-400">
        © {new Date().getFullYear()} Shop2Bhutan · Shopping assistance and
        delivery to Bhutan
      </footer>
    </div>
  );
}
