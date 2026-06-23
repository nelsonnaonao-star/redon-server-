interface FilterMessage {
  imageBitmap: ImageBitmap;
  brightness: number;
  contrast: number;
  saturation: number;
  activeFilter: string;
  rotation: number;
  zoomLevel: number;
  panX: number;
  panY: number;
}

self.onmessage = async (e: MessageEvent<FilterMessage>) => {
  const { imageBitmap, brightness, contrast, saturation, activeFilter, rotation, zoomLevel, panX, panY } = e.data;

  const rad = rotation * Math.PI / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = imageBitmap.width;
  const h = imageBitmap.height;
  const rw = Math.ceil(w * cos + h * sin);
  const rh = Math.ceil(w * sin + h * cos);

  const canvas = new OffscreenCanvas(rw, rh);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cf = (val: number) => (val / 100).toFixed(2);
  let filter = `brightness(${cf(brightness)}) contrast(${cf(contrast)}) saturate(${cf(saturation)})`;
  if (activeFilter === 'bw') filter += ' grayscale(1)';
  else if (activeFilter === 'cinematic') filter += ' saturate(1.5) contrast(1.25) sepia(0.15)';
  else if (activeFilter === 'vivid') filter += ' saturate(2) brightness(1.05)';
  else if (activeFilter === 'warm') filter += ' sepia(0.3) saturate(1.1)';
  else if (activeFilter === 'cyber') filter += ' hue-rotate(60deg) saturate(1.5) contrast(1.1)';

  ctx.filter = filter;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.scale(zoomLevel, zoomLevel);
  ctx.translate(panX, panY);
  ctx.drawImage(imageBitmap, -w / 2, -h / 2);
  ctx.resetTransform();

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  self.postMessage({ blob });
};
