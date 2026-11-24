/* A narrow, offline recognizer for dark, uppercase monospace text on light paper. */
(() => {
  'use strict';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const fonts = ['Consolas', 'Courier New', 'monospace'];
  const featureWidth = 18;
  const featureHeight = 24;
  let templates;

  function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas.getContext('2d', { willReadFrequently: true });
  }

  function bitmap(context) {
    const { width, height } = context.canvas;
    const rgba = context.getImageData(0, 0, width, height).data;
    const pixels = new Uint8Array(width * height);
    const counts = new Uint32Array(256);
    for (let i = 0; i < pixels.length; i++) {
      const pos = 4 * i;
      pixels[i] = Math.round(.299 * rgba[pos] + .587 * rgba[pos + 1] + .114 * rgba[pos + 2]);
      counts[pixels[i]]++;
    }
    let totalSum = 0;
    for (let i = 0; i < 256; i++) totalSum += counts[i] * i;
    let sum = 0, weight = 0, maxVariance = 0, threshold = 127;
    for (let i = 0; i < 255; i++) {
      weight += counts[i];
      sum += counts[i] * i;
      const other = pixels.length - weight;
      if (!weight || !other) continue;
      const difference = sum / weight - (totalSum - sum) / other;
      const variance = weight * other * difference * difference;
      if (variance > maxVariance) { maxVariance = variance; threshold = i; }
    }
    let inkCount = 0;
    for (let i = 0; i < pixels.length; i++) { pixels[i] = pixels[i] <= threshold ? 1 : 0; inkCount += pixels[i]; }
    return { pixels, width, height, fraction: inkCount / pixels.length };
  }

  function runs(size, active) {
    const groups = [];
    let start = -1;
    for (let i = 0; i <= size; i++) {
      if (i < size && active(i)) {
        if (start < 0) start = i;
      } else if (start >= 0) {
        groups.push([start, i]);
        start = -1;
      }
    }
    return groups;
  }

  function signature(image, left, right, top, bottom) {
    const width = right - left, height = bottom - top;
    const values = new Float32Array(featureWidth * featureHeight);
    for (let fy = 0; fy < featureHeight; fy++) {
      for (let fx = 0; fx < featureWidth; fx++) {
        let ink = 0;
        for (const dy of [.2, .5, .8]) for (const dx of [.2, .5, .8]) {
          const x = left + Math.floor((fx + dx) * width / featureWidth);
          const y = top + Math.floor((fy + dy) * height / featureHeight);
          ink += image.pixels[y * image.width + x];
        }
        values[fy * featureWidth + fx] = ink / 9;
      }
    }
    // Subpixel positioning moves thin stems by a pixel. A local average keeps
    // that small shift from outweighing the shape of the whole letter.
    const smoothed = new Float32Array(values.length);
    for (let y = 0; y < featureHeight; y++) for (let x = 0; x < featureWidth; x++) {
      const i = y * featureWidth + x;
      smoothed[i] = .4 * values[i] + .15 * (
        values[y * featureWidth + Math.max(0, x - 1)] +
        values[y * featureWidth + Math.min(featureWidth - 1, x + 1)] +
        values[Math.max(0, y - 1) * featureWidth + x] +
        values[Math.min(featureHeight - 1, y + 1) * featureWidth + x]);
    }
    return { values: smoothed, aspect: width / height };
  }

  function columnRuns(image, top, bottom) {
    return runs(image.width, x => {
      for (let y = top; y < bottom; y++) if (image.pixels[y * image.width + x]) return true;
      return false;
    });
  }

  function rowRuns(image) {
    return runs(image.height, y => {
      for (let x = 0; x < image.width; x++) if (image.pixels[y * image.width + x]) return true;
      return false;
    });
  }

  function buildTemplates() {
    const context = makeCanvas(80, 76);
    const entries = [];
    for (const font of fonts) for (const weight of ['normal', 'bold']) for (const size of [28, 36, 50]) for (const offset of [0,.5]) for (const letter of alphabet) {
      context.fillStyle = 'white'; context.fillRect(0, 0, 80, 76);
      context.fillStyle = 'black'; context.font = weight + ' ' + size + 'px "' + font + '", monospace';
      context.fillText(letter, 8 + offset, 57);
      const mask = bitmap(context);
      const rows = rowRuns(mask), cols = columnRuns(mask, 0, 76);
      const [top, bottom] = [rows[0][0], rows[rows.length - 1][1]];
      entries.push({ letter, ...signature(mask, cols[0][0], cols[cols.length - 1][1], top, bottom) });
    }
    return entries;
  }

  function identify(glyph) {
    const distances = new Map();
    for (const entry of templates) {
      let error = 0;
      for (let i = 0; i < glyph.values.length; i++) error += Math.abs(glyph.values[i] - entry.values[i]);
      const distance = error / glyph.values.length + .12 * Math.abs(Math.log(glyph.aspect / entry.aspect));
      if (distance < (distances.get(entry.letter) ?? Infinity)) distances.set(entry.letter, distance);
    }
    const sorted = Array.from(distances).sort((a, b) => a[1] - b[1]);
    if (sorted[0][1] > .16 || sorted[1][1] - sorted[0][1] < .009) return '';
    return sorted[0][0];
  }

  function read(image) {
    const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
    if (!width || !height) return '';
    const scale = Math.min(1, 1400 / width, 1400 / height);
    const context = makeCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    context.fillStyle = 'white'; context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    context.drawImage(image, 0, 0, context.canvas.width, context.canvas.height);
    const mask = bitmap(context);
    if (mask.fraction < .001 || mask.fraction > .32) return '';
    const rows = rowRuns(mask);
    if (!rows.length || rows.length > 24) return '';
    templates ||= buildTemplates();
    const lines = [];
    for (const [top, bottom] of rows) {
      const columns = columnRuns(mask, top, bottom);
      if (bottom - top < 8 || columns.length < 2 || columns.length > 120) return '';
      const centers = columns.map(([l, r]) => (l + r) / 2);
      const deltas = centers.slice(1).map((c, i) => c - centers[i]).sort((a, b) => a - b);
      const step = deltas[Math.floor((deltas.length - 1) * .35)];
      let text = '';
      for (let i = 0; i < columns.length; i++) {
        const [left, right] = columns[i];
        // Descenders and rounded tops can shift the tight box by a pixel.
        let y0 = bottom, y1 = top;
        for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
          if (!mask.pixels[y * mask.width + x]) continue;
          y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        const letter = identify(signature(mask, left, right, y0, y1 + 1));
        if (!letter) return '';
        if (i > 0 && centers[i] - centers[i - 1] > step * 1.55) text += ' ';
        text += letter;
      }
      lines.push(text);
    }
    return lines.join('\n');
  }
  window.CluePrint = { read };
})();
