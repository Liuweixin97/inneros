'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Flame,
  House,
  RefreshCw,
  Route,
  Sprout,
  Trees,
  Waves,
  Wind,
} from 'lucide-react';
import type {
  ForestAtlas,
  ForestNodeId,
  ForestProfile,
  ForestTaskChoice,
  ForestViewer,
  ForestWindowRequest,
} from '@/lib/forest/types';
import { FOREST_WORLD_NODES } from '@/lib/forest/world';
import ForestInsightPanel from './ForestInsightPanel';
import ForestMapCanvas from './ForestMapCanvas';
import styles from './ForestWorld.module.css';

interface ForestWorldProps {
  initialAtlas: ForestAtlas;
  initialProfile: ForestProfile;
  viewer: ForestViewer;
}

const PLACES: Record<ForestNodeId, {
  side: 'left' | 'right';
  question: string;
  icon: typeof House;
}> = {
  'lantern-cabin': { side: 'right', question: '近期记录照见了怎样的此刻？', icon: House },
  'year-ring-path': { side: 'right', question: '什么在重复，什么已经改变？', icon: Route },
  'echo-hearth': { side: 'left', question: '我在不同场景里如何表达自己？', icon: Flame },
  'twin-shadow-pond': { side: 'right', question: '是否有两股力量同时拉着我？', icon: Waves },
  'root-court': { side: 'right', question: '什么曾真实支撑过我？', icon: Sprout },
  'windwatch-terrace': { side: 'left', question: '什么方向值得继续观察？', icon: Wind },
};

const WINDOW_OPTIONS: Array<{ value: ForestWindowRequest; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 30, label: '30 天' },
  { value: 90, label: '90 天' },
  { value: 180, label: '180 天' },
  { value: 365, label: '1 年' },
];

function pathBetween(from: ForestNodeId, to: ForestNodeId): string {
  const a = FOREST_WORLD_NODES[from];
  const b = FOREST_WORLD_NODES[to];
  const curve = (a.mapY + b.mapY) / 2 - 7;
  return `M ${a.mapX} ${a.mapY} Q ${(a.mapX + b.mapX) / 2} ${curve} ${b.mapX} ${b.mapY}`;
}

function freshnessText(atlas: ForestAtlas): string {
  const days = atlas.freshness.daysSinceLatest;
  if (days === null) return '这个窗口还没有记录';
  if (days === 0) return '最近记录于今天';
  return `最近记录于 ${days} 天前`;
}

export default function ForestWorld({ initialAtlas, initialProfile, viewer }: ForestWorldProps) {
  const router = useRouter();
  const [atlas, setAtlas] = useState(initialAtlas);
  const [profile, setProfile] = useState(initialProfile);
  const [selectedId, setSelectedId] = useState<ForestNodeId | null>(null);
  const [targetId, setTargetId] = useState<ForestNodeId | null>(null);
  const [nearbyNodeId, setNearbyNodeId] = useState<ForestNodeId | null>(null);
  const [loadingWindow, setLoadingWindow] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [canvasFailed, setCanvasFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const positionSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPositionRef = useRef({ x: initialProfile.playerX, y: initialProfile.playerY });
  const selectedNode = selectedId ? atlas.nodes.find((node) => node.id === selectedId) ?? null : null;
  const nodeNames = useMemo(() => Object.fromEntries(atlas.nodes.map((node) => [node.id, node.name])) as Record<ForestNodeId, string>, [atlas.nodes]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  useEffect(() => () => {
    if (positionSyncTimerRef.current) clearTimeout(positionSyncTimerRef.current);
  }, []);

  const saveProfile = useCallback(async (updates: Record<string, unknown>) => {
    if (!initialProfile.persistent) return;
    try {
      const response = await fetch('/api/forest/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('路线暂时无法保存');
    } catch {
      setLoadError('路线暂时无法同步；本次浏览仍可继续。');
    }
  }, [initialProfile.persistent]);

  const openPlace = useCallback((id: ForestNodeId) => {
    setSelectedId(id);
    setTargetId(id);
    setLoadError('');
    setProfile((current) => {
      if (current.visitedNodeIds.includes(id)) return current;
      const visitedNodeIds = [...current.visitedNodeIds, id];
      void saveProfile({ visitedNodeIds });
      return { ...current, visitedNodeIds };
    });
    window.setTimeout(() => {
      if (window.matchMedia('(max-width: 720px)').matches) {
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  }, [saveProfile]);

  const chooseRandomPlace = () => {
    const candidates = atlas.nodes.filter((node) => node.id !== targetId);
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    if (next) {
      setSelectedId(null);
      setTargetId(next.id);
    }
  };

  const handlePlayerMove = useCallback((x: number, y: number) => {
    latestPositionRef.current = { x, y };
    if (!initialProfile.persistent) return;
    if (positionSyncTimerRef.current) clearTimeout(positionSyncTimerRef.current);
    positionSyncTimerRef.current = setTimeout(() => {
      void saveProfile({ playerX: latestPositionRef.current.x, playerY: latestPositionRef.current.y });
    }, 900);
  }, [initialProfile.persistent, saveProfile]);

  const handleCanvasFailure = useCallback(() => setCanvasFailed(true), []);

  const chooseTask = useCallback((nodeId: ForestNodeId, observationId: string, label: string) => {
    const taskChoice: ForestTaskChoice = { observationId, label, updatedAt: new Date().toISOString() };
    setProfile((current) => {
      const taskChoices = { ...current.taskChoices, [nodeId]: taskChoice };
      void saveProfile({ taskChoices });
      return { ...current, taskChoices };
    });
  }, [saveProfile]);

  const changeWindow = async (requested: ForestWindowRequest) => {
    if (requested === atlas.window.requested || loadingWindow) return;
    setLoadingWindow(true);
    setLoadError('');
    try {
      const response = await fetch(`/api/forest/atlas?window=${requested}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('无法切换回看范围');
      setAtlas(await response.json() as ForestAtlas);
      setProfile((current) => ({ ...current, activeWindow: requested }));
      void saveProfile({ activeWindow: requested });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '无法切换回看范围');
    } finally {
      setLoadingWindow(false);
    }
  };

  return (
    <main className={styles.shell} data-panel-open={Boolean(selectedNode)}>
      <header className={styles.topBar}>
        <button type="button" className={styles.backButton} aria-label="回到 InnerOS" onClick={() => router.push('/')}>
          <ArrowLeft size={15} />
          <span>回到 InnerOS</span>
        </button>
        <div className={styles.brand}>
          <strong>林间世界</strong>
          <span>{viewer.name} 的林间世界 · 路线已独立保存</span>
        </div>
        <div className={styles.topActions}>
          <div className={styles.windowControl} aria-label="回看范围">
            {WINDOW_OPTIONS.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                className={styles.windowButton}
                data-active={atlas.window.requested === option.value}
                disabled={loadingWindow}
                onClick={() => changeWindow(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button type="button" className={styles.quietButton} aria-label="随机选择一个目的地" onClick={chooseRandomPlace}>
            <RefreshCw size={14} />
            <span>随便走一处</span>
          </button>
        </div>
      </header>

      <section className={styles.mapViewport} aria-label="林间世界的六个观察地点">
        <div className={styles.mapFrame}>
          {canvasFailed ? (
            <Image
              src="/game/twilight-world-map-v3.png"
              alt="暮色森林中的六个观察地点"
              fill
              priority
              sizes="100vw"
              className={styles.mapImage}
            />
          ) : (
            <ForestMapCanvas
              initialX={initialProfile.playerX}
              initialY={initialProfile.playerY}
              characterId={initialProfile.characterId}
              targetNodeId={targetId}
              interactionDisabled={Boolean(selectedNode)}
              reducedMotion={reducedMotion}
              nodeNames={nodeNames}
              onPlayerMove={handlePlayerMove}
              onNearbyNodeChange={setNearbyNodeId}
              onEnterNode={openPlace}
              onCanvasFailure={handleCanvasFailure}
            />
          )}
          <div className={styles.mapShade} aria-hidden="true" />

          {selectedNode && selectedNode.connections.length > 0 ? (
            <svg className={styles.connectionLines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {selectedNode.connections.map((connection) => (
                <path key={connection.toNodeId} d={pathBetween(selectedNode.id, connection.toNodeId)} />
              ))}
            </svg>
          ) : null}

          {atlas.nodes.map((node) => {
            const place = PLACES[node.id];
            const worldNode = FOREST_WORLD_NODES[node.id];
            const Icon = place.icon;
            const isTarget = targetId === node.id || selectedId === node.id;
            return (
              <button
                key={node.id}
                type="button"
                className={styles.marker}
                data-side={place.side}
                data-state={node.dataState}
                data-selected={isTarget}
                data-visited={profile.visitedNodeIds.includes(node.id)}
                style={{ left: `${worldNode.mapX}%`, top: `${worldNode.mapY}%` }}
                aria-pressed={isTarget}
                aria-label={`将${node.name}设为目的地：${place.question}`}
                onClick={() => {
                  setSelectedId(null);
                  setTargetId(node.id);
                }}
              >
                <span className={styles.markerOrb}><Icon size={15} strokeWidth={1.6} /></span>
                <span className={styles.markerCopy}>
                  <strong>{node.name}</strong>
                  <small>{nearbyNodeId === node.id ? '已经靠近，按 E 查看' : place.question}</small>
                </span>
              </button>
            );
          })}

          {!selectedNode ? (
            <div className={styles.movementHint}>
              <kbd>WASD</kbd><span>或方向键移动 · 靠近地点按 E</span>
            </div>
          ) : null}
        </div>
      </section>

      {!selectedNode ? (
        <section className={styles.intro}>
          <h1>{targetId ? `沿着微光，走向${nodeNames[targetId]}` : '从任何一处开始'}</h1>
          <p>{targetId ? '地图只指方向，真正抵达仍要靠你走过去。' : '六个地点，是同一批个人记录的六种观察方式。'}</p>
          <div className={styles.coverageLine}>
            <Trees size={13} />
            <span>
              实际回看 {atlas.window.actualDays} 天 · {atlas.coverage.memoCount} 条记录 · {freshnessText(atlas)}
            </span>
          </div>
          {loadError ? <p className={styles.errorText}>{loadError}</p> : null}
        </section>
      ) : null}

      <ForestInsightPanel
        ref={panelRef}
        key={selectedNode?.id ?? 'closed'}
        node={selectedNode}
        atlas={atlas}
        taskChoice={selectedNode ? profile.taskChoices[selectedNode.id] : undefined}
        persistent={profile.persistent}
        onClose={() => setSelectedId(null)}
        onSelectNode={(id) => {
          setSelectedId(null);
          setTargetId(id);
        }}
        onChooseTask={chooseTask}
      />

      {loadingWindow ? <div className={styles.loadingVeil}>正在重新铺开这段时间的线索…</div> : null}
    </main>
  );
}
