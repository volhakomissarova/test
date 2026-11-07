"use strict";

const ROWS_PER_CHUNK = 192;

self.addEventListener("message", async (event) => {
  const message = event.data;
  if (!message || message.type !== "process" || !message.bitmap) return;

  const { bitmap, jobId } = message;
  const { width, height } = bitmap;

  try {
    if (typeof OffscreenCanvas !== "function") {
      throw new Error("Your browser doesn't support secure image processing in the background.");
    }

    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("We couldn't prepare the canvas to process your photo.");

    context.drawImage(bitmap, 0, 0);
    bitmap.close();

    const imageScale = Math.max(width, height);
    const vignetteStrength = 0.035;

    for (let y = 0; y < height; y += ROWS_PER_CHUNK) {
      const chunkHeight = Math.min(ROWS_PER_CHUNK, height - y);
      const imageData = context.getImageData(0, y, width, chunkHeight);
      const pixels = imageData.data;
      let seed = (0x9e3779b9 ^ Math.imul(y + 1, 0x85ebca6b) ^ Math.imul(width, 0xc2b2ae35)) >>> 0;

      for (let row = 0; row < chunkHeight; row += 1) {
        const imageY = y + row;
        const dy = (imageY + 0.5 - height / 2) / imageScale;

        for (let x = 0; x < width; x += 1) {
          const index = (row * width + x) * 4;
          const alpha = pixels[index + 3];
          if (alpha === 0) continue;

          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
          const curve = luminance + 0.12 * (luminance - 0.5) * 4 * luminance * (1 - luminance);

          const dx = (x + 0.5 - width / 2) / imageScale;
          const radius = Math.sqrt(dx * dx + dy * dy);
          const vignette = Math.max(0.965, 1 - vignetteStrength * Math.max(0, (radius - 0.27) / 0.42) ** 2);

          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          const randomA = (seed >>> 0) / 4294967296;
          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          const randomB = (seed >>> 0) / 4294967296;
          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          const randomC = (seed >>> 0) / 4294967296;
          const grain = (randomA + randomB + randomC - 1.5) * 17 * (0.68 + 0.32 * 4 * luminance * (1 - luminance));
          const tone = Math.max(0, Math.min(255, Math.round((curve * vignette * 255) + grain)));

          pixels[index] = tone;
          pixels[index + 1] = tone;
          pixels[index + 2] = tone;
        }
      }

      context.putImageData(imageData, 0, y);
      self.postMessage({
        type: "progress",
        jobId,
        progress: (y + chunkHeight) / height,
        label: "Adding delicate film grain"
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const blob = await canvas.convertToBlob({ type: "image/png" });
    if (!blob) throw new Error("We couldn't save the processed image.");
    self.postMessage({ type: "complete", jobId, blob });
  } catch (error) {
    bitmap.close();
    self.postMessage({
      type: "error",
      jobId,
      message: error instanceof Error ? error.message : "We couldn't process this photo."
    });
  }
});
