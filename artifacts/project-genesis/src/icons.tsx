/**
 * Ícones desenhados em SVG, sem asset externo.
 *
 * O gate de licença do projeto bloqueia Pixel UI, Dusk Icons e Raven Fantasy
 * Icons, e o release remove a pasta `public/assets`. Antes disto o inventário
 * apontava para um PNG dentro dela que não existe no repositório: os itens
 * apareciam como uma letra solta numa caixa vazia. Tudo aqui é geometria
 * própria, então o runtime continua independente de arte de terceiros.
 */

import type { ReactNode } from 'react';

export type IconItemKind = 'weapon' | 'armor' | 'flask' | 'drop';
export type IconSkillKind = 'strike' | 'burst' | 'heal' | 'dash' | 'control';

type Props = { size?: number; color: string; rank?: number; title?: string };

const VIEW = 24;

function shell(size: number, title: string | undefined, children: ReactNode) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Escurece uma cor hex para servir de contorno/sombra do próprio ícone. */
function shade(hex: string, amount: number): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * amount);
  const g = clamp(((n >> 8) & 255) * amount);
  const b = clamp((n & 255) * amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/* ── Armas ─────────────────────────────────────────────────────────────── */

function Blade({ color, rank = 1 }: { color: string; rank?: number }) {
  const dark = shade(color, 0.55);
  const grip = '#6b5433';
  // A lâmina cresce e ganha guarda mais elaborada conforme o rank.
  const length = 8 - Math.min(3, Math.floor((rank - 1) / 2));
  return (
    <>
      <path d={`M12 ${length} L15 13 L12 17 L9 13 Z`} fill={color} stroke={dark} strokeWidth="1" strokeLinejoin="round" />
      <path d={`M12 ${length} L12 17`} stroke={shade(color, 1.35)} strokeWidth="0.8" opacity="0.7" />
      <rect x="7.5" y="13" width="9" height="1.8" rx="0.6" fill={dark} />
      <rect x="11.1" y="14.8" width="1.8" height="5" rx="0.7" fill={grip} />
      <circle cx="12" cy="20.2" r="1.5" fill={dark} />
      {rank >= 5 && <circle cx="12" cy="20.2" r="0.7" fill={color} />}
    </>
  );
}

function Axe({ color }: { color: string }) {
  const dark = shade(color, 0.55);
  return (
    <>
      <rect x="11.2" y="4" width="1.8" height="16" rx="0.7" fill="#6b5433" />
      <path d="M13 5 C18 5.5 19.5 8.5 18.5 11.5 C16.5 10.5 14.5 10.2 13 10.4 Z" fill={color} stroke={dark} strokeWidth="1" strokeLinejoin="round" />
      <path d="M11 5 C6 5.5 4.5 8.5 5.5 11.5 C7.5 10.5 9.5 10.2 11 10.4 Z" fill={shade(color, 0.85)} stroke={dark} strokeWidth="1" strokeLinejoin="round" />
      <circle cx="12" cy="20.2" r="1.4" fill={dark} />
    </>
  );
}

function Mace({ color }: { color: string }) {
  const dark = shade(color, 0.55);
  const spikes = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <>
      <rect x="11.2" y="10" width="1.7" height="10" rx="0.7" fill="#6b5433" />
      {spikes.map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            x1={12 + Math.cos(rad) * 3.2}
            y1={8 + Math.sin(rad) * 3.2}
            x2={12 + Math.cos(rad) * 5.6}
            y2={8 + Math.sin(rad) * 5.6}
            stroke={dark}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        );
      })}
      <circle cx="12" cy="8" r="3.6" fill={color} stroke={dark} strokeWidth="1" />
      <circle cx="10.8" cy="6.9" r="1.1" fill={shade(color, 1.4)} opacity="0.75" />
      <circle cx="12" cy="20.4" r="1.4" fill={dark} />
    </>
  );
}

function SunRelic({ color }: { color: string }) {
  const dark = shade(color, 0.55);
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <>
      <rect x="11.2" y="11" width="1.7" height="9" rx="0.7" fill="#6b5433" />
      {rays.map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            x1={12 + Math.cos(rad) * 4}
            y1={8 + Math.sin(rad) * 4}
            x2={12 + Math.cos(rad) * 6.8}
            y2={8 + Math.sin(rad) * 6.8}
            stroke={color}
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.9"
          />
        );
      })}
      <circle cx="12" cy="8" r="3.8" fill={color} stroke={dark} strokeWidth="1" />
      <circle cx="12" cy="8" r="1.7" fill={shade(color, 1.45)} />
      <circle cx="12" cy="20.4" r="1.4" fill={dark} />
    </>
  );
}

export function WeaponIcon({ size = 28, color, rank = 1, title }: Props) {
  const art =
    rank >= 7 ? <SunRelic color={color} /> :
    rank === 4 ? <Mace color={color} /> :
    rank === 3 ? <Axe color={color} /> :
    <Blade color={color} rank={rank} />;
  return shell(size, title, art);
}

/* ── Armaduras ─────────────────────────────────────────────────────────── */

export function ArmorIcon({ size = 28, color, rank = 1, title }: Props) {
  const dark = shade(color, 0.55);
  const light = shade(color, 1.3);
  return shell(
    size,
    title,
    <>
      <path
        d="M6 5 L12 3.4 L18 5 L18 12 C18 16.5 15.4 19.4 12 20.6 C8.6 19.4 6 16.5 6 12 Z"
        fill={color}
        stroke={dark}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M12 3.6 L12 20.4" stroke={dark} strokeWidth="0.8" opacity="0.6" />
      {rank >= 3 && (
        <>
          <path d="M7 9.5 H17" stroke={dark} strokeWidth="0.8" opacity="0.65" />
          <path d="M7.4 13 H16.6" stroke={dark} strokeWidth="0.8" opacity="0.65" />
        </>
      )}
      {rank >= 5 && <path d="M9.5 6.4 L12 5.6 L14.5 6.4" stroke={light} strokeWidth="1" fill="none" strokeLinecap="round" />}
      {rank >= 6 && <circle cx="12" cy="11" r="1.6" fill={light} opacity="0.9" />}
    </>
  );
}

/* ── Frasco e drop genérico ────────────────────────────────────────────── */

export function FlaskIcon({ size = 28, color, title }: Props) {
  const dark = shade(color, 0.5);
  return shell(
    size,
    title,
    <>
      <rect x="10.2" y="2.6" width="3.6" height="3" rx="0.8" fill="#7d8a86" />
      <path d="M10.4 5.6 L10.4 9 L6.8 16.4 C6 18.1 7.2 20 9.1 20 H14.9 C16.8 20 18 18.1 17.2 16.4 L13.6 9 L13.6 5.6 Z" fill="#1d2a2a" stroke={dark} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M8.2 14.5 H15.8 L17.2 16.4 C18 18.1 16.8 20 14.9 20 H9.1 C7.2 20 6 18.1 6.8 16.4 Z" fill={color} />
      <circle cx="10.4" cy="17.2" r="0.9" fill={shade(color, 1.5)} opacity="0.85" />
    </>
  );
}

export function DropIcon({ size = 28, color, title }: Props) {
  const dark = shade(color, 0.55);
  return shell(
    size,
    title,
    <>
      <path d="M12 3.5 L20 8 L20 16 L12 20.5 L4 16 L4 8 Z" fill={color} stroke={dark} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M12 3.5 L12 12 L4 8 M12 12 L20 8 M12 12 L12 20.5" stroke={dark} strokeWidth="0.9" fill="none" opacity="0.7" />
    </>
  );
}

/** Escolhe o ícone certo para um item do inventário ou do chão. */
export function ItemIcon({
  kind,
  size = 28,
  color,
  rank = 1,
  title,
}: Props & { kind: IconItemKind }) {
  if (kind === 'weapon') return <WeaponIcon size={size} color={color} rank={rank} title={title} />;
  if (kind === 'armor') return <ArmorIcon size={size} color={color} rank={rank} title={title} />;
  if (kind === 'flask') return <FlaskIcon size={size} color={color} title={title} />;
  return <DropIcon size={size} color={color} title={title} />;
}

/* ── Habilidades ───────────────────────────────────────────────────────── */

export function SkillIcon({ kind, size = 22, color, title }: Props & { kind: IconSkillKind }) {
  const dark = shade(color, 0.5);
  const light = shade(color, 1.4);

  if (kind === 'strike') {
    return shell(size, title, (
      <>
        <path d="M4 19 L15 6" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M13 4 L20 5 L19 12 Z" fill={color} stroke={dark} strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M6.5 17.5 L10 14" stroke={light} strokeWidth="1.1" strokeLinecap="round" opacity="0.8" />
      </>
    ));
  }
  if (kind === 'burst') {
    return shell(size, title, (
      <>
        {[0, 60, 120, 180, 240, 300].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <line
              key={angle}
              x1={12 + Math.cos(rad) * 4.2}
              y1={12 + Math.sin(rad) * 4.2}
              x2={12 + Math.cos(rad) * 9.5}
              y2={12 + Math.sin(rad) * 9.5}
              stroke={color}
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          );
        })}
        <circle cx="12" cy="12" r="3.6" fill={color} stroke={dark} strokeWidth="1" />
        <circle cx="12" cy="12" r="1.4" fill={light} />
      </>
    ));
  }
  if (kind === 'heal') {
    return shell(size, title, (
      <>
        <path d="M12 20 C6 15.5 3.5 12.5 3.5 9.2 C3.5 6.6 5.6 4.8 8 4.8 C9.7 4.8 11.2 5.8 12 7.2 C12.8 5.8 14.3 4.8 16 4.8 C18.4 4.8 20.5 6.6 20.5 9.2 C20.5 12.5 18 15.5 12 20 Z" fill={color} stroke={dark} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M12 9.5 L12 14.5 M9.5 12 L14.5 12" stroke={light} strokeWidth="1.7" strokeLinecap="round" />
      </>
    ));
  }
  if (kind === 'dash') {
    return shell(size, title, (
      <>
        <path d="M4 12 H15" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M13 7 L20 12 L13 17 Z" fill={color} stroke={dark} strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M3 8 H9 M3 16 H9" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      </>
    ));
  }
  // control
  return shell(size, title, (
    <>
      <circle cx="12" cy="12" r="7.5" fill="none" stroke={color} strokeWidth="1.9" strokeDasharray="3.4 2.6" />
      <circle cx="12" cy="12" r="3.2" fill={color} stroke={dark} strokeWidth="1" />
      <circle cx="12" cy="12" r="1.2" fill={light} />
    </>
  ));
}
