export type RemotePlayer = {
  playerId: string;
  avatar: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
  weaponRank: number;
  armorRank: number;
  action: 'idle' | 'walk' | 'attack' | 'hurt' | 'dead';
  updatedAt: number;
};
export type CombatEnemyState = { id: string; type: string; hp: number; maxHp: number; x: number; y: number; state: 'idle' | 'chase' | 'attack' | 'dead'; deadUntil: number };
export type CombatEvent = { sequence: number; kind: 'damage' | 'defeat' | 'respawn'; targetId: string; actorId?: string; damage?: number; coins?: number; hp: number; state: CombatEnemyState['state'] };

export type CoopResponse = { roomId: string; players: RemotePlayer[]; combat?: { sequence: number; enemies: CombatEnemyState[]; events: CombatEvent[] } };
export type ProgressSnapshot = {
  avatar: string; weaponRank: number; armorRank: number; flasks: number; level: number; xp: number; nextXp: number;
  coins?: number;
  mapId?: string;
  eventWeek?: string;
  eventClaimed?: boolean;
  dungeonCleared?: boolean;
  ach: Record<string, boolean>; kills: Record<string, number>; revives: number; dmgTaken: number;
  missions: Record<string, number>; accepted: Record<string, boolean>; completed: Record<string, boolean>; rewarded: Record<string, boolean>;
  inventory: Record<string, number>;
  bank?: Record<string, number>;
  bankOperations?: Record<string, BankOperation>;
  commerceLedger?: Record<string, CommerceTransaction>;
};
export type CommerceTransaction = {
  id: string;
  kind: 'buy' | 'sell' | 'buyback';
  itemId: string;
  amount: number;
  coins: number;
  soldAt?: number;
};
export type BankOperation = {
  id: string;
  itemId: string;
  direction: 'deposit' | 'withdraw';
  amount: number;
};
const BANK_ITEM_IDS = new Set(['flask', 'sword1', 'sword2', 'axe', 'morningstar', 'bluesword', 'redsword', 'goldensword', 'clotharmor', 'leatherarmor', 'mailarmor', 'platearmor', 'redarmor', 'goldenarmor']);
export type SavedProgress = { revision: number; updatedAt: number; progress: ProgressSnapshot | null };
export type AuthUser = { id: string; name?: string; email?: string };
export const SESSION_EXPIRED_NOTICE = {
  title: 'Sua sessão expirou',
  message: 'Entre novamente para restaurar e salvar seu progresso com segurança.',
  action: 'Entrar novamente',
} as const;
export class CoopApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly details?: unknown) {
    super(`coop_${code}`);
    this.name = 'CoopApiError';
  }
}
const API = '/api/coop';

function cloneSnapshot(snapshot: ProgressSnapshot): ProgressSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as ProgressSnapshot;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    let code = `http_${response.status}`;
    let details: unknown;
    try {
      const body = await response.json() as { error?: unknown; current?: unknown };
      if (typeof body.error === 'string') code = body.error;
      details = body;
    } catch { /* non-JSON errors keep the HTTP status */ }
    throw new CoopApiError(code, response.status, details);
  }
  return response.json() as Promise<T>;
}

export function isAccountRequiredError(error: unknown): boolean {
  return error instanceof CoopApiError && error.code === 'account_required';
}

type ProgressPersistenceRequest = {
  authenticated: boolean;
  revision: number;
  snapshot: ProgressSnapshot;
  saveRemote: (revision: number, snapshot: ProgressSnapshot) => Promise<SavedProgress>;
  writeLocal: (snapshot: ProgressSnapshot) => void;
  onAccountRequired: () => void;
};

export function mergeConflictSnapshot(local: ProgressSnapshot, remote: ProgressSnapshot): ProgressSnapshot {
  const merged = cloneSnapshot(local);
  merged.level = Math.max(local.level, remote.level);
  merged.weaponRank = Math.max(local.weaponRank, remote.weaponRank);
  merged.armorRank = Math.max(local.armorRank, remote.armorRank);
  merged.flasks = Math.max(local.flasks, remote.flasks);
  merged.revives = Math.max(local.revives, remote.revives);
  merged.dmgTaken = Math.max(local.dmgTaken, remote.dmgTaken);
  merged.coins = Math.max(local.coins ?? 0, remote.coins ?? 0);
  if (remote.level > local.level) {
    merged.xp = remote.xp;
    merged.nextXp = remote.nextXp;
  } else if (local.level === remote.level) {
    merged.xp = Math.max(local.xp, remote.xp);
    merged.nextXp = Math.max(local.nextXp, remote.nextXp);
  }
  for (const key of Object.keys(remote.kills)) merged.kills[key] = Math.max(merged.kills[key] ?? 0, remote.kills[key] ?? 0);
  for (const key of Object.keys(remote.missions)) merged.missions[key] = Math.max(merged.missions[key] ?? 0, remote.missions[key] ?? 0);
  for (const key of Object.keys(remote.inventory)) merged.inventory[key] = Math.max(merged.inventory[key] ?? 0, remote.inventory[key] ?? 0);
  // Inventory is still merged monotonically because combat/loot can add items
  // concurrently. Bank quantities are different: a withdrawal is an
  // authoritative user action and must not be resurrected by `max`.
  merged.bank = { ...(local.bank ?? {}) };
  merged.bankOperations = {
    ...(remote.bankOperations ?? {}),
    ...(local.bankOperations ?? {}),
  };
  for (const key of Object.keys(remote.ach)) merged.ach[key] = Boolean(merged.ach[key] || remote.ach[key]);
  for (const key of Object.keys(remote.accepted)) merged.accepted[key] = Boolean(merged.accepted[key] || remote.accepted[key]);
  for (const key of Object.keys(remote.completed)) merged.completed[key] = Boolean(merged.completed[key] || remote.completed[key]);
  for (const key of Object.keys(remote.rewarded)) merged.rewarded[key] = Boolean(merged.rewarded[key] || remote.rewarded[key]);
  return merged;
}

export function applyBankOperation(snapshot: ProgressSnapshot, operation: BankOperation): ProgressSnapshot {
  const next = cloneSnapshot(snapshot);
  next.bank = { ...(next.bank ?? {}) };
  next.bankOperations = { ...(next.bankOperations ?? {}) };
  if (next.bankOperations[operation.id]) return next;
  if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(operation.id) || !BANK_ITEM_IDS.has(operation.itemId)) return next;
  if (!Number.isInteger(operation.amount) || operation.amount < 1 || operation.amount > 999) return next;
  const source = operation.direction === 'deposit' ? next.inventory : next.bank;
  const target = operation.direction === 'deposit' ? next.bank : next.inventory;
  const available = source[operation.itemId] ?? 0;
  if (available < operation.amount) return next;
  if (operation.direction === 'deposit' && !target[operation.itemId]
    && Object.values(next.bank).filter((quantity) => quantity > 0).length >= 40) return next;
  source[operation.itemId] = available - operation.amount;
  target[operation.itemId] = (target[operation.itemId] ?? 0) + operation.amount;
  if (source[operation.itemId] <= 0) delete source[operation.itemId];
  next.bankOperations[operation.id] = operation;
  return next;
}

export type ProgressPersistenceResult =
  | { kind: 'local' }
  | { kind: 'saved'; remote: SavedProgress }
  | { kind: 'blocked' };

/**
 * Keeps an expired session from falling back to a local save or retrying the
 * remote mutation. A newly authenticated session explicitly resets the guard.
 */
export function createProgressPersistence() {
  let sessionBlocked = false;
  let queue: Promise<void> = Promise.resolve();
  let revisionCursor: number | undefined;
  return {
    reset() {
      sessionBlocked = false;
      revisionCursor = undefined;
    },
    async save(request: ProgressPersistenceRequest): Promise<ProgressPersistenceResult> {
      const snapshot = cloneSnapshot(request.snapshot);
      const operation = queue.then(async () => {
        if (sessionBlocked) return { kind: 'blocked' } as const;
        if (!request.authenticated) {
          request.writeLocal(snapshot);
          return { kind: 'local' } as const;
        }
        try {
          const revision = revisionCursor ?? request.revision;
          let savedSnapshot = snapshot;
          let remote: SavedProgress;
          try {
            remote = await request.saveRemote(revision, savedSnapshot);
          } catch (error) {
            const current = error instanceof CoopApiError && error.code === 'stale_progress'
              ? (error.details as { current?: SavedProgress } | undefined)?.current
              : undefined;
            if (!current?.progress) throw error;
            savedSnapshot = mergeConflictSnapshot(snapshot, current.progress);
            revisionCursor = current.revision;
            remote = await request.saveRemote(current.revision, savedSnapshot);
          }
          revisionCursor = remote.revision;
          request.writeLocal(savedSnapshot);
          return { kind: 'saved', remote } as const;
        } catch (error) {
          if (isAccountRequiredError(error)) {
            sessionBlocked = true;
            request.onAccountRequired();
            return { kind: 'blocked' } as const;
          }
          throw error;
        }
      });
      queue = operation.then(() => undefined, () => undefined);
      return operation;
    },
  };
}

export function newPlayerId() {
  return `${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

export function accountId() {
  try {
    const current = localStorage.getItem('genesis-account');
    if (current && /^[a-zA-Z0-9_-]{8,128}$/.test(current)) return current;
    const created = `acct_${newPlayerId().replace(/-/g, '')}`;
    localStorage.setItem('genesis-account', created);
    return created;
  } catch {
    return `acct_${newPlayerId().replace(/-/g, '')}`;
  }
}

export async function currentUser() {
  const response = await fetch('/api/auth/user', { credentials: 'include' });
  if (!response.ok) throw new Error(`auth_${response.status}`);
  return (await response.json()) as { user: AuthUser | null };
}

export function login() {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';
  window.location.href = `/api/login?returnTo=${encodeURIComponent(base)}`;
}

export function logout() {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';
  window.location.href = `/api/logout?returnTo=${encodeURIComponent(base)}`;
}

export async function loadProgress(_account: string, characterId: string) {
  return request<SavedProgress>(`/progress/${encodeURIComponent(characterId)}`);
}

export async function saveProgress(_account: string, characterId: string, revision: number, snapshot: ProgressSnapshot) {
  return request<SavedProgress>(`/progress/${encodeURIComponent(characterId)}`, {
    method: 'PUT', body: JSON.stringify({ revision, progress: snapshot }),
  });
}

export async function createRoom() {
  return request<CoopResponse>('/rooms', { method: 'POST', body: '{}' });
}

export async function joinRoom(roomId: string) {
  return request<CoopResponse>(`/rooms/${encodeURIComponent(roomId.trim().toUpperCase())}/join`, { method: 'POST', body: '{}' });
}

export async function syncPlayer(roomId: string, playerId: string, snapshot: Omit<RemotePlayer, 'playerId' | 'updatedAt'> & { combatEnemies?: CombatEnemyState[] }) {
  return request<CoopResponse>(`/rooms/${encodeURIComponent(roomId)}/players/${encodeURIComponent(playerId)}`, {
    method: 'PUT',
    body: JSON.stringify(snapshot),
  });
}

export async function combatAction(roomId: string, actorId: string, targetId: string, damage: number) {
  return request<CoopResponse & { accepted: boolean }>(`/rooms/${encodeURIComponent(roomId)}/combat/actions`, {
    method: 'POST', body: JSON.stringify({ actorId, targetId, damage }),
  });
}

export async function getPeers(roomId: string, playerId: string) {
  return request<CoopResponse>(`/rooms/${encodeURIComponent(roomId)}/players/${encodeURIComponent(playerId)}`);
}