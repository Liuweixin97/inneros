'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  GameWorld,
  WorldObject,
  GamePhase,
  CompanionType,
  DialogueMode,
  JourneyEvent,
  Memo,
} from '@/types';
import {
  annotateObject,
  hideObject,
  loadWorld,
  loadGameMemos,
  placeObject,
  syncPlayerPosition,
  clearCache,
} from '@/lib/game/world-state';
import { mapMemosToWorldObjects } from '@/lib/game/memo-mapper';
import { getDefaultCharacter, getCharacterById } from '@/lib/game/sprite';
import { isWalkable } from '@/lib/game/collisions';
import { GAME_ACTION_POINTS, type GameActionId } from '@/lib/game/map';
import GamePortal from './GamePortal';
import PixelWorldCanvas from './PixelWorldCanvas';
import WorldHUD from './WorldHUD';
import GameSettings from './GameSettings';
import MemoEncounter from './MemoEncounter';
import FiresideChat from './FiresideChat';
import ObservationTablePanel from './ObservationTablePanel';
import PondPanel from './PondPanel';
import CompanionBench from './CompanionBench';
import CabinPanel from './CabinPanel';
import WorldObjectDetail from './WorldObjectDetail';
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

function readForestDebugStart(): { position: { x: number; y: number }; action: GameActionId | null } | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('forestDebug') !== '1') return null;
  const x = Number(params.get('x'));
  const y = Number(params.get('y'));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const explicitAction = params.get('open');
  const action = isGameActionId(explicitAction)
    ? explicitAction
    : findActionAtPosition(x, y);
  return { position: { x, y }, action };
}

function isGameActionId(value: string | null): value is GameActionId {
  return Boolean(value && value in GAME_ACTION_POINTS);
}

function findActionAtPosition(x: number, y: number): GameActionId | null {
  for (const action of Object.values(GAME_ACTION_POINTS)) {
    if (Math.hypot(action.x - x, action.y - y) < action.radius) return action.id;
  }
  return null;
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
  const [playerX, setPlayerX] = useState(345);
  const [playerY, setPlayerY] = useState(245);
  const [playerChar, setPlayerChar] = useState(getDefaultCharacter());

  // ---- 同行者 ----
  const [companionType, setCompanionType] = useState<CompanionType>('none');
  const [dialogueMode, setDialogueMode] = useState<DialogueMode>('listen');
  const [authorizedMemoIds, setAuthorizedMemoIds] = useState<string[]>([]);
  const [journeyEvents, setJourneyEvents] = useState<JourneyEvent[]>([]);

  // ---- 弹层状态 ----
  const [activeMemo, setActiveMemo] = useState<Memo | null>(null);
  const [activeObject, setActiveObject] = useState<WorldObject | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [firesideChatOpen, setFiresideChatOpen] = useState(false);
  const [reflectionTableOpen, setReflectionTableOpen] = useState(false);
  const [pondOpen, setPondOpen] = useState(false);
  const [benchOpen, setBenchOpen] = useState(false);
  const [cabinOpen, setCabinOpen] = useState(false);
  const [activePlacedObject, setActivePlacedObject] = useState<WorldObject | null>(null);
  const debugAutoEnteredRef = useRef(false);

  // ---- 减少动态模式 ----
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setAuthorizedMemoIds(loadBagMemoIds());
    setJourneyEvents(loadJourneyEvents());
    setCompanionType(loadCompanionInvited() ? 'llm' : 'none');
  }, []);

  // 加载世界
  const initWorld = useCallback(async (options?: { startAtBench?: boolean; startPosition?: { x: number; y: number } }) => {
    setIsLoading(true);
    setLoadError(null);
    setCanvasFailed(false);
    try {
      const { world: w, objects: objs } = await loadWorld();
      const requestedPosition = options?.startPosition;
      const safePlayerPosition = requestedPosition && isWalkable(requestedPosition.x, requestedPosition.y)
        ? requestedPosition
        : options?.startAtBench
        ? { x: GAME_ACTION_POINTS.bench.x, y: GAME_ACTION_POINTS.bench.y }
        : isWalkable(w.playerX, w.playerY)
          ? { x: w.playerX, y: w.playerY }
          : { x: 345, y: 245 };
      setWorld(w);
      setPlayerX(safePlayerPosition.x);
      setPlayerY(safePlayerPosition.y);
      if (options?.startAtBench || requestedPosition || safePlayerPosition.x !== w.playerX || safePlayerPosition.y !== w.playerY) {
        syncPlayerPosition(w.id, safePlayerPosition.x, safePlayerPosition.y);
      }
      setReducedMotion(w.settings.reducedMotion);

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

  // 传送门过场完成 → 从入林长椅开始本次回看
  const handlePortalComplete = useCallback(() => {
    const debugStart = readForestDebugStart();
    const debugAction = debugStart?.action ?? null;
    setPhase(
      debugAction === 'fireside'
        ? 'fireside_chat'
        : debugAction === 'reflection_table'
          ? 'reflection_table'
          : debugAction === 'pond'
            ? 'pond'
            : 'explore',
    );
    setBenchOpen(debugAction === 'bench' || !debugStart);
    setCabinOpen(debugAction === 'cabin');
    setFiresideChatOpen(debugAction === 'fireside');
    setReflectionTableOpen(debugAction === 'reflection_table');
    setPondOpen(debugAction === 'pond');
    initWorld(debugStart ? { startPosition: debugStart.position } : { startAtBench: true });
  }, [initWorld]);

  useEffect(() => {
    if (debugAutoEnteredRef.current || !readForestDebugStart()) return;
    debugAutoEnteredRef.current = true;
    handlePortalComplete();
  }, [handlePortalComplete]);

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
      return;
    }
    const memo = memos.find((m) => m.id === memoId);
    if (memo) {
      setActiveMemo(memo);
      setActiveObject(objects.find((object) => object.id === objectId) ?? null);
      setPhase('memo_encounter');
    }
  }, [memos, objects]);

  // 进入篝火对话
  const handleEnterFireside = useCallback(() => {
    setFiresideChatOpen(true);
    setPhase('fireside_chat');
  }, []);

  // 进入观照桌
  const handleEnterReflectionTable = useCallback(() => {
    setReflectionTableOpen(true);
    setPhase('reflection_table');
  }, []);

  // 进入池塘
  const handleEnterPond = useCallback(() => {
    setPondOpen(true);
    setPhase('pond');
  }, []);

  // 关闭所有弹层，回到探索
  const handleCloseAll = useCallback(() => {
    setActiveMemo(null);
    setActiveObject(null);
    setFiresideChatOpen(false);
    setReflectionTableOpen(false);
    setPondOpen(false);
    setBenchOpen(false);
    setCabinOpen(false);
    setActivePlacedObject(null);
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
        if (phase !== 'explore') {
          handleCloseAll();
        } else {
          setShowSettings((v) => !v);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, handleCloseAll]);

  // 授权 Memo（用户勾选后可带入 AI 对话）
  const handleAuthorizeMemos = useCallback((ids: string[]) => {
    const next = [...new Set(ids)].slice(-3);
    setAuthorizedMemoIds(next);
    saveBagMemoIds(next);
  }, []);

  const addJourneyEvent = useCallback((event: Omit<JourneyEvent, 'id' | 'createdAt'>) => {
    setJourneyEvents((current) => {
      const next = [...current, {
        ...event,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }].slice(-30);
      saveJourneyEvents(next);
      return next;
    });
  }, []);

  const handleCompanionTypeChange = useCallback((type: CompanionType) => {
    setCompanionType(type);
    saveCompanionInvited(type === 'llm');
  }, []);

  const handleSaveAnnotation = useCallback(async (annotation: string) => {
    if (!activeMemo || !world) return false;
    if (activeObject && !activeObject.id.startsWith('candidate-')) {
      await annotateObject(activeObject.id, annotation);
      setObjects((current) => current.map((object) => (
        object.id === activeObject.id ? { ...object, annotation } : object
      )));
      addJourneyEvent({
        type: 'left_annotation',
        text: annotation,
        sourceMemoIds: [activeMemo.id],
      });
      return true;
    }
    const created = await placeObject({
      type: activeObject?.type ?? 'memory_plant',
      x: activeObject?.x,
      y: activeObject?.y,
      sourceMemoIds: [activeMemo.id],
      annotation,
      userConfirmed: true,
    });
    if (!created) return false;
    setObjects((current) => [
      ...current.filter((object) => object.id !== activeObject?.id),
      created,
    ]);
    setActiveObject(created);
    addJourneyEvent({
      type: 'left_annotation',
      text: annotation,
      sourceMemoIds: [activeMemo.id],
    });
    return true;
  }, [activeMemo, activeObject, addJourneyEvent, world]);

  const handleObjectPlaced = useCallback((object: WorldObject) => {
    setObjects((current) => [...current, object]);
  }, []);

  const visibleMemos = memos;
  const visibleObjects = objects;
  const memoryEncounterObjects = useMemo(
    () => visibleObjects.filter((object) => (
      !object.hidden
      && !object.sourceSessionId
      && object.sourceMemoIds.some((memoId) => memos.some((memo) => memo.id === memoId))
    )),
    [memos, visibleObjects],
  );
  const nextMemoryEncounter = useMemo(() => {
    if (!activeObject) return null;
    const activeIndex = memoryEncounterObjects.findIndex((object) => object.id === activeObject.id);
    if (activeIndex < 0) return null;
    return memoryEncounterObjects.slice(activeIndex + 1).find((object) => (
      object.sourceMemoIds.some((memoId) => memos.some((memo) => memo.id === memoId))
    )) ?? null;
  }, [activeObject, memoryEncounterObjects, memos]);

  // ---- 渲染 ----
  return (
    <div className={`game-shell ${reducedMotion ? 'reduced-motion' : ''}`}>
      {/* 传送门过场 */}
      {phase === 'portal' && (
        <GamePortal onComplete={handlePortalComplete} />
      )}

      {/* 主地图 */}
      {(phase === 'explore' || phase === 'memo_encounter' || phase === 'fireside_chat' || phase === 'reflection_table' || phase === 'pond') && (
        <>
          {loadError || canvasFailed ? (
            <GameFallbackView
              message={loadError ?? '动态地图无法显示，已切换为图文地图。'}
              memos={visibleMemos}
              onOpenMemo={(memoId) => handleOpenMemo(memoId, `fallback-${memoId}`)}
              onOpenFireside={handleEnterFireside}
              onOpenReflectionTable={handleEnterReflectionTable}
              onRetry={initWorld}
              onExit={handleExit}
            />
          ) : (
            <>
              <PixelWorldCanvas
                playerX={playerX}
                playerY={playerY}
                playerChar={playerChar}
                objects={visibleObjects}
                companionType={companionType}
                reducedMotion={reducedMotion}
                onPlayerMove={handlePlayerMove}
                onOpenMemo={handleOpenMemo}
                onEnterCabin={() => setCabinOpen(true)}
                onEnterBench={() => setBenchOpen(true)}
                onEnterFireside={handleEnterFireside}
                onEnterReflectionTable={handleEnterReflectionTable}
                onEnterPond={handleEnterPond}
                onCanvasFailure={() => setCanvasFailed(true)}
              />

              <WorldHUD
                world={world}
                phase={phase}
                companionType={companionType}
                playerX={playerX}
                playerY={playerY}
                memos={memos}
                bagMemoIds={authorizedMemoIds}
                onRemoveFromBag={(memoId) => handleAuthorizeMemos(
                  authorizedMemoIds.filter((id) => id !== memoId),
                )}
                onOpenFireside={handleEnterFireside}
                onOpenSettings={() => setShowSettings(true)}
                onExit={handleExit}
              />
            </>
          )}

          {/* Memo 阅读弹层 */}
          {phase === 'memo_encounter' && activeMemo && (
            <MemoEncounter
              key={activeMemo.id}
              memo={activeMemo}
              worldObject={activeObject}
              authorizedMemoIds={authorizedMemoIds}
              onAuthorize={(id) => {
                handleAuthorizeMemos([...authorizedMemoIds, id]);
                addJourneyEvent({
                  type: 'carried_memory',
                  text: `带走了「${activeMemo.ai_title || activeMemo.plain_text.slice(0, 24) || '一段记忆'}」`,
                  sourceMemoIds: [id],
                });
              }}
              onSaveAnnotation={handleSaveAnnotation}
              onHide={activeObject
                && !activeObject.id.startsWith('candidate-')
                && !activeObject.id.startsWith('fallback-')
                ? async () => {
                  await hideObject(activeObject.id);
                  setObjects((current) => current.filter((object) => object.id !== activeObject.id));
                  handleCloseAll();
                }
                : undefined}
              onClose={handleCloseAll}
              onOpenFireside={() => {
                setActiveMemo(null);
                handleEnterFireside();
              }}
              hasNextMemo={Boolean(nextMemoryEncounter)}
              onNextMemo={() => {
                const nextMemoId = nextMemoryEncounter?.sourceMemoIds.find((memoId) => (
                  memos.some((memo) => memo.id === memoId)
                ));
                if (nextMemoryEncounter && nextMemoId) {
                  handleOpenMemo(nextMemoId, nextMemoryEncounter.id);
                }
              }}
            />
          )}

          {/* 篝火对话 */}
          {phase === 'fireside_chat' && firesideChatOpen && (
            world ? (
              <FiresideChat
                world={world}
                memos={memos}
                authorizedMemoIds={authorizedMemoIds}
                dialogueMode={dialogueMode}
                onDialogueModeChange={setDialogueMode}
                onAuthorizeMemos={handleAuthorizeMemos}
                companionType={companionType}
                onCompanionTypeChange={handleCompanionTypeChange}
                onClose={handleCloseAll}
                onSaveJourneyEvent={(type, text, memoIds) => addJourneyEvent({
                  type,
                  text,
                  sourceMemoIds: memoIds,
                })}
              />
            ) : null
          )}

          {/* 观照桌 */}
          {phase === 'reflection_table' && reflectionTableOpen && (
            <ObservationTablePanel
              memos={memos}
              bagMemoIds={authorizedMemoIds}
              onClose={handleCloseAll}
              onObjectPlaced={handleObjectPlaced}
              onJourneyEvent={(text, memoIds) => addJourneyEvent({
                type: 'saved_observation',
                text,
                sourceMemoIds: memoIds,
              })}
            />
          )}

          {/* 池塘面板 */}
          {phase === 'pond' && pondOpen && (
            <PondPanel
              memos={memos}
              bagMemoIds={authorizedMemoIds}
              events={journeyEvents}
              onRemoveFromBag={(memoId) => handleAuthorizeMemos(
                authorizedMemoIds.filter((id) => id !== memoId),
              )}
              onClose={handleCloseAll}
            />
          )}

          {benchOpen && (
            <CompanionBench
              companionType={companionType}
              onChange={handleCompanionTypeChange}
              onClose={() => setBenchOpen(false)}
            />
          )}

          {cabinOpen && (
            <CabinPanel
              events={journeyEvents}
              objects={objects}
              onOpenSettings={() => {
                setCabinOpen(false);
                setShowSettings(true);
              }}
              onExit={handleExit}
              onClose={() => setCabinOpen(false)}
            />
          )}

          {activePlacedObject && (
            <WorldObjectDetail
              object={activePlacedObject}
              memos={memos}
              onClose={() => setActivePlacedObject(null)}
            />
          )}

          {/* 游戏设置 */}
          {showSettings && (
            <GameSettings
              world={world}
              reducedMotion={reducedMotion}
              onReducedMotionChange={(v) => setReducedMotion(v)}
              currentCharId={playerChar.id}
              onCharacterChange={handleCharacterChange}
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

// 降级视图：API 失败时的图文地图
function GameFallbackView({
  message,
  memos,
  onOpenMemo,
  onOpenFireside,
  onOpenReflectionTable,
  onRetry,
  onExit,
}: {
  message: string;
  memos: Memo[];
  onOpenMemo: (memoId: string) => void;
  onOpenFireside: () => void;
  onOpenReflectionTable: () => void;
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
            <strong>苔灯火边</strong>
            <span>只谈本次带入的记忆</span>
          </button>
          <button type="button" onClick={onOpenReflectionTable}>
            <strong>观照桌</strong>
            <span>看看几段记忆之间的关系</span>
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
