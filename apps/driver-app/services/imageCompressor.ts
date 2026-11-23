export interface CompressImageOptions {
  maxDimension?: number;
  quality?: number;
  maxDataUrlChars?: number;
}

const DEFAULT_MAX_DIMENSION = 720;
const DEFAULT_QUALITY = 0.75;
const DEFAULT_MAX_CHARS = 650_000;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read file contents.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed reading selected file.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Selected file could not be decoded as an image.'));
    img.src = src;
  });
}

/**
 * Compresses any camera/gallery image into a lightweight JPEG Data URL (max 720px, quality 0.75)
 * so driver avatars and KYC documents store cleanly inside Firestore without external storage buckets.
 */
export async function compressFileToFirestoreDataUrl(
  file: File,
  options: CompressImageOptions = {}
): Promise<string> {
  const maxDim = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const initialQuality = options.quality ?? DEFAULT_QUALITY;
  const maxChars = options.maxDataUrlChars ?? DEFAULT_MAX_CHARS;

  const isImage =
    file.type.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|heic|bmp|gif)$/i.test(file.name);

  if (!isImage) {
    const rawDataUrl = await readFileAsDataUrl(file);
    if (rawDataUrl.length > maxChars) {
      throw new Error(
        'Selected non-image document exceeds Firestore 650KB limit. Capture or upload a clear photo instead.'
      );
    }
    return rawDataUrl;
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  if (typeof document === 'undefined') {
    return rawDataUrl;
  }

  const img = await loadImageElement(rawDataUrl);
  const srcW = img.naturalWidth || img.width || maxDim;
  const srcH = img.naturalHeight || img.height || maxDim;

  const attemptEncode = (limitDim: number, quality: number): string => {
    const scale = Math.min(1, limitDim / Math.max(srcW, srcH));
    const targetW = Math.max(1, Math.round(srcW * scale));
    const targetH = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable for image compression.');
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', quality);
  };

  let encoded = attemptEncode(maxDim, initialQuality);
  if (encoded.length > maxChars) {
    encoded = attemptEncode(Math.min(maxDim, 600), 0.65);
  }
  if (encoded.length > maxChars) {
    encoded = attemptEncode(480, 0.52);
  }
  if (encoded.length > maxChars) {
    throw new Error('Compressed image still exceeds safe document size limit. Please capture a closer photo.');
  }

  return encoded;
}
