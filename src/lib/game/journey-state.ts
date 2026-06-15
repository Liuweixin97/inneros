import type { JourneyEvent } from '@/types';

const BAG_KEY = 'inneros-forest-bag-v2';
const JOURNEY_KEY = 'inneros-forest-journey-v2';
const COMPANION_KEY = 'inneros-forest-companion-v2';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function loadBagMemoIds(): string[] {
  return readJson<string[]>(BAG_KEY, []).filter(Boolean).slice(0, 3);
}

export function saveBagMemoIds(ids: string[]): void {
  window.localStorage.setItem(BAG_KEY, JSON.stringify([...new Set(ids)].slice(0, 3)));
}

export function loadJourneyEvents(): JourneyEvent[] {
  return readJson<JourneyEvent[]>(JOURNEY_KEY, []).slice(-30);
}

export function saveJourneyEvents(events: JourneyEvent[]): void {
  window.localStorage.setItem(JOURNEY_KEY, JSON.stringify(events.slice(-30)));
}

export function loadCompanionInvited(): boolean {
  return readJson<boolean>(COMPANION_KEY, false);
}

export function saveCompanionInvited(invited: boolean): void {
  window.localStorage.setItem(COMPANION_KEY, JSON.stringify(invited));
}

export function clearEphemeralJourneyState(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem('inneros-pond-note-v2');
}
