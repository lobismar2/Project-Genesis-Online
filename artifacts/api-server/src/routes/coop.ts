import { Router } from "express";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

type PlayerSnapshot = {
  playerId: string;
  avatar: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
  weaponRank: number;
  armorRank: number;
  action: "idle" | "walk" | "attack" | "hurt" | "dead";
  updatedAt: number;
};

type CombatEnemy = { id: string; type: string; hp: number; maxHp: number; x: number; y: number; state: "idle" | "chase" | "attack" | "dead"; deadUntil: number; };
type CombatEvent = { sequence: number; kind: "damage" | "defeat" | "respawn"; targetId: string; actorId?: string; damage?: number; coins?: number; hp: number; state: CombatEnemy["state"]; };
type CombatState = { sequence: number; enemies: Map<string, CombatEnemy>; events: CombatEvent[]; updatedAt: number; };
type Room = { id: string; createdAt: number; players: Map<string, PlayerSnapshot>; combat?: CombatState };
type PersistedRoom = {
  id: string;
  createdAt: number;
  players: PlayerSnapshot[];
  combat?: { sequence: number; enemies: CombatEnemy[]; events: CombatEvent[]; updatedAt: number };
};
export type CoopProgress = {
  avatar: string;
  mapId?: string;
  eventWeek?: string;
  eventClaimed?: boolean;
  dungeonCleared?: boolean;
  weaponRank: number;
  armorRank: number;
  flasks: number;
  level: number;
  xp: number;
  nextXp: number;
  coins?: number;
  ach: Record<string, boolean>;
  kills: Record<string, number>;
  revives: number;
  dmgTaken: number;
  missions: Record<string, number>;
  accepted: Record<string, boolean>;
  completed: Record<string, boolean>;
  rewarded: Record<string, boolean>;
  inventory?: Record<string, number>;
  bank?: Record<string, number>;
  bankOperations?: Record<string, BankOperation>;
  commerceLedger?: Record<string, CommerceTransaction>;
};
type BankOperation = {
  id: string;
  itemId: string;
  direction: "deposit" | "withdraw";
  amount: number;
};
type CommerceTransaction = { id: string; kind: "buy" | "sell" | "buyback"; itemId: string; amount: number; coins: number; soldAt?: number };
type SavedProgress = { accountId: string; characterId: string; revision: number; updatedAt: number; progress: CoopProgress };
const rooms = new Map<string, Room>();
const progress = new Map<string, SavedProgress>();
let dataDir = process.env.COOP_DATA_DIR
  ? path.resolve(process.env.COOP_DATA_DIR)
  : path.resolve(import.meta.dirname, "../data");
let progressFile = path.join(dataDir, "coop-progress.json");
let roomsFile = path.join(dataDir, "coop-rooms.json");
const MAX_ROOMS = 500;
const ROOM_TTL = 30 * 60 * 1000;
const router = Router();

function isProcessRunning(pid: number) {
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function cleanSnapshotTemporaryFiles(directory = dataDir) {
  try {
    const temporaryFilePattern = /^coop-rooms\.json\.(\d+)\.[a-f0-9]{16}\.tmp$/;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const match = temporaryFilePattern.exec(entry.name);
      if (!match) continue;
      const ownerPid = Number(match[1]);
      if (!Number.isSafeInteger(ownerPid) || isProcessRunning(ownerPid)) continue;
      try {
        unlinkSync(path.join(directory, entry.name));
      } catch {
        // Orphan cleanup is best-effort and must never block startup.
      }
    }
  } catch {
    // An unavailable data directory must not prevent rooms from starting.
  }
}

function persistProgress(targetFile = progressFile) {
  try {
    mkdirSync(path.dirname(targetFile), { recursive: true });
    writeFileSync(targetFile, JSON.stringify(Object.fromEntries(progress)), "utf8");
  } catch {
    // The in-memory copy remains available when the host filesystem is read-only.
  }
}

type RoomFileWriter = (file: string, data: string, encoding: "utf8") => void;
type RoomFileRenamer = (source: string, destination: string) => void;
type RoomFileRemover = (file: string) => void;

function persistRooms(
  targetFile = roomsFile,
  write: RoomFileWriter = (file, data, encoding) => writeFileSync(file, data, encoding),
  rename: RoomFileRenamer = (source, destination) => renameSync(source, destination),
  remove: RoomFileRemover = (file) => unlinkSync(file),
) {
  let temporaryFile: string | undefined;
  try {
    mkdirSync(path.dirname(targetFile), { recursive: true });
    const stored: Record<string, PersistedRoom> = {};
    for (const [id, room] of rooms) {
      stored[id] = {
        id: room.id,
        createdAt: room.createdAt,
        players: [...room.players.values()],
        combat: room.combat ? {
          sequence: room.combat.sequence,
          enemies: [...room.combat.enemies.values()],
          events: room.combat.events,
          updatedAt: room.combat.updatedAt,
        } : undefined,
      };
    }
    temporaryFile = `${targetFile}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
    write(temporaryFile, JSON.stringify(stored), "utf8");
    rename(temporaryFile, targetFile);
    temporaryFile = undefined;
  } catch {
    if (temporaryFile) {
      try {
        remove(temporaryFile);
      } catch {
        // Temporary-file cleanup is best-effort and must never hide the
        // original persistence failure or compromise the previous snapshot.
      }
    }
    // The in-memory copy remains available when the host filesystem is read-only.
  }
}

function cleanRooms() {
  const now = Date.now();
  let changed = false;
  for (const [id, room] of rooms) {
    for (const [playerId, player] of room.players) {
      if (now - player.updatedAt > ROOM_TTL) {
        room.players.delete(playerId);
        changed = true;
      }
    }
    if (now - room.createdAt > ROOM_TTL) {
      rooms.delete(id);
      changed = true;
    }
  }
  if (changed) persistRooms();
}

function roomId() {
  return randomBytes(3).toString("hex").toUpperCase();
}

function numberIn(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, n));
}

function identity(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(value) ? value : null;
}

function characterIdentity(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : null;
}

export function combatCoinReward(enemyType: string) {
  if (enemyType === "boss") return 100;
  if (enemyType === "deathknight" || enemyType === "spectre" || enemyType === "ogre") return 8;
  if (enemyType === "skeleton" || enemyType === "snake" || enemyType === "bat") return 5;
  return 3;
}

function progressKey(accountId: string, characterId: string) {
  return `${accountId}:${characterId}`;
}

const AVATAR_IDS = new Set(["moss", "thorn", "spore", "mother", "tungsten", "neon", "hex", "bio"]);
const ACHIEVEMENT_IDS = new Set(["warrior", "wild", "rats", "talk", "loot", "cave", "shore", "escape", "graveyard", "skulls", "ninja", "desert", "hunter", "alive", "meatshield", "hotspot", "hero", "foxy", "science", "nomore"]);
const MISSION_GOALS: Record<string, number> = {
  "forest-rats": 3, "forest-gear": 1, "grave-souls": 5, "cave-bats": 4, "cave-portal": 1,
  "desert-snakes": 5, "desert-crossing": 1, "mountain-knights": 3, "mountain-phases": 3, "mountain-king": 1,
};
const MISSION_IDS = new Set(Object.keys(MISSION_GOALS));
const ITEM_IDS = new Set(["flask", "event-lantern", "potion-life", "potion-mana", "potion-antidote", "sword1", "sword2", "axe", "morningstar", "bluesword", "redsword", "goldensword", "clotharmor", "leatherarmor", "mailarmor", "platearmor", "redarmor", "goldenarmor"]);

function validNonNegative(value: unknown, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}

function safeProgress(body: Record<string, unknown>, characterId: string, previous?: CoopProgress): CoopProgress {
  const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  const base = previous ?? {
    avatar: characterId, weaponRank: 1, armorRank: 1, flasks: 2, level: 1, xp: 0, nextXp: 120, coins: 0,
    ach: {}, kills: {}, revives: 0, dmgTaken: 0, missions: {}, accepted: {}, completed: {}, rewarded: {}, inventory: {}, bank: {}, bankOperations: {}, commerceLedger: {},
  };
  const scalar = (key: keyof CoopProgress, min: number, max: number, integer = false) => {
    if (!Object.prototype.hasOwnProperty.call(body, key)) return base[key] as number;
    const value = validNonNegative(body[key], max);
    if (value === null || value < min) return base[key] as number;
    return integer ? Math.round(value) : value;
  };
  const incomingMap = (key: keyof CoopProgress) => record(body[key]);
  const mergeNumbers = (key: keyof CoopProgress, max: number, cap?: Record<string, number>) => {
    const incoming = incomingMap(key);
    const result = { ...(base[key] as Record<string, number>) };
    if (!incoming) return result;
    for (const [id, value] of Object.entries(incoming)) {
      const parsed = validNonNegative(value, cap?.[id] ?? max);
      if (parsed !== null && (!cap || Object.prototype.hasOwnProperty.call(cap, id))) {
        const limit = cap?.[id] ?? max;
        result[id] = Math.max(result[id] ?? 0, Math.floor(Math.min(parsed, limit)));
      }
    }
    return result;
  };
  const replaceItems = (key: keyof CoopProgress, max: number) => {
    const incoming = incomingMap(key);
    if (!incoming) return { ...((base[key] as Record<string, number> | undefined) ?? {}) };
    return Object.fromEntries(Object.entries(incoming)
      .filter(([id]) => ITEM_IDS.has(id))
      .map(([id, value]) => [id, validNonNegative(value, max)] as const)
      .filter(([, value]) => value !== null)
      .map(([id, value]) => [id, Math.floor(value as number)]));
  };
  const mergeItems = (key: keyof CoopProgress, max: number) => {
    const incoming = incomingMap(key);
    const result = { ...((base[key] as Record<string, number> | undefined) ?? {}) };
    if (!incoming) return result;
    for (const [id, value] of Object.entries(incoming)) {
      if (!ITEM_IDS.has(id)) continue;
      const parsed = validNonNegative(value, max);
      if (parsed !== null) result[id] = Math.max(result[id] ?? 0, Math.floor(parsed));
    }
    return result;
  };
  const bankOperations = (() => {
    const incoming = incomingMap("bankOperations");
    const result = { ...((base.bankOperations as Record<string, BankOperation> | undefined) ?? {}) };
    if (!incoming) return result;
    for (const [id, value] of Object.entries(incoming)) {
      const operation = record(value);
      if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(id) || !operation) continue;
      if (typeof operation.itemId !== "string" || !ITEM_IDS.has(operation.itemId)) continue;
      if (operation.direction !== "deposit" && operation.direction !== "withdraw") continue;
      if (!Number.isInteger(operation.amount) || Number(operation.amount) < 1 || Number(operation.amount) > 999) continue;
      result[id] = { id, itemId: operation.itemId, direction: operation.direction, amount: Number(operation.amount) };
    }
    return result;
  })();
  const hasBankOperations = Object.keys(bankOperations).length > 0;
  const commerceLedger = (() => {
    const result = { ...((base.commerceLedger as Record<string, CommerceTransaction> | undefined) ?? {}) };
    const incoming = incomingMap("commerceLedger");
    if (!incoming) return result;
    for (const [id, value] of Object.entries(incoming)) {
      const operation = record(value);
      if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(id) || !operation) continue;
      if (!["buy", "sell", "buyback"].includes(String(operation.kind))) continue;
      if (typeof operation.itemId !== "string" || !ITEM_IDS.has(operation.itemId)) continue;
      if (!Number.isInteger(operation.amount) || Number(operation.amount) < 1 || Number(operation.amount) > 999) continue;
      if (!Number.isInteger(operation.coins) || Number(operation.coins) < 0 || Number(operation.coins) > 1_000_000_000) continue;
      result[id] = { id, kind: operation.kind as CommerceTransaction["kind"], itemId: operation.itemId, amount: Number(operation.amount), coins: Number(operation.coins), ...(Number.isSafeInteger(operation.soldAt) ? { soldAt: Number(operation.soldAt) } : {}) };
    }
    return result;
  })();
  const mergeFlags = (key: keyof CoopProgress, ids: Set<string>) => {
    const incoming = incomingMap(key);
    const result = { ...(base[key] as Record<string, boolean>) };
    if (!incoming) return result;
    for (const [id, value] of Object.entries(incoming)) if (ids.has(id) && value === true) result[id] = true;
    return result;
  };
  const accepted = mergeFlags("accepted", MISSION_IDS);
  const completed = mergeFlags("completed", MISSION_IDS);
  const rewarded = mergeFlags("rewarded", MISSION_IDS);
  for (const id of MISSION_IDS) {
    if (completed[id] || rewarded[id]) completed[id] = true;
    if (completed[id]) rewarded[id] = true;
    if (accepted[id] || completed[id]) accepted[id] = true;
  }
  return {
    avatar: typeof body.avatar === "string" && AVATAR_IDS.has(body.avatar) && body.avatar === characterId ? body.avatar : base.avatar,
    mapId: typeof body.mapId === "string" && ["hub", "forest", "cave", "ice", "volcano"].includes(body.mapId) ? body.mapId : base.mapId,
    ...(typeof body.eventWeek === "string" && /^\d{4}-W\d{2}$/.test(body.eventWeek) ? { eventWeek: body.eventWeek } : base.eventWeek ? { eventWeek: base.eventWeek } : {}),
    ...(body.eventClaimed === true || base.eventClaimed === true ? { eventClaimed: Boolean(body.eventClaimed || base.eventClaimed) } : {}),
    ...(body.dungeonCleared === true || base.dungeonCleared === true ? { dungeonCleared: Boolean(body.dungeonCleared || base.dungeonCleared) } : {}),
    weaponRank: scalar("weaponRank", 1, 7, true), armorRank: scalar("armorRank", 1, 6, true),
    flasks: Math.max(base.flasks, scalar("flasks", 0, 99, true)), level: scalar("level", 1, 999, true),
    xp: scalar("xp", 0, 1_000_000_000), nextXp: scalar("nextXp", 1, 1_000_000_000),
    ...(Object.prototype.hasOwnProperty.call(body, "coins") || Boolean(previous && Object.prototype.hasOwnProperty.call(previous, "coins"))
      ? { coins: Math.max(base.coins ?? 0, scalar("coins", 0, 1_000_000_000, true)) }
      : {}),
    ach: mergeFlags("ach", ACHIEVEMENT_IDS), kills: mergeNumbers("kills", 1_000_000_000),
    revives: scalar("revives", 0, 1_000_000_000, true), dmgTaken: scalar("dmgTaken", 0, 1_000_000_000),
    missions: mergeNumbers("missions", 1_000_000_000, MISSION_GOALS),
    accepted, completed, rewarded,
    inventory: hasBankOperations ? replaceItems("inventory", 999) : mergeItems("inventory", 999),
    bank: hasBankOperations ? replaceItems("bank", 999) : mergeItems("bank", 999),
    ...(Object.keys(bankOperations).length > 0 ? { bankOperations } : {}),
    ...(Object.keys(commerceLedger).length > 0 ? { commerceLedger } : {}),
  };
}

function safeSavedProgress(value: unknown): SavedProgress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const accountId = identity(item.accountId);
  const characterId = characterIdentity(item.characterId);
  if (!accountId || !characterId) return null;
  const rawProgress = item.progress;
  const progressBody = rawProgress && typeof rawProgress === "object" && !Array.isArray(rawProgress)
    ? rawProgress as Record<string, unknown>
    : {};
  return {
    accountId,
    characterId,
    revision: Number.isSafeInteger(item.revision) && Number(item.revision) >= 0 ? Number(item.revision) : 0,
    updatedAt: Number.isSafeInteger(item.updatedAt) && Number(item.updatedAt) >= 0 ? Number(item.updatedAt) : 0,
    progress: safeProgress(progressBody, characterId),
  };
}

type ProgressPersister = (targetFile?: string) => void;

function loadProgress(sourceFile = progressFile, persist = persistProgress) {
  try {
    if (!existsSync(sourceFile)) return;
    const stored = JSON.parse(readFileSync(sourceFile, "utf8")) as unknown;
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return;
    for (const value of Object.values(stored)) {
      const saved = safeSavedProgress(value);
      if (saved) progress.set(progressKey(saved.accountId, saved.characterId), saved);
    }
    // Persist the normalized representation so discarded fields and entries do
    // not come back on a later restart. A failed write must not block startup.
    persist(sourceFile);
  } catch {
    // A damaged/unreadable server cache must not prevent solo play or room sync.
  }
}

function safeSnapshot(body: Record<string, unknown>, playerId: string): PlayerSnapshot {
  const actions = ["idle", "walk", "attack", "hurt", "dead"] as const;
  return {
    playerId,
    avatar: typeof body.avatar === "string" ? body.avatar.slice(0, 32) : "unknown",
    x: numberIn(body.x, 0, 2880, 0),
    y: numberIn(body.y, 0, 2048, 0),
    hp: numberIn(body.hp, 0, 10000, 1),
    maxHp: numberIn(body.maxHp, 1, 10000, 1),
    level: Math.round(numberIn(body.level, 1, 99, 1)),
    weaponRank: Math.round(numberIn(body.weaponRank, 1, 99, 1)),
    armorRank: Math.round(numberIn(body.armorRank, 1, 99, 1)),
    action: actions.includes(body.action as (typeof actions)[number]) ? body.action as PlayerSnapshot["action"] : "idle",
    updatedAt: Date.now(),
  };
}

function safeCombatEnemy(value: unknown): CombatEnemy | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || !/^[a-zA-Z0-9_.-]{1,128}$/.test(item.id)) return null;
  const maxHp = numberIn(item.maxHp, 1, 100000, 1);
  return {
    id: item.id, type: typeof item.type === "string" ? item.type.slice(0, 32) : "unknown",
    hp: numberIn(item.hp, 0, maxHp, maxHp), maxHp,
    x: numberIn(item.x, 0, 2880, 0), y: numberIn(item.y, 0, 2048, 0),
    state: ["idle", "chase", "attack", "dead"].includes(item.state as string) ? item.state as CombatEnemy["state"] : "idle",
    deadUntil: 0,
  };
}

function isCompletePersistedRoom(value: unknown): value is PersistedRoom {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.createdAt !== "number" || !Array.isArray(item.players)) return false;
  if (item.combat === undefined) return true;
  if (!item.combat || typeof item.combat !== "object" || Array.isArray(item.combat)) return false;
  const combat = item.combat as Record<string, unknown>;
  return typeof combat.sequence === "number"
    && Array.isArray(combat.enemies)
    && Array.isArray(combat.events)
    && typeof combat.updatedAt === "number";
}

function combatResponse(combat?: CombatState) {
  if (!combat) return undefined;
  const now = Date.now();
  let changed = false;
  for (const enemy of combat.enemies.values()) {
    if (enemy.state === "dead" && enemy.deadUntil > 0 && enemy.deadUntil <= now) {
      enemy.hp = enemy.maxHp; enemy.state = "idle"; enemy.deadUntil = 0;
      combat.sequence++;
      combat.events.push({ sequence: combat.sequence, kind: "respawn", targetId: enemy.id, hp: enemy.hp, state: enemy.state });
      changed = true;
    }
  }
  combat.events = combat.events.slice(-100);
  if (changed) persistRooms();
  return { sequence: combat.sequence, enemies: [...combat.enemies.values()], events: combat.events };
}

function loadRooms(sourceFile = roomsFile) {
  try {
    if (!existsSync(sourceFile)) return;
    const stored = JSON.parse(readFileSync(sourceFile, "utf8")) as Record<string, unknown>;
    for (const [id, value] of Object.entries(stored)) {
      if (!isCompletePersistedRoom(value) || value.id !== id) continue;
      const item = value;
      const players = new Map<string, PlayerSnapshot>();
      if (Array.isArray(item.players)) {
        for (const value of item.players) {
          if (!value || typeof value !== "object" || Array.isArray(value)) continue;
          const player = value as Record<string, unknown>;
          if (typeof player.playerId !== "string") continue;
          players.set(player.playerId, safeSnapshot(player, player.playerId));
          const restored = players.get(player.playerId)!;
          restored.updatedAt = numberIn(player.updatedAt, 0, Number.MAX_SAFE_INTEGER, 0);
        }
      }
      const room: Room = { id, createdAt: item.createdAt, players };
      const combat = item.combat;
      if (combat && typeof combat === "object" && !Array.isArray(combat)) {
        const saved = combat as Record<string, unknown>;
        const enemies = new Map<string, CombatEnemy>();
        if (Array.isArray(saved.enemies)) {
          for (const value of saved.enemies) {
            const enemy = safeCombatEnemy(value);
            if (!enemy) continue;
            const raw = value as Record<string, unknown>;
            enemy.deadUntil = numberIn(raw.deadUntil, 0, Number.MAX_SAFE_INTEGER, 0);
            enemies.set(enemy.id, enemy);
          }
        }
        const events = Array.isArray(saved.events) ? saved.events.filter((event): event is CombatEvent => {
          if (!event || typeof event !== "object" || Array.isArray(event)) return false;
          const item = event as Record<string, unknown>;
          return Number.isInteger(item.sequence) && Number(item.sequence) >= 0
            && ["damage", "defeat", "respawn"].includes(item.kind as string)
            && typeof item.targetId === "string" && typeof item.hp === "number"
            && ["idle", "chase", "attack", "dead"].includes(item.state as string);
        }).slice(-100) : [];
        room.combat = {
          sequence: numberIn(saved.sequence, 0, Number.MAX_SAFE_INTEGER, 0),
          enemies,
          events,
          updatedAt: numberIn(saved.updatedAt, 0, Number.MAX_SAFE_INTEGER, 0),
        };
      }
      rooms.set(id, room);
    }
    cleanRooms();
  } catch {
    // An expired or damaged room cache must not prevent new rooms from being created.
  }
}

function response(room: Room, selfId?: string) {
  return { roomId: room.id, players: [...room.players.values()].filter((player) => player.playerId !== selfId), combat: combatResponse(room.combat) };
}

cleanSnapshotTemporaryFiles();
loadProgress();
loadRooms();

export function reloadRoomsForTests(sourceFile = roomsFile) {
  rooms.clear();
  loadRooms(sourceFile);
}

export function setPersistenceDirectoryForTests(directory: string) {
  dataDir = path.resolve(directory);
  progressFile = path.join(dataDir, "coop-progress.json");
  roomsFile = path.join(dataDir, "coop-rooms.json");
  rooms.clear();
  progress.clear();
}

export function persistRoomsForTests(
  targetFile: string,
  write?: RoomFileWriter,
  rename?: RoomFileRenamer,
  remove?: RoomFileRemover,
) {
  persistRooms(targetFile, write, rename, remove);
}

export function reloadProgressForTests(sourceFile?: string, persist?: ProgressPersister) {
  progress.clear();
  loadProgress(sourceFile, persist);
}

router.post("/coop/rooms", (_req, res) => {
  cleanRooms();
  if (rooms.size >= MAX_ROOMS) return res.status(503).json({ error: "coop_capacity" });
  const id = roomId();
  const room: Room = { id, createdAt: Date.now(), players: new Map() };
  rooms.set(id, room);
  persistRooms();
  return res.status(201).json({ roomId: id, players: [] });
});

router.post("/coop/rooms/:roomId/join", (req, res) => {
  cleanRooms();
  const room = rooms.get(req.params.roomId.toUpperCase());
  if (!room) return res.status(404).json({ error: "room_not_found" });
  if (room.players.size >= 2) return res.status(409).json({ error: "room_full" });
  return res.json(response(room));
});

router.put("/coop/rooms/:roomId/players/:playerId", (req, res) => {
  cleanRooms();
  const room = rooms.get(req.params.roomId.toUpperCase());
  if (!room) return res.status(404).json({ error: "room_not_found" });
  const playerId = req.params.playerId.slice(0, 64);
  if (!room.players.has(playerId) && room.players.size >= 2) return res.status(409).json({ error: "room_full" });
  const body = (req.body ?? {}) as Record<string, unknown>;
  room.players.set(playerId, safeSnapshot(body, playerId));
  const incoming = Array.isArray(body.combatEnemies) ? body.combatEnemies : [];
  if (incoming.length) {
    room.combat ??= { sequence: 0, enemies: new Map(), events: [], updatedAt: Date.now() };
    for (const value of incoming) {
      const enemy = safeCombatEnemy(value);
      if (!enemy || room.combat.enemies.has(enemy.id)) continue;
      room.combat.enemies.set(enemy.id, enemy);
    }
    room.combat.updatedAt = Date.now();
  }
  persistRooms();
  return res.json(response(room, playerId));
});

router.get("/coop/rooms/:roomId/players/:playerId", (req, res) => {
  cleanRooms();
  const room = rooms.get(req.params.roomId.toUpperCase());
  if (!room) return res.status(404).json({ error: "room_not_found" });
  return res.json(response(room, req.params.playerId));
});

router.post("/coop/rooms/:roomId/combat/actions", (req, res) => {
  cleanRooms();
  const room = rooms.get(req.params.roomId.toUpperCase());
  if (!room) return res.status(404).json({ error: "room_not_found" });
  const body = (req.body ?? {}) as Record<string, unknown>;
  const actorId = typeof body.actorId === "string" ? body.actorId.slice(0, 64) : "";
  const targetId = typeof body.targetId === "string" ? body.targetId.slice(0, 128) : "";
  if (!room.players.has(actorId) || !targetId) return res.status(400).json({ error: "invalid_combat_action" });
  room.combat ??= { sequence: 0, enemies: new Map(), events: [], updatedAt: Date.now() };
  const target = room.combat.enemies.get(targetId);
  if (!target) return res.status(404).json({ error: "combat_target_not_found" });
  if (target.state === "dead") return res.json({ accepted: false, ...response(room, actorId) });
  const requestedDamage = Number(body.damage);
  const damage = Math.round(numberIn(requestedDamage, 1, 250, 1));
  target.hp = Math.max(0, target.hp - damage);
  target.state = target.hp <= 0 ? "dead" : "chase";
  target.deadUntil = target.hp <= 0 ? Date.now() + 14000 : 0;
  room.combat.sequence++;
  room.combat.events.push({ sequence: room.combat.sequence, kind: "damage", targetId, actorId, damage, hp: target.hp, state: target.state });
  if (target.hp <= 0) {
    room.combat.sequence++;
    room.combat.events.push({ sequence: room.combat.sequence, kind: "defeat", targetId, actorId, coins: combatCoinReward(target.type), hp: 0, state: "dead" });
  }
  room.combat.updatedAt = Date.now();
  persistRooms();
  return res.json({ accepted: true, ...response(room, actorId) });
});

router.get("/coop/progress/:characterId", (req, res) => {
  const accountId = req.isAuthenticated() ? req.user.id : null;
  const characterId = characterIdentity(req.params.characterId);
  if (!accountId || !characterId) return res.status(401).json({ error: "account_required" });
  const saved = progress.get(progressKey(accountId, characterId));
  return res.json(saved ?? { accountId, characterId, revision: 0, updatedAt: 0, progress: null });
});

router.put("/coop/progress/:characterId", (req, res) => {
  const accountId = req.isAuthenticated() ? req.user.id : null;
  const characterId = characterIdentity(req.params.characterId);
  if (!accountId || !characterId) return res.status(401).json({ error: "account_required" });
  const key = progressKey(accountId, characterId);
  const current = progress.get(key);
  const expectedRevision = Number(req.body?.revision ?? 0);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return res.status(400).json({ error: "invalid_revision" });
  const incomingProgress = req.body?.progress && typeof req.body.progress === "object" && !Array.isArray(req.body.progress)
    ? req.body.progress as Record<string, unknown>
    : {};
  const incomingOperations = incomingProgress.bankOperations && typeof incomingProgress.bankOperations === "object" && !Array.isArray(incomingProgress.bankOperations)
    ? incomingProgress.bankOperations as Record<string, unknown>
    : {};
  if (current && Object.keys(incomingOperations).length > 0
    && Object.keys(incomingOperations).every((id) => current.progress.bankOperations?.[id])) {
    return res.json(current);
  }
  if (current && expectedRevision !== current.revision) {
    return res.status(409).json({ error: "stale_progress", current });
  }
  const saved: SavedProgress = {
    accountId, characterId, revision: (current?.revision ?? 0) + 1, updatedAt: Date.now(),
    progress: safeProgress(incomingProgress, characterId, current?.progress),
  };
  progress.set(key, saved);
  persistProgress();
  return res.json(saved);
});

export default router;