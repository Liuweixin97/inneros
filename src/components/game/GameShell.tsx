'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { GameWorld, WorldObject, GamePhase, CompanionType, DialogueMode, Memo } from '@/types';
import { loadWorld, loadGameMemos, syncPlayerPosition, clearCache } from '@/lib/game/world-state';
import { mapMemosToWorldObjects } from '@/lib/game/memo-mapper';
import { getDefaultCharacter, getCharacterById } from '@/lib/game/sprite';
import GamePortal from './GamePortal';
import CharacterSelect from './CharacterSelect';
import PixelWorldCanvas from './PixelWorldCanvas';
import WorldHUD from './WorldHUD';
import GameSettings from './GameSettings';
import MemoEncounter from './MemoEncounter';
// import FiresideChat from './FiresideChat';
// import CoWritePanel from './CoWritePanel';

interface GameShellProps {
  onExit: () => void;
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

  // ---- 玩家状态 ----
  const [playerX, setPlayerX] = useState(400);
  const [playerY, setPlayerY] = useState(300);
  const [playerChar, setPlayerChar] = useState(getDefaultCharacter());

  // ---- 同行者 ----
  const [companionType, setCompanionType] = useState<CompanionType>('none');
  const [dialogueMode, setDialogueMode] = useState<DialogueMode>('listen');
  const [authorizedMemoIds, setAuthorizedMemoIds] = useState<string[]>([]);

  // ---- 弹层状态 ----
  const [activeMemo, setActiveMemo] = useState<Memo | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [firesideChatOpen, setFiresideChatOpen] = useState(false);
  const [coWriteOpen, setCoWriteOpen] = useState(false);

  // ---- 减少动态模式 ----
  const [reducedMotion, setReducedMotion] = useState(false);

  // 加载世界
  const initWorld = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { world: w, objects: objs } = await loadWorld();
      setWorld(w);
      setPlayerX(w.playerX);
      setPlayerY(w.playerY);
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
      setObjects(allObjects);
    } catch {
      setLoadError('世界暂时无法抵达，请稍后再试。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 传送门过场完成 → 初始化世界
  const handlePortalComplete = useCallback(() => {
    setPhase('character_select');
    initWorld();
  }, [initWorld]);

  // 角色选择完成 → 进入探索
  const handleCharacterConfirmed = useCallback((
    charId: string,
    companion: CompanionType,
  ) => {
    const char = getCharacterById(charId);
    setPlayerChar(char);
    setCompanionType(companion);
    setPhase('explore');
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
  const handleOpenMemo = useCallback((memoId: string) => {
    const memo = memos.find((m) => m.id === memoId);
    if (memo) {
      setActiveMemo(memo);
      setPhase('memo_encounter');
    }
  }, [memos]);

  // 进入篝火对话
  const handleEnterFireside = useCallback(() => {
    setFiresideChatOpen(true);
    setPhase('fireside_chat');
  }, []);

  // 进入共写
  const handleEnterCoWrite = useCallback(() => {
    setCoWriteOpen(true);
    setPhase('co_write');
  }, []);

  // 关闭所有弹层，回到探索
  const handleCloseAll = useCallback(() => {
    setActiveMemo(null);
    setFiresideChatOpen(false);
    setCoWriteOpen(false);
    setPhase('explore');
  }, []);

  // 退出游戏
  const handleExit = useCallback(() => {
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
    setAuthorizedMemoIds(ids);
  }, []);

  // ---- 渲染 ----
  return (
    <div className={`game-shell ${reducedMotion ? 'reduced-motion' : ''}`}>
      {/* 传送门过场 */}
      {phase === 'portal' && (
        <GamePortal onComplete={handlePortalComplete} />
      )}

      {/* 角色 & 模式选择 */}
      {phase === 'character_select' && (
        <CharacterSelect
          onConfirm={handleCharacterConfirmed}
        />
      )}

      {/* 主地图 */}
      {(phase === 'explore' || phase === 'memo_encounter' || phase === 'fireside_chat' || phase === 'co_write') && (
        <>
          {loadError ? (
            <GameFallbackView message={loadError} onRetry={initWorld} onExit={handleExit} />
          ) : (
            <>
              <PixelWorldCanvas
                playerX={playerX}
                playerY={playerY}
                playerChar={playerChar}
                objects={objects}
                memos={memos}
                companionType={companionType}
                reducedMotion={reducedMotion}
                onPlayerMove={handlePlayerMove}
                onOpenMemo={handleOpenMemo}
                onEnterFireside={handleEnterFireside}
                onEnterCoWrite={handleEnterCoWrite}
              />

              <WorldHUD
                world={world}
                phase={phase}
                companionType={companionType}
                onOpenSettings={() => setShowSettings(true)}
                onExit={handleExit}
              />
            </>
          )}

          {/* Memo 阅读弹层 */}
          {phase === 'memo_encounter' && activeMemo && (
            <MemoEncounter
              memo={activeMemo}
              authorizedMemoIds={authorizedMemoIds}
              onAuthorize={(id) => handleAuthorizeMemos([...authorizedMemoIds, id])}
              onClose={handleCloseAll}
              onOpenFireside={() => {
                setActiveMemo(null);
                handleEnterFireside();
              }}
            />
          )}

          {/* 篝火对话 */}
          {phase === 'fireside_chat' && firesideChatOpen && (
            <div className="absolute inset-0 z-40 bg-[rgba(30,18,8,0.7)] backdrop-blur-sm flex items-center justify-center text-white font-mono">
              <div className="text-center p-6 rounded-lg max-w-sm border-2 border-[#C4A882]" style={{ background: '#3B2E2A' }}>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#FF9B3D' }}>🔥 篝火对话（暂未实现）</h3>
                <p className="text-xs opacity-80 mb-4 leading-relaxed">
                  AI 同行者在此与你探讨记忆。此处可以切换倾听、询问与整理姿态。
                </p>
                <button
                  onClick={handleCloseAll}
                  className="px-4 py-2 rounded text-xs transition-colors"
                  style={{ background: 'var(--game-green-mid)' }}
                >
                  返回世界
                </button>
              </div>
            </div>
          )}

          {/* 共写面板 */}
          {phase === 'co_write' && coWriteOpen && (
            <div className="absolute inset-0 z-40 bg-[rgba(30,18,8,0.7)] backdrop-blur-sm flex items-center justify-center text-white font-mono">
              <div className="text-center p-6 rounded-lg max-w-sm border-2 border-[#C4A882]" style={{ background: '#3B2E2A' }}>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#C4A882' }}>📝 共写面板（暂未实现）</h3>
                <p className="text-xs opacity-80 mb-4 leading-relaxed">
                  与同伴或 AI 轮流记叙今日感想，共同制作世界物件。
                </p>
                <button
                  onClick={handleCloseAll}
                  className="px-4 py-2 rounded text-xs transition-colors"
                  style={{ background: 'var(--game-green-mid)' }}
                >
                  返回世界
                </button>
              </div>
            </div>
          )}

          {/* 游戏设置 */}
          {showSettings && (
            <GameSettings
              world={world}
              reducedMotion={reducedMotion}
              onReducedMotionChange={(v) => {
                setReducedMotion(v);
              }}
              onExit={handleExit}
              onClose={() => setShowSettings(false)}
            />
          )}
        </>
      )}

      {/* 加载中 */}
      {isLoading && phase !== 'portal' && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-[var(--game-sky-day)]/60 pointer-events-none">
          <div className="text-center">
            <div className="text-3xl mb-3 animate-pulse-soft">🌲</div>
            <p className="text-[var(--game-ink)] text-sm">世界正在苏醒……</p>
          </div>
        </div>
      )}
    </div>
  );
}

// 降级视图：API 失败时的图文地图
function GameFallbackView({
  message,
  onRetry,
  onExit,
}: {
  message: string;
  onRetry: () => void;
  onExit: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F0EBE0] z-10">
      <div className="text-center max-w-sm px-6">
        <div className="text-4xl mb-4">🌲</div>
        <h2 className="text-lg font-medium text-[var(--game-ink)] mb-2">林间世界</h2>
        <p className="text-sm text-[var(--game-stone)] mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
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
      </div>
    </div>
  );
}
