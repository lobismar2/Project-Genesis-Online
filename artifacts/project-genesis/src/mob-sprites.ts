/**
 * Sprites de inimigos desenhados no Canvas, um por espécie.
 *
 * Antes disto todo inimigo passava por `drawHeroSprite` com `avatar`
 * indefinido: rato, morcego, goblin, ogro, esqueleto, espectro, serpente e
 * caranguejo eram o mesmo boneco humanoide em cores diferentes. Cada função
 * aqui desenha a silhueta da espécie e responde às mesmas fases de animação
 * (parado, andando, atacando, ferido, morto) usadas pelo resto do jogo.
 *
 * Tudo é geometria própria — o gate de licença do projeto proíbe arte de
 * terceiros no runtime.
 */

export type MobAnimState = 'idle' | 'walk' | 'attack' | 'hurt' | 'dead';
export type MobFacing = 'south' | 'north' | 'east' | 'west';

/** Espécies com silhueta dedicada. Qualquer outro tipo cai no humanoide. */
const DRAWN_TYPES = [
  'rat', 'crab', 'bat', 'goblin', 'skeleton',
  'snake', 'ogre', 'spectre', 'deathknight', 'eventWisp', 'boss',
] as const;
export type DrawnMobType = (typeof DRAWN_TYPES)[number];

export function hasMobSprite(type: string): type is DrawnMobType {
  return (DRAWN_TYPES as readonly string[]).includes(type);
}

/** Escurece ou clareia uma cor hex; serve de contorno e de brilho. */
function tint(hex: string, amount: number): string {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * amount);
  const g = clamp(((n >> 8) & 255) * amount);
  const b = clamp((n & 255) * amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

type Frame = {
  /** Oscilação da passada, zero fora do estado de andar. */
  stride: number;
  /** 0 a 1 conforme o golpe avança. */
  swing: number;
  /** Respiração/flutuação contínua. */
  bob: number;
  /** 0 a 1 conforme a morte progride. */
  fade: number;
};

function frameFor(state: MobAnimState, time: number, seed: number): Frame {
  const phase = time / 115 + seed * 0.01;
  return {
    stride: state === 'walk' ? Math.sin(phase) : 0,
    swing: state === 'attack' ? Math.min(1, Math.abs(Math.sin(time / 85))) : 0,
    bob: Math.sin(time / 520 + seed) * 0.5,
    fade: state === 'dead' ? Math.min(1, (time % 900) / 900) : 0,
  };
}

/* ── Espécies ──────────────────────────────────────────────────────────── */

function drawRat(ctx: CanvasRenderingContext2D, color: string, f: Frame) {
  const dark = tint(color, 0.6);
  ctx.fillStyle = color;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1;
  // Corpo baixo e alongado, patas curtas alternando na passada.
  ctx.beginPath();
  ctx.ellipse(0, 4, 9, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(7.5, 1.5, 4.4, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(11, 0.5);
  ctx.lineTo(14 + f.swing * 3, 1.6);
  ctx.stroke();
  ctx.fillStyle = tint(color, 1.3);
  ctx.beginPath();
  ctx.arc(6.2, -1.6, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a0f0c';
  ctx.beginPath();
  ctx.arc(9, 0.6, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = tint(color, 0.75);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-8, 4);
  ctx.quadraticCurveTo(-15, 2 + f.stride * 3, -17, 7);
  ctx.stroke();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.6;
  for (const [px, dir] of [[-3, 1], [4, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(px, 8);
    ctx.lineTo(px + f.stride * 2 * dir, 11.5);
    ctx.stroke();
  }
}

function drawCrab(ctx: CanvasRenderingContext2D, color: string, f: Frame) {
  const dark = tint(color, 0.6);
  ctx.fillStyle = color;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(0, 3, 10.5, 6.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Pernas em leque, abrindo e fechando com a passada.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const y = 1 + i * 3;
      ctx.beginPath();
      ctx.moveTo(side * 9, y);
      ctx.lineTo(side * (13 + i) + side * f.stride * 1.6, y + 4);
      ctx.stroke();
    }
  }
  // Pinças abrem no golpe.
  const open = f.swing * 3;
  for (const side of [-1, 1]) {
    ctx.fillStyle = tint(color, 1.15);
    ctx.beginPath();
    ctx.ellipse(side * 11, -4 - open * 0.4, 3.6, 4.4, side * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = dark;
    ctx.beginPath();
    ctx.moveTo(side * 12, -6 - open);
    ctx.lineTo(side * 12, -2 + open * 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = '#160a08';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 3, -3, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBat(ctx: CanvasRenderingContext2D, color: string, f: Frame) {
  const dark = tint(color, 0.55);
  // As asas batem sempre; a passada só aumenta a amplitude.
  const flap = Math.sin(f.bob * 6 + f.stride * 2) * 3 + f.stride * 2;
  ctx.fillStyle = color;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 2, -1);
    ctx.quadraticCurveTo(side * 10, -6 - flap, side * 16, -1 - flap * 0.6);
    ctx.quadraticCurveTo(side * 10, 1, side * 2, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = tint(color, 1.2);
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = dark;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 2.4, -4);
    ctx.lineTo(side * 3.6, -8);
    ctx.lineTo(side * 0.8, -5.4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#ffe26b';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 1.5, -1, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSnake(ctx: CanvasRenderingContext2D, color: string, f: Frame) {
  const dark = tint(color, 0.6);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4.4;
  ctx.lineCap = 'round';
  // Corpo ondula; a cabeça sobe e avança no bote.
  ctx.beginPath();
  ctx.moveTo(-11, 9);
  ctx.quadraticCurveTo(-4, 6 + f.stride * 2, 0, 9);
  ctx.quadraticCurveTo(5, 12 - f.stride * 2, 9, 8);
  ctx.stroke();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1;
  const headY = -1 - f.swing * 4;
  const headX = 7 + f.swing * 4;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(9, 8);
  ctx.quadraticCurveTo(headX + 1, 4, headX, headY);
  ctx.stroke();
  ctx.fillStyle = tint(color, 1.15);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(headX, headY, 4.2, 3.2, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1b0d0d';
  ctx.beginPath();
  ctx.arc(headX + 1.6, headY - 0.8, 0.9, 0, Math.PI * 2);
  ctx.fill();
  if (f.swing > 0.3) {
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(headX + 3.4, headY + 1);
    ctx.lineTo(headX + 6.5, headY + 2.2);
    ctx.stroke();
  }
}

function drawGoblin(ctx: CanvasRenderingContext2D, color: string, f: Frame) {
  const dark = tint(color, 0.6);
  ctx.fillStyle = color;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1;
  // Pequeno, curvado, orelhas largas — leitura imediata contra o ogro.
  for (const [px, dir] of [[-3, 1], [3, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(px, 4);
    ctx.lineTo(px + f.stride * 2.4 * dir, 11);
    ctx.lineTo(px + 2 + f.stride * 2.4 * dir, 11);
    ctx.lineTo(px + 2, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-5, -4);
  ctx.lineTo(5, -4);
  ctx.lineTo(6, 5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.5, -8, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tint(color, 0.8);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 3.6, -9);
    ctx.lineTo(side * 9.5, -12.5);
    ctx.lineTo(side * 4, -6.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#ffe97a';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 1.7, -8.4, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#cfd6cf';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(10 + f.swing * 7, -4 - f.swing * 5);
  ctx.stroke();
}

function drawSkeleton(ctx: CanvasRenderingContext2D, color: string, f: Frame, big = false) {
  const bone = color;
  const dark = tint(color, 0.62);
  const k = big ? 1.35 : 1;
  ctx.strokeStyle = dark;
  ctx.fillStyle = bone;
  ctx.lineWidth = 1;
  for (const [px, dir] of [[-3, 1], [2, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(px * k, 4 * k);
    ctx.lineTo((px + f.stride * 2.4 * dir) * k, 12 * k);
    ctx.lineWidth = 2 * k;
    ctx.strokeStyle = bone;
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = dark;
  // Caixa torácica: costelas visíveis, não um torso sólido.
  ctx.beginPath();
  ctx.moveTo(-4.5 * k, -5 * k);
  ctx.lineTo(4.5 * k, -5 * k);
  ctx.lineTo(3.4 * k, 4 * k);
  ctx.lineTo(-3.4 * k, 4 * k);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = dark;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-4 * k, (-3 + i * 2.4) * k);
    ctx.lineTo(4 * k, (-3 + i * 2.4) * k);
    ctx.stroke();
  }
  ctx.fillStyle = bone;
  ctx.beginPath();
  ctx.arc(0, -9.5 * k, 4.6 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#140f0c';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 1.7 * k, -10 * k, 1.2 * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#e8f0ef';
  ctx.lineWidth = 1.8 * k;
  ctx.beginPath();
  ctx.moveTo(5 * k, -2 * k);
  ctx.lineTo((11 + f.swing * 8) * k, (-6 - f.swing * 6) * k);
  ctx.stroke();
  if (big) {
    ctx.strokeStyle = '#ffdb73';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-6 * k, -13 * k);
    ctx.lineTo(-3 * k, -18 * k);
    ctx.lineTo(0, -14 * k);
    ctx.lineTo(3 * k, -18 * k);
    ctx.lineTo(6 * k, -13 * k);
    ctx.stroke();
  }
}

function drawOgre(ctx: CanvasRenderingContext2D, color: string, f: Frame) {
  const dark = tint(color, 0.6);
  ctx.fillStyle = color;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.2;
  for (const [px, dir] of [[-5, 1], [2, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(px, 5);
    ctx.lineTo(px + f.stride * 2 * dir, 13);
    ctx.lineTo(px + 3.6 + f.stride * 2 * dir, 13);
    ctx.lineTo(px + 3.6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Massa larga e ombros altos: silhueta oposta à do goblin.
  ctx.beginPath();
  ctx.moveTo(-9, -7);
  ctx.lineTo(9, -7);
  ctx.lineTo(8, 6);
  ctx.lineTo(-8, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tint(color, 1.1);
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -11, 5.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f4efe0';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 2, -8.5);
    ctx.lineTo(side * 3.2, -6);
    ctx.lineTo(side * 1, -8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#2a1a10';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 2, -12, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // Clava pesada, erguida no golpe.
  ctx.strokeStyle = '#7b5a34';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(9, -1);
  ctx.lineTo(14 + f.swing * 5, -8 - f.swing * 7);
  ctx.stroke();
  ctx.fillStyle = '#8e6a3e';
  ctx.beginPath();
  ctx.arc(15 + f.swing * 6, -10 - f.swing * 8, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpectre(ctx: CanvasRenderingContext2D, color: string, f: Frame) {
  const glow = tint(color, 1.25);
  // Sem pernas: cauda esvoaçante, o oposto visual dos mobs terrestres.
  ctx.globalAlpha *= 0.85;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.quadraticCurveTo(-8, 6, -3 + f.stride * 2, 12);
  ctx.quadraticCurveTo(0, 8, 3 - f.stride * 2, 12);
  ctx.quadraticCurveTo(8, 6, 6, -6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -8, 5.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha /= 0.85;
  ctx.fillStyle = '#0c1020';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 2, -8.6, 1.2, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = glow;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha *= 0.5 + f.swing * 0.5;
  ctx.beginPath();
  ctx.arc(0, -2, 10 + f.swing * 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha /= 0.5 + f.swing * 0.5;
}

function drawDeathKnight(ctx: CanvasRenderingContext2D, color: string, f: Frame) {
  const plate = tint(color, 0.85);
  const dark = tint(color, 0.5);
  ctx.fillStyle = plate;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.2;
  for (const [px, dir] of [[-4, 1], [2, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(px, 5);
    ctx.lineTo(px + f.stride * 2.2 * dir, 12.5);
    ctx.lineTo(px + 3, 12.5);
    ctx.lineTo(px + 3, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-7, -7);
  ctx.lineTo(7, -7);
  ctx.lineTo(6, 6);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#c9d6ff';
  ctx.globalAlpha *= 0.6;
  ctx.beginPath();
  ctx.moveTo(-4, -5);
  ctx.lineTo(-4, 5);
  ctx.moveTo(4, -5);
  ctx.lineTo(4, 5);
  ctx.stroke();
  ctx.globalAlpha /= 0.6;
  // Elmo fechado com fenda acesa.
  ctx.fillStyle = dark;
  ctx.strokeStyle = tint(color, 0.4);
  ctx.beginPath();
  ctx.moveTo(-5, -14);
  ctx.lineTo(5, -14);
  ctx.lineTo(5.5, -7.5);
  ctx.lineTo(-5.5, -7.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7ce0ff';
  ctx.fillRect(-3.4, -11.4, 6.8, 1.6);
  ctx.strokeStyle = '#dfeaff';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(7, -2);
  ctx.lineTo(14 + f.swing * 9, -8 - f.swing * 7);
  ctx.stroke();
}

function drawWisp(ctx: CanvasRenderingContext2D, color: string, f: Frame, time: number) {
  const glow = tint(color, 1.35);
  ctx.globalAlpha *= 0.9;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, f.bob * 2, 5.4 + f.swing * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(-1.4, f.bob * 2 - 1.4, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha /= 0.9;
  // Partículas em órbita marcam que é um alvo de evento, não um bicho.
  ctx.fillStyle = glow;
  for (let i = 0; i < 4; i += 1) {
    const angle = time / 420 + (i * Math.PI) / 2;
    ctx.globalAlpha *= 0.7;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 9, Math.sin(angle) * 6 + f.bob * 2, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha /= 0.7;
  }
}

/* ── Entrada única ─────────────────────────────────────────────────────── */

/**
 * Desenha o inimigo do tipo pedido. Devolve `false` quando a espécie não tem
 * silhueta própria, para quem chama cair no humanoide genérico.
 */
export function drawMobSprite(
  ctx: CanvasRenderingContext2D,
  type: string,
  x: number,
  y: number,
  scale: number,
  state: MobAnimState,
  facing: MobFacing,
  time: number,
  color: string
): boolean {
  if (!hasMobSprite(type)) return false;

  const f = frameFor(state, time, x);
  const shake = state === 'hurt' ? Math.sin(time / 35) * scale * 0.1 : 0;
  const airborne = type === 'bat' || type === 'spectre' || type === 'eventWisp';
  const lift = airborne ? f.bob * 2 : state === 'walk' ? Math.abs(f.stride) * -scale * 0.05 : 0;

  ctx.save();
  ctx.translate(x + shake, y + lift);
  if (facing === 'west') ctx.scale(-1, 1);
  ctx.globalAlpha = state === 'dead' ? Math.max(0.18, 1 - f.fade * 0.8) : 1;
  ctx.scale(scale / 17, scale / 17);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Sombra: menor e mais difusa para quem voa.
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * (airborne ? 0.14 : 0.22);
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, airborne ? 12 : 11, airborne ? 6 : 10, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha;

  // Ao morrer o corpo tomba antes de sumir.
  if (state === 'dead') {
    ctx.translate(0, f.fade * 6);
    ctx.rotate(f.fade * 0.5);
  }

  if (type === 'rat') drawRat(ctx, color, f);
  else if (type === 'crab') drawCrab(ctx, color, f);
  else if (type === 'bat') drawBat(ctx, color, f);
  else if (type === 'goblin') drawGoblin(ctx, color, f);
  else if (type === 'snake') drawSnake(ctx, color, f);
  else if (type === 'ogre') drawOgre(ctx, color, f);
  else if (type === 'spectre') drawSpectre(ctx, color, f);
  else if (type === 'deathknight') drawDeathKnight(ctx, color, f);
  else if (type === 'eventWisp') drawWisp(ctx, color, f, time);
  else if (type === 'boss') drawSkeleton(ctx, color, f, true);
  else drawSkeleton(ctx, color, f);

  ctx.restore();
  return true;
}
