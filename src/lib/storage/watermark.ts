/**
 * Stamps the Cliniolab logo onto uploaded images before they're stored in
 * R2, so any image pulled off the site and reused elsewhere still carries
 * attribution back to Cliniolab.
 *
 * Uses Photon (Rust image lib compiled to WASM via @cf-wasm/photon)
 * rather than sharp: sharp needs native bindings, which complicates
 * portability across this app's deploy targets. Photon runs as pure
 * WASM instead. This app's API routes build and deploy through Vercel
 * (see the build logs — `next build` via Vercel, not a wrangler/
 * workerd build), so the `node` subpath is the correct entrypoint here;
 * a separate wrangler/workerd deploy target would need `/workerd`
 * instead.
 */
import { PhotonImage, watermark } from '@cf-wasm/photon/node';

// Logo is bundled as a module-scope constant rather than fetched per
// request — it's a fixed local asset (public/icon-512.png), so paying a
// network round trip (or filesystem read, which isn't available in
// workerd anyway) on every upload would be pure waste. Inlined as base64
// at build time via the .ts wrapper below.
import LOGO_BASE64 from './cliniolabLogoBase64';

const MARK_WIDTH_FRACTION = 0.24; // logo+wordmark width as a fraction of the uploaded image's width
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

/**
 * Applies the watermark and returns new image bytes in the same format
 * the input was (PNG in, PNG out — get_bytes() always encodes PNG,
 * which is fine since uploadImage() stores whatever bytes we hand it
 * under the original content-type; see the caller for why JPEG/WEBP/GIF
 * inputs are re-tagged as PNG after this step).
 *
 * Placement: bottom-center, not a corner. Every place this app displays
 * an uploaded image (blog cover, card grids, banners) renders it with
 * CSS object-fit: cover inside a fixed-aspect box, which crops from
 * whichever edges don't match the box's ratio — almost always trimming
 * the corners first. A logo stamped in a corner gets cropped off
 * constantly. Center-bottom survives that crop far more often since
 * object-cover keeps the full width or height (whichever the box ratio
 * allows) and only trims the other axis symmetrically from both edges,
 * so a horizontally-centered mark near (but not at) the bottom edge
 * stays inside frame unless the crop is extremely aggressive.
 */
export async function applyWatermark(inputBytes: Uint8Array): Promise<Uint8Array> {
  const baseImage = PhotonImage.new_from_byteslice(inputBytes);
  const logoImage = PhotonImage.new_from_byteslice(getLogoBytes());

  try {
    const baseWidth = baseImage.get_width();
    const baseHeight = baseImage.get_height();

    const targetLogoWidth = Math.max(24, Math.round(baseWidth * MARK_WIDTH_FRACTION));
    const scale = targetLogoWidth / logoImage.get_width();
    const targetLogoHeight = Math.max(24, Math.round(logoImage.get_height() * scale));

    // Photon's watermark() draws the second image onto the first at a
    // pixel offset with no resize step of its own, so the logo is
    // resized to the target footprint first via a scratch canvas... but
    // Photon doesn't expose a standalone resize-then-return-new-image
    // helper that's simpler than just importing resize() directly.
    const { resize, SamplingFilter } = await import('@cf-wasm/photon/node');
    const resizedLogo = resize(logoImage, targetLogoWidth, targetLogoHeight, SamplingFilter.Lanczos3);

    const margin = Math.round(baseHeight * MARGIN_FRACTION);
    const x = Math.max(0, Math.round((baseWidth - targetLogoWidth) / 2));
    const y = Math.max(0, baseHeight - targetLogoHeight - margin);

    watermark(baseImage, resizedLogo, BigInt(x), BigInt(y));

    const outBytes = baseImage.get_bytes();
    resizedLogo.free();
    return outBytes;
  } finally {
    baseImage.free();
    logoImage.free();
  }
}
