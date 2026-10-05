import { describe, expect, it, vi } from 'vitest';
import type { ImageManipulatorContext } from 'expo-image-manipulator';

vi.mock('expo-image-manipulator', () => ({ SaveFormat: { PNG: 'png' } }));

import { cropSelectionToPixels, prepareCropInput, prepareCropPreview } from '../cropImage';

describe('manual crop pixels', () => {
  it('maps the central character selection using decoded source dimensions, not screen dimensions', () => {
    expect(cropSelectionToPixels(
      { x: 151, y: 16, w: 115, h: 149 },
      { w: 412, h: 183 },
      { w: 2472, h: 1098 },
    )).toEqual({ originX: 906, originY: 96, width: 690, height: 894 });
  });

  it('keeps selections at the bottom/right inside the source despite floating point rounding', () => {
    expect(cropSelectionToPixels(
      { x: 200, y: 100, w: 212.00001, h: 83.00001 },
      { w: 412, h: 183 },
      { w: 2472, h: 1098 },
    )).toEqual({ originX: 1200, originY: 600, width: 1272, height: 498 });
  });

  it('preserves the entire source when the whole preview is selected', () => {
    expect(cropSelectionToPixels(
      { x: 0, y: 0, w: 183, h: 412 },
      { w: 183, h: 412 },
      { w: 1098, h: 2472 },
    )).toEqual({ originX: 0, originY: 0, width: 1098, height: 2472 });
  });
});

describe('decoded crop preview', () => {
  it('shows a lossless saved copy of the crop context rather than decoding the original separately', async () => {
    const saveAsync = vi.fn().mockResolvedValue({ uri: 'file://decoded-preview.png' });
    const release = vi.fn();
    const context = {
      renderAsync: vi.fn().mockResolvedValue({ width: 2472, height: 1098, saveAsync, release }),
    } as unknown as ImageManipulatorContext;
    expect(await prepareCropPreview(context)).toEqual({ uri: 'file://decoded-preview.png', w: 2472, h: 1098 });
    expect(saveAsync).toHaveBeenCalledWith({ format: 'png' });
    expect(release).toHaveBeenCalledOnce();
  });

  it('releases the rendered image and fails explicitly if the preview cannot be saved', async () => {
    const release = vi.fn();
    const context = {
      renderAsync: vi.fn().mockResolvedValue({
        width: 2472, height: 1098, release,
        saveAsync: vi.fn().mockRejectedValue(new Error('disk full')),
      }),
    } as unknown as ImageManipulatorContext;
    await expect(prepareCropPreview(context)).rejects.toThrow('disk full');
    expect(release).toHaveBeenCalledOnce();
  });

  it('rejects invalid decoded dimensions instead of enabling a misleading crop', async () => {
    const release = vi.fn();
    const saveAsync = vi.fn();
    const context = {
      renderAsync: vi.fn().mockResolvedValue({ width: 0, height: 1098, saveAsync, release }),
    } as unknown as ImageManipulatorContext;
    await expect(prepareCropPreview(context)).rejects.toThrow('Invalid image dimensions');
    expect(saveAsync).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });
});

describe('crop input', () => {
  it('creates the crop context from the exact lossless preview shown to the user', async () => {
    const previewContext = {
      renderAsync: vi.fn().mockResolvedValue({
        width: 2472,
        height: 1098,
        saveAsync: vi.fn().mockResolvedValue({ uri: 'file://decoded-preview.png' }),
        release: vi.fn(),
      }),
      release: vi.fn(),
    } as unknown as ImageManipulatorContext;
    const cropContext = { release: vi.fn() } as unknown as ImageManipulatorContext;
    const manipulate = vi.fn((uri: string) =>
      uri === 'file://original.jpg' ? previewContext : cropContext,
    );

    const result = await prepareCropInput('file://original.jpg', manipulate);

    expect(manipulate).toHaveBeenNthCalledWith(1, 'file://original.jpg');
    expect(manipulate).toHaveBeenNthCalledWith(2, 'file://decoded-preview.png');
    expect(result.preview).toEqual({ uri: 'file://decoded-preview.png', w: 2472, h: 1098 });
    expect(result.context).toBe(cropContext);
    expect(previewContext.release).toHaveBeenCalledOnce();
  });

  it('releases the source context if preview preparation fails', async () => {
    const previewContext = {
      renderAsync: vi.fn().mockRejectedValue(new Error('decode failed')),
      release: vi.fn(),
    } as unknown as ImageManipulatorContext;
    const manipulate = vi.fn(() => previewContext);

    await expect(prepareCropInput('file://original.jpg', manipulate)).rejects.toThrow('decode failed');

    expect(manipulate).toHaveBeenCalledOnce();
    expect(previewContext.release).toHaveBeenCalledOnce();
  });
});