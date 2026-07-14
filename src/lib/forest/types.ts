export const FOREST_DAY_OPTIONS = [30, 90, 180, 365] as const;

export type ForestDayOption = (typeof FOREST_DAY_OPTIONS)[number];
export type ForestWindowRequest = ForestDayOption | 'auto';

export type ForestNodeId =
  | 'lantern-cabin'
  | 'year-ring-path'
  | 'echo-hearth'
  | 'twin-shadow-pond'
  | 'root-court'
  | 'windwatch-terrace';

export type ForestDataState = 'empty' | 'sparse' | 'ready';
export type ForestFreshnessState = 'empty' | 'fresh' | 'quiet' | 'stale';
export type ForestObservationKind =
  | 'memo-signal'
  | 'memory-candidate'
  | 'insight-candidate';

export interface ForestEvidence {
  memoId: string;
  title: string;
  recordedAt: string;
  snippet: string;
}

export interface ForestObservation {
  id: string;
  kind: ForestObservationKind;
  label: string;
  detail: string;
  count: number;
  evidenceMemoIds: string[];
}

export interface ForestConnection {
  toNodeId: ForestNodeId;
  sharedMemoCount: number;
  evidenceMemoIds: string[];
  note: string;
}

export interface ForestEmotionLanternVisualization {
  kind: 'emotion-lanterns';
  periodSplitAt: string;
  emotions: Array<{
    label: string;
    count: number;
    earlierCount: number;
    laterCount: number;
    share: number;
    evidenceMemoIds: string[];
  }>;
}

export interface ForestYearRingsVisualization {
  kind: 'year-rings';
  granularity: 'week' | 'month';
  rings: Array<{
    key: string;
    label: string;
    memoCount: number;
    emotionMemoCount: number;
    topicMemoCount: number;
    evidenceMemoIds: string[];
  }>;
  recurringTopics: Array<{
    label: string;
    count: number;
    firstAt: string;
    latestAt: string;
    evidenceMemoIds: string[];
  }>;
}

export interface ForestEchoClustersVisualization {
  kind: 'echo-clusters';
  entities: Array<{
    entityType: 'person' | 'project';
    label: string;
    count: number;
    latestAt: string;
    evidenceMemoIds: string[];
  }>;
  coAppearances: Array<{
    labels: [string, string];
    count: number;
    evidenceMemoIds: string[];
  }>;
}

export interface ForestTwinRipplesVisualization {
  kind: 'twin-ripples';
  tensions: Array<{
    left: string;
    right: string;
    commonGround: string;
    source: 'memory-update' | 'memory-contradiction' | 'risk-candidate';
    evidenceMemoIds: string[];
  }>;
}

export interface ForestRootNetworkVisualization {
  kind: 'root-network';
  roots: Array<{
    id: string;
    memoryType: 'belief' | 'pattern' | 'preference' | 'constraint' | 'state';
    title: string;
    status: string;
    confidence: number;
    lastConfirmedAt: string;
    evidenceMemoIds: string[];
  }>;
  links: Array<{
    sourceId: string;
    targetId: string;
    sharedMemoCount: number;
    evidenceMemoIds: string[];
  }>;
}

export interface ForestWindCompassVisualization {
  kind: 'wind-compass';
  directions: Array<{
    id: string;
    directionType: 'goal' | 'project' | 'action';
    label: string;
    count: number;
    status: string;
    latestAt: string;
      evidenceMemoIds: string[];
  }>;
  openQuestions: Array<{
    text: string;
    recordedAt: string;
    memoId: string;
  }>;
}

export type ForestVisualization =
  | ForestEmotionLanternVisualization
  | ForestYearRingsVisualization
  | ForestEchoClustersVisualization
  | ForestTwinRipplesVisualization
  | ForestRootNetworkVisualization
  | ForestWindCompassVisualization;

export interface ForestNode {
  id: ForestNodeId;
  name: string;
  purpose: string;
  sampleSize: number;
  dataState: ForestDataState;
  summary: string;
  observations: ForestObservation[];
  evidence: ForestEvidence[];
  connections: ForestConnection[];
  visualization: ForestVisualization;
}

export interface ForestTaskChoice {
  observationId: string;
  label: string;
  updatedAt: string;
}

export interface ForestProfile {
  playerX: number;
  playerY: number;
  characterId: 'wanderer' | 'drifter';
  activeWindow: ForestWindowRequest;
  visitedNodeIds: ForestNodeId[];
  taskChoices: Partial<Record<ForestNodeId, ForestTaskChoice>>;
  updatedAt: string | null;
  persistent: boolean;
}

export interface ForestViewer {
  name: string;
  username: string;
}

export interface ForestAtlas {
  version: 'forest-atlas-v1';
  generatedAt: string;
  window: {
    requested: ForestWindowRequest;
    actualDays: ForestDayOption;
    from: string;
    to: string;
    targetMemoCount: number;
    memoCount: number;
    expanded: boolean;
  };
  freshness: {
    latestMemoAt: string | null;
    daysSinceLatest: number | null;
    state: ForestFreshnessState;
  };
  coverage: {
    memoCount: number;
    analyzedMemoCount: number;
    emotionMemoCount: number;
    topicMemoCount: number;
    peopleMemoCount: number;
    projectMemoCount: number;
    actionMemoCount: number;
    questionMemoCount: number;
    memoryCandidateCount: number;
    insightCandidateCount: number;
  };
  nodes: ForestNode[];
}
