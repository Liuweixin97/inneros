'use client';

import { useMemo, useState } from 'react';
import {
  Backpack,
  BookOpen,
  Check,
  Clock3,
  CloudMoon,
  Droplets,
  Flame,
  GitBranch,
  Hammer,
  Home,
  Lamp,
  Leaf,
  Moon,
  NotebookPen,
  PackageOpen,
  ScrollText,
  Settings,
  Sprout,
  Waves,
  X,
} from 'lucide-react';
import type {
  CompanionType,
  GameWorld,
  JourneyEvent,
  JourneyEventType,
  Memo,
  WorldObject,
  WorldObjectType,
} from '@/types';

export type FarmActionId =
  | 'cabin'
  | 'bench'
  | 'memory'
  | 'cook'
  | 'workshop'
  | 'pond'
  | 'trail'
  | 'desk'
  | 'object'
  | null;

type FarmToolId = 'water' | 'seed' | 'lantern' | 'twine' | 'bottle' | 'notebook';

interface ForestFarmHudProps {
  world: GameWorld | null;
  memos: Memo[];
  bagMemoIds: string[];
  events: JourneyEvent[];
  companionType: CompanionType;
  activeAction: FarmActionId;
  activeMemo: Memo | null;
  activeObject: WorldObject | null;
  activePlacedObject: WorldObject | null;
  onActionChange: (action: FarmActionId) => void;
  onCarryMemo: (memo: Memo) => void;
  onRemoveFromBag: (memoId: string) => void;
  onAddJourneyEvent: (event: Omit<JourneyEvent, 'id' | 'createdAt'>) => void;
  onCompanionTypeChange: (type: CompanionType) => void;
  onCreateMemo: (content: string) => Promise<boolean>;
  onPlaceObject: (input: {
    type: WorldObjectType;
    annotation: string;
    memoIds: string[];
    eventText: string;
  }) => Promise<boolean>;
  onOpenSettings: () => void;
  onExit: () => void;
}

const TOOLS: Array<{
  id: FarmToolId;
  label: string;
  action: FarmActionId;
  Icon: typeof Droplets;
}> = [
  { id: 'water', label: '浇水壶', action: 'cook', Icon: Droplets },
  { id: 'seed', label: '记忆种子', action: 'memory', Icon: Sprout },
  { id: 'lantern', label: '提灯', action: 'bench', Icon: Lamp },
  { id: 'twine', label: '细绳', action: 'trail', Icon: GitBranch },
  { id: 'bottle', label: '花蜜瓶', action: 'pond', Icon: PackageOpen },
  { id: 'notebook', label: '笔记本', action: 'desk', Icon: NotebookPen },
];

export default function ForestFarmHud({
  world,
  memos,
  bagMemoIds,
  events,
  companionType,
  activeAction,
  activeMemo,
  activeObject,
  activePlacedObject,
  onActionChange,
  onCarryMemo,
  onRemoveFromBag,
  onAddJourneyEvent,
  onCompanionTypeChange,
  onCreateMemo,
  onPlaceObject,
  onOpenSettings,
  onExit,
}: ForestFarmHudProps) {
  const [selectedTool, setSelectedTool] = useState<FarmToolId>('water');
  const [selectedMemoId, setSelectedMemoId] = useState('');
  const [fieldNote, setFieldNote] = useState('');
  const [routeName, setRouteName] = useState('');
  const [shipText, setShipText] = useState('');
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const carriedMemos = useMemo(
    () => bagMemoIds.map((id) => memos.find((memo) => memo.id === id)).filter((memo): memo is Memo => Boolean(memo)),
    [bagMemoIds, memos],
  );
  const workableMemos = carriedMemos.length > 0 ? carriedMemos : memos.slice(0, 6);
  const selectedMemo = workableMemos.find((memo) => memo.id === selectedMemoId)
    ?? activeMemo
    ?? workableMemos[0]
    ?? memos[0]
    ?? null;
  const routeIds = selectedRouteIds.length > 0
    ? selectedRouteIds
    : workableMemos.slice(0, 2).map((memo) => memo.id);
  const action = activeAction ?? null;

  const chores = [
    {
      title: '采一粒记忆种子',
      detail: '从花园或地图物件带走一段记录',
      done: carriedMemos.length > 0,
      progress: `${Math.min(carriedMemos.length, 1)}/1`,
    },
    {
      title: '给种子浇水',
      detail: '在火边把此刻的一句话写清楚',
      done: events.some((event) => event.type === 'fireside_note' || event.type === 'left_question'),
      progress: events.some((event) => event.type === 'fireside_note' || event.type === 'left_question') ? '1/1' : '0/1',
    },
    {
      title: '酿造一段关系',
      detail: '把两段记忆连成路，或确认它们暂时无关',
      done: events.some((event) => event.type === 'named_path' || event.type === 'separated_path'),
      progress: events.some((event) => event.type === 'named_path' || event.type === 'separated_path') ? '1/1' : '0/1',
    },
  ];

  const dayNumber = 12 + Math.min(events.length, 17);
  const mood = Math.min(100, 54 + carriedMemos.length * 12 + events.length * 3);

  const chooseTool = (tool: FarmToolId, actionId: FarmActionId) => {
    setSelectedTool(tool);
    onActionChange(actionId);
  };

  const addFieldEvent = (type: JourneyEventType, text: string, memoIds: string[] = []) => {
    onAddJourneyEvent({ type, text, sourceMemoIds: memoIds });
    setStatus(text);
  };

  const toggleRouteMemo = (memoId: string) => {
    setSelectedRouteIds((current) => {
      if (current.includes(memoId)) return current.filter((id) => id !== memoId);
      if (current.length >= 3) return current;
      return [...current, memoId];
    });
  };

  const handleShip = async () => {
    const content = shipText.trim();
    if (!content || saving) return;
    setSaving(true);
    const ok = await onCreateMemo(content);
    setSaving(false);
    if (ok) {
      setStatus('已出货到 InnerOS');
      setShipText('');
      onActionChange(null);
    } else {
      setStatus('这次没有写入，先留在笔记本里');
    }
  };

  const handleCraftObject = async (type: WorldObjectType, fallbackText: string) => {
    if (!selectedMemo) return;
    const note = fieldNote.trim() || fallbackText;
    setSaving(true);
    const ok = await onPlaceObject({
      type,
      annotation: note,
      memoIds: [selectedMemo.id],
      eventText: `在工坊做成「${objectLabel(type)}」`,
    });
    setSaving(false);
    setStatus(ok ? '物件已经放进世界' : '物件暂时没放进去，文字还在');
    if (ok) {
      setFieldNote('');
      onActionChange(null);
    }
  };

  return (
    <div className="farm-rpg-hud" aria-label="林间世界农场界面">
      <section className="farm-day-ledger" aria-label="日期与农活">
        <span className="farm-ledger-pin" aria-hidden="true" />
        <strong>Day {dayNumber}</strong>
        <small><Moon size={13} /> 晚间</small>
        <button type="button" onClick={() => onActionChange('cabin')}>今日农活</button>
      </section>

      <section className="farm-weather-board" aria-label="时间和心情">
        <div><Clock3 size={16} /> 21:40</div>
        <div><CloudMoon size={16} /> 晴转多云</div>
        <div className="farm-mood-row">
          <span>心情安稳</span>
          <meter min={0} max={100} value={mood}>{mood}</meter>
          <small>{mood}/100</small>
        </div>
      </section>

      <section className="farm-quest-board" aria-label="今日待办">
        <header>
          <Leaf size={18} />
          <strong>今日待办</strong>
        </header>
        {chores.map((task) => (
          <button
            key={task.title}
            type="button"
            className={task.done ? 'is-done' : ''}
            onClick={() => onActionChange(task.title.includes('酿造') ? 'trail' : task.title.includes('浇水') ? 'cook' : 'memory')}
          >
            <span>{task.done ? <Check size={15} /> : <Sprout size={15} />}</span>
            <span>
              <strong>{task.title}</strong>
              <small>{task.detail}</small>
            </span>
            <em>{task.progress}</em>
          </button>
        ))}
        <article className="farm-village-note">
          <strong>村庄公告</strong>
          <p>明日有流星雨，记得抬头许愿。</p>
        </article>
      </section>

      <section className="farm-recipe-board" aria-label="今日配方">
        <header>今日配方</header>
        <h3>把两段记忆酿成关系</h3>
        <div className="farm-recipe-equation" aria-hidden="true">
          <ScrollText size={25} />
          <span>+</span>
          <ScrollText size={25} />
          <span>→</span>
          <PackageOpen size={28} />
        </div>
        <ul>
          <li>任意两段记忆</li>
          <li>花蜜 x1</li>
          <li>你亲自确认</li>
        </ul>
        <button type="button" disabled={memos.length < 2} onClick={() => onActionChange('trail')}>
          开始酿造
        </button>
      </section>

      <section className="farm-menu-rail" aria-label="游戏菜单">
        <button type="button" onClick={() => onActionChange('cabin')}><Home size={18} />地图</button>
        <button type="button" onClick={() => onActionChange('desk')}><BookOpen size={18} />日记</button>
        <button type="button" onClick={() => onActionChange('bench')}><Lamp size={18} />村民</button>
      </section>

      <section className="farm-toolbelt" aria-label="工具栏">
        {TOOLS.map(({ id, label, action: actionId, Icon }, index) => (
          <button
            key={id}
            type="button"
            className={selectedTool === id ? 'is-selected' : ''}
            onClick={() => chooseTool(id, actionId)}
          >
            <em>{index + 1}</em>
            <Icon size={25} />
            <span>{label}</span>
          </button>
        ))}
        <button type="button" className="farm-toolbag" onClick={() => onActionChange('memory')}>
          <Backpack size={23} />
          <span>{carriedMemos.length}/3</span>
          <kbd>B</kbd>
        </button>
      </section>

      {status && (
        <div className="farm-toast" role="status">
          {status}
          <button type="button" onClick={() => setStatus('')} aria-label="关闭提示">
            <X size={13} />
          </button>
        </div>
      )}

      <FarmActionPanel
        action={action}
        memos={memos}
        carriedMemos={carriedMemos}
        selectedMemo={selectedMemo}
        activeObject={activeObject}
        activePlacedObject={activePlacedObject}
        companionType={companionType}
        fieldNote={fieldNote}
        routeName={routeName}
        routeIds={routeIds}
        shipText={shipText}
        saving={saving}
        worldName={world?.displayName ?? '林间农场'}
        onClose={() => onActionChange(null)}
        onMemoSelect={(memoId) => setSelectedMemoId(memoId)}
        onCarryMemo={onCarryMemo}
        onRemoveFromBag={onRemoveFromBag}
        onFieldNoteChange={setFieldNote}
        onRouteNameChange={setRouteName}
        onShipTextChange={setShipText}
        onRouteMemoToggle={toggleRouteMemo}
        onCompanionTypeChange={onCompanionTypeChange}
        onAddEvent={addFieldEvent}
        onCraftObject={handleCraftObject}
        onShip={handleShip}
        onOpenSettings={onOpenSettings}
        onExit={onExit}
      />
    </div>
  );
}

function FarmActionPanel({
  action,
  memos,
  carriedMemos,
  selectedMemo,
  activeObject,
  activePlacedObject,
  companionType,
  fieldNote,
  routeName,
  routeIds,
  shipText,
  saving,
  worldName,
  onClose,
  onMemoSelect,
  onCarryMemo,
  onRemoveFromBag,
  onFieldNoteChange,
  onRouteNameChange,
  onShipTextChange,
  onRouteMemoToggle,
  onCompanionTypeChange,
  onAddEvent,
  onCraftObject,
  onShip,
  onOpenSettings,
  onExit,
}: {
  action: Exclude<FarmActionId, null> | null;
  memos: Memo[];
  carriedMemos: Memo[];
  selectedMemo: Memo | null;
  activeObject: WorldObject | null;
  activePlacedObject: WorldObject | null;
  companionType: CompanionType;
  fieldNote: string;
  routeName: string;
  routeIds: string[];
  shipText: string;
  saving: boolean;
  worldName: string;
  onClose: () => void;
  onMemoSelect: (memoId: string) => void;
  onCarryMemo: (memo: Memo) => void;
  onRemoveFromBag: (memoId: string) => void;
  onFieldNoteChange: (value: string) => void;
  onRouteNameChange: (value: string) => void;
  onShipTextChange: (value: string) => void;
  onRouteMemoToggle: (memoId: string) => void;
  onCompanionTypeChange: (type: CompanionType) => void;
  onAddEvent: (type: JourneyEventType, text: string, memoIds?: string[]) => void;
  onCraftObject: (type: WorldObjectType, fallbackText: string) => Promise<void>;
  onShip: () => Promise<void>;
  onOpenSettings: () => void;
  onExit: () => void;
}) {
  if (!action) return null;

  return (
    <section className={`farm-dialog farm-dialog--${action}`} aria-label="地点对话">
      <button type="button" className="farm-dialog-close" onClick={onClose} aria-label="关闭">
        <X size={15} />
      </button>

      {action === 'cabin' && (
        <>
          <p className="farm-speaker">亮灯木屋</p>
          <h2>{worldName} 今天开门了</h2>
          <p>先从一件小农活开始。带走一段记忆、浇水、酿造，最后把确认过的话出货到 InnerOS。</p>
          <div className="farm-dialog-actions">
            <button type="button" onClick={onOpenSettings}><Settings size={15} />设置外观</button>
            <button type="button" onClick={onExit}>睡觉并回到 InnerOS</button>
          </div>
        </>
      )}

      {action === 'bench' && (
        <>
          <p className="farm-speaker">门前长椅</p>
          <h2>今天和谁一起下田</h2>
          <div className="farm-choice-grid">
            <button type="button" className={companionType === 'none' ? 'is-selected' : ''} onClick={() => onCompanionTypeChange('none')}>
              <Moon size={18} />
              <span><strong>一个人</strong><small>不请求 AI，所有农活自己完成。</small></span>
            </button>
            <button type="button" className={companionType === 'llm' ? 'is-selected' : ''} onClick={() => onCompanionTypeChange('llm')}>
              <Lamp size={18} />
              <span><strong>苔灯同行</strong><small>只看你放进背包的记忆种子。</small></span>
            </button>
            <button type="button" className={companionType === 'human_local' ? 'is-selected' : ''} onClick={() => onCompanionTypeChange('human_local')}>
              <Leaf size={18} />
              <span><strong>同屏双人</strong><small>两名角色一起走，不创建新账户。</small></span>
            </button>
          </div>
        </>
      )}

      {action === 'memory' && (
        <>
          <p className="farm-speaker">记忆田埂</p>
          <h2>{selectedMemo ? '这是一粒可以带走的种子' : '田里还没有种子'}</h2>
          {selectedMemo ? (
            <>
              <MemoSelect memos={memos.slice(0, 8)} selectedId={selectedMemo.id} onSelect={onMemoSelect} />
              <blockquote>{formatMemoExcerpt(selectedMemo, 150)}</blockquote>
              <div className="farm-dialog-actions">
                <button type="button" onClick={() => onCarryMemo(selectedMemo)} disabled={carriedMemos.some((memo) => memo.id === selectedMemo.id)}>
                  <Backpack size={15} />
                  {carriedMemos.some((memo) => memo.id === selectedMemo.id) ? '已在背包' : '放进背包'}
                </button>
                {activeObject && (
                  <button type="button" onClick={() => void onCraftObject('sign', '给这段记忆插上一块木牌')}>
                    <ScrollText size={15} />
                    插木牌
                  </button>
                )}
              </div>
            </>
          ) : (
            <p>先在 InnerOS 写一条真实记录，明天这里会长出新的苗。</p>
          )}
        </>
      )}

      {action === 'cook' && (
        <>
          <p className="farm-speaker">篝火炉灶</p>
          <h2>给一粒记忆浇水</h2>
          <MemoSelect memos={(carriedMemos.length > 0 ? carriedMemos : memos).slice(0, 6)} selectedId={selectedMemo?.id ?? ''} onSelect={onMemoSelect} />
          <textarea
            value={fieldNote}
            onChange={(event) => onFieldNoteChange(event.target.value)}
            placeholder="现在我愿意承认的是..."
            rows={4}
          />
          <div className="farm-dialog-actions">
            <button
              type="button"
              disabled={!selectedMemo}
              onClick={() => {
                if (!selectedMemo) return;
                onAddEvent('fireside_note', fieldNote.trim() || '在火边给一段记忆浇了水', [selectedMemo.id]);
                onFieldNoteChange('');
                onClose();
              }}
            >
              <Flame size={15} />
              煮成火边汤
            </button>
          </div>
        </>
      )}

      {action === 'trail' && (
        <>
          <p className="farm-speaker">酿造桶</p>
          <h2>把两段记忆酿成关系</h2>
          <div className="farm-route-picks">
            {memos.slice(0, 8).map((memo) => (
              <button
                key={memo.id}
                type="button"
                className={routeIds.includes(memo.id) ? 'is-selected' : ''}
                onClick={() => onRouteMemoToggle(memo.id)}
              >
                <span>{routeIds.includes(memo.id) ? <Check size={13} /> : <Sprout size={13} />}</span>
                {formatMemoTitle(memo)}
              </button>
            ))}
          </div>
          <input
            value={routeName}
            onChange={(event) => onRouteNameChange(event.target.value)}
            placeholder="给这瓶关系果酱起个名字"
          />
          <div className="farm-dialog-actions">
            <button
              type="button"
              disabled={routeIds.length < 2}
              onClick={() => {
                onAddEvent('named_path', `酿成了「${routeName.trim() || '未命名关系果酱'}」`, routeIds);
                onRouteNameChange('');
                onClose();
              }}
            >
              酿成果酱
            </button>
            <button
              type="button"
              disabled={routeIds.length < 2}
              onClick={() => {
                onAddEvent('separated_path', '确认这几粒种子暂时不适合放进同一瓶', routeIds);
                onClose();
              }}
            >
              分开晾干
            </button>
          </div>
        </>
      )}

      {action === 'workshop' && (
        <>
          <p className="farm-speaker">木匠工坊</p>
          <h2>把今天的形状做成物件</h2>
          <MemoSelect memos={(carriedMemos.length > 0 ? carriedMemos : memos).slice(0, 6)} selectedId={selectedMemo?.id ?? ''} onSelect={onMemoSelect} />
          <textarea
            value={fieldNote}
            onChange={(event) => onFieldNoteChange(event.target.value)}
            rows={4}
            placeholder="这件物件提醒我..."
          />
          <div className="farm-dialog-actions">
            <button type="button" disabled={!selectedMemo || saving} onClick={() => void onCraftObject('frame', '做成一只相框')}>
              <Hammer size={15} />
              做成相框
            </button>
            <button type="button" disabled={!selectedMemo || saving} onClick={() => void onCraftObject('lamp', '做成一盏灯')}>
              <Lamp size={15} />
              做成灯
            </button>
          </div>
        </>
      )}

      {action === 'pond' && (
        <>
          <p className="farm-speaker">池塘码头</p>
          <h2>把一件事放进水里</h2>
          <textarea
            value={fieldNote}
            onChange={(event) => onFieldNoteChange(event.target.value)}
            rows={4}
            placeholder="这句话先漂三天，不进入 AI 分析..."
          />
          <div className="farm-pack-list">
            {carriedMemos.map((memo) => (
              <button key={memo.id} type="button" onClick={() => onRemoveFromBag(memo.id)}>
                <Waves size={14} />
                放下 {formatMemoTitle(memo)}
              </button>
            ))}
          </div>
          <div className="farm-dialog-actions">
            <button
              type="button"
              onClick={() => {
                onAddEvent('pond_release', fieldNote.trim() || '在池边放下了一点不必解释的东西');
                onFieldNoteChange('');
                onClose();
              }}
            >
              投进漂流瓶
            </button>
          </div>
        </>
      )}

      {action === 'desk' && (
        <>
          <p className="farm-speaker">出货箱</p>
          <h2>睡前写回 InnerOS</h2>
          <textarea
            value={shipText}
            onChange={(event) => onShipTextChange(event.target.value)}
            rows={5}
            placeholder="今天我确认..."
          />
          <div className="farm-dialog-actions">
            <button type="button" disabled={!shipText.trim() || saving} onClick={() => void onShip()}>
              {saving ? '出货中...' : '出货到 InnerOS'}
            </button>
          </div>
        </>
      )}

      {action === 'object' && (
        <>
          <p className="farm-speaker">世界物件</p>
          <h2>{objectLabel(activePlacedObject?.type ?? 'frame')}</h2>
          <blockquote>{activePlacedObject?.annotation || '这个物件还没有标记。'}</blockquote>
          <p>它来自 {activePlacedObject?.sourceMemoIds.length ?? 0} 段记忆。</p>
        </>
      )}
    </section>
  );
}

function MemoSelect({
  memos,
  selectedId,
  onSelect,
}: {
  memos: Memo[];
  selectedId: string;
  onSelect: (memoId: string) => void;
}) {
  if (memos.length === 0) return <p className="farm-empty-line">还没有可用的记忆种子。</p>;
  return (
    <div className="farm-memo-strip" aria-label="选择记忆">
      {memos.map((memo) => (
        <button
          key={memo.id}
          type="button"
          className={memo.id === selectedId ? 'is-selected' : ''}
          onClick={() => onSelect(memo.id)}
        >
          <strong>{formatMemoTitle(memo)}</strong>
          <small>{new Date(memo.created_at).toLocaleDateString('zh-CN')}</small>
        </button>
      ))}
    </div>
  );
}

function formatMemoTitle(memo: Memo): string {
  return memo.ai_title || memo.plain_text.replace(/\s+/g, ' ').slice(0, 18) || '未命名种子';
}

function formatMemoExcerpt(memo: Memo, limit = 120): string {
  const text = memo.plain_text.replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text || '这粒种子还没有留下文字。';
}

function objectLabel(type: WorldObjectType): string {
  const labels: Record<WorldObjectType, string> = {
    memory_plant: '记忆苗',
    letter: '信件',
    lamp: '灯',
    bench: '长椅',
    sign: '木牌',
    bottle: '瓶子',
    windchime: '风铃',
    frame: '相框',
    empty_pot: '空盆',
  };
  return labels[type];
}
