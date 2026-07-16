import { Capacitor } from '@capacitor/core';
import {
  Directory,
  Filesystem,
} from '@capacitor/filesystem';
import { FileViewer } from '@capacitor/file-viewer';

export type PaymentReceiptData = {
  paymentId: string;
  orderId?: string;
  orderNumber: string;
  transactionId?: string;
  amountLabel: string;
  orderTotalLabel?: string;
  previouslyPaidLabel?: string;
  balanceDueLabel?: string;
  paymentType: string;
  paymentMethod: string;
  submittedAt: string;
  verifiedAt: string;
  status: string;
  customerName?: string;
  customerPhone?: string;
  logoPath?: string;
  appUrl?: string;
  verificationUrl?: string;
};

export type PaymentReceiptResult = {
  mode: 'opened' | 'saved' | 'downloaded';
  fileName: string;
};

type PdfImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

type PdfObject = {
  dictionary?: string;
  stream?: Uint8Array;
  body?: string;
};

const RECEIPT_DIRECTORY = 'Shop2Bhutan/Receipts';
const DEFAULT_LOGO_PATH = '/brand/logo-full-final.png';
const DEFAULT_APP_URL = 'https://shop2bhutan.vercel.app';
const textEncoder = new TextEncoder();

function asciiText(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeFilePart(value: unknown, fallback: string) {
  const clean = asciiText(value)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return clean || fallback;
}

function receiptNumberFromPaymentId(paymentId: string) {
  // Keep the original stable receipt-number algorithm so previously issued
  // receipts do not get a different reference after this visual upgrade.
  const paymentPart = safeFilePart(paymentId, 'RECEIPT')
    .slice(0, 12)
    .toUpperCase();

  return `S2B-PAY-${paymentPart}`;
}

function shortPaymentPart(paymentId: string) {
  const compact = asciiText(paymentId).replace(/[^a-zA-Z0-9]/g, '');
  return (compact.slice(0, 8) || 'RECEIPT').toUpperCase();
}

function escapePdfText(value: string) {
  return asciiText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function clipText(value: unknown, maxLength: number) {
  const text = asciiText(value);
  if (text.length <= maxLength) return text || '-';
  return `${text.slice(0, Math.max(1, maxLength - 3))}...`;
}

function wrapText(value: string, maxLength = 76) {
  const words = asciiText(value).split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length <= maxLength) {
      current = next;
      continue;
    }

    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
}

function maskPhone(value?: string) {
  const clean = asciiText(value).replace(/\s+/g, '');
  if (!clean) return '';
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 2)}${'*'.repeat(Math.max(2, clean.length - 4))}${clean.slice(-2)}`;
}

function textOperator(
  text: string,
  x: number,
  y: number,
  size: number,
  font = 'F1',
) {
  return `BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(
    text,
  )}) Tj ET`;
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function base64ToBytes(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function loadHtmlImage(source: string) {
  const image = new Image();
  image.decoding = 'async';

  let objectUrl = '';

  try {
    if (/^data:/i.test(source)) {
      image.src = source;
    } else {
      const response = await fetch(source, { cache: 'force-cache' });
      if (!response.ok) {
        throw new Error(`Image request failed with ${response.status}.`);
      }
      objectUrl = URL.createObjectURL(await response.blob());
      image.src = objectUrl;
    }

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to decode receipt image.'));
    });

    return image;
  } finally {
    if (objectUrl) {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
  }
}

async function imageSourceToJpeg(
  source: string,
  options: {
    maxWidth: number;
    maxHeight: number;
    quality?: number;
  },
): Promise<PdfImage> {
  const image = await loadHtmlImage(source);
  const scale = Math.min(
    options.maxWidth / Math.max(1, image.naturalWidth),
    options.maxHeight / Math.max(1, image.naturalHeight),
    1,
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable for receipt generation.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', options.quality ?? 0.94);
  const base64 = dataUrl.split(',')[1] || '';

  if (!base64) throw new Error('Unable to encode receipt image.');

  return {
    bytes: base64ToBytes(base64),
    width,
    height,
  };
}

async function loadReceiptLogo(path?: string) {
  const candidates = Array.from(
    new Set([
      asciiText(path),
      DEFAULT_LOGO_PATH,
      '/brand/logo-full-ui.png',
      '/brand/logo-short.png',
      '/brand/logo-mark.png',
    ].filter(Boolean)),
  );

  for (const candidate of candidates) {
    try {
      return await imageSourceToJpeg(candidate, {
        maxWidth: 800,
        maxHeight: 260,
        quality: 0.96,
      });
    } catch (error) {
      console.warn(`[PaymentReceipt] Logo skipped for ${candidate}:`, error);
    }
  }

  return null;
}

function makeQrPayload(
  data: PaymentReceiptData,
  receiptNumber: string,
) {
  if (asciiText(data.verificationUrl)) {
    return asciiText(data.verificationUrl);
  }

  return [
    'SHOP2BHUTAN VERIFIED PAYMENT RECEIPT',
    `Receipt: ${receiptNumber}`,
    `Payment ID: ${asciiText(data.paymentId)}`,
    data.orderId ? `Order ID: ${asciiText(data.orderId)}` : '',
    `Order: ${asciiText(data.orderNumber)}`,
    `Amount: ${asciiText(data.amountLabel)}`,
    `Status: ${asciiText(data.status) || 'Verified'}`,
    `Verified: ${asciiText(data.verifiedAt)}`,
    `App: ${asciiText(data.appUrl) || DEFAULT_APP_URL}`,
  ].filter(Boolean).join('\n');
}

async function makeQrImage(payload: string) {
  const { toDataURL } = await import('qrcode');
  const dataUrl = await toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 360,
    color: {
      dark: '#111827',
      light: '#FFFFFF',
    },
  });

  return imageSourceToJpeg(dataUrl, {
    maxWidth: 360,
    maxHeight: 360,
    quality: 1,
  });
}

function imageDrawOperator(
  resourceName: string,
  image: PdfImage,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const drawX = x + (maxWidth - width) / 2;
  const drawY = y + (maxHeight - height) / 2;

  return `q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm /${resourceName} Do Q`;
}

function makePdf(objects: PdfObject[]) {
  const chunks: Uint8Array[] = [textEncoder.encode('%PDF-1.4\n%S2B\n')];
  const offsets = [0];
  let byteLength = chunks[0].length;

  objects.forEach((object, index) => {
    offsets[index + 1] = byteLength;
    const start = textEncoder.encode(`${index + 1} 0 obj\n`);
    chunks.push(start);
    byteLength += start.length;

    if (object.stream) {
      const dictionary = textEncoder.encode(
        `${object.dictionary || '<< >>'}\nstream\n`,
      );
      const end = textEncoder.encode('\nendstream\nendobj\n');
      chunks.push(dictionary, object.stream, end);
      byteLength += dictionary.length + object.stream.length + end.length;
    } else {
      const body = textEncoder.encode(`${object.body || '<< >>'}\nendobj\n`);
      chunks.push(body);
      byteLength += body.length;
    }
  });

  const xrefOffset = byteLength;
  let trailer = `xref\n0 ${objects.length + 1}\n`;
  trailer += '0000000000 65535 f \n';

  for (let index = 1; index <= objects.length; index += 1) {
    trailer += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }

  trailer += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  trailer += `startxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(textEncoder.encode(trailer));

  return concatBytes(chunks);
}

async function buildReceiptPdf(data: PaymentReceiptData) {
  const receiptNumber = receiptNumberFromPaymentId(data.paymentId);
  const appUrl = asciiText(data.appUrl) || DEFAULT_APP_URL;
  const [logo, qrImage] = await Promise.all([
    loadReceiptLogo(data.logoPath),
    makeQrImage(makeQrPayload(data, receiptNumber)),
  ]);

  const imageResources: Array<{
    name: string;
    image: PdfImage;
    objectId: number;
  }> = [];

  let nextObjectId = 6;

  if (logo) {
    imageResources.push({ name: 'Logo', image: logo, objectId: nextObjectId });
    nextObjectId += 1;
  }

  imageResources.push({ name: 'Qr', image: qrImage, objectId: nextObjectId });
  nextObjectId += 1;
  const contentObjectId = nextObjectId;

  const xObjectDictionary = imageResources
    .map((resource) => `/${resource.name} ${resource.objectId} 0 R`)
    .join(' ');

  const contentLines: string[] = [
    // Page background and top brand card.
    '1 1 1 rg 0 0 595 842 re f',
    '0.973 0.98 0.988 rg 32 706 531 104 re f',
    '0.961 0.369 0.031 rg 32 706 6 104 re f',
  ];

  if (logo) {
    contentLines.push(imageDrawOperator('Logo', logo, 50, 738, 165, 52));
  } else {
    contentLines.push(
      '0.047 0.235 0.627 rg',
      textOperator('Shop2Bhutan', 52, 765, 22, 'F2'),
    );
  }

  contentLines.push(
    '0.067 0.094 0.153 rg',
    textOperator('VERIFIED PAYMENT RECEIPT', 326, 775, 11, 'F2'),
    '0.42 0.45 0.5 rg',
    textOperator('Receipt No.', 326, 754, 8, 'F1'),
    '0.067 0.094 0.153 rg',
    textOperator(receiptNumber, 382, 754, 9, 'F2'),
    '0.42 0.45 0.5 rg',
    textOperator('Order', 326, 734, 8, 'F1'),
    '0.067 0.094 0.153 rg',
    textOperator(`#${clipText(data.orderNumber, 24)}`, 382, 734, 10, 'F2'),

    // Summary cards.
    '0.976 0.98 0.984 rg 32 626 354 62 re f',
    '0.42 0.45 0.5 rg',
    textOperator('AMOUNT RECEIVED', 48, 667, 8, 'F2'),
    '0.067 0.094 0.153 rg',
    textOperator(clipText(data.amountLabel, 28), 48, 641, 22, 'F2'),
    '0.925 0.98 0.945 rg 400 626 163 62 re f',
    '0.02 0.49 0.27 rg',
    textOperator('PAYMENT VERIFIED', 420, 656, 10, 'F2'),
    textOperator('Confirmed by Shop2Bhutan', 416, 639, 8, 'F1'),

    '0.067 0.094 0.153 rg',
    textOperator('PAYMENT DETAILS', 32, 597, 10, 'F2'),
    '0.88 0.89 0.91 RG 32 588 531 0.7 re S',
  );

  const leftRows: Array<[string, string]> = [
    ['Order number', `#${asciiText(data.orderNumber) || '-'}`],
    ['Transaction ID', asciiText(data.transactionId) || 'Not provided'],
    ['Order total', asciiText(data.orderTotalLabel) || '-'],
    ['Previously paid', asciiText(data.previouslyPaidLabel) || 'Nu. 0'],
    ['Submitted', asciiText(data.submittedAt) || '-'],
    ['Customer', asciiText(data.customerName) || 'Customer'],
  ];

  const rightRows: Array<[string, string]> = [
    ['Payment type', asciiText(data.paymentType) || '-'],
    ['Payment method', asciiText(data.paymentMethod) || '-'],
    ['Amount received', asciiText(data.amountLabel) || '-'],
    ['Balance due', asciiText(data.balanceDueLabel) || 'Nu. 0'],
    ['Verified', asciiText(data.verifiedAt) || '-'],
    ['Phone', maskPhone(data.customerPhone) || 'Not provided'],
  ];

  let rowY = 561;

  for (let index = 0; index < leftRows.length; index += 1) {
    const [leftLabel, leftValue] = leftRows[index];
    const [rightLabel, rightValue] = rightRows[index];

    contentLines.push(
      '0.42 0.45 0.5 rg',
      textOperator(leftLabel, 40, rowY, 8, 'F1'),
      textOperator(rightLabel, 310, rowY, 8, 'F1'),
      '0.067 0.094 0.153 rg',
      textOperator(clipText(leftValue, 29), 130, rowY, 9, 'F2'),
      textOperator(clipText(rightValue, 24), 406, rowY, 9, 'F2'),
    );

    rowY -= 31;
  }

  contentLines.push(
    '0.88 0.89 0.91 RG 32 365 531 0.7 re S',

    // QR/reference card.
    '0.973 0.98 0.988 rg 32 211 531 136 re f',
    '0.067 0.094 0.153 rg',
    textOperator('RECEIPT REFERENCE', 48, 320, 9, 'F2'),
    textOperator(receiptNumber, 48, 297, 12, 'F2'),
    '0.42 0.45 0.5 rg',
    textOperator(`Payment ID: ${clipText(data.paymentId, 34)}`, 48, 275, 8, 'F1'),
    textOperator('Scan the QR code to view the encoded receipt details.', 48, 250, 9, 'F1'),
    textOperator(appUrl, 48, 230, 8, 'F2'),
    imageDrawOperator('Qr', qrImage, 433, 224, 112, 112),

    '0.067 0.094 0.153 rg',
    textOperator('Receipt note', 32, 180, 10, 'F2'),
  );

  const noteLines = wrapText(
    'This receipt confirms that Shop2Bhutan has verified the payment listed above. Please keep this document for your records and quote the order number or receipt number when contacting support.',
    91,
  );

  let noteY = 157;
  for (const line of noteLines.slice(0, 3)) {
    contentLines.push(
      '0.25 0.28 0.33 rg',
      textOperator(line, 32, noteY, 9, 'F1'),
    );
    noteY -= 16;
  }

  contentLines.push(
    '0.42 0.45 0.5 rg',
    textOperator('Generated by the Shop2Bhutan customer app.', 32, 78, 8, 'F1'),
    textOperator('This is a system-generated receipt and does not require a signature.', 32, 63, 8, 'F1'),
    '0.961 0.369 0.031 rg 0 0 595 9 re f',
  );

  const content = textEncoder.encode(contentLines.join('\n'));

  const pageResources = xObjectDictionary
    ? `/Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << ${xObjectDictionary} >> >>`
    : '/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >>';

  const objects: PdfObject[] = [
    { body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    {
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ${pageResources} /Contents ${contentObjectId} 0 R >>`,
    },
    { body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' },
    { body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>' },
  ];

  for (const resource of imageResources) {
    objects.push({
      dictionary: `<< /Type /XObject /Subtype /Image /Width ${resource.image.width} /Height ${resource.image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${resource.image.bytes.length} >>`,
      stream: resource.image.bytes,
    });
  }

  objects.push({
    dictionary: `<< /Length ${content.length} >>`,
    stream: content,
  });

  return makePdf(objects);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(
      offset,
      Math.min(offset + chunkSize, bytes.length),
    );

    binary += String.fromCharCode(...chunk);
  }

  return window.btoa(binary);
}

function downloadPdfInBrowser(
  bytes: Uint8Array,
  fileName: string,
) {
  const pdfBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfBuffer).set(bytes);

  const blob = new Blob([pdfBuffer], {
    type: 'application/pdf',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

async function writeNativeReceipt(
  bytes: Uint8Array,
  fileName: string,
) {
  const relativePath = `${RECEIPT_DIRECTORY}/${fileName}`;
  const encodedPdf = bytesToBase64(bytes);

  try {
    return await Filesystem.writeFile({
      path: relativePath,
      data: encodedPdf,
      directory: Directory.Documents,
      recursive: true,
    });
  } catch (documentsError) {
    console.warn(
      '[PaymentReceipt] Documents storage unavailable, using app data:',
      documentsError,
    );

    return Filesystem.writeFile({
      path: relativePath,
      data: encodedPdf,
      directory: Directory.Data,
      recursive: true,
    });
  }
}

export async function openOrDownloadPaymentReceipt(
  data: PaymentReceiptData,
): Promise<PaymentReceiptResult> {
  if (data.status.toLowerCase() !== 'verified') {
    throw new Error(
      'A receipt is available only after payment verification.',
    );
  }

  const orderPart = safeFilePart(data.orderNumber, 'Payment');
  const paymentPart = shortPaymentPart(data.paymentId);
  const fileName = `Shop2Bhutan-Payment-${orderPart}-${paymentPart}.pdf`;
  const pdfBytes = await buildReceiptPdf(data);

  if (!Capacitor.isNativePlatform()) {
    downloadPdfInBrowser(pdfBytes, fileName);

    return {
      mode: 'downloaded',
      fileName,
    };
  }

  const writeResult = await writeNativeReceipt(
    pdfBytes,
    fileName,
  );

  try {
    await FileViewer.openDocumentFromLocalPath({
      path: writeResult.uri,
    });

    return {
      mode: 'opened',
      fileName,
    };
  } catch (viewerError) {
    console.warn(
      '[PaymentReceipt] Receipt saved but could not be opened:',
      viewerError,
    );

    return {
      mode: 'saved',
      fileName,
    };
  }
}
