import { SaveFormat, type ImageManipulatorContext } from 'expo-image-manipulator';

export type CropRect = { x: number; y: number; w: number; h: number };

/** Preview the very same decoded pixels that the context will crop, without EXIF orientation. */
export async function prepareCropPreview(context: ImageManipulatorContext) {
  const decoded = await context.renderAsync();
  try {
    const { width, height } = decoded;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error('Invalid image dimensions');
    }
    // PNG is lossless and has no original EXIF rotation for another decoder to interpret.
    const preview = await decoded.saveAsync({ format: SaveFormat.PNG });
    return { uri: preview.uri, w: width, h: height };
  } finally {
    decoded.release();
  }
}

/**
 * Decode and orient the source once, then crop a fresh context built from the
 * exact lossless raster shown in the preview. This avoids applying preview
 * coordinates to the original URI's potentially different EXIF decode.
 */
export async function prepareCropInput(
  uri: string,
  manipulate: (uri: string) => ImageManipulatorContext,
) {
  const previewContext = manipulate(uri);
  let preview: Awaited<ReturnType<typeof prepareCropPreview>>;
  try {
    preview = await prepareCropPreview(previewContext);
  } finally {
    previewContext.release();
  }
  return { preview, context: manipulate(preview.uri) };
}

export function cropSelectionToPixels(
  rect: CropRect,
  preview: { w: number; h: number },
  source: { w: number; h: number },
) {
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
  const left = clamp(Math.round(rect.x * source.w / preview.w), 0, source.w - 1);
  const top = clamp(Math.round(rect.y * source.h / preview.h), 0, source.h - 1);
  const right = clamp(Math.round((rect.x + rect.w) * source.w / preview.w), left + 1, source.w);
  const bottom = clamp(Math.round((rect.y + rect.h) * source.h / preview.h), top + 1, source.h);
  return { originX: left, originY: top, width: right - left, height: bottom - top };
}