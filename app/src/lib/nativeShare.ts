import { Share } from '@capacitor/share';

export type ShareTextResult = 'shared' | 'copied' | 'cancelled';

type ShareTextOptions = {
  title: string;
  text: string;
  dialogTitle?: string;
};

export function isShareCancellation(error: unknown) {
  const value = error as {
    code?: string;
    message?: string;
  } | null;

  const code = String(value?.code ?? '').trim().toLowerCase();
  const message = String(value?.message ?? '').trim().toLowerCase();

  return (
    code.includes('cancel') ||
    message.includes('cancel') ||
    message.includes('dismiss')
  );
}

async function copyTextFallback(text: string) {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Sharing is unavailable on this device.');
  }

  await navigator.clipboard.writeText(text);
}

export async function shareTextContent({
  title,
  text,
  dialogTitle,
}: ShareTextOptions): Promise<ShareTextResult> {
  try {
    const availability = await Share.canShare();

    if (availability.value) {
      await Share.share({
        title,
        text,
        dialogTitle: dialogTitle || title,
      });

      return 'shared';
    }
  } catch (error) {
    if (isShareCancellation(error)) return 'cancelled';

    console.warn('[Share] Native share unavailable, using copy fallback:', error);
  }

  await copyTextFallback(text);
  return 'copied';
}
