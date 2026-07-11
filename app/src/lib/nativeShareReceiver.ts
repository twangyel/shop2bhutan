import { Capacitor, registerPlugin } from '@capacitor/core';

export type PendingNativeShare = {
  url: string;
  title: string;
  receivedAt: number;
};

type ShareReceiverPlugin = {
  getPendingShare: () => Promise<PendingNativeShare>;
};

const ShareReceiver =
  registerPlugin<ShareReceiverPlugin>('ShareReceiver');

export async function consumePendingNativeShare() {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const result = await ShareReceiver.getPendingShare();
    const url = String(result?.url ?? '').trim();

    if (!/^https?:\/\//i.test(url)) return null;

    return {
      url,
      title: String(result?.title ?? '').trim(),
      receivedAt: Number(result?.receivedAt ?? 0),
    } satisfies PendingNativeShare;
  } catch (error) {
    console.warn(
      '[Shop2Bhutan] Native share receiver unavailable:',
      error,
    );

    return null;
  }
}
