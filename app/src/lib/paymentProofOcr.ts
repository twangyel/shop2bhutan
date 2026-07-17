import type { PaymentSourceBank } from '@/lib/customerOrders';

export type PaymentProofOcrStatus =
  | 'not_attempted'
  | 'reading'
  | 'detected'
  | 'partial'
  | 'not_detected'
  | 'failed';

export type PaymentReferenceDetectionSource = 'ocr' | 'manual' | 'none';

export type PaymentProofOcrProgress = {
  status: string;
  progress: number;
};

export type PaymentProofOcrResult = {
  bank: PaymentSourceBank | '';
  bankConfidence: number;
  reference: string;
  normalizedReference: string;
  amount: number | null;
  status: Exclude<PaymentProofOcrStatus, 'not_attempted' | 'reading'>;
  confidence: number;
  referenceConfidence: number;
  amountConfidence: number;
};

type PaymentProofRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  invert: boolean;
  threshold: number;
};

type DetectedBank = {
  bank: PaymentSourceBank;
  confidence: number;
};

const PAYMENT_PROOF_REGIONS: Record<PaymentSourceBank, PaymentProofRegion> = {
  bob: {
    x: 0.02,
    y: 0.50,
    width: 0.96,
    height: 0.49,
    invert: true,
    threshold: 188,
  },
  dk: {
    x: 0.02,
    y: 0.14,
    width: 0.96,
    height: 0.62,
    invert: false,
    threshold: 185,
  },
  bnb: {
    x: 0.02,
    y: 0.26,
    width: 0.96,
    height: 0.65,
    invert: true,
    threshold: 165,
  },
};

function normalizeReference(value: unknown) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to prepare the payment screenshot for reading.'));
    };

    image.src = objectUrl;
  });
}

async function detectPaymentSourceBank(file: File): Promise<DetectedBank> {
  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return { bank: 'dk', confidence: 50 };

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const totalPixels = Math.max(1, pixels.length / 4);
  let darkPixels = 0;
  let strongCyanPixels = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;

    if (luminance < 85) darkPixels += 1;

    const channelSpread = Math.max(red, green, blue) - Math.min(red, green, blue);
    if (
      blue - red > 55 &&
      green - red > 35 &&
      blue > 145 &&
      channelSpread > 70
    ) {
      strongCyanPixels += 1;
    }
  }

  const darkRatio = darkPixels / totalPixels;
  const cyanRatio = strongCyanPixels / totalPixels;

  if (darkRatio >= 0.28) {
    return {
      bank: 'bnb',
      confidence: Math.min(99, Math.round(78 + darkRatio * 24)),
    };
  }

  if (cyanRatio >= 0.15) {
    return {
      bank: 'bob',
      confidence: Math.min(98, Math.round(72 + cyanRatio * 50)),
    };
  }

  return {
    bank: 'dk',
    confidence: Math.min(92, Math.max(60, Math.round(84 - cyanRatio * 45))),
  };
}

async function preparePaymentProofImage(
  file: File,
  bank: PaymentSourceBank,
): Promise<Blob> {
  const image = await loadImage(file);
  const region = PAYMENT_PROOF_REGIONS[bank];

  const sourceX = Math.round(image.naturalWidth * region.x);
  const sourceY = Math.round(image.naturalHeight * region.y);
  const sourceWidth = Math.max(1, Math.round(image.naturalWidth * region.width));
  const sourceHeight = Math.max(1, Math.round(image.naturalHeight * region.height));
  const targetWidth = Math.min(1800, Math.max(1200, Math.round(sourceWidth * 1.7)));
  const scale = targetWidth / sourceWidth;
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Payment screenshot processing is unavailable.');

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  const imageData = context.getImageData(0, 0, targetWidth, targetHeight);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    const darkText = region.invert
      ? luminance >= region.threshold
      : luminance < region.threshold;
    const value = darkText ? 0 : 255;

    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
    pixels[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Unable to prepare the payment screenshot.'));
      },
      'image/png',
      0.96,
    );
  });
}

function cleanOcrText(value: string) {
  return value
    .replace(/\r/g, '\n')
    .replace(/[|]/g, 'I')
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function detectBankFromOcrText(
  text: string,
  visualBank: DetectedBank,
): DetectedBank {
  const normalized = cleanOcrText(text).toUpperCase();

  if (
    /\bM\s*BOB\b/.test(normalized) ||
    /\bJR[NM][LI1]?\.?\s*(?:NO|NUMBER)?\b/.test(normalized) ||
    /\bJOURNAL\s*(?:NO|NUMBER)?\b/.test(normalized) ||
    /FUND\s+TRANSFER\s+TO\s+BOB/.test(normalized)
  ) {
    return { bank: 'bob', confidence: Math.max(visualBank.confidence, 94) };
  }

  if (/\bRR\s*NO\b|\bRRNO\b|FUND\s+TRANSFER\s+(?:NO|NUMBER)/.test(normalized)) {
    if (visualBank.bank === 'bnb') {
      return { bank: 'bnb', confidence: Math.max(visualBank.confidence, 92) };
    }

    return { bank: 'dk', confidence: Math.max(visualBank.confidence, 88) };
  }

  return visualBank;
}

function referenceLabels(bank: PaymentSourceBank) {
  if (bank === 'bob') {
    return [
      /(?:JRN[IL1]?|JRNL|JOURNAL)\s*\.?\s*(?:NO|NUMBER)?/i,
      /JRN[IL1]?\s*NO/i,
    ];
  }

  return [
    /RR\s*NO/i,
    /RRNO/i,
    /FUND\s*TRANSFER\s*(?:NO|NUMBER)/i,
    /TRANSFER\s*(?:NO|NUMBER)/i,
  ];
}

function referenceCandidates(value: string) {
  const candidates = value.match(/[0-9OIL][0-9OIL\- ]{6,30}[0-9OIL]/gi) ?? [];

  return candidates
    .map((candidate) => {
      const display = candidate
        .trim()
        .replace(/\s+/g, '')
        .replace(/O/gi, '0')
        .replace(/[IL]/gi, '1');

      return {
        display,
        normalized: normalizeReference(display),
      };
    })
    .filter((candidate) => {
      if (candidate.normalized.length < 8 || candidate.normalized.length > 24) return false;
      return /^\d{8,24}$/.test(candidate.normalized);
    });
}

function scoreReferenceCandidate(params: {
  display: string;
  normalized: string;
  bank: PaymentSourceBank;
  sameLine: boolean;
  nearLabel: boolean;
}) {
  let score = 0;

  if (params.sameLine) score += 60;
  else if (params.nearLabel) score += 42;

  if (/^\d{10,16}$/.test(params.normalized)) score += 34;
  else if (/^\d{8,20}$/.test(params.normalized)) score += 24;

  if (params.bank === 'bob' && /^\d{2,5}-?\d{6,14}$/.test(params.display)) score += 14;

  if (
    (params.bank === 'dk' || params.bank === 'bnb') &&
    /^\d{10,16}$/.test(params.normalized)
  ) {
    score += 14;
  }

  return score;
}

function extractReference(text: string, bank: PaymentSourceBank) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const labels = referenceLabels(bank);
  const scored: Array<{ display: string; normalized: string; score: number }> = [];

  lines.forEach((line, index) => {
    const labelFound = labels.some((label) => label.test(line));
    if (!labelFound) return;

    [line, lines[index + 1] ?? '', lines[index + 2] ?? ''].forEach(
      (nearbyLine, nearbyIndex) => {
        referenceCandidates(nearbyLine).forEach((candidate) => {
          scored.push({
            ...candidate,
            score: scoreReferenceCandidate({
              ...candidate,
              bank,
              sameLine: nearbyIndex === 0,
              nearLabel: true,
            }),
          });
        });
      },
    );
  });

  if (scored.length === 0) {
    lines.forEach((line) => {
      referenceCandidates(line).forEach((candidate) => {
        scored.push({
          ...candidate,
          score: scoreReferenceCandidate({
            ...candidate,
            bank,
            sameLine: false,
            nearLabel: false,
          }),
        });
      });
    });
  }

  scored.sort((left, right) => right.score - left.score);
  const best = scored[0];

  if (!best || best.score < 24) {
    return { reference: '', normalizedReference: '', confidence: 0 };
  }

  return {
    reference: best.display,
    normalizedReference: best.normalized,
    confidence: Math.min(100, best.score),
  };
}

function parseAmount(value: string) {
  const normalized = value.replace(/,/g, '').trim();
  const number = Number(normalized);

  if (!Number.isFinite(number) || number <= 0 || number > 10_000_000) return null;
  return Math.round(number * 100) / 100;
}

function extractAmount(text: string, expectedAmount: number) {
  const candidates: Array<{ amount: number; score: number }> = [];
  const labelledPatterns = [
    /(?:AMOUNT|TRANSFER\s*AMOUNT)[^0-9]{0,20}(?:NU\.?|BTN)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi,
    /(?:NU\.?|BTN)\s*[:.]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi,
  ];

  labelledPatterns.forEach((pattern) => {
    for (const match of text.matchAll(pattern)) {
      const amount = parseAmount(match[1]);
      if (amount === null) continue;

      let score = 65;
      if (expectedAmount > 0) {
        const difference = Math.abs(amount - expectedAmount);
        if (difference < 0.01) score += 30;
        else if (difference <= 1) score += 18;
        else if (difference <= Math.max(5, expectedAmount * 0.03)) score += 8;
      }

      candidates.push({ amount, score });
    }
  });

  if (candidates.length === 0) {
    for (const match of text.matchAll(/\b([0-9]{1,7}(?:\.[0-9]{1,2}))\b/g)) {
      const amount = parseAmount(match[1]);
      if (amount === null) continue;

      let score = 24;
      if (expectedAmount > 0) {
        const difference = Math.abs(amount - expectedAmount);
        if (difference < 0.01) score += 34;
        else if (difference <= 1) score += 18;
      }

      candidates.push({ amount, score });
    }
  }

  candidates.sort((left, right) => right.score - left.score);
  const best = candidates[0];

  if (!best || best.score < 24) return { amount: null, confidence: 0 };
  return { amount: best.amount, confidence: Math.min(100, best.score) };
}

export function parsePaymentProofOcrText(params: {
  text: string;
  bank?: PaymentSourceBank;
  bankConfidence?: number;
  expectedAmount: number;
  engineConfidence?: number;
}): PaymentProofOcrResult {
  const text = cleanOcrText(params.text);
  const visualBank: DetectedBank = {
    bank: params.bank ?? 'dk',
    confidence: Math.max(0, Math.min(100, Number(params.bankConfidence) || 0)),
  };
  const detectedBank = detectBankFromOcrText(text, visualBank);
  const reference = extractReference(text, detectedBank.bank);
  const amount = extractAmount(text, params.expectedAmount);
  const fieldsDetected =
    Number(Boolean(reference.normalizedReference)) + Number(amount.amount !== null);
  const status: PaymentProofOcrResult['status'] =
    fieldsDetected === 2 ? 'detected' : fieldsDetected === 1 ? 'partial' : 'not_detected';
  const fieldConfidence =
    fieldsDetected === 2
      ? (reference.confidence + amount.confidence) / 2
      : Math.max(reference.confidence, amount.confidence);
  const engineConfidence = Math.max(
    0,
    Math.min(100, Number(params.engineConfidence) || 0),
  );

  return {
    bank: detectedBank.bank,
    bankConfidence: detectedBank.confidence,
    reference: reference.reference,
    normalizedReference: reference.normalizedReference,
    amount: amount.amount,
    status,
    confidence: Math.round(
      fieldConfidence > 0
        ? fieldConfidence * 0.7 + engineConfidence * 0.2 + detectedBank.confidence * 0.1
        : engineConfidence * 0.2 + detectedBank.confidence * 0.1,
    ),
    referenceConfidence: reference.confidence,
    amountConfidence: amount.confidence,
  };
}

export async function readPaymentProofScreenshot(params: {
  file: File;
  expectedAmount: number;
  onProgress?: (progress: PaymentProofOcrProgress) => void;
}): Promise<PaymentProofOcrResult> {
  params.onProgress?.({ status: 'detecting bank', progress: 0.04 });
  const visualBank = await detectPaymentSourceBank(params.file);
  const processedImage = await preparePaymentProofImage(params.file, visualBank.bank);
  const { createWorker, PSM } = await import('tesseract.js');

  const worker = await createWorker('eng', 1, {
    logger(message) {
      if (
        message.status === 'recognizing text' ||
        message.status === 'loading tesseract core' ||
        message.status === 'loading language traineddata' ||
        message.status === 'initializing tesseract'
      ) {
        params.onProgress?.({
          status: message.status,
          progress: Math.max(0.05, Math.min(1, Number(message.progress) || 0)),
        });
      }
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    });

    const result = await worker.recognize(processedImage);
    return parsePaymentProofOcrText({
      text: result.data.text || '',
      bank: visualBank.bank,
      bankConfidence: visualBank.confidence,
      expectedAmount: params.expectedAmount,
      engineConfidence: result.data.confidence,
    });
  } finally {
    await worker.terminate();
  }
}
