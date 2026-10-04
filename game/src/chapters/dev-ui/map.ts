import { compass, DANGER, frame, INK, INK_SOFT, inkPath, label, mountainGlyph, parchment, rng, townGlyph, treeGlyph } from '../../ui/plateKit';

/** Mother's hand-drawn map of Selantis (code-drawn book plate). */
export function drawSelantisMap(): HTMLCanvasElement {
  const W = 1600, H = 900;
  const { canvas, g } = parchment(W, H, 1234);
  const r = rng(99);

  // ---- coastline (organic polar shape) ----
  const coastOf = (ccx: number, ccy: number, rx: number, ry: number, n: number, seed: number, bays = true): [number, number][] => {
    const cr = rng(seed);
    const ph = [cr() * 6, cr() * 6, cr() * 6, cr() * 6];
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      let k = 1 + Math.sin(a * 2 + ph[0]) * 0.06 + Math.sin(a * 5 + ph[1]) * 0.05 + Math.sin(a * 9 + ph[2]) * 0.03 + Math.sin(a * 17 + ph[3]) * 0.015 + (cr() - 0.5) * 0.02;
      if (bays) {
        k -= Math.exp(-(((a - 2.3) / 0.2) ** 2)) * 0.2;   // south-west bay
        k += Math.exp(-(((a - 0.15) / 0.2) ** 2)) * 0.12; // eastern peninsula
        k -= Math.exp(-(((a - 4.4) / 0.12) ** 2)) * 0.1;  // northern fjord
      }
      pts.push([ccx + Math.cos(a) * rx * k, ccy + Math.sin(a) * ry * k]);
    }
    return pts;
  };
  const cx = 810, cy = 470;
  const coast = coastOf(cx, cy, 590, 315, 120, 7);
  const islands = [coastOf(170, 560, 46, 30, 30, 11, false), coastOf(1480, 700, 38, 24, 30, 12, false), coastOf(1430, 210, 30, 20, 26, 13, false)];
  const pathOf = (pts: [number, number][]) => { g.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts.slice(1)) g.lineTo(x, y); g.closePath(); };

  // Sea wash (everything outside the land)
  g.save();
  g.beginPath();
  g.rect(0, 0, W, H);
  pathOf(coast);
  islands.forEach(pathOf);
  g.fillStyle = 'rgba(70,105,125,0.13)';
  g.fill('evenodd');
  g.restore();
  // Land wash with a darker rim
  g.save();
  g.beginPath(); pathOf(coast); islands.forEach(pathOf);
  const land = g.createRadialGradient(cx, cy, 60, cx, cy, 640);
  land.addColorStop(0, 'rgba(165,160,95,0.16)');
  land.addColorStop(1, 'rgba(130,115,60,0.10)');
  g.fillStyle = land;
  g.fill();
  g.clip();
  g.strokeStyle = 'rgba(110,80,40,0.16)';
  g.lineWidth = 26;
  g.beginPath(); pathOf(coast); islands.forEach(pathOf); g.stroke();
  g.restore();

  // Sea: concentric coast echoes and little wave strokes.
  for (let k = 1; k <= 4; k++) {
    const s = 1 + k * 0.024;
    inkPath(g, coast.map(([x, y]) => [cx + (x - cx) * s, cy + (y - cy) * s] as [number, number]), { width: 1, color: `rgba(43,33,25,${0.3 - k * 0.06})`, wobble: 1.5, close: true, seed: k });
  }
  g.save();
  g.strokeStyle = 'rgba(43,33,25,0.26)';
  g.lineWidth = 1.4;
  for (let i = 0; i < 160; i++) {
    const x = r() * W, y = r() * H;
    const dx = (x - cx) / 660, dy = (y - cy) / 360;
    if (dx * dx + dy * dy < 1.15) continue;
    if (x < 70 || x > W - 70 || y < 70 || y > H - 70) continue;
    g.beginPath();
    g.arc(x, y, 7, Math.PI * 1.1, Math.PI * 1.9);
    g.arc(x + 13, y, 7, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
  }
  g.restore();
  inkPath(g, coast, { width: 3, wobble: 1.6, close: true, seed: 5 });
  islands.forEach((isl, i) => inkPath(g, isl, { width: 2.2, wobble: 1, close: true, seed: 30 + i }));

  // A little ship in the southern sea
  g.save();
  g.translate(560, 845);
  g.strokeStyle = INK; g.lineWidth = 2; g.fillStyle = '#a07a4a';
  g.beginPath(); g.moveTo(-26, 0); g.quadraticCurveTo(0, 14, 26, 0); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -36); g.stroke();
  g.fillStyle = '#efe0bd';
  g.beginPath(); g.moveTo(2, -34); g.quadraticCurveTo(22, -20, 2, -6); g.closePath(); g.fill(); g.stroke();
  g.restore();

  // Soft forest washes
  for (const [fx, fy, rad] of [[640, 320, 120], [1180, 600, 100], [560, 615, 60], [1080, 465, 55]] as const) {
    const fw = g.createRadialGradient(fx, fy, 0, fx, fy, rad);
    fw.addColorStop(0, 'rgba(80,110,55,0.22)');
    fw.addColorStop(1, 'rgba(80,110,55,0)');
    g.fillStyle = fw;
    g.fillRect(fx - rad, fy - rad, rad * 2, rad * 2);
  }

  // ---- river from the northern mountains to the southern sea ----
  const river: [number, number][] = [[960, 280], [945, 320], [985, 360], [940, 420], [960, 500], [915, 580], [930, 650], [880, 720], [860, 792]];
  inkPath(g, river, { width: 4, color: 'rgba(60,90,120,0.55)', wobble: 3, seed: 8 });
  inkPath(g, river, { width: 1.5, color: INK_SOFT, wobble: 3, seed: 8 });

  // ---- mountains (Moneda range) ----
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const x = 830 + t * 400 + (r() - 0.5) * 30;
    const y = 238 + Math.sin(t * Math.PI) * -22 + 36 * t + (r() - 0.5) * 18;
    mountainGlyph(g, x, y, 46 + r() * 22);
  }
  for (let i = 0; i < 7; i++) mountainGlyph(g, 880 + i * 52 + (r() - 0.5) * 20, 300 + (r() - 0.5) * 16, 30 + r() * 12);

  // ---- forests ----
  const forest = (fx: number, fy: number, n: number, spread: number, seed: number) => {
    const fr = rng(seed);
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) pts.push([fx + (fr() - 0.5) * spread * 2, fy + (fr() - 0.5) * spread]);
    pts.sort((a, b) => a[1] - b[1]).forEach(([x, y]) => treeGlyph(g, x, y, 20 + fr() * 10));
  };
  forest(640, 330, 34, 110, 1);   // Dunkelhain
  forest(1180, 600, 26, 90, 2);   // around Ebaril
  forest(560, 610, 14, 60, 3);    // the little wood behind the farm
  forest(1080, 470, 12, 50, 4);

  // ---- roads ----
  const roadMain: [number, number][] = [[340, 480], [430, 500], [530, 525], [640, 515], [770, 505], [900, 480], [1040, 455], [1170, 440], [1285, 432]];
  inkPath(g, roadMain, { width: 2.4, color: 'rgba(90,60,30,0.75)', dash: [10, 7], wobble: 2, seed: 21 });
  inkPath(g, [[770, 505], [820, 590], [880, 660], [905, 720]], { width: 2, color: 'rgba(90,60,30,0.65)', dash: [8, 7], wobble: 2, seed: 22 });

  // ---- places ----
  townGlyph(g, 330, 470, 44);
  label(g, 'Trapas', 330, 505, { size: 34, font: 'head' });
  townGlyph(g, 1290, 425, 44);
  label(g, 'Portas', 1290, 462, { size: 34, font: 'head' });
  townGlyph(g, 905, 726, 34);
  label(g, 'Ignis', 905, 756, { size: 28, font: 'head' });
  townGlyph(g, 1050, 300, 30, INK, '#b5a59a');
  label(g, 'Moneda', 1050, 328, { size: 26, font: 'head' });
  label(g, 'Zwergenstadt', 1050, 351, { size: 18, font: 'italic', color: INK_SOFT });
  // Ebaril, burnt: dark glyph with smoke
  townGlyph(g, 1185, 640, 32, INK, '#6b5240');
  g.save();
  g.strokeStyle = 'rgba(80,60,50,0.45)';
  g.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    const sx = 1172 + i * 12;
    g.moveTo(sx, 610);
    g.bezierCurveTo(sx - 10, 590, sx + 12, 575, sx, 552 - i * 6);
    g.stroke();
  }
  g.restore();
  label(g, 'Ebaril', 1185, 672, { size: 26, font: 'head', color: DANGER });
  label(g, 'niedergebrannt', 1185, 695, { size: 17, font: 'italic', color: 'rgba(158,53,36,0.75)' });
  label(g, 'Dunkelhain', 640, 395, { size: 24, font: 'italic' });
  // Farm (home) and the inn
  g.save();
  g.translate(530, 530);
  g.fillStyle = '#b8743f'; g.strokeStyle = INK; g.lineWidth = 2;
  g.beginPath(); g.rect(-11, -10, 22, 14); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-15, -10); g.lineTo(0, -22); g.lineTo(15, -10); g.closePath(); g.fillStyle = '#8e3d2c'; g.fill(); g.stroke();
  g.restore();
  label(g, 'unser Hof', 530, 556, { size: 20, font: 'italic', color: '#7a2e1f' });
  g.save();
  g.fillStyle = '#b8913c'; g.strokeStyle = INK; g.lineWidth = 2;
  g.beginPath(); g.arc(770, 498, 8, 0, Math.PI * 2); g.fill(); g.stroke();
  g.restore();
  label(g, 'Goldener Eber', 770, 476, { size: 18, font: 'italic', color: INK_SOFT });

  // ---- cartouche ----
  g.save();
  const bx = 1080, by = 86, bw = 370, bh = 110; // inside SAFE (plates pan and crop the edges)
  g.fillStyle = 'rgba(245,234,208,0.85)';
  g.strokeStyle = INK; g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(bx + 20, by); g.lineTo(bx + bw - 20, by); g.quadraticCurveTo(bx + bw, by + bh / 2, bx + bw - 20, by + bh);
  g.lineTo(bx + 20, by + bh); g.quadraticCurveTo(bx, by + bh / 2, bx + 20, by);
  g.fill(); g.stroke();
  g.lineWidth = 1; g.strokeRect(bx + 30, by + 10, bw - 60, bh - 20);
  g.restore();
  label(g, 'SELANTIS', bx + bw / 2, by + 48, { size: 44, font: 'head', spacing: 6 });
  label(g, 'von Mutters Hand', bx + bw / 2, by + 84, { size: 20, font: 'italic', color: INK_SOFT });

  // ---- Crios in the west ----
  g.save();
  g.translate(245, 158);
  g.strokeStyle = INK; g.fillStyle = '#b8913c'; g.lineWidth = 1.6;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rad = i % 2 === 0 ? 30 : 9;
    g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  g.closePath(); g.fill(); g.stroke();
  g.restore();
  label(g, 'Crios', 245, 213, { size: 24, font: 'head' });
  label(g, 'steht immer im Westen', 245, 238, { size: 16, font: 'italic', color: INK_SOFT });

  compass(g, 222, 712, 66, INK);
  frame(g, W, H, 26);
  // A small note in the corner.
  label(g, '„Für meine beiden Mädchen.“', W - 290, H - 96, { size: 20, font: 'italic', color: 'rgba(122,46,31,0.8)' });
  void INK;
  return canvas;
}
