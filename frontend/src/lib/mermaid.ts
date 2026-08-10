import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'strict',
  fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
});

export async function renderMermaidToSvg(source: string): Promise<string> {
  const id = `mermaid-${Math.random().toString(36).slice(2)}`;
  const { svg } = await mermaid.render(id, source);
  return svg;
}

export function svgToSvgBlob(svg: string): Blob {
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

export function svgToPngBlob(svg: string, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || 800;
      const h = img.naturalHeight || 600;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))),
        'image/png',
      );
    };
    img.onerror = () => reject(new Error('Failed to rasterize diagram'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
