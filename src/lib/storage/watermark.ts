/**
 * Image processing for uploads: resize, watermark, and compress.
 *
 * Storage budget matters here. R2's free tier is 10GB, and the original
 * version of this file re-encoded every upload as PNG (Photon's
 * get_bytes() always emits PNG), which turned a 300KB JPEG into a 2-3MB
 * PNG. Now every image is:
 *
 *   1. downscaled to a per-purpose max width (nothing on the site renders
 *      wider, so extra pixels are pure storage cost),
 *   2. watermarked AFTER the resize (cheaper on CPU, and the logo scales
 *      relative to the final image rather than the original),
 *   3. encoded as JPEG (or WebP where alpha must survive), not PNG.
 *
 * The watermark itself costs a few KB; the savings come from 2 + 3.
 *
 * Uses Photon (Rust image lib compiled to WASM via @cf-wasm/photon)
 * rather than sharp: sharp needs native bindings, which complicates
 * portability across this app's deploy targets. The `node` subpath is
 * used because API routes build through Vercel; a wrangler/workerd
 * build would need `/workerd` instead.
 */
import {
  PhotonImage,
  SamplingFilter,
  resize,
  watermark,
} from '@cf-wasm/photon/node';

import LOGO_BASE64 from './cliniolabLogoBase64';

/** Longest-edge caps (px) by upload purpose. Never upscales. */
export const MAX_WIDTH_BY_PURPOSE = {
  blog: 1200,
  resources: 1000,
  scholars: 800,
  banners: 1600,
  avatars: 256,
} as const;

export type ImagePurpose = keyof typeof MAX_WIDTH_BY_PURPOSE;

const JPEG_QUALITY = 80;
const MARK_WIDTH_FRACTION = 0.24; // logo width as a fraction of the (resized) image width
const MARGIN_FRACTION = 0.035; // gap from the bottom edge, as a fraction of image height

let cachedLogoBytes: Uint8Array | null = null;
function getLogoBytes(): Uint8Array {
  if (!cachedLogoBytes) {
    const binary = atob(LOGO_BASE64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    cachedLogoBytes = bytes;
  }
  return cachedLogoBytes;
}

export interface ProcessedImage {
  bytes: Uint8Array;
  ext: 'jpg';
  contentType: 'image/jpeg';
}

/**
 * Resizes to the purpose's max width, optionally stamps the Cliniolab
 * logo bottom-center, and returns compressed JPEG bytes.
 *
 * Watermark placement: bottom-center, not a corner. Every place this app
 * displays an uploaded image renders it with CSS object-fit: cover inside
 * a fixed-aspect box, which crops from whichever edges don't match the
 * box's ratio - almost always trimming corners first. A horizontally
 * centered mark near the bottom survives that crop far more often.
 *
 * JPEG has no alpha channel, so transparent PNGs get flattened onto a
 * white background. That is fine for blog/resource/banner/scholar
 * photography and is the price of the ~15-20x size reduction vs PNG.
 */
export async function processImage(
  inputBytes: Uint8Array,
  purpose: ImagePurpose,
  options: { applyWatermark: boolean }
): Promise<ProcessedImage> {
  const maxWidth = MAX_WIDTH_BY_PURPOSE[purpose];
  let image = PhotonImage.new_from_byteslice(inputBytes);
  let logo: PhotonImage | null = null;
  let resizedLogo: PhotonImage | null = null;

  try {
    // 1. Downscale (never upscale).
    const srcWidth = image.get_width();
    const srcHeight = image.get_height();
    if (srcWidth > maxWidth) {
      const newWidth = maxWidth;
      const newHeight = Math.max(1, Math.round((srcHeight * newWidth) / srcWidth));
      const resized = resize(image, newWidth, newHeight, SamplingFilter.Lanczos3);
      image.free();
      image = resized;
    }

    // 2. Watermark the already-resized image.
    if (options.applyWatermark) {
      logo = PhotonImage.new_from_byteslice(getLogoBytes());
      const baseWidth = image.get_width();
      const baseHeight = image.get_height();

      const targetLogoWidth = Math.max(24, Math.round(baseWidth * MARK_WIDTH_FRACTION));
      const scale = targetLogoWidth / logo.get_width();
      const targetLogoHeight = Math.max(24, Math.round(logo.get_height() * scale));
      resizedLogo = resize(logo, targetLogoWidth, targetLogoHeight, SamplingFilter.Lanczos3);

      const margin = Math.round(baseHeight * MARGIN_FRACTION);
      const x = Math.max(0, Math.round((baseWidth - targetLogoWidth) / 2));
      const y = Math.max(0, baseHeight - targetLogoHeight - margin);
      watermark(image, resizedLogo, BigInt(x), BigInt(y));
    }

    // 3. Encode as JPEG instead of Photon's default PNG.
    const bytes = image.get_bytes_jpeg(JPEG_QUALITY);
    return { bytes, ext: 'jpg', contentType: 'image/jpeg' };
  } finally {
    image.free();
    logo?.free();
    resizedLogo?.free();
  }
}
