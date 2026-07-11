import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
  ShoppingAssistCapture,
  ShoppingAssistStore,
} from '@/types';

type OpenShoppingAssistInput = {
  store: ShoppingAssistStore;
  url?: string;
};

type OpenShoppingAssistResult = {
  opened: boolean;
  store: ShoppingAssistStore;
  url: string;
};

type PendingCaptureResult = {
  available: boolean;
  capture?: Partial<ShoppingAssistCapture>;
};

type ShoppingAssistNativePlugin = {
  open: (
    input: OpenShoppingAssistInput,
  ) => Promise<OpenShoppingAssistResult>;

  getPendingCapture: () => Promise<PendingCaptureResult>;

  isAvailable: () => Promise<{
    available: boolean;
    stores: ShoppingAssistStore[];
  }>;
};

const ShoppingAssist =
  registerPlugin<ShoppingAssistNativePlugin>(
    'ShoppingAssist',
  );

export const SHOPPING_ASSIST_CAPTURE_STORAGE_KEY =
  'shop2bhutan:shopping-assist-capture:v1';

export const SHOPPING_ASSIST_STORES: Array<{
  key: ShoppingAssistStore;
  name: string;
  url: string;
  logo: string;
}> = [
  {
    key: 'amazon',
    name: 'Amazon',
    url: 'https://www.amazon.in/',
    logo: '/store-logos/amazon.png',
  },
  {
    key: 'flipkart',
    name: 'Flipkart',
    url: 'https://www.flipkart.com/',
    logo: '/store-logos/flipkart.png',
  },
  {
    key: 'myntra',
    name: 'Myntra',
    url: 'https://www.myntra.com/',
    logo: '/store-logos/myntra.png',
  },
  {
    key: 'meesho',
    name: 'Meesho',
    url: 'https://www.meesho.com/',
    logo: '/store-logos/meesho.png',
  },
];

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeStore(
  value: unknown,
): ShoppingAssistStore | null {
  const store = cleanText(value).toLowerCase();

  if (
    store === 'amazon' ||
    store === 'flipkart' ||
    store === 'myntra' ||
    store === 'meesho'
  ) {
    return store;
  }

  return null;
}

function normalizeCapture(
  value: Partial<ShoppingAssistCapture> | null | undefined,
): ShoppingAssistCapture | null {
  if (!value || typeof value !== 'object') return null;

  const sourceUrl = cleanText(value.sourceUrl);
  const store = normalizeStore(value.store);

  if (!/^https:\/\//i.test(sourceUrl) || !store) {
    return null;
  }

  const displayedPrice = Number(value.displayedPrice);
  const confidence = Number(value.confidence);
  const capturedAt = Number(value.capturedAt);

  return {
    sourceUrl,
    canonicalUrl:
      cleanText(value.canonicalUrl) || sourceUrl,
    store,
    title: cleanText(value.title),
    image: /^https:\/\//i.test(cleanText(value.image))
      ? cleanText(value.image)
      : '',
    displayedPrice:
      Number.isFinite(displayedPrice) &&
      displayedPrice > 0
        ? displayedPrice
        : 0,
    currency: 'INR',
    variant: cleanText(value.variant),
    captureMethod:
      value.captureMethod === 'json_ld' ||
      value.captureMethod === 'store_selector' ||
      value.captureMethod === 'open_graph' ||
      value.captureMethod === 'visible_page' ||
      value.captureMethod === 'page_fallback'
        ? value.captureMethod
        : 'page_fallback',
    confidence:
      Number.isFinite(confidence)
        ? Math.max(0, Math.min(100, confidence))
        : 0,
    capturedAt:
      Number.isFinite(capturedAt) && capturedAt > 0
        ? capturedAt
        : Date.now(),
  };
}

export function saveShoppingAssistCapture(
  capture: ShoppingAssistCapture,
) {
  try {
    window.sessionStorage.setItem(
      SHOPPING_ASSIST_CAPTURE_STORAGE_KEY,
      JSON.stringify(capture),
    );
  } catch {
    // Session storage can be unavailable in privacy modes.
  }
}

export function readShoppingAssistCapture() {
  try {
    const raw = window.sessionStorage.getItem(
      SHOPPING_ASSIST_CAPTURE_STORAGE_KEY,
    );

    if (!raw) return null;

    return normalizeCapture(
      JSON.parse(raw) as Partial<ShoppingAssistCapture>,
    );
  } catch {
    return null;
  }
}

export function clearShoppingAssistCapture() {
  try {
    window.sessionStorage.removeItem(
      SHOPPING_ASSIST_CAPTURE_STORAGE_KEY,
    );
  } catch {
    // Ignore storage failures.
  }
}

export async function openShoppingAssist(
  input: OpenShoppingAssistInput,
) {
  const storeDefinition =
    SHOPPING_ASSIST_STORES.find(
      (item) => item.key === input.store,
    );

  if (!storeDefinition) return false;

  const url = cleanText(input.url) || storeDefinition.url;

  if (!Capacitor.isNativePlatform()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }

  try {
    const result = await ShoppingAssist.open({
      store: input.store,
      url,
    });

    return Boolean(result.opened);
  } catch (error) {
    console.warn(
      '[S2B Shopping Assist] Native browser unavailable:',
      error,
    );

    return false;
  }
}

export async function consumePendingShoppingAssistCapture() {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const result =
      await ShoppingAssist.getPendingCapture();

    if (!result.available) return null;

    const capture = normalizeCapture(result.capture);

    if (capture) {
      saveShoppingAssistCapture(capture);
    }

    return capture;
  } catch (error) {
    console.warn(
      '[S2B Shopping Assist] Capture could not be consumed:',
      error,
    );

    return null;
  }
}
