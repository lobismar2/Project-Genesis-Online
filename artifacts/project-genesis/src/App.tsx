import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import { Archive, BookOpen, FlaskConical, Gauge, Heart, PackageOpen, RotateCcw, Shield, Sparkles, Sword, Trophy, X, Zap } from 'lucide-react';
import { accountId, applyBankOperation, combatAction, createProgressPersistence, createRoom, currentUser, getPeers, isAccountRequiredError, joinRoom, loadProgress, login, logout, newPlayerId, saveProgress, SESSION_EXPIRED_NOTICE, syncPlayer, type AuthUser, type BankOperation, type CommerceTransaction, type CombatEnemyState, type ProgressSnapshot, type RemotePlayer } from '@/lib/coop';

type Faction = 'awakened' | 'consortium';
type Tile = 'grass' | 'grass2' | 'dark' | 'dead' | 'path' | 'water' | 'sand' | 'mountain' | 'lava' | 'safeA' | 'safeC' | 'cave';
type MapId = 'hub' | 'forest' | 'cave' | 'ice' | 'volcano';
type ItemKind = 'weapon' | 'armor' | 'flask' | 'drop';
type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
type Status = 'burn' | 'slow' | 'poison' | 'stun' | 'ward';
type Skill = { id: string; name: string; short: string; cost: number; cooldown: number; unlock: number; color: string; kind: 'strike' | 'burst' | 'heal' | 'dash' | 'control' };
type ClassDef = { id: string; name: string; role: string; icon: string; faction: Faction; color: string; hp: number; mana: number; power: number; armor: number; passive: string; skills: [Skill, Skill, Skill]; ultimate: Skill };
type Avatar = ClassDef;
type Item = { id: string; name: string; icon: string; rank: number; rarity: Rarity; power?: number; armor?: number };
type GroundItem = Item & { itemId: string; kind: ItemKind; x: number; y: number; fromMob?: boolean };
type StatusEffect = { id: string; kind: Status; duration: number; power: number };
type Facing = 'south' | 'east' | 'north' | 'west';
type AnimState = 'idle' | 'walk' | 'attack' | 'hurt' | 'dead';
type VisualEffect = { id: string; kind: Skill['kind']; x: number; y: number; color: string; life: number; maxLife: number; radius: number; label?: string };
type Enemy = {
  id: string; type: string; name: string; hp: number; maxHp: number; armor: number; weapon: number; x: number; y: number;
  spawnX: number; spawnY: number; neutral: boolean; boss?: boolean; color: string; state: 'idle' | 'chase' | 'attack' | 'dead';
  atkCd: number; wander: number; angry: boolean; deadTimer: number; behavior: 'melee' | 'ranged' | 'charger' | 'summoner'; phase?: 1 | 2 | 3; status: StatusEffect[]; facing: Facing; anim: AnimState; animTime: number;
};
const COMBAT_COIN_REWARDS: Record<string, number> = { rat: 3, crab: 3, goblin: 3, bat: 5, skeleton: 5, snake: 5, ogre: 8, spectre: 8, deathknight: 8, boss: 100 };
type Npc = { id: string; name: string; icon: string; faction: Faction; x: number; y: number; lines: string[]; portrait?: string };
type Potion = { id: string; name: string; icon: string; price: number; effect: string; cooldown: number };
const POTIONS: Potion[] = [
  { id: 'potion-life', name: 'Poção de Vida', icon: '♥', price: 12, effect: 'cura 45 HP', cooldown: 8 },
  { id: 'potion-mana', name: 'Poção de Mana', icon: '✦', price: 14, effect: 'recupera 35 mana', cooldown: 8 },
  { id: 'potion-antidote', name: 'Antídoto', icon: '✚', price: 10, effect: 'remove veneno', cooldown: 6 },
];
const SELL_VALUES: Record<string, number> = { flask: 4, fang: 6, shell: 7, herb: 5 };
type Player = {
  avatar: Avatar; x: number; y: number; target: string | null; moveTarget: { x: number; y: number } | null; weaponRank: number; armorRank: number;
  maxHp: number; hp: number; mana: number; maxMana: number; level: number; xp: number; nextXp: number; flasks: number; atkCd: number;
  combatTimer: number; regenTimer: number; invincible: number; dying: boolean; lastZone?: string; skills: Record<string, number>; statuses: StatusEffect[]; facing: Facing; anim: AnimState; animTime: number;
};
type GameState = {
  player: Player; mapId: MapId; map: Tile[][]; objects: { type: string; x: number; y: number; r?: number; taken?: boolean; target?: MapId; label?: string }[];
  enemies: Enemy[]; npcs: Npc[]; items: GroundItem[]; cam: { x: number; y: number };
  floaters: { x: number; y: number; text: string; color: string; life: number }[]; effects: VisualEffect[];
  save: { ach: Record<string, boolean>; kills: Record<string, number>; revives: number; dmgTaken: number; missions: Record<string, number>; accepted: Record<string, boolean>; completed: Record<string, boolean>; rewarded: Record<string, boolean>; inventory: Record<string, number>; bank: Record<string, number>; bankOperations: Record<string, BankOperation>; commerceLedger: Record<string, CommerceTransaction>; coins: number; eventWeek?: string; eventClaimed?: boolean; dungeonCleared?: boolean };
  firePotion: number;
};
let latestRemotePlayers: RemotePlayer[] = [];
let activeProgressPersistence: { account: string; characterId: string; revision: MutableRefObject<number>; onRevision: (revision: number) => void; onError: (message: string) => void; save: (snapshot: ProgressSnapshot) => Promise<{ revision: number } | null> } | undefined;
let activeTravel: ((target: MapId) => void) | undefined;

const TILE_SIZE = 32;
const COLS = 90;
const ROWS = 64;
const WORLD_W = COLS * TILE_SIZE;
const WORLD_H = ROWS * TILE_SIZE;
const RARITY_COLORS: Record<Rarity, string> = { common: '#a9b1a4', uncommon: '#82d28a', rare: '#72c9ff', epic: '#c99aff', legendary: '#ffd36b' };
const RARITY_LABEL: Record<Rarity, string> = { common: 'comum', uncommon: 'incomum', rare: 'raro', epic: 'épico', legendary: 'lendário' };
const WEAPONS: Item[] = [
  { id: 'sword1', name: 'Adaga Prática', icon: 'I', rank: 1, rarity: 'common', power: 1 }, { id: 'sword2', name: 'Espada de Aço', icon: 'II', rank: 2, rarity: 'uncommon', power: 2 },
  { id: 'axe', name: 'Machado', icon: 'III', rank: 3, rarity: 'uncommon', power: 3 }, { id: 'morningstar', name: 'Maça Estrela', icon: 'IV', rank: 4, rarity: 'rare', power: 4 },
  { id: 'bluesword', name: 'Lâmina Azul', icon: 'V', rank: 5, rarity: 'rare', power: 5 }, { id: 'redsword', name: 'Lâmina Rubra', icon: 'VI', rank: 6, rarity: 'epic', power: 6 },
  { id: 'goldensword', name: 'Relíquia Solar', icon: 'VII', rank: 7, rarity: 'legendary', power: 8 },
];
const ARMORS: Item[] = [
  { id: 'clotharmor', name: 'Traje de Pano', icon: 'I', rank: 1, rarity: 'common', armor: 1 }, { id: 'leatherarmor', name: 'Couraça de Couro', icon: 'II', rank: 2, rarity: 'uncommon', armor: 2 },
  { id: 'mailarmor', name: 'Cota de Malha', icon: 'III', rank: 3, rarity: 'uncommon', armor: 3 }, { id: 'platearmor', name: 'Armadura de Placas', icon: 'IV', rank: 4, rarity: 'rare', armor: 4 },
  { id: 'redarmor', name: 'Armadura Rubra', icon: 'V', rank: 5, rarity: 'rare', armor: 5 }, { id: 'goldenarmor', name: 'Armadura Solar', icon: 'VI', rank: 6, rarity: 'legendary', armor: 7 },
];
const ITEM_CATALOG = [...WEAPONS, ...ARMORS];
const skill = (id: string, name: string, short: string, cost: number, cooldown: number, unlock: number, color: string, kind: Skill['kind']): Skill => ({ id, name, short, cost, cooldown, unlock, color, kind });
const AVATARS: Avatar[] = [
  { id: 'moss', name: 'Colosso de Musgo', role: 'Vanguarda', icon: 'M', faction: 'awakened', color: '#79c56c', hp: 145, mana: 70, power: 1.05, armor: 4, passive: 'Casca Antiga: recebe 12% menos dano.', skills: [skill('root', 'Raízes', 'Prende o alvo', 18, 6, 1, '#79c56c', 'control'), skill('slam', 'Abalo', 'Golpe em área', 26, 9, 3, '#c7df83', 'burst'), skill('bark', 'Casca', 'Ganha proteção', 32, 14, 5, '#93e0b1', 'heal')], ultimate: skill('forest', 'Coração da Mata', 'Cura e atordoa', 0, 26, 7, '#e8f6a8', 'heal') },
  { id: 'thorn', name: 'Espreitador de Espinhos', role: 'Atirador', icon: 'T', faction: 'awakened', color: '#df76ad', hp: 94, mana: 115, power: 1.3, armor: 1, passive: 'Predador: 18% de dano extra contra alvos marcados.', skills: [skill('volley', 'Rajada', 'Flechas em sequência', 17, 5, 1, '#f19ac5', 'strike'), skill('snare', 'Armadilha', 'Diminui o alvo', 22, 8, 3, '#e6b06e', 'control'), skill('venom', 'Seiva Tóxica', 'Aplica veneno', 29, 12, 5, '#bde879', 'strike')], ultimate: skill('bramble', 'Círculo de Espinhos', 'Explosão de área', 0, 25, 7, '#ffb2d9', 'burst') },
  { id: 'spore', name: 'Tecelão de Esporos', role: 'Controlador', icon: 'S', faction: 'awakened', color: '#b685e2', hp: 86, mana: 155, power: 1.0, armor: 1, passive: 'Micélio: regenera 2 mana por segundo.', skills: [skill('sporebolt', 'Esporo', 'Projétil corrosivo', 15, 4, 1, '#d2a4f6', 'strike'), skill('cloud', 'Nuvem', 'Veneno em área', 30, 10, 3, '#b7e27d', 'burst'), skill('mend', 'Regeneração', 'Cura gradual', 35, 15, 5, '#8ee3c0', 'heal')], ultimate: skill('bloom', 'Floração', 'Grande nuvem tóxica', 0, 27, 7, '#e9c2ff', 'burst') },
  { id: 'mother', name: 'Guardião Raiz', role: 'Suporte', icon: 'R', faction: 'awakened', color: '#98c96b', hp: 118, mana: 130, power: 1.08, armor: 3, passive: 'Seiva: poções curam 25% a mais.', skills: [skill('vine', 'Chicote de Vinha', 'Puxa e golpeia', 16, 5, 1, '#b4df78', 'strike'), skill('ward', 'Broto Guardião', 'Cria uma barreira', 28, 11, 3, '#9ae0b5', 'heal'), skill('pulse', 'Pulso Vital', 'Cura aliados', 34, 14, 5, '#c9f29a', 'heal')], ultimate: skill('grove', 'Santuário', 'Cura e protege', 0, 28, 7, '#f4f0a0', 'heal') },
  { id: 'tungsten', name: 'Vanguarda de Tungstênio', role: 'Tanque', icon: 'V', faction: 'consortium', color: '#5dddf1', hp: 158, mana: 72, power: 1.1, armor: 5, passive: 'Placas: bloqueia 15% do dano recebido.', skills: [skill('bash', 'Impacto', 'Atordoa o alvo', 15, 5, 1, '#71e8f5', 'control'), skill('guard', 'Postura', 'Aumenta a armadura', 24, 12, 3, '#9bd8ff', 'heal'), skill('magnet', 'Campo Magnético', 'Puxa inimigos', 31, 13, 5, '#bbf2ff', 'burst')], ultimate: skill('fortress', 'Fortaleza', 'Imortalidade breve', 0, 30, 7, '#e1fbff', 'heal') },
  { id: 'neon', name: 'Lâmina Neon', role: 'Duelista', icon: 'N', faction: 'consortium', color: '#d0f85a', hp: 96, mana: 105, power: 1.52, armor: 2, passive: 'Sobrecarga: ataques críticos restauram 5 mana.', skills: [skill('dash', 'Investida', 'Avança e corta', 18, 5, 1, '#d8ff72', 'dash'), skill('parry', 'Parada', 'Reflete o próximo golpe', 25, 10, 3, '#fff08c', 'control'), skill('flurry', 'Lâminas', 'Três ataques rápidos', 32, 12, 5, '#baff29', 'strike')], ultimate: skill('afterimage', 'Pós-imagem', 'Ataque devastador', 0, 24, 7, '#f4ffbd', 'strike') },
  { id: 'hex', name: 'Artilheiro Hex', role: 'Atirador', icon: 'H', faction: 'consortium', color: '#ff9b47', hp: 90, mana: 138, power: 1.42, armor: 1, passive: 'Munição instável: ataques à distância explodem em área.', skills: [skill('shot', 'Disparo Hex', 'Projétil preciso', 14, 4, 1, '#ffb873', 'strike'), skill('mine', 'Mina Íon', 'Armadilha explosiva', 26, 9, 3, '#ffda78', 'burst'), skill('overclock', 'Overclock', 'Acelera ataques', 34, 15, 5, '#ff835c', 'heal')], ultimate: skill('barrage', 'Barragem Orbital', 'Chuva de projéteis', 0, 26, 7, '#ffe1a8', 'burst') },
  { id: 'bio', name: 'Engenheiro Biossonda', role: 'Artífice', icon: 'B', faction: 'consortium', color: '#63e6cf', hp: 108, mana: 145, power: 1.16, armor: 2, passive: 'Circuito fechado: cooldowns recuperam 10% mais rápido.', skills: [skill('drone', 'Drone', 'Torreta auxiliar', 20, 7, 1, '#83fae4', 'strike'), skill('patch', 'Reparo', 'Restaura vida', 28, 10, 3, '#81e8b5', 'heal'), skill('shock', 'Pulso EMP', 'Atordoa em área', 30, 12, 5, '#9bddff', 'control')], ultimate: skill('singularity', 'Singularidade', 'Colapso gravitacional', 0, 29, 7, '#c3fff4', 'burst') },
];
const MOB_TEMPLATES: Record<string, { name: string; hp: number; armor: number; weapon: number; neutral: boolean; color: string; behavior: Enemy['behavior']; boss?: boolean }> = {
  rat: { name: 'Rato-pardo', hp: 25, armor: 1, weapon: 1, neutral: true, color: '#9a7a5a', behavior: 'charger' }, crab: { name: 'Caranguejo', hp: 60, armor: 2, weapon: 1, neutral: true, color: '#d05030', behavior: 'melee' },
  bat: { name: 'Morcego', hp: 80, armor: 2, weapon: 1, neutral: true, color: '#8060a5', behavior: 'ranged' }, goblin: { name: 'Goblin', hp: 90, armor: 2, weapon: 1, neutral: false, color: '#4aab65', behavior: 'charger' },
  skeleton: { name: 'Esqueleto', hp: 110, armor: 2, weapon: 2, neutral: false, color: '#ddd4b8', behavior: 'ranged' }, snake: { name: 'Serpente', hp: 150, armor: 3, weapon: 2, neutral: false, color: '#70a65a', behavior: 'charger' },
  ogre: { name: 'Ogro', hp: 200, armor: 3, weapon: 2, neutral: false, color: '#ad8b4f', behavior: 'melee' }, spectre: { name: 'Espectro', hp: 250, armor: 2, weapon: 4, neutral: false, color: '#9bb6ff', behavior: 'ranged' },
  deathknight: { name: 'Cavaleiro da Morte', hp: 250, armor: 3, weapon: 3, neutral: false, color: '#886644', behavior: 'melee' }, eventWisp: { name: 'Faísca do Eclipse', hp: 115, armor: 2, weapon: 2, neutral: false, color: '#e28aff', behavior: 'ranged' }, boss: { name: 'Rei Esqueleto', hp: 900, armor: 5, weapon: 6, neutral: false, color: '#ffcc44', behavior: 'summoner', boss: true },
};
const ACHIEVEMENTS = [['warrior', 'Um Verdadeiro Guerreiro', 'Encontre uma arma nova.', 'W'], ['wild', 'Rumo ao Desconhecido', 'Saia da vila inicial.', 'F'], ['rats', 'Ratos Furiosos', 'Mate 10 ratos.', 'R'], ['talk', 'Bate-papo', 'Fale com um NPC.', 'D'], ['loot', 'Grande Saque', 'Consiga uma armadura nova.', 'A'], ['cave', 'Subterrâneo', 'Explore uma caverna.', 'C'], ['shore', 'No Fim do Mundo', 'Alcance a praia ao sul.', 'S'], ['escape', 'Nhá! Nhá!', 'Fuja de um inimigo.', 'E'], ['graveyard', 'Saqueador de Tumbas', 'Encontre o cemitério.', 'G'], ['skulls', 'Colecionador de Caveiras', 'Mate 10 esqueletos.', 'K'], ['ninja', 'Saque Ninja', 'Pegue um item sem lutar.', 'N'], ['desert', 'Terra de Ninguém', 'Atravesse o deserto.', 'D'], ['hunter', 'Caçador', 'Mate 50 inimigos.', 'H'], ['alive', 'Ainda Vivo', 'Reviva 5 vezes.', '♥'], ['meatshield', 'Escudo de Carne', 'Receba 5000 de dano.', 'M'], ['hotspot', 'Ponto Quente', 'Entre nas montanhas.', '▲'], ['hero', 'Herói', 'Derrote o chefe final.', 'K'], ['foxy', 'Poção Rara', 'Encontre a poção especial.', '◆'], ['science', 'Pela Ciência', 'Entre em um portal.', 'O'], ['nomore', 'Rato! Nunca Mais', 'Mate 50 ratos.', 'R']] as const;
type Mission = { id: string; region: string; npcId: string; title: string; desc: string; goal: number; reward: string; kind: 'kill' | 'gear' | 'zone' | 'phase'; target?: string; xp: number; item?: string; unlock?: string; prerequisite?: string };
const MISSIONS: Mission[] = [
  { id: 'hub-forest-scout', region: 'Vila do Limiar', npcId: 'steward', title: 'Mapa das quatro fronteiras', desc: 'Explore as Florestas Brilhantes', goal: 1, reward: '120 XP · título Cartógrafo', kind: 'zone', target: 'forest', xp: 120 },
  { id: 'hub-cave-scout', region: 'Vila do Limiar', npcId: 'steward', title: 'Ouça os cristais', desc: 'Explore as Cavernas de Cristal', goal: 1, reward: '160 XP · 20 moedas', kind: 'zone', target: 'cave', xp: 160 },
  { id: 'hub-ice-scout', region: 'Vila do Limiar', npcId: 'steward', title: 'Rastro no gelo', desc: 'Explore a Geleira do Silêncio', goal: 1, reward: '180 XP · 20 moedas', kind: 'zone', target: 'ice', xp: 180 },
  { id: 'hub-volcano-scout', region: 'Vila do Limiar', npcId: 'steward', title: 'Cinzas ao sul', desc: 'Explore a Caldeira Rubra', goal: 1, reward: '220 XP · 30 moedas', kind: 'zone', target: 'volcano', xp: 220 },
  { id: 'threshold-dungeon', region: 'Vila do Limiar', npcId: 'steward', title: 'A Cripta do Sino', desc: 'Complete a mini-dungeon sob a vila', goal: 1, reward: '300 XP · título Guardião do Sino', kind: 'zone', target: 'threshold-dungeon', xp: 300 },
  { id: 'weekly-eclipse', region: 'Vila do Limiar', npcId: 'eventmaster', title: 'Eclipse semanal', desc: 'Derrote 3 Faíscas do Eclipse durante o evento', goal: 3, reward: 'Título Vigia do Eclipse · drop cosmético', kind: 'kill', target: 'eventWisp', xp: 0 },
  { id: 'forest-rats', region: 'Floresta', npcId: 'guide', title: 'Raízes sob ameaça', desc: 'Derrote 3 ratos na floresta', goal: 3, reward: '120 XP · 2 frascos', kind: 'kill', target: 'rat', xp: 120 },
  { id: 'forest-gear', region: 'Floresta', npcId: 'elder', title: 'Ferramentas certas', desc: 'Equipe uma arma incomum', goal: 1, reward: '180 XP · Machado', kind: 'gear', xp: 180, item: 'axe', prerequisite: 'forest-rats' },
  { id: 'grave-souls', region: 'Cemitério', npcId: 'elder', title: 'Vozes no cemitério', desc: 'Derrote 5 esqueletos', goal: 5, reward: '260 XP · Lâmina Azul', kind: 'kill', target: 'skeleton', xp: 260, item: 'bluesword', prerequisite: 'forest-gear' },
  { id: 'cave-bats', region: 'Caverna', npcId: 'guide', title: 'Ecos da caverna', desc: 'Derrote 4 morcegos na Caverna Antiga', goal: 4, reward: '300 XP · Cota de Malha', kind: 'kill', target: 'bat', xp: 300, item: 'mailarmor', prerequisite: 'grave-souls' },
  { id: 'cave-portal', region: 'Caverna', npcId: 'guide', title: 'O pulso antigo', desc: 'Entre no portal de pesquisa', goal: 1, reward: '220 XP · desbloqueia Deserto', kind: 'zone', target: 'wasteland', xp: 220, unlock: 'desert', prerequisite: 'cave-bats' },
  { id: 'desert-snakes', region: 'Deserto', npcId: 'smith', title: 'Areia viva', desc: 'Derrote 5 serpentes no deserto', goal: 5, reward: '360 XP · 3 frascos', kind: 'kill', target: 'snake', xp: 360, prerequisite: 'cave-portal' },
  { id: 'desert-crossing', region: 'Deserto', npcId: 'smith', title: 'Travessia de cinzas', desc: 'Alcance as Montanhas Vulcânicas', goal: 1, reward: '400 XP · desbloqueia Montanhas', kind: 'zone', target: 'volcano', xp: 400, unlock: 'mountains', prerequisite: 'desert-snakes' },
  { id: 'mountain-knights', region: 'Montanhas', npcId: 'sentry', title: 'Sentinelas quebradas', desc: 'Derrote 3 Cavaleiros da Morte', goal: 3, reward: '520 XP · Armadura Rubra', kind: 'kill', target: 'deathknight', xp: 520, item: 'redarmor', prerequisite: 'desert-crossing' },
  { id: 'mountain-phases', region: 'Montanhas', npcId: 'sentry', title: 'Coroa partida', desc: 'Reduza o Rei Esqueleto a 3 fases', goal: 3, reward: '600 XP · Relíquia Solar', kind: 'phase', target: 'boss', xp: 600, item: 'goldensword', prerequisite: 'mountain-knights' },
  { id: 'mountain-king', region: 'Montanhas', npcId: 'sentry', title: 'O último amanhecer', desc: 'Derrote o Rei Esqueleto', goal: 1, reward: '1000 XP · título Herói', kind: 'kill', target: 'boss', xp: 1000, unlock: 'campaign-complete', prerequisite: 'mountain-phases' },
];
const REGIONS = ['Vila do Limiar', 'Floresta', 'Cemitério', 'Caverna', 'Deserto', 'Montanhas'];
const MINIMAP_REGIONS = [
  { name: 'Vila do Limiar', x: .50, y: .50 },
  { name: 'Floresta', x: .10, y: .50 },
  { name: 'Cemitério', x: .18, y: .14 },
  { name: 'Caverna', x: .37, y: .20 },
  { name: 'Deserto', x: .55, y: .72 },
  { name: 'Montanhas', x: .88, y: .15 },
] as const;
export type MinimapRegion = (typeof MINIMAP_REGIONS)[number];
export type MinimapPointer = { clientX: number; clientY: number };
export type MinimapRect = { left: number; top: number; width: number; height: number };

export function minimapRegionAtPointer(pointer: MinimapPointer, rect: MinimapRect): MinimapRegion | undefined {
  const x = (pointer.clientX - rect.left) / rect.width;
  const y = (pointer.clientY - rect.top) / rect.height;
  return MINIMAP_REGIONS.find((region) => Math.hypot(region.x - x, region.y - y) < .1);
}

export function focusMinimapRegion(player: Pick<Player, 'moveTarget' | 'target'>, region: MinimapRegion) {
  player.moveTarget = { x: region.x * WORLD_W, y: region.y * WORLD_H };
  return region.name;
}

export function clearFocusedRegionAtArrival(player: Pick<Player, 'x' | 'y' | 'moveTarget'>, focusedRegion: string | null) {
  if (focusedRegion && player.moveTarget && Math.hypot(player.moveTarget.x - player.x, player.moveTarget.y - player.y) < 4) {
    player.moveTarget = null;
    return null;
  }
  return focusedRegion;
}

export function missionMapTarget(mission: Pick<Mission, 'target' | 'region'>): MapId | null {
  if (mission.target && ['hub', 'forest', 'cave', 'ice', 'volcano'].includes(mission.target)) return mission.target as MapId;
  if (mission.region === 'Vila do Limiar') return 'hub';
  if (mission.region === 'Floresta' || mission.region === 'Cemitério') return 'forest';
  if (mission.region === 'Caverna') return 'cave';
  if (mission.region === 'Deserto' || mission.region === 'Montanhas') return 'volcano';
  return null;
}

function randomInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function seededRandom(seed: string) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function maxHp(armor: number, avatar: Avatar) { return avatar.hp + (armor - 1) * 22; }
function tileAt(g: GameState, x: number, y: number) { return g.map[Math.floor(y / TILE_SIZE)]?.[Math.floor(x / TILE_SIZE)] ?? 'mountain'; }
function blocked(g: GameState, x: number, y: number) { return ['water', 'mountain', 'lava'].includes(tileAt(g, x, y)); }
function safeAt(x: number, y: number) { return (x < WORLD_W * .15 && y > WORLD_H * .4 && y < WORLD_H * .62) || (x > WORLD_W * .85 && y > WORLD_H * .4 && y < WORLD_H * .62); }
function zoneFor(mapId: MapId, x: number, y: number) {
  if (mapId === 'hub') return { id: 'hub', name: 'Vila do Limiar' };
  if (mapId !== 'forest') return { id: mapId, name: MAP_INFO[mapId].name };
  if (x < WORLD_W * .15 && y > WORLD_H * .4 && y < WORLD_H * .62) return { id: 'safe', name: 'Base dos Despertos' };
  if (x > WORLD_W * .85 && y > WORLD_H * .4 && y < WORLD_H * .62) return { id: 'safeC', name: 'Cidadela Industrial' };
  if (x > WORLD_W * .72 && y < WORLD_H * .55) return { id: 'volcano', name: 'Montanhas Vulcânicas' };
  if (x > WORLD_W * .45 && y > WORLD_H * .55) return { id: 'desert', name: 'Deserto de Cinzas' };
  if (x < WORLD_W * .32 && y < WORLD_H * .26) return { id: 'graveyard', name: 'Cemitério' };
  if (x > WORLD_W * .3 && x < WORLD_W * .44 && y > WORLD_H * .12 && y < WORLD_H * .28) return { id: 'cave', name: 'Caverna Antiga' };
  if (y > WORLD_H * .86) return { id: 'shore', name: 'Praia ao Sul' };
  if (x < WORLD_W * .45) return { id: 'forest', name: 'Florestas Brilhantes' };
  return { id: 'wasteland', name: 'Terras Partidas' };
}
const MAP_INFO: Record<MapId, { name: string; subtitle: string; entry: { x: number; y: number }; exit: MapId }> = {
  hub: { name: 'Vila do Limiar', subtitle: 'um refúgio seguro entre quatro fronteiras', entry: { x: .5, y: .5 }, exit: 'forest' },
  forest: { name: 'Florestas Brilhantes', subtitle: 'raízes antigas e caminhos vivos', entry: { x: .12, y: .5 }, exit: 'cave' },
  cave: { name: 'Cavernas de Cristal', subtitle: 'ecos, cristais e túneis esquecidos', entry: { x: .12, y: .5 }, exit: 'ice' },
  ice: { name: 'Geleira do Silêncio', subtitle: 'neve eterna sob um céu partido', entry: { x: .12, y: .5 }, exit: 'volcano' },
  volcano: { name: 'Caldeira Rubra', subtitle: 'lava, cinzas e máquinas derretidas', entry: { x: .12, y: .5 }, exit: 'forest' },
};
const MAP_LABELS: Record<MapId, string> = { hub: 'Vila', forest: 'Floresta', cave: 'Caverna', ice: 'Geleira', volcano: 'Vulcão' };
export function isMapId(value: unknown): value is MapId { return typeof value === 'string' && value in MAP_INFO; }
export function nextMapId(mapId: MapId): MapId { return MAP_INFO[mapId].exit; }
/**
 * Destino da "Passagem" — o portal lateral de cada mapa fora da vila.
 *
 * Antes era `mapId === 'forest' ? 'cave' : 'forest'`, que mandava Floresta e
 * Vulcão para o mesmo lugar que a própria saída deles: dois portais, um
 * destino, e a Passagem virava um portal sem função. Agora ele anda para trás
 * na cadeia (o mapa cuja saída é este), o que dá três destinos distintos em
 * todo mapa e faz cada caminho de ida ter volta.
 */
export function sidePassageMapId(mapId: MapId): MapId {
  const previous = (Object.keys(MAP_INFO) as MapId[]).find(
    (candidate) => candidate !== 'hub' && candidate !== mapId && MAP_INFO[candidate].exit === mapId
  );
  return previous ?? 'hub';
}
export function makeMap(mapId: MapId = 'forest', random = seededRandom(`map:${mapId}:v1`)) {
  const map: Tile[][] = [];
  for (let r = 0; r < ROWS; r++) { map[r] = []; for (let c = 0; c < COLS; c++) { const nx = c / COLS, ny = r / ROWS; let t: Tile = mapId === 'hub' ? (random() < .3 ? 'grass2' : 'safeA') : mapId === 'cave' ? (random() < .5 ? 'cave' : 'dark') : mapId === 'ice' ? (random() < .7 ? 'water' : 'dark') : mapId === 'volcano' ? (random() < .45 ? 'lava' : 'mountain') : (random() < .35 ? 'grass2' : 'grass'); if (nx < .04 || ny < .04 || nx > .96 || ny > .96) t = mapId === 'ice' ? 'water' : mapId === 'hub' ? 'safeA' : 'dark'; if (mapId === 'forest' && nx > .45 && nx < .72 && ny > .55) t = random() < .7 ? 'sand' : 'dead'; if (mapId === 'forest' && nx > .22 && nx < .3 && ny > .28 && ny < .42) t = 'water'; if (mapId === 'ice' && nx > .25 && nx < .75 && ny > .28 && ny < .72 && random() < .18) t = 'mountain'; if (mapId === 'volcano' && random() < .14) t = 'dead'; if ((mapId === 'forest' || mapId === 'hub') && nx < .15 && ny > .4 && ny < .62) t = 'safeA'; if (mapId === 'hub' && ((nx > .42 && nx < .58) || (ny > .42 && ny < .58))) t = 'path'; if (c >= 42 && c <= 48 && r >= 8 && r <= 54) t = 'path'; map[r][c] = t; } }
  for (let c = 45; c <= 82; c++) for (let r = 8; r <= 11; r++) map[r][c] = 'path';
  for (let r = 8; r <= 22; r++) for (let c = 78; c <= 81; c++) map[r][c] = 'path';
  for (let c = 4; c <= 12; c++) for (let r = 29; r <= 34; r++) map[r][c] = 'path';
  return map;
}
function freeSpot(g: GameState, x: number, y: number, radius = 100, random = Math.random) { for (let i = 0; i < 80; i++) { const nx = Math.max(24, Math.min(WORLD_W - 24, x + (random() - .5) * radius)); const ny = Math.max(24, Math.min(WORLD_H - 24, y + (random() - .5) * radius)); if (!blocked(g, nx, ny) && !safeAt(nx, ny)) return { x: nx, y: ny }; } return { x, y }; }
function recordOf(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function numberRecord(value: unknown): Record<string, number> { return Object.fromEntries(Object.entries(recordOf(value)).map(([key, item]) => [key, Math.max(0, Number(item) || 0)])); }
function inventoryRecord(value: unknown, defaults: Record<string, number>): Record<string, number> {
  const source = recordOf(value);
  return Object.fromEntries(Object.keys({ ...defaults, ...Object.fromEntries(ITEM_CATALOG.map((item) => [item.id, 0])), flask: 0, 'event-lantern': 0, ...Object.fromEntries(POTIONS.map((potion) => [potion.id, 0])) })
    .map((id) => [id, nonNegativeInt(source[id], defaults[id] ?? 0, 999)]));
}
function booleanRecord(value: unknown): Record<string, boolean> { return Object.fromEntries(Object.entries(recordOf(value)).filter(([, item]) => item === true).map(([key]) => [key, true])); }
function nonNegativeInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(0, Math.floor(number))) : fallback;
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}
function boundedRank(value: unknown, fallback: number, max: number) {
  if (value === 0) return 0;
  if (typeof value === 'number' && value < 0) return fallback;
  return Math.min(max, Math.max(1, nonNegativeInt(value, fallback)));
}
function knownBooleanRecord(value: unknown, ids: readonly string[]) {
  const source = booleanRecord(value);
  return Object.fromEntries(ids.filter((id) => source[id]).map((id) => [id, true]));
}

/**
 * Converts either the local `{ version, ...snapshot }` shape or the server's
 * snapshot into a safe snapshot. Invalid fields are replaced independently so
 * one damaged value cannot discard the rest of a player's campaign.
 */
export function normalizePersistedProgress(value: unknown, avatarId: string, defaults: ProgressSnapshot): ProgressSnapshot | null {
  const stored = recordOf(value);
  if (stored.avatar !== avatarId) return null;
  const missionIds = MISSIONS.map((mission) => mission.id);
  const achievementIds = ACHIEVEMENTS.map(([id]) => id);
  const missionsSource = recordOf(stored.missions);
  const missions = Object.fromEntries(missionIds
    .filter((id) => Object.prototype.hasOwnProperty.call(missionsSource, id))
    .map((id) => [id, Math.min(MISSIONS.find((mission) => mission.id === id)!.goal, nonNegativeInt(missionsSource[id], 0))]));
  const completed = knownBooleanRecord(stored.completed, missionIds);
  const rewarded = knownBooleanRecord(stored.rewarded, missionIds);
  // Completion and reward are one-way facts. This repairs old saves and
  // partially-written saves without ever making a reward available twice.
  missionIds.forEach((id) => {
    if (completed[id]) rewarded[id] = true;
    if (rewarded[id]) completed[id] = true;
  });
  const accepted = knownBooleanRecord(stored.accepted, missionIds);
  Object.keys(missions).forEach((id) => { accepted[id] = true; });
  return {
    avatar: avatarId,
    mapId: typeof stored.mapId === 'string' && ['hub', 'forest', 'cave', 'ice', 'volcano'].includes(stored.mapId) ? stored.mapId : defaults.mapId,
    ...(typeof stored.eventWeek === 'string' && /^\d{4}-W\d{2}$/.test(stored.eventWeek) ? { eventWeek: stored.eventWeek } : {}),
    weaponRank: boundedRank(stored.weaponRank, defaults.weaponRank, WEAPONS.length),
    armorRank: boundedRank(stored.armorRank, defaults.armorRank, ARMORS.length),
    flasks: nonNegativeInt(stored.flasks, defaults.flasks, 99),
    coins: nonNegativeInt(stored.coins, defaults.coins ?? 0, 1_000_000_000),
    level: nonNegativeInt(stored.level, defaults.level, 999),
    xp: nonNegativeInt(stored.xp, defaults.xp, 1_000_000_000),
    nextXp: Math.max(1, nonNegativeInt(stored.nextXp, defaults.nextXp, 1_000_000_000)),
    ach: knownBooleanRecord(stored.ach, achievementIds),
    kills: numberRecord(stored.kills),
    revives: nonNegativeInt(stored.revives, defaults.revives),
    dmgTaken: nonNegativeInt(stored.dmgTaken, defaults.dmgTaken),
    missions,
    accepted,
    completed,
    rewarded,
    inventory: inventoryRecord(stored.inventory, defaults.inventory),
    bank: inventoryRecord(stored.bank, {}),
    bankOperations: Object.fromEntries(Object.entries(recordOf(stored.bankOperations)).filter(([id, value]) => {
      const operation = recordOf(value);
      return /^[a-zA-Z0-9_.:-]{1,128}$/.test(id)
        && typeof operation.itemId === 'string'
        && ['flask', ...ITEM_CATALOG.map((item) => item.id), ...POTIONS.map((potion) => potion.id)].includes(operation.itemId)
        && /^(deposit|withdraw)$/.test(String(operation.direction))
        && Number.isInteger(operation.amount)
        && Number(operation.amount) >= 1 && Number(operation.amount) <= 999;
    }).map(([id, value]) => [id, {
      id,
      itemId: String(recordOf(value).itemId),
      direction: recordOf(value).direction as BankOperation['direction'],
      amount: Number(recordOf(value).amount),
    }])),
    commerceLedger: Object.fromEntries(Object.entries(recordOf(stored.commerceLedger)).filter(([id, value]) => {
      const operation = recordOf(value);
      return /^[a-zA-Z0-9_.:-]{1,128}$/.test(id) && operation
        && ['buy', 'sell', 'buyback'].includes(String(operation.kind))
        && typeof operation.itemId === 'string' && ['flask', ...ITEM_CATALOG.map((item) => item.id), ...Object.keys(SELL_VALUES)].includes(operation.itemId)
        && Number.isInteger(operation.amount) && Number(operation.amount) >= 1 && Number(operation.amount) <= 999
        && Number.isInteger(operation.coins) && Number(operation.coins) >= 0;
    }).map(([id, value]) => [id, { id, kind: recordOf(value).kind as CommerceTransaction['kind'], itemId: String(recordOf(value).itemId), amount: Number(recordOf(value).amount), coins: Number(recordOf(value).coins), ...(Number.isSafeInteger(recordOf(value).soldAt) ? { soldAt: Number(recordOf(value).soldAt) } : {}) }])),
  };
}
function createGame(avatar: Avatar, mapId: MapId = 'forest', restoreSavedMap = true): GameState {
  try { const stored = JSON.parse(localStorage.getItem('genesis-save') ?? 'null') as { avatar?: unknown; mapId?: unknown } | null; if (restoreSavedMap && stored?.avatar === avatar.id && typeof stored.mapId === 'string' && stored.mapId in MAP_INFO) mapId = stored.mapId as MapId; } catch { /* local storage may be unavailable */ }
  const random = seededRandom(`world:${mapId}:v1`);
  const map = makeMap(mapId, random);
  const player: Player = { avatar, x: mapId === 'hub' ? WORLD_W * .5 : mapId === 'forest' && avatar.faction === 'consortium' ? WORLD_W * .88 : WORLD_W * .12, y: WORLD_H * .5, target: null, moveTarget: null, weaponRank: 1, armorRank: 1, maxHp: maxHp(1, avatar), hp: maxHp(1, avatar), mana: avatar.mana, maxMana: avatar.mana, level: 1, xp: 0, nextXp: 120, flasks: 2, atkCd: 0, combatTimer: 0, regenTimer: 2, invincible: 0, dying: false, skills: {}, statuses: [], facing: 'south', anim: 'idle', animTime: 0 };
  const g: GameState = { player, mapId, map, objects: [], enemies: [], npcs: [], items: [], cam: { x: player.x, y: player.y }, floaters: [], effects: [], firePotion: 0, save: { ach: {}, kills: {}, revives: 0, dmgTaken: 0, missions: {}, accepted: {}, completed: {}, rewarded: {}, inventory: { sword1: 1, clotharmor: 1, flask: 2 }, bank: {}, bankOperations: {}, commerceLedger: {}, coins: 0 } };
  try {
    const stored = JSON.parse(localStorage.getItem('genesis-save') ?? 'null');
    const normalized = normalizePersistedProgress(stored, avatar.id, progressSnapshot(g));
    if (normalized) applyProgress(g, normalized, restoreSavedMap);
  } catch { /* local storage may be unavailable */ }
  const week = `${new Date().getUTCFullYear()}-W${String(Math.ceil((new Date().getUTCDate() + new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).getUTCDay()) / 7)).padStart(2, '0')}`;
  if (g.save.eventWeek !== week) { g.save.eventWeek = week; g.save.eventClaimed = false; g.save.missions['weekly-eclipse'] = 0; g.save.completed['weekly-eclipse'] = false; g.save.rewarded['weekly-eclipse'] = false; }
  const scenery = mapId === 'hub' ? 'tree' : mapId === 'forest' ? 'tree' : mapId === 'cave' ? 'crystal' : mapId === 'ice' ? 'iceberg' : 'vent';
  for (let i = 0; i < 120; i++) { const x = random() * WORLD_W, y = random() * WORLD_H; if (!blocked(g, x, y)) g.objects.push({ type: scenery, x, y, r: 10 + random() * 9 }); }
  if (mapId === 'hub') {
    (['forest', 'cave', 'ice', 'volcano'] as MapId[]).forEach((target, index) => {
      const positions = [{ x: .5, y: .08 }, { x: .08, y: .5 }, { x: .5, y: .92 }, { x: .92, y: .5 }];
      const position = positions[index];
      g.objects.push({ type: 'portal', target, label: `Portal · ${MAP_LABELS[target]}`, x: WORLD_W * position.x, y: WORLD_H * position.y, r: 28 });
    });
    g.objects.push({ type: 'dungeon', x: WORLD_W * .5, y: WORLD_H * .28, r: 30, label: 'Cripta do Sino · mini-dungeon' });
    g.objects.push({ type: 'event', x: WORLD_W * .66, y: WORLD_H * .5, r: 30, label: 'Eclipse semanal · recompensa cosmética' });
  } else {
    g.objects.push({ type: 'portal', target: MAP_INFO[mapId].exit, label: `Saída para ${MAP_LABELS[MAP_INFO[mapId].exit]}`, x: WORLD_W * .08, y: WORLD_H * .5, r: 48 });
    const passage = sidePassageMapId(mapId);
    g.objects.push({ type: 'portal', target: passage, label: `Passagem para ${MAP_LABELS[passage]}`, x: WORLD_W * .92, y: WORLD_H * .5, r: 28 });
    g.objects.push({ type: 'portal', target: 'hub', label: 'Vila do Limiar', x: WORLD_W * .5, y: WORLD_H * .92, r: 28 });
  }
    const spawn = (type: string, count: number, cx: number, cy: number, spread: number) => { const t = MOB_TEMPLATES[type]; for (let i = 0; i < count; i++) { const p = freeSpot(g, cx * WORLD_W + (random() - .5) * spread * WORLD_W, cy * WORLD_H + (random() - .5) * spread * WORLD_H, 100, random); g.enemies.push({ ...t, type, id: `${type}-${i}`, hp: t.hp, maxHp: t.hp, x: p.x, y: p.y, spawnX: p.x, spawnY: p.y, state: 'idle', atkCd: 0, wander: 2 + random() * 3, angry: false, deadTimer: 0, status: [], facing: 'south', anim: 'idle', animTime: random() * 2 }); } };
   if (mapId === 'forest') { spawn('rat', 16, .12, .5, .1); spawn('goblin', 12, .35, .62, .12); spawn('skeleton', 14, .18, .14, .1); spawn('snake', 12, .55, .72, .12); }
   if (mapId === 'cave') { spawn('bat', 16, .4, .3, .3); spawn('spectre', 8, .7, .7, .2); spawn('skeleton', 8, .8, .2, .16); }
   if (mapId === 'ice') { spawn('crab', 12, .3, .7, .3); spawn('spectre', 10, .6, .3, .25); spawn('ogre', 6, .75, .7, .18); }
   if (mapId === 'volcano') { spawn('goblin', 10, .3, .3, .25); spawn('snake', 12, .55, .6, .22); spawn('deathknight', 8, .78, .25, .18); }
   if (mapId === 'hub') spawn('eventWisp', 5, .68, .5, .12);
   const boss = freeSpot(g, WORLD_W * .88, WORLD_H * .15, 80, random); if (mapId !== 'hub') g.enemies.push({ ...MOB_TEMPLATES.boss, type: 'boss', id: 'skeleton-king', hp: 900, maxHp: 900, x: boss.x, y: boss.y, spawnX: boss.x, spawnY: boss.y, state: 'idle', atkCd: 0, wander: 3, angry: false, deadTimer: 0, phase: 1, status: [], facing: 'south', anim: 'idle', animTime: 0 });
   for (let i = 0; i < 3; i++) { const p = freeSpot(g, boss.x + (random() - .5) * 130, boss.y + 90, 80, random); const t = MOB_TEMPLATES.deathknight; g.enemies.push({ ...t, type: 'deathknight', id: `guard-${i}`, hp: t.hp, maxHp: t.hp, x: p.x, y: p.y, spawnX: p.x, spawnY: p.y, state: 'idle', atkCd: 0, wander: 2, angry: false, deadTimer: 0, status: [], facing: 'south', anim: 'idle', animTime: 0 }); }
   g.npcs = [{ id: 'guide', name: 'Guardião da Árvore-Mãe', icon: 'G', faction: 'awakened', x: WORLD_W * .1, y: WORLD_H * .5, lines: ['Bem-vindo, filho das raízes.', 'O mundo se partiu há um século.', 'Escolha suas técnicas com 1, 2, 3 e 4.', 'O Rei Esqueleto muda de forma ao perder vida.'] }, { id: 'elder', name: 'Ancião da Floresta', icon: 'E', faction: 'awakened', x: WORLD_W * .07, y: WORLD_H * .55, lines: ['Espectros ao norte guardam a Lâmina Rubra.', 'Seu nível abre novas técnicas.'] }, { id: 'smith', name: 'Ferreiro do Consórcio', icon: 'F', faction: 'consortium', x: WORLD_W * .9, y: WORLD_H * .5, lines: ['Interface online.', 'Raridade define o atributo do equipamento.', 'Leve frascos de vida. Muitos.'] }, { id: 'sentry', name: 'Sentinela Neon', icon: 'N', faction: 'consortium', x: WORLD_W * .93, y: WORLD_H * .55, lines: ['Zona segura ativa.', 'Nenhum inimigo passa destas muralhas.'] }];
   g.npcs.push({ id: 'bank', name: 'Guardião do Cofre', icon: 'B', faction: avatar.faction, x: avatar.faction === 'awakened' ? WORLD_W * .16 : WORLD_W * .84, y: WORLD_H * .5 + 52, lines: ['Seu cofre está protegido pela sessão atual.', 'Deposite itens para liberar espaço na bolsa.', 'Retire apenas o que precisar para continuar a jornada.'] });
   if (mapId === 'hub') {
     g.npcs.push({ id: 'steward', name: 'Maia, Cartógrafa do Limiar', icon: '✦', faction: avatar.faction, x: WORLD_W * .42, y: WORLD_H * .5, lines: ['A Vila do Limiar liga as quatro fronteiras sem interromper a campanha.', 'Aceite objetivos de exploração e volte aqui para entregar recompensas.'] });
     g.npcs.push({ id: 'eventmaster', name: 'Ivo, Vigia do Eclipse', icon: '☽', faction: avatar.faction, x: WORLD_W * .74, y: WORLD_H * .5, lines: ['Toda semana o Eclipse chama Faíscas para a praça.', 'Seus ataques são telegrafados: afaste-se do círculo antes do impacto.', 'Derrote três e receba o título Vigia do Eclipse e a Lâmpada Violeta.'] });
   }
   g.npcs.push({ id: 'vendor', name: 'Lira, a Vendedora', icon: '$', faction: avatar.faction, x: avatar.faction === 'awakened' ? WORLD_W * .22 : WORLD_W * .78, y: WORLD_H * .5 - 38, lines: ['Mercadorias honestas, preços visíveis.', 'Compre poções sem surpresa: o efeito e a recarga estão na etiqueta.'] });
   g.npcs.push({ id: 'buyer', name: 'Orin, o Comprador', icon: '↺', faction: avatar.faction, x: avatar.faction === 'awakened' ? WORLD_W * .27 : WORLD_W * .73, y: WORLD_H * .5 + 38, lines: ['Trago valor justo por materiais e drops.', 'Itens equipados ficam protegidos. Você pode vender em lote ou recomprar por pouco tempo.'] });
   g.npcs.push({ id: 'alchemist', name: 'Nima, a Alquimista', icon: '⚗', faction: avatar.faction, x: avatar.faction === 'awakened' ? WORLD_W * .32 : WORLD_W * .68, y: WORLD_H * .5 - 38, lines: ['Vida, mana e antídoto: cada frasco tem um propósito.', 'Use com calma: poções têm recarga para evitar desperdício.'] });
   const p = freeSpot(g, WORLD_W * .25, WORLD_H * .34, 65, random); g.items.push({ ...WEAPONS[2], itemId: 'axe', kind: 'weapon', x: p.x, y: p.y, fromMob: false });
  return g;
}

function progressSnapshot(g: GameState): ProgressSnapshot {
  return { avatar: g.player.avatar.id, mapId: g.mapId, weaponRank: g.player.weaponRank, armorRank: g.player.armorRank, flasks: g.player.flasks, level: g.player.level, xp: g.player.xp, nextXp: g.player.nextXp, coins: g.save.coins, ...(g.save.eventWeek ? { eventWeek: g.save.eventWeek } : {}), ...(g.save.eventClaimed ? { eventClaimed: true } : {}), ...(g.save.dungeonCleared ? { dungeonCleared: true } : {}), ach: g.save.ach, kills: g.save.kills, revives: g.save.revives, dmgTaken: g.save.dmgTaken, missions: g.save.missions, accepted: g.save.accepted, completed: g.save.completed, rewarded: g.save.rewarded, inventory: g.save.inventory, bank: g.save.bank, bankOperations: g.save.bankOperations, commerceLedger: g.save.commerceLedger };
}

/**
 * `restoreMap` precisa ser falso quando quem chama já escolheu o mapa — é o
 * caso de uma viagem por portal. Sem isso, o mapa salvo (o anterior)
 * sobrescrevia `g.mapId` logo depois de createGame montar o mapa de destino:
 * o jogador via o mundo novo, mas `mapId` continuava o antigo, o efeito que
 * destrava `travelRef` (dependente de `game.mapId`) nunca rodava, e todos os
 * portais seguintes ficavam mortos até recarregar a página.
 */
function applyProgress(g: GameState, stored: ProgressSnapshot, restoreMap = true) {
  const normalized = normalizePersistedProgress(stored, g.player.avatar.id, progressSnapshot(g));
  if (!normalized) return;
  Object.assign(g.player, { weaponRank: normalized.weaponRank, armorRank: normalized.armorRank, flasks: normalized.flasks, level: normalized.level, xp: normalized.xp, nextXp: normalized.nextXp });
  if (restoreMap) g.mapId = (normalized.mapId as MapId | undefined) ?? g.mapId;
  g.player.maxHp = maxHp(g.player.armorRank, g.player.avatar); g.player.hp = g.player.maxHp; g.player.mana = g.player.maxMana;
  g.save = { ach: normalized.ach, kills: normalized.kills, revives: normalized.revives, dmgTaken: normalized.dmgTaken, missions: normalized.missions, accepted: normalized.accepted, completed: normalized.completed, rewarded: normalized.rewarded, inventory: normalized.inventory, bank: normalized.bank ?? {}, bankOperations: normalized.bankOperations ?? {}, commerceLedger: normalized.commerceLedger ?? {}, coins: normalized.coins ?? 0, eventWeek: normalized.eventWeek, eventClaimed: normalized.eventClaimed, dungeonCleared: normalized.dungeonCleared };
}
function addInventoryItem(game: GameState, itemId: string, amount = 1) {
  game.save.inventory[itemId] = Math.min(999, (game.save.inventory[itemId] ?? 0) + amount);
}
function applyMissionReward(game: GameState, mission: Mission) {
  if (game.save.completed[mission.id] || game.save.rewarded[mission.id] || (game.save.missions[mission.id] ?? 0) < mission.goal) return false;
  const p = game.player;
  p.xp += mission.xp;
  const coinReward = 10 + mission.goal * 2;
  game.save.coins = Math.min(1_000_000_000, game.save.coins + coinReward);
  while (p.xp >= p.nextXp) { p.xp -= p.nextXp; p.level++; p.nextXp = Math.round(p.nextXp * 1.32); p.maxHp += 8; p.maxMana += 8; p.hp = p.maxHp; p.mana = p.maxMana; }
  if (mission.item) { const item = [...WEAPONS, ...ARMORS].find((x) => x.id === mission.item); if (item) addInventoryItem(game, item.id); if (item?.power) p.weaponRank = Math.max(p.weaponRank, item.rank); if (item?.armor) { p.armorRank = Math.max(p.armorRank, item.rank); p.maxHp = maxHp(p.armorRank, p.avatar); p.hp = p.maxHp; } }
  if (mission.id === 'forest-rats') { p.flasks += 2; addInventoryItem(game, 'flask', 2); }
  if (mission.id === 'desert-snakes') { p.flasks += 3; addInventoryItem(game, 'flask', 3); }
  game.save.rewarded[mission.id] = true;
  game.save.completed[mission.id] = true;
  return true;
}

const CHARACTER_SHEET_SIZE = 64;
const CHARACTER_SHEET_COLUMNS = 12;
const CHARACTER_SHEET_ROWS = 22;
const spriteImages = new Map<string, HTMLImageElement>();
const spriteImageFailures = new Set<string>();
const standaloneSpriteImages = new Map<string, HTMLImageElement>();
const standaloneSpriteFailures = new Set<string>();
const SPRITE_DIRECTION_ROW: Record<Facing, number> = { south: 0, west: 1, east: 2, north: 3 };

function getCharacterSheet(avatar: Avatar) {
  const existing = spriteImages.get(avatar.id);
  if (existing || spriteImageFailures.has(avatar.id)) return existing;
  const image = new Image();
  spriteImageFailures.add(avatar.id);
  image.onerror = () => spriteImageFailures.add(avatar.id);
  spriteImages.set(avatar.id, image);
  return image;
}

function getStandaloneSprite(path: string) {
  return undefined;
}

const GROUND_ITEM_SPRITES: Record<ItemKind, string> = { weapon: '', armor: '', flask: '', drop: '' };
const groundItemImages = new Map<string, HTMLImageElement>();
const groundItemImageFailures = new Set<string>();

function drawGroundItemSprite(ctx: CanvasRenderingContext2D, item: GroundItem, time: number) {
  return false;
  /*
  const path = GROUND_ITEM_SPRITES[item.kind];
  let image = groundItemImages.get(path);
  if (!image && !groundItemImageFailures.has(path)) {
    image = new Image();
    image.src = path;
    image.onerror = () => groundItemImageFailures.add(path);
    groundItemImages.set(path, image);
  }
  if (!image || !image.complete || !image.naturalWidth || !image.naturalHeight) return false;
  const bob = Math.sin(time / 260 + item.x * .02) * 1.5;
  ctx.save();
  ctx.translate(item.x, item.y + bob);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, -12, -19, 24, 24);
  ctx.restore();
  return true;
  */
}

function drawRealHeroSprite(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, state: AnimState, facing: Facing, time: number, avatar: Avatar) {
  if (avatar.id === 'moss' && state === 'idle' && facing === 'south') {
    const frame = Math.floor(time / 480) % 2 + 1;
    const image = null as unknown as HTMLImageElement | undefined;
    if (!image || !image.complete || !image.naturalWidth || !image.naturalHeight) return false;
    const height = Math.max(54, scale * 3.45);
    const width = height * image.naturalWidth / image.naturalHeight;
    ctx.save();
    ctx.translate(x, y + 2);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, -width / 2, -height, width, height);
    ctx.restore();
    return true;
  }
  const image = getCharacterSheet(avatar);
  if (!image || !image.complete || image.naturalWidth < CHARACTER_SHEET_SIZE * CHARACTER_SHEET_COLUMNS || image.naturalHeight < CHARACTER_SHEET_SIZE * CHARACTER_SHEET_ROWS) return false;
  const direction = SPRITE_DIRECTION_ROW[facing];
  const actionRow = state === 'idle' || state === 'walk' ? direction : state === 'attack' ? 4 + direction : state === 'hurt' ? 8 + direction : 12 + direction;
  const frameCount = state === 'walk' ? 4 : state === 'attack' ? 6 : state === 'hurt' ? 4 : state === 'dead' ? 6 : 1;
  const frame = state === 'idle' ? 0 : Math.floor(time / (state === 'attack' ? 90 : 130)) % frameCount;
  const destination = Math.max(34, scale * 2.35);
  const bob = state === 'walk' ? Math.abs(Math.sin(time / 130)) * -scale * .06 : 0;
  const hurtOffset = state === 'hurt' ? Math.sin(time / 35) * scale * .1 : 0;
  const deadProgress = state === 'dead' ? Math.min(1, (time % 900) / 900) : 0;
  ctx.save();
  ctx.translate(x + hurtOffset, y + bob + deadProgress * 7);
  if (facing === 'west') ctx.scale(-1, 1);
  ctx.globalAlpha = state === 'dead' ? Math.max(.18, 1 - deadProgress * .8) : state === 'hurt' && Math.sin(time / 35) < -.2 ? .48 : 1;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, frame * CHARACTER_SHEET_SIZE, actionRow * CHARACTER_SHEET_SIZE, CHARACTER_SHEET_SIZE, CHARACTER_SHEET_SIZE, -destination / 2, -destination, destination, destination);
  ctx.restore();
  return true;
}

function drawHeroSprite(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, scale: number, state: AnimState, facing: Facing, time: number, avatar?: Avatar, boss = false) {
  if (avatar && drawRealHeroSprite(ctx, x, y, scale, state, facing, time, avatar)) return;
  const phase = time / 115 + x * .01;
  const walk = state === 'walk' ? Math.sin(phase) * scale * .16 : 0;
  const bob = state === 'idle' ? Math.sin(time / 520 + x) * scale * .025 : state === 'walk' ? Math.abs(Math.sin(phase)) * -scale * .06 : 0;
  const attack = state === 'attack' ? Math.min(1, Math.abs(Math.sin(time / 85))) : 0;
  const hurt = state === 'hurt' ? Math.sin(time / 35) * scale * .1 : 0;
  const dying = state === 'dead' ? Math.min(1, (time % 900) / 900) : 0;
  const metal = avatar?.faction === 'consortium' || !avatar;
  const accent = avatar?.color ?? color;
  const id = avatar?.id ?? '';
  ctx.save();
  ctx.translate(x + hurt, y + bob);
  if (facing === 'west') ctx.scale(-1, 1);
  ctx.globalAlpha = state === 'dead' ? Math.max(.18, 1 - dying * .8) : 1;
  const s = scale / 21;
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Ground shadow and a small directional cast shadow keep the sprites anchored.
  ctx.globalAlpha *= .22;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(0, 9, 12 + Math.abs(walk) * .3, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = state === 'dead' ? Math.max(.18, 1 - dying * .8) : 1;
  ctx.translate(0, state === 'dead' ? dying * 7 : 0);
  // Back arm / cloak silhouette changes with the four facing directions.
  ctx.fillStyle = metal ? '#293a43' : '#244b2c';
  ctx.strokeStyle = metal ? '#79d2dc' : '#8fc86a';
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-12, 5 + walk); ctx.lineTo(-7, 8); ctx.lineTo(-4, 1); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Legs have a deliberate two-frame stride.
  ctx.fillStyle = metal ? '#38525d' : '#315b32';
  ctx.beginPath(); ctx.moveTo(-6, 5); ctx.lineTo(-4 + walk, 13); ctx.lineTo(-1 + walk, 13); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1, 5); ctx.lineTo(3 - walk, 13); ctx.lineTo(6 - walk, 13); ctx.lineTo(6, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Torso: roots for the Awakened, layered plates for the Consortium.
  ctx.fillStyle = metal ? '#536d76' : color;
  ctx.beginPath(); ctx.moveTo(-8, -7); ctx.lineTo(7, -7); ctx.lineTo(8, 6); ctx.lineTo(-7, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (metal) {
    ctx.strokeStyle = '#b4f3ef'; ctx.globalAlpha = .65;
    ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(-5, 5); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.moveTo(5, -6); ctx.lineTo(5, 5); ctx.stroke();
    ctx.globalAlpha = state === 'dead' ? Math.max(.18, 1 - dying * .8) : 1;
  } else {
    ctx.strokeStyle = '#b7e879'; ctx.globalAlpha = .8;
    ctx.beginPath(); ctx.moveTo(-5, -5); ctx.quadraticCurveTo(-1, 0, -4, 5); ctx.moveTo(4, -5); ctx.quadraticCurveTo(1, 1, 5, 5); ctx.stroke();
    ctx.globalAlpha = state === 'dead' ? Math.max(.18, 1 - dying * .8) : 1;
  }
  // Front arm swings forward during attacks and points along the facing axis.
  ctx.strokeStyle = metal ? '#9be7e7' : '#a4db72'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(9 + attack * 7, 2 - attack * 6 + walk); ctx.stroke();
  ctx.fillStyle = metal ? '#9bb7bd' : '#6a9d48'; ctx.beginPath(); ctx.arc(9 + attack * 7, 2 - attack * 6 + walk, 2.2, 0, Math.PI * 2); ctx.fill();
  // Helmets, masks and class markers make all eight classes readable at a glance.
  ctx.fillStyle = metal ? '#354d58' : '#396c38';
  ctx.beginPath(); ctx.arc(0, -11, 6.6, Math.PI, 0); ctx.lineTo(6.6, -8); ctx.lineTo(-6.6, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = accent; ctx.globalAlpha = .9;
  ctx.fillRect(-2.2, -15, 4.4, 2.2);
  if (id === 'moss' || id === 'mother') { ctx.strokeStyle = '#9be36b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4, -16); ctx.quadraticCurveTo(-8, -22, -5, -24); ctx.moveTo(3, -16); ctx.quadraticCurveTo(8, -22, 5, -24); ctx.stroke(); }
  if (id === 'thorn') { ctx.strokeStyle = '#f19ac5'; ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(-12, -9); ctx.moveTo(7, -5); ctx.lineTo(12, -9); ctx.stroke(); }
  if (id === 'spore' || id === 'bio') { ctx.fillStyle = accent; ctx.globalAlpha = .7; ctx.beginPath(); ctx.arc(9, -17, 2.5, 0, Math.PI * 2); ctx.arc(-9, -20, 1.8, 0, Math.PI * 2); ctx.fill(); }
  if (id === 'neon' || id === 'hex' || id === 'tungsten') { ctx.strokeStyle = accent; ctx.lineWidth = 1.4; ctx.strokeRect(-8, -18, 16, 8); }
  // Weapon silhouette is class-specific and extends on the attack frame.
  ctx.strokeStyle = id === 'hex' || id === 'bio' ? '#d7fbff' : metal ? '#e4f4f1' : '#d3bb83';
  ctx.lineWidth = 1.5;
  const weaponX = 11 + attack * 8, weaponY = -4 - attack * 8;
  if (id === 'moss' || id === 'tungsten') { ctx.beginPath(); ctx.moveTo(weaponX, weaponY - 5); ctx.lineTo(weaponX, weaponY + 9); ctx.stroke(); ctx.fillStyle = '#83a451'; ctx.fillRect(weaponX - 2, weaponY - 7, 4, 4); }
  else if (id === 'thorn' || id === 'hex') { ctx.beginPath(); ctx.moveTo(weaponX - 1, weaponY + 5); ctx.lineTo(weaponX + 8 + attack * 4, weaponY - 4); ctx.stroke(); ctx.beginPath(); ctx.arc(weaponX + 7, weaponY - 5, 3, 0, Math.PI * 2); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(weaponX - 2, weaponY + 5); ctx.lineTo(weaponX + 8 + attack * 4, weaponY - 7); ctx.stroke(); }
  if (boss) { ctx.strokeStyle = '#ffdb73'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-7, -17); ctx.lineTo(-3, -23); ctx.lineTo(0, -18); ctx.lineTo(4, -23); ctx.lineTo(8, -17); ctx.stroke(); }
  ctx.restore();
}

const VISUAL_STATES: AnimState[] = ['idle', 'walk', 'attack', 'hurt', 'dead'];
const VISUAL_FACINGS: Facing[] = ['south', 'east', 'north', 'west'];
const FACING_LABELS: Record<Facing, string> = { south: 'S', east: 'L', north: 'N', west: 'O' };

function SpriteAudit() {
  const refs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const cases = useMemo(() => AVATARS.flatMap((avatar) => [
    ...VISUAL_STATES.map((state) => ({ avatar, state, facing: 'south' as Facing })),
    ...VISUAL_FACINGS.map((facing) => ({ avatar, state: 'walk' as AnimState, facing })),
    ...VISUAL_FACINGS.map((facing) => ({ avatar, state: 'attack' as AnimState, facing })),
  ]), []);

  useEffect(() => {
    cases.forEach(({ avatar, state, facing }) => {
      const canvas = refs.current[`${avatar.id}-state-${state}`] ?? refs.current[`${avatar.id}-${state}-${facing}`];
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = avatar.faction === 'consortium' ? '#102a30' : '#152719';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const previewTime = state === 'dead' ? 600 : state === 'attack' ? 80 : state === 'hurt' ? 30 : 420;
      drawHeroSprite(ctx, 32, 29, avatar.color, 18, state, facing, previewTime, avatar);
    });
  }, [cases]);

  return <div className="overlay visual-audit-overlay" data-testid="panel-visual-audit">
    <div className="visual-audit-sheet hud-card">
      <div className="visual-audit-head">
        <div><div className="micro">roteiro de leitura visual</div><h2>Laboratório de combate</h2><p>Confira cada classe antes de alterar sprites, combate ou efeitos.</p></div>
        <div className="visual-audit-summary" data-testid="visual-audit-summary"><strong>8/8</strong><span>classes cobertas</span><strong>5/5</strong><span>estados</span><strong>4/4</strong><span>direções</span></div>
      </div>
      <div className="visual-audit-legend">
        <span>Estados: <b>idle</b> · <b>walk</b> · <b>attack</b> · <b>hurt</b> · <b>dead</b></span>
        <span>Direções: <b>S</b> sul · <b>L</b> leste · <b>N</b> norte · <b>O</b> oeste</span>
      </div>
      <div className="visual-audit-grid">
        {AVATARS.map((avatar) => <section className="visual-audit-class" key={avatar.id} data-testid={`visual-audit-${avatar.id}`}>
          <header><span className="visual-audit-icon" style={{ color: avatar.color, borderColor: avatar.color }}>{avatar.icon}</span><div><strong>{avatar.name}</strong><small>{avatar.role}</small></div></header>
          <div className="visual-audit-states">
            {VISUAL_STATES.map((state) => <div className="visual-audit-state" key={state}>
              <canvas width="64" height="58" ref={(node) => { refs.current[`${avatar.id}-state-${state}`] = node; }} aria-label={`${avatar.name} ${state} sul`} />
              <small>{state}</small>
            </div>)}
          </div>
          <div className="visual-audit-directions">
            {VISUAL_FACINGS.map((facing) => <div key={facing}><canvas width="64" height="58" ref={(node) => { refs.current[`${avatar.id}-walk-${facing}`] = node; }} /><canvas width="64" height="58" ref={(node) => { refs.current[`${avatar.id}-attack-${facing}`] = node; }} /><small>{FACING_LABELS[facing]}</small></div>)}
          </div>
          <div className="visual-audit-skills"><span>Habilidades</span>{[...avatar.skills, avatar.ultimate].map((ability) => <i key={ability.id} style={{ color: ability.color, borderColor: ability.color }} title={`${ability.name}: ${ability.kind}`}>{ability.kind.slice(0, 3)}</i>)}</div>
        </section>)}
      </div>
      <div className="visual-audit-foot"><span><b>Legenda:</b> cada direção mostra caminhada e ataque; a primeira linha mostra os cinco estados.</span><span>Tipos de efeito: <b>strike</b> · <b>burst</b> · <b>heal</b> · <b>dash</b> · <b>control</b></span></div>
      <button className="ghost-btn" onClick={() => window.dispatchEvent(new CustomEvent('close-visual-audit'))} data-testid="button-close-visual-audit">Fechar laboratório</button>
    </div>
  </div>;
}

function GameCanvas({ game, request, remotePlayers = latestRemotePlayers, persistence = activeProgressPersistence, coop, paused = false, campaignTargetNpcId, onCombatState, onHud, onDialog, onAchievement, onDeath, onZone, onTravel }: { game: GameState; request: { slot: number; nonce: number }; remotePlayers?: RemotePlayer[]; persistence?: { account: string; characterId: string; revision: MutableRefObject<number>; onRevision: (revision: number) => void; onError: (message: string) => void; save: (snapshot: ProgressSnapshot) => Promise<{ revision: number } | null> }; coop?: { roomId: string; playerId: string }; paused?: boolean; campaignTargetNpcId?: string; onCombatState?: (enemies: CombatEnemyState[]) => void; onHud: (p: Player) => void; onDialog: (n: Npc) => void; onAchievement: (id: string) => void; onDeath: () => void; onZone: (name: string) => void; onTravel?: (target: MapId) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null); const miniRef = useRef<HTMLCanvasElement>(null); const lastRef = useRef(0); const requestRef = useRef(request); const logRef = useRef<(text: string, cls?: string) => void>(() => undefined); const seenRequest = useRef(0); const travelRef = useRef(false); const authoritativeKillRef = useRef<(enemy: Enemy) => void>(() => undefined);
  const [focusedRegion, setFocusedRegion] = useState<string | null>(null);
  useEffect(() => {
    const routeToMission = (event: Event) => {
      const missionId = (event as CustomEvent<{ missionId?: string }>).detail?.missionId;
      const mission = MISSIONS.find((entry) => entry.id === missionId);
      if (!mission || game.player.dying) return;
      const targetMap = missionMapTarget(mission);
      const matchingNpc = targetMap === game.mapId ? game.npcs.find((npc) => npc.id === mission.npcId) : undefined;
      const matchingEnemy = targetMap === game.mapId && mission.target ? game.enemies.find((enemy) => enemy.type === mission.target && enemy.state !== 'dead') : undefined;
      if (matchingNpc) {
        setFocusedRegion(mission.region);
        game.player.target = null;
        game.player.moveTarget = { x: matchingNpc.x, y: matchingNpc.y };
        log(`Rota marcada: encontre ${matchingNpc.name}.`, 'info');
        return;
      }
      if (matchingEnemy) {
        setFocusedRegion(mission.region);
        game.player.target = matchingEnemy.id;
        game.player.moveTarget = { x: matchingEnemy.x, y: matchingEnemy.y };
        log(`Rota marcada: encontre ${matchingEnemy.name}.`, 'info');
        return;
      }
      if (targetMap && targetMap !== game.mapId) {
        setFocusedRegion(mission.region);
        onTravel?.(targetMap);
        log(`Rota marcada: ${MAP_INFO[targetMap].name}.`, 'info');
        return;
      }
      setFocusedRegion(mission.region);
      const destination = targetMap === 'hub' ? { x: WORLD_W * .5, y: WORLD_H * .5 } : { x: WORLD_W * .5, y: WORLD_H * .5 };
      game.player.target = null;
      game.player.moveTarget = destination;
      log(`Rota marcada: ${mission.region}.`, 'info');
    };
    window.addEventListener('genesis-mission-route', routeToMission);
    return () => window.removeEventListener('genesis-mission-route', routeToMission);
  }, [game, onTravel]);
  const minimapTargetNpcId = campaignTargetNpcId ?? MISSIONS.find((mission) => !game.save.completed[mission.id] && (game.save.missions[mission.id] ?? 0) >= mission.goal)?.npcId ?? MISSIONS.find((mission) => !game.save.completed[mission.id] && (!mission.prerequisite || game.save.completed[mission.prerequisite]))?.npcId;
  requestRef.current = request;
  useEffect(() => { travelRef.current = false; }, [game.mapId]);
  const saveGame = useCallback((g: GameState) => {
    const snapshot = progressSnapshot(g);
    const writeLocal = () => { try { localStorage.setItem('genesis-save', JSON.stringify({ version: 2, ...snapshot })); window.dispatchEvent(new Event('genesis-saved')); } catch { /* ignore */ } };
    if (!persistence) { writeLocal(); return; }
    void persistence.save(snapshot).then((saved) => {
      if (saved) {
        persistence.revision.current = saved.revision;
        persistence.onRevision(saved.revision);
        writeLocal();
      }
    }).catch((error: unknown) => {
      if (isAccountRequiredError(error)) persistence.onError('Sua sessão expirou. Entre novamente para continuar salvando seu progresso.');
      else if (error instanceof Error && error.message === 'coop_stale_progress') persistence.onError('Progresso atualizado em outro dispositivo; a versão mais recente foi preservada.');
    });
  }, [persistence]);
  const log = useCallback((text: string, cls = 'info') => logRef.current(text, cls), []); logRef.current = (text, cls) => window.dispatchEvent(new CustomEvent('genesis-log', { detail: { text, cls } }));
  const applySharedCombat = useCallback((enemies: CombatEnemyState[]) => {
    const shared = new Map(enemies.map((enemy) => [enemy.id, enemy]));
    game.enemies.forEach((enemy) => {
      const state = shared.get(enemy.id);
      if (!state) return;
      const wasAlive = enemy.state !== 'dead';
      enemy.hp = state.hp; enemy.x = state.x; enemy.y = state.y;
      // Run the same authoritative reward path as a local kill before setting
      // the dead state; kill() intentionally ignores already-dead enemies.
      if (wasAlive && state.state === 'dead') authoritativeKillRef.current(enemy);
      else enemy.state = state.state;
      if (state.state === 'dead') { enemy.anim = 'dead'; enemy.deadTimer = 14; }
    });
    onCombatState?.(enemies);
  }, [game, onCombatState]);
  const submitCombat = useCallback((targetId: string, damage: number) => {
    if (!coop) return false;
    void combatAction(coop.roomId, coop.playerId, targetId, damage).then((result) => {
      if (result.combat) applySharedCombat(result.combat.enemies);
    }).catch(() => undefined);
    return true;
  }, [coop, applySharedCombat]);
  const unlock = useCallback((id: string) => { if (game.save.ach[id]) return; game.save.ach[id] = true; onAchievement(id); saveGame(game); }, [game, onAchievement, saveGame]);
   const missionProgress = (kind: Mission['kind'], target: string, amount = 1) => { for (const mission of MISSIONS) { if (mission.kind !== kind || mission.target !== target || game.save.completed[mission.id] || !game.save.accepted[mission.id] || (mission.prerequisite && !game.save.completed[mission.prerequisite])) continue; const before = game.save.missions[mission.id] ?? 0; game.save.missions[mission.id] = Math.min(mission.goal, before + amount); if (before < mission.goal && game.save.missions[mission.id] >= mission.goal) log(`Objetivo concluído: ${mission.title}. Fale com ${game.npcs.find((n) => n.id === mission.npcId)?.name ?? 'um NPC'} para entregar.`, 'loot'); } saveGame(game); };
  const grantMission = (mission: Mission) => {
    if (!applyMissionReward(game, mission)) return false;
    if (mission.item) { const item = [...WEAPONS, ...ARMORS].find((x) => x.id === mission.item); if (item?.power) unlock('warrior'); if (item?.armor) unlock('loot'); if (item) log(`Recompensa recebida: ${item.name}.`, 'loot'); }
    if (mission.unlock) log(`Nova região desbloqueada: ${mission.unlock}.`, 'info'); log(`Missão concluída: ${mission.title}.`, 'loot'); saveGame(game); return true;
  };
  const addXp = (amount: number) => { const p = game.player; p.xp += amount; game.floaters.push({ x: p.x, y: p.y - 30, text: `+${amount} XP`, color: '#aee7ff', life: 1 }); while (p.xp >= p.nextXp) { p.xp -= p.nextXp; p.level++; p.nextXp = Math.round(p.nextXp * 1.32); p.maxHp += 8; p.maxMana += 8; p.hp = p.maxHp; p.mana = p.maxMana; log(`Nível ${p.level}: novas técnicas podem estar disponíveis.`, 'info'); } };
   const kill = (e: Enemy) => { if (e.state === 'dead') return; e.state = 'dead'; e.anim = 'dead'; e.animTime = 0; e.deadTimer = e.boss ? 99999 : 14; const coins = COMBAT_COIN_REWARDS[e.type] ?? 3; game.save.coins = Math.min(1_000_000_000, game.save.coins + coins); game.floaters.push({ x: e.x, y: e.y - 34, text: `+${coins} moedas`, color: '#ffd76b', life: 1 }); game.effects.push({ id: `death-${e.id}-${Date.now()}`, kind: 'burst', x: e.x, y: e.y, color: e.boss ? '#ffcc44' : e.color, life: 1, maxLife: 1, radius: e.boss ? 48 : 24 }); game.player.target = null; game.save.kills.total = (game.save.kills.total ?? 0) + 1; game.save.kills[e.type] = (game.save.kills[e.type] ?? 0) + 1; addXp(e.boss ? 600 : e.type === 'skeleton' ? 48 : 18); missionProgress('kill', e.boss ? 'boss' : e.type); if (e.type === 'eventWisp') { addInventoryItem(game, 'event-lantern'); log('Drop especial: Lâmpada Violeta · cosmético do Eclipse.', 'loot'); } if ((game.save.kills.rat ?? 0) >= 10) unlock('rats'); if ((game.save.kills.rat ?? 0) >= 50) unlock('nomore'); if ((game.save.kills.skeleton ?? 0) >= 10) unlock('skulls'); if ((game.save.kills.total ?? 0) >= 50) unlock('hunter'); if (e.boss) { unlock('hero'); game.items.push({ ...ARMORS[5], itemId: 'goldenarmor', kind: 'armor', x: e.x + 42, y: e.y, fromMob: true }); } else if (Math.random() < .22) { const item = Math.random() < .55 ? WEAPONS[Math.min(WEAPONS.length - 1, 1 + Math.floor(Math.random() * 5))] : ARMORS[Math.min(ARMORS.length - 1, 1 + Math.floor(Math.random() * 4))]; game.items.push({ ...item, itemId: item.id, kind: WEAPONS.includes(item) ? 'weapon' : 'armor', x: e.x + 12, y: e.y + 8, fromMob: true }); } if (Math.random() < .32) game.items.push({ id: 'flask', itemId: 'flask', kind: 'flask', name: 'Frasco de Vida', icon: '+', rank: 0, rarity: 'common', x: e.x - 12, y: e.y - 6, fromMob: true }); log(`${e.name} derrotado · +${coins} moedas.`, 'loot'); saveGame(game); };
  authoritativeKillRef.current = kill;
  const hurt = (e: Enemy) => { const p = game.player; if (p.invincible > 0 || p.dying || p.statuses.some((s) => s.kind === 'ward')) return; p.anim = 'hurt'; p.animTime = 0; const d = Math.max(1, e.weapon * randomInt(5, 10) - p.armorRank * randomInt(1, 3)); const reduced = p.avatar.id === 'moss' || p.avatar.id === 'tungsten' ? Math.round(d * .85) : d; p.hp = Math.max(0, p.hp - reduced); p.combatTimer = 5; game.effects.push({ id: `hit-${Date.now()}`, kind: 'control', x: p.x, y: p.y, color: '#ff7770', life: .45, maxLife: .45, radius: 18, label: 'IMPACTO' }); game.save.dmgTaken += reduced; game.floaters.push({ x: p.x, y: p.y - 18, text: `-${reduced}`, color: '#ff7770', life: 1 }); if (game.save.dmgTaken >= 5000) unlock('meatshield'); if (p.hp <= 0) { p.dying = true; p.anim = 'dead'; onDeath(); } };
  const cast = (slot: number) => {
    const p = game.player; const ability = slot === 4 ? p.avatar.ultimate : p.avatar.skills[slot - 1]; if (!ability || p.level < ability.unlock || (p.skills[ability.id] ?? 0) > 0 || (p.mana < ability.cost)) return;
    if ((p.skills[ability.id] ?? 0) > 0) return; const cd = ability.cooldown; if (p[`cd${slot}` as keyof Player] as unknown as number) return;
    const target = game.enemies.find((e) => e.id === p.target && e.state !== 'dead') ?? game.enemies.find((e) => e.state !== 'dead' && Math.hypot(e.x - p.x, e.y - p.y) < 160);
    if (!target && ability.kind !== 'heal') return; p.mana -= ability.cost; p.anim = 'attack'; p.animTime = 0; (p as Player & Record<string, number>)[`cd${slot}`] = cd;
    const effectTarget = target ?? p; game.effects.push({ id: `${ability.id}-${Date.now()}`, kind: ability.kind, x: effectTarget.x, y: effectTarget.y, color: ability.color, life: ability.kind === 'dash' ? .7 : 1.05, maxLife: ability.kind === 'dash' ? .7 : 1.05, radius: slot === 4 ? 108 : ability.kind === 'burst' ? 66 : 34, label: ability.name });
    if (ability.kind === 'heal') { const heal = Math.round(p.maxHp * (slot === 4 ? .42 : .2)); p.hp = Math.min(p.maxHp, p.hp + heal); p.statuses.push({ id: `${ability.id}-${Date.now()}`, kind: 'ward', duration: slot === 4 ? 4 : 2, power: 1 }); game.floaters.push({ x: p.x, y: p.y - 25, text: `+${heal}`, color: '#8dffbf', life: 1 }); }
     if (target) { const distance = Math.hypot(target.x - p.x, target.y - p.y); if (ability.kind === 'dash') { p.x = target.x - (target.x - p.x) / (distance || 1) * 36; p.y = target.y - (target.y - p.y) / (distance || 1) * 36; } const base = Math.max(4, Math.round((p.avatar.power * (slot === 4 ? 42 : 22 + p.level * 2)) - target.armor * 1.4)); const hits = ability.kind === 'burst' || slot === 4 ? game.enemies.filter((e) => e.state !== 'dead' && Math.hypot(e.x - target.x, e.y - target.y) < (slot === 4 ? 120 : 68)) : [target]; hits.forEach((enemy) => { if (submitCombat(enemy.id, base)) { game.floaters.push({ x: enemy.x, y: enemy.y - 22, text: `-${base}`, color: ability.color, life: 1 }); return; } enemy.hp = Math.max(0, enemy.hp - base); enemy.angry = true; enemy.state = 'chase'; if (ability.kind === 'control') enemy.status.push({ id: `${ability.id}-${Date.now()}`, kind: 'stun', duration: 2, power: 1 }); if (ability.id === 'venom' || ability.id === 'cloud' || ability.id === 'bloom') enemy.status.push({ id: ability.id, kind: 'poison', duration: 5, power: 3 }); game.floaters.push({ x: enemy.x, y: enemy.y - 22, text: `-${base}`, color: ability.color, life: 1 }); if (enemy.hp <= 0) kill(enemy); }); }
    log(`${ability.name} ativado.`, 'info');
  };
  const update = (dt: number) => {
    const p = game.player; if (p.atkCd > 0) p.atkCd -= dt; if (p.invincible > 0) p.invincible -= dt; if (p.combatTimer > 0) p.combatTimer -= dt; if (game.firePotion > 0) game.firePotion -= dt;
    p.animTime += dt; if (p.anim !== 'hurt' && p.anim !== 'dead') p.anim = p.moveTarget ? 'walk' : p.atkCd > 0 ? 'attack' : 'idle'; if (p.anim === 'hurt' && p.animTime > .35) p.anim = 'idle';
    const playerWithCds = p as Player & Record<string, number>; for (let i = 1; i <= 4; i++) playerWithCds[`cd${i}`] = Math.max(0, (playerWithCds[`cd${i}`] ?? 0) - dt);
    p.statuses.forEach((s) => s.duration -= dt); p.statuses = p.statuses.filter((s) => s.duration > 0); if (p.combatTimer <= 0 && p.hp < p.maxHp) { p.regenTimer -= dt; if (p.regenTimer <= 0) { p.regenTimer = 2; p.hp = Math.min(p.maxHp, p.hp + Math.max(2, Math.round(p.maxHp * .04))); } } p.mana = Math.min(p.maxMana, p.mana + dt * (p.avatar.id === 'spore' ? 3 : 1.6));
      if (p.moveTarget) { const dx = p.moveTarget.x - p.x, dy = p.moveTarget.y - p.y, d = Math.hypot(dx, dy); if (d < 4) { if (clearFocusedRegionAtArrival(p, focusedRegion) === null) setFocusedRegion(null); } else { p.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north'); const step = 145 * dt; const nx = p.x + dx / d * step, ny = p.y + dy / d * step; if (!blocked(game, nx, p.y)) p.x = nx; if (!blocked(game, p.x, ny)) p.y = ny; } }
     const target = game.enemies.find((e) => e.id === p.target && e.state !== 'dead'); if (target) { const d = Math.hypot(target.x - p.x, target.y - p.y); if (d <= 48) { p.moveTarget = null; p.facing = Math.abs(target.x - p.x) > Math.abs(target.y - p.y) ? (target.x > p.x ? 'east' : 'west') : (target.y > p.y ? 'south' : 'north'); if (p.atkCd <= 0) { p.atkCd = p.avatar.id === 'neon' ? .62 : .9; const hit = Math.max(1, Math.round(p.avatar.power * (p.weaponRank * randomInt(5, 10) - target.armor * 1.5))); const shared = submitCombat(target.id, hit); if (!shared) { target.hp = Math.max(0, target.hp - hit); target.angry = true; target.state = 'chase'; } p.anim = 'attack'; p.animTime = 0; game.effects.push({ id: `basic-${Date.now()}`, kind: 'strike', x: target.x, y: target.y, color: '#ffee66', life: .35, maxLife: .35, radius: 22, label: 'GOLPE' }); game.floaters.push({ x: target.x, y: target.y - 20, text: `-${hit}`, color: '#ffee66', life: 1 }); if (!shared && target.hp <= 0) kill(target); } } else if (!p.moveTarget) p.moveTarget = { x: target.x - (target.x - p.x) / d * 40, y: target.y - (target.y - p.y) / d * 40 }; }
    for (let i = game.items.length - 1; i >= 0; i--) { const item = game.items[i]; if (Math.hypot(item.x - p.x, item.y - p.y) < 26) { addInventoryItem(game, item.itemId); if (item.kind === 'weapon' && item.rank > p.weaponRank) { p.weaponRank = item.rank; unlock('warrior'); if (item.rarity === 'uncommon') missionProgress('gear', 'uncommon'); log(`Equipou ${item.name} · ${RARITY_LABEL[item.rarity]}.`, 'loot'); } else if (item.kind === 'armor' && item.rank > p.armorRank) { p.armorRank = Math.max(p.armorRank, item.rank); p.maxHp = maxHp(item.rank, p.avatar); p.hp = Math.min(p.maxHp, p.hp + 30); unlock('loot'); log(`Equipou ${item.name} · ${RARITY_LABEL[item.rarity]}.`, 'loot'); } else if (item.kind === 'flask') { p.flasks++; log('Pegou um Frasco de Vida.', 'loot'); } if (!item.fromMob) unlock('ninja'); game.items.splice(i, 1); saveGame(game); } }
      for (const o of game.objects) { if (o.type === 'firepotion' && !o.taken && Math.hypot(o.x - p.x, o.y - p.y) < 26) { o.taken = true; game.firePotion = 12; p.invincible = 12; unlock('foxy'); log('A poção especial desperta o fogo antigo.', 'info'); } if (o.type === 'portal' && Math.hypot(o.x - p.x, o.y - p.y) < (o.r ?? 28)) { unlock('science'); if (o.target && !travelRef.current) { const travel = onTravel ?? activeTravel; if (travel) { travelRef.current = true; p.moveTarget = null; window.dispatchEvent(new Event('genesis-travel-start')); travel(o.target); return; } } } }
    for (const e of game.enemies) {
      e.animTime += dt;
      if (e.state === 'dead') { e.anim = 'dead'; e.deadTimer -= dt; if (e.deadTimer <= 0 && !e.boss) { e.hp = e.maxHp; e.state = 'idle'; e.anim = 'idle'; e.animTime = 0; const spot = freeSpot(game, e.spawnX, e.spawnY, 50); e.x = spot.x; e.y = spot.y; } continue; }
      const d = Math.hypot(p.x - e.x, p.y - e.y); e.status.forEach((s) => { s.duration -= dt; if (s.kind === 'poison') e.hp = Math.max(0, e.hp - s.power * dt); }); e.status = e.status.filter((s) => s.duration > 0); if (e.hp <= 0) { kill(e); continue; }
      if (e.boss) { const nextPhase = e.hp < e.maxHp * .34 ? 3 : e.hp < e.maxHp * .67 ? 2 : 1; if (nextPhase !== e.phase) { e.phase = nextPhase; missionProgress('phase', 'boss', 1); log(`O Rei Esqueleto entra na fase ${nextPhase}.`, 'dmg'); if (nextPhase === 2) e.behavior = 'charger'; } }
      if (safeAt(p.x, p.y) || safeAt(e.x, e.y)) { e.state = 'idle'; continue; } if ((!e.neutral || e.angry) && d < (e.boss ? 330 : 170) && e.state === 'idle') e.state = 'chase'; if (d > 430) { e.state = 'idle'; e.angry = false; }
      if (e.state === 'chase') { e.anim = 'walk'; if (Math.abs(p.x - e.x) > Math.abs(p.y - e.y)) e.facing = p.x > e.x ? 'east' : 'west'; else e.facing = p.y > e.y ? 'south' : 'north'; if (d < (e.behavior === 'ranged' ? 125 : 48)) e.state = 'attack'; else { const step = (e.boss ? 44 + (e.phase ?? 1) * 10 : e.behavior === 'charger' ? 74 : e.behavior === 'ranged' ? 32 : 52) * dt; const nx = e.x + (p.x - e.x) / d * step, ny = e.y + (p.y - e.y) / d * step; if (!blocked(game, nx, e.y)) e.x = nx; if (!blocked(game, e.x, ny)) e.y = ny; } } else if (e.state === 'attack') { e.anim = 'attack'; if (d > (e.behavior === 'ranged' ? 150 : 54)) e.state = 'chase'; else { e.atkCd -= dt; if (e.atkCd <= 0) { e.atkCd = e.boss ? Math.max(.55, 1.5 - (e.phase ?? 1) * .25) : e.behavior === 'ranged' ? 1.6 : 1; if (e.behavior === 'ranged' && d > 60) { game.floaters.push({ x: p.x, y: p.y - 20, text: 'projétil', color: '#e597ff', life: .7 }); game.effects.push({ id: `projectile-${Date.now()}`, kind: 'strike', x: p.x, y: p.y, color: '#e597ff', life: .45, maxLife: .45, radius: 20, label: 'PROJÉTIL' }); } hurt(e); } } } else { e.anim = 'idle'; e.wander -= dt; if (e.wander <= 0) { e.wander = 2 + Math.random() * 3; e.spawnX += (Math.random() - .5) * 40; e.spawnY += (Math.random() - .5) * 40; } }
    }
     const zone = zoneFor(game.mapId, p.x, p.y); if (zone.id !== p.lastZone) { p.lastZone = zone.id; onZone(zone.name); missionProgress('zone', zone.id); if (zone.id !== 'safe' && zone.id !== 'safeC') unlock('wild'); if (zone.id === 'shore') unlock('shore'); if (zone.id === 'graveyard') unlock('graveyard'); if (zone.id === 'desert') unlock('desert'); if (zone.id === 'volcano') unlock('hotspot'); if (zone.id === 'cave') unlock('cave'); }
    p.x = Math.max(20, Math.min(WORLD_W - 20, p.x)); p.y = Math.max(20, Math.min(WORLD_H - 20, p.y)); game.cam.x += (p.x - game.cam.x) * .1; game.cam.y += (p.y - game.cam.y) * .1; game.floaters.forEach((f) => { f.y -= 28 * dt; f.life -= 1.2 * dt; }); game.floaters = game.floaters.filter((f) => f.life > 0); game.effects.forEach((fx) => { fx.life -= dt; }); game.effects = game.effects.filter((fx) => fx.life > 0);
  };
  const render = (time: number) => {
    const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return; const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2); if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); } ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const startC = Math.max(0, Math.floor((game.cam.x - w / 2) / TILE_SIZE) - 1), startR = Math.max(0, Math.floor((game.cam.y - h / 2) / TILE_SIZE) - 1), endC = Math.min(COLS, startC + Math.ceil(w / TILE_SIZE) + 3), endR = Math.min(ROWS, startR + Math.ceil(h / TILE_SIZE) + 3); ctx.save(); ctx.translate(w / 2 - game.cam.x, h / 2 - game.cam.y);
    const colors: Record<Tile, string> = { grass: '#315d2a', grass2: '#3e7033', dark: '#203b20', dead: '#5a5030', path: '#8a7040', water: '#173c52', sand: '#b79a58', mountain: '#3c3344', lava: '#742416', safeA: '#254e2b', safeC: '#0e2b32', cave: '#161219' };
    for (let r = startR; r < endR; r++) for (let c = startC; c < endC; c++) { const t = game.map[r][c]; ctx.fillStyle = colors[t]; ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE + 1, TILE_SIZE + 1); if (t === 'water') { ctx.fillStyle = 'rgba(90,180,190,.22)'; ctx.fillRect(c * TILE_SIZE + 3, r * TILE_SIZE + 8, 25, 2); } if (t === 'lava') { ctx.fillStyle = `rgba(255,${90 + Math.floor(Math.sin(time / 300 + c) * 25)},24,.55)`; ctx.fillRect(c * TILE_SIZE + 5, r * TILE_SIZE + 5, 22, 22); } }
     for (const o of game.objects) { if (o.type === 'tree') { ctx.fillStyle = '#51341f'; ctx.fillRect(o.x - 4, o.y - 2, 8, 21); ctx.fillStyle = '#1b4518'; ctx.beginPath(); ctx.arc(o.x, o.y - 9, o.r ?? 16, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#4f942d'; ctx.beginPath(); ctx.arc(o.x - 6, o.y - 15, (o.r ?? 16) * .55, 0, Math.PI * 2); ctx.fill(); } else if (o.type === 'rock') { ctx.fillStyle = '#4a4050'; ctx.beginPath(); ctx.ellipse(o.x, o.y, 14, 9, 0, 0, Math.PI * 2); ctx.fill(); } else if (o.type === 'crystal') { ctx.fillStyle = '#65d9ee'; ctx.globalAlpha = .72; ctx.beginPath(); ctx.moveTo(o.x, o.y - (o.r ?? 14)); ctx.lineTo(o.x + 9, o.y + 8); ctx.lineTo(o.x, o.y + 4); ctx.lineTo(o.x - 8, o.y + 8); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; } else if (o.type === 'iceberg') { ctx.fillStyle = '#d7f5ff'; ctx.beginPath(); ctx.moveTo(o.x, o.y - (o.r ?? 16)); ctx.lineTo(o.x + 16, o.y + 10); ctx.lineTo(o.x - 15, o.y + 10); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#79cfe4'; ctx.stroke(); } else if (o.type === 'vent') { ctx.fillStyle = '#40333a'; ctx.beginPath(); ctx.ellipse(o.x, o.y + 4, 16, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#ff7440'; ctx.globalAlpha = .65 + .25 * Math.sin(time / 220 + o.x); ctx.beginPath(); ctx.arc(o.x, o.y - 3, 7, Math.PI, 0); ctx.stroke(); ctx.globalAlpha = 1; } else if (o.type === 'grave') { ctx.fillStyle = '#68646c'; ctx.fillRect(o.x - 6, o.y - 10, 12, 15); ctx.fillRect(o.x - 9, o.y - 5, 18, 4); } else if (o.type === 'portal') { ctx.strokeStyle = '#23e6ff'; ctx.globalAlpha = .6 + .2 * Math.sin(time / 300); ctx.beginPath(); ctx.arc(o.x, o.y, 15 + Math.sin(time / 300) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = '#d8fbff'; ctx.font = 'bold 9px var(--app-font-mono)'; ctx.textAlign = 'center'; ctx.fillText(o.label ?? 'SAÍDA', o.x, o.y - 22); } else if (o.type === 'cave') { ctx.fillStyle = '#3b3446'; ctx.beginPath(); ctx.arc(o.x, o.y, 30, Math.PI, 0); ctx.lineTo(o.x + 30, o.y + 16); ctx.lineTo(o.x - 30, o.y + 16); ctx.fill(); ctx.fillStyle = '#09070c'; ctx.beginPath(); ctx.ellipse(o.x, o.y + 9, 19, 20, 0, 0, Math.PI * 2); ctx.fill(); } else if (o.type === 'firepotion' && !o.taken) { ctx.fillStyle = '#ffbd48'; ctx.globalAlpha = .7 + Math.sin(time / 300) * .2; ctx.beginPath(); ctx.arc(o.x, o.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; } }
     const drawEffect = (fx: VisualEffect) => { const progress = 1 - fx.life / fx.maxLife; const radius = fx.radius * (fx.kind === 'dash' ? progress : .55 + progress * .7); ctx.save(); ctx.globalAlpha = Math.max(0, fx.life / fx.maxLife); ctx.strokeStyle = fx.color; ctx.fillStyle = `${fx.color}33`; ctx.lineWidth = fx.kind === 'control' ? 2 : 2.5; ctx.beginPath(); if (fx.kind === 'strike' || fx.kind === 'dash') { ctx.arc(fx.x, fx.y, radius, -Math.PI * .8, Math.PI * .25); ctx.stroke(); ctx.beginPath(); ctx.moveTo(fx.x - radius * .55, fx.y - radius * .7); ctx.lineTo(fx.x + radius * .65, fx.y + radius * .45); ctx.stroke(); } else if (fx.kind === 'heal') { ctx.arc(fx.x, fx.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); for (let i = 0; i < 5; i++) { const a = i * 1.25 + progress * 3; ctx.fillStyle = fx.color; ctx.fillRect(fx.x + Math.cos(a) * radius, fx.y + Math.sin(a) * radius, 3, 3); } } else { ctx.arc(fx.x, fx.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); if (fx.kind === 'control') { ctx.beginPath(); ctx.arc(fx.x, fx.y, radius * .55, progress * 5, progress * 5 + Math.PI * 1.4); ctx.stroke(); } } if (fx.label && progress < .72) { ctx.fillStyle = fx.color; ctx.font = 'bold 8px var(--app-font-mono)'; ctx.textAlign = 'center'; ctx.fillText(fx.label, fx.x, fx.y - radius - 5); } ctx.restore(); };
       const actors = [...game.items.map((x) => ({ y: x.y, draw: () => { ctx.fillStyle = RARITY_COLORS[x.rarity]; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x.x, x.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); if (!drawGroundItemSprite(ctx, x, time)) { ctx.fillStyle = '#182018'; ctx.font = 'bold 8px var(--app-font-mono)'; ctx.textAlign = 'center'; ctx.fillText(x.icon, x.x, x.y + 3); } } })), ...game.npcs.map((x) => ({ y: x.y, draw: () => { ctx.fillStyle = x.faction === 'awakened' ? 'rgba(98,182,108,.35)' : 'rgba(35,230,255,.35)'; ctx.beginPath(); ctx.arc(x.x, x.y, 23, 0, Math.PI * 2); ctx.fill(); drawHeroSprite(ctx, x.x, x.y, x.faction === 'awakened' ? '#93d77f' : '#74eaff', 18, 'idle', 'south', time); ctx.fillStyle = '#ffd76b'; ctx.font = '10px var(--app-font-mono)'; ctx.textAlign = 'center'; ctx.fillText(x.name, x.x, x.y - 31); } })), ...game.enemies.map((e) => ({ y: e.y, draw: () => { if (e.state === 'dead') return; if (game.player.target === e.id) { ctx.strokeStyle = '#ff544a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.boss ? 34 : 23, 0, Math.PI * 2); ctx.stroke(); } drawHeroSprite(ctx, e.x, e.y, e.color, e.boss ? 28 : 17, e.anim, e.facing, time, undefined, e.boss); if (e.hp < e.maxHp) { ctx.fillStyle = '#180909'; ctx.fillRect(e.x - (e.boss ? 30 : 19), e.y - (e.boss ? 39 : 27), e.boss ? 60 : 38, 5); ctx.fillStyle = e.boss ? '#ffcc44' : '#ff4444'; ctx.fillRect(e.x - (e.boss ? 30 : 19), e.y - (e.boss ? 39 : 27), (e.boss ? 60 : 38) * e.hp / e.maxHp, 5); } ctx.fillStyle = e.boss ? '#ffcc44' : '#f0ede2'; ctx.font = `${e.boss ? 12 : 10}px var(--app-font-mono)`; ctx.textAlign = 'center'; ctx.fillText(e.boss ? `${e.name} · F${e.phase}` : e.name, e.x, e.y - (e.boss ? 48 : 33)); } })), { y: game.player.y, draw: () => { ctx.fillStyle = game.player.avatar.color; ctx.globalAlpha = .28; ctx.beginPath(); ctx.arc(game.player.x, game.player.y, 26 + Math.sin(time / 600) * 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; drawHeroSprite(ctx, game.player.x, game.player.y, game.player.avatar.color, 21, game.player.anim, game.player.facing, time, game.player.avatar); ctx.fillStyle = '#fff'; ctx.font = 'bold 11px var(--app-font-mono)'; ctx.textAlign = 'center'; ctx.fillText(`${game.player.avatar.icon} · Nv ${game.player.level}`, game.player.x, game.player.y - 39); } }].sort((a, b) => a.y - b.y); remotePlayers.forEach((remote) => { const avatar = AVATARS.find((item) => item.id === remote.avatar); if (!avatar) return; drawHeroSprite(ctx, remote.x, remote.y, avatar.color, 21, remote.action, 'south', time, avatar); ctx.fillStyle = '#8ee7ff'; ctx.font = 'bold 10px var(--app-font-mono)'; ctx.textAlign = 'center'; ctx.fillText(`COOP · Nv ${remote.level}`, remote.x, remote.y - 39); }); actors.forEach((a) => a.draw()); game.effects.forEach(drawEffect); for (const f of game.floaters) { ctx.globalAlpha = f.life; ctx.fillStyle = f.color; ctx.font = 'bold 15px var(--app-font-mono)'; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y); } ctx.restore();
    const mini = miniRef.current?.getContext('2d'); if (mini && miniRef.current) {
      const mw = miniRef.current.width, mh = miniRef.current.height;
      mini.clearRect(0, 0, mw, mh); mini.fillStyle = '#1b2c1d'; mini.fillRect(0, 0, mw, mh);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const t = game.map[r][c]; mini.fillStyle = t === 'mountain' ? '#42384e' : t === 'lava' ? '#762719' : t === 'water' ? '#214963' : t === 'sand' ? '#ac8f4e' : t === 'path' ? '#8c7447' : t === 'safeC' ? '#12333b' : t === 'safeA' ? '#2f6935' : '#315c2c'; mini.fillRect(c * mw / COLS, r * mh / ROWS, mw / COLS + 1, mh / ROWS + 1); }
       mini.save(); mini.strokeStyle = 'rgba(255,215,107,.5)'; mini.lineWidth = 1; mini.setLineDash([2, 2]); mini.beginPath(); MINIMAP_REGIONS.forEach((point, index) => { const x = point.x * mw, y = point.y * mh; if (index === 0) mini.moveTo(x, y); else mini.lineTo(x, y); }); mini.stroke(); mini.restore();
       MINIMAP_REGIONS.forEach((point, index) => { const x = point.x * mw, y = point.y * mh, selected = point.name === focusedRegion; if (selected) { mini.save(); mini.strokeStyle = '#8ee7ff'; mini.lineWidth = 2; mini.beginPath(); mini.arc(x, y, 8 + Math.sin(time / 180) * 1.5, 0, Math.PI * 2); mini.stroke(); mini.restore(); } mini.fillStyle = selected ? '#8ee7ff' : '#ffd76b'; mini.beginPath(); mini.arc(x, y, selected ? 5 : 4, 0, Math.PI * 2); mini.fill(); mini.fillStyle = '#172117'; mini.font = 'bold 7px var(--app-font-mono)'; mini.textAlign = 'center'; mini.textBaseline = 'middle'; mini.fillText(String(index + 1), x, y); });
      mini.fillStyle = '#ff534a'; game.enemies.filter((e) => e.state !== 'dead').forEach((e) => mini.fillRect(e.x / WORLD_W * mw, e.y / WORLD_H * mh, e.boss ? 4 : 2, e.boss ? 4 : 2));
      game.npcs.forEach((npc) => { const x = npc.x / WORLD_W * mw, y = npc.y / WORLD_H * mh, isTarget = npc.id === minimapTargetNpcId; mini.save(); if (isTarget) { mini.strokeStyle = '#8ee7ff'; mini.lineWidth = 2; mini.beginPath(); mini.arc(x, y, 6 + Math.sin(time / 180) * 1.5, 0, Math.PI * 2); mini.stroke(); } mini.fillStyle = isTarget ? '#8ee7ff' : '#c79cff'; mini.fillRect(x - 2, y - 2, 4, 4); mini.restore(); });
      remotePlayers.forEach((remote) => { mini.fillStyle = '#8ee7ff'; mini.beginPath(); mini.arc(remote.x / WORLD_W * mw, remote.y / WORLD_H * mh, 2, 0, Math.PI * 2); mini.fill(); });
      mini.fillStyle = '#fff'; mini.beginPath(); mini.arc(game.player.x / WORLD_W * mw, game.player.y / WORLD_H * mh, 3, 0, Math.PI * 2); mini.fill();
    }
  };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const tap = (event: PointerEvent) => { if (game.player.dying) return; const rect = canvas.getBoundingClientRect(); const worldX = game.cam.x + (event.clientX - rect.left - rect.width / 2), worldY = game.cam.y + (event.clientY - rect.top - rect.height / 2); const enemy = game.enemies.find((e) => e.state !== 'dead' && Math.hypot(e.x - worldX, e.y - worldY) < (e.boss ? 38 : 26)); if (enemy) { game.player.target = enemy.id; return; } const special = game.objects.find((o) => (o.type === 'dungeon' || o.type === 'event') && Math.hypot(o.x - worldX, o.y - worldY) < (o.r ?? 30)); if (special && Math.hypot(special.x - game.player.x, special.y - game.player.y) < 100) { if (special.type === 'dungeon') { game.save.dungeonCleared = true; game.save.missions['threshold-dungeon'] = 1; game.save.accepted['threshold-dungeon'] = true; game.save.completed['threshold-dungeon'] = true; game.save.rewarded['threshold-dungeon'] = true; game.save.coins += 30; log('Cripta do Sino concluída · título Guardião do Sino desbloqueado.', 'loot'); saveGame(game); } else { game.save.accepted['weekly-eclipse'] = true; log(`Eclipse semanal ativo · derrote ${Math.max(0, 3 - (game.save.missions['weekly-eclipse'] ?? 0))} Faíscas do Eclipse.`, 'info'); saveGame(game); } return; } const npc = game.npcs.find((n) => Math.hypot(n.x - worldX, n.y - worldY) < 30); if (npc && Math.hypot(npc.x - game.player.x, npc.y - game.player.y) < 85) { unlock('talk'); onDialog(npc); return; } game.player.target = null; game.player.moveTarget = { x: worldX, y: worldY }; };
      const focusRegion = (region: typeof MINIMAP_REGIONS[number]) => { if (game.player.dying) return; setFocusedRegion(region.name); game.player.moveTarget = { x: region.x * WORLD_W, y: region.y * WORLD_H }; log(`Destino marcado: ${region.name}.`, 'info'); };
     const tapMinimap = (event: PointerEvent) => { const mini = miniRef.current; if (!mini) return; const region = minimapRegionAtPointer(event, mini.getBoundingClientRect()); if (region) { event.preventDefault(); focusRegion(region); } };
     canvas.addEventListener('pointerdown', tap, { passive: false }); miniRef.current?.addEventListener('pointerdown', tapMinimap, { passive: false }); const key = (event: KeyboardEvent) => { if (event.key >= '1' && event.key <= '4') cast(Number(event.key)); }; window.addEventListener('keydown', key); let raf = 0;
      const loop = (time: number) => { const dt = Math.min(.05, lastRef.current ? (time - lastRef.current) / 1000 : .016); lastRef.current = time; const overlayOpen = Boolean(document.querySelector('.genesis-shell .overlay, .genesis-shell .panel')); if (!game.player.dying && !paused && !overlayOpen) { if (requestRef.current.nonce !== seenRequest.current) { seenRequest.current = requestRef.current.nonce; cast(requestRef.current.slot); } update(dt); } render(time); if (Math.floor(time / 250) !== Math.floor((time - dt * 1000) / 250)) onHud({ ...game.player }); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); return () => { canvas.removeEventListener('pointerdown', tap); miniRef.current?.removeEventListener('pointerdown', tapMinimap); window.removeEventListener('keydown', key); cancelAnimationFrame(raf); };
      }, [game, remotePlayers, paused, campaignTargetNpcId, onHud, onDialog, onDeath, onZone, onTravel, unlock, submitCombat, onCombatState, focusedRegion]);
   const focusRegion = (region: MinimapRegion) => { if (game.player.dying) return; setFocusedRegion(focusMinimapRegion(game.player, region)); log(`Destino marcado: ${region.name}.`, 'info'); };
   return <><canvas ref={canvasRef} className="game-canvas" aria-label="Mapa jogável de Project Genesis" data-testid="canvas-game" /><div className="minimap-card hud-card hud-interactive"><div className="minimap-heading"><span>ROTA REGIONAL</span><small>{focusedRegion ? `→ ${focusedRegion}` : 'toque para focar'}</small></div><canvas ref={miniRef} width={112} height={112} aria-label="Minimapa interativo com rota das cinco regiões" data-testid="canvas-minimap" /><ol className="minimap-regions">{MINIMAP_REGIONS.map((region, index) => <li key={region.name}><button className={focusedRegion === region.name ? 'selected' : ''} onClick={() => region.name === 'Vila do Limiar' ? onTravel?.('hub') : focusRegion(region)} aria-label={`Focar região ${region.name}`} data-testid={`button-minimap-region-${index + 1}`}><b>{index + 1}</b><span>{region.name}</span></button></li>)}</ol><div className="minimap-legend"><span><i className="legend-next" /> destino focado</span><span><i className="legend-player" /> jogadores</span></div></div></>;
}

function installGameMenu() {
  if (typeof document === 'undefined') return;
  const attach = () => {
    const bar = document.querySelector<HTMLElement>('.stats-bar');
    if (!bar) {
      document.querySelector('.menu-trigger-dom')?.remove();
      document.querySelector('[data-testid="panel-menu"]')?.remove();
      return;
    }
    if (bar.querySelector('.menu-trigger-dom')) return;
    document.querySelector('[data-testid="panel-menu"]')?.remove();
    const trigger = document.createElement('button');
    trigger.className = 'achievement-button menu-trigger-dom';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', 'Abrir menu');
    trigger.setAttribute('data-testid', 'button-menu');
    trigger.innerHTML = '<span class="menu-dots">•••</span><small>MENU</small>';
    bar.appendChild(trigger);
    const menu = document.createElement('section');
    menu.className = 'game-menu hud-card';
    menu.setAttribute('data-testid', 'panel-menu');
    menu.innerHTML = '<header class="game-menu-head"><div><span class="micro">central de funções</span><h2>Menu</h2></div><button class="panel-close" aria-label="Fechar menu">×</button></header><div class="menu-grid"><button class="menu-tile" data-menu-action="map"><span class="menu-icon">⌖</span><strong>Mapa</strong><small>regiões e rotas</small></button><button class="menu-tile" data-menu-action="bag"><span class="menu-icon">▣</span><strong>Bolsa</strong><small>itens coletados</small></button><button class="menu-tile" data-menu-action="coins"><span class="menu-icon">◉</span><strong>Moedas</strong><small>saldo da campanha</small></button><button class="menu-tile" data-menu-action="equipment"><span class="menu-icon">♜</span><strong>Equipamento</strong><small>arma e armadura</small></button><button class="menu-tile" data-menu-action="skills"><span class="menu-icon">✦</span><strong>Habilidades</strong><small>técnicas disponíveis</small></button><button class="menu-tile" data-menu-action="journal"><span class="menu-icon">▤</span><strong>Diário</strong><small>missões e recompensas</small></button><button class="menu-tile" data-menu-action="achievements"><span class="menu-icon">★</span><strong>Conquistas</strong><small>progresso da jornada</small></button></div>';
     try {
       const stored = JSON.parse(localStorage.getItem('genesis-save') ?? 'null') as { coins?: unknown } | null;
       const coins = typeof stored?.coins === 'number' && Number.isFinite(stored.coins) ? Math.floor(stored.coins) : 0;
       const tile = menu.querySelector<HTMLElement>('[data-menu-action="coins"] small');
       if (tile) tile.textContent = `${coins} moedas`;
     } catch { /* local storage may be unavailable */ }
    document.body.appendChild(menu);
    const close = () => menu.removeAttribute('data-open');
    const open = () => menu.setAttribute('data-open', 'true');
    const forward = (testId: string) => document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.click();
    const onTrigger = (event: Event) => { event.preventDefault(); event.stopPropagation(); menu.getAttribute('data-open') === 'true' ? close() : open(); };
    const onClick = (event: Event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>('[data-menu-action]')?.dataset.menuAction;
      if (!action) return;
       if (action === 'map') { close(); document.querySelector<HTMLElement>('[data-testid="button-minimap-region-1"]')?.click(); }
      if (action === 'bag') { close(); forward('button-inventory'); }
      if (action === 'equipment') { close(); forward('button-weapon'); }
      if (action === 'skills') { close(); document.querySelector<HTMLElement>('[aria-label="Ver detalhes das habilidades"]')?.click(); }
      if (action === 'journal') { close(); forward('button-journal'); }
      if (action === 'achievements') { close(); forward('button-achievements'); }
      if (action === 'coins') {
        close();
         let coins = 0;
         try {
           const stored = JSON.parse(localStorage.getItem('genesis-save') ?? 'null') as { coins?: unknown } | null;
           if (typeof stored?.coins === 'number' && Number.isFinite(stored.coins)) coins = Math.max(0, Math.floor(stored.coins));
         } catch { /* local storage may be unavailable */ }
        const sheet = document.createElement('div');
        sheet.className = 'coins-overlay overlay';
        sheet.innerHTML = '<section class="coins-sheet hud-card"><button class="panel-close" aria-label="Fechar moedas">×</button><div class="micro">tesouro da campanha</div><h2>Moedas</h2><div class="coin-balance"><span class="coin-mark">◉</span><strong>0</strong><span>moedas conquistadas</span></div><p>Derrotas e missões rendem moedas. O saldo é salvo localmente e sincronizado no cooperativo.</p><button class="ghost-btn">Voltar</button></section>';
        document.body.appendChild(sheet);
         const balance = sheet.querySelector<HTMLElement>('.coin-balance strong');
         if (balance) balance.textContent = String(coins);
        sheet.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => sheet.remove()));
      }
    };
    trigger.addEventListener('click', onTrigger);
    menu.addEventListener('click', onClick);
    menu.querySelector('.panel-close')?.addEventListener('click', close);
     document.querySelectorAll<HTMLElement>('.skill-row small').forEach((small) => {
       small.textContent = small.textContent?.replace('recarga $', 'recarga ') ?? '';
     });
  };
  attach();
  const observer = new MutationObserver(attach);
  observer.observe(document.body, { childList: true, subtree: true });
}

installGameMenu();

function StartHub({ onStart }: { onStart: () => void }) {
  return <div className="overlay genesis-hub" data-testid="screen-start-hub">
    <div className="hub-shell">
      <header className="hub-header">
        <div className="hub-profile">
          <div className="hub-avatar">07</div>
          <div><span className="micro">ARQUIVO 07</span><strong>Viajante do Limiar</strong><small>Escolha uma hierarquia para começar</small></div>
        </div>
        <div className="hub-currencies"><span>◉ <b>—</b></span><span>✦ <b>—</b></span><button className="hub-icon" aria-label="Abrir opções" onClick={onStart}>☰</button></div>
      </header>
      <div className="hub-hero">
        <div className="hub-hero-copy"><span className="micro">CICLO DE EXPLORAÇÃO 01</span><h1>O mundo ainda<br /><em>respira.</em></h1><p>Monte sua equipe, atravesse os biomas e descubra o que sobreviveu ao mundo partido.</p><button className="primary-btn hub-play" onClick={onStart} data-testid="button-hub-play">JOGAR <span>→</span></button></div>
        <div className="hub-hero-mark" aria-hidden="true"><span>G</span><small>GENESIS</small></div>
      </div>
      <section className="hub-cards" aria-label="Atalhos do mundo">
        <button className="hub-card hub-season" onClick={onStart}><span className="hub-card-kicker">PASSE DO LIMIAR</span><strong>Temporada de<br />descobertas</strong><small>Prepare sua primeira expedição</small><i>→</i></button>
        <button className="hub-card hub-mission" onClick={onStart}><span className="hub-card-kicker">MISSÃO DIÁRIA</span><strong>Escolha uma classe<br />e entre no mundo</strong><small>Recompensa: progresso de campanha</small><i>→</i></button>
        <button className="hub-card hub-ranking" onClick={onStart}><span className="hub-card-kicker">RANKING</span><strong>Seu caminho<br />começa aqui</strong><small>Jogue cooperativo para avançar</small><i>→</i></button>
      </section>
      <nav className="hub-nav" aria-label="Navegação principal"><button onClick={onStart}>▣ <span>Jogar</span></button><button onClick={onStart}>◇ <span>Loja</span></button><button onClick={onStart}>♜ <span>Ranking</span></button><button onClick={onStart}>♙ <span>Amigos</span></button></nav>
    </div>
  </div>;
}

function EconomyPanel({ game, tab, onTab, onBuyPotion, onSell, onBuyback, onClose }: { game: GameState; tab: 'buy' | 'sell' | 'buyback'; onTab: (tab: 'buy' | 'sell' | 'buyback') => void; onBuyPotion: (potion: Potion) => void; onSell: (itemId: string, amount: number) => void; onBuyback: (transaction: CommerceTransaction) => void; onClose: () => void }) {
  const sold = Object.values(game.save.commerceLedger).filter((entry) => entry.kind === 'sell' && (entry.soldAt ?? 0) > Date.now() - 5 * 60_000);
  const sellable = Object.entries(game.save.inventory).filter(([id, amount]) => amount > 0 && (id === 'flask' || ITEM_CATALOG.some((item) => item.id === id)));
  const label = (id: string) => id === 'flask' ? 'Frasco de Vida' : ITEM_CATALOG.find((item) => item.id === id)?.name ?? id;
  const value = (id: string) => id === 'flask' ? 4 : Math.max(5, Math.round((ITEM_CATALOG.find((item) => item.id === id)?.rank ?? 1) * 7));
  return <div className="overlay economy-overlay" data-testid="panel-economy"><section className="economy-sheet hud-card">
    <button className="panel-close" onClick={onClose} aria-label="Fechar comércio"><X size={17} /></button>
    <div className="micro">mercado do hub · saldo {game.save.coins} ◉</div><h2>Mercado seguro</h2>
    <p className="economy-intro">Preços e efeitos visíveis. Vendas protegem equipamento ativo e a recompra dura 5 minutos.</p>
    <div className="economy-tabs"><button className={tab === 'buy' ? 'selected' : ''} onClick={() => onTab('buy')}>Comprar</button><button className={tab === 'sell' ? 'selected' : ''} onClick={() => onTab('sell')}>Vender</button><button className={tab === 'buyback' ? 'selected' : ''} onClick={() => onTab('buyback')}>Recomprar</button></div>
    {tab === 'buy' && <div className="economy-list">{POTIONS.map((potion) => <article className="economy-row" key={potion.id}><span className="economy-icon">{potion.icon}</span><div><strong>{potion.name}</strong><small>{potion.effect} · recarga {potion.cooldown}s</small></div><button className="primary-btn" onClick={() => onBuyPotion(potion)} disabled={game.save.coins < potion.price}>{potion.price} ◉</button></article>)}</div>}
    {tab === 'sell' && <div className="economy-list">{sellable.length === 0 ? <p className="economy-empty">Nenhum item seguro para vender.</p> : sellable.map(([id, amount]) => <article className="economy-row" key={id}><span className="economy-icon">▣</span><div><strong>{label(id)}</strong><small>{amount} disponíveis · {value(id)} ◉ por unidade</small></div><button className="ghost-btn" onClick={() => onSell(id, amount)}>Vender tudo</button></article>)}</div>}
    {tab === 'buyback' && <div className="economy-list">{sold.length === 0 ? <p className="economy-empty">Nenhuma venda recente. A janela expira em 5 minutos.</p> : sold.map((entry) => <article className="economy-row" key={entry.id}><span className="economy-icon">↺</span><div><strong>{entry.amount}× {label(entry.itemId)}</strong><small>recompra por {entry.coins} ◉ · venda recente</small></div><button className="ghost-btn" onClick={() => onBuyback(entry)} disabled={game.save.coins < entry.coins}>Recomprar</button></article>)}</div>}
    <button className="ghost-btn economy-close" onClick={onClose}>Fechar mercado</button>
  </section></div>;
}

function App() {
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null); const [hud, setHud] = useState<Player | null>(null); const [logs, setLogs] = useState<{ text: string; cls: string }[]>([]); const [showLogHistory, setShowLogHistory] = useState(false); const [zone, setZone] = useState(''); const [zoneVisible, setZoneVisible] = useState(false); const [dialog, setDialog] = useState<{ npc: Npc; index: number } | null>(null); const [achievementToast, setAchievementToast] = useState<string | null>(null); const [showAchievements, setShowAchievements] = useState(false); const [showEquipment, setShowEquipment] = useState(false); const [showBag, setShowBag] = useState(false); const [showBank, setShowBank] = useState(false); const [showEconomy, setShowEconomy] = useState(false); const [economyTab, setEconomyTab] = useState<'buy' | 'sell' | 'buyback'>('buy'); const [bankQuery, setBankQuery] = useState(''); const [showSkills, setShowSkills] = useState(false); const [showJournal, setShowJournal] = useState(false); const [showMenu, setShowMenu] = useState(false); const [showCoins, setShowCoins] = useState(false); const [showVisualAudit, setShowVisualAudit] = useState(false); const [selectedFaction, setSelectedFaction] = useState<Faction | null>(null); const [saved, setSaved] = useState(false); const [request, setRequest] = useState({ slot: 0, nonce: 0 }); const [remotePlayers, setRemotePlayers] = useState<RemotePlayer[]>([]); const [coop, setCoop] = useState<{ roomId: string; playerId: string; state: 'offline' | 'connecting' | 'online'; error?: string } | null>(null); const [roomInput, setRoomInput] = useState(''); const [progressError, setProgressError] = useState(''); const [authUser, setAuthUser] = useState<AuthUser | null>(null); const [authChecked, setAuthChecked] = useState(false); const [sessionExpired, setSessionExpired] = useState(false); const account = useMemo(() => accountId(), []); const progressRevision = useRef(0); const progressPersistence = useRef(createProgressPersistence()); const logTimer = useRef<number | null>(null); const bankTransferRef = useRef<(itemId: string, direction: 'deposit' | 'withdraw', requested?: number) => void>(() => {}); const gameRef = useRef<GameState | null>(null); gameRef.current = game;
  const requireLogin = useCallback((message = 'Sua sessão expirou. Entre novamente para continuar salvando seu progresso.') => { setSessionExpired(true); setAuthUser(null); setProgressError(message); }, []);
  useEffect(() => { void currentUser().then(({ user }) => { setAuthUser(user); if (user) { progressPersistence.current.reset(); setSessionExpired(false); setProgressError(''); } }).catch(() => setAuthUser(null)).finally(() => setAuthChecked(true)); }, []);
  useEffect(() => {
    if (game) return;
    const button = document.createElement('button');
    button.className = 'ghost-btn genesis-auth-control';
    button.dataset.testid = 'button-auth';
    button.textContent = authUser ? 'Sair da conta' : 'Entrar para sincronizar';
    button.onclick = authUser ? logout : login;
    button.style.cssText = 'position:fixed;top:16px;right:16px;z-index:60;';
    document.body.appendChild(button);
    return () => button.remove();
  }, [game, authUser, authChecked]);
  useEffect(() => {
    if (!sessionExpired) return;
    const notice = document.createElement('div');
    notice.className = 'session-expired';
    notice.setAttribute('role', 'alert');
    notice.dataset.testid = 'alert-session-expired';
    notice.innerHTML = `<strong>${SESSION_EXPIRED_NOTICE.title}</strong><span>${SESSION_EXPIRED_NOTICE.message}</span>`;
    const button = document.createElement('button');
    button.className = 'primary-btn';
    button.textContent = SESSION_EXPIRED_NOTICE.action;
    button.dataset.testid = 'button-login-again';
    button.onclick = login;
    notice.appendChild(button);
    document.body.appendChild(notice);
    return () => notice.remove();
  }, [sessionExpired]);
  useEffect(() => { const onLog = (event: Event) => { const detail = (event as CustomEvent).detail as { text: string; cls: string }; setLogs((prev) => [{ ...detail }, ...prev].slice(0, 8)); }; const onSaved = () => { setSaved(true); if (logTimer.current) window.clearTimeout(logTimer.current); logTimer.current = window.setTimeout(() => setSaved(false), 1800); }; window.addEventListener('genesis-log', onLog); window.addEventListener('genesis-saved', onSaved); return () => { window.removeEventListener('genesis-log', onLog); window.removeEventListener('genesis-saved', onSaved); }; }, []);
  useEffect(() => { const closeAudit = () => setShowVisualAudit(false); window.addEventListener('close-visual-audit', closeAudit); return () => window.removeEventListener('close-visual-audit', closeAudit); }, []);
  const start = async (avatar: Avatar) => {
    if (sessionExpired) return;
    const next = createGame(avatar);
    let restored = false;
    if (authUser) {
       try { const remote = await loadProgress(authUser.id, avatar.id); progressRevision.current = remote.revision; if (remote.progress?.avatar === avatar.id) { const remoteMap = isMapId(remote.progress.mapId) ? remote.progress.mapId : 'forest'; const restoredGame = remoteMap === next.mapId ? next : createGame(avatar, remoteMap, false); applyProgress(restoredGame, remote.progress); if (restoredGame !== next) { next.mapId = restoredGame.mapId; next.map = restoredGame.map; next.objects = restoredGame.objects; next.enemies = restoredGame.enemies; next.npcs = restoredGame.npcs; next.items = restoredGame.items; } restored = remote.revision > 0; } }
       catch (error: unknown) { if (isAccountRequiredError(error)) { requireLogin(); return; } setProgressError('Servidor de progresso indisponível; o salvamento local continua ativo.'); }
    }
    setGame(next); setHud({ ...next.player }); setLogs([{ text: restored ? `${avatar.name} · progresso sincronizado em outro dispositivo.` : `${avatar.name} · ${avatar.role} entrou no mundo partido.`, cls: 'info' }, { text: coop?.state === 'online' ? `Sala ${coop.roomId} conectada · progresso protegido por revisão.` : 'Modo solo local ativo · cooperação continua opcional.', cls: 'info' }, { text: 'Toque no chão para andar; selecione um alvo e use 1–4 para lutar.', cls: 'info' }]);
  };
  const openCoop = async (mode: 'create' | 'join') => {
    setCoop((current) => ({ roomId: current?.roomId ?? '', playerId: current?.playerId ?? newPlayerId(), state: 'connecting' }));
    try {
      const result = mode === 'create' ? await createRoom() : await joinRoom(roomInput);
      setCoop({ roomId: result.roomId, playerId: newPlayerId(), state: 'online' });
    } catch {
      setCoop({ roomId: '', playerId: newPlayerId(), state: 'offline', error: 'Servidor indisponível; você pode jogar no modo solo.' });
    }
  };
  useEffect(() => {
    if (!game || coop?.state !== 'online' || !coop.roomId || !coop.playerId) return;
    let active = true;
    const sync = async () => {
      try {
        const result = await syncPlayer(coop.roomId, coop.playerId, { avatar: game.player.avatar.id, x: game.player.x, y: game.player.y, hp: game.player.hp, maxHp: game.player.maxHp, level: game.player.level, weaponRank: game.player.weaponRank, armorRank: game.player.armorRank, action: game.player.anim, combatEnemies: game.enemies.map((enemy) => ({ id: enemy.id, type: enemy.type, hp: enemy.hp, maxHp: enemy.maxHp, x: enemy.x, y: enemy.y, state: enemy.state, deadUntil: 0 })) });
        if (active) { latestRemotePlayers = result.players; setRemotePlayers(result.players); if (result.combat) applyCombatState(result.combat.enemies); }
      } catch { if (active) setCoop((current) => current ? { ...current, state: 'offline', error: 'Conexão perdida; o progresso local continua seguro.' } : current); }
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 1200);
    return () => { active = false; window.clearInterval(timer); };
  }, [game, coop?.playerId, coop?.roomId, coop?.state]);
  const achievementName = (id: string) => ACHIEVEMENTS.find((x) => x[0] === id)?.[1] ?? id;
  const objectiveMission = useMemo(() => MISSIONS.find((m) => !game?.save.completed[m.id] && game?.save.accepted[m.id]) ?? MISSIONS.find((m) => !game?.save.completed[m.id] && (!m.prerequisite || game?.save.completed[m.prerequisite])), [game]);
  const objective = objectiveMission ? `${objectiveMission.title} · ${game?.save.missions[objectiveMission.id] ?? 0}/${objectiveMission.goal}` : 'Campanha concluída. O mundo aguarda suas conquistas.';
  const availableMission = (npcId: string) => MISSIONS.find((m) => m.npcId === npcId && !game?.save.completed[m.id] && (!m.prerequisite || game?.save.completed[m.prerequisite]));
   const missionStatus = (mission: Mission) => {
     if (game?.save.completed[mission.id]) return 'completed';
     const progress = game?.save.missions[mission.id] ?? 0;
     if (progress >= mission.goal) return 'ready';
     if (game?.save.accepted[mission.id] || progress > 0) return 'active';
     return mission.prerequisite && !game?.save.completed[mission.prerequisite] ? 'blocked' : 'active';
   };
   const nextDelivery = MISSIONS.find((mission) => missionStatus(mission) === 'ready') ?? objectiveMission;
   const npcName = (npcId: string) => game?.npcs.find((npc) => npc.id === npcId)?.name ?? npcId;
  const saveQuestState = () => { if (!game || sessionExpired) return; const snapshot = progressSnapshot(game); const writeLocal = (nextSnapshot: ProgressSnapshot) => { try { localStorage.setItem('genesis-save', JSON.stringify({ version: 2, ...nextSnapshot })); window.dispatchEvent(new Event('genesis-saved')); } catch { /* ignore */ } }; void progressPersistence.current.save({ authenticated: Boolean(authUser), revision: progressRevision.current, snapshot, saveRemote: (revision, nextSnapshot) => saveProgress(authUser?.id ?? '', game.player.avatar.id, revision, nextSnapshot), writeLocal, onAccountRequired: () => requireLogin() }).then((result) => { if (result.kind === 'saved') progressRevision.current = result.remote.revision; }).catch((error: unknown) => { if (!isAccountRequiredError(error)) setProgressError('Outra sessão atualizou o progresso; a versão mais recente foi preservada.'); }); };
    const commerce = (kind: CommerceTransaction['kind'], itemId: string, amount: number, coins: number, soldAt?: number) => {
      if (!game || amount < 1 || sessionExpired) return false;
      const id = `trade-${newPlayerId()}`;
      const transaction: CommerceTransaction = { id, kind, itemId, amount, coins, ...(soldAt ? { soldAt } : {}) };
      game.save.commerceLedger[id] = transaction;
      saveQuestState();
      setHud({ ...game.player }); setGame({ ...game });
      return true;
    };
    const buyPotion = (potion: Potion) => {
      if (!game || game.save.coins < potion.price) { setLogs((prev) => [{ text: 'Moedas insuficientes para esta poção.', cls: 'info' }, ...prev].slice(0, 8)); return; }
      game.save.coins -= potion.price; addInventoryItem(game, potion.id); commerce('buy', potion.id, 1, potion.price);
      setLogs((prev) => [{ text: `Comprado: ${potion.name}. ${potion.effect}; recarga ${potion.cooldown}s.`, cls: 'loot' }, ...prev].slice(0, 8));
    };
    const usePotion = (potion: Potion) => {
      if (!game || (game.save.inventory[potion.id] ?? 0) < 1 || game.firePotion > 0) return;
      const player = game.player;
      if (potion.id === 'potion-life') player.hp = Math.min(player.maxHp, player.hp + 45);
      if (potion.id === 'potion-mana') player.mana = Math.min(player.maxMana, player.mana + 35);
      if (potion.id === 'potion-antidote') player.statuses = player.statuses.filter((status) => status.kind !== 'poison');
      game.save.inventory[potion.id]--; game.firePotion = potion.cooldown;
      game.floaters.push({ x: player.x, y: player.y - 20, text: potion.effect, color: '#8ee7ff', life: 1 });
      setLogs((prev) => [{ text: `${potion.name} usada: ${potion.effect}. Recarga ${potion.cooldown}s.`, cls: 'info' }, ...prev].slice(0, 8));
      saveQuestState(); setHud({ ...player }); setGame({ ...game });
    };
    const useInventoryItem = (itemId: string) => {
      if (!game || (game.save.inventory[itemId] ?? 0) < 1) return;
      if (itemId === 'flask') { useFlask(); return; }
      const potion = POTIONS.find((entry) => entry.id === itemId);
      if (potion) { usePotion(potion); return; }
      const item = ITEM_CATALOG.find((entry) => entry.id === itemId);
      if (!item) return;
      if (item.power) game.player.weaponRank = item.rank;
      if (item.armor) game.player.armorRank = item.rank;
      setLogs((prev) => [{ text: `${item.name} equipado.`, cls: 'info' }, ...prev].slice(0, 8));
      saveQuestState(); setHud({ ...game.player }); setGame({ ...game });
    };
    const discardInventoryItem = (itemId: string) => {
      if (!game || (game.save.inventory[itemId] ?? 0) < 1) return;
      const item = ITEM_CATALOG.find((entry) => entry.id === itemId);
      const equipped = item && ((item.power && item.rank === game.player.weaponRank) || (item.armor && item.rank === game.player.armorRank));
      if (equipped) {
        setLogs((prev) => [{ text: 'Este item está protegido porque está equipado.', cls: 'info' }, ...prev].slice(0, 8));
        return;
      }
      game.save.inventory[itemId]--;
      setLogs((prev) => [{ text: `${item?.name ?? 'Item'} jogado fora.`, cls: 'info' }, ...prev].slice(0, 8));
      saveQuestState(); setSelectedInventoryId(null); setGame({ ...game });
    };
    useEffect(() => {
      if (!showBag) { setSelectedInventoryId(null); return; }
      const sheet = document.querySelector<HTMLElement>('.inventory-sheet');
      if (!sheet) return;
      const items = [...sheet.querySelectorAll<HTMLElement>('.inventory-item')];
      const tray = document.createElement('div');
      tray.className = 'inventory-action-bar';
      tray.setAttribute('data-testid', 'inventory-action-bar');
      sheet.querySelector('.inventory-close')?.before(tray);
      const renderTray = (id: string | null) => {
        const entry = id ? inventoryEntries.find((candidate) => candidate.item.id === id) : undefined;
        const potion = id ? POTIONS.find((candidate) => candidate.id === id) : undefined;
        const itemName = entry?.item.name ?? potion?.name ?? 'Selecione um item';
        tray.innerHTML = `<span class="inventory-selection">${id ? `Selecionado · ${itemName}` : 'Toque em um item para ver as opções'}</span>${id ? '<div class="inventory-actions"><button class="inventory-use" type="button">Usar</button><button class="inventory-discard" type="button">Jogar fora</button></div>' : ''}`;
        tray.querySelector('.inventory-use')?.addEventListener('click', () => id && useInventoryItem(id));
        tray.querySelector('.inventory-discard')?.addEventListener('click', () => id && discardInventoryItem(id));
        items.forEach((item) => item.classList.toggle('selected', item.dataset.inventoryId === id));
      };
      const onItemClick = (event: Event) => {
        const item = (event.currentTarget as HTMLElement).dataset.inventoryId ?? null;
        setSelectedInventoryId(item);
        renderTray(item);
      };
      items.forEach((item) => {
        const id = item.dataset.inventoryId ?? item.getAttribute('data-testid')?.replace('inventory-item-', '');
        if (id) item.dataset.inventoryId = id;
        item.addEventListener('click', onItemClick);
      });
      renderTray(selectedInventoryId);
      return () => {
        items.forEach((item) => item.removeEventListener('click', onItemClick));
        tray.remove();
      };
    }, [showBag, game, selectedInventoryId]);
    const sellItems = (itemId: string, requested: number) => {
      if (!game) return;
      const item = ITEM_CATALOG.find((entry) => entry.id === itemId);
      const equipped = item && ((item.power && item.rank === game.player.weaponRank) || (item.armor && item.rank === game.player.armorRank));
      const amount = Math.min(game.save.inventory[itemId] ?? 0, Math.max(1, Math.floor(requested)));
      if (!amount || equipped) { setLogs((prev) => [{ text: 'Este item está protegido porque está equipado.', cls: 'info' }, ...prev].slice(0, 8)); return; }
      const unit = itemId === 'flask' ? 4 : Math.max(5, Math.round((item?.rank ?? 1) * 7));
      game.save.inventory[itemId] -= amount; game.save.coins += amount * unit;
      commerce('sell', itemId, amount, amount * unit, Date.now());
      setLogs((prev) => [{ text: `Venda concluída: ${amount}× ${item?.name ?? 'Frasco de Vida'} por ${amount * unit} moedas.`, cls: 'loot' }, ...prev].slice(0, 8));
    };
    const buyback = (entry: CommerceTransaction) => {
      if (!game || (entry.soldAt ?? 0) <= Date.now() - 5 * 60_000 || game.save.coins < entry.coins) return;
      game.save.coins -= entry.coins; addInventoryItem(game, entry.itemId, entry.amount); commerce('buyback', entry.itemId, entry.amount, entry.coins);
      setLogs((prev) => [{ text: `Recompra concluída: ${entry.amount}× ${entry.itemId}.`, cls: 'loot' }, ...prev].slice(0, 8));
    };
    const transferBankItem = (itemId: string, direction: 'deposit' | 'withdraw', requested = 1) => {
      if (!game || sessionExpired) return;
      const source = direction === 'deposit' ? game.save.inventory : game.save.bank;
      const available = source[itemId] ?? 0;
      const amount = Math.min(available, Math.max(1, Math.floor(requested)));
      const item = itemId === 'flask' ? undefined : ITEM_CATALOG.find((entry) => entry.id === itemId);
      const equipped = item && ((item.power && item.rank === game.player.weaponRank) || (item.armor && item.rank === game.player.armorRank));
      if (amount <= 0 || equipped) return;
      if (direction === 'deposit' && !(game.save.bank[itemId] ?? 0) && Object.values(game.save.bank).filter((value) => value > 0).length >= 40) {
        setLogs((prev) => [{ text: 'Cofre cheio: libere um espaço antes de guardar outro tipo de item.', cls: 'info' }, ...prev].slice(0, 8));
        return;
      }
      const operation: BankOperation = { id: `bank-${newPlayerId()}`, itemId, direction, amount };
      const next = applyBankOperation(progressSnapshot(game), operation);
       const recorded = next.bankOperations?.[operation.id];
       if (!recorded || recorded.id !== operation.id || recorded.itemId !== operation.itemId || recorded.direction !== operation.direction || recorded.amount !== operation.amount) return;
      game.save.inventory = next.inventory;
      game.save.bank = next.bank ?? {};
      game.save.bankOperations = next.bankOperations ?? {};
      if (itemId === 'flask') game.player.flasks = direction === 'deposit' ? Math.max(0, game.player.flasks - amount) : Math.min(99, game.player.flasks + amount);
       setLogs((prev) => [{ text: `${direction === 'deposit' ? 'Guardado' : 'Retirado'}: ${amount} ${item?.name ?? 'Frasco de Vida'}.`, cls: 'loot' }, ...prev].slice(0, 8));
       try { const snapshot = progressSnapshot(game); localStorage.setItem('genesis-save', JSON.stringify({ version: 2, ...snapshot })); } catch { /* local storage may be unavailable */ }
       saveQuestState(); setHud({ ...game.player }); setGame({ ...game });
    };
    bankTransferRef.current = transferBankItem;
    useEffect(() => {
      if (!showBank) return;
      const onDocumentClick = (event: MouseEvent) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-bank-action]');
        if (!button) return;
        const action = button.dataset.bankAction ?? '';
        const id = button.dataset.bankId;
        if (!id) return;
        const direction = action.startsWith('deposit') ? 'deposit' : 'withdraw';
        const amount = action.endsWith('-all')
          ? (direction === 'deposit' ? gameRef.current?.save.inventory[id] : gameRef.current?.save.bank[id]) ?? 0
          : 1;
        bankTransferRef.current(id, direction, amount);
      };
      document.addEventListener('click', onDocumentClick);
      return () => document.removeEventListener('click', onDocumentClick);
    }, [showBank]);
    useEffect(() => {
      if (dialog?.npc.id === 'bank') { setDialog(null); setShowBank(true); }
      if (dialog?.npc.id === 'vendor' || dialog?.npc.id === 'buyer' || dialog?.npc.id === 'alchemist') { setEconomyTab(dialog.npc.id === 'buyer' ? 'sell' : dialog.npc.id === 'alchemist' ? 'buy' : 'buy'); setDialog(null); setShowEconomy(true); }
    }, [dialog]);
    useEffect(() => {
      if (!showJournal || !game) return;
      document.querySelectorAll<HTMLElement>('.journal-mission').forEach((article) => {
        if (article.classList.contains('completed') || article.classList.contains('blocked') || article.querySelector('[data-mission-route]')) return;
        const missionId = article.dataset.testid?.replace('journal-mission-', '');
        if (!missionId) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mission-route';
        button.dataset.missionRoute = missionId;
        button.textContent = 'Ir até o local';
        button.setAttribute('aria-label', `Ir até o local da missão ${missionId}`);
        button.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('genesis-mission-route', { detail: { missionId } }));
          setShowJournal(false);
        });
        article.appendChild(button);
      });
    }, [showJournal, game]);
    useEffect(() => {
      const bar = document.querySelector<HTMLElement>('.stats-bar');
      if (!bar || bar.querySelector('[data-testid="button-bank"]')) return;
      const button = document.createElement('button');
      button.className = 'equip-slot bank-access';
      button.type = 'button';
      button.setAttribute('aria-label', 'Abrir cofre');
      button.setAttribute('data-testid', 'button-bank');
      button.innerHTML = '<span aria-hidden="true">▣</span>';
      button.addEventListener('click', () => setShowBank(true));
       document.body.appendChild(button);
      return () => button.remove();
    }, [game]);
    useEffect(() => {
      if (!showBank || !game) return;
      const panel = document.createElement('div');
      panel.className = 'overlay bank-overlay';
      panel.setAttribute('data-testid', 'panel-bank');
      const catalog = ['flask', ...ITEM_CATALOG.map((item) => item.id)];
      const entries = catalog
        .map((id) => {
          const item = id === 'flask' ? { id, name: 'Frasco de Vida', icon: '+', rarity: 'common' as Rarity, rank: 0 } : ITEM_CATALOG.find((entry) => entry.id === id);
          if (!item) return null;
          const inventory = game.save.inventory[id] ?? 0;
          const stored = game.save.bank[id] ?? 0;
          const equipped = item.id !== 'flask' && ((item.power && item.rank === game.player.weaponRank) || (item.armor && item.rank === game.player.armorRank));
          return { item, inventory, stored, equipped };
        })
        .filter((entry): entry is { item: Item; inventory: number; stored: number; equipped: boolean } => Boolean(entry))
        .filter(({ item, inventory, stored }) => (inventory + stored > 0) && item.name.toLocaleLowerCase().includes(bankQuery.toLocaleLowerCase()));
      panel.innerHTML = `<section class="bank-sheet hud-card"><button class="panel-close" aria-label="Fechar cofre">×</button><div class="micro">armazenamento persistente</div><h2>Cofre do Limiar</h2><p class="bank-intro">Itens guardados ficam seguros no modo solo e na conta autenticada. Equipamentos ativos ficam protegidos.</p><label class="bank-search"><span>Buscar item</span><input type="search" value="${escapeHtml(bankQuery)}" placeholder="nome do item" aria-label="Buscar item no cofre" /></label><div class="bank-capacity"><strong>${Object.values(game.save.bank).filter((value) => value > 0).length}/40 tipos guardados</strong><span>Bolsa: ${Object.values(game.save.inventory).reduce((total, value) => total + value, 0)} unidades</span></div><div class="bank-grid">${entries.length ? entries.map(({ item, inventory, stored, equipped }) => `<article class="bank-item${equipped ? ' protected' : ''}"><div class="bank-item-icon" style="color:${RARITY_COLORS[item.rarity]}">${item.icon}</div><div class="bank-item-copy"><b>${item.name}</b><small>${RARITY_LABEL[item.rarity]} · bolsa ${inventory} · cofre ${stored}</small></div><div class="bank-actions"><button class="ghost-btn" data-bank-action="deposit" data-bank-id="${item.id}" ${equipped || inventory <= 0 ? 'disabled' : ''}>Guardar 1</button><button class="ghost-btn" data-bank-action="deposit-all" data-bank-id="${item.id}" ${equipped || inventory <= 0 ? 'disabled' : ''}>Guardar tudo</button><button class="ghost-btn" data-bank-action="withdraw" data-bank-id="${item.id}" ${stored <= 0 ? 'disabled' : ''}>Retirar 1</button><button class="ghost-btn" data-bank-action="withdraw-all" data-bank-id="${item.id}" ${stored <= 0 ? 'disabled' : ''}>Retirar tudo</button></div></article>`).join('') : '<div class="inventory-empty">Nenhum item encontrado.<br /><small>Guarde equipamentos e frascos para liberar espaço.</small></div>'}</div><button class="ghost-btn bank-close">Fechar cofre</button></section>`;
      document.body.appendChild(panel);
      const close = () => setShowBank(false);
      panel.querySelector('.panel-close')?.addEventListener('click', close);
      panel.querySelector('.bank-close')?.addEventListener('click', close);
      panel.querySelector<HTMLInputElement>('input')?.addEventListener('input', (event) => setBankQuery((event.target as HTMLInputElement).value));
      return () => panel.remove();
    }, [showBank, game, bankQuery]);
    useEffect(() => {
      if (!showEconomy || !game) return;
      const panel = document.createElement('div'); panel.className = 'overlay economy-overlay'; panel.dataset.testid = 'panel-economy';
      const sold = Object.values(game.save.commerceLedger).filter((entry) => entry.kind === 'sell' && (entry.soldAt ?? 0) > Date.now() - 5 * 60_000);
      const label = (id: string) => id === 'flask' ? 'Frasco de Vida' : ITEM_CATALOG.find((item) => item.id === id)?.name ?? id;
      const price = (id: string) => id === 'flask' ? 4 : Math.max(5, Math.round((ITEM_CATALOG.find((item) => item.id === id)?.rank ?? 1) * 7));
      const entries = Object.entries(game.save.inventory).filter(([id, amount]) => amount > 0 && (ITEM_CATALOG.some((item) => item.id === id) || id === 'flask'));
      panel.innerHTML = `<section class="economy-sheet hud-card"><button class="panel-close" aria-label="Fechar comércio">×</button><div class="micro">mercado do hub · saldo ${game.save.coins} ◉</div><h2>Mercado seguro</h2><p class="economy-intro">Preços e efeitos visíveis. Equipamentos ativos ficam protegidos; a recompra expira em 5 minutos.</p><div class="economy-tabs"><button data-tab="buy">Comprar</button><button data-tab="sell">Vender</button><button data-tab="buyback">Recomprar</button></div><div class="economy-list"></div><button class="ghost-btn economy-close">Fechar mercado</button></section>`;
      document.body.appendChild(panel);
      const list = panel.querySelector('.economy-list') as HTMLElement;
      const render = (tab: string) => {
        if (tab === 'buy') list.innerHTML = POTIONS.map((p) => `<article class="economy-row"><span class="economy-icon">${p.icon}</span><div><strong>${p.name}</strong><small>${p.effect} · recarga ${p.cooldown}s · bolsa ${game.save.inventory[p.id] ?? 0}</small></div><button class="primary-btn" data-buy="${p.id}" ${game.save.coins < p.price ? 'disabled' : ''}>${p.price} ◉</button><button class="ghost-btn" data-use="${p.id}" ${(game.save.inventory[p.id] ?? 0) < 1 || game.firePotion > 0 ? 'disabled' : ''}>Usar</button></article>`).join('');
        if (tab === 'sell') list.innerHTML = entries.length ? entries.map(([id, amount]) => `<article class="economy-row"><span class="economy-icon">▣</span><div><strong>${label(id)}</strong><small>${amount} disponíveis · ${price(id)} ◉ por unidade</small></div><button class="ghost-btn" data-sell="${id}">Vender tudo</button></article>`).join('') : '<p class="economy-empty">Nenhum item seguro para vender.</p>';
        if (tab === 'buyback') list.innerHTML = sold.length ? sold.map((e) => `<article class="economy-row"><span class="economy-icon">↺</span><div><strong>${e.amount}× ${label(e.itemId)}</strong><small>recompra por ${e.coins} ◉ · janela de 5 min</small></div><button class="ghost-btn" data-buyback="${e.id}">Recomprar</button></article>`).join('') : '<p class="economy-empty">Nenhuma venda recente para recomprar.</p>';
      };
      render(economyTab);
      panel.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => button.addEventListener('click', () => { setEconomyTab(button.dataset.tab as 'buy' | 'sell' | 'buyback'); }));
      panel.querySelector('[data-tab="buy"]')?.addEventListener('click', () => render('buy'));
      panel.querySelector('[data-tab="sell"]')?.addEventListener('click', () => render('sell'));
      panel.querySelector('[data-tab="buyback"]')?.addEventListener('click', () => render('buyback'));
      panel.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) => b.addEventListener('click', () => { const p = POTIONS.find((x) => x.id === b.dataset.buy); if (p) buyPotion(p); }));
      panel.querySelectorAll<HTMLButtonElement>('[data-use]').forEach((b) => b.addEventListener('click', () => { const p = POTIONS.find((x) => x.id === b.dataset.use); if (p) usePotion(p); }));
      panel.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((b) => b.addEventListener('click', () => sellItems(b.dataset.sell ?? '', game.save.inventory[b.dataset.sell ?? ''] ?? 0)));
      panel.querySelectorAll<HTMLButtonElement>('[data-buyback]').forEach((b) => b.addEventListener('click', () => { const e = game.save.commerceLedger[b.dataset.buyback ?? '']; if (e) buyback(e); }));
      const close = () => setShowEconomy(false); panel.querySelector('.panel-close')?.addEventListener('click', close); panel.querySelector('.economy-close')?.addEventListener('click', close);
      return () => panel.remove();
    }, [showEconomy, economyTab, game, buyPotion, sellItems, buyback]);
    const handleQuest = (mission: Mission) => { if (!game) return; if (!game.save.accepted[mission.id]) { game.save.accepted[mission.id] = true; game.save.missions[mission.id] = game.save.missions[mission.id] ?? 0; setLogs((prev) => [{ text: `Missão recebida: ${mission.title}.`, cls: 'info' }, ...prev].slice(0, 8)); } else if (applyMissionReward(game, mission)) { setLogs((prev) => [{ text: `Recompensa aplicada: ${mission.reward}.`, cls: 'loot' }, ...prev].slice(0, 8)); } saveQuestState(); setHud({ ...game.player }); setGame({ ...game }); setDialog(null); };
    const revive = () => { if (!game) return; const p = game.player; p.dying = false; p.hp = p.maxHp; p.mana = p.maxMana; p.target = null; p.moveTarget = null; p.invincible = 3; p.x = p.avatar.faction === 'awakened' ? WORLD_W * .12 : WORLD_W * .88; p.y = WORLD_H * .5; game.save.revives++; if (game.save.revives >= 5) game.save.ach.alive = true; saveQuestState(); setHud({ ...p }); };
    const travelTo = (target: MapId) => { if (!game || target === game.mapId) return; window.dispatchEvent(new Event('genesis-travel-start')); const next = createGame(game.player.avatar, target, false); next.save = game.save; next.player = { ...next.player, ...game.player, x: target === 'hub' ? WORLD_W * .5 : WORLD_W * .12, y: WORLD_H * .5, target: null, moveTarget: null, dying: false, combatTimer: 0, invincible: 1, lastZone: undefined }; next.player.maxHp = maxHp(next.player.armorRank, next.player.avatar); next.player.hp = Math.min(next.player.maxHp, next.player.hp); next.cam = { x: next.player.x, y: next.player.y }; setGame(next); setHud({ ...next.player }); setLogs((previous) => [{ text: `Entrou em ${MAP_INFO[target].name}. ${MAP_INFO[target].subtitle}.`, cls: 'info' }, ...previous].slice(0, 8)); };
    useEffect(() => { activeTravel = travelTo; return () => { activeTravel = undefined; }; }, [game]);
  const applyCombatState = (enemies: CombatEnemyState[]) => {
    if (!game) return;
    const shared = new Map(enemies.map((enemy) => [enemy.id, enemy]));
    game.enemies.forEach((enemy) => {
      const state = shared.get(enemy.id);
      if (!state) return;
      enemy.hp = state.hp; enemy.state = state.state; enemy.x = state.x; enemy.y = state.y;
      if (state.state === 'dead') { enemy.anim = 'dead'; enemy.deadTimer = 14; }
    });
    setGame({ ...game });
  };
   const newGame = () => { try { localStorage.removeItem('genesis-save'); } catch { /* storage bloqueado não impede reiniciar a sessão atual */ } setGame(null); setHud(null); setSelectedFaction(null); setShowAchievements(false); setLogs([]); };
   const useFlask = () => { if (!game || game.player.flasks <= 0 || game.player.hp >= game.player.maxHp) return; game.player.flasks--; game.save.inventory.flask = Math.max(0, game.player.flasks); const heal = Math.round(40 * (game.player.avatar.id === 'mother' ? 1.25 : 1)); game.player.hp = Math.min(game.player.maxHp, game.player.hp + heal); game.floaters.push({ x: game.player.x, y: game.player.y - 20, text: `+${heal}`, color: '#7fffb0', life: 1 }); saveQuestState(); setHud({ ...game.player }); };
   const equipItem = (item: Item, kind: ItemKind) => { if (!game || kind === 'flask') return; if (kind === 'weapon') game.player.weaponRank = item.rank; else game.player.armorRank = item.rank; setLogs((prev) => [{ text: `Equipamento escolhido: ${item.name}.`, cls: 'loot' }, ...prev].slice(0, 8)); saveQuestState(); setHud({ ...game.player }); setGame({ ...game }); };
   useEffect(() => {
     if (!showEquipment || !game) return;
     const panel = document.querySelector<HTMLElement>('.equip-panel');
     if (!panel) return;
     const body = document.createElement('div');
     body.className = 'equipment-loadout';
     body.setAttribute('data-testid', 'equipment-loadout');
     const weaponItems = WEAPONS.filter((item) => (game.save.inventory[item.id] ?? 0) > 0);
     const armorItems = ARMORS.filter((item) => (game.save.inventory[item.id] ?? 0) > 0);
     const slot = (label: string, icon: string, current: Item | undefined, items: Item[], kind: 'weapon' | 'armor') => `
       <section class="equipment-slot-panel" data-equipment-kind="${kind}">
         <div class="equipment-slot-head"><span class="equipment-slot-icon">${icon}</span><div><b>${label}</b><small>${current ? current.name : 'Vazio'}</small></div><button type="button" class="equipment-remove" data-remove-equipment="${kind}" ${current ? '' : 'disabled'}>Tirar</button></div>
         <div class="equipment-options">${items.length ? items.map((item) => `<button type="button" class="equipment-option${current?.id === item.id ? ' active' : ''}" data-equip-id="${item.id}" data-equip-kind="${kind}"><span class="equipment-option-icon">${item.icon}</span><span>${item.name}</span><small>NV ${item.rank}</small></button>`).join('') : '<span class="equipment-empty">Nenhum item deste tipo na bolsa.</span>'}</div>
       </section>`;
     body.innerHTML = `<div class="equipment-instruction">Escolha um item para colocar por cima do equipamento atual.</div>${slot('Arma', '⚔', WEAPONS.find((item) => item.rank === game.player.weaponRank), weaponItems, 'weapon')}${slot('Armadura', '⬡', ARMORS.find((item) => item.rank === game.player.armorRank), armorItems, 'armor')}`;
     panel.querySelector('h3')?.after(body);
     const onEquip = (event: Event) => {
       const target = event.currentTarget as HTMLElement;
       const item = ITEM_CATALOG.find((entry) => entry.id === target.dataset.equipId);
       const kind = target.dataset.equipKind as ItemKind | undefined;
       if (item && kind) equipItem(item, kind);
     };
     const onRemove = (event: Event) => {
       const kind = (event.currentTarget as HTMLElement).dataset.removeEquipment;
       if (kind === 'weapon') game.player.weaponRank = 0;
       if (kind === 'armor') { game.player.armorRank = 0; game.player.maxHp = maxHp(1, game.player.avatar); game.player.hp = Math.min(game.player.hp, game.player.maxHp); }
       if (kind === 'weapon' || kind === 'armor') { setLogs((prev) => [{ text: `${kind === 'weapon' ? 'Arma' : 'Armadura'} retirada.`, cls: 'info' }, ...prev].slice(0, 8)); try { localStorage.setItem('genesis-save', JSON.stringify({ version: 2, ...progressSnapshot(game) })); } catch { /* local storage may be unavailable */ } saveQuestState(); setHud({ ...game.player }); setGame({ ...game }); }
     };
     const options = [...body.querySelectorAll<HTMLElement>('[data-equip-id]')];
     const removeButtons = [...body.querySelectorAll<HTMLElement>('[data-remove-equipment]')];
     options.forEach((option) => { option.addEventListener('click', onEquip); option.onclick = onEquip; });
     removeButtons.forEach((button) => { button.addEventListener('click', onRemove); button.onclick = onRemove; });
     return () => { options.forEach((option) => { option.removeEventListener('click', onEquip); option.onclick = null; }); removeButtons.forEach((button) => { button.removeEventListener('click', onRemove); button.onclick = null; }); body.remove(); };
   }, [showEquipment, game, equipItem]);
    activeProgressPersistence = game && authUser && !sessionExpired ? {
      account: authUser.id,
      characterId: game.player.avatar.id,
      revision: progressRevision,
      onRevision: () => undefined,
      onError: (message) => { if (message.startsWith('Sua sessão expirou')) requireLogin(message); else setProgressError(message); },
      save: async (snapshot: ProgressSnapshot) => {
        const result = await progressPersistence.current.save({
          authenticated: true,
          revision: progressRevision.current,
          snapshot,
          saveRemote: (revision, nextSnapshot) => saveProgress(authUser.id, game.player.avatar.id, revision, nextSnapshot),
          writeLocal: () => undefined,
          onAccountRequired: () => requireLogin(),
        });
        return result.kind === 'saved' ? result.remote : null;
      },
    } : undefined;
     useEffect(() => { document.documentElement.style.setProperty('--dialog-portrait', dialog?.npc.portrait ? `url("${dialog.npc.portrait}")` : 'none'); return () => { document.documentElement.style.removeProperty('--dialog-portrait'); }; }, [dialog]);
      useEffect(() => {
        const stack = document.querySelector<HTMLElement>('.log-stack');
        if (!stack) return;
        const toggle = () => stack.classList.toggle('expanded');
        stack.addEventListener('click', toggle);
        return () => stack.removeEventListener('click', toggle);
      }, [game, logs]);
      useEffect(() => {
        const items = Array.from(document.querySelectorAll<HTMLElement>('.inventory-item'));
        const handlers = items.map((element) => {
          const id = element.dataset.testid?.replace('inventory-item-', '');
          const item = id ? ITEM_CATALOG.find((entry) => entry.id === id) : undefined;
          if (!item) return { element, handler: () => undefined };
          const kind: ItemKind = WEAPONS.includes(item) ? 'weapon' : 'armor';
          const handler = () => equipItem(item, kind);
          element.addEventListener('click', handler);
          return { element, handler };
        });
        return () => handlers.forEach(({ element, handler }) => element.removeEventListener('click', handler));
      }, [showBag, game, equipItem]);
      useEffect(() => {
        const inventory = game?.save.inventory ?? {};
       const items = Object.entries(inventory)
         .filter(([, quantity]) => quantity > 0)
         .map(([id, quantity]) => {
           const item = id === 'flask' ? { name: 'Frasco de Vida', rarity: 'common' as Rarity } : ITEM_CATALOG.find((entry) => entry.id === id);
           if (!item) return null;
           const equipped = (item as Item).power ? (item as Item).rank === game?.player.weaponRank : (item as Item).armor ? (item as Item).rank === game?.player.armorRank : false;
           return `${equipped ? '◆' : '•'} ${item.name} ×${quantity} · ${RARITY_LABEL[item.rarity]}`;
         })
         .filter((item): item is string => Boolean(item));
       document.documentElement.style.setProperty('--inventory-summary', JSON.stringify(items.length ? items.join('\n') : 'A bolsa está vazia'));
       return () => { document.documentElement.style.removeProperty('--inventory-summary'); };
     }, [game]);
    if (!game && !showMenu) return <StartHub onStart={() => setShowMenu(true)} />;
   if (!game) return <div className="overlay select-screen" data-testid="screen-character-select"><div className="select-content"><div className="genesis-mark">Arquivo 07 · Mundo partido</div><h1 className="genesis-title">PROJECT <span>GENESIS</span></h1><p className="select-intro">Um mundo quebrado entre raízes e metal. Escolha uma hierarquia para conhecer suas classes, técnicas e forma própria de vencer.</p><div className="coop-lobby hud-card"><strong>COOPERAÇÃO OPCIONAL</strong><small>{coop?.state === 'online' ? `Sala ${coop.roomId} · área compartilhada` : 'O modo solo local nunca depende do servidor.'}</small>{coop?.state === 'online' ? <span className="coop-online">● conectado · escolha sua hierarquia</span> : <div className="coop-actions"><button className="ghost-btn" onClick={() => void openCoop('create')} disabled={coop?.state === 'connecting'}>Criar sala</button><input value={roomInput} onChange={(event) => setRoomInput(event.target.value.toUpperCase().slice(0, 6))} placeholder="código" aria-label="Código da sala" /><button className="ghost-btn" onClick={() => roomInput.length === 6 && void openCoop('join')} disabled={roomInput.length !== 6 || coop?.state === 'connecting'}>Entrar</button></div>}{coop?.error && <small className="coop-error">{coop.error}</small>}</div>{selectedFaction ? <><div className="selection-heading"><button className="back-choice" onClick={() => setSelectedFaction(null)} data-testid="button-back-factions">← Hierarquias</button><div><div className="select-rule">Classes disponíveis</div><p>Escolha seu representante em {selectedFaction === 'awakened' ? 'Os Despertos' : 'O Consórcio'}.</p></div></div><div className="character-grid">{AVATARS.filter((avatar) => avatar.faction === selectedFaction).map((avatar) => <button key={avatar.id} className={`character-card ${avatar.faction === 'consortium' ? 'cons' : ''}`} onClick={() => start(avatar)} data-testid={`button-character-${avatar.id}`}><div className="class-badge" style={{ color: avatar.color, borderColor: avatar.color }}>{avatar.icon}</div><div className="character-name">{avatar.name}</div><div className="character-faction">{avatar.role} · {avatar.faction === 'awakened' ? 'Os Despertos' : 'O Consórcio'}</div><div className="class-stats">HP {avatar.hp} · EN {avatar.mana} · ATQ {Math.round(avatar.power * 100)}%</div><div className="class-passive">{avatar.passive}</div></button>)}</div></> : <><div className="select-rule">Escolha sua hierarquia</div><div className="faction-grid"><button className="faction-choice awakened" onClick={() => setSelectedFaction('awakened')} data-testid="button-faction-awakened"><div className="faction-choice-mark">A</div><div><strong>Os Despertos</strong><span>Raízes, mutações e técnicas ancestrais.</span><small>{AVATARS.filter((avatar) => avatar.faction === 'awakened').length} classes disponíveis</small></div><b>→</b></button><button className="faction-choice consortium" onClick={() => setSelectedFaction('consortium')} data-testid="button-faction-consortium"><div className="faction-choice-mark">C</div><div><strong>O Consórcio</strong><span>Metal, energia e engenharia de combate.</span><small>{AVATARS.filter((avatar) => avatar.faction === 'consortium').length} classes disponíveis</small></div><b>→</b></button></div></>}<div className="select-actions"><button className="ghost-btn" onClick={() => setShowVisualAudit(true)} data-testid="button-open-visual-audit"><FlaskConical size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Abrir laboratório visual</button></div><div className="controls-note">Clique no chão para caminhar · selecione criaturas para fixar alvo · 1, 2, 3 e 4 lançam técnicas<br />Tudo é salvo localmente neste dispositivo.</div></div>{showVisualAudit && <SpriteAudit />}</div>;
   const weapon = WEAPONS.find((x) => x.rank === hud?.weaponRank) ?? WEAPONS[0], armor = ARMORS.find((x) => x.rank === hud?.armorRank) ?? ARMORS[0], abilities = [...game.player.avatar.skills, game.player.avatar.ultimate];
   const inventoryEntries = Object.entries(game.save.inventory).filter(([, quantity]) => quantity > 0).map(([id, quantity]) => {
     const item = id === 'flask' ? { id: 'flask', name: 'Frasco de Vida', icon: '+', rank: 0, rarity: 'common' as Rarity, kind: 'flask' as ItemKind } : ITEM_CATALOG.find((entry) => entry.id === id);
     if (!item) return null;
     const kind = 'kind' in item ? item.kind : WEAPONS.includes(item) ? 'weapon' : 'armor';
     const equipped = kind === 'weapon' ? item.rank === game.player.weaponRank : kind === 'armor' ? item.rank === game.player.armorRank : false;
     return { item, kind, quantity, equipped };
   }).filter((entry): entry is { item: Item; kind: ItemKind; quantity: number; equipped: boolean } => Boolean(entry));
  const triggerSkill = (slot: number) => setRequest({ slot, nonce: request.nonce + 1 });
   const toast = achievementToast ? <div className="achievement-toast hud-card"><div>CONQUISTA DESBLOQUEADA</div><strong>{achievementToast}</strong></div> : null;
    return <div className="genesis-shell" data-testid="screen-game"><GameCanvas game={game} request={request} onHud={(p) => setHud(p)} onDialog={(npc) => setDialog({ npc, index: 0 })} onAchievement={(id) => { setAchievementToast(achievementName(id)); window.setTimeout(() => setAchievementToast(null), 3200); }} onDeath={() => setHud({ ...game.player })} onZone={(name) => { setZone(name); setZoneVisible(true); window.setTimeout(() => setZoneVisible(false), 2400); }} /><div className="hud-layer"><div className="player-card hud-card" data-testid="status-player"><div className="player-avatar" style={{ color: hud?.avatar.color }}>{hud?.avatar.icon}</div><div><div className="player-name">{hud?.avatar.name} <span className="level-chip">NV {hud?.level}</span></div><div className="player-faction">{hud?.avatar.role} · {hud?.avatar.faction === 'awakened' ? 'Os Despertos' : 'O Consórcio'}</div><div className="xp-track"><div style={{ width: `${((hud?.xp ?? 0) / (hud?.nextXp ?? 1)) * 100}%` }} /></div></div></div><div className="objective-card hud-card" data-testid="text-objective"><strong>MISSÃO ATIVA</strong><span>{objective}</span><div className="mission-reward">{MISSIONS[Math.min((hud?.level ?? 1) - 1, MISSIONS.length - 1)]?.reward}</div></div><div className={`zone-banner ${zoneVisible ? 'show' : ''}`} data-testid="status-zone">{zone}</div>{game.player.target && <div className="target-frame hud-card">{(() => { const t = game.enemies.find((e) => e.id === game.player.target); return t ? <><span className="target-mark">ALVO FIXADO</span><b>{t.name}{t.boss ? ` · FASE ${t.phase}` : ''}</b><div className="target-hp"><i style={{ width: `${(t.hp / t.maxHp) * 100}%` }} /></div><small>{Math.ceil(t.hp)} / {t.maxHp}</small></> : null; })()}</div>}<div className="log-stack">{logs.map((line, index) => <div key={`${line.text}-${index}`} className={`log-line ${line.cls}`} data-testid={`text-log-${index}`}>{line.text}</div>)}</div><div className="stats-bar"><div className="hp-wrap"><div className="bar-label"><Heart size={11} />VITALIDADE</div><div className="hp-track"><div className="hp-fill" style={{ width: `${((hud?.hp ?? 0) / (hud?.maxHp ?? 1)) * 100}%` }} /><div className="hp-text" data-testid="status-hp">{Math.ceil(hud?.hp ?? 0)}/{hud?.maxHp ?? 0}</div></div><div className="mana-track"><div style={{ width: `${((hud?.mana ?? 0) / (hud?.maxMana ?? 1)) * 100}%` }} /><span><Zap size={9} /> {Math.floor(hud?.mana ?? 0)}/{hud?.maxMana ?? 0}</span></div></div><button className="equip-slot" onClick={() => setShowBag(true)} aria-label="Abrir bolsa" data-testid="button-inventory"><PackageOpen size={18} /></button><button className="equip-slot" onClick={() => setShowEquipment(true)} aria-label="Abrir arma" data-testid="button-weapon"><Sword size={18} /><span className="slot-level">{hud?.weaponRank}</span></button><button className="equip-slot" onClick={() => setShowEquipment(true)} aria-label="Abrir armadura" data-testid="button-armor"><Shield size={18} /><span className="slot-level">{hud?.armorRank}</span></button><button className="equip-slot" onClick={useFlask} aria-label="Usar frasco de vida" data-testid="button-flask"><FlaskConical size={18} /><span className="flask-count">{hud?.flasks}</span></button><span className="save-label">{saved ? 'progresso salvo' : 'modo solo · local'}</span><button className="achievement-button" onClick={() => setShowJournal(true)} aria-label="Abrir diário da campanha" data-testid="button-journal"><BookOpen size={17} /></button><button className="achievement-button" onClick={() => setShowAchievements(true)} aria-label="Abrir conquistas" data-testid="button-achievements"><Trophy size={17} /></button></div></div><div className="skill-bar hud-card" data-testid="skill-bar">{abilities.map((ability, index) => { const cd = (game.player as Player & Record<string, number>)[`cd${index + 1}`] ?? 0; const locked = (hud?.level ?? 1) < ability.unlock; return <button key={ability.id} className={`skill-button ${locked ? 'locked' : ''}`} style={{ '--skill-color': ability.color } as CSSProperties} onClick={() => !locked && triggerSkill(index + 1)} disabled={locked} aria-label={`${ability.name}, tecla ${index + 1}`}><span className="skill-key">{index + 1}</span><span className="skill-glyph">{ability.short.slice(0, 2)}</span><span className="skill-name">{ability.name}</span>{locked ? <small>NV {ability.unlock}</small> : cd > 0 ? <em>{cd.toFixed(1)}</em> : null}</button>; })}<button className="skills-info" onClick={() => setShowSkills(true)} aria-label="Ver detalhes das habilidades"><Sparkles size={16} /></button></div>{showBag && <div className="overlay inventory-overlay" data-testid="panel-inventory"><section className="inventory-sheet hud-card"><button className="panel-close" onClick={() => setShowBag(false)} aria-label="Fechar bolsa"><X size={17} /></button><div className="micro">inventário persistente · {inventoryEntries.length} tipos</div><h2>Bolsa de campanha</h2><p className="inventory-intro">Tudo que você coletou fica aqui após recarregar. O diamante marca o equipamento ativo.</p>{inventoryEntries.length ? <div className="inventory-grid">{inventoryEntries.map(({ item, kind, quantity, equipped }) => <article className={`inventory-item ${equipped ? 'equipped' : ''}`} key={item.id} data-testid={`inventory-item-${item.id}`}><div className="inventory-icon" style={{ color: RARITY_COLORS[item.rarity], backgroundImage: `url("/assets/raven-icons/${kind === 'weapon' ? 'weapon' : kind === 'armor' ? 'armor' : 'flask'}.png")` }}>{item.icon}</div><div className="inventory-copy"><b>{equipped ? '◆ ' : ''}{item.name}</b><span style={{ color: RARITY_COLORS[item.rarity] }}>{RARITY_LABEL[item.rarity]} · {kind === 'flask' ? 'consumível' : `nível ${item.rank}`}</span><small>Quantidade · {quantity}</small></div></article>)}</div> : <div className="inventory-empty">A bolsa está vazia.<br /><small>Explore o mundo e recolha itens para vê-los aqui.</small></div>}<button className="ghost-btn inventory-close" onClick={() => setShowBag(false)}>Fechar bolsa</button></section></div>}{showEquipment && <div className="panel equip-panel hud-card" data-testid="panel-equipment"><button className="panel-close" onClick={() => setShowEquipment(false)} aria-label="Fechar equipamento"><X size={17} /></button><h3>ARSENAL</h3><p className="rarity-note" style={{ color: RARITY_COLORS[weapon.rarity] }}>{weapon.name} · {RARITY_LABEL[weapon.rarity]}</p><p>Dano estimado: {Math.max(1, (hud?.weaponRank ?? 1) * 5 - (hud?.armorRank ?? 1) * 3)}–{Math.max(2, (hud?.weaponRank ?? 1) * 10 - (hud?.armorRank ?? 1))}</p><p className="rarity-note" style={{ color: RARITY_COLORS[armor.rarity] }}>{armor.name} · {RARITY_LABEL[armor.rarity]}</p><p>Vida máxima: {hud?.maxHp} · redução: {armor.armor ?? armor.rank}</p></div>}{showSkills && <div className="overlay skills-panel"><div className="skills-sheet hud-card"><button className="panel-close" onClick={() => setShowSkills(false)} aria-label="Fechar habilidades"><X size={17} /></button><div className="micro">livro de técnicas · {hud?.avatar.role}</div><h2>{hud?.avatar.name}</h2><p className="passive-line"><Gauge size={14} /> Passiva · {hud?.avatar.passive}</p>{abilities.map((a, i) => <div className="skill-row" key={a.id}><span style={{ color: a.color }}>{i + 1}</span><div><b>{a.name}</b><small>{a.short} · {a.cost ? `${a.cost} energia` : 'ultimate'} · recarga ${a.cooldown}s</small></div><strong>{hud && hud.level >= a.unlock ? 'DESBLOQUEADA' : `NÍVEL ${a.unlock}`}</strong></div>)}</div></div>}{dialog && <button className="panel dialog-panel hud-card" onClick={() => dialog.index + 1 < dialog.npc.lines.length ? setDialog({ ...dialog, index: dialog.index + 1 }) : setDialog(null)} data-testid="button-dialog-next"><div className="dialog-name">{dialog.npc.name}</div><div className="dialog-text">{dialog.npc.lines[dialog.index]}</div><div className="dialog-hint">toque para continuar</div></button>}{hud?.dying && <div className="overlay death-overlay" data-testid="overlay-death"><h2>Você foi derrotado</h2><p>Seu nível e equipamento permanecem com você. Retorne ao último ponto seguro.</p><button className="primary-btn" onClick={revive} data-testid="button-revive"><RotateCcw size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />Reviver</button></div>}{showJournal && <div className="overlay journal-overlay" data-testid="panel-journal"><div className="journal-sheet hud-card"><button className="panel-close" onClick={() => setShowJournal(false)} aria-label="Fechar diário"><X size={17} /></button><div className="micro">registro da campanha regional</div><h2>Diário de viagem</h2><p className="journal-intro">Acompanhe a cadeia de missões, suas recompensas e quem aguarda a próxima entrega.</p>{REGIONS.map((region) => <section className="journal-region" key={region}><div className="journal-region-title"><span>{region}</span><small>{MISSIONS.filter((mission) => mission.region === region && missionStatus(mission) === 'completed').length}/{MISSIONS.filter((mission) => mission.region === region).length} concluídas</small></div>{MISSIONS.filter((mission) => mission.region === region).map((mission) => { const status = missionStatus(mission); const progress = Math.min(game.save.missions[mission.id] ?? 0, mission.goal); return <article className={`journal-mission ${status}`} key={mission.id} data-testid={`journal-mission-${mission.id}`}><div className="journal-mission-top"><span className="journal-status">{status === 'completed' ? 'CONCLUÍDA' : status === 'ready' ? 'PRONTA PARA ENTREGA' : status === 'blocked' ? 'BLOQUEADA' : 'ATIVA'}</span><span className="journal-progress">{status === 'blocked' ? '—' : `${progress}/${mission.goal}`}</span></div><h3>{mission.title}</h3><p>{mission.desc}</p><div className="journal-meta"><span>Entrega: {npcName(mission.npcId)}</span><span className={status === 'completed' ? 'journal-reward received' : 'journal-reward'}>{status === 'completed' ? `✓ Recompensa recebida · ${mission.reward}` : `Recompensa · ${mission.reward}`}</span></div></article>; })}</section>)}<div className="journal-next">{nextDelivery ? <><span>PRÓXIMA ENTREGA</span><strong>{nextDelivery.title}</strong><small>Fale com {npcName(nextDelivery.npcId)} · {nextDelivery.reward}</small></> : <><span>CAMPANHA CONCLUÍDA</span><strong>O mundo aguarda suas conquistas.</strong></>}</div><button className="ghost-btn journal-close" onClick={() => setShowJournal(false)}>Fechar diário</button></div></div>}{showAchievements && <div className="overlay achievements-panel" data-testid="panel-achievements"><h2>Conquistas</h2><div className="ach-sub">{Object.values(game.save.ach).filter(Boolean).length} / {ACHIEVEMENTS.length} desbloqueadas</div><div className="ach-grid">{ACHIEVEMENTS.map(([id, name, desc, icon]) => <div key={id} className={`ach-item ${game.save.ach[id] ? 'done' : ''}`} data-testid={`achievement-${id}`}><div className="ach-icon">{icon}</div><div><div className="ach-name">{game.save.ach[id] ? name : '???'}</div><div className="ach-desc">{desc}</div></div></div>)}</div><div className="ach-actions"><button className="ghost-btn" onClick={() => setShowAchievements(false)} data-testid="button-close-achievements"><X size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Fechar</button><button className="ghost-btn" onClick={newGame} data-testid="button-new-game"><RotateCcw size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Apagar progresso</button></div></div>}{toast}</div>;
}

export default App;