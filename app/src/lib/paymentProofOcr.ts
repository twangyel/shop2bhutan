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

const PAYMENT_PROOF_REGIONS: Record<PaymentSourceBank, PaymentProofRegion> = {
  // mBoB places the useful receipt data in the lower blue panel.
  bob: {
    x: 0.02,
    y: 0.50,
    width: 0.96,
    height: 0.49,
    invert: true,
    threshold: 188,
  },
  // DK Bank keeps amount/reference and beneficiary data in the central receipt.
  dk: {
    x: 0.02,
    y: 0.14,
    width: 0.96,
    height: 0.62,
    invert: false,
    threshold: 185,
  },
  // BNB uses white text on a dark receipt background.
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

async function preparePaymentProofImage(
  file: File,
  bank: PaymentSourceBank,
): Promise<Blob> {
  const image = await loadImage(file);
  const region = PAYMENT_PROOF_REGIONS[bank];

  const sourceX = Math.round(image.naturalWidth * region.x);
  const sourceY = Math.round(image.naturalHeight * region.y);
  const sourceWidth = Math.max(
    1,
    Math.round(image.naturalWidth * region.width),
  );
  const sourceHeight = Math.max(
    1,
    Math.round(image.naturalHeight * region.height),
  );

  // Tesseract performs more reliably when receipt text is reasonably large.
  const targetWidth = Math.min(
    1800,
    Math.max(1200, Math.round(sourceWidth * 1.7)),
  );
  const scale = targetWidth / sourceWidth;
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d', {
    willReadFrequently: true,
  });

  if (!context) {
    throw new Error('Payment screenshot processing is unavailable.');
  }

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
    const luminance =
      red * 0.299 + green * 0.587 + blue * 0.114;

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

function referenceLabels(bank: PaymentSourceBank) {
  if (bank === 'bob') {
    return [
      /(?:JRN[IL1]?|JOURNAL)\s*\.?\s*(?:NO|NUMBER)?/i,
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
  // The supported BoB/DK/BNB references are numeric. OCR commonly confuses
  // 0/O and 1/I/L, so accept those characters only inside digit-heavy runs.
  const candidates =
    value.match(/[0-9OIL][0-9OIL\- ]{6,30}[0-9OIL]/gi) ?? [];

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
      if (candidate.normalized.length < 8 || candidate.normalized.length > 24) {
        return false;
      }

      if (!/^\d{8,24}$/.test(candidate.normalized)) return false;

      return true;
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

  if (params.bank === 'bob' && /^\d{2,5}-?\d{6,14}$/.test(params.display)) {
    score += 14;
  }

  if (
    (params.bank === 'dk' || params.bank === 'bnb') &&
    /^\d{10,16}$/.test(params.normalized)
  ) {
    score += 14;
  }

  return score;
}

function extractReference(
  text: string,
  bank: PaymentSourceBank,
) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const labels = referenceLabels(bank);
  const scored: Array<{
    display: string;
    normalized: string;
    score: number;
  }> = [];

  lines.forEach((line, index) => {
    const labelFound = labels.some((label) => label.test(line));

    if (!labelFound) return;

    const nearbyLines = [
      line,
      lines[index + 1] ?? '',
      lines[index + 2] ?? '',
    ];

    nearbyLines.forEach((nearbyLine, nearbyIndex) => {
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
    });
  });

  if (scored.length === 0) {
    // Layout OCR occasionally loses the label but preserves a standalone
    // 10–16 digit RRNO/journal candidate. Keep this as a lower-confidence
    // fallback rather than forcing the customer to type it.
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
    return {
      reference: '',
      normalizedReference: '',
      confidence: 0,
    };
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

  if (!Number.isFinite(number) || number <= 0 || number > 10_000_000) {
    return null;
  }

  return Math.round(number * 100) / 100;
}

function extractAmount(text: string, expectedAmount: number) {
  const candidates: Array<{
    amount: number;
    score: number;
  }> = [];

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
    // Lower-confidence fallback for layouts where the currency label was
    // missed but the amount retained its decimal places.
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

  if (!best || best.score < 24) {
    return {
      amount: null,
      confidence: 0,
    };
  }

  return {
    amount: best.amount,
    confidence: Math.min(100, best.score),
  };
}

export function parsePaymentProofOcrText(params: {
  text: string;
  bank: PaymentSourceBank;
  expectedAmount: number;
  engineConfidence?: number;
}): PaymentProofOcrResult {
  const text = cleanOcrText(params.text);
  const reference = extractReference(text, params.bank);
  const amount = extractAmount(text, params.expectedAmount);
  const fieldsDetected =
    Number(Boolean(reference.normalizedReference)) +
    Number(amount.amount !== null);

  const status: PaymentProofOcrResult['status'] =
    fieldsDetected === 2
      ? 'detected'
      : fieldsDetected === 1
        ? 'partial'
        : 'not_detected';

  const fieldConfidence =
    fieldsDetected === 2
      ? (reference.confidence + amount.confidence) / 2
      : Math.max(reference.confidence, amount.confidence);
  const engineConfidence = Math.max(
    0,
    Math.min(100, Number(params.engineConfidence) || 0),
  );

  return {
    reference: reference.reference,
    normalizedReference: reference.normalizedReference,
    amount: amount.amount,
    status,
    confidence: Math.round(
      fieldConfidence > 0
        ? fieldConfidence * 0.75 + engineConfidence * 0.25
        : engineConfidence * 0.25,
    ),
    referenceConfidence: reference.confidence,
    amountConfidence: amount.confidence,
  };
}

export async function readPaymentProofScreenshot(params: {
  file: File;
  bank: PaymentSourceBank;
  expectedAmount: number;
  onProgress?: (progress: PaymentProofOcrProgress) => void;
}): Promise<PaymentProofOcrResult> {
  const processedImage = await preparePaymentProofImage(
    params.file,
    params.bank,
  );
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
          progress: Math.max(
            0,
            Math.min(1, Number(message.progress) || 0),
          ),
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
      bank: params.bank,
      expectedAmount: params.expectedAmount,
      engineConfidence: result.data.confidence,
    });
  } finally {
    await worker.terminate();
  }
}
