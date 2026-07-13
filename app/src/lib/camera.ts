import { App as CapacitorApp } from '@capacitor/app';
import {
  Camera,
  CameraResultType,
  CameraSource,
  type Photo,
} from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const PENDING_CAMERA_PURPOSE_KEY =
  'shop2bhutan:camera:pending-purpose:v1';
const RESTORED_CAMERA_RESULT_KEY =
  'shop2bhutan:camera:restored-result:v1';

export const NATIVE_CAMERA_RESTORED_EVENT =
  'shop2bhutan:native-camera-restored';

export type NativeImagePurpose =
  | 'product-screenshot'
  | 'payment-proof'
  | 'parcel-photo'
  | 'profile-avatar';

type StoredCameraResult = {
  purpose: NativeImagePurpose;
  photo: Photo;
};

type NativeImagePickerOptions = {
  purpose: NativeImagePurpose;
  fileNamePrefix: string;
  quality?: number;
  width?: number;
  height?: number;
};

let restoredListenerInstalled = false;

function extensionFromMimeType(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic') return 'heic';
  if (mimeType === 'image/heif') return 'heif';
  return 'jpg';
}

function mimeTypeFromFormat(format?: string) {
  const normalized = String(format ?? '').trim().toLowerCase();

  if (normalized === 'png') return 'image/png';
  if (normalized === 'webp') return 'image/webp';
  if (normalized === 'heic') return 'image/heic';
  if (normalized === 'heif') return 'image/heif';
  return 'image/jpeg';
}

async function photoToFile(photo: Photo, fileNamePrefix: string) {
  const sourcePath =
    photo.webPath ||
    (photo.path ? Capacitor.convertFileSrc(photo.path) : '');

  if (!sourcePath) {
    throw new Error('The selected image could not be read.');
  }

  const response = await fetch(sourcePath);

  if (!response.ok) {
    throw new Error('The selected image could not be opened.');
  }

  const blob = await response.blob();
  const mimeType = blob.type || mimeTypeFromFormat(photo.format);
  const extension =
    String(photo.format ?? '').trim().toLowerCase() ||
    extensionFromMimeType(mimeType);

  return new File(
    [blob],
    `${fileNamePrefix}-${Date.now()}.${extension}`,
    {
      type: mimeType,
      lastModified: Date.now(),
    },
  );
}

async function installRestoredCameraListener() {
  if (
    restoredListenerInstalled ||
    !Capacitor.isNativePlatform() ||
    typeof window === 'undefined'
  ) {
    return;
  }

  restoredListenerInstalled = true;

  await CapacitorApp.addListener(
    'appRestoredResult',
    async (event) => {
      if (
        event.pluginId !== 'Camera' ||
        event.methodName !== 'getPhoto'
      ) {
        return;
      }

      const {
        value: pendingPurpose,
      } = await Preferences.get({
        key: PENDING_CAMERA_PURPOSE_KEY,
      });

      await Preferences.remove({
        key: PENDING_CAMERA_PURPOSE_KEY,
      });

      if (!event.success || !pendingPurpose || !event.data) {
        return;
      }

      const restored: StoredCameraResult = {
        purpose: pendingPurpose as NativeImagePurpose,
        photo: event.data as Photo,
      };

      await Preferences.set({
        key: RESTORED_CAMERA_RESULT_KEY,
        value: JSON.stringify(restored),
      });

      window.dispatchEvent(
        new CustomEvent(NATIVE_CAMERA_RESTORED_EVENT, {
          detail: { purpose: restored.purpose },
        }),
      );
    },
  );
}

if (typeof window !== 'undefined') {
  void installRestoredCameraListener();
}

export function isNativeCameraRuntime() {
  return Capacitor.isNativePlatform();
}

export function isCameraCancellation(error: unknown) {
  const value = error as {
    code?: string;
    message?: string;
  } | null;

  const code = String(value?.code ?? '').toUpperCase();
  const message = String(value?.message ?? '')
    .trim()
    .toLowerCase();

  return (
    code === 'OS-PLUG-CAMR-0006' ||
    code === 'OS-PLUG-CAMR-0020' ||
    message.includes('cancel')
  );
}

export async function pickNativeImageFile({
  purpose,
  fileNamePrefix,
  quality = 85,
  width = 1800,
  height = 1800,
}: NativeImagePickerOptions) {
  if (!isNativeCameraRuntime()) return null;

  await Preferences.set({
    key: PENDING_CAMERA_PURPOSE_KEY,
    value: purpose,
  });

  try {
    const photo = await Camera.getPhoto({
      quality,
      width,
      height,
      allowEditing: false,
      correctOrientation: true,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      saveToGallery: false,
      promptLabelHeader: 'Add photo',
      promptLabelPicture: 'Take Photo',
      promptLabelPhoto: 'Choose from Gallery',
      promptLabelCancel: 'Cancel',
    });

    await Preferences.remove({
      key: PENDING_CAMERA_PURPOSE_KEY,
    });

    return await photoToFile(photo, fileNamePrefix);
  } catch (error) {
    await Preferences.remove({
      key: PENDING_CAMERA_PURPOSE_KEY,
    });
    throw error;
  }
}

export async function consumeRestoredCameraFile(
  purpose: NativeImagePurpose,
  fileNamePrefix: string,
) {
  if (!isNativeCameraRuntime()) return null;

  const { value } = await Preferences.get({
    key: RESTORED_CAMERA_RESULT_KEY,
  });

  if (!value) return null;

  let restored: StoredCameraResult | null = null;

  try {
    restored = JSON.parse(value) as StoredCameraResult;
  } catch {
    await Preferences.remove({
      key: RESTORED_CAMERA_RESULT_KEY,
    });
    return null;
  }

  if (restored.purpose !== purpose) return null;

  await Preferences.remove({
    key: RESTORED_CAMERA_RESULT_KEY,
  });

  return photoToFile(restored.photo, fileNamePrefix);
}
