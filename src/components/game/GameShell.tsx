'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  GameWorld,
  WorldObject,
  GamePhase,
  CompanionType,
  JourneyEvent,
  Memo,
  WorldObjectType,
} from '@/types';
import {
  loadWorld,
  loadGameMemos,
  placeObject,
  recordJourneyEvent,
  syncPlayerPosition,
  clearCache,
} from '@/lib/game/world-state';
import { mapMemosToWorldObjects } from '@/lib/game/memo-mapper';
import { getDefaultCharacter, getCharacterById } from '@/lib/game/sprite';
import { isWalkable } from '@/lib/game/collisions';
import GamePortal from './GamePortal';
import PixelWorldCanvas from './PixelWorldCanvas';
import GameSettings from './GameSettings';
import ForestFarmHud, { type FarmActionId } from './ForestFarmHud';
import {
  loadBagMemoIds,
  loadCompanionInvited,
  loadJourneyEvents,
  saveBagMemoIds,
  saveCompanionInvited,
  saveJourneyEvents,
  clearEphemeralJourneyState,
} from '@/lib/game/journey-state';

interface GameShellProps {
  onExit: () => void;
}

function getDebugStartPosition() {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('forestDebug') !== '1') return null;
  const x = Number(params.get('x'));
  const y = Number(params.get('y'));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export default function GameShell({ onExit }: GameShellProps) {
  // ---- 游戏阶段状态机 ----
  const [phase, setPhase] = useState<GamePhase>('portal');

  // ---- 世界数据 ----
  const [world, setWorld] = useState<GameWorld | null>(null);
  const [objects, setObjects] = useState<WorldObject[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [canvasFailed, setCanvasFailed] = useState(false);

  // ---- 玩家状态 ----
  const debugStartPosition = getDebugStartPosition();
  const [playerX, setPlayerX] = useState(debugStartPosition?.x ?? 345);
  const [playerY, setPlayerY] = useState(debugStartPosition?.y ?? 245);
  const [playerChar, setPlayerChar] = useState(getDefaultCharacter());
  const [secondPlayerChar] = useState(getCharacterById('drifter'));

  // ---- 同行者 ----
  const [companionType, setCompanionType] = useState<CompanionType>('none');
  const [authorizedMemoIds, setAuthorizedMemoIds] = useState<string[]>([]);
  const [journeyEvents, setJourneyEvents] = useState<JourneyEvent[]>([]);

  // ---- 弹层状态 ----
  const [activeMemo, setActiveMemo] = useState<Memo | null>(null);
  const [activeObject, setActiveObject] = useState<WorldObject | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [farmAction, setFarmAction] = useState<FarmActionId>(null);
  const [activePlacedObject, setActivePlacedObject] = useState<WorldObject | null>(null);

  // ---- 减少动态模式 ----
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setAuthorizedMemoIds(loadBagMemoIds());
    setJourneyEvents(loadJourneyEvents());
    setCompanionType(loadCompanionInvited() ? 'llm' : 'none');
  }, []);

  // 加载世界
  const initWorld = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setCanvasFailed(false);
    try {
      const { world: w, objects: objs, journeyEvents: serverJourneyEvents } = await loadWorld();
      const safePlayerPosition = isWalkable(w.playerX, w.playerY)
        ? { x: w.playerX, y: w.playerY }
        : { x: 345, y: 245 };
      setWorld(w);
      setPlayerX(safePlayerPosition.x);
      setPlayerY(safePlayerPosition.y);
      if (safePlayerPosition.x !== w.playerX || safePlayerPosition.y !== w.playerY) {
        syncPlayerPosition(w.id, safePlayerPosition.x, safePlayerPosition.y);
      }
      setReducedMotion(w.settings.reducedMotion);
      if (serverJourneyEvents) {
        const mergedEvents = mergeJourneyEvents(loadJourneyEvents(), serverJourneyEvents);
        setJourneyEvents(mergedEvents);
        saveJourneyEvents(mergedEvents);
      }

      // 加载 Memo
      const memoData = await loadGameMemos('recent');
      const loadedMemos: Memo[] = memoData.memos ?? [];
      setMemos(loadedMemos);

      // 映射 Memo → 世界对象（候选，还未入库）
      const mappedCandidates = mapMemosToWorldObjects(loadedMemos, objs);
      // 合并已有对象和候选（候选标记为 userConfirmed: false）
      const allObjects: WorldObject[] = [
        ...objs,
        ...mappedCandidates.map((c, idx) => ({
          id: `candidate-${idx}`,
          worldId: w.id,
          type: c.type,
          x: c.x,
          y: c.y,
          layer: c.layer,
          sourceMemoIds: c.sourceMemoIds,
          userConfirmed: false,
          hidden: false,
          metadata: c.metadata as Record<string, unknown>,
          createdAt: new Date().toISOString(),
        } as WorldObject)),
      ];
      if (loadedMemos.length === 0 && objs.length === 0) {
        allObjects.push({
          id: 'empty-pot',
          worldId: w.id,
          type: 'empty_pot',
          x: 480,
          y: 145,
          layer: 1,
          sourceMemoIds: [],
          userConfirmed: false,
          hidden: false,
          metadata: { hintText: '这里还没有长出故事。今天空着也可以。' },
          createdAt: new Date().toISOString(),
        });
      }
      setObjects(allObjects);
    } catch {
      setLoadError('世界暂时无法抵达，请稍后再试。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 传送门过场完成 → 直接进入探索（默认独自漫游）
  const handlePortalComplete = useCallback(() => {
    setPhase('explore');
    initWorld();
  }, [initWorld]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('forestDebug') !== '1') return;
    setPhase('explore');
    void initWorld().then(() => {
      const debugX = Number(params.get('x'));
      const debugY = Number(params.get('y'));
      if (Number.isFinite(debugX) && Number.isFinite(debugY)) {
        setPlayerX(debugX);
        setPlayerY(debugY);
      }
    });
  }, [initWorld]);

  // 从设置面板更新角色
  const handleCharacterChange = useCallback((charId: string) => {
    setPlayerChar(getCharacterById(charId));
  }, []);

  // 玩家移动
  const handlePlayerMove = useCallback((x: number, y: number) => {
    setPlayerX(x);
    setPlayerY(y);
    if (world) {
      syncPlayerPosition(world.id, x, y);
    }
  }, [world]);

  // 打开 Memo
  const handleOpenMemo = useCallback((memoId: string, objectId: string) => {
    const object = objects.find((item) => item.id === objectId);
    if (object?.sourceSessionId) {
      setActivePlacedObject(object);
      setFarmAction('object');
      return;
    }
    const memo = memos.find((m) => m.id === memoId);
    if (memo) {
      setActiveMemo(memo);
      setActiveObject(objects.find((object) => object.id === objectId) ?? null);
      setFarmAction('memory');
    }
  }, [memos, objects]);

  // 地图地标统一打开新的农场式 HUD 动作
  const handleEnterCabin = useCallback(() => setFarmAction('cabin'), []);
  const handleEnterBench = useCallback(() => setFarmAction('bench'), []);
  const handleEnterFireside = useCallback(() => {
    setFarmAction('cook');
  }, []);
  const handleEnterCoWrite = useCallback(() => {
    setFarmAction('workshop');
  }, []);
  const handleEnterPond = useCallback(() => {
    setFarmAction('pond');
  }, []);
  const handleEnterLightTrail = useCallback(() => setFarmAction('trail'), []);
  const handleEnterDesk = useCallback(() => setFarmAction('desk'), []);

  // 关闭所有弹层，回到探索
  const handleCloseAll = useCallback(() => {
    setActiveMemo(null);
    setActiveObject(null);
    setActivePlacedObject(null);
    setFarmAction(null);
    setShowSettings(false);
    setPhase('explore');
  }, []);

  // 退出游戏
  const handleExit = useCallback(() => {
    clearEphemeralJourneyState();
    clearCache();
    onExit();
  }, [onExit]);

  // Esc 键 → 打开设置或关闭弹层
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSettings || farmAction) {
          handleCloseAll();
        } else {
          setShowSettings((v) => !v);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [farmAction, handleCloseAll, showSettings]);

  // 授权 Memo（用户勾选后可带入 AI 对话）
  const handleAuthorizeMemos = useCallback((ids: string[]) => {
    const next = [...new Set(ids)].slice(-3);
    setAuthorizedMemoIds(next);
    saveBagMemoIds(next);
  }, []);

  const addJourneyEvent = useCallback((event: Omit<JourneyEvent, 'id' | 'createdAt'>) => {
    const createdEvent = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setJourneyEvents((current) => {
      const next = [...current, createdEvent].slice(-30);
      saveJourneyEvents(next);
      return next;
    });
    void recordJourneyEvent(createdEvent);
  }, []);

  const handleCompanionTypeChange = useCallback((type: CompanionType) => {
    setCompanionType(type);
    saveCompanionInvited(type === 'llm');
  }, []);

  const handleFarmActionChange = useCallback((action: FarmActionId) => {
    setFarmAction(action);
    if (!action) {
      setActiveMemo(null);
      setActiveObject(null);
      setActivePlacedObject(null);
    }
  }, []);

  const handleCarryMemo = useCallback((memo: Memo) => {
    setAuthorizedMemoIds((current) => {
      const next = [...current.filter((id) => id !== memo.id), memo.id].slice(-3);
      saveBagMemoIds(next);
      return next;
    });
    addJourneyEvent({
      type: 'carried_memory',
      text: `带走了「${memo.ai_title || memo.plain_text.slice(0, 24) || '一段记忆'}」`,
      sourceMemoIds: [memo.id],
    });
  }, [addJourneyEvent]);

  const handleCreateFarmMemo = useCallback(async (content: string) => {
    try {
      const res = await fetch('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          tags: ['InnerOS/林间世界'],
          source: 'manual',
        }),
      });
      if (!res.ok) return false;
      const memo = await res.json() as Memo;
      setMemos((current) => [memo, ...current]);
      addJourneyEvent({
        type: 'left_annotation',
        text: '把睡前确认写回 InnerOS',
        sourceMemoIds: [memo.id],
      });
      return true;
    } catch {
      return false;
    }
  }, [addJourneyEvent]);

  const handlePlaceFarmObject = useCallback(async (input: {
    type: WorldObjectType;
    annotation: string;
    memoIds: string[];
    eventText: string;
  }) => {
    if (!world) return false;
    const created = await placeObject({
      type: input.type,
      location: 'workshop',
      sourceMemoIds: input.memoIds,
      annotation: input.annotation,
      userConfirmed: true,
    });
    if (!created) return false;
    setObjects((current) => [
      ...current.filter((object) => !object.id.startsWith('candidate-') || !object.sourceMemoIds.some((id) => input.memoIds.includes(id))),
      created,
    ]);
    addJourneyEvent({
      type: 'placed_object',
      text: input.eventText,
      sourceMemoIds: input.memoIds,
    });
    return true;
  }, [addJourneyEvent, world]);

  const visibleMemos = useMemo(
    () => companionType === 'human_local'
      ? memos.filter((memo) => authorizedMemoIds.includes(memo.id))
      : memos,
    [authorizedMemoIds, companionType, memos],
  );
  const visibleObjects = useMemo(
    () => companionType !== 'human_local'
      ? objects
      : objects.filter((object) => (
        object.sourceMemoIds.length === 0
        || object.sourceMemoIds.every((id) => authorizedMemoIds.includes(id))
      )),
    [authorizedMemoIds, companionType, objects],
  );
  const panelOpen = showSettings || Boolean(farmAction);

  // ---- 渲染 ----
  return (
    <div className={`game-shell ${reducedMotion ? 'reduced-motion' : ''}`}>
      {/* 传送门过场 */}
      {phase === 'portal' && (
        <GamePortal onComplete={handlePortalComplete} />
      )}

      {/* 主地图 */}
      {phase === 'explore' && (
        <>
          {loadError || canvasFailed ? (
            <GameFallbackView
              message={loadError ?? '动态地图无法显示，已切换为图文地图。'}
              memos={visibleMemos}
              onOpenMemo={(memoId) => handleOpenMemo(memoId, `fallback-${memoId}`)}
              onOpenFireside={handleEnterFireside}
              onOpenCoWrite={handleEnterCoWrite}
              onRetry={initWorld}
              onExit={handleExit}
            />
          ) : (
            <>
              <PixelWorldCanvas
                playerX={playerX}
                playerY={playerY}
                playerChar={playerChar}
                secondPlayerChar={secondPlayerChar}
                objects={visibleObjects}
                companionType={companionType}
                reducedMotion={reducedMotion}
                onPlayerMove={handlePlayerMove}
                onOpenMemo={handleOpenMemo}
                onEnterCabin={handleEnterCabin}
                onEnterBench={handleEnterBench}
                onEnterFireside={handleEnterFireside}
                onEnterCoWrite={handleEnterCoWrite}
                onEnterPond={handleEnterPond}
                onEnterLightTrail={handleEnterLightTrail}
                onEnterDesk={handleEnterDesk}
                onCanvasFailure={() => setCanvasFailed(true)}
                interactionDisabled={panelOpen}
              />

              <ForestFarmHud
                world={world}
                memos={memos}
                bagMemoIds={authorizedMemoIds}
                events={journeyEvents}
                companionType={companionType}
                activeAction={farmAction}
                activeMemo={activeMemo}
                activeObject={activeObject}
                activePlacedObject={activePlacedObject}
                onActionChange={handleFarmActionChange}
                onCarryMemo={handleCarryMemo}
                onRemoveFromBag={(memoId) => handleAuthorizeMemos(
                  authorizedMemoIds.filter((id) => id !== memoId),
                )}
                onAddJourneyEvent={addJourneyEvent}
                onCompanionTypeChange={handleCompanionTypeChange}
                onCreateMemo={handleCreateFarmMemo}
                onPlaceObject={handlePlaceFarmObject}
                onOpenSettings={() => {
                  setFarmAction(null);
                  setShowSettings(true);
                }}
                onExit={handleExit}
              />
            </>
          )}

          {/* 游戏设置 */}
          {showSettings && (
            <GameSettings
              world={world}
              reducedMotion={reducedMotion}
              onReducedMotionChange={(v) => setReducedMotion(v)}
              currentCharId={playerChar.id}
              onCharacterChange={handleCharacterChange}
              companionType={companionType}
              onCompanionTypeChange={handleCompanionTypeChange}
              onExit={handleExit}
              onClose={() => setShowSettings(false)}
            />
          )}
        </>
      )}

      {/* 加载骨架：首次进入时完全覆盖 Canvas，防止坐标闪烁 */}
      {isLoading && phase !== 'portal' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-20"
          style={{
            background: 'linear-gradient(160deg, #071b1d 0%, #0d2a2e 60%, #071b1d 100%)',
            pointerEvents: 'none',
          }}
        >
          {/* 像素风树林骨架 */}
          <div className="flex gap-4 mb-8 opacity-30" aria-hidden="true">
            {[32, 48, 40, 56, 36].map((h, i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{
                  width: 12,
                  height: h,
                  background: 'var(--game-green-mid)',
                  borderRadius: '3px 3px 0 0',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
          <div className="text-3xl mb-4" style={{ filter: 'drop-shadow(0 0 12px rgba(255,210,128,0.6))' }}>
            🌲
          </div>
          <p className="text-sm" style={{ color: 'var(--game-warm-light)', opacity: 0.6 }}>
            世界正在苏醒……
          </p>
        </div>
      )}
    </div>
  );
}

function mergeJourneyEvents(localEvents: JourneyEvent[], serverEvents: JourneyEvent[]): JourneyEvent[] {
  const byId = new Map<string, JourneyEvent>();
  [...localEvents, ...serverEvents].forEach((event) => {
    byId.set(event.id, event);
  });
  return [...byId.values()]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-30);
}

// 降级视图：API 失败时的图文地图
function GameFallbackView({
  message,
  memos,
  onOpenMemo,
  onOpenFireside,
  onOpenCoWrite,
  onRetry,
  onExit,
}: {
  message: string;
  memos: Memo[];
  onOpenMemo: (memoId: string) => void;
  onOpenFireside: () => void;
  onOpenCoWrite: () => void;
  onRetry: () => void;
  onExit: () => void;
}) {
  return (
    <div className="game-static-map">
      <div className="game-static-map__image" aria-hidden="true" />
      <section className="game-static-map__panel">
        <p className="game-kicker">图文地图</p>
        <h2>林间世界仍然在这里</h2>
        <p>{message}</p>

        <div className="game-static-map__places">
          <button type="button" onClick={onOpenFireside}>
            <strong>篝火地</strong>
            <span>与苔灯谈谈</span>
          </button>
          <button type="button" onClick={onOpenCoWrite}>
            <strong>共居工坊</strong>
            <span>一起留下痕迹</span>
          </button>
        </div>

        <div className="game-static-map__memos">
          <span>最近长出的故事</span>
          {memos.slice(0, 4).map((memo) => (
            <button key={memo.id} type="button" onClick={() => onOpenMemo(memo.id)}>
              {memo.ai_title || memo.plain_text.slice(0, 28) || '未命名记录'}
            </button>
          ))}
          {memos.length === 0 && <p>这里还没有故事。今天空着也可以。</p>}
        </div>

        <div className="game-static-map__actions">
          <button
            onClick={onRetry}
            className="game-hud-btn"
            style={{
              background: 'var(--game-green-mid)',
              borderColor: 'var(--game-green-deep)',
              color: 'white',
            }}
          >
            重试
          </button>
          <button onClick={onExit} className="game-hud-btn">
            返回 InnerOS
          </button>
        </div>
      </section>
    </div>
  );
}
