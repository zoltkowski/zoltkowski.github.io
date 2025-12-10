export type PointStyle = { color: string; size: number; hidden?: boolean };

export type MidpointMeta = {
  parents: [string, string];
  parentLineId?: string | null;
};

export type SymmetricMeta = {
  source: string;
  mirror: { kind: 'point'; id: string } | { kind: 'line'; id: string };
};

export type ParallelLineMeta = {
  throughPoint: string;
  referenceLine: string;
  helperPoint: string;
};

export type PerpendicularLineMeta = {
  throughPoint: string;
  referenceLine: string;
  helperPoint: string;
  helperDistance?: number;
  helperOrientation?: 1 | -1;
  helperMode?: 'projection' | 'normal';
};

export type LineConstructionKind = 'free' | 'parallel' | 'perpendicular';

type GeometryKind = 'point' | 'line' | 'circle' | 'angle' | 'polygon';
export type GeoObjectType = GeometryKind;

export type GeometryContext = { model: Model };

type TickLevel = 0 | 1 | 2 | 3;

export type StrokeStyle = {
  color: string;
  width: number;
  type: 'solid' | 'dashed' | 'dotted';
  hidden?: boolean;
  tick?: TickLevel;
};

export type AngleStyle = {
  color: string;
  width: number;
  type: 'solid' | 'dashed' | 'dotted';
  fill?: string;
  arcCount?: number;
  right?: boolean;
  exterior?: boolean;
  hidden?: boolean;
  arcRadiusOffset?: number;
  tick?: TickLevel;
};

export type Label = {
  text: string;
  offset?: { x: number; y: number };
  color?: string;
  hidden?: boolean;
  fontSize?: number;
  seq?: { kind: 'upper' | 'lower' | 'greek'; idx: number };
};

export type CopiedStyle = {
  sourceType: 'point' | 'line' | 'circle' | 'angle' | 'ink';
  color?: string;
  width?: number;
  type?: 'solid' | 'dashed' | 'dotted';
  size?: number;
  arcCount?: number;
  right?: boolean;
  fill?: string;
  arcRadiusOffset?: number;
  baseWidth?: number;
  tick?: TickLevel;
};
export type FreeLabel = {
  text: string;
  pos: { x: number; y: number };
  color?: string;
  hidden?: boolean;
  fontSize?: number;
  seq?: Label['seq'];
};

export type MeasurementLabel = {
  id: string;
  kind: 'segment' | 'angle';
  targetId: string; // line id + segment index or angle id
  pos: { x: number; y: number };
  pinned: boolean; // true = converted to permanent label
  color?: string;
  fontSize?: number;
};

const LINE_SNAP_SIN_ANGLE = Math.sin((5 * Math.PI) / 180);
const LINE_SNAP_BLEND_STRENGTH = 0.25;
const LINE_SNAP_FULL_THRESHOLD = 0.9;
const LINE_SNAP_INDICATOR_THRESHOLD = LINE_SNAP_FULL_THRESHOLD;
const ANGLE_RADIUS_STEP = 1;
const ANGLE_DEFAULT_RADIUS = 28;
const ANGLE_MIN_RADIUS = 1;
const ANGLE_RADIUS_MARGIN = 6;
const ANGLE_RADIUS_EPSILON = 0.5;
const RIGHT_ANGLE_MARK_MIN = 4;
const RIGHT_ANGLE_MARK_RATIO = 0.65;
const RIGHT_ANGLE_MARK_MAX = 200;
const RIGHT_ANGLE_MARK_MARGIN = 4;
const LABEL_FONT_DEFAULT = 12;
const getLabelFontDefault = () => THEME.fontSize || LABEL_FONT_DEFAULT;
const LABEL_FONT_MIN = 4;
const LABEL_FONT_MAX = 100;
const LABEL_FONT_STEP = 1;
const TICK_LENGTH_UNITS = 12;
const TICK_SPACING_UNITS = 8;
const TICK_MARGIN_UNITS = 4;

function axisSnapWeight(closeness: number) {
  if (closeness >= LINE_SNAP_FULL_THRESHOLD) return 1;
  if (closeness <= 0) return 0;
  return Math.min(1, closeness * closeness * LINE_SNAP_BLEND_STRENGTH);
}

// PUNKT
export type ConstructionParent = { kind: 'line' | 'circle'; id: string };
export type PointConstructionKind = 'free' | 'on_object' | 'intersection' | 'midpoint' | 'symmetric';
export interface GeoObject {
  id: string;
  object_type: GeoObjectType;
  construction_kind: string;
  defining_parents: string[];
  children: string[];
  recompute(ctx: GeometryContext): void;
  on_parent_deleted(parent_id: string, ctx: GeometryContext): void;
}
export type Point = GeoObject & {
  object_type: 'point';
  x: number;
  y: number;
  style: PointStyle;
  label?: Label;
  construction_kind: PointConstructionKind;
  parent_refs: ConstructionParent[];
  incident_objects: Set<string>;
  midpoint?: MidpointMeta;
  symmetric?: SymmetricMeta;
  parallel_helper_for?: string;
  perpendicular_helper_for?: string;
};

export type MidpointPoint = Point & { construction_kind: 'midpoint'; midpoint: MidpointMeta };
export type SymmetricPoint = Point & { construction_kind: 'symmetric'; symmetric: SymmetricMeta };

// PROSTA
export type Line = GeoObject & {
  object_type: 'line';
  points: number[]; // ALL points lying on the line, ordered by position along the line direction
  defining_points: [number, number]; // The two points that define/control the line's position and orientation
                                     // They can move freely and change the line. Other points in 'points' 
                                     // are constrained to stay on the line defined by these two points.
  segmentStyles?: StrokeStyle[]; // optional per-segment styles, length = points.length - 1
  segmentKeys?: string[]; // stable mapping for segmentStyles, based on point ids
  leftRay?: StrokeStyle;  // Ray extending from points[0] (leftmost point), NOT necessarily defining_points[0]
  rightRay?: StrokeStyle; // Ray extending from points[last] (rightmost point), NOT necessarily defining_points[1]
  style: StrokeStyle;
  label?: Label;
  hidden?: boolean;
  construction_kind: LineConstructionKind;
  parallel?: ParallelLineMeta;
  perpendicular?: PerpendicularLineMeta;
};

export type Model = {
  points: Point[];
  lines: Line[];
  circles: Circle[];
  angles: Angle[];
  polygons: Polygon[];
  inkStrokes: InkStroke[];
  labels: FreeLabel[];
  idCounters: Record<GeometryKind, number>;
  indexById: Record<GeometryKind, Record<string, number>>;
};

export const createEmptyModel = (): Model => ({
  points: [],
  lines: [],
  circles: [],
  angles: [],
  polygons: [],
  inkStrokes: [],
  labels: [],
  idCounters: {
    point: 0,
    line: 0,
    circle: 0,
    angle: 0,
    polygon: 0
  },
  indexById: {
    point: {},
    line: {},
    circle: {},
    angle: {},
    polygon: {}
  }
});

const ID_PREFIX: Record<GeometryKind, string> = {
  point: 'pt',
  line: 'ln',
  circle: 'c',
  angle: 'ang',
  polygon: 'poly'
};
const LABEL_PREFIX: Record<GeometryKind, string> = {
  point: 'P',
  line: 'L',
  circle: 'O',
  angle: '∠',
  polygon: 'W'
};

const segmentKeyForPoints = (aIdx: number, bIdx: number) => {
  const pa = model.points[aIdx];
  const pb = model.points[bIdx];
  const aid = pa?.id ?? `p${aIdx}`;
  const bid = pb?.id ?? `p${bIdx}`;
  return aid < bid ? `${aid}-${bid}` : `${bid}-${aid}`;
};

function nextId(kind: GeometryKind, target: Model = model) {
  target.idCounters[kind] += 1;
  return `${ID_PREFIX[kind]}${target.idCounters[kind]}`;
}

function registerIndex(target: Model, kind: GeometryKind, id: string, idx: number) {
  target.indexById[kind][id] = idx;
}

function rebuildIndexMaps(target: Model = model) {
  target.indexById = {
    point: {},
    line: {},
    circle: {},
    angle: {},
    polygon: {}
  };
  target.points.forEach((p, i) => registerIndex(target, 'point', p.id, i));
  target.lines.forEach((l, i) => registerIndex(target, 'line', l.id, i));
  target.circles.forEach((c, i) => registerIndex(target, 'circle', c.id, i));
  target.angles.forEach((a, i) => registerIndex(target, 'angle', a.id, i));
  target.polygons.forEach((p, i) => registerIndex(target, 'polygon', p.id, i));
}

type PointInit = Omit<
  Point,
  | 'style'
  | 'construction_kind'
  | 'defining_parents'
  | 'id'
  | 'object_type'
  | 'parent_refs'
  | 'incident_objects'
  | 'children'
  | 'recompute'
  | 'on_parent_deleted'
> & {
  style?: PointStyle;
  construction_kind?: PointConstructionKind;
  defining_parents?: ConstructionParent[];
  id?: string;
};

const normalizeParents = (parents?: ConstructionParent[]): ConstructionParent[] => {
  const res: ConstructionParent[] = [];
  parents?.forEach((p) => {
    if (!p) return;
    if (p.kind !== 'line' && p.kind !== 'circle') return;
    if (typeof p.id !== 'string' || !p.id.length) return;
    if (!res.some((r) => r.kind === p.kind && r.id === p.id)) res.push({ kind: p.kind, id: p.id });
  });
  return res;
};

const resolveConstructionKind = (
  parents: ConstructionParent[],
  explicit?: PointConstructionKind
): PointConstructionKind => {
  if (explicit) return explicit;
  if (parents.length >= 2) return 'intersection';
  if (parents.length === 1) return 'on_object';
  return 'free';
};

const isMidpointPoint = (point: Point | null | undefined): point is MidpointPoint =>
  !!point && point.construction_kind === 'midpoint' && !!point.midpoint;

const isSymmetricPoint = (point: Point | null | undefined): point is SymmetricPoint =>
  !!point && point.construction_kind === 'symmetric' && !!point.symmetric;

const isPointDraggable = (point: Point | null | undefined): boolean => {
  if (!point) return false;
  if (point.construction_kind === 'intersection') return false;
  if (point.construction_kind === 'midpoint') return false;
  if (point.construction_kind === 'symmetric') return false;
  
  // Check if point is center of a three-point circle (computed center, not draggable)
  const pointIdx = model.points.indexOf(point);
  if (pointIdx >= 0) {
    const isThreePointCenter = model.circles.some(c => 
      isCircleThroughPoints(c) && c.center === pointIdx
    );
    if (isThreePointCenter) return false;
  }
  
  return true;
};

const isDefiningPointOfLine = (pointIdx: number, lineIdx: number): boolean => {
  const line = model.lines[lineIdx];
  return !!line && line.defining_points.includes(pointIdx);
};

type ParallelLine = Line & { construction_kind: 'parallel'; parallel: ParallelLineMeta };
type PerpendicularLine = Line & { construction_kind: 'perpendicular'; perpendicular: PerpendicularLineMeta };

const isParallelLine = (line: Line | null | undefined): line is ParallelLine =>
  !!line && line.construction_kind === 'parallel' && !!line.parallel;

const isPerpendicularLine = (line: Line | null | undefined): line is PerpendicularLine =>
  !!line && line.construction_kind === 'perpendicular' && !!line.perpendicular;

const isLineDraggable = (line: Line | null | undefined): boolean =>
  !line || (line.construction_kind !== 'parallel' && line.construction_kind !== 'perpendicular');

export const addPoint = (model: Model, p: PointInit): number => {
  const { style: maybeStyle, construction_kind, defining_parents, id, ...rest } = p;
  const style: PointStyle = maybeStyle ?? { color: '#ffffff', size: 4 };
  const parents = normalizeParents(defining_parents);
  const pid = id ?? nextId('point', model);
  const point: Point = {
    object_type: 'point',
    id: pid,
    ...rest,
    style,
    defining_parents: parents.map((pr) => pr.id),
    parent_refs: parents,
    incident_objects: new Set<string>(),
    children: [],
    construction_kind: resolveConstructionKind(parents, construction_kind),
    recompute: () => {},
    on_parent_deleted: () => {}
  };
  model.points.push(point);
  registerIndex(model, 'point', pid, model.points.length - 1);
  return model.points.length - 1;
};

export const addLineFromPoints = (model: Model, a: number, b: number, style: StrokeStyle): number => {
  const id = nextId('line', model);
  const line: Line = {
    object_type: 'line',
    id,
    points: [a, b],
    defining_points: [a, b],
    segmentStyles: [style],
    segmentKeys: [segmentKeyForPoints(a, b)],
    style,
    leftRay: { ...style, hidden: true },
    rightRay: { ...style, hidden: true },
    construction_kind: 'free',
    defining_parents: [],
    children: [],
    recompute: () => {},
    on_parent_deleted: () => {}
  };
    model.lines.push(line);
  registerIndex(model, 'line', id, model.lines.length - 1);
  return model.lines.length - 1;
};

// OKRĄG
type CircleBase = GeoObject & {
  object_type: 'circle';
  center: number;
  radius_point: number;
  points: number[]; // points constrained to lie on the circumference
  style: StrokeStyle;
  arcStyles?: StrokeStyle[];
  label?: Label;
  hidden?: boolean;
};

export type CircleWithCenter = CircleBase & {
  circle_kind: 'center-radius';
};

export type CircleThroughPoints = CircleBase & {
  circle_kind: 'three-point';
  defining_points: [number, number, number];
};

export type Circle = CircleWithCenter | CircleThroughPoints;

// KĄT
export type Angle = GeoObject & {
  object_type: 'angle';
  leg1: { line: number; seg: number };
  leg2: { line: number; seg: number };
  vertex: number;
  style: AngleStyle;
  label?: Label;
  hidden?: boolean;
};

export type Polygon = GeoObject & {
  object_type: 'polygon';
  lines: number[];
};

type InkPoint = {
  x: number;
  y: number;
  pressure: number;
  time: number;
};

type InkStroke = {
  id: string;
  points: InkPoint[];
  color: string;
  baseWidth: number;
  hidden?: boolean;
};

const isCircleThroughPoints = (circle: Circle): circle is CircleThroughPoints => circle.circle_kind === 'three-point';

const circleDefiningPoints = (circle: Circle): number[] => (isCircleThroughPoints(circle) ? circle.defining_points : []);

const circlePerimeterPoints = (circle: Circle): number[] => {
  const result: number[] = [];
  const seen = new Set<number>();
  const pushUnique = (idx: number) => {
    if (idx === circle.center) return;
    if (!seen.has(idx)) {
      seen.add(idx);
      result.push(idx);
    }
  };
  pushUnique(circle.radius_point);
  circle.points.forEach(pushUnique);
  circleDefiningPoints(circle).forEach(pushUnique);
  return result;
};

const circleRadius = (circle: Circle): number => {
  const center = model.points[circle.center];
  const radiusPt = model.points[circle.radius_point];
  if (!center || !radiusPt) return 0;
  return Math.hypot(radiusPt.x - center.x, radiusPt.y - center.y);
};

const circleRadiusVector = (circle: Circle): { x: number; y: number } | null => {
  const center = model.points[circle.center];
  const radiusPt = model.points[circle.radius_point];
  if (!center || !radiusPt) return null;
  return { x: radiusPt.x - center.x, y: radiusPt.y - center.y };
};

const circleHasDefiningPoint = (circle: Circle, pointIdx: number): boolean =>
  isCircleThroughPoints(circle) && circle.defining_points.includes(pointIdx);

type Mode =
  | 'move'
  | 'add'
  | 'segment'
  | 'parallel'
  | 'perpendicular'
  | 'circle'
  | 'circleThree'
  | 'triangleUp'
  | 'square'
  | 'polygon'
  | 'angle'
  | 'bisector'
  | 'midpoint'
  | 'symmetric'
  | 'parallelLine'
  | 'ngon'
  | 'label'
  | 'handwriting'
  | 'multiselect';

const dpr = window.devicePixelRatio || 1;
const HIT_RADIUS = 16;
const HANDLE_SIZE = 16;
const DEFAULT_COLORS_DARK = ['#15a3ff', '#ff4d4f', '#22c55e', '#f59e0b', '#a855f7', '#0ea5e9'];
const DEFAULT_COLORS_LIGHT = ['#000000', '#404040', '#808080', '#bfbfbf'];
type ThemeName = 'dark' | 'light';
type ThemeConfig = {
  palette: readonly string[];
  defaultStroke: string;
  highlight: string;
  preview: string;
  pointSize: number;
  lineWidth: number;
  angleStrokeWidth: number;
  angleDefaultRadius: number;
  midpointColor: string;
  bg: string;
  fontSize: number;
  highlightWidth: number;
  panel: string;
  panelBorder: string;
};

const THEME_PRESETS: Record<ThemeName, ThemeConfig> = {
  dark: {
    palette: DEFAULT_COLORS_DARK,
    defaultStroke: DEFAULT_COLORS_DARK[0],
    highlight: '#fbbf24',
    preview: '#22c55e',
    pointSize: 2,
    lineWidth: 2,
    angleStrokeWidth: 2,
    angleDefaultRadius: 28,
    midpointColor: '#9ca3af',
    bg: '#111827',
    fontSize: 12,
    highlightWidth: 1.5
    ,panel: '#111827ef',
    panelBorder: '#1f2937'
  },
  light: {
    palette: DEFAULT_COLORS_LIGHT,
    defaultStroke: DEFAULT_COLORS_LIGHT[0],
    highlight: '#555555',
    preview: DEFAULT_COLORS_LIGHT[0],
    pointSize: 2,
    lineWidth: 2,
    angleStrokeWidth: 2,
    angleDefaultRadius: 28,
    midpointColor: '#737373',
    bg: '#ffffff',
    fontSize: 12,
    highlightWidth: 1.5
    ,panel: 'transparent',
    panelBorder: 'transparent'
  }
};

const THEME: ThemeConfig = { ...THEME_PRESETS.dark };
let currentTheme: ThemeName = 'dark';
const THEME_STORAGE_KEY = 'geometry.theme';

const normalizeThemeName = (value: string | null | undefined): ThemeName | null => {
  if (value === 'dark' || value === 'light') return value;
  if (value === 'default') return 'dark';
  if (value === 'eink') return 'light';
  return null;
};
if (typeof window !== 'undefined') {
  try {
    const storedTheme = normalizeThemeName(window.localStorage?.getItem(THEME_STORAGE_KEY));
    if (storedTheme) currentTheme = storedTheme;
  } catch {
    // ignore storage access issues
  }
}
const HIGHLIGHT_LINE = { color: THEME.highlight, width: 1.5, dash: [4, 4] as [number, number] };
const LABEL_HIT_RADIUS = 18;
const DEBUG_PANEL_MARGIN = { x: 12, y: 12 };
const DEBUG_PANEL_TOP_MIN = 56;

// User-customizable theme overrides
type ThemeOverrides = Partial<ThemeConfig>;
const themeOverrides: Record<ThemeName, ThemeOverrides> = {
  dark: {},
  light: {}
};

// Load theme overrides from localStorage
const THEME_OVERRIDES_KEY = 'geometry.themeOverrides';
function loadThemeOverrides() {
  try {
    const stored = localStorage.getItem(THEME_OVERRIDES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.dark) themeOverrides.dark = parsed.dark;
      if (parsed.light) themeOverrides.light = parsed.light;
    }
  } catch {
    // ignore
  }
}

function saveThemeOverrides() {
  try {
    localStorage.setItem(THEME_OVERRIDES_KEY, JSON.stringify(themeOverrides));
  } catch {
    // ignore
  }
}

if (typeof window !== 'undefined') {
  loadThemeOverrides();
}

function applyThemeWithOverrides(theme: ThemeName) {
  const base = THEME_PRESETS[theme];
  const overrides = themeOverrides[theme];
  Object.assign(THEME, base, overrides);
  // Apply panel colors to CSS variables so modals/debug use the same panel color
  if (typeof document !== 'undefined') {
    try {
      const root = document.documentElement;
      const body = document.body;
      const panelVal = THEME.panel ?? base.panel;
      const panelBorderVal = THEME.panelBorder ?? base.panelBorder;
      root.style.setProperty('--panel', panelVal);
      root.style.setProperty('--panel-border', panelBorderVal);
      if (body) {
        body.style.setProperty('--panel', panelVal);
        body.style.setProperty('--panel-border', panelBorderVal);
      }
    } catch {}
  }
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let model: Model = createEmptyModel();

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const clampLabelFontSize = (value: number) => clamp(value, LABEL_FONT_MIN, LABEL_FONT_MAX);
const normalizeLabelFontSize = (value?: number): number => {
  if (!Number.isFinite(value ?? NaN)) return LABEL_FONT_DEFAULT;
  const rounded = Math.round(value!);
  const snapped = LABEL_FONT_MIN + Math.round((rounded - LABEL_FONT_MIN) / LABEL_FONT_STEP) * LABEL_FONT_STEP;
  return clampLabelFontSize(snapped);
};

const mergeParents = (existing: ConstructionParent[] = [], incoming: ConstructionParent[] = []) =>
  normalizeParents([...(existing ?? []), ...incoming]);

function applyPointConstruction(pointIdx: number, parents: ConstructionParent[]) {
  const point = model.points[pointIdx];
  if (!point) return;
  const merged = mergeParents(point.parent_refs, parents);
  const construction_kind = isMidpointPoint(point)
    ? 'midpoint'
    : isSymmetricPoint(point)
    ? 'symmetric'
    : resolveConstructionKind(merged);
  model.points[pointIdx] = {
    ...point,
    parent_refs: merged,
    defining_parents: merged.map((p) => p.id),
    construction_kind
  };
}

let selectedPointIndex: number | null = null;
let selectedLineIndex: number | null = null;
let selectedCircleIndex: number | null = null;
let selectedAngleIndex: number | null = null;
let selectedPolygonIndex: number | null = null;
let selectedInkStrokeIndex: number | null = null;
let selectedLabel: { kind: 'point' | 'line' | 'angle' | 'free'; id: number } | null = null;
const selectedSegments = new Set<string>();
const selectedArcSegments = new Set<string>();

// Multi-selection
const multiSelectedPoints = new Set<number>();
const multiSelectedLines = new Set<number>();
const multiSelectedCircles = new Set<number>();
const multiSelectedAngles = new Set<number>();
const multiSelectedPolygons = new Set<number>();
const multiSelectedInkStrokes = new Set<number>();
let multiselectBoxStart: { x: number; y: number } | null = null;
let multiselectBoxEnd: { x: number; y: number } | null = null;

let mode: Mode = 'move';
let segmentStartIndex: number | null = null;
let segmentStartTemporary = false;
let circleCenterIndex: number | null = null;
let triangleStartIndex: number | null = null;
let squareStartIndex: number | null = null;
let ngonSecondIndex: number | null = null;
let polygonChain: number[] = [];
let angleFirstLeg: { line: number; seg: number; a: number; b: number } | null = null;
let anglePoints: number[] = [];
let bisectorFirstLeg: { line: number; seg: number; a: number; b: number; vertex: number } | null = null;
let midpointFirstIndex: number | null = null;
let symmetricSourceIndex: number | null = null;
let parallelAnchorPointIndex: number | null = null;
let parallelReferenceLineIndex: number | null = null;
let ngonSides = 9;
let currentPolygonLines: number[] = [];
let hoverPointIndex: number | null = null;
let strokeColorInput: HTMLInputElement | null = null;
let modeAddBtn: HTMLButtonElement | null = null;
let modeMoveBtn: HTMLButtonElement | null = null;
let modeMultiselectBtn: HTMLButtonElement | null = null;
let modeSegmentBtn: HTMLButtonElement | null = null;
let modeParallelBtn: HTMLButtonElement | null = null;
let modePerpBtn: HTMLButtonElement | null = null;
let modeCircleThreeBtn: HTMLButtonElement | null = null;
let modeTriangleBtn: HTMLButtonElement | null = null;
let modeSquareBtn: HTMLButtonElement | null = null;
let modePolygonBtn: HTMLButtonElement | null = null;
let modeAngleBtn: HTMLButtonElement | null = null;
let modeBisectorBtn: HTMLButtonElement | null = null;
let modeMidpointBtn: HTMLButtonElement | null = null;
let modeSymmetricBtn: HTMLButtonElement | null = null;
let modeParallelLineBtn: HTMLButtonElement | null = null;
let modeNgonBtn: HTMLButtonElement | null = null;
let ngonModal: HTMLElement | null = null;
let ngonCloseBtn: HTMLButtonElement | null = null;
let ngonConfirmBtn: HTMLButtonElement | null = null;
let ngonInput: HTMLInputElement | null = null;
let ngonPresetButtons: HTMLButtonElement[] = [];
let modeLabelBtn: HTMLButtonElement | null = null;
let modeHandwritingBtn: HTMLButtonElement | null = null;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let panOffset = { x: 0, y: 0 };
let panStartOffset = { x: 0, y: 0 };
let pendingPanCandidate: { x: number; y: number } | null = null;
let zoomFactor = 1;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
type TouchPoint = { x: number; y: number };
const activeTouches = new Map<number, TouchPoint>();

type ActiveInkStroke = {
  pointerId: number;
  stroke: InkStroke;
};

const INK_BASE_WIDTH = 3;
let inkBaseWidth = INK_BASE_WIDTH;
const INK_PRESSURE_FALLBACK = 0.6;
const INK_MIN_SAMPLE_PX = 0.6;
let activeInkStroke: ActiveInkStroke | null = null;
type PinchState = {
  pointerIds: [number, number];
  initialDistance: number;
  initialZoom: number;
};
let pinchState: PinchState | null = null;
type CircleDragContext = {
  circleIdx: number;
  originals: Map<number, { x: number; y: number }>;
  dependentLines?: Map<number, number[]>;
};
type PolygonDragContext = {
  polygonIdx: number;
  dependentLines: Map<number, number[]>;
};
let circleDragContext: CircleDragContext | null = null;
let polygonDragContext: PolygonDragContext | null = null;
let draggingSelection = false;
let measurementScale: number | null = null; // pixels per unit
let measurementReferenceSegment: { lineIdx: number; segIdx: number } | null = null;
let measurementReferenceValue: number | null = null; // user's reference value (e.g., "5" if segment is 5 units)
let measurementLabels: MeasurementLabel[] = [];
let measurementLabelIdCounter = 0;
let editingMeasurementLabel: string | null = null; // ID of the label being edited
let measurementInputBox: HTMLInputElement | null = null;
let measurementPrecisionLength: number = 0; // decimal places for lengths
let measurementPrecisionAngle: number = 0; // decimal places for angles
let draggingMultiSelection = false;
let dragStart = { x: 0, y: 0 };
type ResizeContext = {
  lineIdx: number;
  center: { x: number; y: number };
  dir: { x: number; y: number };
  vectors: { idx: number; vx: number; vy: number }[];
  baseHalf: number;
  lines: number[];
};
let resizingLine: ResizeContext | null = null;
let lineDragContext: { lineIdx: number; fractions: number[] } | null = null;
let stickyTool: Mode | null = null;
let viewModeToggleBtn: HTMLButtonElement | null = null;
let selectionVertices = false;
let selectionEdges = true;
let rayModeToggleBtn: HTMLButtonElement | null = null;
let viewModeMenuContainer: HTMLElement | null = null;
let rayModeMenuContainer: HTMLElement | null = null;
let raySegmentBtn: HTMLButtonElement | null = null;
let rayRightBtn: HTMLButtonElement | null = null;
let rayLeftBtn: HTMLButtonElement | null = null;
let debugToggleBtn: HTMLButtonElement | null = null;
let debugPanel: HTMLElement | null = null;
let debugPanelHeader: HTMLElement | null = null;
let debugCloseBtn: HTMLButtonElement | null = null;
let debugContent: HTMLElement | null = null;
let debugVisible = false;
let debugPanelPos: { x: number; y: number } | null = null;
type DebugDragState = {
  pointerId: number;
  start: { x: number; y: number };
  panelStart: { x: number; y: number };
};
let debugDragState: DebugDragState | null = null;
let styleEdgesRow: HTMLElement | null = null;
let viewModeOpen = false;
let rayModeOpen = false;
let hideBtn: HTMLButtonElement | null = null;
let deleteBtn: HTMLButtonElement | null = null;
let copyStyleBtn: HTMLButtonElement | null = null;
let copyStyleActive = false;
let copiedStyle: CopiedStyle | null = null;
let multiMoveBtn: HTMLButtonElement | null = null;
let multiCloneBtn: HTMLButtonElement | null = null;
let multiMoveActive = false;
let showHidden = false;
let showMeasurements = false;
let zoomMenuBtn: HTMLButtonElement | null = null;
let zoomMenuContainer: HTMLElement | null = null;
let zoomMenuOpen = false;
let zoomMenuDropdown: HTMLElement | null = null;
let showHiddenBtn: HTMLButtonElement | null = null;
let showMeasurementsBtn: HTMLButtonElement | null = null;
let copyImageBtn: HTMLButtonElement | null = null;
let saveImageBtn: HTMLButtonElement | null = null;
let clearAllBtn: HTMLButtonElement | null = null;
let exportJsonBtn: HTMLButtonElement | null = null;
let importJsonBtn: HTMLButtonElement | null = null;
let importJsonInput: HTMLInputElement | null = null;
let themeDarkBtn: HTMLButtonElement | null = null;
let undoBtn: HTMLButtonElement | null = null;
let redoBtn: HTMLButtonElement | null = null;
let styleMenuBtn: HTMLButtonElement | null = null;
let styleMenuContainer: HTMLElement | null = null;
let styleMenuDropdown: HTMLElement | null = null;
let styleMenuOpen = false;

let eraserBtn: HTMLButtonElement | null = null;
let eraserActive = false;

let styleMenuSuppressed = false;
let styleColorRow: HTMLElement | null = null;
let styleWidthRow: HTMLElement | null = null;
let styleTypeRow: HTMLElement | null = null;
let styleTypeInline: HTMLElement | null = null;
let styleArcRow: HTMLElement | null = null;
let styleHideRow: HTMLElement | null = null;
let labelTextRow: HTMLElement | null = null;
let labelFontRow: HTMLElement | null = null;
let labelGreekRow: HTMLElement | null = null;
let styleColorInput: HTMLInputElement | null = null;
let styleWidthInput: HTMLInputElement | null = null;
let lineWidthDecreaseBtn: HTMLButtonElement | null = null;
let lineWidthIncreaseBtn: HTMLButtonElement | null = null;
let lineWidthValueDisplay: HTMLElement | null = null;
let styleTypeSelect: HTMLSelectElement | null = null;
let labelTextInput: HTMLTextAreaElement | null = null;
let arcCountButtons: HTMLButtonElement[] = [];
let rightAngleBtn: HTMLButtonElement | null = null;
let exteriorAngleBtn: HTMLButtonElement | null = null;
let angleRadiusDecreaseBtn: HTMLButtonElement | null = null;
let angleRadiusIncreaseBtn: HTMLButtonElement | null = null;
let colorSwatchButtons: HTMLButtonElement[] = [];
let customColorBtn: HTMLButtonElement | null = null;
let styleTypeButtons: HTMLButtonElement[] = [];
let labelGreekButtons: HTMLButtonElement[] = [];
let labelGreekToggleBtn: HTMLButtonElement | null = null;
let labelGreekShiftBtn: HTMLButtonElement | null = null;
let labelScriptBtn: HTMLButtonElement | null = null;
let labelScriptVisible = false;
let styleRayGroup: HTMLElement | null = null;
let styleTickGroup: HTMLElement | null = null;
let styleTickButton: HTMLButtonElement | null = null;
let styleTypeGap: HTMLElement | null = null;
let labelGreekVisible = false;
let labelGreekUppercase = false;
// Predefined letter sets (unified definitions)
const GREEK_LOWER = [
  'α','β','γ','δ','ε','ζ','η','θ','λ','μ','ξ','π','σ','τ','φ','χ','ψ', 'Γ','Θ','Π','Σ','Φ','Ψ','Ω'
];
// const GREEK_UPPER = [
//   'Γ','Θ','Π','Σ','Φ','Ψ','Ω'
// ];
// const GREEK_LOWER = [
//   'α','β','γ','δ','ε','ζ','η','θ','ι','κ','λ','μ','ν','ξ','ο','π','ρ','σ','τ','υ','φ','χ','ψ','ω'
// ];
// const GREEK_UPPER = [
//   'Α','Β','Γ','Δ','Ε','Ζ','Η','Θ','Ι','Κ','Λ','Μ','Ν','Ξ','Ο','Π','Ρ','Σ','Τ','Υ','Φ','Χ','Ψ','Ω'
// ];
const LABEL_SYMBOLS = [
  '⟂', '∥', '∦', '∈', '∩', '∪', '△', '∼','∢', '⇐', '⇒', '⇔', '°'
];
// Symbol buttons that should not be replaced by script mode
// Added arrow symbols for label keypad: left, right, and double arrow
// Script letters (mathematical script)
const SCRIPT_UPPER = [
  '𝒜','ℬ','𝒞','𝒟','ℰ','ℱ','𝒢','ℋ','ℐ','𝒥','𝒦','ℒ','ℳ','𝒩','𝒪','𝒫','𝒬','ℛ','𝒮','𝒯','𝒰','𝒱','𝒲','𝒳','𝒴','𝒵'
];
const SCRIPT_LOWER = [
  '𝒶','𝒷','𝒸','𝒹','𝒺','𝒻','𝒼','𝒽','𝒾','𝒿','𝓀','𝓁','𝓂','𝓃','𝑜','𝓅','𝓆','𝓇','𝓈','𝓉','𝓊','𝓋','𝓌','𝓍','𝓎','𝓏'
];
let labelFontDecreaseBtn: HTMLButtonElement | null = null;

// Default folder handle for saving/loading files
let defaultFolderHandle: FileSystemDirectoryHandle | null = null;
let selectDefaultFolderBtn: HTMLButtonElement | null = null;
let clearDefaultFolderBtn: HTMLButtonElement | null = null;
let defaultFolderPath: HTMLElement | null = null;

// IndexedDB helpers for persisting folder handle
const DB_NAME = 'GeometryAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'settings';

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function saveDefaultFolderHandle(handle: FileSystemDirectoryHandle | null): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    if (handle) {
      store.put(handle, 'defaultFolderHandle');
      localStorage.setItem('defaultFolderName', handle.name);
    } else {
      store.delete('defaultFolderHandle');
      localStorage.removeItem('defaultFolderName');
    }
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (err) {
    console.error('Failed to save folder handle to IndexedDB:', err);
  }
}

async function loadDefaultFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('defaultFolderHandle');
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const handle = request.result as FileSystemDirectoryHandle | undefined;
        resolve(handle || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to load folder handle from IndexedDB:', err);
    return null;
  }
}

async function ensureFolderPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    // @ts-ignore - queryPermission is not in all TS definitions
    const permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission === 'granted') {
      return true;
    }
    
    // Request permission if not granted
    // @ts-ignore - requestPermission is not in all TS definitions
    const requested = await handle.requestPermission({ mode: 'readwrite' });
    return requested === 'granted';
  } catch (err) {
    console.error('Failed to check/request folder permission:', err);
    return false;
  }
}
let labelFontIncreaseBtn: HTMLButtonElement | null = null;
let labelFontSizeDisplay: HTMLElement | null = null;
let recentColors: string[] = [THEME.defaultStroke];
let labelUpperIdx = 0;
let labelLowerIdx = 0;
let labelGreekIdx = 0;
let freeUpperIdx: number[] = [];
let freeLowerIdx: number[] = [];
let freeGreekIdx: number[] = [];
if (typeof document !== 'undefined') {
  setTheme(currentTheme);
}
let pendingParallelPoint: number | null = null;
let pendingParallelLine: number | null = null;
let pendingCircleRadiusPoint: number | null = null;
let pendingCircleRadiusLength: number | null = null;
let draggingLabel:
  | null
  | {
      kind: 'point' | 'line' | 'angle' | 'free';
      id: number;
      start: { x: number; y: number };
      initialOffset: { x: number; y: number };
    };
let draggingCircleCenterAngles: Map<number, Map<number, number>> | null = null;
let circleThreePoints: number[] = [];
let activeAxisSnap: { lineIdx: number; axis: 'horizontal' | 'vertical'; strength: number } | null = null;
const ICONS = {
  moveSelect:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 9.5 5.5 12 8l2.5-2.5L12 3Zm0 13-2.5 2.5L12 21l2.5-2.5L12 16Zm-9-4 2.5 2.5L8 12 5.5 9.5 3 12Zm13 0 2.5 2.5L21 12l-2.5-2.5L16 12ZM8 12l8 0" /></svg>',
  vertices:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" class="icon-fill"/></svg>',
  edges:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  rayLeft:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H6"/><path d="m6 8-4 4 4 4"/></svg>',
  rayRight:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14"/><path d="m18 8 4 4-4 4"/></svg>',
  viewVertices:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="3.8" fill="none" stroke="currentColor"/><circle cx="8" cy="12" r="1.6" class="icon-fill"/><circle cx="16" cy="12" r="3.8" fill="none" stroke="currentColor"/><circle cx="16" cy="12" r="1.6" class="icon-fill"/></svg>',
  viewEdges:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="3.2" fill="none" stroke="currentColor"/><circle cx="6" cy="12" r="1.5" class="icon-fill"/><circle cx="18" cy="12" r="3.2" fill="none" stroke="currentColor"/><circle cx="18" cy="12" r="1.5" class="icon-fill"/><line x1="6" y1="12" x2="18" y2="12" stroke-linecap="round" stroke-width="2"/></svg>',
  viewBoth:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="3.2" fill="none" stroke="currentColor"/><circle cx="6" cy="12" r="1.5" class="icon-fill"/><circle cx="18" cy="12" r="3.2" fill="none" stroke="currentColor"/><circle cx="18" cy="12" r="1.5" class="icon-fill"/><line x1="6" y1="12" x2="18" y2="12" stroke-linecap="round" stroke-width="2"/></svg>',
  rayLine:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="12" x2="20" y2="12"/></svg>',
  rayRightOnly:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="12" x2="14" y2="12"/><path d="m14 8 6 4-6 4"/></svg>',
  rayLeftOnly:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="10" y1="12" x2="20" y2="12"/><path d="m10 8-6 4 6 4"/></svg>',
  raySegment:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="2" class="icon-fill"/><circle cx="16" cy="12" r="2" class="icon-fill"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  tick1:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="12" x2="20" y2="12" stroke-linecap="round" stroke-width="1.8"/><line x1="12" y1="8" x2="12" y2="16" stroke-linecap="round" stroke-width="1.8"/></svg>',
  tick2:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="12" x2="20" y2="12" stroke-linecap="round" stroke-width="1.8"/><line x1="10" y1="8" x2="10" y2="16" stroke-linecap="round" stroke-width="1.8"/><line x1="14" y1="8" x2="14" y2="16" stroke-linecap="round" stroke-width="1.8"/></svg>',
  tick3:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="12" x2="20" y2="12" stroke-linecap="round" stroke-width="1.8"/><line x1="9" y1="7.5" x2="9" y2="16.5" stroke-linecap="round" stroke-width="1.8"/><line x1="12" y1="7.5" x2="12" y2="16.5" stroke-linecap="round" stroke-width="1.8"/><line x1="15" y1="7.5" x2="15" y2="16.5" stroke-linecap="round" stroke-width="1.8"/></svg>',
  eye:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="3"/><path d="M4 4 20 20"/></svg>'
};

type Snapshot = {
  model: Model;
  panOffset: { x: number; y: number };
  zoom: number;
  labelState: {
    upperIdx: number;
    lowerIdx: number;
    greekIdx: number;
    freeUpper: number[];
    freeLower: number[];
    freeGreek: number[];
  };
};

const PERSIST_VERSION = 1;

type PersistedPoint = {
  id: string;
  object_type: 'point';
  x: number;
  y: number;
  style: PointStyle;
  label?: Label;
  construction_kind: PointConstructionKind;
  defining_parents: string[];
  parent_refs: ConstructionParent[];
  children: string[];
  incident_objects?: string[];
  midpoint?: MidpointMeta;
  symmetric?: SymmetricMeta;
  parallel_helper_for?: string;
  perpendicular_helper_for?: string;
};

type PersistedLine = {
  id: string;
  object_type: 'line';
  points: number[];
  defining_points: [number, number];
  segmentStyles?: StrokeStyle[];
  segmentKeys?: string[];
  leftRay?: StrokeStyle;
  rightRay?: StrokeStyle;
  style: StrokeStyle;
  label?: Label;
  hidden?: boolean;
  construction_kind: LineConstructionKind;
  defining_parents: string[];
  children: string[];
  parallel?: ParallelLineMeta;
  perpendicular?: PerpendicularLineMeta;
};

type PersistedCircleBase = {
  id: string;
  object_type: 'circle';
  center: number;
  radius_point: number;
  points: number[];
  style: StrokeStyle;
  arcStyles?: StrokeStyle[];
  label?: Label;
  hidden?: boolean;
  construction_kind: string;
  defining_parents: string[];
  children: string[];
};

type PersistedCircle =
  | (PersistedCircleBase & { circle_kind: 'center-radius' })
  | (PersistedCircleBase & { circle_kind: 'three-point'; defining_points: [number, number, number] });

type PersistedAngle = {
  id: string;
  object_type: 'angle';
  leg1: { line: number; seg: number };
  leg2: { line: number; seg: number };
  vertex: number;
  style: AngleStyle;
  label?: Label;
  hidden?: boolean;
  construction_kind: string;
  defining_parents: string[];
  children: string[];
};

type PersistedPolygon = {
  id: string;
  object_type: 'polygon';
  lines: number[];
  construction_kind: string;
  defining_parents: string[];
  children: string[];
};

type PersistedModel = {
  points: PersistedPoint[];
  lines: PersistedLine[];
  circles: PersistedCircle[];
  angles: PersistedAngle[];
  polygons: PersistedPolygon[];
  inkStrokes?: InkStroke[];
  labels: FreeLabel[];
  idCounters?: Partial<Record<GeometryKind, number>>;
};

type PersistedLabelState = {
  upper: number;
  lower: number;
  greek: number;
  freeUpper: number[];
  freeLower: number[];
  freeGreek: number[];
};

type PersistedDocument = {
  version: number;
  model: PersistedModel;
  panOffset: { x: number; y: number };
  zoom?: number;
  labelState: PersistedLabelState;
  recentColors: string[];
  showHidden: boolean;
  measurementReferenceSegment?: { lineIdx: number; segIdx: number } | null;
  measurementReferenceValue?: number | null;
};

function polygonCentroid(polyIdx: number): { x: number; y: number } | null {
  const verts = polygonVertices(polyIdx);
  if (!verts.length) return null;
  const sum = verts.reduce(
    (acc, vi) => {
      const p = model.points[vi];
      return p ? { x: acc.x + p.x, y: acc.y + p.y } : acc;
    },
    { x: 0, y: 0 }
  );
  return { x: sum.x / verts.length, y: sum.y / verts.length };
}

let history: Snapshot[] = [];
let historyIndex = -1;
let movedDuringDrag = false;
let movedDuringPan = false;
const parallelRecomputeStack = new Set<number>();
const perpendicularRecomputeStack = new Set<number>();

function currentPointStyle(): PointStyle {
  return { color: THEME.defaultStroke, size: THEME.pointSize };
}

function midpointPointStyle(): PointStyle {
  return { color: THEME.midpointColor, size: THEME.pointSize };
}

function symmetricPointStyle(): PointStyle {
  return { color: THEME.defaultStroke, size: THEME.pointSize };
}

function currentStrokeStyle(): StrokeStyle {
  return {
    color: THEME.defaultStroke,
    width: THEME.lineWidth,
    type: 'solid',
    tick: 0
  };
}

function currentAngleStyle(): AngleStyle {
  const s: StrokeStyle = {
    color: THEME.defaultStroke,
    width: THEME.angleStrokeWidth,
    type: 'solid'
  };
  return { ...s, fill: undefined, arcCount: 1, right: false, arcRadiusOffset: 0 };
}

const UPPER_SEQ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER_SEQ = 'abcdefghijklmnopqrstuvwxyz';
const GREEK_SEQ = GREEK_LOWER;

function seqLetter(idx: number, alphabet: string) {
  const base = alphabet.length;
  let n = idx;
  let res = '';
  do {
    res = alphabet[n % base] + res;
    n = Math.floor(n / base) - 1;
  } while (n >= 0);
  return res;
}

function nextUpper() {
  if (freeUpperIdx.length) {
    const idx = freeUpperIdx.shift()!;
    return { text: seqLetter(idx, UPPER_SEQ), seq: { kind: 'upper' as const, idx } };
  }
  const idx = labelUpperIdx;
  const res = seqLetter(idx, UPPER_SEQ);
  labelUpperIdx += 1;
  return { text: res, seq: { kind: 'upper' as const, idx } };
}
function nextLower() {
  if (freeLowerIdx.length) {
    const idx = freeLowerIdx.shift()!;
    return { text: seqLetter(idx, LOWER_SEQ), seq: { kind: 'lower' as const, idx } };
  }
  const idx = labelLowerIdx;
  const res = seqLetter(idx, LOWER_SEQ);
  labelLowerIdx += 1;
  return { text: res, seq: { kind: 'lower' as const, idx } };
}
function nextGreek() {
  if (freeGreekIdx.length) {
    const idx = freeGreekIdx.shift()!;
    return { text: GREEK_SEQ[idx % GREEK_SEQ.length], seq: { kind: 'greek' as const, idx } };
  }
  const idx = labelGreekIdx;
  const res = GREEK_SEQ[idx % GREEK_SEQ.length];
  labelGreekIdx += 1;
  return { text: res, seq: { kind: 'greek' as const, idx } };
}

function clearSelectionState() {
  selectedLineIndex = null;
  selectedPointIndex = null;
  selectedCircleIndex = null;
  selectedAngleIndex = null;
  selectedPolygonIndex = null;
  selectedInkStrokeIndex = null;
  selectedLabel = null;
  selectedSegments.clear();
  selectedArcSegments.clear();
  draggingLabel = null;
  resizingLine = null;
  lineDragContext = null;
  parallelAnchorPointIndex = null;
  parallelReferenceLineIndex = null;
  squareStartIndex = null;
  ngonSecondIndex = null;
}

function copyStyleFromSelection(): CopiedStyle | null {
  if (selectedPointIndex !== null) {
    const pt = model.points[selectedPointIndex];
    if (!pt) return null;
    return {
      sourceType: 'point',
      color: pt.style.color,
      size: pt.style.size
    };
  }
  if (selectedLineIndex !== null) {
    const line = model.lines[selectedLineIndex];
    if (!line) return null;
    // Jeśli zaznaczony jest konkretny segment, weź jego styl
    if (selectedSegments.size > 0) {
      const firstKey = Array.from(selectedSegments)[0];
      const parsed = parseSegmentKey(firstKey);
      if (parsed && parsed.line === selectedLineIndex) {
        let style: StrokeStyle | undefined;
        if (parsed.part === 'segment' && parsed.seg !== undefined) {
          style = line.segmentStyles?.[parsed.seg] ?? line.style;
        } else if (parsed.part === 'rayLeft') {
          style = line.leftRay ?? line.style;
        } else if (parsed.part === 'rayRight') {
          style = line.rightRay ?? line.style;
        }
        if (style) {
          return {
            sourceType: 'line',
            color: style.color,
            width: style.width,
            type: style.type,
            tick: style.tick
          };
        }
      }
    }
    // Jeśli zaznaczona cała linia, weź styl całej linii
    return {
      sourceType: 'line',
      color: line.style.color,
      width: line.style.width,
      type: line.style.type,
      tick: line.style.tick
    };
  }
  if (selectedCircleIndex !== null) {
    const circle = model.circles[selectedCircleIndex];
    if (!circle) return null;
    // Jeśli zaznaczony jest konkretny łuk, weź jego styl
    if (selectedArcSegments.size > 0) {
      const firstKey = Array.from(selectedArcSegments)[0];
      const parsed = parseArcKey(firstKey);
      if (parsed && parsed.circle === selectedCircleIndex) {
        const style = circle.arcStyles?.[parsed.arcIdx] ?? circle.style;
        return {
          sourceType: 'circle',
          color: style.color,
          width: style.width,
          type: style.type,
          tick: style.tick
        };
      }
    }
    // Jeśli zaznaczony cały okrąg, weź styl całego okręgu
    return {
      sourceType: 'circle',
      color: circle.style.color,
      width: circle.style.width,
      type: circle.style.type,
      tick: circle.style.tick
    };
  }
  if (selectedAngleIndex !== null) {
    const angle = model.angles[selectedAngleIndex];
    if (!angle) return null;
    return {
      sourceType: 'angle',
      color: angle.style.color,
      width: angle.style.width,
      type: angle.style.type,
      arcCount: angle.style.arcCount,
      right: angle.style.right,
      fill: angle.style.fill,
      arcRadiusOffset: angle.style.arcRadiusOffset
    };
  }
  if (selectedInkStrokeIndex !== null) {
    const stroke = model.inkStrokes[selectedInkStrokeIndex];
    if (!stroke) return null;
    return {
      sourceType: 'ink',
      color: stroke.color,
      baseWidth: stroke.baseWidth
    };
  }
  return null;
}

function applyStyleToSelection(style: CopiedStyle) {
  let changed = false;
  if (selectedPointIndex !== null && style.color !== undefined && style.size !== undefined) {
    const pt = model.points[selectedPointIndex];
    if (pt) {
      pt.style.color = style.color;
      pt.style.size = style.size;
      changed = true;
    }
  }
  if (selectedLineIndex !== null && style.color !== undefined && style.width !== undefined && style.type !== undefined) {
    const line = model.lines[selectedLineIndex];
    if (line) {
      // Jeśli zaznaczone są konkretne segmenty, aplikuj tylko do nich
      if (selectedSegments.size > 0) {
        ensureSegmentStylesForLine(selectedLineIndex);
        selectedSegments.forEach((key) => {
          const parsed = parseSegmentKey(key);
          if (!parsed || parsed.line !== selectedLineIndex) return;
          if (parsed.part === 'segment' && parsed.seg !== undefined) {
            if (!line.segmentStyles) line.segmentStyles = [];
            const base = line.segmentStyles[parsed.seg] ?? line.style;
            line.segmentStyles[parsed.seg] = { ...base, color: style.color!, width: style.width!, type: style.type! };
            if (style.tick !== undefined) line.segmentStyles[parsed.seg].tick = style.tick;
          } else if (parsed.part === 'rayLeft') {
            const base = line.leftRay ?? line.style;
            line.leftRay = { ...base, color: style.color!, width: style.width!, type: style.type! };
            if (style.tick !== undefined) line.leftRay.tick = style.tick;
          } else if (parsed.part === 'rayRight') {
            const base = line.rightRay ?? line.style;
            line.rightRay = { ...base, color: style.color!, width: style.width!, type: style.type! };
            if (style.tick !== undefined) line.rightRay.tick = style.tick;
          }
        });
        changed = true;
      } else {
        // Aplikuj do całej linii
        line.style.color = style.color;
        line.style.width = style.width;
        line.style.type = style.type;
        if (style.tick !== undefined) line.style.tick = style.tick;
        
        // Jeśli linia ma segmentStyles, zaktualizuj też wszystkie segmenty
        if (line.segmentStyles && line.segmentStyles.length > 0) {
          line.segmentStyles = line.segmentStyles.map(seg => ({
            ...seg,
            color: style.color!,
            width: style.width!,
            type: style.type!,
            tick: style.tick !== undefined ? style.tick : seg.tick
          }));
        }
        
        // Zaktualizuj też półproste jeśli istnieją
        if (line.leftRay) {
          line.leftRay = { ...line.leftRay, color: style.color, width: style.width, type: style.type };
          if (style.tick !== undefined) line.leftRay.tick = style.tick;
        }
        if (line.rightRay) {
          line.rightRay = { ...line.rightRay, color: style.color, width: style.width, type: style.type };
          if (style.tick !== undefined) line.rightRay.tick = style.tick;
        }
        
        changed = true;
      }
    }
  }
  if (selectedCircleIndex !== null && style.color !== undefined && style.width !== undefined && style.type !== undefined) {
    const circle = model.circles[selectedCircleIndex];
    if (circle) {
      // Jeśli zaznaczone są konkretne łuki, aplikuj tylko do nich
      if (selectedArcSegments.size > 0) {
        const arcs = circleArcs(selectedCircleIndex);
        ensureArcStyles(selectedCircleIndex, arcs.length);
        selectedArcSegments.forEach((key) => {
          const parsed = parseArcKey(key);
          if (!parsed || parsed.circle !== selectedCircleIndex) return;
          if (!circle.arcStyles) circle.arcStyles = [];
          const base = circle.arcStyles[parsed.arcIdx] ?? circle.style;
          circle.arcStyles[parsed.arcIdx] = { ...base, color: style.color!, width: style.width!, type: style.type! };
          if (style.tick !== undefined) circle.arcStyles[parsed.arcIdx].tick = style.tick;
        });
        changed = true;
      } else {
        // Aplikuj do całego okręgu
        circle.style.color = style.color;
        circle.style.width = style.width;
        circle.style.type = style.type;
        if (style.tick !== undefined) circle.style.tick = style.tick;
        
        // Jeśli okrąg ma arcStyles, zaktualizuj też wszystkie łuki
        if (circle.arcStyles && circle.arcStyles.length > 0) {
          circle.arcStyles = circle.arcStyles.map(arc => ({
            ...arc,
            color: style.color!,
            width: style.width!,
            type: style.type!,
            tick: style.tick !== undefined ? style.tick : arc.tick
          }));
        }
        
        changed = true;
      }
    }
  }
  if (selectedAngleIndex !== null && style.color !== undefined && style.width !== undefined && style.type !== undefined) {
    const angle = model.angles[selectedAngleIndex];
    if (angle) {
      angle.style.color = style.color;
      angle.style.width = style.width;
      angle.style.type = style.type;
      if (style.arcCount !== undefined) angle.style.arcCount = style.arcCount;
      if (style.right !== undefined) angle.style.right = style.right;
      if (style.fill !== undefined) angle.style.fill = style.fill;
      if (style.arcRadiusOffset !== undefined) angle.style.arcRadiusOffset = style.arcRadiusOffset;
      changed = true;
    }
  }
  if (selectedInkStrokeIndex !== null && style.color !== undefined && style.baseWidth !== undefined) {
    const stroke = model.inkStrokes[selectedInkStrokeIndex];
    if (stroke) {
      stroke.color = style.color;
      stroke.baseWidth = style.baseWidth;
      changed = true;
    }
  }
  if (changed) {
    draw();
    pushHistory();
  }
}

function reclaimLabel(label?: Label) {
  if (!label?.seq) return;
  const { kind, idx } = label.seq;
  const pool = kind === 'upper' ? freeUpperIdx : kind === 'lower' ? freeLowerIdx : freeGreekIdx;
  if (!pool.includes(idx)) {
    pool.push(idx);
    pool.sort((a, b) => a - b);
  }
}

function resetLabelState() {
  labelUpperIdx = 0;
  labelLowerIdx = 0;
  labelGreekIdx = 0;
  freeUpperIdx = [];
  freeLowerIdx = [];
  freeGreekIdx = [];
}

function clearMultiSelection() {
  multiSelectedPoints.clear();
  multiSelectedLines.clear();
  multiSelectedCircles.clear();
  multiSelectedAngles.clear();
  multiSelectedPolygons.clear();
  multiSelectedInkStrokes.clear();
  multiselectBoxStart = null;
  multiselectBoxEnd = null;
}

function isPointInBox(p: { x: number; y: number }, box: { x1: number; y1: number; x2: number; y2: number }): boolean {
  return p.x >= box.x1 && p.x <= box.x2 && p.y >= box.y1 && p.y <= box.y2;
}

function selectObjectsInBox(box: { x1: number; y1: number; x2: number; y2: number }) {
  model.points.forEach((p, idx) => {
    if (isPointInBox(p, box)) multiSelectedPoints.add(idx);
  });
  
  model.lines.forEach((line, idx) => {
    const allInside = line.points.every(pi => {
      const p = model.points[pi];
      return p && isPointInBox(p, box);
    });
    if (allInside) multiSelectedLines.add(idx);
  });
  
  model.circles.forEach((circle, idx) => {
    const center = model.points[circle.center];
    if (center && isPointInBox(center, box)) multiSelectedCircles.add(idx);
  });
  
  model.angles.forEach((ang, idx) => {
    const v = model.points[ang.vertex];
    if (v && isPointInBox(v, box)) multiSelectedAngles.add(idx);
  });
  
  model.polygons.forEach((poly, idx) => {
    const verts = polygonVerticesOrdered(idx);
    const allInside = verts.every(vi => {
      const p = model.points[vi];
      return p && isPointInBox(p, box);
    });
    if (allInside) multiSelectedPolygons.add(idx);
  });
  
  model.inkStrokes.forEach((stroke, idx) => {
    const allInside = stroke.points.every(pt => isPointInBox(pt, box));
    if (allInside) multiSelectedInkStrokes.add(idx);
  });
}

// Measurement input box helpers
function showMeasurementInputBox(label: MeasurementLabel) {
  if (!canvas) return;
  
  editingMeasurementLabel = label.id;
  
  // Create input box if it doesn't exist
  if (!measurementInputBox) {
    measurementInputBox = document.createElement('input');
    measurementInputBox.type = 'text';
    measurementInputBox.style.position = 'absolute';
    measurementInputBox.style.zIndex = '10000';
    measurementInputBox.style.padding = '4px 8px';
    measurementInputBox.style.border = '2px solid ' + THEME.highlight;
    measurementInputBox.style.borderRadius = '4px';
    measurementInputBox.style.background = THEME.bg;
    measurementInputBox.style.color = THEME.defaultStroke;
    measurementInputBox.style.fontSize = (label.fontSize ?? getLabelFontDefault()) + 'px';
    measurementInputBox.style.fontFamily = 'sans-serif';
    measurementInputBox.style.textAlign = 'center';
    measurementInputBox.style.minWidth = '60px';
    document.body.appendChild(measurementInputBox);
  }
  
  // Position the input box
  const canvasRect = canvas.getBoundingClientRect();
  const screenX = (label.pos.x * zoomFactor + panOffset.x) * dpr / dpr + canvasRect.left;
  const screenY = (label.pos.y * zoomFactor + panOffset.y) * dpr / dpr + canvasRect.top;
  
  measurementInputBox.style.left = screenX + 'px';
  measurementInputBox.style.top = screenY + 'px';
  measurementInputBox.style.transform = 'translate(-50%, -50%)';
  
  // Set initial value
  if (label.kind === 'segment') {
    const match = label.targetId.match(/^(.+)-seg(\d+)$/);
    if (match) {
      const lineId = match[1];
      const segIdx = parseInt(match[2], 10);
      const lineIdx = model.lines.findIndex(l => l.id === lineId);
      if (lineIdx !== -1) {
        const currentLength = getSegmentLength(lineIdx, segIdx);
        measurementInputBox.value = measurementScale ? (currentLength / measurementScale).toFixed(measurementPrecisionLength) : '';
      }
    }
  }
  
  measurementInputBox.focus();
  measurementInputBox.select();
  
  // Handle Enter key
  measurementInputBox.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitMeasurementInput();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMeasurementInputBox();
    }
  };
  
  // Handle blur - close only if not clicking inside the input
  measurementInputBox.onblur = () => {
    setTimeout(() => {
      if (document.activeElement !== measurementInputBox) {
        closeMeasurementInputBox();
      }
    }, 150);
  };
  
  // Prevent click from propagating to canvas
  measurementInputBox.onclick = (e) => {
    e.stopPropagation();
  };
  measurementInputBox.onpointerdown = (e) => {
    e.stopPropagation();
  };
}

function commitMeasurementInput() {
  if (!measurementInputBox || !editingMeasurementLabel) return;
  
  const label = measurementLabels.find(ml => ml.id === editingMeasurementLabel);
  if (!label) {
    closeMeasurementInputBox();
    return;
  }
  
  const inputValue = measurementInputBox.value.trim();
  
  if (label.kind === 'segment' && inputValue !== '') {
    const match = label.targetId.match(/^(.+)-seg(\d+)$/);
    if (match) {
      const lineId = match[1];
      const segIdx = parseInt(match[2], 10);
      const lineIdx = model.lines.findIndex(l => l.id === lineId);
      
      if (lineIdx !== -1) {
        const userValue = parseFloat(inputValue);
        if (!isNaN(userValue) && userValue > 0) {
          const currentLength = getSegmentLength(lineIdx, segIdx);
          measurementScale = currentLength / userValue;
          measurementReferenceSegment = { lineIdx, segIdx };
          measurementReferenceValue = userValue;
          
          generateMeasurementLabels();
          pushHistory();
        }
      }
    }
  }
  
  closeMeasurementInputBox();
  draw();
}

function closeMeasurementInputBox() {
  if (measurementInputBox && measurementInputBox.parentElement) {
    measurementInputBox.parentElement.removeChild(measurementInputBox);
  }
  measurementInputBox = null;
  editingMeasurementLabel = null;
}

// Measurement label helpers
function generateMeasurementLabels() {
  // Don't clear existing labels, update positions instead
  const existingLabels = new Map(measurementLabels.map(ml => [ml.targetId, ml]));
  measurementLabels = [];
  
  // Generate labels for all segments
  model.lines.forEach((line, lineIdx) => {
    const pts = line.points.map(idx => model.points[idx]).filter(Boolean);
    for (let segIdx = 0; segIdx < pts.length - 1; segIdx++) {
      const a = pts[segIdx];
      const b = pts[segIdx + 1];
      if (!a || !b) continue;
      
      const style = line.segmentStyles?.[segIdx] ?? line.style;
      if (style.hidden && !showHidden) continue;
      
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      
      const targetId = `${line.id}-seg${segIdx}`;
      const existing = existingLabels.get(targetId);
      
      if (existing) {
        // Update existing label position
        measurementLabels.push({
          ...existing,
          pos: { x: midX, y: midY }
        });
      } else {
        // Create new label
        measurementLabels.push({
          id: `ml${++measurementLabelIdCounter}`,
          kind: 'segment',
          targetId,
          pos: { x: midX, y: midY },
          pinned: false,
          color: THEME.defaultStroke
        });
      }
    }
  });
  
  // Generate labels for all angles
  model.angles.forEach((angle, angleIdx) => {
    if (angle.hidden && !showHidden) return;
    
    const v = model.points[angle.vertex];
    if (!v) return;
    
    const geom = angleGeometry(angle);
    if (!geom) return;
    
    const { start, end, clockwise, radius } = geom;
    const midAngle = clockwise 
      ? start - (start - end + (start < end ? Math.PI * 2 : 0)) / 2
      : start + (end - start + (end < start ? Math.PI * 2 : 0)) / 2;
    
    const labelRadius = radius + screenUnits(15);
    const labelX = v.x + Math.cos(midAngle) * labelRadius;
    const labelY = v.y + Math.sin(midAngle) * labelRadius;
    
    const existing = existingLabels.get(angle.id);
    
    if (existing) {
      // Update existing label position
      measurementLabels.push({
        ...existing,
        pos: { x: labelX, y: labelY }
      });
    } else {
      // Create new label
      measurementLabels.push({
        id: `ml${++measurementLabelIdCounter}`,
        kind: 'angle',
        targetId: angle.id,
        pos: { x: labelX, y: labelY },
        pinned: false,
        color: THEME.defaultStroke
      });
    }
  });
  
  // Apply label repulsion only to new labels (without pinned state)
  repelMeasurementLabels();
}

function repelMeasurementLabels() {
  const iterations = 50;
  const repulsionRadius = screenUnits(40);
  const repulsionStrength = 0.3;
  
  for (let iter = 0; iter < iterations; iter++) {
    const forces: { x: number; y: number }[] = measurementLabels.map(() => ({ x: 0, y: 0 }));
    
    for (let i = 0; i < measurementLabels.length; i++) {
      for (let j = i + 1; j < measurementLabels.length; j++) {
        const a = measurementLabels[i];
        const b = measurementLabels[j];
        
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < repulsionRadius && dist > 0.1) {
          const force = (repulsionRadius - dist) / repulsionRadius * repulsionStrength;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          forces[i].x -= fx;
          forces[i].y -= fy;
          forces[j].x += fx;
          forces[j].y += fy;
        }
      }
    }
    
    measurementLabels.forEach((label, idx) => {
      if (!label.pinned) {
        label.pos.x += forces[idx].x;
        label.pos.y += forces[idx].y;
      }
    });
  }
}

function getSegmentLength(lineIdx: number, segIdx: number): number {
  const line = model.lines[lineIdx];
  if (!line) return 0;
  
  const pts = line.points.map(idx => model.points[idx]);
  const a = pts[segIdx];
  const b = pts[segIdx + 1];
  if (!a || !b) return 0;
  
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function getAngleValue(angleIdx: number): number {
  const angle = model.angles[angleIdx];
  if (!angle) return 0;
  
  const geom = angleGeometry(angle);
  if (!geom) return 0;
  
  let { start, end, clockwise } = geom;
  let angleDiff = clockwise 
    ? (start - end + Math.PI * 2) % (Math.PI * 2)
    : (end - start + Math.PI * 2) % (Math.PI * 2);
  
  if (angle.style.exterior) {
    angleDiff = Math.PI * 2 - angleDiff;
  }
  
  return angleDiff * (180 / Math.PI);
}

function formatMeasurement(value: number, kind: 'segment' | 'angle'): string {
  if (kind === 'angle') {
    return `${value.toFixed(measurementPrecisionAngle)}°`;
  }
  
  if (measurementScale === null) {
    return ''; // Empty until scale is set
  }
  
  const scaledValue = value / measurementScale;
  return scaledValue.toFixed(measurementPrecisionLength);
}

function getMeasurementLabelText(label: MeasurementLabel): string {
  if (label.kind === 'segment') {
    const match = label.targetId.match(/^(.+)-seg(\d+)$/);
    if (!match) return '';
    
    const lineId = match[1];
    const segIdx = parseInt(match[2], 10);
    const lineIdx = model.lines.findIndex(l => l.id === lineId);
    if (lineIdx === -1) return '';
    
    const length = getSegmentLength(lineIdx, segIdx);
    const text = formatMeasurement(length, 'segment');
    return text || '—'; // Show placeholder when no scale
  } else {
    const angleIdx = model.angles.findIndex(a => a.id === label.targetId);
    if (angleIdx === -1) return '';
    
    const angleValue = getAngleValue(angleIdx);
    return formatMeasurement(angleValue, 'angle');
  }
}

function hasMultiSelection(): boolean {
  return multiSelectedPoints.size > 0 ||
         multiSelectedLines.size > 0 ||
         multiSelectedCircles.size > 0 ||
         multiSelectedAngles.size > 0 ||
         multiSelectedPolygons.size > 0 ||
         multiSelectedInkStrokes.size > 0;
}

function draw() {
  if (!canvas || !ctx) return;
  
  // Update measurement labels if they're visible
  if (showMeasurements && measurementLabels.length > 0) {
    generateMeasurementLabels();
  }
  
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * zoomFactor, 0, 0, dpr * zoomFactor, panOffset.x * dpr, panOffset.y * dpr);

  // draw lines
  model.lines.forEach((line, lineIdx) => {
    if (line.hidden && !showHidden) return;
    const pts = line.points.map((idx) => model.points[idx]).filter(Boolean) as Point[];
    if (pts.length < 2) return;
    const inSelectedPolygon =
      selectedPolygonIndex !== null && model.polygons[selectedPolygonIndex]?.lines.includes(lineIdx);
    const lineSelected = selectedLineIndex === lineIdx || inSelectedPolygon;
    const highlightColor = isParallelLine(line) || isPerpendicularLine(line) ? '#9ca3af' : HIGHLIGHT_LINE.color;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const style = line.segmentStyles?.[i] ?? line.style;
      if (style.hidden && !showHidden) {
        continue;
      }
      // Removed check for hidden endpoints - lines should remain visible even if points are hidden
      const segKey = segmentKey(lineIdx, 'segment', i);
      const isSegmentSelected = selectedSegments.size > 0 && selectedSegments.has(segKey);
      const shouldHighlight =
        lineSelected && selectionEdges && (selectedSegments.size === 0 || isSegmentSelected);
      const segHidden = !!style.hidden || line.hidden;
      ctx!.save();
      ctx!.globalAlpha = segHidden && showHidden ? 0.4 : 1;
      ctx!.strokeStyle = style.color;
      ctx!.lineWidth = renderWidth(style.width);
      applyStrokeStyle(style.type);
      ctx!.beginPath();
      ctx!.moveTo(a.x, a.y);
      ctx!.lineTo(b.x, b.y);
      ctx!.stroke();
      if (style.tick) drawSegmentTicks({ x: a.x, y: a.y }, { x: b.x, y: b.y }, style.tick, ctx!);
      if (shouldHighlight) {
        ctx!.strokeStyle = highlightColor;
        ctx!.lineWidth = renderWidth(style.width + HIGHLIGHT_LINE.width);
        ctx!.setLineDash(HIGHLIGHT_LINE.dash);
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();
        ctx!.setLineDash([]);
      }
      ctx!.restore();
    }
    // draw rays if enabled
    const first = pts[0];
    const last = pts[pts.length - 1];
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const len = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / len, y: dy / len };
    const extend = (canvas!.width + canvas!.height) / dpr;
    if (line.leftRay && !(line.leftRay.hidden && !showHidden)) {
      ctx!.strokeStyle = line.leftRay.color;
      ctx!.lineWidth = renderWidth(line.leftRay.width);
      const hiddenRay = !!line.leftRay.hidden || line.hidden;
      ctx!.save();
      ctx!.globalAlpha = hiddenRay && showHidden ? 0.4 : 1;
      applyStrokeStyle(line.leftRay.type);
      ctx!.beginPath();
      ctx!.moveTo(first.x, first.y);
      ctx!.lineTo(first.x - dir.x * extend, first.y - dir.y * extend);
      ctx!.stroke();
      if (
        lineSelected &&
        selectionEdges &&
        (selectedSegments.size === 0 || selectedSegments.has(segmentKey(lineIdx, 'rayLeft')))
      ) {
        ctx!.strokeStyle = highlightColor;
        ctx!.lineWidth = renderWidth(line.leftRay.width + HIGHLIGHT_LINE.width);
        ctx!.setLineDash(HIGHLIGHT_LINE.dash);
        ctx!.beginPath();
        ctx!.moveTo(first.x, first.y);
        ctx!.lineTo(first.x - dir.x * extend, first.y - dir.y * extend);
        ctx!.stroke();
        ctx!.setLineDash([]);
      }
      ctx!.restore();
    }
    if (line.rightRay && !(line.rightRay.hidden && !showHidden)) {
      ctx!.strokeStyle = line.rightRay.color;
      ctx!.lineWidth = renderWidth(line.rightRay.width);
      const hiddenRay = !!line.rightRay.hidden || line.hidden;
      ctx!.save();
      ctx!.globalAlpha = hiddenRay && showHidden ? 0.4 : 1;
      applyStrokeStyle(line.rightRay.type);
      ctx!.beginPath();
      ctx!.moveTo(last.x, last.y);
      ctx!.lineTo(last.x + dir.x * extend, last.y + dir.y * extend);
      ctx!.stroke();
      if (
        lineSelected &&
        selectionEdges &&
        (selectedSegments.size === 0 || selectedSegments.has(segmentKey(lineIdx, 'rayRight')))
      ) {
        ctx!.strokeStyle = highlightColor;
        ctx!.lineWidth = renderWidth(line.rightRay.width + HIGHLIGHT_LINE.width);
        ctx!.setLineDash(HIGHLIGHT_LINE.dash);
        ctx!.beginPath();
        ctx!.moveTo(last.x, last.y);
        ctx!.lineTo(last.x + dir.x * extend, last.y + dir.y * extend);
        ctx!.stroke();
        ctx!.setLineDash([]);
      }
      ctx!.restore();
    }
    // draw handle for pure segment (both rays hidden)
    const handle = selectedLineIndex === lineIdx ? getLineHandle(lineIdx) : null;
    if (handle) {
      ctx!.save();
      ctx!.fillStyle = THEME.preview;
      const size = HANDLE_SIZE;
      ctx!.translate(handle.x, handle.y);
      ctx!.scale(1 / zoomFactor, 1 / zoomFactor);
      ctx!.fillRect(-size / 2, -size / 2, size, size);
      ctx!.restore();
    }
    if (line.label && !line.label.hidden) {
      const ext = lineExtent(lineIdx);
      if (ext) {
        if (!line.label.offset) line.label.offset = defaultLineLabelOffset(lineIdx);
        const off = line.label.offset ?? { x: 0, y: -10 };
        const selected = selectedLabel?.kind === 'line' && selectedLabel.id === lineIdx;
        drawLabelText(line.label, ext.center, selected, off);
      }
    }
    if (activeAxisSnap && activeAxisSnap.lineIdx === lineIdx) {
      const extent = lineExtent(lineIdx);
      if (extent) {
        const strength = Math.max(0, Math.min(1, activeAxisSnap.strength));
        const indicatorRadius = 11;
        const gap = 4;
        const offsetAmount = screenUnits(indicatorRadius * 2 + gap);
        const offset =
          activeAxisSnap.axis === 'horizontal'
            ? { x: 0, y: -offsetAmount }
            : { x: -offsetAmount, y: 0 };
        const pos = { x: extent.center.x + offset.x, y: extent.center.y + offset.y };
        ctx!.save();
        ctx!.translate(pos.x, pos.y);
        ctx!.scale(1 / zoomFactor, 1 / zoomFactor);
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';
        ctx!.globalAlpha = 0.25 + strength * 0.35;
        ctx!.fillStyle = THEME.preview;
        ctx!.beginPath();
        ctx!.arc(0, 0, indicatorRadius, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.globalAlpha = Math.min(0.6 + strength * 0.4, 0.95);
        ctx!.strokeStyle = THEME.preview;
        ctx!.lineWidth = renderWidth(1.4);
        ctx!.beginPath();
        ctx!.arc(0, 0, indicatorRadius, 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.globalAlpha = 1;
        ctx!.font = `${11}px sans-serif`;
        ctx!.fillStyle = '#0f172a';
        const tag = activeAxisSnap.axis === 'horizontal' ? 'H' : 'V';
        ctx!.fillText(tag, 0, 0);
        ctx!.restore();
      }
    }
  });

  // draw circles
  model.circles.forEach((circle, idx) => {
    if (circle.hidden && !showHidden) return;
    const center = model.points[circle.center];
    if (!center) return;
    const radius = circleRadius(circle);
    if (radius <= 1e-3) return;
    const style = circle.style;
    const selected = selectedCircleIndex === idx && selectionEdges;
    ctx!.save();
    ctx!.globalAlpha = circle.hidden && showHidden ? 0.4 : 1;
    ctx!.strokeStyle = style.color;
    ctx!.lineWidth = renderWidth(style.width);
    applyStrokeStyle(style.type);
    ctx!.beginPath();
    ctx!.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx!.stroke();
    if (style.tick) drawCircleTicks(center, radius, style.tick, ctx!);
    if (selected) {
      ctx!.strokeStyle = HIGHLIGHT_LINE.color;
      ctx!.lineWidth = renderWidth(style.width + HIGHLIGHT_LINE.width);
      ctx!.setLineDash(HIGHLIGHT_LINE.dash);
      ctx!.beginPath();
      ctx!.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.setLineDash([]);
    }
    ctx!.restore();
  });

  // draw arcs derived from circle points
  model.circles.forEach((circle, ci) => {
    if (circle.hidden && !showHidden) return;
    const arcs = circleArcs(ci);
    arcs.forEach((arc, ai) => {
      if (arc.hidden && !showHidden) return;
      const center = arc.center;
      const style = arc.style;
      ctx!.save();
      ctx!.strokeStyle = style.color;
      ctx!.lineWidth = renderWidth(style.width);
      applyStrokeStyle(style.type);
      ctx!.beginPath();
      ctx!.arc(center.x, center.y, arc.radius, arc.start, arc.end, arc.clockwise);
      ctx!.stroke();
      const baseTick = (circle.style.tick ?? 0) as TickLevel;
      const arcTick = (style.tick ?? baseTick) as TickLevel;
      if (arcTick) drawArcTicks(center, arc.radius, arc.start, arc.end, arc.clockwise, arcTick, ctx!);
      const key = arcKey(ci, ai);
      const isSelected =
        selectedCircleIndex === ci && (selectedArcSegments.size === 0 || selectedArcSegments.has(key));
      if (isSelected) {
        ctx!.strokeStyle = HIGHLIGHT_LINE.color;
        ctx!.lineWidth = renderWidth(style.width + HIGHLIGHT_LINE.width);
        ctx!.setLineDash(HIGHLIGHT_LINE.dash);
        ctx!.beginPath();
        ctx!.arc(center.x, center.y, arc.radius, arc.start, arc.end, arc.clockwise);
        ctx!.stroke();
        ctx!.setLineDash([]);
      }
      ctx!.restore();
    });
  });

  // draw angles
  model.angles.forEach((ang, idx) => {
    if (ang.hidden && !showHidden) return;
    const leg1 = ang.leg1;
    const leg2 = ang.leg2;
    const l1 = model.lines[leg1.line];
    const l2 = model.lines[leg2.line];
    if (!l1 || !l2) return;
    const v = model.points[ang.vertex];
    const a = model.points[l1.points[leg1.seg]];
    const b = model.points[l1.points[leg1.seg + 1]];
    const c = model.points[l2.points[leg2.seg]];
    const d = model.points[l2.points[leg2.seg + 1]];
    if (!v || !a || !b || !c || !d) return;
    const p1 = ang.vertex === l1.points[leg1.seg] ? b : a;
    const p2 = ang.vertex === l2.points[leg2.seg] ? d : c;
    const geom = angleGeometry(ang);
    if (!geom) return;
    const { start, end, clockwise, radius: r, style } = geom;
    ctx!.save();
    ctx!.strokeStyle = style.color;
    ctx!.lineWidth = renderWidth(style.width);
    applyStrokeStyle(style.type);
    if (style.fill) {
      ctx!.beginPath();
      ctx!.moveTo(v.x, v.y);
      ctx!.arc(v.x, v.y, r, start, end, clockwise);
      ctx!.closePath();
      ctx!.fillStyle = style.fill;
      ctx!.fill();
    }
    const isRight = !!style.right;
    const arcCount = Math.max(1, style.arcCount ?? 1);
    const isFilled = arcCount === 4;
    const drawArcs = () => {
      if (isFilled) {
        // Draw filled sector
        ctx!.beginPath();
        ctx!.moveTo(v.x, v.y);
        ctx!.arc(v.x, v.y, r, start, end, clockwise);
        ctx!.closePath();
        ctx!.fillStyle = style.color;
        ctx!.fill();
      } else {
        // Draw arc lines
        for (let i = 0; i < arcCount; i++) {
          const rr = Math.max(2, r - i * 6);
          ctx!.beginPath();
          ctx!.arc(v.x, v.y, rr, start, end, clockwise);
          ctx!.stroke();
        }
      }
    };
    const drawRightMark = () => {
      const p1 = ang.vertex === l1.points[leg1.seg] ? b : a;
      const p2 = ang.vertex === l2.points[leg2.seg] ? d : c;
      const legLen1 = Math.hypot(p1.x - v.x, p1.y - v.y);
      const legLen2 = Math.hypot(p2.x - v.x, p2.y - v.y);
      const usable = Math.max(0, Math.min(legLen1, legLen2) - RIGHT_ANGLE_MARK_MARGIN);
      if (usable <= 0) return;
      const u1 = normalize({ x: p1.x - v.x, y: p1.y - v.y });
      const u2 = normalize({ x: p2.x - v.x, y: p2.y - v.y });
      let size: number;
      if (usable < RIGHT_ANGLE_MARK_MIN) {
        size = usable;
      } else {
        const growth = Math.max(0, r - RIGHT_ANGLE_MARK_MIN) * RIGHT_ANGLE_MARK_RATIO;
        size = RIGHT_ANGLE_MARK_MIN + growth;
        size = Math.min(size, RIGHT_ANGLE_MARK_MAX, usable);
      }
      const pA = { x: v.x + u1.x * size, y: v.y + u1.y * size };
      const pC = { x: v.x + u2.x * size, y: v.y + u2.y * size };
      const pB = { x: pA.x + u2.x * size, y: pA.y + u2.y * size };
      ctx!.beginPath();
      ctx!.moveTo(v.x, v.y);
      ctx!.lineTo(pA.x, pA.y);
      ctx!.lineTo(pB.x, pB.y);
      ctx!.lineTo(pC.x, pC.y);
      ctx!.stroke();
    };
    if (isRight) {
      drawRightMark();
    } else {
      drawArcs();
    }
    const selected = selectedAngleIndex === idx;
    if (selected) {
      ctx!.strokeStyle = HIGHLIGHT_LINE.color;
      ctx!.lineWidth = renderWidth(style.width + HIGHLIGHT_LINE.width);
      ctx!.setLineDash(HIGHLIGHT_LINE.dash);
      if (isRight) {
        drawRightMark();
      } else if (isFilled) {
        // For filled angles, draw outline for highlight
        ctx!.beginPath();
        ctx!.moveTo(v.x, v.y);
        ctx!.arc(v.x, v.y, r, start, end, clockwise);
        ctx!.closePath();
        ctx!.stroke();
      } else {
        drawArcs();
      }
      ctx!.setLineDash([]);
    }
    if (ang.label && !ang.label.hidden) {
      if (!ang.label.offset) ang.label.offset = defaultAngleLabelOffset(idx);
      const off = ang.label.offset ?? { x: 0, y: 0 };
      const selected = selectedLabel?.kind === 'angle' && selectedLabel.id === idx;
      drawLabelText(ang.label, v, selected, off);
    }
    ctx!.restore();
  });

  model.points.forEach((p, idx) => {
    if (p.style.hidden && !showHidden) return;
    const pointHidden = !!p.style.hidden;
    ctx!.save();
    ctx!.globalAlpha = pointHidden && showHidden ? 0.4 : 1;
    ctx!.fillStyle = p.style.color;
    const r = pointRadius(p.style.size);
    ctx!.save();
    ctx!.translate(p.x, p.y);
    ctx!.scale(1 / zoomFactor, 1 / zoomFactor);
    ctx!.beginPath();
    ctx!.arc(0, 0, r, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.restore();
    if (p.label && !p.label.hidden) {
      if (!p.label.offset) p.label.offset = defaultPointLabelOffset(idx);
      const off = p.label.offset ?? { x: 8, y: -8 };
      const selected = selectedLabel?.kind === 'point' && selectedLabel.id === idx;
      drawLabelText(p.label, { x: p.x, y: p.y }, selected, off);
    }
    const highlightPoint =
      idx === selectedPointIndex || (mode === 'circleThree' && circleThreePoints.includes(idx));
    const hoverPoint = hoverPointIndex === idx;
    const highlightColor =
      p.construction_kind === 'intersection' || p.construction_kind === 'midpoint' || p.construction_kind === 'symmetric'
        ? '#9ca3af'
        : p.construction_kind === 'on_object'
        ? '#ef4444'
        : HIGHLIGHT_LINE.color;
    if (
      (highlightPoint ||
        hoverPoint ||
        (selectedLineIndex !== null && selectionVertices && pointInLine(idx, model.lines[selectedLineIndex])) ||
        (selectedPolygonIndex !== null && selectionVertices && polygonHasPoint(idx, model.polygons[selectedPolygonIndex])) ||
        (selectedCircleIndex !== null && selectionVertices && (
          circleHasDefiningPoint(model.circles[selectedCircleIndex], idx) ||
          (model.circles[selectedCircleIndex].circle_kind === 'center-radius' &&
            (model.circles[selectedCircleIndex].center === idx || model.circles[selectedCircleIndex].radius_point === idx))
        ))) &&
      (!p.style.hidden || showHidden)
    ) {
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.scale(1 / zoomFactor, 1 / zoomFactor);
      ctx!.strokeStyle = highlightColor;
      ctx!.lineWidth = THEME.highlightWidth ?? 2;
      ctx!.beginPath();
      ctx!.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.restore();
    }
    ctx!.restore();
  });

// free labels
  model.labels.forEach((lab, idx) => {
    if (lab.hidden && !showHidden) return;
    const selected = selectedLabel?.kind === 'free' && selectedLabel.id === idx;
    drawLabelText({ text: lab.text, color: lab.color, fontSize: lab.fontSize }, lab.pos, selected);
  });

  // measurement labels (when showMeasurements is active)
  if (showMeasurements) {
    measurementLabels.forEach((label) => {
      const text = getMeasurementLabelText(label);
      
      ctx!.save();
      ctx!.translate(label.pos.x, label.pos.y);
      ctx!.scale(1 / zoomFactor, 1 / zoomFactor);
      
      const fontSize = label.fontSize ?? getLabelFontDefault();
      ctx!.font = `${fontSize}px sans-serif`;
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      
      // Calculate background size based on text or placeholder
      const displayText = text || '—';
      const metrics = ctx!.measureText(displayText);
      const padding = 6;
      const minWidth = 30; // Minimum width for empty labels
      const bgWidth = Math.max(metrics.width + padding * 2, minWidth);
      const bgHeight = fontSize + padding * 2;
      
      // Background - lighter for empty labels
      const isEmpty = text === '—' || text === '';
      if (label.pinned) {
        ctx!.fillStyle = '#fbbf24';
      } else if (isEmpty && label.kind === 'segment') {
        ctx!.fillStyle = THEME.bg;
      } else {
        ctx!.fillStyle = THEME.bg;
      }
      ctx!.fillRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight);
      
      // Border - dashed for empty segment labels
      ctx!.strokeStyle = label.color ?? THEME.defaultStroke;
      ctx!.lineWidth = 1;
      if (isEmpty && label.kind === 'segment') {
        ctx!.setLineDash([3, 3]);
      }
      ctx!.strokeRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight);
      ctx!.setLineDash([]);
      
      // Text
      ctx!.fillStyle = label.pinned ? '#000000' : (label.color ?? THEME.defaultStroke);
      if (isEmpty && label.kind === 'segment') {
        ctx!.globalAlpha = 0.4;
      }
      ctx!.fillText(displayText, 0, 0);
      
      ctx!.restore();
    });
  }

  model.inkStrokes.forEach((stroke, idx) => {
    if (stroke.hidden && !showHidden) return;
    ctx!.save();
    if (stroke.hidden && showHidden) ctx!.globalAlpha = 0.4;
    renderInkStroke(stroke, ctx!);
    if (idx === selectedInkStrokeIndex) {
      const bounds = strokeBounds(stroke);
      if (bounds) {
        ctx!.strokeStyle = HIGHLIGHT_LINE.color;
        ctx!.lineWidth = renderWidth(THEME.highlightWidth ?? 2);
        ctx!.setLineDash(HIGHLIGHT_LINE.dash);
        const margin = screenUnits(8);
        ctx!.strokeRect(
          bounds.minX - margin,
          bounds.minY - margin,
          bounds.maxX - bounds.minX + margin * 2,
          bounds.maxY - bounds.minY + margin * 2
        );
        ctx!.setLineDash([]);
      }
    }
    ctx!.restore();
  });

  // Draw multiselect box
  if (mode === 'multiselect' && multiselectBoxStart && multiselectBoxEnd) {
    ctx!.save();
    ctx!.strokeStyle = THEME.highlight;
    ctx!.lineWidth = renderWidth(THEME.highlightWidth ?? 2);
    ctx!.setLineDash([4, 4]);
    ctx!.fillStyle = THEME.highlight + '20';
    const x1 = Math.min(multiselectBoxStart.x, multiselectBoxEnd.x);
    const y1 = Math.min(multiselectBoxStart.y, multiselectBoxEnd.y);
    const w = Math.abs(multiselectBoxEnd.x - multiselectBoxStart.x);
    const h = Math.abs(multiselectBoxEnd.y - multiselectBoxStart.y);
    ctx!.fillRect(x1, y1, w, h);
    ctx!.strokeRect(x1, y1, w, h);
    ctx!.setLineDash([]);
    ctx!.restore();
  }

  // Highlight multiselected objects
  if (mode === 'multiselect') {
    ctx!.save();
    ctx!.strokeStyle = THEME.highlight;
    ctx!.lineWidth = renderWidth(THEME.highlightWidth ?? 3);
    ctx!.setLineDash([6, 3]);
    
    multiSelectedPoints.forEach(idx => {
      const p = model.points[idx];
      if (!p) return;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, screenUnits(12), 0, Math.PI * 2);
      ctx!.stroke();
    });
    
    multiSelectedLines.forEach(idx => {
      const line = model.lines[idx];
      if (!line) return;
      line.points.forEach((pi, i) => {
        if (i === 0) return;
        const a = model.points[line.points[i - 1]];
        const b = model.points[pi];
        if (!a || !b) return;
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();
      });
    });
    
    multiSelectedCircles.forEach(idx => {
      const circle = model.circles[idx];
      if (!circle) return;
      const center = model.points[circle.center];
      if (!center) return;
      const radius = circleRadius(circle);
      ctx!.beginPath();
      ctx!.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx!.stroke();
    });
    
    multiSelectedAngles.forEach(idx => {
      const ang = model.angles[idx];
      if (!ang) return;
      const geom = angleGeometry(ang);
      if (!geom) return;
      const v = model.points[ang.vertex];
      if (!v) return;
      ctx!.beginPath();
      ctx!.arc(v.x, v.y, geom.radius, geom.start, geom.end, geom.clockwise);
      ctx!.stroke();
    });

    // Highlight multiselected ink (handwriting) strokes by drawing bounding boxes
    multiSelectedInkStrokes.forEach(idx => {
      const stroke = model.inkStrokes[idx];
      if (!stroke) return;
      const bounds = strokeBounds(stroke);
      if (!bounds) return;
      const margin = screenUnits(8);
      ctx!.beginPath();
      ctx!.rect(
        bounds.minX - margin,
        bounds.minY - margin,
        bounds.maxX - bounds.minX + margin * 2,
        bounds.maxY - bounds.minY + margin * 2
      );
      ctx!.stroke();
    });
    
    ctx!.setLineDash([]);
    ctx!.restore();
  }

  drawDebugLabels();
  renderDebugPanel();
}

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  draw();
}

const nowTime = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

const currentInkColor = () => styleColorInput?.value ?? THEME.defaultStroke;

const pointerPressure = (ev: PointerEvent) => {
  const raw = Number(ev.pressure);
  if (!Number.isFinite(raw) || raw <= 0) return INK_PRESSURE_FALLBACK;
  return clamp(raw, 0.05, 1);
};

function createInkPoint(ev: PointerEvent): InkPoint {
  const pos = toPoint(ev);
  return {
    x: pos.x,
    y: pos.y,
    pressure: pointerPressure(ev),
    time: nowTime()
  };
}

function beginInkStroke(ev: PointerEvent) {
  if (!canvas) return;
  const point = createInkPoint(ev);
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `ink-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const stroke: InkStroke = {
    id,
    points: [point],
    color: currentInkColor(),
    baseWidth: inkBaseWidth
  };
  model.inkStrokes.push(stroke);
  activeInkStroke = { pointerId: ev.pointerId, stroke };
  clearSelectionState();
  updateSelectionButtons();
  movedDuringDrag = true;
  try {
    canvas.setPointerCapture(ev.pointerId);
  } catch {
    /* ignore capture errors */
  }
  ev.preventDefault();
  draw();
}

function appendInkStrokePoint(ev: PointerEvent) {
  if (!activeInkStroke || activeInkStroke.pointerId !== ev.pointerId) return;
  const { stroke } = activeInkStroke;
  const next = createInkPoint(ev);
  const points = stroke.points;
  if (points.length) {
    const prev = points[points.length - 1];
    const dx = (next.x - prev.x) * zoomFactor;
    const dy = (next.y - prev.y) * zoomFactor;
    const dist = Math.hypot(dx, dy);
    if (dist < INK_MIN_SAMPLE_PX) {
      points[points.length - 1] = next;
      ev.preventDefault();
      draw();
      return;
    }
  }
  points.push(next);
  movedDuringDrag = true;
  ev.preventDefault();
  draw();
}

function endInkStroke(pointerId: number) {
  if (!activeInkStroke || activeInkStroke.pointerId !== pointerId) return;
  const { stroke } = activeInkStroke;
  if (stroke.points.length === 1) {
    const pt = stroke.points[0];
    stroke.points[0] = { ...pt, pressure: Math.max(pt.pressure, 0.5), time: pt.time };
  }
  try {
    canvas?.releasePointerCapture(pointerId);
  } catch {
    /* ignore release errors */
  }
  activeInkStroke = null;
}

function setMode(next: Mode) {
  // No special handling needed for measurements anymore
  
  mode = next;
  
  // Wyłącz tryb kopiowania stylu przy zmianie narzędzia (ale nie gdy wracamy do 'move')
  if (copyStyleActive && next !== 'move') {
    copyStyleActive = false;
  }
  
  // Reset multi-buttons to main function when switching tools
  Object.entries(buttonConfig.multiButtons).forEach(([mainId, buttonIds]) => {
    const currentIndex = multiButtonStates[mainId] || 0;
    
    // If we're not on the main (first) function, reset to it
    if (currentIndex !== 0) {
      const currentToolId = buttonIds[currentIndex];
      const currentTool = TOOL_BUTTONS.find(t => t.id === currentToolId);
      
      // Check if we're leaving this tool
      let leavingThisTool = false;
      if (currentToolId === 'copyStyleBtn') {
        // copyStyleBtn is being deactivated above if mode !== 'move'
        leavingThisTool = next !== 'move';
      } else if (currentTool) {
        leavingThisTool = next !== currentTool.mode;
      }
      
      if (leavingThisTool) {
        // Reset to main function
        multiButtonStates[mainId] = 0;
        
        // Update button visual
        const mainBtn = document.getElementById(mainId);
        if (mainBtn) {
          const firstToolId = buttonIds[0];
          const firstTool = TOOL_BUTTONS.find(t => t.id === firstToolId);
          
          if (firstTool) {
            const svgElement = mainBtn.querySelector('svg');
            if (svgElement) {
              svgElement.setAttribute('viewBox', firstTool.viewBox);
              svgElement.innerHTML = firstTool.icon;
            }
            mainBtn.setAttribute('title', firstTool.label);
            mainBtn.setAttribute('aria-label', firstTool.label);
          }
        }
      }
    }
  });
  
  // Hide second row if switching to a mode that's not in the current second row
  if (secondRowVisible && secondRowToolIds.length > 0) {
    const currentToolButton = TOOL_BUTTONS.find(t => t.mode === mode);
    if (currentToolButton && !secondRowToolIds.includes(currentToolButton.id)) {
      hideSecondRow();
    }
  }
  
  // Update active states in second row if visible
  updateSecondRowActiveStates();
  
  // Clear all selections when changing mode (except multiselect itself)
  if (mode !== 'multiselect') {
    clearMultiSelection();
  }
  
  // For segment mode, capture selected point BEFORE clearing if coming from move mode
  // REMOVED: We don't want to use selected point as segment start
  
  // Clear single selections early (but not for 'move' or 'label' mode)
  if (mode !== 'move' && mode !== 'label') {
    selectedPointIndex = null;
    selectedLineIndex = null;
    selectedCircleIndex = null;
    selectedPolygonIndex = null;
    selectedAngleIndex = null;
    selectedInkStrokeIndex = null;
    selectedLabel = null;
    selectedSegments.clear();
    selectedArcSegments.clear();
  }
  
  if (mode !== 'segment') {
    segmentStartIndex = null;
    segmentStartTemporary = false;
  } else {
    // Switching TO segment mode - always clear start point
    segmentStartIndex = null;
    segmentStartTemporary = false;
  }
  if (mode === 'circle') {
    circleCenterIndex = null;
    pendingCircleRadiusPoint = null;
    updateSelectionButtons();
  }
  if (mode !== 'parallel' && mode !== 'perpendicular' && mode !== 'circle') {
    pendingParallelLine = null;
    pendingParallelPoint = null;
    circleCenterIndex = null;
    pendingCircleRadiusPoint = null;
    pendingCircleRadiusLength = null;
    circleThreePoints = [];
    triangleStartIndex = null;
    squareStartIndex = null;
    polygonChain = [];
    currentPolygonLines = [];
    angleFirstLeg = null;
    anglePoints = [];
    bisectorFirstLeg = null;
    midpointFirstIndex = null;
    symmetricSourceIndex = null;
  }
  if (mode !== 'parallelLine') {
    parallelAnchorPointIndex = null;
    parallelReferenceLineIndex = null;
  }
  if (activeInkStroke && mode !== 'handwriting') {
    activeInkStroke = null;
  }
  if (eraserActive && mode !== 'handwriting') {
    eraserActive = false;
    if (eraserBtn) {
      eraserBtn.classList.remove('active');
      eraserBtn.setAttribute('aria-pressed', 'false');
    }
  }
  
  // Handle LABEL mode - add labels to selected objects and switch back to move
  if (mode === 'label') {
    const color = styleColorInput?.value || '#000';
    let changed = false;
    
    const polygonHasLabels = (polyIdx: number | null) => {
      if (polyIdx === null) return false;
      const verts = polygonVerticesOrdered(polyIdx);
      return verts.length > 0 && verts.every((vi) => !!model.points[vi]?.label);
    };
    
    // Add label to selected angle
    if (selectedAngleIndex !== null) {
      if (!model.angles[selectedAngleIndex].label) {
        const { text, seq } = nextGreek();
        model.angles[selectedAngleIndex].label = {
          text,
          color,
          offset: defaultAngleLabelOffset(selectedAngleIndex),
          fontSize: getLabelFontDefault(),
          seq
        };
        changed = true;
      }
    }
    // Add labels to selected polygon or line
    else if (selectedPolygonIndex !== null || selectedLineIndex !== null) {
      // Determine what to label based on selection mode
      const shouldLabelEdges = selectionEdges || selectedSegments.size > 0;
      const shouldLabelVertices = selectionVertices;
      
      if (selectedPolygonIndex !== null) {
        // Label polygon edges if selected
        if (shouldLabelEdges && selectedSegments.size > 0) {
          selectedSegments.forEach((key) => {
            const parsed = parseSegmentKey(key);
            if (!parsed || parsed.part !== 'segment') return;
            const li = parsed.line;
            if (!model.lines[li]) return;
            if (!model.lines[li].label) {
              const { text, seq } = nextLower();
              model.lines[li].label = {
                text,
                color,
                offset: defaultLineLabelOffset(li),
                fontSize: getLabelFontDefault(),
                seq
              };
              changed = true;
            }
          });
        }
        
        // Label polygon vertices - always label if not all vertices have labels
        if (!polygonHasLabels(selectedPolygonIndex)) {
        // Label all vertices
        const verts = polygonVerticesOrdered(selectedPolygonIndex);
        
        // Check if any vertex already has a label
        let baseLabel: string | null = null;
        let startIndex = 1;
        let labeledVertexPosition = -1;
        let isLetterPattern = false;
        
        for (let i = 0; i < verts.length; i++) {
          const vi = verts[i];
          const existingLabel = model.points[vi]?.label?.text;
          if (existingLabel) {
            // Check for pattern: "base_number" (e.g., "P_1", "A_12")
            const subscriptMatch = existingLabel.match(/^(.+?)_(\d+)$/);
            if (subscriptMatch) {
              baseLabel = subscriptMatch[1];
              startIndex = parseInt(subscriptMatch[2], 10);
              labeledVertexPosition = i;
              isLetterPattern = false;
              break;
            }
            // Check for single uppercase letter pattern (e.g., "A", "B", "C")
            else if (existingLabel.length === 1) {
              const upperIdx = UPPER_SEQ.indexOf(existingLabel);
              if (upperIdx >= 0) {
                startIndex = upperIdx;
                labeledVertexPosition = i;
                isLetterPattern = true;
                break;
              }
            }
          }
        }
        
        if (isLetterPattern && labeledVertexPosition >= 0) {
          // Use letter sequence pattern (UPPER_SEQ)
          verts.forEach((vi, i) => {
            if (!model.points[vi].label) {
              const offset = (i - labeledVertexPosition + verts.length) % verts.length;
              const letterIdx = (startIndex + offset) % UPPER_SEQ.length;
              const text = UPPER_SEQ[letterIdx];
              model.points[vi].label = {
                text,
                color,
                offset: defaultPointLabelOffset(vi),
                fontSize: getLabelFontDefault(),
                seq: undefined // Custom label, no sequence
              };
            }
          });
          changed = true;
        } else if (baseLabel && labeledVertexPosition >= 0) {
          // Use the subscript pattern found, numbering in reverse direction from the labeled vertex
          verts.forEach((vi, i) => {
            if (!model.points[vi].label) {
              const offset = (labeledVertexPosition - i + verts.length) % verts.length;
              const index = ((startIndex - 1 + offset) % verts.length) + 1;
              const text = `${baseLabel}_${index}`;
              model.points[vi].label = {
                text,
                color,
                offset: defaultPointLabelOffset(vi),
                fontSize: getLabelFontDefault(),
                seq: undefined // Custom label, no sequence
              };
            }
          });
          changed = true;
        } else {
          // Default behavior - use sequential uppercase letters
          verts.forEach((vi, i) => {
            const idx = labelUpperIdx + i;
            const text = seqLetter(idx, UPPER_SEQ);
            model.points[vi].label = {
              text,
              color,
              offset: defaultPointLabelOffset(vi),
              fontSize: getLabelFontDefault(),
              seq: { kind: 'upper' as const, idx }
            };
          });
          labelUpperIdx += verts.length;
          changed = verts.length > 0;
        }
        }
      } else if (selectedLineIndex !== null) {
        // Label line edges (segments)
        if (shouldLabelEdges && !model.lines[selectedLineIndex].label) {
          const { text, seq } = nextLower();
          model.lines[selectedLineIndex].label = {
            text,
            color,
            offset: defaultLineLabelOffset(selectedLineIndex),
            fontSize: getLabelFontDefault(),
            seq
          };
          changed = true;
        }
        // Label line vertices (endpoints)
        if (shouldLabelVertices) {
          const line = model.lines[selectedLineIndex];
          if (line && line.defining_points) {
            line.defining_points.forEach(pIdx => {
              if (!model.points[pIdx].label) {
                const { text, seq } = nextUpper();
                model.points[pIdx].label = {
                  text,
                  color,
                  offset: defaultPointLabelOffset(pIdx),
                  fontSize: getLabelFontDefault(),
                  seq
                };
                changed = true;
              }
            });
          }
        }
      }
    }
    // Add label to selected point
    else if (selectedPointIndex !== null) {
      if (!model.points[selectedPointIndex].label) {
        const { text, seq } = nextUpper();
        model.points[selectedPointIndex].label = {
          text,
          color,
          offset: defaultPointLabelOffset(selectedPointIndex),
          fontSize: getLabelFontDefault(),
          seq
        };
        changed = true;
      }
    }
    
    // If we added a label to a selected object, switch back to move mode
    if (changed) {
      pushHistory();
      mode = 'move';
      updateToolButtons();
      draw();
      return;
    }
    // Otherwise stay in label mode and wait for user to click on an object
  }
  
  updateToolButtons();
  draw();
}

function createNgonFromBase() {
  if (squareStartIndex === null || ngonSecondIndex === null) return;
  const aIdx = squareStartIndex;
  const bIdx = ngonSecondIndex;
  const a = model.points[aIdx];
  const b = model.points[bIdx];
  if (!a || !b) return;

  const base = { x: b.x - a.x, y: b.y - a.y };
  const len = Math.hypot(base.x, base.y) || 1;
  let perp = { x: -base.y / len, y: base.x / len };
  if (perp.y > 0) {
    perp = { x: -perp.x, y: -perp.y };
  }
  const side = len;
  const R = side / (2 * Math.sin(Math.PI / ngonSides));
  const apothem = side / (2 * Math.tan(Math.PI / ngonSides));
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const center = { x: mid.x + perp.x * apothem, y: mid.y + perp.y * apothem };
  const angA = Math.atan2(a.y - center.y, a.x - center.x);
  const angB = Math.atan2(b.y - center.y, b.x - center.x);
  const stepAngle = (2 * Math.PI) / ngonSides;
  const ccwDiff = (angB - angA + Math.PI * 2) % (Math.PI * 2);
  const cwDiff = (angA - angB + Math.PI * 2) % (Math.PI * 2);
  const useCcw = Math.abs(ccwDiff - stepAngle) <= Math.abs(cwDiff - stepAngle);
  const signedStep = useCcw ? stepAngle : -stepAngle;
  const startAng = angA;
  const coords: { x: number; y: number }[] = [];
  for (let i = 0; i < ngonSides; i++) {
    const ang = startAng + i * signedStep;
    coords.push({ x: center.x + Math.cos(ang) * R, y: center.y + Math.sin(ang) * R });
  }
  const verts: number[] = [];
  for (let i = 0; i < coords.length; i++) {
    if (i === 0) {
      verts.push(aIdx);
      continue;
    }
    if (i === 1) {
      verts.push(bIdx);
      continue;
    }
    const p = coords[i];
    const idx = addPoint(model, { ...p, style: currentPointStyle() });
    verts.push(idx);
  }
  const style = currentStrokeStyle();
  const polyLines: number[] = [];
  for (let i = 0; i < verts.length; i++) {
    const u = verts[i];
    const v = verts[(i + 1) % verts.length];
    const l = addLineFromPoints(model, u, v, style);
    polyLines.push(l);
  }
  const polyId = nextId('polygon', model);
  model.polygons.push({
    object_type: 'polygon',
    id: polyId,
    lines: polyLines,
    construction_kind: 'free',
    defining_parents: [],
    children: [],
    recompute: () => {},
    on_parent_deleted: () => {}
  });
  registerIndex(model, 'polygon', polyId, model.polygons.length - 1);
  squareStartIndex = null;
  ngonSecondIndex = null;
  selectedPolygonIndex = model.polygons.length - 1;
  selectedLineIndex = polyLines[0];
  selectedPointIndex = null;
  draw();
  pushHistory();
  maybeRevertMode();
  updateSelectionButtons();
}

function ensureSegment(p1: number, p2: number): { line: number; seg: number } {
  // Check if segment exists
  for (let i = 0; i < model.lines.length; i++) {
    const line = model.lines[i];
    for (let j = 0; j < line.points.length - 1; j++) {
      const a = line.points[j];
      const b = line.points[j + 1];
      if ((a === p1 && b === p2) || (a === p2 && b === p1)) {
        return { line: i, seg: j };
      }
    }
  }
  // Create new line
  const lineIdx = addLineFromPoints(model, p1, p2, currentStrokeStyle());
  return { line: lineIdx, seg: 0 };
}

function handleCanvasClick(ev: PointerEvent) {
  if (!canvas) return;
  
  if (ev.pointerType === 'touch') {
    updateTouchPointFromEvent(ev);
    try {
      canvas!.setPointerCapture(ev.pointerId);
    } catch (_) {
      /* ignore capture errors */
    }
    if (activeTouches.size >= 2) {
      if (!pinchState) startPinchFromTouches();
      ev.preventDefault();
      return;
    }
  }
  if (mode === 'handwriting') {
    if (eraserActive) {
      const { x, y } = toPoint(ev);
      const hit = findInkStrokeAt({ x, y });
      if (hit !== null) {
        model.inkStrokes.splice(hit, 1);
        pushHistory();
        draw();
      }
      return;
    }
    beginInkStroke(ev);
    return;
  }
  const { x, y } = toPoint(ev);
  draggingCircleCenterAngles = null;
  circleDragContext = null;
  
  // Check for measurement label clicks (works in any mode when measurements are shown)
  if (showMeasurements) {
    const measurementLabelHit = measurementLabels.find(label => {
      const dx = label.pos.x - x;
      const dy = label.pos.y - y;
      const dist = Math.hypot(dx, dy);
      return dist <= screenUnits(LABEL_HIT_RADIUS);
    });
    
    if (measurementLabelHit && measurementLabelHit.kind === 'segment') {
      const text = getMeasurementLabelText(measurementLabelHit);
      const isEmpty = text === '—' || text === '';
      
      // For empty labels or pinned labels on double-click: show input box
      if (isEmpty || (measurementLabelHit.pinned && ev.detail === 2)) {
        ev.preventDefault();
        ev.stopPropagation();
        showMeasurementInputBox(measurementLabelHit);
        return;
      }
      
      // For filled labels: toggle pinned state (mark/unmark)
      if (!isEmpty) {
        measurementLabelHit.pinned = !measurementLabelHit.pinned;
        if (measurementLabelHit.pinned) {
          measurementLabelHit.color = '#fbbf24';
        } else {
          measurementLabelHit.color = THEME.defaultStroke;
        }
        draw();
        return;
      }
    }
    
    if (measurementLabelHit && measurementLabelHit.kind === 'angle') {
      // For angles: toggle pinned state or edit on double-click
      if (ev.detail === 2) {
        ev.preventDefault();
        ev.stopPropagation();
        showMeasurementInputBox(measurementLabelHit);
        return;
      }
      
      measurementLabelHit.pinned = !measurementLabelHit.pinned;
      if (measurementLabelHit.pinned) {
        measurementLabelHit.color = '#fbbf24';
      } else {
        measurementLabelHit.color = THEME.defaultStroke;
      }
      draw();
      return;
    }
  }
  
  if (mode === 'move') {
    const labelHit = findLabelAt({ x, y });
    if (labelHit) {
      selectLabel(labelHit);
      let initialOffset = { x: 0, y: 0 };
      switch (labelHit.kind) {
        case 'point': {
          const p = model.points[labelHit.id];
          if (p?.label) {
            if (!p.label.offset) p.label.offset = defaultPointLabelOffset(labelHit.id);
            initialOffset = p.label.offset ?? { x: 0, y: 0 };
          }
          break;
        }
        case 'line': {
          const l = model.lines[labelHit.id];
          if (l?.label) {
            if (!l.label.offset) l.label.offset = defaultLineLabelOffset(labelHit.id);
            initialOffset = l.label.offset ?? { x: 0, y: 0 };
          }
          break;
        }
        case 'angle': {
          const a = model.angles[labelHit.id];
          if (a?.label) {
            if (!a.label.offset) a.label.offset = defaultAngleLabelOffset(labelHit.id);
            initialOffset = a.label.offset ?? { x: 0, y: 0 };
          }
          break;
        }
        case 'free': {
          const lab = model.labels[labelHit.id];
          if (lab) initialOffset = { x: lab.pos.x, y: lab.pos.y };
          break;
        }
      }
      draggingLabel = {
        kind: labelHit.kind,
        id: labelHit.id,
        start: { x, y },
        initialOffset: { ...initialOffset }
      };
      movedDuringDrag = false;
      return;
    } else if (selectedLabel) {
      selectLabel(null);
    }
  }
  if (mode === 'move') {
    const handleHit = findHandle({ x, y });
    if (handleHit !== null) {
      if (!isLineDraggable(model.lines[handleHit])) {
        return;
      }
      const extent = lineExtent(handleHit);
      if (extent) {
        const polyLines =
          selectedPolygonIndex !== null &&
          selectedSegments.size === 0 &&
          model.polygons[selectedPolygonIndex]?.lines.includes(handleHit)
            ? model.polygons[selectedPolygonIndex]!.lines
            : [handleHit];
        const pointSet = new Set<number>();
        polyLines.forEach((li) => {
          model.lines[li]?.points.forEach((pi) => pointSet.add(pi));
        });
        const pts = Array.from(pointSet).map((pi) => ({ idx: pi, p: model.points[pi] })).filter((e) => e.p);
        const center =
          pts.length > 0
            ? {
                x: pts.reduce((sum, e) => sum + e.p.x, 0) / pts.length,
                y: pts.reduce((sum, e) => sum + e.p.y, 0) / pts.length
              }
            : extent.center;
        const vectors: { idx: number; vx: number; vy: number }[] = [];
        let baseHalf = extent.half;
        pts.forEach(({ idx: pi, p }) => {
          const vx = p.x - center.x;
          const vy = p.y - center.y;
          vectors.push({ idx: pi, vx, vy });
          const proj = vx * extent.dir.x + vy * extent.dir.y;
          baseHalf = Math.max(baseHalf, Math.abs(proj));
        });
        resizingLine = {
          lineIdx: handleHit,
          center,
          dir: extent.dir,
          vectors: vectors.length
            ? vectors
            : extent.order.map((d) => ({
                idx: d.idx,
                vx: model.points[d.idx].x - extent.center.x,
                vy: model.points[d.idx].y - extent.center.y
              })),
          baseHalf: Math.max(1, baseHalf),
          lines: polyLines
        };
        updateSelectionButtons();
        draw();
        return;
      }
    }
  }
  if (mode === 'add') {
    // ensure previous circle highlight is cleared when placing a new point
    selectedCircleIndex = null;
    const lineHits = findLineHits({ x, y });
    const circleHits = findCircles({ x, y }, currentHitRadius(), false);
    let desiredPos: { x: number; y: number } = { x, y };

    const lineAnchors = lineHits
      .map((h) => ({ hit: h, anchors: lineAnchorForHit(h), line: model.lines[h.line] }))
      .filter(
        (h): h is { hit: LineHit; anchors: { a: { x: number; y: number }; b: { x: number; y: number } }; line: Line } =>
          !!h.anchors && !!h.line
      );
    const circleAnchors = circleHits
      .map((h) => {
        const c = model.circles[h.circle];
        const cen = model.points[c?.center ?? -1];
        if (!c || !cen) return null;
        const radius = circleRadius(c);
        if (radius <= 1e-3) return null;
        return { center: { x: cen.x, y: cen.y }, radius, idx: h.circle, id: c.id };
      })
      .filter((v): v is { center: { x: number; y: number }; radius: number; idx: number; id: string } => !!v);

    const candidates: { pos: { x: number; y: number }; parents: ConstructionParent[] }[] = [];
    // line-line
    for (let i = 0; i < lineAnchors.length; i++) {
      for (let j = i + 1; j < lineAnchors.length; j++) {
        const inter = intersectLines(
          lineAnchors[i].anchors.a,
          lineAnchors[i].anchors.b,
          lineAnchors[j].anchors.a,
          lineAnchors[j].anchors.b
        );
        const lineA = lineAnchors[i].line;
        const lineB = lineAnchors[j].line;
        if (inter && lineA && lineB) {
          candidates.push({
            pos: inter,
            parents: [
              { kind: 'line', id: lineA.id },
              { kind: 'line', id: lineB.id }
            ]
          });
        }
      }
    }
    // line-circle
    for (const l of lineAnchors) {
      for (const c of circleAnchors) {
        const inters = lineCircleIntersections(l.anchors.a, l.anchors.b, c.center, c.radius);
        const line = l.line;
        inters.forEach((pos) => {
          if (!line) return;
          candidates.push({
            pos,
            parents: [
              { kind: 'line', id: line.id },
              { kind: 'circle', id: c.id }
            ]
          });
        });
      }
    }
    // circle-circle
    for (let i = 0; i < circleAnchors.length; i++) {
      for (let j = i + 1; j < circleAnchors.length; j++) {
        const inters = circleCircleIntersections(
          circleAnchors[i].center,
          circleAnchors[i].radius,
          circleAnchors[j].center,
          circleAnchors[j].radius
        );
        inters.forEach((pos) =>
          candidates.push({
            pos,
            parents: [
              { kind: 'circle', id: circleAnchors[i].id },
              { kind: 'circle', id: circleAnchors[j].id }
            ]
          })
        );
      }
    }

    let pointParents: ConstructionParent[] = [];
    if (candidates.length) {
      candidates.sort(
        (a, b) => Math.hypot(a.pos.x - x, a.pos.y - y) - Math.hypot(b.pos.x - x, b.pos.y - y)
      );
      desiredPos = candidates[0].pos;
      pointParents = candidates[0].parents;
    } else if (circleAnchors.length === 1) {
      const c = circleAnchors[0];
      const dir = normalize({ x: x - c.center.x, y: y - c.center.y });
      desiredPos = { x: c.center.x + dir.x * c.radius, y: c.center.y + dir.y * c.radius };
      pointParents = [{ kind: 'circle', id: c.id }];
    } else if (lineAnchors.length === 1) {
      desiredPos = projectPointOnLine({ x, y }, lineAnchors[0].anchors.a, lineAnchors[0].anchors.b);
      const line = lineAnchors[0].line;
      if (line) pointParents = [{ kind: 'line', id: line.id }];
    }
    const idx = addPoint(model, { ...desiredPos, style: currentPointStyle(), defining_parents: pointParents });
    if (lineHits.length) {
      lineHits.forEach((hit) => attachPointToLine(idx, hit, { x, y }, desiredPos));
      selectedLineIndex = lineHits[0].line;
    }
    if (circleHits.length) {
      circleHits.forEach((hit) => attachPointToCircle(hit.circle, idx, desiredPos));
    }
    selectedPointIndex = idx;
    if (!lineHits.length) selectedLineIndex = null;
    selectedCircleIndex = null;
    updateSelectionButtons();
    draw();
    pushHistory();
    if (stickyTool === null) {
      setMode('move');
    } else {
      updateToolButtons();
    }
  } else if (mode === 'segment') {
    const hit = findPoint({ x, y });
    const start = segmentStartIndex ?? selectedPointIndex;
    selectedCircleIndex = null; // drop circle highlight when starting a segment
    selectedAngleIndex = null; // drop angle highlight when starting a segment
    if (start === null) {
      const newStart = hit ?? addPoint(model, { x, y, style: currentPointStyle() });
      segmentStartIndex = newStart;
      segmentStartTemporary = hit === null;
      selectedPointIndex = newStart;
      selectedLineIndex = null;
      draw();
    } else {
      const startPt = model.points[start];
      const endIsExisting = hit !== null;
      const endPos = endIsExisting ? { x, y } : snapDir(startPt, { x, y });
      const endIdx = hit ?? addPoint(model, { ...endPos, style: currentPointStyle() });
      const endPt = model.points[endIdx];
      if (startPt && endPt && startPt.x === endPt.x && startPt.y === endPt.y) {
        if (!endIsExisting) {
          model.points.pop();
          rebuildIndexMaps();
        } else if (segmentStartTemporary) {
          removePointsKeepingOrder([start]);
        }
        segmentStartIndex = null;
        segmentStartTemporary = false;
        selectedPointIndex = null;
        selectedLineIndex = null;
        draw();
        updateSelectionButtons();
        return;
      }
      const stroke = currentStrokeStyle();
      const lineIdx = addLineFromPoints(model, start, endIdx, stroke);
      segmentStartIndex = null;
      segmentStartTemporary = false;
      selectedPointIndex = null;
      selectedLineIndex = lineIdx;
      draw();
      maybeRevertMode();
      updateSelectionButtons();
      pushHistory();
    }
  } else if (mode === 'parallel' || mode === 'perpendicular') {
    let hitPoint = findPoint({ x, y });
    const lineHits = findLineHits({ x, y });
    let hitLine: LineHit | null = null;
    if (lineHits.length) {
      if (pendingParallelPoint !== null) {
        hitLine =
          lineHits.find((h) => !model.lines[h.line]?.points.includes(pendingParallelPoint!)) ?? lineHits[0];
      } else {
        hitLine = lineHits[0];
      }
      if (!hitPoint && hitLine.part === 'segment') {
        const line = model.lines[hitLine.line];
        const aIdx = line.points[0];
        const bIdx = line.points[line.points.length - 1];
        const a = model.points[aIdx];
        const b = model.points[bIdx];
        const tol = currentHitRadius();
        if (a && Math.hypot(a.x - x, a.y - y) <= tol) hitPoint = aIdx;
        else if (b && Math.hypot(b.x - x, b.y - y) <= tol) hitPoint = bIdx;
      }
    }
    if (hitPoint !== null) {
      pendingParallelPoint = hitPoint;
      selectedPointIndex = hitPoint;
      selectedCircleIndex = null;
      // keep existing line selection if set previously
    } else if (pendingParallelPoint === null && selectedPointIndex !== null) {
      pendingParallelPoint = selectedPointIndex;
    }
    if (hitLine !== null) {
      if (hitPoint !== null && model.lines[hitLine.line]?.points.includes(hitPoint)) {
        // prefer point selection; avoid overriding with the same line
      } else {
        pendingParallelLine = hitLine.line;
        selectedLineIndex = hitLine.line;
        selectedCircleIndex = null;
      }
    } else if (pendingParallelLine === null && selectedLineIndex !== null) {
      pendingParallelLine = selectedLineIndex;
    }
    draw();
    if (pendingParallelPoint !== null && pendingParallelLine !== null) {
      const created = createOffsetLineThroughPoint(mode, pendingParallelPoint, pendingParallelLine);
      pendingParallelLine = null;
      pendingParallelPoint = null;
      if (created !== null) {
        selectedLineIndex = created;
        selectedPointIndex = null;
        draw();
        pushHistory();
        maybeRevertMode();
        updateSelectionButtons();
      }
    }
  } else if (mode === 'symmetric') {
    const sourceIdx = symmetricSourceIndex;
    const hitPoint = findPoint({ x, y });
    const lineHit = findLine({ x, y });
    if (sourceIdx === null) {
      if (hitPoint === null) return;
      symmetricSourceIndex = hitPoint;
      selectedPointIndex = hitPoint;
      draw();
      return;
    }
    const source = model.points[sourceIdx];
    if (!source) {
      symmetricSourceIndex = null;
      maybeRevertMode();
      updateSelectionButtons();
      return;
    }
    let target: { x: number; y: number } | null = null;
    let meta: SymmetricMeta | null = null;
    let parents: ConstructionParent[] = [];
    if (hitPoint !== null) {
      const mirror = model.points[hitPoint];
      if (!mirror) return;
      meta = { source: source.id, mirror: { kind: 'point', id: mirror.id } };
      target = { x: mirror.x * 2 - source.x, y: mirror.y * 2 - source.y };
    } else if (lineHit && lineHit.part === 'segment') {
      const line = model.lines[lineHit.line];
      if (!line) return;
      meta = { source: source.id, mirror: { kind: 'line', id: line.id } };
      parents = [{ kind: 'line', id: line.id }];
      target = reflectPointAcrossLine(source, line);
    } else {
      return;
    }
    if (!meta || !target) return;
    const idx = addPoint(model, {
      ...target,
      style: symmetricPointStyle(),
      construction_kind: 'symmetric',
      defining_parents: parents,
      symmetric: meta
    });
    recomputeSymmetricPoint(idx);
    selectedPointIndex = idx;
    symmetricSourceIndex = null;
    draw();
    pushHistory();
    maybeRevertMode();
    updateSelectionButtons();
  } else if (mode === 'parallelLine') {
    const hitPoint = findPoint({ x, y });
    const lineHit = findLine({ x, y });
    const setAnchor = (idx: number) => {
      parallelAnchorPointIndex = idx;
      selectedPointIndex = idx;
      selectedLineIndex = null;
      draw();
    };
    if (parallelAnchorPointIndex === null) {
      if (hitPoint !== null) {
        setAnchor(hitPoint);
        return;
      }
      if (lineHit && lineHit.part === 'segment') {
        parallelReferenceLineIndex = lineHit.line;
        selectedLineIndex = lineHit.line;
        draw();
        return;
      }
      const idx = addPoint(model, { x, y, style: currentPointStyle() });
      setAnchor(idx);
      return;
    }
    if (parallelReferenceLineIndex === null) {
      if (lineHit && lineHit.part === 'segment') {
        parallelReferenceLineIndex = lineHit.line;
        selectedLineIndex = lineHit.line;
        const created = createParallelLineThroughPoint(parallelAnchorPointIndex, parallelReferenceLineIndex);
        parallelAnchorPointIndex = null;
        parallelReferenceLineIndex = null;
        if (created !== null) {
          selectedLineIndex = created;
          selectedPointIndex = null;
          draw();
          pushHistory();
          maybeRevertMode();
          updateSelectionButtons();
        } else {
          draw();
        }
        return;
      }
      if (hitPoint !== null) {
        setAnchor(hitPoint);
      }
      return;
    }
    // both anchor and reference already set; attempt creation
    const created = createParallelLineThroughPoint(parallelAnchorPointIndex, parallelReferenceLineIndex);
    parallelAnchorPointIndex = null;
    parallelReferenceLineIndex = null;
    if (created !== null) {
      selectedLineIndex = created;
      selectedPointIndex = null;
      draw();
      pushHistory();
      maybeRevertMode();
      updateSelectionButtons();
    } else {
      draw();
    }
  } else if (mode === 'circle') {
    const hitPoint = findPoint({ x, y });
    const centerIdx = circleCenterIndex ?? hitPoint ?? addPoint(model, { x, y, style: currentPointStyle() });
    
    if (circleCenterIndex === null) {
      // First click: set center
      circleCenterIndex = centerIdx;
      selectedPointIndex = centerIdx;
      draw();
      return;
    }
    
    // Second click: create circle with radius point
    const radiusPointIdx =
      pendingCircleRadiusPoint ??
      (hitPoint !== null && hitPoint !== centerIdx ? hitPoint : null) ??
      addPoint(
        model,
        hitPoint === null
          ? { ...snapDir(model.points[centerIdx], { x, y }), style: currentPointStyle() }
          : { x, y, style: currentPointStyle() }
      );
    const center = model.points[centerIdx];
    const radiusPt = model.points[radiusPointIdx];
    const radius = Math.hypot(center.x - radiusPt.x, center.y - radiusPt.y);
    
    if (radius <= 1e-6) {
      // Radius too small, cancel and keep center selected
      if (hitPoint === null && pendingCircleRadiusPoint === null) {
        removePointsKeepingOrder([radiusPointIdx]);
      }
      pendingCircleRadiusPoint = null;
      selectedPointIndex = centerIdx;
      draw();
      updateSelectionButtons();
      return;
    }
    
    const circleIdx = addCircleWithCenter(centerIdx, radius, [radiusPointIdx]);
    selectedCircleIndex = circleIdx;
    selectedPointIndex = null;
    circleCenterIndex = null;
    pendingCircleRadiusPoint = null;
    draw();
    pushHistory();
    if (stickyTool === null) {
      setMode('move');
    } else {
      maybeRevertMode();
    }
    updateSelectionButtons();
  } else if (mode === 'circleThree') {
    selectedLineIndex = null;
    selectedPointIndex = null;
    selectedCircleIndex = null;
    selectedPolygonIndex = null;
    selectedAngleIndex = null;
    selectedLabel = null;
    selectedArcSegments.clear();
    selectedSegments.clear();
    updateSelectionButtons();
    const hitPoint = findPoint({ x, y });
    const ptIdx = hitPoint ?? addPoint(model, { x, y, style: currentPointStyle() });
    const prevLen = circleThreePoints.length;
    circleThreePoints.push(ptIdx);
    // Keep the first selected point highlighted when picking the second one
    if (prevLen === 0) {
      selectedPointIndex = ptIdx;
    } else {
      selectedPointIndex = circleThreePoints[0];
    }
    selectedLineIndex = null;
    selectedCircleIndex = null;
    if (circleThreePoints.length === 3) {
      const circleIdx = addCircleThroughPoints(circleThreePoints as [number, number, number]);
      if (circleIdx !== null) {
        selectedCircleIndex = circleIdx;
        selectedPointIndex = null;
        pushHistory();
        maybeRevertMode();
      }
      circleThreePoints = [];
    }
    draw();
    updateSelectionButtons();
  } else if (mode === 'triangleUp') {
    const hitPoint = findPoint({ x, y });
    if (triangleStartIndex === null) {
      const idx = hitPoint ?? addPoint(model, { x, y, style: currentPointStyle() });
      triangleStartIndex = idx;
      selectedPolygonIndex = null;
      selectedPointIndex = idx;
      selectedLineIndex = null;
      selectedCircleIndex = null;
      draw();
      return;
    }
    const baseStart = model.points[triangleStartIndex];
    const snappedPos = hitPoint !== null ? { x, y } : snapDir(baseStart, { x, y });
    const idx = hitPoint ?? addPoint(model, { ...snappedPos, style: currentPointStyle() });
    const aIdx = triangleStartIndex;
    const bIdx = idx;
    const a = model.points[aIdx];
    const b = model.points[bIdx];
    const base = { x: b.x - a.x, y: b.y - a.y };
    const len = Math.hypot(base.x, base.y) || 1;
    let perp = { x: -base.y / len, y: base.x / len };
    if (perp.y > 0) {
      perp = { x: -perp.x, y: -perp.y };
    }
    const height = (Math.sqrt(3) / 2) * len;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const apex = { x: mid.x + perp.x * height, y: mid.y + perp.y * height };
    const cIdx = addPoint(model, { ...apex, style: currentPointStyle() });
    const style = currentStrokeStyle();
    const l1 = addLineFromPoints(model, aIdx, bIdx, style);
    const l2 = addLineFromPoints(model, bIdx, cIdx, style);
    const l3 = addLineFromPoints(model, cIdx, aIdx, style);
    const polyLines = [l1, l2, l3];
    const polyId = nextId('polygon', model);
    model.polygons.push({
      object_type: 'polygon',
      id: polyId,
      lines: polyLines,
      construction_kind: 'free',
      defining_parents: [],
      children: [],
      recompute: () => {},
      on_parent_deleted: () => {}
    });
    registerIndex(model, 'polygon', polyId, model.polygons.length - 1);
    triangleStartIndex = null;
    selectedPolygonIndex = model.polygons.length - 1;
    selectedLineIndex = polyLines[0];
    selectedPointIndex = null;
    draw();
    pushHistory();
    maybeRevertMode();
    updateSelectionButtons();
  } else if (mode === 'square') {
    const hitPoint = findPoint({ x, y });
    if (squareStartIndex === null) {
      const idx = hitPoint ?? addPoint(model, { x, y, style: currentPointStyle() });
      squareStartIndex = idx;
      selectedPolygonIndex = null;
      selectedPointIndex = idx;
      selectedLineIndex = null;
      selectedCircleIndex = null;
      draw();
      return;
    }
    const baseStart = model.points[squareStartIndex];
    const snappedPos = hitPoint !== null ? { x, y } : snapDir(baseStart, { x, y });
    const idx = hitPoint ?? addPoint(model, { ...snappedPos, style: currentPointStyle() });
    const aIdx = squareStartIndex;
    const bIdx = idx;
    const a = model.points[aIdx];
    const b = model.points[bIdx];
    const base = { x: b.x - a.x, y: b.y - a.y };
    const len = Math.hypot(base.x, base.y) || 1;
    let perp = { x: -base.y / len, y: base.x / len };
    if (perp.y > 0) {
      perp = { x: -perp.x, y: -perp.y };
    }
    const p3 = { x: b.x + perp.x * len, y: b.y + perp.y * len };
    const p4 = { x: a.x + perp.x * len, y: a.y + perp.y * len };
    const cIdx = addPoint(model, { ...p3, style: currentPointStyle() });
    const dIdx = addPoint(model, { ...p4, style: currentPointStyle() });
    const style = currentStrokeStyle();
    const l1 = addLineFromPoints(model, aIdx, bIdx, style);
    const l2 = addLineFromPoints(model, bIdx, cIdx, style);
    const l3 = addLineFromPoints(model, cIdx, dIdx, style);
    const l4 = addLineFromPoints(model, dIdx, aIdx, style);
    const polyLines = [l1, l2, l3, l4];
    const polyId = nextId('polygon', model);
    model.polygons.push({
      object_type: 'polygon',
      id: polyId,
      lines: polyLines,
      construction_kind: 'free',
      defining_parents: [],
      children: [],
      recompute: () => {},
      on_parent_deleted: () => {}
    });
    registerIndex(model, 'polygon', polyId, model.polygons.length - 1);
    squareStartIndex = null;
    selectedPolygonIndex = model.polygons.length - 1;
    selectedLineIndex = polyLines[0];
    selectedPointIndex = null;
    draw();
    pushHistory();
    maybeRevertMode();
    updateSelectionButtons();
  } else if (mode === 'polygon') {
    const hitPoint = findPoint({ x, y });
    const wasTemporary = hitPoint === null;
    const idx =
      hitPoint ??
      addPoint(
        model,
        polygonChain.length === 1
          ? { ...snapDir(model.points[polygonChain[0]], { x, y }), style: currentPointStyle() }
          : { x, y, style: currentPointStyle() }
      );
    if (!polygonChain.length) {
      currentPolygonLines = [];
      polygonChain.push(idx);
      selectedPointIndex = idx;
      selectedLineIndex = null;
      selectedCircleIndex = null;
      selectedPolygonIndex = null;
      draw();
      return;
    }
    const firstIdx = polygonChain[0];
    const lastIdx = polygonChain[polygonChain.length - 1];
    const lastPt = model.points[lastIdx];
    const newPt = model.points[idx];
    if (lastPt && newPt && Math.hypot(lastPt.x - newPt.x, lastPt.y - newPt.y) <= 1e-6) {
      if (wasTemporary) removePointsKeepingOrder([idx]);
      selectedPointIndex = lastIdx;
      draw();
      return;
    }
    const style = currentStrokeStyle();
    const tol = currentHitRadius();
    if (
      idx === firstIdx ||
      Math.hypot(model.points[firstIdx].x - model.points[idx].x, model.points[firstIdx].y - model.points[idx].y) <= tol
    ) {
      const closingLine = addLineFromPoints(model, lastIdx, firstIdx, style);
      currentPolygonLines.push(closingLine);
      const polyId = nextId('polygon', model);
      const poly: Polygon = {
        object_type: 'polygon',
        id: polyId,
        lines: [...currentPolygonLines],
        construction_kind: 'free',
        defining_parents: [],
        children: [],
        recompute: () => {},
        on_parent_deleted: () => {}
      };
      model.polygons.push(poly);
      registerIndex(model, 'polygon', polyId, model.polygons.length - 1);
      selectedPolygonIndex = model.polygons.length - 1;
      selectedLineIndex = poly.lines[0];
      selectedPointIndex = null;
      polygonChain = [];
      currentPolygonLines = [];
      draw();
      pushHistory();
      maybeRevertMode();
      updateSelectionButtons();
    } else {
      const newLine = addLineFromPoints(model, lastIdx, idx, style);
      currentPolygonLines.push(newLine);
      polygonChain.push(idx);
      selectedPointIndex = idx;
      selectedLineIndex = newLine;
      draw();
      updateSelectionButtons();
    }
  } else if (mode === 'angle') {
    const pointHit = findPoint({ x, y });
    if (pointHit !== null) {
      // Clear line selection if we start selecting points
      if (angleFirstLeg) {
        angleFirstLeg = null;
        selectedSegments.clear();
      }
      
      // Avoid adding the same point twice in a row
      if (anglePoints.length === 0 || anglePoints[anglePoints.length - 1] !== pointHit) {
        anglePoints.push(pointHit);
      }
      
      selectedPointIndex = pointHit;
      selectedLineIndex = null;
      selectedSegments.clear();
      
      if (anglePoints.length === 3) {
        const [p1, p2, p3] = anglePoints;
        
        if (p1 === p3) {
          anglePoints = [];
          selectedPointIndex = null;
          draw();
          return;
        }

        // p2 is the vertex
        const leg1 = ensureSegment(p1, p2);
        const leg2 = ensureSegment(p2, p3);
        
        const angleId = nextId('angle', model);
        model.angles.push({
          object_type: 'angle',
          id: angleId,
          leg1,
          leg2,
          vertex: p2,
          style: currentAngleStyle(),
          construction_kind: 'free',
          defining_parents: [],
          children: [],
          recompute: () => {},
          on_parent_deleted: () => {}
        });
        registerIndex(model, 'angle', angleId, model.angles.length - 1);
        selectedAngleIndex = model.angles.length - 1;
        selectedPointIndex = null;
        anglePoints = [];
        draw();
        pushHistory();
        maybeRevertMode();
      }
      updateSelectionButtons();
      draw();
      return;
    }

    const lineHit = findLine({ x, y });
    if (!lineHit || lineHit.part !== 'segment') return;
    
    // Clear point selection if we start selecting lines
    if (anglePoints.length > 0) {
      anglePoints = [];
      selectedPointIndex = null;
    }

    const l = model.lines[lineHit.line];
    const a = l.points[lineHit.seg];
    const b = l.points[lineHit.seg + 1];
    if (a === undefined || b === undefined) return;
    if (!angleFirstLeg) {
      angleFirstLeg = { line: lineHit.line, seg: lineHit.seg, a, b };
      selectedLineIndex = lineHit.line;
      selectedPointIndex = a;
      selectedSegments.clear();
      selectedSegments.add(segmentKey(lineHit.line, 'segment', lineHit.seg));
      updateSelectionButtons();
      draw();
      return;
    }
    const first = angleFirstLeg;
    // Prevent creating 0-degree angle (same segment clicked twice)
    if (first.line === lineHit.line && first.seg === lineHit.seg) {
      angleFirstLeg = null;
      selectedSegments.clear();
      selectedLineIndex = null;
      draw();
      return;
    }
    const shared = [a, b].find((p) => p === first.a || p === first.b);
    if (shared === undefined) {
      angleFirstLeg = null;
      selectedSegments.clear();
      selectedLineIndex = null;
      draw();
      return;
    }
    const vertex = shared;
    const other1 = vertex === first.a ? first.b : first.a;
    const other2 = a === vertex ? b : a;
    const v = model.points[vertex];
    const p1 = model.points[other1];
    const p2 = model.points[other2];
    if (!v || !p1 || !p2) {
      angleFirstLeg = null;
      return;
    }
    const style = currentStrokeStyle();
    const angleId = nextId('angle', model);
    model.angles.push({
      object_type: 'angle',
      id: angleId,
      leg1: { line: angleFirstLeg.line, seg: angleFirstLeg.seg },
      leg2: { line: lineHit.line, seg: lineHit.seg },
      vertex,
      style: currentAngleStyle(),
      construction_kind: 'free',
      defining_parents: [],
      children: [],
      recompute: () => {},
      on_parent_deleted: () => {}
    });
    registerIndex(model, 'angle', angleId, model.angles.length - 1);
    selectedAngleIndex = model.angles.length - 1;
    selectedLineIndex = null;
    selectedPointIndex = null;
    selectedSegments.clear();
    angleFirstLeg = null;
    draw();
    pushHistory();
    maybeRevertMode();
    updateSelectionButtons();
  } else if (mode === 'label') {
    // Label mode - wait for user to click on an object
    const pointHit = findPoint({ x, y });
    const lineHit = findLine({ x, y });
    const angleHit = findAngleAt({ x, y }, currentHitRadius(1.5));
    const polyHit = lineHit ? polygonForLine(lineHit.line) : selectedPolygonIndex;
    const color = styleColorInput?.value || '#000';
    let changed = false;
  const polygonHasLabels = (polyIdx: number | null) => {
    if (polyIdx === null) return false;
    const verts = polygonVerticesOrdered(polyIdx);
    return verts.length > 0 && verts.every((vi) => !!model.points[vi]?.label);
  };
    
    // Click on angle
    if (angleHit !== null) {
      if (!model.angles[angleHit].label) {
        const { text, seq } = nextGreek();
        model.angles[angleHit].label = {
          text,
          color,
          offset: defaultAngleLabelOffset(angleHit),
          fontSize: getLabelFontDefault(),
          seq
        };
        selectedAngleIndex = angleHit;
        changed = true;
        clearLabelSelection();
        setMode('move');
        updateToolButtons();
      } else {
        selectedAngleIndex = angleHit;
      }
    }
    // Click on point
    else if (pointHit !== null) {
      selectedPointIndex = pointHit;
      if (!model.points[pointHit].label) {
        const { text, seq } = nextUpper();
        model.points[pointHit].label = {
          text,
          color,
          offset: defaultPointLabelOffset(pointHit),
          fontSize: getLabelFontDefault(),
          seq
        };
        changed = true;
        clearLabelSelection();
        setMode('move');
        updateToolButtons();
      }
    }
    // Click on polygon
    else if (polyHit !== null) {
      selectedPolygonIndex = polyHit;
      if (!polygonHasLabels(polyHit)) {
        const verts = polygonVerticesOrdered(polyHit);
        verts.forEach((vi, i) => {
          const idx = labelUpperIdx + i;
          const text = seqLetter(idx, UPPER_SEQ);
          model.points[vi].label = {
            text,
            color,
            offset: defaultPointLabelOffset(vi),
            fontSize: getLabelFontDefault(),
            seq: { kind: 'upper' as const, idx }
          };
        });
        labelUpperIdx += verts.length;
        changed = verts.length > 0;
        if (changed) {
          clearLabelSelection();
          setMode('move');
          updateToolButtons();
        }
      }
    }
    // Click on line segment
    else if (lineHit && lineHit.part === 'segment') {
      selectedLineIndex = lineHit.line;
      if (!model.lines[lineHit.line].label) {
        const { text, seq } = nextLower();
        model.lines[lineHit.line].label = {
          text,
          color,
          offset: defaultLineLabelOffset(lineHit.line),
          fontSize: getLabelFontDefault(),
          seq
        };
        changed = true;
        clearLabelSelection();
        setMode('move');
        updateToolButtons();
      }
    }
    // Free label (no object clicked)
    else {
      const text = '';
      model.labels.push({ text, pos: { x, y }, color, fontSize: getLabelFontDefault() });
      const newIdx = model.labels.length - 1;
      selectLabel({ kind: 'free', id: newIdx });
      
      // Ensure the style menu is open and input focused
      setTimeout(() => {
        openStyleMenu();
        if (labelTextInput) labelTextInput.focus();
      }, 0);
      changed = true;
    }
    if (changed) {
      draw();
      pushHistory();
      maybeRevertMode();
      updateSelectionButtons();
    }
  } else if (mode === 'bisector') {
    const lineHit = findLine({ x, y });
    if (!lineHit || lineHit.part !== 'segment') return;
    const l = model.lines[lineHit.line];
    const a = l.points[lineHit.seg];
    const b = l.points[lineHit.seg + 1];
    if (a === undefined || b === undefined) return;
    if (!bisectorFirstLeg) {
      bisectorFirstLeg = { line: lineHit.line, seg: lineHit.seg, a, b, vertex: a };
      selectedLineIndex = lineHit.line;
      selectedPointIndex = a;
      draw();
      return;
    }
    // Prevent creating 0-degree angle (same segment clicked twice)
    if (bisectorFirstLeg.line === lineHit.line && bisectorFirstLeg.seg === lineHit.seg) {
      bisectorFirstLeg = null;
      selectedLineIndex = null;
      draw();
      return;
    }
    const a2 = l.points[lineHit.seg];
    const b2 = l.points[lineHit.seg + 1];
    if (a2 === undefined || b2 === undefined) {
      bisectorFirstLeg = null;
      return;
    }
    const shared = [a2, b2].find((p) => p === bisectorFirstLeg?.a || p === bisectorFirstLeg?.b);
    if (shared === undefined) {
      bisectorFirstLeg = null;
      return;
    }
    const vertex = shared;
    const other1 = bisectorFirstLeg.a === vertex ? bisectorFirstLeg.b : bisectorFirstLeg.a;
    const other2 = a2 === vertex ? b2 : a2;
    const v = model.points[vertex];
    const p1 = model.points[other1];
    const p2 = model.points[other2];
    if (!v || !p1 || !p2) {
      bisectorFirstLeg = null;
      return;
    }
    const d1 = normalize({ x: p1.x - v.x, y: p1.y - v.y });
    const d2 = normalize({ x: p2.x - v.x, y: p2.y - v.y });
    const bis = normalize({ x: d1.x + d2.x, y: d1.y + d2.y });
    const len = Math.min(Math.hypot(p1.x - v.x, p1.y - v.y), Math.hypot(p2.x - v.x, p2.y - v.y)) || 80;
    const end = { x: v.x + bis.x * len, y: v.y + bis.y * len };
    const endIdx = addPoint(model, { ...end, style: currentPointStyle() });
    const style = currentStrokeStyle();
    addLineFromPoints(model, vertex, endIdx, style);
    const angleId = nextId('angle', model);
    model.angles.push({
      object_type: 'angle',
      id: angleId,
      leg1: { line: bisectorFirstLeg.line, seg: bisectorFirstLeg.seg },
      leg2: { line: lineHit.line, seg: lineHit.seg },
      vertex,
      style: currentAngleStyle(),
      construction_kind: 'free',
      defining_parents: [],
      children: [],
      recompute: () => {},
      on_parent_deleted: () => {}
    });
    registerIndex(model, 'angle', angleId, model.angles.length - 1);
    selectedAngleIndex = model.angles.length - 1;
    selectedPointIndex = null;
    bisectorFirstLeg = null;
    draw();
    pushHistory();
    maybeRevertMode();
    updateSelectionButtons();
  } else if (mode === 'midpoint') {
    const hitPoint = findPoint({ x, y });
    const lineHit = findLine({ x, y });
    
    // Prioritize point over line segment when both are close
    if (hitPoint !== null) {
      // Point found - use it for midpoint creation
      if (midpointFirstIndex === null) {
        midpointFirstIndex = hitPoint;
        selectedPointIndex = hitPoint;
        draw();
        return;
      }
      // Second point selected
      const secondIdx = hitPoint;
      const p1 = model.points[midpointFirstIndex];
      const p2 = model.points[secondIdx];
      if (!p1 || !p2) {
        midpointFirstIndex = null;
        maybeRevertMode();
        updateSelectionButtons();
        return;
      }
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const parents: [string, string] = [p1.id, p2.id];
      const idx = addPoint(model, {
        ...mid,
        style: midpointPointStyle(),
        defining_parents: [],
        construction_kind: 'midpoint',
        midpoint: { parents, parentLineId: null }
      });
      recomputeMidpoint(idx);
      selectedPointIndex = idx;
      draw();
      pushHistory();
      midpointFirstIndex = null;
      maybeRevertMode();
      updateSelectionButtons();
      return;
    }
    
    // No point hit, check for line segment
    if (lineHit && lineHit.part === 'segment' && midpointFirstIndex === null) {
      const l = model.lines[lineHit.line];
      const a = model.points[l.points[lineHit.seg]];
      const b = model.points[l.points[lineHit.seg + 1]];
      if (a && b) {
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const parents: [string, string] = [a.id, b.id];
        const lineParent = l?.id ?? null;
        const idx = addPoint(model, {
          ...mid,
          style: midpointPointStyle(),
          defining_parents: lineParent ? [{ kind: 'line', id: lineParent }] : [],
          construction_kind: 'midpoint',
          midpoint: { parents, parentLineId: lineParent }
        });
        recomputeMidpoint(idx);
        insertPointIntoLine(lineHit.line, idx, mid);
        selectedPointIndex = idx;
        selectedLineIndex = lineHit.line;
        draw();
        pushHistory();
        maybeRevertMode();
        updateSelectionButtons();
        return;
      }
    }
    
    // Nothing hit and no first point selected - do nothing
    if (midpointFirstIndex === null) {
      return;
    }
    
    // Create new point at click location as second point
    const secondIdx = addPoint(model, { x, y, style: currentPointStyle() });
    const p1 = model.points[midpointFirstIndex];
    const p2 = model.points[secondIdx];
    if (!p1 || !p2) {
      midpointFirstIndex = null;
      maybeRevertMode();
      updateSelectionButtons();
      return;
    }
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const parents: [string, string] = [p1.id, p2.id];
    const midIdx = addPoint(model, {
      ...mid,
      style: midpointPointStyle(),
      construction_kind: 'midpoint',
      midpoint: { parents, parentLineId: null }
    });
    recomputeMidpoint(midIdx);
    selectedPointIndex = midIdx;
    midpointFirstIndex = null;
    draw();
    pushHistory();
    maybeRevertMode();
    updateSelectionButtons();
  } else if (mode === 'ngon') {
    const hitPoint = findPoint({ x, y });
    if (squareStartIndex === null) {
      const idx = hitPoint ?? addPoint(model, { x, y, style: currentPointStyle() });
      squareStartIndex = idx;
      selectedPolygonIndex = null;
      selectedPointIndex = idx;
      selectedLineIndex = null;
      selectedCircleIndex = null;
      draw();
      return;
    }
    const baseStart = model.points[squareStartIndex];
    const snappedPos = hitPoint !== null ? { x, y } : snapDir(baseStart, { x, y });
    const idx = hitPoint ?? addPoint(model, { ...snappedPos, style: currentPointStyle() });
    ngonSecondIndex = idx;
    selectedPointIndex = idx;
    draw();
    
    // Show modal
    if (ngonModal) {
      ngonModal.style.display = 'flex';
      if (ngonInput) ngonInput.focus();
    }
  } else if (mode === 'multiselect') {
    const { x, y } = canvasToWorld(ev.clientX, ev.clientY);
    
    // If move mode is active, start dragging
    if (multiMoveActive && hasMultiSelection()) {
      draggingMultiSelection = true;
      dragStart = { x, y };
      draw();
      return;
    }
    
    // Start drawing selection box
    multiselectBoxStart = { x, y };
    multiselectBoxEnd = { x, y };
    
    // Check if clicking on existing object to toggle selection (only if not in move mode)
    if (!multiMoveActive) {
      const pointHit = findPoint({ x, y });
      const lineHit = findLine({ x, y });
      const circleHit = findCircle({ x, y }, currentHitRadius(), false);
      const angleHit = findAngleAt({ x, y }, currentHitRadius(1.5));
      const inkHit = findInkStrokeAt({ x, y });
      const polyHit = lineHit ? polygonForLine(lineHit.line) : null;
      
      if (pointHit !== null) {
        if (multiSelectedPoints.has(pointHit)) {
          multiSelectedPoints.delete(pointHit);
        } else {
          multiSelectedPoints.add(pointHit);
        }
        multiselectBoxStart = null;
        multiselectBoxEnd = null;
        draw();
        updateSelectionButtons();
        return;
      }
      
      if (lineHit !== null) {
        const lineIdx = lineHit.line;
        if (multiSelectedLines.has(lineIdx)) {
          multiSelectedLines.delete(lineIdx);
        } else {
          multiSelectedLines.add(lineIdx);
        }
        multiselectBoxStart = null;
        multiselectBoxEnd = null;
        draw();
        updateSelectionButtons();
        return;
      }
      
      if (circleHit !== null) {
        const circleIdx = circleHit.circle;
        if (multiSelectedCircles.has(circleIdx)) {
          multiSelectedCircles.delete(circleIdx);
        } else {
          multiSelectedCircles.add(circleIdx);
        }
        multiselectBoxStart = null;
        multiselectBoxEnd = null;
        draw();
        updateSelectionButtons();
        return;
      }
      
      if (angleHit !== null) {
        if (multiSelectedAngles.has(angleHit)) {
          multiSelectedAngles.delete(angleHit);
        } else {
          multiSelectedAngles.add(angleHit);
        }
        multiselectBoxStart = null;
        multiselectBoxEnd = null;
        draw();
        updateSelectionButtons();
        return;
      }
      
      if (polyHit !== null) {
        if (multiSelectedPolygons.has(polyHit)) {
          multiSelectedPolygons.delete(polyHit);
        } else {
          multiSelectedPolygons.add(polyHit);
        }
        multiselectBoxStart = null;
        multiselectBoxEnd = null;
        draw();
        updateSelectionButtons();
        return;
      }
      
      if (inkHit !== null) {
        if (multiSelectedInkStrokes.has(inkHit)) {
          multiSelectedInkStrokes.delete(inkHit);
        } else {
          multiSelectedInkStrokes.add(inkHit);
        }
        multiselectBoxStart = null;
        multiselectBoxEnd = null;
        draw();
        updateSelectionButtons();
        return;
      }
    }
    
    // If not clicking on object, will draw selection box (handled in pointer move)
    draw();
  } else if (mode === 'move') {
    // Jeśli aktywny jest tryb kopiowania stylu, zastosuj styl do klikniętego obiektu
    if (copyStyleActive && copiedStyle) {
      const pointHit = findPoint({ x, y });
      const lineHit = findLine({ x, y });
      const circleHit = findCircle({ x, y }, currentHitRadius(), false);
      const angleHit = findAngleAt({ x, y }, currentHitRadius(1.5));
      const inkHit = findInkStrokeAt({ x, y });
      
      // Zachowaj oryginalne zaznaczenie
      const originalPointIndex = selectedPointIndex;
      const originalLineIndex = selectedLineIndex;
      const originalCircleIndex = selectedCircleIndex;
      const originalAngleIndex = selectedAngleIndex;
      const originalPolygonIndex = selectedPolygonIndex;
      const originalInkStrokeIndex = selectedInkStrokeIndex;
      const originalSegments = new Set(selectedSegments);
      const originalArcSegments = new Set(selectedArcSegments);
      const originalSelectionEdges = selectionEdges;
      const originalSelectionVertices = selectionVertices;
      
      let applied = false;
      
      // Filtruj obiekty według typu skopiowanego stylu
      if (copiedStyle.sourceType === 'ink' && inkHit !== null) {
        selectedInkStrokeIndex = inkHit;
        selectedPointIndex = null;
        selectedLineIndex = null;
        selectedCircleIndex = null;
        selectedAngleIndex = null;
        selectedPolygonIndex = null;
        selectedSegments.clear();
        selectedArcSegments.clear();
        applyStyleToSelection(copiedStyle);
        applied = true;
      } else if (copiedStyle.sourceType === 'angle' && angleHit !== null) {
        selectedAngleIndex = angleHit;
        selectedPointIndex = null;
        selectedLineIndex = null;
        selectedCircleIndex = null;
        selectedPolygonIndex = null;
        selectedInkStrokeIndex = null;
        selectedSegments.clear();
        selectedArcSegments.clear();
        applyStyleToSelection(copiedStyle);
        applied = true;
      } else if (copiedStyle.sourceType === 'circle' && circleHit !== null) {
        selectedCircleIndex = circleHit.circle;
        selectedPointIndex = null;
        selectedLineIndex = null;
        selectedAngleIndex = null;
        selectedPolygonIndex = null;
        selectedInkStrokeIndex = null;
        selectedSegments.clear();
        selectedArcSegments.clear();
        applyStyleToSelection(copiedStyle);
        applied = true;
      } else if (copiedStyle.sourceType === 'line' && lineHit !== null) {
        selectedLineIndex = lineHit.line;
        selectedPointIndex = null;
        selectedCircleIndex = null;
        selectedAngleIndex = null;
        selectedPolygonIndex = null;
        selectedInkStrokeIndex = null;
        selectedSegments.clear();
        selectedArcSegments.clear();
        selectionEdges = true;
        selectionVertices = false;
        applyStyleToSelection(copiedStyle);
        applied = true;
      } else if (copiedStyle.sourceType === 'point' && pointHit !== null) {
        selectedPointIndex = pointHit;
        selectedLineIndex = null;
        selectedCircleIndex = null;
        selectedAngleIndex = null;
        selectedPolygonIndex = null;
        selectedInkStrokeIndex = null;
        selectedSegments.clear();
        selectedArcSegments.clear();
        applyStyleToSelection(copiedStyle);
        applied = true;
      }
      
      if (applied) {
        // Przywróć oryginalne zaznaczenie
        selectedPointIndex = originalPointIndex;
        selectedLineIndex = originalLineIndex;
        selectedCircleIndex = originalCircleIndex;
        selectedAngleIndex = originalAngleIndex;
        selectedPolygonIndex = originalPolygonIndex;
        selectedInkStrokeIndex = originalInkStrokeIndex;
        selectedSegments.clear();
        originalSegments.forEach(key => selectedSegments.add(key));
        selectedArcSegments.clear();
        originalArcSegments.forEach(key => selectedArcSegments.add(key));
        selectionEdges = originalSelectionEdges;
        selectionVertices = originalSelectionVertices;
        
        updateSelectionButtons();
        draw();
        return;
      }
    }
    
    const pointHit = findPoint({ x, y });
    const lineHit = findLine({ x, y });
    let circleHit = findCircle({ x, y }, currentHitRadius(), false);
    let arcHit = findArcAt({ x, y }, currentHitRadius(1.5));
    const angleHit = findAngleAt({ x, y }, currentHitRadius(1.5));
    let fallbackCircleIdx: number | null = null;
    let circleFallback = false;
    if (pointHit !== null) {
      const pt = model.points[pointHit];
      const draggable = isPointDraggable(pt);
      const preferPointSelection =
        !draggable && (pt.construction_kind === 'intersection' || isMidpointPoint(pt) || isSymmetricPoint(pt));
      if (!draggable && !preferPointSelection) {
        if (circleHit !== null) {
          fallbackCircleIdx = circleHit.circle;
        } else {
          const circleParent = pt.parent_refs.find((pr) => pr.kind === 'circle');
          if (circleParent) {
            const idx = model.indexById.circle[circleParent.id];
            if (idx !== undefined) fallbackCircleIdx = idx;
          }
        }
      }
      circleFallback = fallbackCircleIdx !== null;
      const lineFallback =
        !draggable && !preferPointSelection && lineHit !== null && isLineDraggable(model.lines[lineHit.line]);
      if (!circleFallback && !lineFallback) {
        selectedPointIndex = pointHit;
        selectedLineIndex = null;
        selectedCircleIndex = null;
        selectedAngleIndex = null;
        selectedPolygonIndex = null;
        selectedArcSegments.clear();
        selectedSegments.clear();
        if (draggable) {
          const centerCircles = circlesWithCenter(pointHit).filter((ci) => {
            const circle = model.circles[ci];
            return circle?.circle_kind === 'center-radius';
          });
          if (centerCircles.length) {
            const context = new Map<number, Map<number, number>>();
            centerCircles.forEach((ci) => {
              const circle = model.circles[ci];
              const centerPoint = pt;
              if (!circle || !centerPoint) return;
              const angles = new Map<number, number>();
              circle.points.forEach((pid) => {
                const pnt = model.points[pid];
                if (!pnt) return;
                angles.set(pid, Math.atan2(pnt.y - centerPoint.y, pnt.x - centerPoint.x));
              });
              const radiusPt = model.points[circle.radius_point];
              if (radiusPt) {
                angles.set(
                  circle.radius_point,
                  Math.atan2(radiusPt.y - centerPoint.y, radiusPt.x - centerPoint.x)
                );
              }
              context.set(ci, angles);
            });
            draggingCircleCenterAngles = context;
          }
        }
        draggingSelection = draggable;
        dragStart = { x, y };
        // Capture line context for any point on a line, including endpoints
        const linesWithPoint = findLinesContainingPoint(pointHit);
        if (draggable && linesWithPoint.length > 0) {
          lineDragContext = captureLineContext(pointHit);
        } else {
          lineDragContext = null;
        }
        updateSelectionButtons();
        draw();
        return;
      }
      if (circleFallback && circleHit === null && fallbackCircleIdx !== null) {
        circleHit = { circle: fallbackCircleIdx };
      }
    }
    const targetedCircleIdx = circleHit?.circle ?? null;
    const arcMatchesCircle =
      arcHit !== null && targetedCircleIdx !== null && arcHit.circle === targetedCircleIdx;
    const allowArcToggle =
      arcMatchesCircle &&
      (selectedCircleIndex === targetedCircleIdx || ev.detail >= 2);
    if (angleHit !== null) {
      selectedAngleIndex = angleHit;
      selectedLineIndex = null;
      selectedPointIndex = null;
      selectedCircleIndex = null;
      selectedPolygonIndex = null;
      selectedArcSegments.clear();
      selectedSegments.clear();
      draggingSelection = false;
      dragStart = { x, y };
      updateSelectionButtons();
      draw();
      return;
    }
    if (circleHit !== null) {
      const previousCircle = selectedCircleIndex;
      const circleIdx = circleHit.circle;
      const c = model.circles[circleIdx];
      if (!c) {
        updateSelectionButtons();
        draw();
        return;
      }
      const centerIdx = c.center;
      const centerPoint = model.points[centerIdx];
      const centerDraggable = isPointDraggable(centerPoint);
      if (allowArcToggle && arcHit !== null) {
        const key = arcKey(circleIdx, arcHit.arcIdx);
        selectedCircleIndex = circleIdx;
        selectedLineIndex = null;
        selectedPointIndex = null;
        selectedAngleIndex = null;
        selectedPolygonIndex = null;
        selectedSegments.clear();
        if (previousCircle === circleIdx) {
          if (selectedArcSegments.has(key)) selectedArcSegments.delete(key);
          else selectedArcSegments.add(key);
        } else {
          selectedArcSegments.clear();
          selectedArcSegments.add(key);
        }
        draggingSelection = false;
        lineDragContext = null;
        dragStart = { x, y };
        updateSelectionButtons();
        draw();
        return;
      }
      selectedCircleIndex = circleIdx;
      selectedArcSegments.clear();
      selectedLineIndex = null;
      selectedPointIndex = null;
      selectedAngleIndex = null;
      selectedPolygonIndex = null;
      selectedSegments.clear();
      const originals = new Map<number, { x: number; y: number }>();
      const recordPoint = (idx: number | undefined) => {
        if (idx === undefined || idx < 0) return;
        const pt = model.points[idx];
        if (!pt) return;
        originals.set(idx, { x: pt.x, y: pt.y });
      };
      recordPoint(centerIdx);
      recordPoint(c.radius_point);
      c.points.forEach((pid) => recordPoint(pid));
      
      const dependentLines = new Map<number, number[]>();
      originals.forEach((_, pIdx) => {
        const lines = findLinesContainingPoint(pIdx);
        lines.forEach(lIdx => {
          if (isDefiningPointOfLine(pIdx, lIdx) && !dependentLines.has(lIdx)) {
            dependentLines.set(lIdx, calculateLineFractions(lIdx));
          }
        });
      });

      circleDragContext = { circleIdx, originals, dependentLines };
      draggingSelection = centerDraggable || originals.size > 0;
      dragStart = { x, y };
      lineDragContext = null;
      draggingCircleCenterAngles = null;
      updateSelectionButtons();
      draw();
      return;
    }
    if (allowArcToggle && arcHit !== null) {
      const circleIdx = arcHit.circle;
      const key = arcKey(circleIdx, arcHit.arcIdx);
      if (selectedCircleIndex === circleIdx) {
        if (selectedArcSegments.has(key)) selectedArcSegments.delete(key);
        else selectedArcSegments.add(key);
      } else {
        selectedCircleIndex = circleIdx;
        selectedArcSegments.clear();
        selectedArcSegments.add(key);
      }
      selectedLineIndex = null;
      selectedPointIndex = null;
      selectedAngleIndex = null;
      selectedPolygonIndex = null;
      selectedSegments.clear();
      draggingSelection = false;
      lineDragContext = null;
      dragStart = { x, y };
      updateSelectionButtons();
      draw();
      return;
    }
    const inkStrokeHit = findInkStrokeAt({ x, y });
    if (inkStrokeHit !== null) {
      selectedInkStrokeIndex = inkStrokeHit;
      selectedLineIndex = null;
      selectedPointIndex = null;
      selectedCircleIndex = null;
      selectedAngleIndex = null;
      selectedPolygonIndex = null;
      selectedArcSegments.clear();
      selectedSegments.clear();
      draggingSelection = true;
      dragStart = { x, y };
      updateSelectionButtons();
      draw();
      return;
    }
    if (lineHit !== null) {
      const hitLineObj = model.lines[lineHit.line];
      const lineIsDraggable = isLineDraggable(hitLineObj);
      const polyIdx = polygonForLine(lineHit.line);
      if (polyIdx !== null) {
        if (selectedPolygonIndex === polyIdx) {
          const key = hitKey(lineHit);
          if (selectedSegments.size === 0) {
            selectedSegments.add(key);
          } else if (selectedSegments.has(key)) {
            selectedSegments.delete(key);
          } else {
            selectedSegments.add(key);
          }
        } else {
          selectedPolygonIndex = polyIdx;
          selectedSegments.clear();
        }
        selectedLineIndex = lineHit.line;
        selectedArcSegments.clear();
        selectedAngleIndex = null;
        
        // Capture dependent lines for polygon drag
        const poly = model.polygons[polyIdx];
        const dependentLines = new Map<number, number[]>();
        if (poly) {
          const pointsInPoly = new Set<number>();
          poly.lines.forEach((li) => {
            const line = model.lines[li];
            line?.points.forEach((pi) => pointsInPoly.add(pi));
          });
          
          pointsInPoly.forEach(pIdx => {
            const lines = findLinesContainingPoint(pIdx);
            lines.forEach(lIdx => {
              if (!poly.lines.includes(lIdx) && isDefiningPointOfLine(pIdx, lIdx) && !dependentLines.has(lIdx)) {
                dependentLines.set(lIdx, calculateLineFractions(lIdx));
              }
            });
          });
        }
        polygonDragContext = { polygonIdx: polyIdx, dependentLines };
      } else {
        if (selectedLineIndex === lineHit.line) {
          if (selectedSegments.size === 0) {
            selectedSegments.add(hitKey(lineHit));
          } else {
            const key = hitKey(lineHit);
            if (selectedSegments.has(key)) selectedSegments.delete(key);
            else selectedSegments.add(key);
          }
        } else {
          selectedLineIndex = lineHit.line;
          selectedSegments.clear();
        }
        selectedPolygonIndex = null;
        selectedArcSegments.clear();
        selectedAngleIndex = null;
      }
      selectedPointIndex = null;
      selectedCircleIndex = null;
      selectedArcSegments.clear();
      pendingCircleRadiusLength = lineLength(selectedLineIndex);
      draggingSelection = lineIsDraggable;
      dragStart = { x, y };
      updateSelectionButtons();
      draw();
      return;
    }
    // if no hit, clear selection and start panning the canvas
    selectedPointIndex = null;
    selectedLineIndex = null;
    selectedCircleIndex = null;
    selectedPolygonIndex = null;
    selectedArcSegments.clear();
    selectedAngleIndex = null;
    selectedInkStrokeIndex = null;
    selectedSegments.clear();
    lineDragContext = null;
    clearLabelSelection();
    // Wyłącz tryb kopiowania stylu gdy odznaczamy obiekt
    if (copyStyleActive) {
      copyStyleActive = false;
      copiedStyle = null;
    }
    pendingPanCandidate = { x, y };
    isPanning = true;
    panStart = { x: ev.clientX, y: ev.clientY };
    panStartOffset = { ...panOffset };
    updateSelectionButtons();
    draw();
  }
}

// Button configuration types and state
type ButtonConfig = {
  multiButtons: Record<string, string[]>; // key is main button ID, value is array of button IDs to cycle through
  secondRow: Record<string, string[]>; // key is main button ID, value is array of button IDs in second row
};

let buttonConfig: ButtonConfig = {
  multiButtons: {},
  secondRow: {}
};

// Track current state of multi-buttons (which button in the cycle is currently active)
let multiButtonStates: Record<string, number> = {};

// Track second row state
let secondRowVisible = false;
let secondRowActiveButton: string | null = null;
let secondRowToolIds: string[] = []; // Track which tools are in the currently visible second row

// Track double tap for sticky tool
const doubleTapTimeouts: Map<HTMLElement, number> = new Map();
const DOUBLE_TAP_DELAY = 300; // ms

// Track touch drag in config menu
interface TouchDragState {
  element: HTMLElement | null;
  toolId: string;
  toolIcon: string;
  toolViewBox: string;
  toolLabel: string;
  startX: number;
  startY: number;
  fromGroup: boolean;
}
let configTouchDrag: TouchDragState | null = null;

// Button order in palette (determines toolbar order)
let buttonOrder: string[] = [];

// Button configuration - available tool buttons for configuration
const TOOL_BUTTONS = [
  { id: 'modeMove', label: 'Zaznaczanie', mode: 'move', icon: '<path d="M12 3 9.5 5.5 12 8l2.5-2.5L12 3Zm0 13-2.5 2.5L12 21l2.5-2.5L12 16Zm-9-4 2.5 2.5L8 12 5.5 9.5 3 12Zm13 0 2.5 2.5L21 12l-2.5-2.5L16 12ZM8 12l8 0" />', viewBox: '0 0 24 24' },
  { id: 'modeMultiselect', label: 'Zaznacz wiele', mode: 'multiselect', icon: '<rect x="3" y="3" width="8" height="8" rx="1" stroke-dasharray="2 2"/><rect x="13" y="3" width="8" height="8" rx="1" stroke-dasharray="2 2"/><rect x="3" y="13" width="8" height="8" rx="1" stroke-dasharray="2 2"/><rect x="13" y="13" width="8" height="8" rx="1" stroke-dasharray="2 2"/>', viewBox: '0 0 24 24' },
  { id: 'modeLabel', label: 'Etykieta', mode: 'label', icon: '<path d="M5 7h9l5 5-5 5H5V7Z"/><path d="M8 11h4" /><path d="M8 14h3" />', viewBox: '0 0 24 24' },
  { id: 'modeAdd', label: 'Punkt', mode: 'add', icon: '<circle cx="12" cy="12" r="4.5" class="icon-fill"/>', viewBox: '0 0 24 24' },
  { id: 'modeSegment', label: 'Odcinek', mode: 'segment', icon: '<circle cx="6" cy="12" r="2.2" class="icon-fill"/><circle cx="18" cy="12" r="2.2" class="icon-fill"/><line x1="6" y1="12" x2="18" y2="12"/>', viewBox: '0 0 24 24' },
  { id: 'modeParallel', label: 'Równoległa', mode: 'parallel', icon: '<line x1="5" y1="8" x2="19" y2="8"/><line x1="5" y1="16" x2="19" y2="16"/>', viewBox: '0 0 24 24' },
  { id: 'modePerpendicular', label: 'Prostopadła', mode: 'perpendicular', icon: '<line x1="5" y1="12" x2="19" y2="12"/><line x1="12" y1="5" x2="12" y2="19"/>', viewBox: '0 0 24 24' },
  { id: 'modeCircle', label: 'Okrąg', mode: 'circle', icon: '<circle cx="12" cy="12" r="8"/><line x1="12" y1="12" x2="18" y2="12"/><circle cx="18" cy="12" r="1.4" class="icon-fill"/>', viewBox: '0 0 24 24' },
  { id: 'modeCircleThree', label: 'Okrąg przez 3 punkty', mode: 'circleThree', icon: '<ellipse cx="12" cy="12" rx="8.5" ry="7.5" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="6.5" r="2.2" class="icon-fill" stroke="currentColor" stroke-width="0.8"/><circle cx="16.5" cy="6" r="2.2" class="icon-fill" stroke="currentColor" stroke-width="0.8"/><circle cx="17.5" cy="16" r="2.2" class="icon-fill" stroke="currentColor" stroke-width="0.8"/>', viewBox: '0 0 24 24' },
  { id: 'modeTriangleUp', label: 'Trójkąt foremny', mode: 'triangleUp', icon: '<path d="M4 18h16L12 5Z"/>', viewBox: '0 0 24 24' },
  { id: 'modeSquare', label: 'Kwadrat', mode: 'square', icon: '<rect x="5" y="5" width="14" height="14"/>', viewBox: '0 0 24 24' },
  { id: 'modeNgon', label: 'N-kąt', mode: 'ngon', icon: '<polygon points="20,15.5 15.5,20 8.5,20 4,15.5 4,8.5 8.5,4 15.5,4 20,8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>', viewBox: '0 0 24 24' },
  { id: 'modePolygon', label: 'Wielokąt', mode: 'polygon', icon: '<polygon points="5,4 19,7 16,19 5,15"/><circle cx="5" cy="4" r="1.2" class="icon-fill"/><circle cx="19" cy="7" r="1.2" class="icon-fill"/><circle cx="16" cy="19" r="1.2" class="icon-fill"/><circle cx="5" cy="15" r="1.2" class="icon-fill"/>', viewBox: '0 0 24 24' },
  { id: 'modeAngle', label: 'Kąt', mode: 'angle', icon: '<line x1="14" y1="54" x2="50" y2="54" stroke="currentColor" stroke-width="4" stroke-linecap="round" /><line x1="14" y1="54" x2="42" y2="18" stroke="currentColor" stroke-width="4" stroke-linecap="round" /><path d="M20 46 A12 12 0 0 1 32 54" fill="none" stroke="currentColor" stroke-width="3" />', viewBox: '0 0 64 64' },
  { id: 'modeBisector', label: 'Dwusieczna', mode: 'bisector', icon: '<line x1="6" y1="18" x2="20" y2="18" /><line x1="6" y1="18" x2="14" y2="6" /><line x1="6" y1="18" x2="20" y2="10" />', viewBox: '0 0 24 24' },
  { id: 'modeMidpoint', label: 'Punkt środkowy', mode: 'midpoint', icon: '<circle cx="6" cy="12" r="1.5" class="icon-fill"/><circle cx="18" cy="12" r="1.5" class="icon-fill"/><circle cx="12" cy="12" r="2.5" class="icon-fill"/><circle cx="12" cy="12" r="1" fill="var(--bg)" stroke="none"/>', viewBox: '0 0 24 24' },
  { id: 'modeSymmetric', label: 'Symetria', mode: 'symmetric', icon: '<line x1="12" y1="4" x2="12" y2="20" /><circle cx="7.5" cy="10" r="1.7" class="icon-fill"/><circle cx="16.5" cy="14" r="1.7" class="icon-fill"/><path d="M7.5 10 16.5 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>', viewBox: '0 0 24 24' },
  { id: 'modeHandwriting', label: 'Pismo ręczne', mode: 'handwriting', icon: '<path d="M5.5 18.5 4 20l1.5-.1L9 19l10.5-10.5a1.6 1.6 0 0 0 0-2.2L17.7 4a1.6 1.6 0 0 0-2.2 0L5 14.5l.5 4Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 5.5 18.5 8.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>', viewBox: '0 0 24 24' },
] as const;

function initializeButtonConfig() {
  const multiButtonArea = document.getElementById('multiButtonConfig');
  
  if (!multiButtonArea) return;
  
  // Initialize button order if empty
  if (buttonOrder.length === 0) {
    buttonOrder = TOOL_BUTTONS.map(t => t.id);
  }
  
  // Create available buttons palette
  const palette = document.createElement('div');
  palette.className = 'button-palette';
    
  const paletteGrid = document.createElement('div');
  paletteGrid.id = 'paletteGrid';
  paletteGrid.className = 'palette-grid';
  paletteGrid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(42px, 1fr)); gap:5px; margin-bottom:16px;';
  
  // Render buttons in current order
  buttonOrder.forEach(toolId => {
    const tool = TOOL_BUTTONS.find(t => t.id === toolId);
    if (!tool) return;
    
    const btn = document.createElement('button');
    btn.className = 'config-tool-btn tool icon-btn';
    btn.dataset.toolId = tool.id;
    btn.title = tool.label;
    btn.style.cssText = 'padding:6px; background:var(--btn); border:1px solid var(--btn-border); border-radius:8px; cursor:move; display:flex; align-items:center; justify-content:center; min-height:44px; width:100%; aspect-ratio:1;';
    
    const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgIcon.setAttribute('class', 'icon');
    svgIcon.setAttribute('viewBox', tool.viewBox);
    svgIcon.setAttribute('aria-hidden', 'true');
    svgIcon.style.cssText = 'width:22px; height:22px; pointer-events:none;';
    svgIcon.innerHTML = tool.icon;
    
    btn.appendChild(svgIcon);
    paletteGrid.appendChild(btn);
  });
  
  palette.appendChild(paletteGrid);
  
  // Multi-button configuration
  const multiContainer = document.createElement('div');
  multiContainer.style.cssText = 'padding: 0 12px;';
  multiContainer.innerHTML = '<h5 style="margin:12px 0 12px; font-size:14px; font-weight:600;">Multiprzyciski:</h5>';
  const multiGroups = document.createElement('div');
  multiGroups.id = 'multiGroups';
  multiGroups.style.cssText = 'display:flex; flex-direction:column; gap:8px; min-height:120px; padding:12px; background:rgba(0,0,0,0.1); border-radius:8px; border:2px dashed transparent; transition:all 0.2s;';
  multiContainer.appendChild(multiGroups);
  
  // Second row configuration
  const secondContainer = document.createElement('div');
  secondContainer.style.cssText = 'padding: 0 12px 12px;';
  secondContainer.innerHTML = '<h5 style="margin:12px 0 12px; font-size:14px; font-weight:600;">Dwa rzędy:</h5>';
  const secondGroups = document.createElement('div');
  secondGroups.id = 'secondGroups';
  secondGroups.style.cssText = 'display:flex; flex-direction:column; gap:8px; min-height:120px; padding:12px; background:rgba(0,0,0,0.1); border-radius:8px; border:2px dashed transparent; transition:all 0.2s;';
  secondContainer.appendChild(secondGroups);
  
  multiButtonArea.innerHTML = '';
  multiButtonArea.appendChild(palette);
  multiButtonArea.appendChild(multiContainer);
  multiButtonArea.appendChild(secondContainer);
  
  // Setup drag & drop
  setupPaletteDragAndDrop();
  setupDropZone(multiGroups, 'multi');
  setupDropZone(secondGroups, 'second');
  
  // Load saved configuration into UI
  loadConfigIntoUI(multiGroups, secondGroups);
}

function loadConfigIntoUI(multiGroups: HTMLElement, secondGroups: HTMLElement) {
  // Load multi-button groups
  Object.entries(buttonConfig.multiButtons).forEach(([mainId, buttonIds]) => {
    if (buttonIds.length > 0) {
      const group = addButtonGroup(multiGroups, 'multi');
      if (!group) return;
      
      const removeBtn = group.querySelector('.group-remove-btn');
      
      buttonIds.forEach(toolId => {
        const toolInfo = TOOL_BUTTONS.find(t => t.id === toolId);
        if (!toolInfo) return;
        
        const toolBtn = createConfigToolButton(toolInfo.id, toolInfo.icon, toolInfo.viewBox, toolInfo.label);
        
        if (removeBtn) {
          group.insertBefore(toolBtn, removeBtn);
        }
      });
    }
  });
  
  // Load second-row groups
  Object.entries(buttonConfig.secondRow).forEach(([mainId, secondRowIds]) => {
    if (secondRowIds.length > 0) {
      const group = addButtonGroup(secondGroups, 'second');
      if (!group) return;
      
      const removeBtn = group.querySelector('.group-remove-btn');
      
      // Add main button first
      const mainToolInfo = TOOL_BUTTONS.find(t => t.id === mainId);
      if (mainToolInfo) {
        const mainBtn = createConfigToolButton(mainToolInfo.id, mainToolInfo.icon, mainToolInfo.viewBox, mainToolInfo.label);
        
        if (removeBtn) {
          group.insertBefore(mainBtn, removeBtn);
        }
      }
      
      // Add second row buttons
      secondRowIds.forEach(toolId => {
        const toolInfo = TOOL_BUTTONS.find(t => t.id === toolId);
        if (!toolInfo) return;
        
        const toolBtn = createConfigToolButton(toolInfo.id, toolInfo.icon, toolInfo.viewBox, toolInfo.label);
        
        if (removeBtn) {
          group.insertBefore(toolBtn, removeBtn);
        }
      });
    }
  });
}

function applyButtonConfiguration() {
  const toolRow = document.getElementById('toolbarMainRow');
  if (!toolRow) return;
  
  // Get all TOOL buttons (only from TOOL_BUTTONS list, not other buttons!)
  const allButtons = new Map<string, HTMLElement>();
  TOOL_BUTTONS.forEach(tool => {
    const btn = document.getElementById(tool.id);
    if (btn) {
      allButtons.set(tool.id, btn as HTMLElement);
    }
  });
  
  // Track which buttons have been placed
  const placedButtons = new Set<string>();
  
  // Apply multi-button configuration
  Object.entries(buttonConfig.multiButtons).forEach(([mainId, buttonIds]) => {
    const mainBtn = allButtons.get(mainId);
    if (!mainBtn || buttonIds.length === 0) return;
    
    // Mark all in group as placed
    buttonIds.forEach(id => placedButtons.add(id));
    
    // Initialize state if not exists
    if (!(mainId in multiButtonStates)) {
      multiButtonStates[mainId] = 0;
    }
    
    // Add indicator dot for multi-button
    if (buttonIds.length > 1) {
      // Remove old indicator if exists
      const oldIndicator = mainBtn.querySelector('.multi-indicator');
      if (oldIndicator) oldIndicator.remove();
      
      const indicator = document.createElement('span');
      indicator.className = 'multi-indicator';
      indicator.style.cssText = 'position:absolute; top:3px; right:3px; width:10px; height:10px; display:flex; flex-direction:column; align-items:center; gap:1px;';
      
      // Create three dots in triangle formation
      const dot1 = document.createElement('span');
      dot1.style.cssText = 'width:2.5px; height:2.5px; background:rgba(128,128,128,0.6); border-radius:50%;';
      
      const dotsRow = document.createElement('span');
      dotsRow.style.cssText = 'display:flex; gap:2px;';
      
      const dot2 = document.createElement('span');
      dot2.style.cssText = 'width:2.5px; height:2.5px; background:rgba(128,128,128,0.6); border-radius:50%;';
      
      const dot3 = document.createElement('span');
      dot3.style.cssText = 'width:2.5px; height:2.5px; background:rgba(128,128,128,0.6); border-radius:50%;';
      
      dotsRow.appendChild(dot2);
      dotsRow.appendChild(dot3);
      
      indicator.appendChild(dot1);
      indicator.appendChild(dotsRow);
      
      mainBtn.style.position = 'relative';
      mainBtn.appendChild(indicator);
      
      // Remove old click handler and add new cycling logic
      const newBtn = mainBtn.cloneNode(true) as HTMLElement;
      mainBtn.parentNode?.replaceChild(newBtn, mainBtn);
      allButtons.set(mainId, newBtn);
      
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const currentIndex = multiButtonStates[mainId];
        const currentToolId = buttonIds[currentIndex];
        const currentTool = TOOL_BUTTONS.find(t => t.id === currentToolId);
        
        if (!currentTool) return;
        
        // Check if current tool is already active
        let isCurrentToolActive = false;
        if (currentToolId === 'copyStyleBtn') {
          isCurrentToolActive = copyStyleActive;
        } else {
          isCurrentToolActive = mode === currentTool.mode;
        }
        
        // If tool is active, cycle to next. Otherwise, activate current tool
        if (isCurrentToolActive) {
          // Cycle to next button in the group
          multiButtonStates[mainId] = (multiButtonStates[mainId] + 1) % buttonIds.length;
          const newIndex = multiButtonStates[mainId];
          const newToolId = buttonIds[newIndex];
          const newTool = TOOL_BUTTONS.find(t => t.id === newToolId);
          
          if (newTool) {
            // Update button icon
            const svgElement = newBtn.querySelector('svg');
            if (svgElement) {
              svgElement.setAttribute('viewBox', newTool.viewBox);
              svgElement.innerHTML = newTool.icon;
            }
            
            // Update title
            newBtn.setAttribute('title', newTool.label);
            newBtn.setAttribute('aria-label', newTool.label);
            
            // If we cycled back to the first tool, deactivate instead of activating
            if (newIndex === 0) {
              // Deactivate
              if (newToolId === 'copyStyleBtn') {
                copyStyleActive = false;
                copiedStyle = null;
                updateSelectionButtons();
              } else {
                setMode('move');
              }
            } else {
              // Activate the new tool
              if (newToolId === 'copyStyleBtn') {
                if (!copyStyleActive) {
                  const style = copyStyleFromSelection();
                  if (style) {
                    copiedStyle = style;
                    copyStyleActive = true;
                    updateSelectionButtons();
                  }
                }
              } else {
                setMode(newTool.mode as Mode);
              }
            }
          }
        } else {
          // Activate current tool
          if (currentToolId === 'copyStyleBtn') {
            if (!copyStyleActive) {
              const style = copyStyleFromSelection();
              if (style) {
                copiedStyle = style;
                copyStyleActive = true;
                updateSelectionButtons();
              }
            } else {
              copyStyleActive = false;
              copiedStyle = null;
              updateSelectionButtons();
            }
          } else {
            setMode(currentTool.mode as Mode);
          }
        }
      });
      
      // Set initial icon
      const initialTool = TOOL_BUTTONS.find(t => t.id === buttonIds[multiButtonStates[mainId]]);
      if (initialTool) {
        const svgElement = newBtn.querySelector('svg');
        if (svgElement) {
          svgElement.setAttribute('viewBox', initialTool.viewBox);
          svgElement.innerHTML = initialTool.icon;
        }
        newBtn.setAttribute('title', initialTool.label);
        newBtn.setAttribute('aria-label', initialTool.label);
      }
    }
  });
  
  // Apply second-row configuration
  Object.entries(buttonConfig.secondRow).forEach(([mainId, secondRowIds]) => {
    const mainBtn = allButtons.get(mainId);
    if (!mainBtn || secondRowIds.length === 0) return;
    
    // Mark main and second row buttons as placed
    placedButtons.add(mainId);
    secondRowIds.forEach(id => placedButtons.add(id));
    
    // Add visual indicator for second row
    mainBtn.classList.add('has-second-row');
    
    // Store reference for later attachment of events
    mainBtn.dataset.secondRowConfig = JSON.stringify(secondRowIds);
  });
  
  // Show all buttons that are either:
  // 1. Not in any configuration (unconfigured buttons)
  // 2. Main buttons of configured groups
  allButtons.forEach((btn, id) => {
    // If button is in a multi-group, only show if it's the main (first) button
    const isMainInMulti = Object.keys(buttonConfig.multiButtons).includes(id);
    const isSecondaryInMulti = Object.values(buttonConfig.multiButtons).some(
      group => group.includes(id) && group[0] !== id
    );
    
    // If button is in a second-row group, only show main button
    const isMainInSecondRow = Object.keys(buttonConfig.secondRow).includes(id);
    const isInSecondRow = Object.values(buttonConfig.secondRow).some(
      group => group.includes(id)
    );
    
    if (isSecondaryInMulti || isInSecondRow) {
      // Hide secondary buttons in multi-groups and all second-row buttons
      btn.style.display = 'none';
    } else {
      // Show main buttons and unconfigured buttons
      btn.style.display = 'inline-flex';
    }
  });
  
  // Reorder buttons in toolbar according to buttonOrder
  const orderedButtons: HTMLElement[] = [];
  buttonOrder.forEach(toolId => {
    const btn = allButtons.get(toolId);
    if (btn && btn.style.display !== 'none') {
      orderedButtons.push(btn);
    }
  });
  
  // Append buttons in order
  orderedButtons.forEach(btn => {
    toolRow.appendChild(btn);
  });
  
  // Attach swipe-up handlers to buttons with second row after all buttons are in DOM
  attachSecondRowHandlers(allButtons);
}

function attachSecondRowHandlers(allButtons: Map<string, HTMLElement>) {
  // Find all buttons with has-second-row class in the actual DOM
  const toolbar = document.getElementById('toolbarMainRow');
  if (!toolbar) return;
  
  const secondRowButtons = toolbar.querySelectorAll('.has-second-row');
  
  secondRowButtons.forEach((btn) => {
    const htmlBtn = btn as HTMLElement;
    const secondRowConfig = htmlBtn.dataset.secondRowConfig;
    
    if (!secondRowConfig) return;
    
    const secondRowIds: string[] = JSON.parse(secondRowConfig);
    const mainId = htmlBtn.id;
    
    // Add swipe-up/drag-up detection for both touch and mouse
    let startY = 0;
    let startTime = 0;
    let isDragging = false;
    let hasMovedEnough = false;
    
    const handleStart = (clientY: number) => {
      startY = clientY;
      startTime = Date.now();
      isDragging = false;
      hasMovedEnough = false;
    };
    
    const handleMove = (clientY: number, event?: Event) => {
      const deltaY = startY - clientY;
      const deltaTime = Date.now() - startTime;
      
      // Mark as moved if moved more than a small threshold
      if (Math.abs(deltaY) > 5) {
        hasMovedEnough = true;
      }
      
      // Detect swipe/drag up (moved up more than 20px in less than 500ms)
      if (deltaY > 20 && deltaTime < 500 && !isDragging) {
        isDragging = true;
        if (event) event.preventDefault();
        toggleSecondRow(mainId, secondRowIds, allButtons);
      }
    };
    
    const handleEnd = () => {
      isDragging = false;
    };
    
    // Touch events
    htmlBtn.addEventListener('touchstart', (e: TouchEvent) => {
      handleStart(e.touches[0].clientY);
    }, { passive: true });
    
    htmlBtn.addEventListener('touchmove', (e: TouchEvent) => {
      handleMove(e.touches[0].clientY, e);
    }, { passive: false });
    
    htmlBtn.addEventListener('touchend', handleEnd, { passive: true });
    
    // Mouse events
    let mouseDown = false;
    
    htmlBtn.addEventListener('mousedown', (e: MouseEvent) => {
      mouseDown = true;
      handleStart(e.clientY);
    });
    
    htmlBtn.addEventListener('mousemove', (e: MouseEvent) => {
      if (mouseDown) {
        handleMove(e.clientY, e);
        if (hasMovedEnough) {
          e.preventDefault();
        }
      }
    });
    
    const handleMouseEnd = () => {
      mouseDown = false;
      handleEnd();
    };
    
    htmlBtn.addEventListener('mouseup', handleMouseEnd);
    htmlBtn.addEventListener('mouseleave', handleMouseEnd);
  });
}

function toggleSecondRow(mainId: string, secondRowIds: string[], allButtons: Map<string, HTMLElement>) {
  const secondRowContainer = document.getElementById('toolbarSecondRow');
  if (!secondRowContainer) return;
  
  // If clicking same button, toggle off
  if (secondRowVisible && secondRowActiveButton === mainId) {
    hideSecondRow();
    return;
  }
  
  // Clear existing second row buttons
  secondRowContainer.innerHTML = '';
  
  // Store the tool IDs for later checking
  secondRowToolIds = secondRowIds;
  
  // Add second row buttons
  secondRowIds.forEach(id => {
    const btn = allButtons.get(id);
    if (btn) {
      const clonedBtn = btn.cloneNode(true) as HTMLElement;
      clonedBtn.style.display = 'inline-flex';
      clonedBtn.classList.remove('active');
      secondRowContainer.appendChild(clonedBtn);
      
      // Re-attach click handler
      const tool = TOOL_BUTTONS.find(t => t.id === id);
      if (tool) {
        // Add 'active' class if this tool matches current mode
        if (tool.mode === mode) {
          clonedBtn.classList.add('active');
        }
        
        clonedBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          setMode(tool.mode as Mode);
        });
      }
    }
  });
  
  // Show second row with animation
  secondRowContainer.style.display = 'flex';
  secondRowContainer.classList.remove('hidden');
  setTimeout(() => {
    secondRowContainer.classList.remove('hidden');
  }, 10);
  
  secondRowVisible = true;
  secondRowActiveButton = mainId;
}

function hideSecondRow() {
  const secondRowContainer = document.getElementById('toolbarSecondRow');
  if (!secondRowContainer) return;
  
  secondRowContainer.classList.add('hidden');
  setTimeout(() => {
    secondRowContainer.style.display = 'none';
  }, 250); // Wait for animation to complete
  
  secondRowVisible = false;
  secondRowActiveButton = null;
  secondRowToolIds = [];
}

function updateSecondRowActiveStates() {
  if (!secondRowVisible) return;
  
  const secondRowContainer = document.getElementById('toolbarSecondRow');
  if (!secondRowContainer) return;
  
  const buttons = secondRowContainer.querySelectorAll('button.tool');
  buttons.forEach(btn => {
    const btnTool = TOOL_BUTTONS.find(t => {
      const btnTitle = btn.getAttribute('title');
      return btnTitle && t.label === btnTitle;
    });
    
    if (btnTool && btnTool.mode === mode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function setupPaletteDragAndDrop() {
  const paletteGrid = document.getElementById('paletteGrid');
  const paletteButtons = document.querySelectorAll('.config-tool-btn');
  
  paletteButtons.forEach(btn => {
    const htmlBtn = btn as HTMLElement;
    htmlBtn.draggable = true;
    
    const toolId = htmlBtn.dataset.toolId;
    const tool = TOOL_BUTTONS.find(t => t.id === toolId);
    
    if (!tool) return;
    
    htmlBtn.addEventListener('dragstart', (e) => {
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copyMove';
        e.dataTransfer.setData('toolId', tool.id);
        e.dataTransfer.setData('toolIcon', tool.icon);
        e.dataTransfer.setData('toolViewBox', tool.viewBox);
        e.dataTransfer.setData('toolLabel', tool.label);
        e.dataTransfer.setData('fromPalette', 'true');
        htmlBtn.classList.add('dragging-from-palette');
        htmlBtn.style.opacity = '0.4';
      }
    });
    
    htmlBtn.addEventListener('dragend', () => {
      htmlBtn.classList.remove('dragging-from-palette');
      htmlBtn.style.opacity = '1';
    });
    
    // Allow reordering within palette
    htmlBtn.addEventListener('dragover', (e) => {
      // Check if we're dragging from palette
      const draggingFromPalette = document.querySelector('.dragging-from-palette');
      if (draggingFromPalette && paletteGrid?.contains(draggingFromPalette)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        htmlBtn.style.background = 'rgba(59, 130, 246, 0.2)';
      }
    });
    
    htmlBtn.addEventListener('dragleave', () => {
      htmlBtn.style.background = 'var(--btn)';
    });
    
    htmlBtn.addEventListener('drop', (e) => {
      const fromPalette = e.dataTransfer?.getData('fromPalette');
      if (fromPalette && paletteGrid && e.dataTransfer) {
        e.preventDefault();
        e.stopPropagation();
        htmlBtn.style.background = 'var(--btn)';
        
        const draggedToolId = e.dataTransfer.getData('toolId');
        if (draggedToolId && draggedToolId !== toolId) {
          // Reorder in buttonOrder array
          const draggedIndex = buttonOrder.indexOf(draggedToolId);
          const targetIndex = buttonOrder.indexOf(toolId!);
          
          if (draggedIndex !== -1 && targetIndex !== -1) {
            buttonOrder.splice(draggedIndex, 1);
            buttonOrder.splice(targetIndex, 0, draggedToolId);
            
            // Save and rebuild palette
            saveButtonOrder();
            rebuildPalette();
            applyButtonConfiguration(); // Rebuild toolbar in new order
          }
        }
      }
    });
    
    // Setup touch drag support for palette buttons
    setupConfigTouchDrag(htmlBtn, tool.id, tool.icon, tool.viewBox, tool.label, false);
  });
  
  // Add dragover/drop to paletteGrid itself for dropping between buttons
  if (paletteGrid) {
    paletteGrid.addEventListener('dragover', (e) => {
      const fromPalette = e.dataTransfer?.types.includes('text/plain');
      if (fromPalette) {
        // Only allow reordering if dragging from palette
        const target = e.target as HTMLElement;
        if (target === paletteGrid || target.classList.contains('palette-grid')) {
          e.preventDefault();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
          }
        }
      }
    });
  }
}

function setupDropZone(element: HTMLElement, type: 'multi' | 'second') {
  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    element.style.borderColor = '#3b82f6';
    element.style.background = 'rgba(59, 130, 246, 0.1)';
  });
  
  element.addEventListener('dragleave', () => {
    element.style.borderColor = 'transparent';
    element.style.background = 'rgba(0,0,0,0.1)';
  });
  
  element.addEventListener('drop', (e) => {
    e.preventDefault();
    element.style.borderColor = 'transparent';
    element.style.background = 'rgba(0,0,0,0.1)';
    
    if (!e.dataTransfer) return;
    
    const toolId = e.dataTransfer.getData('toolId');
    const toolIcon = e.dataTransfer.getData('toolIcon');
    const toolViewBox = e.dataTransfer.getData('toolViewBox');
    const toolLabel = e.dataTransfer.getData('toolLabel');
    
    const target = e.target as HTMLElement;
    
    // Check if dropping on an existing group
    const droppedOnGroup = target.classList.contains('button-group') || target.closest('.button-group');
    
    if (toolId && toolIcon && toolViewBox) {
      if (droppedOnGroup && target !== element) {
        // Add to existing group
        const group = target.classList.contains('button-group') ? target : target.closest('.button-group');
        if (group) {
          const removeBtn = group.querySelector('.group-remove-btn');
          const toolBtn = createConfigToolButton(toolId, toolIcon, toolViewBox, toolLabel);
          
          if (removeBtn) {
            group.insertBefore(toolBtn, removeBtn);
          } else {
            group.appendChild(toolBtn);
          }
          saveButtonConfig();
        }
      } else {
        // Create new group
        addButtonGroup(element, type);
        const newGroup = element.lastElementChild as HTMLElement;
        if (newGroup) {
          const removeBtn = newGroup.querySelector('.group-remove-btn');
          const toolBtn = createConfigToolButton(toolId, toolIcon, toolViewBox, toolLabel);
          
          if (removeBtn) {
            newGroup.insertBefore(toolBtn, removeBtn);
          } else {
            newGroup.appendChild(toolBtn);
          }
          saveButtonConfig();
        }
      }
    }
  });
}

function createConfigToolButton(toolId: string, toolIcon: string, toolViewBox: string, toolLabel: string): HTMLElement {
  const toolBtn = document.createElement('div');
  toolBtn.className = 'config-tool-item';
  toolBtn.dataset.toolId = toolId;
  toolBtn.title = toolLabel;
  toolBtn.draggable = true;
  toolBtn.style.cssText = 'padding:6px; background:var(--btn); border:1px solid var(--btn-border); border-radius:6px; display:flex; gap:4px; align-items:center; justify-content:center; min-width:40px; min-height:40px; cursor:grab; position:relative;';
  
  const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgIcon.setAttribute('class', 'icon');
  svgIcon.setAttribute('viewBox', toolViewBox);
  svgIcon.setAttribute('aria-hidden', 'true');
  svgIcon.style.cssText = 'width:20px; height:20px; pointer-events:none; flex-shrink:0;';
  svgIcon.innerHTML = toolIcon;
  
  toolBtn.appendChild(svgIcon);
  
  // Add remove icon on hover
  const removeIcon = document.createElement('span');
  removeIcon.textContent = '✕';
  removeIcon.style.cssText = 'width:18px; height:18px; background:#ef4444; color:white; border-radius:50%; display:none; align-items:center; justify-content:center; font-size:12px; cursor:pointer; flex-shrink:0; position:absolute; top:-6px; right:-6px;';
  toolBtn.appendChild(removeIcon);
  
  toolBtn.addEventListener('mouseenter', () => {
    removeIcon.style.display = 'flex';
  });
  
  toolBtn.addEventListener('mouseleave', () => {
    removeIcon.style.display = 'none';
  });
  
  removeIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    toolBtn.remove();
    saveButtonConfig();
  });
  
  // Drag events for reordering within group
  toolBtn.addEventListener('dragstart', (e) => {
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('toolId', toolId);
      e.dataTransfer.setData('toolIcon', toolIcon);
      e.dataTransfer.setData('toolViewBox', toolViewBox);
      e.dataTransfer.setData('toolLabel', toolLabel);
      e.dataTransfer.setData('fromGroup', 'true');
      toolBtn.style.opacity = '0.4';
    }
  });
  
  toolBtn.addEventListener('dragend', () => {
    toolBtn.style.opacity = '1';
  });
  
  // Allow dropping on this button to reorder
  toolBtn.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const fromGroup = e.dataTransfer?.types.includes('text/plain');
    if (fromGroup) {
      toolBtn.style.background = 'rgba(59, 130, 246, 0.2)';
    }
  });
  
  toolBtn.addEventListener('dragleave', () => {
    toolBtn.style.background = 'var(--btn)';
  });
  
  toolBtn.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toolBtn.style.background = 'var(--btn)';
    
    if (!e.dataTransfer) return;
    
    const draggedToolId = e.dataTransfer.getData('toolId');
    const draggedToolIcon = e.dataTransfer.getData('toolIcon');
    const draggedToolViewBox = e.dataTransfer.getData('toolViewBox');
    const draggedToolLabel = e.dataTransfer.getData('toolLabel');
    const fromGroup = e.dataTransfer.getData('fromGroup');
    
    if (draggedToolId && draggedToolId !== toolId) {
      const group = toolBtn.closest('.button-group');
      if (!group) return;
      
      // If dragging from another button in group, find and remove it
      if (fromGroup) {
        const existingBtn = Array.from(group.querySelectorAll('.config-tool-item')).find(
          btn => (btn as HTMLElement).dataset.toolId === draggedToolId
        );
        if (existingBtn) {
          existingBtn.remove();
        }
      }
      
      // Insert new button before this one
      const newBtn = createConfigToolButton(draggedToolId, draggedToolIcon, draggedToolViewBox, draggedToolLabel);
      toolBtn.parentElement?.insertBefore(newBtn, toolBtn);
      saveButtonConfig();
    }
  });
  
  // Setup touch drag support
  setupConfigTouchDrag(toolBtn, toolId, toolIcon, toolViewBox, toolLabel, true);
  
  return toolBtn;
}

function addButtonGroup(container: HTMLElement, type: 'multi' | 'second') {
  const group = document.createElement('div');
  group.className = 'button-group';
  group.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; align-items:center; padding:12px; background:var(--panel); border:2px solid var(--btn-border); border-radius:8px; min-height:60px; width:100%;';
  group.dataset.groupType = type;
  
  const removeBtn = document.createElement('button');
  removeBtn.textContent = '✕';
  removeBtn.className = 'tool icon-btn group-remove-btn';
  removeBtn.style.cssText = 'margin-left:auto; width:24px; height:24px; padding:0; background:transparent; border:none; font-size:18px; opacity:0.6; cursor:pointer;';
  removeBtn.addEventListener('click', () => {
    group.remove();
    saveButtonConfig();
  });
  
  // Prevent dropping on the remove button
  removeBtn.addEventListener('dragover', (e) => {
    e.stopPropagation();
  });
  removeBtn.addEventListener('drop', (e) => {
    e.stopPropagation();
    e.preventDefault();
  });
  
  group.appendChild(removeBtn);
  
  // Setup drop zone for the group itself
  setupGroupDropZone(group);
  
  container.appendChild(group);
  
  return group; // Return the group so we can use it without auto-saving
}

function setupGroupDropZone(group: HTMLElement) {
  group.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation(); // Stop propagation to parent
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    group.style.background = 'rgba(59, 130, 246, 0.1)';
  });
  
  group.addEventListener('dragleave', (e) => {
    e.stopPropagation(); // Stop propagation to parent
    group.style.background = 'var(--panel)';
  });
  
  group.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation(); // CRITICAL: Stop propagation to prevent double-add
    group.style.background = 'var(--panel)';
    
    if (!e.dataTransfer) return;
    
    const toolId = e.dataTransfer.getData('toolId');
    const toolIcon = e.dataTransfer.getData('toolIcon');
    const toolViewBox = e.dataTransfer.getData('toolViewBox');
    const toolLabel = e.dataTransfer.getData('toolLabel');
    
    if (toolId && toolIcon && toolViewBox) {
      const removeBtn = group.querySelector('.group-remove-btn');
      const toolBtn = createConfigToolButton(toolId, toolIcon, toolViewBox, toolLabel);
      
      if (removeBtn) {
        group.insertBefore(toolBtn, removeBtn);
      } else {
        group.appendChild(toolBtn);
      }
      
      saveButtonConfig();
    }
  });
}

function saveButtonConfig() {
  const multiGroups = document.getElementById('multiGroups');
  const secondGroups = document.getElementById('secondGroups');
  
  buttonConfig = {
    multiButtons: {},
    secondRow: {}
  };
  
  // Save multi-button groups
  if (multiGroups) {
    const groups = multiGroups.querySelectorAll('.button-group');
    groups.forEach((group, index) => {
      const buttons = group.querySelectorAll('.config-tool-item');
      const buttonIds: string[] = [];
      
      buttons.forEach(btn => {
        const toolId = (btn as HTMLElement).dataset.toolId;
        if (toolId) {
          buttonIds.push(toolId);
        }
      });
      
      if (buttonIds.length > 0) {
        // Use first button as the main ID
        const mainId = buttonIds[0];
        buttonConfig.multiButtons[mainId] = buttonIds;
      }
    });
  }
  
  // Save second-row groups
  if (secondGroups) {
    const groups = secondGroups.querySelectorAll('.button-group');
    groups.forEach((group) => {
      const buttons = group.querySelectorAll('.config-tool-item');
      const buttonIds: string[] = [];
      
      buttons.forEach(btn => {
        const toolId = (btn as HTMLElement).dataset.toolId;
        if (toolId) {
          buttonIds.push(toolId);
        }
      });
      
      if (buttonIds.length > 0) {
        // First button is main, rest are second row
        const mainId = buttonIds[0];
        const secondRowIds = buttonIds.slice(1);
        if (secondRowIds.length > 0) {
          buttonConfig.secondRow[mainId] = secondRowIds;
        }
      }
    });
  }
  
  // Save to localStorage
  try {
    localStorage.setItem('geometryButtonConfig', JSON.stringify(buttonConfig));
  } catch (e) {
    console.error('Failed to save button configuration:', e);
  }
}

function saveButtonOrder() {
  try {
    localStorage.setItem('geometryButtonOrder', JSON.stringify(buttonOrder));
  } catch (e) {
    console.error('Failed to save button order:', e);
  }
}

function loadButtonOrder() {
  try {
    const saved = localStorage.getItem('geometryButtonOrder');
    if (saved) {
      buttonOrder = JSON.parse(saved);
    } else {
      // Initialize with default order
      buttonOrder = TOOL_BUTTONS.map(t => t.id);
    }
  } catch (e) {
    console.error('Failed to load button order:', e);
    buttonOrder = TOOL_BUTTONS.map(t => t.id);
  }
}

function rebuildPalette() {
  const paletteGrid = document.getElementById('paletteGrid');
  if (!paletteGrid) return;
  
  paletteGrid.innerHTML = '';
  
  buttonOrder.forEach(toolId => {
    const tool = TOOL_BUTTONS.find(t => t.id === toolId);
    if (!tool) return;
    
    const btn = document.createElement('button');
    btn.className = 'config-tool-btn tool icon-btn';
    btn.dataset.toolId = tool.id;
    btn.title = tool.label;
    btn.style.cssText = 'padding:6px; background:var(--btn); border:1px solid var(--btn-border); border-radius:8px; cursor:move; display:flex; align-items:center; justify-content:center; min-height:44px; width:100%; aspect-ratio:1;';
    
    const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgIcon.setAttribute('class', 'icon');
    svgIcon.setAttribute('viewBox', tool.viewBox);
    svgIcon.setAttribute('aria-hidden', 'true');
    svgIcon.style.cssText = 'width:22px; height:22px; pointer-events:none;';
    svgIcon.innerHTML = tool.icon;
    
    btn.appendChild(svgIcon);
    paletteGrid.appendChild(btn);
  });
  
  setupPaletteDragAndDrop();
}

function setupConfigTouchDrag(toolBtn: HTMLElement, toolId: string, toolIcon: string, toolViewBox: string, toolLabel: string, fromGroup: boolean) {
  let isDragging = false;
  let phantom: HTMLElement | null = null;
  let currentDropZone: HTMLElement | null = null;
  
  toolBtn.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    isDragging = false;
    configTouchDrag = {
      element: toolBtn,
      toolId,
      toolIcon,
      toolViewBox,
      toolLabel,
      startX: touch.clientX,
      startY: touch.clientY,
      fromGroup
    };
  }, { passive: true });
  
  toolBtn.addEventListener('touchmove', (e) => {
    if (!configTouchDrag) return;
    
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - configTouchDrag.startX);
    const dy = Math.abs(touch.clientY - configTouchDrag.startY);
    
    // Start dragging if moved more than 5px
    if (!isDragging && (dx > 5 || dy > 5)) {
      isDragging = true;
      toolBtn.style.opacity = '0.4';
      
      // Create phantom element - only copy the icon, not all styles
      phantom = document.createElement('div');
      phantom.style.cssText = 'position:fixed; pointer-events:none; opacity:0.8; z-index:10000; padding:6px; background:var(--btn); border:2px solid #3b82f6; border-radius:6px; display:flex; align-items:center; justify-content:center; width:40px; height:40px;';
      
      const svgClone = toolBtn.querySelector('svg')?.cloneNode(true) as SVGElement;
      if (svgClone) {
        phantom.appendChild(svgClone);
      }
      
      phantom.style.left = (touch.clientX - 20) + 'px';
      phantom.style.top = (touch.clientY - 20) + 'px';
      document.body.appendChild(phantom);
      
      e.preventDefault();
    }
    
    if (isDragging && phantom) {
      phantom.style.left = (touch.clientX - 20) + 'px';
      phantom.style.top = (touch.clientY - 20) + 'px';
      
      // Highlight drop zones
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      if (target) {
        const group = target.closest('.button-group');
        const dropZone = target.closest('#multiGroups, #secondGroups') as HTMLElement;
        
        // Clear previous highlights
        if (currentDropZone && currentDropZone !== group && currentDropZone !== dropZone) {
          currentDropZone.style.background = '';
          currentDropZone.style.borderColor = '';
        }
        
        if (group) {
          if (currentDropZone !== group) {
            (group as HTMLElement).style.background = 'rgba(59, 130, 246, 0.1)';
          }
          currentDropZone = group as HTMLElement;
        } else if (dropZone) {
          if (currentDropZone !== dropZone) {
            dropZone.style.background = 'rgba(59, 130, 246, 0.05)';
            dropZone.style.borderColor = '#3b82f6';
          }
          currentDropZone = dropZone;
        } else {
          if (currentDropZone) {
            currentDropZone.style.background = '';
            currentDropZone.style.borderColor = '';
            currentDropZone = null;
          }
        }
      }
      
      e.preventDefault();
    }
  }, { passive: false });
  
  toolBtn.addEventListener('touchend', (e) => {
    // Clear highlights
    if (currentDropZone) {
      currentDropZone.style.background = '';
      currentDropZone.style.borderColor = '';
      currentDropZone = null;
    }
    
    if (phantom) {
      phantom.remove();
      phantom = null;
    }
    
    if (!configTouchDrag || !isDragging) {
      toolBtn.style.opacity = '1';
      configTouchDrag = null;
      isDragging = false;
      return;
    }
    
    toolBtn.style.opacity = '1';
    
    const touch = e.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (!target) {
      configTouchDrag = null;
      isDragging = false;
      return;
    }
    
    // Check if dropped on palette button (for reordering palette)
    const paletteBtn = target.closest('.config-tool-btn');
    const paletteGrid = document.getElementById('paletteGrid');
    
    if (paletteBtn && paletteGrid && paletteBtn.parentElement === paletteGrid && !fromGroup) {
      // Reordering in palette
      const targetToolId = (paletteBtn as HTMLElement).dataset.toolId;
      const draggedToolId = configTouchDrag.toolId;
      
      if (targetToolId && draggedToolId && targetToolId !== draggedToolId) {
        const draggedIndex = buttonOrder.indexOf(draggedToolId);
        const targetIndex = buttonOrder.indexOf(targetToolId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
          buttonOrder.splice(draggedIndex, 1);
          buttonOrder.splice(targetIndex, 0, draggedToolId);
          
          saveButtonOrder();
          rebuildPalette();
          applyButtonConfiguration();
        }
      }
      
      configTouchDrag = null;
      isDragging = false;
      return;
    }
    
    // Check if dropped on a group first
    const group = target.closest('.button-group');
    if (group) {
      // Check if dropped on another config button in group
      const targetBtn = target.closest('.config-tool-item') as HTMLElement;
      if (targetBtn && targetBtn !== toolBtn) {
        // Reordering within group - check if same group
        const toolBtnGroup = toolBtn.closest('.button-group');
        if (toolBtnGroup === group) {
          // Same group - just reorder (move, don't clone)
          group.insertBefore(toolBtn, targetBtn);
        } else {
          // Different group - remove from old, add to new
          toolBtn.remove();
          group.insertBefore(
            createConfigToolButton(configTouchDrag.toolId, configTouchDrag.toolIcon, configTouchDrag.toolViewBox, configTouchDrag.toolLabel),
            targetBtn
          );
        }
        saveButtonConfig();
      } else if (!targetBtn || targetBtn === toolBtn) {
        // Dropped on empty space in group but not on self
        if (targetBtn !== toolBtn) {
          const toolBtnGroup = toolBtn.closest('.button-group');
          if (fromGroup) {
            const existingBtn = Array.from(group.querySelectorAll('.config-tool-item')).find(
              btn => (btn as HTMLElement).dataset.toolId === configTouchDrag!.toolId
            );
            if (existingBtn && existingBtn !== toolBtn) {
              existingBtn.remove();
            }
          }
          
          if (toolBtnGroup === group && fromGroup) {
            // Same group, just dropped on empty space - do nothing
          } else {
            // Different group or from palette
            const removeBtn = group.querySelector('.group-remove-btn');
            const newBtn = createConfigToolButton(configTouchDrag.toolId, configTouchDrag.toolIcon, configTouchDrag.toolViewBox, configTouchDrag.toolLabel);
            if (removeBtn) {
              group.insertBefore(newBtn, removeBtn);
            } else {
              group.appendChild(newBtn);
            }
            if (fromGroup && toolBtnGroup !== group) {
              toolBtn.remove();
            }
          }
          saveButtonConfig();
        }
      }
      configTouchDrag = null;
      isDragging = false;
      return;
    }
    
    // Check if dropped on a drop zone (not in a group)
    const dropZone = target.closest('#multiGroups, #secondGroups');
    
    // If from group and not dropped on any valid target, remove it
    if (fromGroup && !dropZone) {
      // Dragged outside - remove the button
      toolBtn.remove();
      saveButtonConfig();
      configTouchDrag = null;
      isDragging = false;
      return;
    }
    
    // Only create new group if explicitly dropped on drop zone area (not just anywhere)
    if (dropZone && !fromGroup) {
      // Only allow creating new groups from palette, not from existing groups
      const dropZoneId = dropZone.id;
      const groupType = dropZoneId === 'multiGroups' ? 'multi' : 'second';
      const newGroup = addButtonGroup(dropZone as HTMLElement, groupType);
      
      if (newGroup) {
        const removeBtn = newGroup.querySelector('.group-remove-btn');
        const newBtn = createConfigToolButton(configTouchDrag.toolId, configTouchDrag.toolIcon, configTouchDrag.toolViewBox, configTouchDrag.toolLabel);
        if (removeBtn) {
          newGroup.insertBefore(newBtn, removeBtn);
        } else {
          newGroup.appendChild(newBtn);
        }
        saveButtonConfig();
      }
    }
    
    configTouchDrag = null;
    isDragging = false;
  }, { passive: true });
  
  toolBtn.addEventListener('touchcancel', () => {
    if (currentDropZone) {
      currentDropZone.style.background = '';
      currentDropZone.style.borderColor = '';
      currentDropZone = null;
    }
    if (phantom) {
      phantom.remove();
      phantom = null;
    }
    toolBtn.style.opacity = '1';
    configTouchDrag = null;
    isDragging = false;
  }, { passive: true });
}

function loadButtonConfiguration() {
  try {
    const saved = localStorage.getItem('geometryButtonConfig');
    if (saved) {
      buttonConfig = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load button configuration:', e);
  }
  
  // Load measurement precision settings
  try {
    const savedPrecisionLength = localStorage.getItem('measurementPrecisionLength');
    if (savedPrecisionLength !== null) {
      const value = parseInt(savedPrecisionLength, 10);
      if (!isNaN(value) && value >= 0 && value <= 5) {
        measurementPrecisionLength = value;
      }
    }
  } catch (e) {
    console.error('Failed to load measurement precision length:', e);
  }
  
  try {
    const savedPrecisionAngle = localStorage.getItem('measurementPrecisionAngle');
    if (savedPrecisionAngle !== null) {
      const value = parseInt(savedPrecisionAngle, 10);
      if (!isNaN(value) && value >= 0 && value <= 5) {
        measurementPrecisionAngle = value;
      }
    }
  } catch (e) {
    console.error('Failed to load measurement precision angle:', e);
  }
}

function getTimestampString() {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

async function exportButtonConfiguration() {
  const config = {
    version: 1,
    buttonOrder: buttonOrder,
    multiButtons: buttonConfig.multiButtons,
    secondRow: buttonConfig.secondRow,
    themeOverrides: themeOverrides,
    measurementPrecisionLength: measurementPrecisionLength,
    measurementPrecisionAngle: measurementPrecisionAngle,
    defaultFolderName: localStorage.getItem('defaultFolderName') || undefined
  };
  
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  
  // Try to use File System Access API and propose the default folder for configuration export
  if ('showSaveFilePicker' in window && defaultFolderHandle) {
    try {
      // Ensure we have permission before using the handle
      const hasPermission = await ensureFolderPermission(defaultFolderHandle);
      
      const defaultName = `geometry-config-${getTimestampString()}.json`;
      // @ts-ignore
      const pickerOpts: SaveFilePickerOptions = {
        suggestedName: defaultName,
        types: [
          {
            description: 'JSON File',
            accept: { 'application/json': ['.json'] }
          }
        ]
      };
      
      if (hasPermission) {
        // @ts-ignore
        pickerOpts.startIn = defaultFolderHandle;
      } else {
        // Permission denied, clear the handle
        defaultFolderHandle = null;
        await saveDefaultFolderHandle(null);
        updateDefaultFolderDisplay();
      }
      // @ts-ignore
      const fileHandle = await (window as any).showSaveFilePicker(pickerOpts);
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: any) {
      if (err.name === 'AbortError') return; // User cancelled
      console.warn('Failed to save config via showSaveFilePicker, falling back:', err);
    }
  }
  
  // Fallback to traditional download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `geometry-config-${getTimestampString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importButtonConfiguration(jsonString: string) {
  try {
    const config = JSON.parse(jsonString);
    
    // Validate and apply configuration with backward compatibility
    if (config.buttonOrder && Array.isArray(config.buttonOrder)) {
      // Validate that all button IDs exist
      const validIds = config.buttonOrder.filter((id: string) => 
        TOOL_BUTTONS.some(t => t.id === id)
      );
      if (validIds.length > 0) {
        buttonOrder = validIds;
        saveButtonOrder();
      }
    }
    
    if (config.multiButtons && typeof config.multiButtons === 'object') {
      buttonConfig.multiButtons = config.multiButtons;
    }
    
    if (config.secondRow && typeof config.secondRow === 'object') {
      buttonConfig.secondRow = config.secondRow;
    }
    
    // Restore theme overrides
    if (config.themeOverrides && typeof config.themeOverrides === 'object') {
      themeOverrides.dark = config.themeOverrides.dark || {};
      themeOverrides.light = config.themeOverrides.light || {};
      saveThemeOverrides();
      applyThemeWithOverrides(currentTheme);
      
      // Refresh appearance tab UI if available
      if (typeof (window as any).refreshAppearanceTab === 'function') {
        (window as any).refreshAppearanceTab();
      }
    }
    
    // Restore measurement precision
    if (typeof config.measurementPrecisionLength === 'number') {
      measurementPrecisionLength = config.measurementPrecisionLength;
      localStorage.setItem('measurementPrecisionLength', measurementPrecisionLength.toString());
    }
    if (typeof config.measurementPrecisionAngle === 'number') {
      measurementPrecisionAngle = config.measurementPrecisionAngle;
      localStorage.setItem('measurementPrecisionAngle', measurementPrecisionAngle.toString());
    }
    
    // Restore default folder name
    if (typeof config.defaultFolderName === 'string') {
      localStorage.setItem('defaultFolderName', config.defaultFolderName);
    }
    
    // Save to localStorage
    saveButtonConfig();
    
    // Reload UI
    applyButtonConfiguration();
    
    return true;
  } catch (e) {
    console.error('Failed to import configuration:', e);
    return false;
  }
}

function initAppearanceTab() {
  // Przyciski wyboru motywu
  const themeBtns = document.querySelectorAll<HTMLButtonElement>('.appearance-theme-toggle .theme-btn');
  const previewCanvas = document.getElementById('previewCanvas') as HTMLCanvasElement;
  
  let activeTheme: ThemeName = currentTheme;
  
  // Ustawienia motywu
  const themeBgColor = document.getElementById('themeBgColor') as HTMLInputElement;
  const themeStrokeColor = document.getElementById('themeStrokeColor') as HTMLInputElement;
  const themePanelColor = document.getElementById('themePanelColor') as HTMLInputElement;
  const themeHighlightColor = document.getElementById('themeHighlightColor') as HTMLInputElement;
  const themeBgColorHex = document.getElementById('themeBgColorHex') as HTMLInputElement;
  const themeStrokeColorHex = document.getElementById('themeStrokeColorHex') as HTMLInputElement;
  const themeHighlightColorHex = document.getElementById('themeHighlightColorHex') as HTMLInputElement;
  const themePanelColorHex = document.getElementById('themePanelColorHex') as HTMLInputElement;
  const themeLineWidthValue = document.getElementById('themeLineWidthValue');
  const themePointSizeValue = document.getElementById('themePointSizeValue');
  const themeArcRadiusValue = document.getElementById('themeArcRadiusValue');
  const themeFontSizeValue = document.getElementById('themeFontSizeValue');
  const themeHighlightWidthValue = document.getElementById('themeHighlightWidthValue');
  const resetBtn = document.getElementById('resetThemeDefaults');
  
  // Wczytaj aktualne wartości
  function loadThemeValues() {
    const theme = activeTheme;
    const base = THEME_PRESETS[theme];
    const overrides = themeOverrides[theme];
    const current = { ...base, ...overrides };
    
    if (themeBgColor) themeBgColor.value = current.bg || base.bg;
    if (themeBgColorHex) themeBgColorHex.value = (current.bg || base.bg).toLowerCase();
    if (themeStrokeColor) themeStrokeColor.value = current.defaultStroke || base.defaultStroke;
    if (themeStrokeColorHex) themeStrokeColorHex.value = (current.defaultStroke || base.defaultStroke).toLowerCase();
    if (themePanelColor) themePanelColor.value = current.panel ?? base.panel;
    if (themePanelColorHex) themePanelColorHex.value = String(current.panel ?? base.panel).toLowerCase();
    if (themeHighlightColor) themeHighlightColor.value = current.highlight || base.highlight;
    if (themeHighlightColorHex) themeHighlightColorHex.value = (current.highlight || base.highlight).toLowerCase();
    if (themeLineWidthValue) themeLineWidthValue.textContent = `${current.lineWidth || base.lineWidth} px`;
    if (themePointSizeValue) themePointSizeValue.textContent = `${current.pointSize || base.pointSize} px`;
    if (themeArcRadiusValue) themeArcRadiusValue.textContent = `${current.angleDefaultRadius || base.angleDefaultRadius} px`;
    if (themeFontSizeValue) themeFontSizeValue.textContent = `${current.fontSize || base.fontSize} px`;
    if (themeHighlightWidthValue) themeHighlightWidthValue.textContent = `${current.highlightWidth || base.highlightWidth} px`;
    
    // Aktualizuj przyciski motywu
    themeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
    
    drawPreview();
  }
  
  // Make loadThemeValues accessible globally for configuration import
  (window as any).refreshAppearanceTab = loadThemeValues;
  
  // Przełączanie motywu
  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme as ThemeName;
      if (theme) {
        activeTheme = theme;
        loadThemeValues();
      }
    });
  });
  
  // Zapisz zmianę
  function saveThemeValue(key: keyof ThemeConfig, value: any) {
    themeOverrides[activeTheme][key] = value;
    saveThemeOverrides();
    if (activeTheme === currentTheme) {
      applyThemeWithOverrides(currentTheme);
      draw();
    }
    drawPreview();
  }
  
  // Kolory
  themeBgColor?.addEventListener('input', (e) => {
    const v = (e.target as HTMLInputElement).value;
    if (themeBgColorHex) themeBgColorHex.value = v.toLowerCase();
    saveThemeValue('bg', v);
  });
  
  themeStrokeColor?.addEventListener('input', (e) => {
    const v = (e.target as HTMLInputElement).value;
    if (themeStrokeColorHex) themeStrokeColorHex.value = v.toLowerCase();
    saveThemeValue('defaultStroke', v);
  });

  themePanelColor?.addEventListener('input', (e) => {
    const v = (e.target as HTMLInputElement).value;
    // Apply immediately for live preview
    try {
      const root = document.documentElement;
      const body = document.body;
      root.style.setProperty('--panel', v);
      root.style.setProperty('--panel-border', v);
      if (body) {
        body.style.setProperty('--panel', v);
        body.style.setProperty('--panel-border', v);
      }
    } catch {}
    // Save both panel and panelBorder (use same value for border by default)
    saveThemeValue('panel', v);
    saveThemeValue('panelBorder', v);
  });

  // Helper: normalize/pick hex format
  function normalizeHex(input: string): string | null {
    if (!input) return null;
    let v = input.trim();
    if (!v.startsWith('#')) v = '#' + v;
    if (/^#([0-9a-fA-F]{3})$/.test(v)) {
      // expand #rgb to #rrggbb
      const r = v.charAt(1); const g = v.charAt(2); const b = v.charAt(3);
      return ('#' + r + r + g + g + b + b).toLowerCase();
    }
    if (/^#([0-9a-fA-F]{6})$/.test(v)) return v.toLowerCase();
    return null;
  }

  // Hex text inputs: sync into color inputs and save
  themeBgColorHex?.addEventListener('change', (e) => {
    const raw = (e.target as HTMLInputElement).value;
    const v = normalizeHex(raw);
    if (v && themeBgColor) {
      themeBgColor.value = v;
      saveThemeValue('bg', v);
    } else if (raw === '') {
      // allow clearing
      themeBgColorHex.value = '';
    }
  });
  themeStrokeColorHex?.addEventListener('change', (e) => {
    const raw = (e.target as HTMLInputElement).value;
    const v = normalizeHex(raw);
    if (v && themeStrokeColor) {
      themeStrokeColor.value = v;
      saveThemeValue('defaultStroke', v);
    }
  });
  themeHighlightColorHex?.addEventListener('change', (e) => {
    const raw = (e.target as HTMLInputElement).value;
    const v = normalizeHex(raw);
    if (v && themeHighlightColor) {
      themeHighlightColor.value = v;
      saveThemeValue('highlight', v);
    }
  });
  themePanelColorHex?.addEventListener('change', (e) => {
    const raw = (e.target as HTMLInputElement).value;
    const v = normalizeHex(raw);
    if (v && themePanelColor) {
      themePanelColor.value = v;
      // apply immediate
      try { const root = document.documentElement; const body = document.body; root.style.setProperty('--panel', v); root.style.setProperty('--panel-border', v); if (body) { body.style.setProperty('--panel', v); body.style.setProperty('--panel-border', v); } } catch {}
      saveThemeValue('panel', v);
      saveThemeValue('panelBorder', v);
    }
  });
  
  themeHighlightColor?.addEventListener('input', (e) => {
    const v = (e.target as HTMLInputElement).value;
    if (themeHighlightColorHex) themeHighlightColorHex.value = v.toLowerCase();
    saveThemeValue('highlight', v);
  });
  
  // Rozmiary
  const sizeBtns = document.querySelectorAll<HTMLButtonElement>('.size-btn');
  sizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const target = btn.dataset.target;
      if (!action || !target) return;
      
      const base = THEME_PRESETS[activeTheme];
      const overrides = themeOverrides[activeTheme];
      const current = { ...base, ...overrides };
      
      const delta = action === 'increase' ? 1 : -1;
      
      if (target === 'lineWidth') {
        const step = 0.1;
        const val = (current.lineWidth || base.lineWidth) + delta * step;
        const newValue = Math.max(0.1, Math.min(50, Math.round(val * 10) / 10));
        saveThemeValue('lineWidth', newValue);
        saveThemeValue('angleStrokeWidth', newValue);
        if (themeLineWidthValue) themeLineWidthValue.textContent = `${newValue} px`;
      } else if (target === 'pointSize') {
        const step = 0.1;
        const val = (current.pointSize || base.pointSize) + delta * step;
        const newValue = Math.max(0.1, Math.min(50, Math.round(val * 10) / 10));
        saveThemeValue('pointSize', newValue);
        if (themePointSizeValue) themePointSizeValue.textContent = `${newValue} px`;
      } else if (target === 'arcRadius') {
        const step = 1;
        const val = (current.angleDefaultRadius || base.angleDefaultRadius) + delta * step;
        const newValue = Math.max(1, Math.min(200, val));
        saveThemeValue('angleDefaultRadius', newValue);
        if (themeArcRadiusValue) themeArcRadiusValue.textContent = `${newValue} px`;
      } else if (target === 'fontSize') {
        const step = 1;
        const val = (current.fontSize || base.fontSize) + delta * step;
        const newValue = Math.max(4, Math.min(100, val));
        saveThemeValue('fontSize', newValue);
        if (themeFontSizeValue) themeFontSizeValue.textContent = `${newValue} px`;
      } else if (target === 'highlightWidth') {
        const step = 0.1;
        const val = (current.highlightWidth || base.highlightWidth) + delta * step;
        const newValue = Math.max(0.1, Math.min(20, Math.round(val * 10) / 10));
        saveThemeValue('highlightWidth', newValue);
        if (themeHighlightWidthValue) themeHighlightWidthValue.textContent = `${newValue} px`;
      }
    });
  });
  
  // Reset
  resetBtn?.addEventListener('click', () => {
    themeOverrides[activeTheme] = {};
    saveThemeOverrides();
    if (activeTheme === currentTheme) {
      applyThemeWithOverrides(currentTheme);
      draw();
    }
    loadThemeValues();
  });
  
  // Rysowanie podglądu
  function drawPreview() {
    if (!previewCanvas) return;
    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;
    
    const base = THEME_PRESETS[activeTheme];
    const overrides = themeOverrides[activeTheme];
    const theme = { ...base, ...overrides };
    
    const w = previewCanvas.width;
    const h = previewCanvas.height;
    
    // Tło
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    
    // Przykładowy trójkąt
    const points = [
      { x: w * 0.25, y: h * 0.7 },
      { x: w * 0.75, y: h * 0.7 },
      { x: w * 0.5, y: h * 0.3 }
    ];
    
    // Boki
    ctx.strokeStyle = theme.defaultStroke;
    ctx.lineWidth = theme.lineWidth;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();
    
    // Podświetlony bok
    ctx.strokeStyle = theme.highlight;
    ctx.lineWidth = (theme.highlightWidth || 1.5) + theme.lineWidth;
    ctx.beginPath();
    ctx.moveTo(points[1].x, points[1].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.stroke();
    
    // Punkty
    points.forEach((p, i) => {
      ctx.fillStyle = i === 1 ? theme.highlight : theme.defaultStroke;
      ctx.beginPath();
      ctx.arc(p.x, p.y, theme.pointSize + 2, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Kąt przy wierzchołku C (górny)
    const angleCenter = points[2];
    const angle1 = Math.atan2(points[0].y - angleCenter.y, points[0].x - angleCenter.x);
    const angle2 = Math.atan2(points[1].y - angleCenter.y, points[1].x - angleCenter.x);
    ctx.strokeStyle = theme.defaultStroke;
    ctx.lineWidth = theme.lineWidth;
    ctx.beginPath();
    ctx.arc(angleCenter.x, angleCenter.y, theme.angleDefaultRadius, angle2, angle1);
    ctx.stroke();
    
    // Okrąg na zewnątrz trójkąta
    const circleCenter = { x: w * 0.75, y: h * 0.35 };
    const circleRadius = w * 0.12;
    ctx.strokeStyle = theme.defaultStroke;
    ctx.lineWidth = theme.lineWidth;
    ctx.beginPath();
    ctx.arc(circleCenter.x, circleCenter.y, circleRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Punkty na okręgu
    const circlePoint1 = { x: circleCenter.x + circleRadius * Math.cos(Math.PI * 0.25), y: circleCenter.y + circleRadius * Math.sin(Math.PI * 0.25) };
    const circlePoint2 = { x: circleCenter.x + circleRadius * Math.cos(Math.PI * 1.75), y: circleCenter.y + circleRadius * Math.sin(Math.PI * 1.75) };
    [circlePoint1, circlePoint2].forEach(p => {
      ctx.fillStyle = theme.defaultStroke;
      ctx.beginPath();
      ctx.arc(p.x, p.y, theme.pointSize + 2, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Etykiety
    ctx.fillStyle = theme.defaultStroke;
    ctx.font = `${theme.fontSize || 12}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', points[0].x, points[0].y + 20);
    ctx.fillText('B', points[1].x, points[1].y + 20);
    ctx.fillText('C', points[2].x, points[2].y - 20);
  }
  
  // Inicjalizacja
  loadThemeValues();
}

function initLabelKeypad() {
  const container = document.getElementById('labelGreekRow');
  if (!container) return;

  // Greek letters (and extra slots for Script mode if needed)
  const count = Math.max(GREEK_LOWER.length, SCRIPT_LOWER.length);
  for (let i = 0; i < count; i++) {
    const lower = GREEK_LOWER[i];
    const upper = lower ? lower.toUpperCase() : ''; // GREEK_UPPER[i] || (lower ? lower.toUpperCase() : '');
    
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tool icon-btn label-greek-btn';
    
    if (lower) {
      btn.title = lower;
      btn.dataset.letter = lower;
      btn.dataset.letterLower = lower;
      btn.dataset.letterUpper = upper;
      btn.textContent = lower;
    } else {
      // Extra button for script mode, hidden by default in Greek mode
      btn.title = '';
      btn.dataset.letter = '';
      btn.dataset.letterLower = '';
      btn.dataset.letterUpper = '';
      btn.textContent = '';
      btn.style.display = 'none';
    }
    
    container.appendChild(btn);
  }
  
  // Symbols
  for (const sym of LABEL_SYMBOLS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tool icon-btn label-greek-btn label-symbol-btn';
    btn.title = sym;
    btn.dataset.letter = sym;
    btn.dataset.letterLower = sym;
    btn.dataset.letterUpper = sym;
    btn.textContent = sym;
    
    container.appendChild(btn);
  }
}

function updateDefaultFolderDisplay() {
  if (defaultFolderPath && clearDefaultFolderBtn) {
    if (defaultFolderHandle) {
      defaultFolderPath.textContent = defaultFolderHandle.name;
      clearDefaultFolderBtn.style.display = 'block';
    } else {
      const savedFolderName = localStorage.getItem('defaultFolderName');
      if (savedFolderName) {
        defaultFolderPath.textContent = savedFolderName;
        clearDefaultFolderBtn.style.display = 'block';
      } else {
        defaultFolderPath.textContent = 'Nie wybrano';
        clearDefaultFolderBtn.style.display = 'none';
      }
    }
  }
}

function initRuntime() {
  canvas = document.getElementById('canvas') as HTMLCanvasElement | null;
  ctx = canvas?.getContext('2d') ?? null;
  modeAddBtn = document.getElementById('modeAdd') as HTMLButtonElement | null;
  modeLabelBtn = document.getElementById('modeLabel') as HTMLButtonElement | null;
  modeMoveBtn = document.getElementById('modeMove') as HTMLButtonElement | null;
  modeMultiselectBtn = document.getElementById('modeMultiselect') as HTMLButtonElement | null;
  modeSegmentBtn = document.getElementById('modeSegment') as HTMLButtonElement | null;
  modeParallelBtn = document.getElementById('modeParallel') as HTMLButtonElement | null;
  modePerpBtn = document.getElementById('modePerpendicular') as HTMLButtonElement | null;
  modeCircleThreeBtn = document.getElementById('modeCircleThree') as HTMLButtonElement | null;
  modeTriangleBtn = document.getElementById('modeTriangleUp') as HTMLButtonElement | null;
  modeSquareBtn = document.getElementById('modeSquare') as HTMLButtonElement | null;
  modePolygonBtn = document.getElementById('modePolygon') as HTMLButtonElement | null;
  modeHandwritingBtn = document.getElementById('modeHandwriting') as HTMLButtonElement | null;
  modeAngleBtn = document.getElementById('modeAngle') as HTMLButtonElement | null;
  modeBisectorBtn = document.getElementById('modeBisector') as HTMLButtonElement | null;
  modeMidpointBtn = document.getElementById('modeMidpoint') as HTMLButtonElement | null;
  modeSymmetricBtn = document.getElementById('modeSymmetric') as HTMLButtonElement | null;
  modeParallelLineBtn = document.getElementById('modeParallelLine') as HTMLButtonElement | null;
  modeNgonBtn = document.getElementById('modeNgon') as HTMLButtonElement | null;
  debugToggleBtn = document.getElementById('debugToggle') as HTMLButtonElement | null;
  const settingsBtn = document.getElementById('settingsBtn') as HTMLButtonElement | null;
  const settingsModal = document.getElementById('settingsModal') as HTMLElement | null;
  const settingsCloseBtn = document.getElementById('settingsCloseBtn') as HTMLButtonElement | null;
  debugPanel = document.getElementById('debugPanel');
  debugPanelHeader = document.getElementById('debugPanelHandle');
  debugCloseBtn = document.getElementById('debugCloseBtn') as HTMLButtonElement | null;
  debugContent = document.getElementById('debugContent');
  viewModeToggleBtn = document.getElementById('viewModeToggle') as HTMLButtonElement | null;
  rayModeToggleBtn = document.getElementById('rayModeToggle') as HTMLButtonElement | null;
  raySegmentBtn = document.getElementById('raySegmentOption') as HTMLButtonElement | null;
  rayRightBtn = document.getElementById('rayRightOption') as HTMLButtonElement | null;
  rayLeftBtn = document.getElementById('rayLeftOption') as HTMLButtonElement | null;
  styleEdgesRow = document.getElementById('styleEdgesRow');
  viewModeMenuContainer = document.getElementById('viewModeMenuContainer') as HTMLElement | null;
  rayModeMenuContainer = document.getElementById('rayModeMenuContainer') as HTMLElement | null;
  hideBtn = document.getElementById('hideButton') as HTMLButtonElement | null;
  deleteBtn = document.getElementById('deletePoint') as HTMLButtonElement | null;
  copyStyleBtn = document.getElementById('copyStyleBtn') as HTMLButtonElement | null;
  multiMoveBtn = document.getElementById('multiMoveBtn') as HTMLButtonElement | null;
  multiCloneBtn = document.getElementById('multiCloneBtn') as HTMLButtonElement | null;
  zoomMenuBtn = document.getElementById('zoomMenu') as HTMLButtonElement | null;
  zoomMenuContainer = zoomMenuBtn?.parentElement ?? null;
  zoomMenuDropdown = zoomMenuContainer?.querySelector('.dropdown-menu') as HTMLElement | null;
  showHiddenBtn = document.getElementById('showHiddenBtn') as HTMLButtonElement | null;
  showMeasurementsBtn = document.getElementById('showMeasurementsBtn') as HTMLButtonElement | null;
  copyImageBtn = document.getElementById('copyImageBtn') as HTMLButtonElement | null;
  saveImageBtn = document.getElementById('saveImageBtn') as HTMLButtonElement | null;
  exportJsonBtn = document.getElementById('exportJsonBtn') as HTMLButtonElement | null;
  importJsonBtn = document.getElementById('importJsonBtn') as HTMLButtonElement | null;
  importJsonInput = document.getElementById('importJsonInput') as HTMLInputElement | null;
  selectDefaultFolderBtn = document.getElementById('selectDefaultFolderBtn') as HTMLButtonElement | null;
  clearDefaultFolderBtn = document.getElementById('clearDefaultFolderBtn') as HTMLButtonElement | null;
  defaultFolderPath = document.getElementById('defaultFolderPath') as HTMLElement | null;
  clearAllBtn = document.getElementById('clearAll') as HTMLButtonElement | null;
  themeDarkBtn = document.getElementById('themeDark') as HTMLButtonElement | null;
  undoBtn = document.getElementById('undo') as HTMLButtonElement | null;
  redoBtn = document.getElementById('redo') as HTMLButtonElement | null;
  styleMenuContainer = document.getElementById('styleMenuContainer') as HTMLElement | null;
  styleMenuBtn = document.getElementById('styleMenu') as HTMLButtonElement | null;
  styleMenuDropdown = styleMenuContainer?.querySelector('.dropdown-menu') as HTMLElement | null;
  eraserBtn = document.getElementById('eraserBtn') as HTMLButtonElement | null;
  if (eraserBtn) {
    eraserBtn.addEventListener('click', () => {
      eraserActive = !eraserActive;
      eraserBtn?.classList.toggle('active', eraserActive);
      eraserBtn?.setAttribute('aria-pressed', eraserActive ? 'true' : 'false');
      // Ensure style menu is available when eraser toggled on (handwriting uses style menu)
      if (eraserActive) {
        if (styleMenuContainer) styleMenuContainer.style.display = 'inline-flex';
      }
    });
  }
  styleColorRow = document.getElementById('styleColorRow');
  styleWidthRow = document.getElementById('styleWidthRow');
  styleTypeRow = document.getElementById('styleTypeRow');
  styleTypeInline = document.getElementById('styleTypeInline');
  styleRayGroup = document.getElementById('styleRayGroup');
  styleTickGroup = document.getElementById('styleTickGroup');
  styleTickButton = document.getElementById('styleTickToggle') as HTMLButtonElement | null;
  styleTypeGap = document.getElementById('styleTypeGap');
  styleArcRow = document.getElementById('styleArcRow');
  styleHideRow = document.getElementById('styleHideRow');
  labelTextRow = document.getElementById('labelTextRow');
  labelFontRow = document.getElementById('labelFontRow');
  labelGreekRow = document.getElementById('labelGreekRow');
  labelGreekToggleBtn = document.getElementById('labelGreekToggle') as HTMLButtonElement | null;
  labelGreekShiftBtn = document.getElementById('labelGreekShift') as HTMLButtonElement | null;
  labelScriptBtn = document.getElementById('labelScriptToggle') as HTMLButtonElement | null;
  styleColorInput = document.getElementById('styleColor') as HTMLInputElement | null;
  styleWidthInput = document.getElementById('styleWidth') as HTMLInputElement | null;
  lineWidthDecreaseBtn = document.getElementById('lineWidthDecrease') as HTMLButtonElement | null;
  lineWidthIncreaseBtn = document.getElementById('lineWidthIncrease') as HTMLButtonElement | null;
  lineWidthValueDisplay = document.getElementById('lineWidthValue');
  styleTypeSelect = document.getElementById('styleType') as HTMLSelectElement | null;
  labelTextInput = document.getElementById('labelText') as HTMLTextAreaElement | null;
  labelFontDecreaseBtn = document.getElementById('labelFontDecrease') as HTMLButtonElement | null;
  labelFontIncreaseBtn = document.getElementById('labelFontIncrease') as HTMLButtonElement | null;
  labelFontSizeDisplay = document.getElementById('labelFontSizeValue');
  arcCountButtons = Array.from(document.querySelectorAll('.arc-count-btn')) as HTMLButtonElement[];
  rightAngleBtn = document.getElementById('rightAngleBtn') as HTMLButtonElement | null;
  exteriorAngleBtn = document.getElementById('exteriorAngleBtn') as HTMLButtonElement | null;
  angleRadiusDecreaseBtn = document.getElementById('angleRadiusDecreaseBtn') as HTMLButtonElement | null;
  angleRadiusIncreaseBtn = document.getElementById('angleRadiusIncreaseBtn') as HTMLButtonElement | null;
  colorSwatchButtons = Array.from(document.querySelectorAll('.color-btn:not(.custom-color-btn)')) as HTMLButtonElement[];
  customColorBtn = document.getElementById('customColorBtn') as HTMLButtonElement | null;
  styleTypeButtons = Array.from(document.querySelectorAll('.type-btn')) as HTMLButtonElement[];
  labelGreekButtons = Array.from(document.querySelectorAll('.label-greek-btn')) as HTMLButtonElement[];
  
  ngonModal = document.getElementById('ngonModal');
  ngonCloseBtn = document.getElementById('ngonCloseBtn') as HTMLButtonElement | null;
  ngonConfirmBtn = document.getElementById('ngonConfirmBtn') as HTMLButtonElement | null;
  ngonInput = document.getElementById('ngonInput') as HTMLInputElement | null;
  ngonPresetButtons = Array.from(document.querySelectorAll('.ngon-preset-btn')) as HTMLButtonElement[];

  ngonCloseBtn?.addEventListener('click', () => {
    if (ngonModal) ngonModal.style.display = 'none';
    // Cancel creation - remove the base points if they were just created?
    // For now, just close. User can Undo.
    if (squareStartIndex !== null) {
       // If we want to be nice, we could remove the points, but Undo is safer.
       // Reset state
       squareStartIndex = null;
       selectedPointIndex = null;
       draw();
    }
  });

  const confirmNgon = () => {
    if (ngonInput) {
      const n = parseInt(ngonInput.value, 10);
      if (Number.isFinite(n) && n >= 3) {
        ngonSides = n;
        createNgonFromBase();
        if (ngonModal) ngonModal.style.display = 'none';
      }
    }
  };

  ngonConfirmBtn?.addEventListener('click', confirmNgon);
  ngonInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmNgon();
  });

  ngonPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.n || '5', 10);
      ngonSides = n;
      if (ngonInput) ngonInput.value = String(n);
      createNgonFromBase();
      if (ngonModal) ngonModal.style.display = 'none';
    });
  });

  initLabelKeypad();
  // Re-fetch buttons after dynamic generation
  labelGreekButtons = Array.from(document.querySelectorAll('.label-greek-btn')) as HTMLButtonElement[];
  strokeColorInput = styleColorInput;
  if (strokeColorInput) {
    strokeColorInput.value = THEME.defaultStroke;
  }
  debugToggleBtn?.addEventListener('click', () => {
    debugVisible = !debugVisible;
    renderDebugPanel();
    draw();
  });
  debugCloseBtn?.addEventListener('click', () => {
    debugVisible = false;
    renderDebugPanel();
  });

  const handleDebugPointerDown = (ev: PointerEvent) => {
    if (!debugPanel || !debugPanelHeader) return;
    const target = ev.target as HTMLElement | null;
    if (target && target.closest('#debugCloseBtn')) return;
    debugPanelHeader.setPointerCapture(ev.pointerId);
    const rect = debugPanel.getBoundingClientRect();
    if (!debugPanelPos) {
      debugPanelPos = { x: rect.left, y: rect.top };
    }
    debugDragState = {
      pointerId: ev.pointerId,
      start: { x: ev.clientX, y: ev.clientY },
      panelStart: { x: debugPanelPos!.x, y: debugPanelPos!.y }
    };
    debugPanel.classList.add('debug-panel--dragging');
    ev.preventDefault();
  };

  debugPanelHeader?.addEventListener('pointerdown', handleDebugPointerDown);
  debugPanelHeader?.addEventListener('pointermove', (ev) => {
    if (!debugDragState || debugDragState.pointerId !== ev.pointerId || !debugPanel) return;
    const dx = ev.clientX - debugDragState.start.x;
    const dy = ev.clientY - debugDragState.start.y;
    const rect = debugPanel.getBoundingClientRect();
    const width = rect.width || debugPanel.offsetWidth || 320;
    const height = rect.height || debugPanel.offsetHeight || 240;
    const maxX = Math.max(DEBUG_PANEL_MARGIN.x, window.innerWidth - width - DEBUG_PANEL_MARGIN.x);
    const maxY = Math.max(DEBUG_PANEL_TOP_MIN, window.innerHeight - height - DEBUG_PANEL_MARGIN.y);
    debugPanelPos = {
      x: clamp(debugDragState.panelStart.x + dx, DEBUG_PANEL_MARGIN.x, maxX),
      y: clamp(debugDragState.panelStart.y + dy, DEBUG_PANEL_TOP_MIN, maxY)
    };
    applyDebugPanelPosition();
  });
  const releaseDebugPointer = (ev: PointerEvent) => {
    if (!debugDragState || debugDragState.pointerId !== ev.pointerId) return;
    endDebugPanelDrag(ev.pointerId);
  };
  debugPanelHeader?.addEventListener('pointerup', releaseDebugPointer);
  debugPanelHeader?.addEventListener('pointercancel', releaseDebugPointer);

  if (!canvas || !ctx) return;

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('resize', () => {
    if (debugVisible) ensureDebugPanelPosition();
  });
  resizeCanvas();
  // ensure history baseline so undo/redo works after first action
  if (historyIndex < 0) {
    pushHistory();
  }
  canvas.addEventListener('pointerdown', handleCanvasClick);
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'touch') {
      updateTouchPointFromEvent(ev);
      if (activeTouches.size >= 2 && !pinchState) {
        startPinchFromTouches();
      }
      if (pinchState) {
        continuePinchGesture();
        ev.preventDefault();
        return;
      }
    }
    if (mode === 'handwriting') {
      appendInkStrokePoint(ev);
      return;
    }
    
    // Handle multiselect box drawing
    if (mode === 'multiselect' && multiselectBoxStart && ev.buttons === 1) {
      const { x, y } = canvasToWorld(ev.clientX, ev.clientY);
      multiselectBoxEnd = { x, y };
      draw();
      return;
    }
    
    const { x, y } = toPoint(ev);
    activeAxisSnap = null;
    if (resizingLine) {
      const { center, dir, vectors, baseHalf, lines } = resizingLine;
      const vec = { x: x - center.x, y: y - center.y };
      const proj = vec.x * dir.x + vec.y * dir.y;
      const newHalf = Math.max(5, Math.abs(proj));
      const scale = newHalf / Math.max(baseHalf, 0.0001);
      const touched = new Set<number>();
      vectors.forEach(({ idx, vx, vy }) => {
        const p = model.points[idx];
        if (!p) return;
        const target = { x: center.x + vx * scale, y: center.y + vy * scale };
        const constrained = constrainToCircles(idx, target);
        model.points[idx] = { ...p, ...constrained };
        touched.add(idx);
      });
      lines.forEach((li) => enforceIntersections(li));
      touched.forEach((idx) => {
        updateMidpointsForPoint(idx);
        updateCirclesForPoint(idx);
      });
      movedDuringDrag = true;
      draw();
    } else if (draggingLabel && mode === 'move') {
      const dx = x - draggingLabel.start.x;
      const dy = y - draggingLabel.start.y;
      const dxScreen = dx * zoomFactor;
      const dyScreen = dy * zoomFactor;
      switch (draggingLabel.kind) {
        case 'point': {
          const p = model.points[draggingLabel.id];
          if (p?.label)
            p.label = {
              ...p.label,
              offset: { x: draggingLabel.initialOffset.x + dxScreen, y: draggingLabel.initialOffset.y + dyScreen }
            };
          break;
        }
        case 'line': {
          const l = model.lines[draggingLabel.id];
          if (l?.label)
            l.label = {
              ...l.label,
              offset: { x: draggingLabel.initialOffset.x + dxScreen, y: draggingLabel.initialOffset.y + dyScreen }
            };
          break;
        }
        case 'angle': {
          const a = model.angles[draggingLabel.id];
          if (a?.label)
            a.label = {
              ...a.label,
              offset: { x: draggingLabel.initialOffset.x + dxScreen, y: draggingLabel.initialOffset.y + dyScreen }
            };
          break;
        }
        case 'free': {
          const lab = model.labels[draggingLabel.id];
          if (lab) model.labels[draggingLabel.id] = { ...lab, pos: { x: draggingLabel.initialOffset.x + dx, y: draggingLabel.initialOffset.y + dy } };
          break;
        }
      }
      movedDuringDrag = true;
      draw();
    } else if (draggingMultiSelection && mode === 'multiselect') {
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      const movedPointIndices = new Set<number>();
      
      // Collect all points from selected lines (including intersection points)
      multiSelectedLines.forEach(li => {
        const line = model.lines[li];
        if (line) {
          line.points.forEach(pi => movedPointIndices.add(pi));
          // Also collect points that have this line as parent (e.g., intersection points)
          model.points.forEach((p, idx) => {
            if (p && p.parent_refs.some(ref => ref.kind === 'line' && ref.id === line.id)) {
              movedPointIndices.add(idx);
            }
          });
        }
      });
      
      // Move all selected circles (collect all their points)
      multiSelectedCircles.forEach(ci => {
        const circle = model.circles[ci];
        if (circle) {
          // Collect center
          if (circle.center !== null) {
            movedPointIndices.add(circle.center);
          }
          // Collect radius point
          if (circle.radius_point !== null) {
            movedPointIndices.add(circle.radius_point);
          }
          // Collect perimeter points
          circle.points.forEach(pi => {
            movedPointIndices.add(pi);
          });
        }
      });
      
      // Add explicitly selected points
      multiSelectedPoints.forEach(idx => {
        movedPointIndices.add(idx);
      });
      
      // Move all collected points once
      movedPointIndices.forEach(idx => {
        const p = model.points[idx];
        // During multi-selection drag, move ALL points including intersections/midpoints
        // to keep the construction together - they will be recomputed after the drag
        if (p) {
          model.points[idx] = { ...p, x: p.x + dx, y: p.y + dy };
        }
      });
      
      // Move all selected ink strokes
      multiSelectedInkStrokes.forEach(si => {
        const stroke = model.inkStrokes[si];
        if (stroke) {
          model.inkStrokes[si] = {
            ...stroke,
            points: stroke.points.map(pt => ({ ...pt, x: pt.x + dx, y: pt.y + dy }))
          };
        }
      });
      
      dragStart = { x, y };
      movedDuringDrag = true;
      draw();
    } else if (draggingSelection && mode === 'move') {
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      const movedPoints = new Set<number>();
      let dragStartAlreadySet = false; // Flag to prevent overwriting dragStart for constrained points

      if (selectedInkStrokeIndex !== null) {
        const stroke = model.inkStrokes[selectedInkStrokeIndex];
        if (stroke) {
          model.inkStrokes[selectedInkStrokeIndex] = {
            ...stroke,
            points: stroke.points.map(pt => ({ ...pt, x: pt.x + dx, y: pt.y + dy }))
          };
          dragStart = { x, y };
          movedDuringDrag = true;
          draw();
        }
        return;
      }

      if (
        circleDragContext &&
        selectedCircleIndex !== null &&
        circleDragContext.circleIdx === selectedCircleIndex &&
        selectedPointIndex === null &&
        selectedSegments.size === 0
      ) {
        // Don't allow dragging three-point circles (their center is computed)
        const circle = model.circles[selectedCircleIndex];
        if (circle && isCircleThroughPoints(circle)) {
          return;
        }
        
        circleDragContext.originals.forEach((orig, idx) => {
          const pt = model.points[idx];
          if (!pt) return;
          model.points[idx] = { ...pt, x: orig.x + dx, y: orig.y + dy };
          movedPoints.add(idx);
        });
        if (movedPoints.size > 0) {
          movedPoints.forEach((idx) => {
            updateMidpointsForPoint(idx);
            updateCirclesForPoint(idx);
          });
          updateIntersectionsForCircle(circleDragContext.circleIdx);
          const referencing = new Set<number>(movedPoints);
          referencing.forEach((idx) => {
            circlesReferencingPoint(idx).forEach((ci) => {
              if (ci !== circleDragContext!.circleIdx) updateIntersectionsForCircle(ci);
            });
          });

          if (circleDragContext.dependentLines) {
            circleDragContext.dependentLines.forEach((fractions, lIdx) => {
              applyFractionsToLine(lIdx, fractions);
              updateIntersectionsForLine(lIdx);
            });
          }

          movedDuringDrag = true;
          draw();
        }
        return;
      }

      if (selectedPointIndex !== null) {
        const p = model.points[selectedPointIndex];
        if (!isPointDraggable(p)) return;
        const isOnObject = p?.construction_kind === 'on_object';
        const parentLineObj = primaryLineParent(p);
        const parentLineIdx = parentLineObj ? lineIndexById(parentLineObj.id) : null;
        const radiusCircleIdx = model.circles.findIndex((circle) => circle.radius_point === selectedPointIndex);
        if (radiusCircleIdx !== -1) {
          const circle = model.circles[radiusCircleIdx];
          const center = model.points[circle.center];
          if (!center) return;
          const rawTarget = { x: p.x + dx, y: p.y + dy };
          let vx = rawTarget.x - center.x;
          let vy = rawTarget.y - center.y;
          let len = Math.hypot(vx, vy);
          if (len <= 1e-6) {
            vx = p.x - center.x;
            vy = p.y - center.y;
            len = Math.hypot(vx, vy);
          }
          if (len <= 1e-6) return;
          const radius = len;
          const norm = { x: vx / len, y: vy / len };
          const newRadiusPos = { x: center.x + norm.x * radius, y: center.y + norm.y * radius };
          model.points[selectedPointIndex] = { ...p, ...newRadiusPos };
          movedPoints.add(selectedPointIndex);
          const perimeter = circlePerimeterPoints(circle).filter((pi) => pi !== selectedPointIndex);
          perimeter.forEach((pi) => {
            const pt = model.points[pi];
            if (!pt) return;
            const ang = Math.atan2(pt.y - center.y, pt.x - center.x);
            if (!Number.isFinite(ang)) return;
            const pos = { x: center.x + Math.cos(ang) * radius, y: center.y + Math.sin(ang) * radius };
            model.points[pi] = { ...pt, ...pos };
            movedPoints.add(pi);
          });
          dragStart = { x, y };
          movedDuringDrag = true;
          movedPoints.forEach((pi) => {
            updateMidpointsForPoint(pi);
            updateCirclesForPoint(pi);
          });
          updateIntersectionsForCircle(radiusCircleIdx);
          const referencingTargets = new Set<number>([selectedPointIndex, ...perimeter]);
          referencingTargets.forEach((pi) => {
            circlesReferencingPoint(pi).forEach((ci) => {
              if (ci !== radiusCircleIdx) updateIntersectionsForCircle(ci);
            });
          });
          // Also apply line fractions if the radius point is an endpoint of a line
          const linesWithRadiusPoint = findLinesContainingPoint(selectedPointIndex);
          linesWithRadiusPoint.forEach((lineIdx) => {
            const line = model.lines[lineIdx];
            if (!line) return;
            const isEndpoint =
              selectedPointIndex === line.points[0] ||
              selectedPointIndex === line.points[line.points.length - 1];
            if (isEndpoint) {
              applyLineFractions(lineIdx);
              updateIntersectionsForLine(lineIdx);
            }
          });
          draw();
          return;
        }
        const circleCenters = circlesWithCenter(selectedPointIndex);
        if (circleCenters.length) {
          const centerRadiusCircles = circleCenters.filter((ci) => model.circles[ci]?.circle_kind === 'center-radius');
          if (centerRadiusCircles.length) {
            const prevCenter = { x: p.x, y: p.y };
            const target = { x: p.x + dx, y: p.y + dy };
            if (!draggingCircleCenterAngles) draggingCircleCenterAngles = new Map();
            const snapshots: {
              circleIdx: number;
              angleMap: Map<number, number>;
              fallbackRadius: number;
            }[] = [];
            centerRadiusCircles.forEach((ci) => {
              const circle = model.circles[ci];
              if (!circle) return;
              const radiusPoint = model.points[circle.radius_point];
              let radius = 0;
              if (radiusPoint) {
                radius = Math.hypot(radiusPoint.x - prevCenter.x, radiusPoint.y - prevCenter.y);
              }
              if (!(radius > 0)) {
                const fallbackIdx = circle.points.find((pid) => {
                  const pt = model.points[pid];
                  return !!pt && (pt.x !== prevCenter.x || pt.y !== prevCenter.y);
                });
                if (fallbackIdx !== undefined) {
                  const pt = model.points[fallbackIdx]!;
                  radius = Math.hypot(pt.x - prevCenter.x, pt.y - prevCenter.y);
                }
              }
              if (!(radius > 0)) radius = circleRadius(circle);
              if (!(radius > 0)) return;
              const existing = draggingCircleCenterAngles!.get(ci);
              const angleMap = existing ?? new Map<number, number>();
              if (!existing) draggingCircleCenterAngles!.set(ci, angleMap);
              circle.points.forEach((pid) => {
                if (angleMap.has(pid)) return;
                const pt = model.points[pid];
                if (!pt) return;
                angleMap.set(pid, Math.atan2(pt.y - prevCenter.y, pt.x - prevCenter.x));
              });
              if (radiusPoint) {
                angleMap.set(
                  circle.radius_point,
                  Math.atan2(radiusPoint.y - prevCenter.y, radiusPoint.x - prevCenter.x)
                );
              }
              snapshots.push({ circleIdx: ci, angleMap, fallbackRadius: radius });
            });
            
            // Constrain circle center to parent line if it exists
            let constrainedTarget = target;
            if (parentLineIdx !== null) {
              constrainedTarget = constrainToLineIdx(parentLineIdx, target);
            }
            constrainedTarget = constrainToCircles(selectedPointIndex, constrainedTarget);
            
            model.points[selectedPointIndex] = { ...p, ...constrainedTarget };
            movedPoints.add(selectedPointIndex);
            snapshots.forEach(({ circleIdx, angleMap, fallbackRadius }) => {
              const circle = model.circles[circleIdx];
              if (!circle) return;
              const radiusPoint = model.points[circle.radius_point];
              let radiusLength = circleRadius(circle);
              if (!(radiusLength > 0)) radiusLength = fallbackRadius;
              if (!(radiusLength > 0)) return;
              if (radiusPoint) {
                angleMap.set(
                  circle.radius_point,
                  Math.atan2(radiusPoint.y - target.y, radiusPoint.x - target.x)
                );
              }
              angleMap.forEach((angle, pid) => {
                if (pid === selectedPointIndex) return;
                if (pid === circle.radius_point) return;
                const pt = model.points[pid];
                if (!pt) return;
                const pos = {
                  x: target.x + Math.cos(angle) * radiusLength,
                  y: target.y + Math.sin(angle) * radiusLength
                };
                model.points[pid] = { ...pt, ...pos };
                movedPoints.add(pid);
              });
            });

            // Update lines where the moved center point is a defining point
            const linesWithPoint = findLinesContainingPoint(selectedPointIndex);
            linesWithPoint.forEach((lineIdx) => {
              const line = model.lines[lineIdx];
              if (!line || !line.defining_points.includes(selectedPointIndex)) return;
              
              const definingPoints = line.defining_points.map(i => model.points[i]).filter(Boolean) as Point[];
              if (definingPoints.length < 2) return;
              
              const [p1, p2] = definingPoints;
              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;
              const len = Math.hypot(dx, dy);
              if (len < 1e-9) return;
              const dir = { x: dx / len, y: dy / len };
              
              line.points.forEach((pIdx) => {
                if (line.defining_points.includes(pIdx)) return;
                const pt = model.points[pIdx];
                if (!pt) return;
                
                // Project point onto the new line
                const projection = (pt.x - p1.x) * dir.x + (pt.y - p1.y) * dir.y;
                const newPos = { x: p1.x + dir.x * projection, y: p1.y + dir.y * projection };
                
                model.points[pIdx] = { ...pt, ...newPos };
                movedPoints.add(pIdx);
              });
              updateIntersectionsForLine(lineIdx);
            });

            dragStart = { x, y };
            movedDuringDrag = true;
            movedPoints.forEach((pi) => {
              updateMidpointsForPoint(pi);
              updateCirclesForPoint(pi);
            });
            centerRadiusCircles.forEach((ci) => updateIntersectionsForCircle(ci));
            draw();
            return;
          }

          circleCenters.forEach((ci) => {
            const c = model.circles[ci];
            if (!c) return;
            const center = model.points[c.center];
            if (!center) return;
            model.points[c.center] = { ...center, x: center.x + dx, y: center.y + dy };
            movedPoints.add(c.center);
            circlePerimeterPoints(c).forEach((pi) => {
              const pt = model.points[pi];
              if (!pt) return;
              model.points[pi] = { ...pt, x: pt.x + dx, y: pt.y + dy };
              movedPoints.add(pi);
            });
          });
          dragStart = { x, y };
          movedDuringDrag = true;
          movedPoints.forEach((pi) => {
            updateMidpointsForPoint(pi);
            updateCirclesForPoint(pi);
          });
          circleCenters.forEach((ci) => updateIntersectionsForCircle(ci));
          draw();
          return;
        }
        const linesWithPoint = findLinesContainingPoint(selectedPointIndex);
        const mainLineIdx =
          selectedLineIndex !== null && linesWithPoint.includes(selectedLineIndex)
            ? selectedLineIndex
            : linesWithPoint[0];
        if (mainLineIdx !== undefined) {
          const mainLine = model.lines[mainLineIdx];
          const isEndpoint = mainLine.defining_points.includes(selectedPointIndex);
          const isDefining = isDefiningPointOfLine(selectedPointIndex, mainLineIdx);
          
          // Defining points can move freely even if they're not endpoints
          if (isEndpoint || isDefining) {
            // Make sure we have line drag context for this line
            if (!lineDragContext || lineDragContext.lineIdx !== mainLineIdx) {
              lineDragContext = captureLineContext(selectedPointIndex);
              if (lineDragContext && lineDragContext.lineIdx !== mainLineIdx) {
                // If captured context is for different line, recapture for mainLineIdx
                const line = model.lines[mainLineIdx];
                if (line && line.points.length >= 2) {
                  const origin = model.points[line.points[0]];
                  const end = model.points[line.points[line.points.length - 1]];
                  if (origin && end) {
                    const dir = normalize({ x: end.x - origin.x, y: end.y - origin.y });
                    const len = Math.hypot(end.x - origin.x, end.y - origin.y);
                    if (len > 0) {
                      const fractions = line.points.map((idx) => {
                        const p = model.points[idx];
                        if (!p) return 0;
                        const t = ((p.x - origin.x) * dir.x + (p.y - origin.y) * dir.y) / len;
                        return t;
                      });
                      lineDragContext = { lineIdx: mainLineIdx, fractions };
                    }
                  }
                }
              }
            }
            const anchorIdx =
              selectedPointIndex === mainLine.points[0]
                ? mainLine.points[mainLine.points.length - 1]
                : mainLine.points[0];
            const anchor = model.points[anchorIdx];
            const rawTarget = { x: p.x + dx, y: p.y + dy };
            let target = rawTarget;
            // Constrain to parent line if it exists
            if (parentLineIdx !== null) {
              target = constrainToLineIdx(parentLineIdx, target);
            }
            target = constrainToCircles(selectedPointIndex, target);
            model.points[selectedPointIndex] = { ...p, ...target };
            movedPoints.add(selectedPointIndex);
            
            // If we moved a defining_point, reposition all non-defining points on the line
            if (isDefining) {
              const definingPoints = mainLine.defining_points.map(i => model.points[i]).filter(Boolean);
              if (definingPoints.length >= 2) {
                const [p1, p2] = definingPoints;
                const dir = normalize({ x: p2.x - p1.x, y: p2.y - p1.y });
                const lineLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                
                if (lineLength > 0) {
                  mainLine.points.forEach((pIdx) => {
                    // Skip defining_points
                    if (mainLine.defining_points.includes(pIdx)) return;
                    
                    const pt = model.points[pIdx];
                    if (!pt) return;
                    
                    // Project point onto the new line
                    const projection = ((pt.x - p1.x) * dir.x + (pt.y - p1.y) * dir.y);
                    const newPos = { x: p1.x + dir.x * projection, y: p1.y + dir.y * projection };
                    
                    model.points[pIdx] = { ...pt, ...newPos };
                    movedPoints.add(pIdx);
                  });
                }
              }
            }
            
            if (anchor) {
              const vx = rawTarget.x - anchor.x;
              const vy = rawTarget.y - anchor.y;
              const len = Math.hypot(vx, vy);
              if (len > 0) {
                const threshold = Math.max(1e-4, len * LINE_SNAP_SIN_ANGLE);
                let axis: 'x' | 'y' | null = null;
                if (Math.abs(vy) <= threshold) {
                  axis = 'y';
                } else if (Math.abs(vx) <= threshold) {
                  axis = 'x';
                }
                if (axis) {
                  const closeness =
                    axis === 'y'
                      ? 1 - Math.min(Math.abs(vy) / threshold, 1)
                      : 1 - Math.min(Math.abs(vx) / threshold, 1);
                  if (closeness >= LINE_SNAP_INDICATOR_THRESHOLD) {
                    activeAxisSnap = {
                      lineIdx: mainLineIdx,
                      axis: axis === 'y' ? 'horizontal' : 'vertical',
                      strength: Math.min(1, Math.max(0, (closeness - LINE_SNAP_INDICATOR_THRESHOLD) / (1 - LINE_SNAP_INDICATOR_THRESHOLD)))
                    };
                  }
                  const weight = axisSnapWeight(closeness);
                  if (weight > 0) {
                    const axisValue = axis === 'y' ? anchor.y : anchor.x;
                    const movableOnLine = mainLine.points.filter((idx) => {
                      const pt = model.points[idx];
                      if (!pt) return false;
                      if (!isPointDraggable(pt)) return false;
                      if (circlesWithCenter(idx).length > 0) return false;
                      return true;
                    });
                    movableOnLine.forEach((idx) => {
                      const pt = model.points[idx];
                      if (!pt) return;
                      if (axis === 'y') {
                        const blended = pt.y * (1 - weight) + axisValue * weight;
                        if (blended !== pt.y) {
                          model.points[idx] = { ...pt, y: blended };
                          movedPoints.add(idx);
                        }
                      } else {
                        const blended = pt.x * (1 - weight) + axisValue * weight;
                        if (blended !== pt.x) {
                          model.points[idx] = { ...pt, x: blended };
                          movedPoints.add(idx);
                        }
                      }
                    });
                  }
                }
              }
            }
            applyLineFractions(mainLineIdx);
            updateIntersectionsForLine(mainLineIdx);
            updateParallelLinesForLine(mainLineIdx);
            updatePerpendicularLinesForLine(mainLineIdx);
          } else if (mainLine.points.length >= 2) {
            // Use DEFINING points to establish the line, not first/last points in the array
            const definingIdx0 = mainLine.defining_points[0];
            const definingIdx1 = mainLine.defining_points[1];
            const origin = model.points[definingIdx0];
            const end = model.points[definingIdx1];
            if (origin && end) {
              const dir = normalize({ x: end.x - origin.x, y: end.y - origin.y });
              const len = Math.hypot(end.x - origin.x, end.y - origin.y) || 1;
              const target = { x: p.x + dx, y: p.y + dy };
              let t = ((target.x - origin.x) * dir.x + (target.y - origin.y) * dir.y) / len;
              const leftVisible = mainLine.leftRay && !mainLine.leftRay.hidden;
              const rightVisible = mainLine.rightRay && !mainLine.rightRay.hidden;
              if (!leftVisible) t = Math.max(0, t);
              if (!rightVisible) t = Math.min(1, t);
              const newPos = { x: origin.x + dir.x * t * len, y: origin.y + dir.y * t * len };
              const deltaMove = { x: newPos.x - p.x, y: newPos.y - p.y };
              if (deltaMove.x !== 0 || deltaMove.y !== 0) {
                const shiftTargets = new Set<number>();
                linesWithPoint.forEach((li) => {
                  if (li === mainLineIdx) return;
                  if (selectedPointIndex !== null && isDefiningPointOfLine(selectedPointIndex, li)) return;
                  model.lines[li]?.points.forEach((pi) => shiftTargets.add(pi));
                });
                shiftTargets.delete(selectedPointIndex);
                shiftTargets.forEach((pi) => {
                  const pp = model.points[pi];
                  model.points[pi] = { ...pp, x: pp.x + deltaMove.x, y: pp.y + deltaMove.y };
                  movedPoints.add(pi);
                });
              }

              let constrained = newPos;
              if (parentLineIdx !== null) {
                constrained = constrainToLineIdx(parentLineIdx ?? mainLineIdx, constrained);
              }
              constrained = constrainToCircles(selectedPointIndex, constrained);
              model.points[selectedPointIndex] = { ...p, ...constrained };
              movedPoints.add(selectedPointIndex);
              // DON'T call applyLineFractions - it would reset our position based on old fractions!
              // applyLineFractions(mainLineIdx);
              updateIntersectionsForLine(mainLineIdx);
              updateParallelLinesForLine(mainLineIdx);
              updatePerpendicularLinesForLine(mainLineIdx);
              // Set dragStart to the new constrained position (what was actually applied)
              dragStart = { x: constrained.x, y: constrained.y };
              dragStartAlreadySet = true; // Only for sliding mode - constrained to line
            }
          }
          movedDuringDrag = true;
          movedPoints.forEach((pi) => {
            updateMidpointsForPoint(pi);
            updateCirclesForPoint(pi);
          });
          draw();
          // Mark that we've already set dragStart (for sliding constrained points)
          if (linesWithPoint.length > 1) {
            const extraLines = new Set<number>();
            linesWithPoint.forEach((li) => {
              if (li !== mainLineIdx && li !== undefined && li !== null) extraLines.add(li);
            });
            extraLines.forEach((li) => {
              updateIntersectionsForLine(li);
              updateParallelLinesForLine(li);
              updatePerpendicularLinesForLine(li);
            });
          }
        } else {
          let target = { x: p.x + dx, y: p.y + dy };
          // Check if this point is a defining_point of any line
          const linesWithPoint = findLinesContainingPoint(selectedPointIndex);
          const definingLineIdx = linesWithPoint.find(li => 
            selectedPointIndex !== null && isDefiningPointOfLine(selectedPointIndex, li)
          );
          
          // Don't constrain defining_points to the line - they define it!
          if (definingLineIdx === undefined) {
            target = constrainToLineParent(selectedPointIndex, target);
          } else {
            // Point is a defining_point - move all other points on the line(s) with it
            linesWithPoint.forEach(li => {
              if (selectedPointIndex !== null && isDefiningPointOfLine(selectedPointIndex, li)) {
                const line = model.lines[li];
                if (line) {
                  line.points.forEach(pi => {
                    if (pi !== selectedPointIndex && !isDefiningPointOfLine(pi, li)) {
                      // Non-defining points need to be repositioned to stay on the line
                      // This will happen in applyLineFractions or reorderLinePoints
                    }
                  });
                }
              }
            });
          }
          target = constrainToCircles(selectedPointIndex, target);
          model.points[selectedPointIndex] = { ...p, ...target };
          movedPoints.add(selectedPointIndex);
          
          // Update line positions if this point is a defining_point
          linesWithPoint.forEach(li => {
            if (selectedPointIndex !== null && isDefiningPointOfLine(selectedPointIndex, li)) {
              updateIntersectionsForLine(li);
              updateParallelLinesForLine(li);
              updatePerpendicularLinesForLine(li);
            }
          });
          
          dragStart = { x, y };
          movedDuringDrag = true;
          movedPoints.forEach((pi) => {
            updateMidpointsForPoint(pi);
            updateCirclesForPoint(pi);
          });
          draw();
        }
      } else if (selectedPolygonIndex !== null && selectedSegments.size === 0) {
        const poly = model.polygons[selectedPolygonIndex];
        if (poly) {
          const pointsInPoly = new Set<number>();
          poly.lines.forEach((li) => {
            const line = model.lines[li];
            line?.points.forEach((pi) => pointsInPoly.add(pi));
          });
          pointsInPoly.forEach((idx) => {
            const pt = model.points[idx];
            if (!pt) return;
            if (!isPointDraggable(pt)) return;
            if (circlesWithCenter(idx).length > 0) return;
            const target = { x: pt.x + dx, y: pt.y + dy };
            const constrained = constrainToCircles(idx, target);
            model.points[idx] = { ...pt, ...constrained };
            movedPoints.add(idx);
          });
          poly.lines.forEach((li) => {
            updateIntersectionsForLine(li);
            updateParallelLinesForLine(li);
            updatePerpendicularLinesForLine(li);
          });

          if (polygonDragContext && polygonDragContext.polygonIdx === selectedPolygonIndex) {
            polygonDragContext.dependentLines.forEach((fractions, lIdx) => {
              applyFractionsToLine(lIdx, fractions);
              updateIntersectionsForLine(lIdx);
            });
          }
        }
      } else if (selectedLineIndex !== null) {
        const line = model.lines[selectedLineIndex];
        if (line) {
          const movableIndices = line.points.filter((idx) => {
            const pt = model.points[idx];
            if (!pt) return false;
            if (!isPointDraggable(pt)) return false;
            if (circlesWithCenter(idx).length > 0) return false;
            return true;
          });
          const proposals = new Map<number, { original: Point; pos: { x: number; y: number } }>();
          let snapIndicator: { axis: 'horizontal' | 'vertical'; strength: number } | null = null;
          line.points.forEach((idx) => {
            const pt = model.points[idx];
            if (!pt) return;
            if (!isPointDraggable(pt)) return;
            if (circlesWithCenter(idx).length > 0) return;
            const target = { x: pt.x + dx, y: pt.y + dy };
            
            const parentLine = primaryLineParent(pt);
            const parentIsDraggedLine = parentLine && selectedLineIndex !== null && parentLine.id === model.lines[selectedLineIndex].id;
            
            // If point is constrained to the dragged line, let it move with the drag (target).
            // Otherwise (e.g. constrained to another line, or free), apply constraints.
            const constrainedOnLine = parentIsDraggedLine ? target : constrainToLineParent(idx, target);
            
            const constrained = constrainToCircles(idx, constrainedOnLine);
            proposals.set(idx, { original: pt, pos: constrained });
          });
          if (movableIndices.length >= 2) {
            const startIdx = movableIndices[0];
            const endIdx = movableIndices[movableIndices.length - 1];
            const startProposal = proposals.get(startIdx)?.pos;
            const endProposal = proposals.get(endIdx)?.pos;
            if (startProposal && endProposal) {
              const vx = endProposal.x - startProposal.x;
              const vy = endProposal.y - startProposal.y;
              const len = Math.hypot(vx, vy);
              const threshold = Math.max(1e-4, len * LINE_SNAP_SIN_ANGLE);
              if (Math.abs(vy) <= threshold) {
                let sumY = 0;
                let count = 0;
                movableIndices.forEach((idx) => {
                  const proposal = proposals.get(idx)?.pos;
                  if (proposal) {
                    sumY += proposal.y;
                    count += 1;
                  }
                });
                if (count > 0) {
                  const axisY = sumY / count;
                  const closeness = 1 - Math.min(Math.abs(vy) / threshold, 1);
                  if (closeness >= LINE_SNAP_INDICATOR_THRESHOLD) {
                    const strength = Math.min(
                      1,
                      Math.max(0, (closeness - LINE_SNAP_INDICATOR_THRESHOLD) / (1 - LINE_SNAP_INDICATOR_THRESHOLD))
                    );
                    snapIndicator = { axis: 'horizontal', strength };
                  }
                  const weight = axisSnapWeight(closeness);
                  if (weight > 0) {
                    movableIndices.forEach((idx) => {
                      const entry = proposals.get(idx);
                      if (!entry) return;
                      entry.pos = {
                        ...entry.pos,
                        y: entry.pos.y * (1 - weight) + axisY * weight,
                      };
                    });
                  }
                }
              } else if (Math.abs(vx) <= threshold) {
                let sumX = 0;
                let count = 0;
                movableIndices.forEach((idx) => {
                  const proposal = proposals.get(idx)?.pos;
                  if (proposal) {
                    sumX += proposal.x;
                    count += 1;
                  }
                });
                if (count > 0) {
                  const axisX = sumX / count;
                  const closeness = 1 - Math.min(Math.abs(vx) / threshold, 1);
                  if (closeness >= LINE_SNAP_INDICATOR_THRESHOLD) {
                    const strength = Math.min(
                      1,
                      Math.max(0, (closeness - LINE_SNAP_INDICATOR_THRESHOLD) / (1 - LINE_SNAP_INDICATOR_THRESHOLD))
                    );
                    snapIndicator = { axis: 'vertical', strength };
                  }
                  const weight = axisSnapWeight(closeness);
                  if (weight > 0) {
                    movableIndices.forEach((idx) => {
                      const entry = proposals.get(idx);
                      if (!entry) return;
                      entry.pos = {
                        ...entry.pos,
                        x: entry.pos.x * (1 - weight) + axisX * weight,
                      };
                    });
                  }
                }
              }
            }
          }
          if (selectedLineIndex !== null && snapIndicator) {
            activeAxisSnap = { lineIdx: selectedLineIndex, ...snapIndicator };
          }

          // Capture context for connected lines (lines sharing defining points with the dragged line)
          const connectedLinesContext = new Map<number, number[]>();
          const movingPointsSet = new Set(movableIndices);
          
          model.lines.forEach((l, lIdx) => {
            if (lIdx === selectedLineIndex) return;
            // Check if this line is affected (has defining points that are moving)
            const affected = l.defining_points.some(dp => movingPointsSet.has(dp));
            if (affected) {
               // Capture fractions
               const def0 = l.defining_points[0];
               const def1 = l.defining_points[1];
               const origin = model.points[def0];
               const end = model.points[def1];
               if (origin && end) {
                 const dir = normalize({ x: end.x - origin.x, y: end.y - origin.y });
                 const len = Math.hypot(end.x - origin.x, end.y - origin.y);
                 if (len > 0) {
                   const fractions = l.points.map((idx) => {
                     const p = model.points[idx];
                     if (!p) return 0;
                     return ((p.x - origin.x) * dir.x + (p.y - origin.y) * dir.y) / len;
                   });
                   connectedLinesContext.set(lIdx, fractions);
                 }
               }
            }
          });

          proposals.forEach((entry, idx) => {
            model.points[idx] = { ...entry.original, ...entry.pos };
            movedPoints.add(idx);
          });

          // Apply context to connected lines
          connectedLinesContext.forEach((fractions, lIdx) => {
             const l = model.lines[lIdx];
             const def0 = l.defining_points[0];
             const def1 = l.defining_points[1];
             const origin = model.points[def0];
             const end = model.points[def1];
             if (origin && end) {
               const dir = normalize({ x: end.x - origin.x, y: end.y - origin.y });
               const len = Math.hypot(end.x - origin.x, end.y - origin.y);
               if (len > 0) {
                 l.points.forEach((pIdx, i) => {
                   if (l.defining_points.includes(pIdx)) return; 
                   
                   const t = fractions[i];
                   const newPos = {
                     x: origin.x + dir.x * t * len,
                     y: origin.y + dir.y * t * len
                   };
                   const pt = model.points[pIdx];
                   if (pt) {
                     model.points[pIdx] = { ...pt, ...newPos };
                     movedPoints.add(pIdx);
                   }
                 });
                 updateIntersectionsForLine(lIdx);
                 updateParallelLinesForLine(lIdx);
                 updatePerpendicularLinesForLine(lIdx);
               }
             }
          });

          updateIntersectionsForLine(selectedLineIndex);
          updateParallelLinesForLine(selectedLineIndex);
          updatePerpendicularLinesForLine(selectedLineIndex);
        }
      }
      if (typeof dragStartAlreadySet === 'undefined' || !dragStartAlreadySet) {
        dragStart = { x, y };
      }
      movedDuringDrag = true;
      movedPoints.forEach((pi) => {
        updateMidpointsForPoint(pi);
        updateCirclesForPoint(pi);
      });
      // Reposition non-defining points on lines whose defining points moved
      if (selectedPointIndex !== null) {
        const linesWithPoint = findLinesContainingPoint(selectedPointIndex);
        linesWithPoint.forEach(li => {
          const isDefining = selectedPointIndex !== null && isDefiningPointOfLine(selectedPointIndex, li);
          if (isDefining) {
            const line = model.lines[li];
            if (line && line.points.length >= 2) {
              // Reposition non-defining points to stay on the line
              line.points.forEach(pi => {
                if (pi !== selectedPointIndex && !isDefiningPointOfLine(pi, li)) {
                  const pt = model.points[pi];
                  if (pt && isPointDraggable(pt)) {
                    const constrained = constrainToLineIdx(li, { x: pt.x, y: pt.y });
                    if (Math.abs(constrained.x - pt.x) > 1e-6 || Math.abs(constrained.y - pt.y) > 1e-6) {
                      model.points[pi] = { ...pt, ...constrained };
                      updateMidpointsForPoint(pi);
                      updateCirclesForPoint(pi);
                    }
                  }
                }
              });
            }
          }
        });
      }
      draw();
    } else if (isPanning && mode === 'move' && pendingPanCandidate) {
      const dx = ev.clientX - panStart.x;
      const dy = ev.clientY - panStart.y;
      panOffset = { x: panStartOffset.x + dx, y: panStartOffset.y + dy };
      movedDuringPan = true;
      draw();
    }
  });
  const handlePointerRelease = (ev: PointerEvent) => {
    if (ev.pointerType === 'touch') {
      removeTouchPoint(ev.pointerId);
      if (activeTouches.size >= 2 && !pinchState) {
        startPinchFromTouches();
      }
      try {
        canvas!.releasePointerCapture(ev.pointerId);
      } catch (_) {
        /* ignore release errors */
      }
    }
    
    // Finish multiselect box
    if (mode === 'multiselect' && multiselectBoxStart && multiselectBoxEnd) {
      const x1 = Math.min(multiselectBoxStart.x, multiselectBoxEnd.x);
      const y1 = Math.min(multiselectBoxStart.y, multiselectBoxEnd.y);
      const x2 = Math.max(multiselectBoxStart.x, multiselectBoxEnd.x);
      const y2 = Math.max(multiselectBoxStart.y, multiselectBoxEnd.y);
      
      if (Math.abs(x2 - x1) > 5 || Math.abs(y2 - y1) > 5) {
        selectObjectsInBox({ x1, y1, x2, y2 });
        updateSelectionButtons();
      }
      
      multiselectBoxStart = null;
      multiselectBoxEnd = null;
      draw();
    }
    
    endInkStroke(ev.pointerId);
    resizingLine = null;
    draggingSelection = false;
    draggingMultiSelection = false;
    lineDragContext = null;
    draggingLabel = null;
    draggingCircleCenterAngles = null;
    circleDragContext = null;
    polygonDragContext = null;
    isPanning = false;
    pendingPanCandidate = null;
    const snapInfo = activeAxisSnap;
    activeAxisSnap = null;
    if (snapInfo) {
      enforceAxisAlignment(snapInfo.lineIdx, snapInfo.axis);
      movedDuringDrag = true;
      draw();
    }
    if (movedDuringDrag || movedDuringPan) {
      pushHistory();
      movedDuringDrag = false;
      movedDuringPan = false;
    }
  };
  canvas.addEventListener('pointerup', handlePointerRelease);
  canvas.addEventListener('pointercancel', handlePointerRelease);
  canvas.addEventListener('wheel', handleCanvasWheel, { passive: false });

  modeAddBtn?.addEventListener('click', () => handleToolClick('add'));
  modeAddBtn?.addEventListener('dblclick', (e) => { e.preventDefault(); handleToolSticky('add'); });
  setupDoubleTapSticky(modeAddBtn, 'add');
  
  modeSegmentBtn?.addEventListener('click', () => handleToolClick('segment'));
  modeSegmentBtn?.addEventListener('dblclick', (e) => { e.preventDefault(); handleToolSticky('segment'); });
  setupDoubleTapSticky(modeSegmentBtn, 'segment');
  
  modeParallelBtn?.addEventListener('click', () => handleToolClick('parallel'));
  modePerpBtn?.addEventListener('click', () => handleToolClick('perpendicular'));
  modeCircleThreeBtn?.addEventListener('click', () => handleToolClick('circleThree'));
  modeTriangleBtn?.addEventListener('click', () => handleToolClick('triangleUp'));
  modeSquareBtn?.addEventListener('click', () => handleToolClick('square'));
  modePolygonBtn?.addEventListener('click', () => handleToolClick('polygon'));
  modeHandwritingBtn?.addEventListener('click', () => handleToolClick('handwriting'));
  
  modeLabelBtn?.addEventListener('click', () => handleToolClick('label'));
  modeLabelBtn?.addEventListener('dblclick', (e) => { e.preventDefault(); handleToolSticky('label'); });
  setupDoubleTapSticky(modeLabelBtn, 'label');
  
  modeAngleBtn?.addEventListener('click', () => handleToolClick('angle'));
  modeBisectorBtn?.addEventListener('click', () => handleToolClick('bisector'));
  modeMidpointBtn?.addEventListener('click', () => handleToolClick('midpoint'));
  
  modeSymmetricBtn?.addEventListener('click', () => handleToolClick('symmetric'));
  modeSymmetricBtn?.addEventListener('dblclick', (e) => {
    e.preventDefault();
    stickyTool = stickyTool === 'symmetric' ? null : stickyTool;
    handleToolClick('symmetric');
  });
  
  modeParallelLineBtn?.addEventListener('click', () => handleToolClick('parallelLine'));
  modeParallelLineBtn?.addEventListener('dblclick', (e) => {
    e.preventDefault();
    handleToolSticky('parallelLine');
  });
  modeNgonBtn?.addEventListener('click', () => {
    handleToolClick('ngon');
  });
  const modeCircleBtn = document.getElementById('modeCircle') as HTMLButtonElement | null;
  modeCircleBtn?.addEventListener('click', () => handleToolClick('circle'));
  modeCircleBtn?.addEventListener('dblclick', (e) => { e.preventDefault(); handleToolSticky('circle'); });
  setupDoubleTapSticky(modeCircleBtn, 'circle');
  modeMoveBtn?.addEventListener('click', () => {
    stickyTool = null;
    if (mode !== 'move') {
      setMode('move');
      updateToolButtons();
      updateSelectionButtons();
    }
  });
  modeMultiselectBtn?.addEventListener('click', () => handleToolClick('multiselect'));
  lineWidthDecreaseBtn?.addEventListener('click', () => adjustLineWidth(-1));
  lineWidthIncreaseBtn?.addEventListener('click', () => adjustLineWidth(1));
  colorSwatchButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = btn.dataset.color;
      if (!c || !styleColorInput) return;
      styleColorInput.value = c;
      rememberColor(c);
      applyStyleFromInputs();
      updateStyleMenuValues();
    });
  });
  customColorBtn?.addEventListener('click', () => {
    styleColorInput?.click();
  });
  arcCountButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      arcCountButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const count = Number(btn.dataset.count) || 1;
      rightAngleBtn?.classList.remove('active');
      if (selectedAngleIndex !== null) {
        const ang = model.angles[selectedAngleIndex];
        model.angles[selectedAngleIndex] = { ...ang, style: { ...ang.style, arcCount: count, right: false } };
        draw();
        pushHistory();
      }
    });
  });
  rightAngleBtn?.addEventListener('click', () => {
    if (!rightAngleBtn) return;
    const active = rightAngleBtn.classList.toggle('active');
    if (active) arcCountButtons.forEach((b) => b.classList.remove('active'));
    if (selectedAngleIndex !== null) {
      const ang = model.angles[selectedAngleIndex];
      const arcCount = active ? 1 : ang.style.arcCount ?? 1;
      model.angles[selectedAngleIndex] = { ...ang, style: { ...ang.style, right: active, arcCount } };
      draw();
      pushHistory();
    }
  });
  exteriorAngleBtn?.addEventListener('click', () => {
    if (!exteriorAngleBtn) return;
    const active = exteriorAngleBtn.classList.toggle('active');
    exteriorAngleBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    if (selectedAngleIndex !== null) {
      const ang = model.angles[selectedAngleIndex];
      model.angles[selectedAngleIndex] = { ...ang, style: { ...ang.style, exterior: active } };
      draw();
      pushHistory();
    }
  });
  angleRadiusDecreaseBtn?.addEventListener('click', () => adjustSelectedAngleRadius(-1));
  angleRadiusIncreaseBtn?.addEventListener('click', () => adjustSelectedAngleRadius(1));
  styleTypeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.type as StrokeStyle['type'] | undefined;
      if (styleTypeSelect && t) styleTypeSelect.value = t;
      applyStyleFromInputs();
      updateStyleMenuValues();
    });
  });
  viewModeToggleBtn?.addEventListener('click', toggleViewMenu);
  document.getElementById('viewEdgesOption')?.addEventListener('click', () => setViewMode('edges'));
  document.getElementById('viewVerticesOption')?.addEventListener('click', () => setViewMode('vertices'));
  document.getElementById('viewCircleLineOption')?.addEventListener('click', () => setViewMode('edges'));
  document.getElementById('viewCirclePointsOption')?.addEventListener('click', () => setViewMode('vertices'));
  rayModeToggleBtn?.addEventListener('click', toggleRayMenu);
  document.getElementById('rayRightOption')?.addEventListener('click', () => setRayMode('right'));
  document.getElementById('rayLeftOption')?.addEventListener('click', () => setRayMode('left'));
  document.getElementById('raySegmentOption')?.addEventListener('click', () => setRayMode('segment'));
  themeDarkBtn?.addEventListener('click', () => {
    const nextTheme: ThemeName = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  });

  // Settings modal handlers
  settingsBtn?.addEventListener('click', () => {
    if (settingsModal) {
      settingsModal.style.display = 'flex';
      initializeButtonConfig();
      
      // Update precision inputs
      const precisionLengthInput = document.getElementById('precisionLength') as HTMLInputElement | null;
      const precisionAngleInput = document.getElementById('precisionAngle') as HTMLInputElement | null;
      if (precisionLengthInput) precisionLengthInput.value = measurementPrecisionLength.toString();
      if (precisionAngleInput) precisionAngleInput.value = measurementPrecisionAngle.toString();
    }
  });

  settingsCloseBtn?.addEventListener('click', () => {
    if (settingsModal) {
      applyButtonConfiguration();
      settingsModal.style.display = 'none';
    }
  });
  
  // Export/Import configuration handlers
  const exportConfigBtn = document.getElementById('exportConfigBtn') as HTMLButtonElement | null;
  const importConfigBtn = document.getElementById('importConfigBtn') as HTMLButtonElement | null;
  const importConfigInput = document.getElementById('importConfigInput') as HTMLInputElement | null;
  
  exportConfigBtn?.addEventListener('click', () => {
    exportButtonConfiguration();
  });
  
  importConfigBtn?.addEventListener('click', () => {
    importConfigInput?.click();
  });
  
  importConfigInput?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importButtonConfiguration(content);
        if (success) {
          alert('Konfiguracja została zaimportowana pomyślnie!');
        } else {
          alert('Błąd podczas importowania konfiguracji. Sprawdź czy plik jest poprawny.');
        }
      }
    };
    reader.readAsText(file);
    
    // Reset input so the same file can be imported again
    (e.target as HTMLInputElement).value = '';
  });
  
  // Tab switching in settings modal
  const tabButtons = document.querySelectorAll('.modal-tabs .tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = (btn as HTMLElement).dataset.tab;
      if (!tabName) return;
      
      // Update tab buttons
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update tab content
      const tabContents = document.querySelectorAll('.tab-content');
      tabContents.forEach(content => {
        content.classList.remove('active');
      });
      
      const targetTab = document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
      if (targetTab) {
        targetTab.classList.add('active');
      }
    });
  });
  
  // Precision settings
  const precisionLengthInput = document.getElementById('precisionLength') as HTMLInputElement | null;
  const precisionAngleInput = document.getElementById('precisionAngle') as HTMLInputElement | null;
  
  if (precisionLengthInput) {
    precisionLengthInput.value = measurementPrecisionLength.toString();
    precisionLengthInput.addEventListener('change', () => {
      const value = parseInt(precisionLengthInput.value, 10);
      if (!isNaN(value) && value >= 0 && value <= 5) {
        measurementPrecisionLength = value;
        localStorage.setItem('measurementPrecisionLength', value.toString());
        if (showMeasurements) {
          draw(); // Refresh measurements with new precision
        }
      }
    });
  }
  
  if (precisionAngleInput) {
    precisionAngleInput.value = measurementPrecisionAngle.toString();
    precisionAngleInput.addEventListener('change', () => {
      const value = parseInt(precisionAngleInput.value, 10);
      if (!isNaN(value) && value >= 0 && value <= 5) {
        measurementPrecisionAngle = value;
        localStorage.setItem('measurementPrecisionAngle', value.toString());
        if (showMeasurements) {
          draw(); // Refresh measurements with new precision
        }
      }
    });
  }

  // Close modal when clicking outside
  settingsModal?.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      applyButtonConfiguration();
      settingsModal.style.display = 'none';
    }
  });

  // Prevent pull-to-refresh on modal
  settingsModal?.addEventListener('touchstart', (e) => {
    const modalContent = settingsModal.querySelector('.modal-content');
    if (modalContent && e.target instanceof Node && modalContent.contains(e.target)) {
      // Allow scrolling inside modal content
      e.stopPropagation();
    }
  }, { passive: true });

  settingsModal?.addEventListener('touchmove', (e) => {
    const modalContent = settingsModal.querySelector('.modal-content');
    const modalBody = settingsModal.querySelector('.modal-body');
    
    if (modalBody && e.target instanceof Node && modalBody.contains(e.target)) {
      // Check if we're at the top of scrollable content
      const atTop = modalBody.scrollTop === 0;
      const scrollingUp = e.touches[0].clientY > (e.target as any).lastTouchY;
      
      // Prevent pull-to-refresh only when at top and scrolling up
      if (atTop && scrollingUp) {
        e.preventDefault();
      }
    } else if (modalContent && e.target instanceof Node && modalContent.contains(e.target)) {
      // Inside modal but not in scrollable area - prevent pull-to-refresh
      e.preventDefault();
    }
  }, { passive: false });

  // Default folder selection
  selectDefaultFolderBtn?.addEventListener('click', async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        window.alert('Ta funkcja nie jest dostępna w Twojej przeglądarce.');
        return;
      }
      
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
      
      defaultFolderHandle = dirHandle;
      
      // Save to IndexedDB
      await saveDefaultFolderHandle(dirHandle);
      
      updateDefaultFolderDisplay();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Failed to select folder:', err);
      }
    }
  });
  
  clearDefaultFolderBtn?.addEventListener('click', async () => {
    defaultFolderHandle = null;
    await saveDefaultFolderHandle(null);
    updateDefaultFolderDisplay();
  });
  
  // Load default folder handle on startup
  (async () => {
    const handle = await loadDefaultFolderHandle();
    if (handle) {
      // Verify we still have permission
      try {
        // @ts-ignore - queryPermission is not in all TS definitions
        const permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission === 'granted' || permission === 'prompt') {
          defaultFolderHandle = handle;
        }
      } catch (err) {
        console.warn('Failed to verify folder permissions:', err);
      }
    }
    updateDefaultFolderDisplay();
  })();
  
  // Initialize folder display
  updateDefaultFolderDisplay();

  hideBtn?.addEventListener('click', () => {
    // Handle multiselection hide
    if (hasMultiSelection()) {
      multiSelectedPoints.forEach(idx => {
        const p = model.points[idx];
        if (p) {
          model.points[idx] = { ...p, style: { ...p.style, hidden: !p.style.hidden } };
        }
      });
      
      multiSelectedLines.forEach(idx => {
        if (model.lines[idx]) {
          model.lines[idx].hidden = !model.lines[idx].hidden;
        }
      });
      
      multiSelectedCircles.forEach(idx => {
        if (model.circles[idx]) {
          model.circles[idx].hidden = !model.circles[idx].hidden;
        }
      });
      
      multiSelectedAngles.forEach(idx => {
        const angle = model.angles[idx];
        if (angle) {
          model.angles[idx] = { ...angle, hidden: !angle.hidden };
        }
      });
      
      multiSelectedPolygons.forEach(idx => {
        const poly = model.polygons[idx];
        poly?.lines.forEach(li => {
          if (model.lines[li]) model.lines[li].hidden = !model.lines[li].hidden;
        });
      });
      
      multiSelectedInkStrokes.forEach(idx => {
        const stroke = model.inkStrokes[idx];
        if (stroke) {
          model.inkStrokes[idx] = { ...stroke, hidden: !stroke.hidden };
        }
      });
      
      draw();
      updateSelectionButtons();
      pushHistory();
      return;
    }
    
    if (selectedInkStrokeIndex !== null) {
      const stroke = model.inkStrokes[selectedInkStrokeIndex];
      if (stroke) {
        model.inkStrokes[selectedInkStrokeIndex] = { ...stroke, hidden: !stroke.hidden };
      }
    } else if (selectedLabel) {
      return;
    } else if (selectedPolygonIndex !== null) {
      const poly = model.polygons[selectedPolygonIndex];
      poly?.lines.forEach((li) => {
        if (model.lines[li]) model.lines[li].hidden = !model.lines[li].hidden;
      });
    } else if (selectedLineIndex !== null) {
      model.lines[selectedLineIndex].hidden = !model.lines[selectedLineIndex].hidden;
    } else if (selectedCircleIndex !== null) {
      if (selectionEdges) {
        model.circles[selectedCircleIndex].hidden = !model.circles[selectedCircleIndex].hidden;
      }
      if (selectionVertices) {
        const circle = model.circles[selectedCircleIndex];
        const pointsToToggle = new Set<number>();
        if (circle.center !== null) pointsToToggle.add(circle.center);
        if (circle.radius_point !== null) pointsToToggle.add(circle.radius_point);
        // Also toggle defining parents if they are points
        circle.defining_parents.forEach(pid => {
          const idx = model.points.findIndex(p => p.id === pid);
          if (idx !== -1) pointsToToggle.add(idx);
        });
        
        pointsToToggle.forEach(idx => {
          const p = model.points[idx];
          if (p) model.points[idx] = { ...p, style: { ...p.style, hidden: !p.style.hidden } };
        });
      }
    } else if (selectedAngleIndex !== null) {
      const angle = model.angles[selectedAngleIndex];
      if (angle) {
        model.angles[selectedAngleIndex] = { ...angle, hidden: !angle.hidden };
      }
    } else if (selectedPointIndex !== null) {
      const p = model.points[selectedPointIndex];
      model.points[selectedPointIndex] = { ...p, style: { ...p.style, hidden: !p.style.hidden } };
    }
    draw();
    updateSelectionButtons();
    pushHistory();
  });
  copyStyleBtn?.addEventListener('click', () => {
    // Przełącz na tryb edycji, nawet jeśli jest sticky tool
    stickyTool = null;
    setMode('move');
    
    // Zamknij menu stylu jeśli jest otwarte
    if (styleMenuOpen) {
      closeStyleMenu();
    }
    
    if (!copyStyleActive) {
      // Aktywuj tryb kopiowania stylu
      const style = copyStyleFromSelection();
      if (style) {
        copiedStyle = style;
        copyStyleActive = true;
        updateSelectionButtons();
      }
    } else {
      // Dezaktywuj tryb kopiowania stylu
      copyStyleActive = false;
      copiedStyle = null;
      updateSelectionButtons();
    }
  });
  
  multiMoveBtn?.addEventListener('click', () => {
    if (!multiMoveActive) {
      multiMoveActive = true;
      multiMoveBtn?.classList.add('active');
      multiMoveBtn?.setAttribute('aria-pressed', 'true');
    } else {
      multiMoveActive = false;
      multiMoveBtn?.classList.remove('active');
      multiMoveBtn?.setAttribute('aria-pressed', 'false');
    }
  });
  
  multiCloneBtn?.addEventListener('click', () => {
    if (!hasMultiSelection()) return;
    
    // First pass: collect all objects that need to be cloned
    const linesToClone = new Set<number>(multiSelectedLines);
    const pointsToClone = new Set<number>(multiSelectedPoints);
    
    // If cloning polygons, also clone their lines
    multiSelectedPolygons.forEach(idx => {
      const poly = model.polygons[idx];
      if (poly) {
        poly.lines.forEach(li => linesToClone.add(li));
      }
    });
    
    // Collect all points used by selected lines, circles and polygons
    linesToClone.forEach(idx => {
      const line = model.lines[idx];
      if (line) {
        line.points.forEach(pi => pointsToClone.add(pi));
      }
    });
    
    multiSelectedCircles.forEach(idx => {
      const circle = model.circles[idx];
      if (circle) {
        pointsToClone.add(circle.center);
        if (circle.radius_point !== undefined) pointsToClone.add(circle.radius_point);
        circle.points.forEach(pi => pointsToClone.add(pi));
      }
    });
    
    multiSelectedAngles.forEach(idx => {
      const ang = model.angles[idx];
      if (ang) {
        pointsToClone.add(ang.vertex);
      }
    });
    
    // Clone points
    const pointRemap = new Map<number, number>();
    pointsToClone.forEach(idx => {
      const p = model.points[idx];
      if (p) {
        // Clone midpoint/symmetric metadata (will be updated later after lines are cloned)
        let midpoint = p.midpoint ? { ...p.midpoint } : undefined;
        let symmetric = p.symmetric ? { ...p.symmetric } : undefined;
        
        const newPoint = { ...p, id: nextId('point', model), midpoint, symmetric };
        model.points.push(newPoint);
        const newIdx = model.points.length - 1;
        pointRemap.set(idx, newIdx);
        registerIndex(model, 'point', newPoint.id, newIdx);
      }
    });
    
    // Clone lines
    const lineRemap = new Map<number, number>();
    linesToClone.forEach(idx => {
      const line = model.lines[idx];
      if (line) {
        const newPoints = line.points.map(pi => pointRemap.get(pi) ?? pi);
        const newDefiningPoints: [number, number] = [
          pointRemap.get(line.defining_points[0]) ?? line.defining_points[0],
          pointRemap.get(line.defining_points[1]) ?? line.defining_points[1]
        ];
        
        // Clone parallel/perpendicular metadata with updated point/line references
        let parallel = line.parallel ? { ...line.parallel } : undefined;
        let perpendicular = line.perpendicular ? { ...line.perpendicular } : undefined;
        
        if (parallel) {
          const throughPointIdx = pointIndexById(parallel.throughPoint);
          const helperPointIdx = pointIndexById(parallel.helperPoint);
          const refLineIdx = lineIndexById(parallel.referenceLine);
          
          if (throughPointIdx !== null && pointRemap.has(throughPointIdx)) {
            parallel.throughPoint = model.points[pointRemap.get(throughPointIdx)!].id;
          }
          if (helperPointIdx !== null && pointRemap.has(helperPointIdx)) {
            parallel.helperPoint = model.points[pointRemap.get(helperPointIdx)!].id;
          }
          if (refLineIdx !== null && lineRemap.has(refLineIdx)) {
            parallel.referenceLine = model.lines[lineRemap.get(refLineIdx)!].id;
          }
        }
        
        if (perpendicular) {
          const throughPointIdx = pointIndexById(perpendicular.throughPoint);
          const helperPointIdx = pointIndexById(perpendicular.helperPoint);
          const refLineIdx = lineIndexById(perpendicular.referenceLine);
          
          if (throughPointIdx !== null && pointRemap.has(throughPointIdx)) {
            perpendicular.throughPoint = model.points[pointRemap.get(throughPointIdx)!].id;
          }
          if (helperPointIdx !== null && pointRemap.has(helperPointIdx)) {
            perpendicular.helperPoint = model.points[pointRemap.get(helperPointIdx)!].id;
          }
          if (refLineIdx !== null && lineRemap.has(refLineIdx)) {
            perpendicular.referenceLine = model.lines[lineRemap.get(refLineIdx)!].id;
          }
        }
        
        const newLine = { 
          ...line, 
          id: nextId('line', model),
          points: newPoints,
          defining_points: newDefiningPoints,
          parallel,
          perpendicular,
          segmentStyles: line.segmentStyles?.map(s => ({ ...s })),
          segmentKeys: line.segmentKeys ? [...line.segmentKeys] : undefined
        };
        model.lines.push(newLine);
        const newIdx = model.lines.length - 1;
        lineRemap.set(idx, newIdx);
        registerIndex(model, 'line', newLine.id, newIdx);
      }
    });
    
    // Update cloned points to reference cloned lines/circles
    pointRemap.forEach((newIdx, oldIdx) => {
      const newPoint = model.points[newIdx];
      const oldPoint = model.points[oldIdx];
      if (!newPoint || !oldPoint) return;
      
      // Update parent_refs to point to cloned objects
      const updatedParentRefs = oldPoint.parent_refs?.map(ref => {
        if (ref.kind === 'line') {
          const oldLineIdx = lineIndexById(ref.id);
          if (oldLineIdx !== null && lineRemap.has(oldLineIdx)) {
            const newLineIdx = lineRemap.get(oldLineIdx)!;
            const newLine = model.lines[newLineIdx];
            return { kind: 'line' as const, id: newLine.id };
          }
        }
        // Keep original reference if not cloned
        return ref;
      }) || [];
      
      // Update midpoint metadata
      let midpoint = newPoint.midpoint;
      if (midpoint) {
        const [parentA, parentB] = midpoint.parents;
        const parentAIdx = pointIndexById(parentA);
        const parentBIdx = pointIndexById(parentB);
        
        const newParentA = parentAIdx !== null && pointRemap.has(parentAIdx) 
          ? model.points[pointRemap.get(parentAIdx)!].id 
          : parentA;
        const newParentB = parentBIdx !== null && pointRemap.has(parentBIdx) 
          ? model.points[pointRemap.get(parentBIdx)!].id 
          : parentB;
        
        let parentLineId = midpoint.parentLineId;
        if (parentLineId) {
          const lineIdx = lineIndexById(parentLineId);
          if (lineIdx !== null && lineRemap.has(lineIdx)) {
            parentLineId = model.lines[lineRemap.get(lineIdx)!].id;
          }
        }
        
        midpoint = {
          parents: [newParentA, newParentB],
          parentLineId
        };
      }
      
      // Update symmetric metadata
      let symmetric = newPoint.symmetric;
      if (symmetric) {
        const sourceIdx = pointIndexById(symmetric.source);
        const newSource = sourceIdx !== null && pointRemap.has(sourceIdx)
          ? model.points[pointRemap.get(sourceIdx)!].id
          : symmetric.source;
        
        let mirror = symmetric.mirror;
        if (mirror.kind === 'point') {
          const mirrorIdx = pointIndexById(mirror.id);
          if (mirrorIdx !== null && pointRemap.has(mirrorIdx)) {
            mirror = { kind: 'point', id: model.points[pointRemap.get(mirrorIdx)!].id };
          }
        } else if (mirror.kind === 'line') {
          const mirrorIdx = lineIndexById(mirror.id);
          if (mirrorIdx !== null && lineRemap.has(mirrorIdx)) {
            mirror = { kind: 'line', id: model.lines[lineRemap.get(mirrorIdx)!].id };
          }
        }
        
        symmetric = { source: newSource, mirror };
      }
      
      model.points[newIdx] = {
        ...newPoint,
        parent_refs: updatedParentRefs,
        defining_parents: updatedParentRefs.map(p => p.id),
        midpoint,
        symmetric
      };
    });
    
    // Clone circles
    const circleRemap = new Map<number, number>();
    multiSelectedCircles.forEach(idx => {
      const circle = model.circles[idx];
      if (circle) {
        const newCenter = pointRemap.get(circle.center) ?? circle.center;
        const newPoints = circle.points.map(pi => pointRemap.get(pi) ?? pi);
        const newCircle = {
          ...circle,
          id: nextId('circle', model),
          center: newCenter,
          points: newPoints,
          arcStyles: circle.arcStyles?.map(s => ({ ...s }))
        };
        if (circle.circle_kind === 'center-radius') {
          newCircle.radius_point = circle.radius_point !== undefined ? (pointRemap.get(circle.radius_point) ?? circle.radius_point) : circle.radius_point;
        }
        model.circles.push(newCircle);
        const newIdx = model.circles.length - 1;
        circleRemap.set(idx, newIdx);
        registerIndex(model, 'circle', newCircle.id, newIdx);
      }
    });
    
    // Clone angles
    const angleRemap = new Map<number, number>();
    multiSelectedAngles.forEach(idx => {
      const ang = model.angles[idx];
      if (ang) {
        const newAngle = {
          ...ang,
          id: nextId('angle', model),
          leg1: { ...ang.leg1, line: lineRemap.get(ang.leg1.line) ?? ang.leg1.line },
          leg2: { ...ang.leg2, line: lineRemap.get(ang.leg2.line) ?? ang.leg2.line },
          vertex: pointRemap.get(ang.vertex) ?? ang.vertex
        };
        model.angles.push(newAngle);
        const newIdx = model.angles.length - 1;
        angleRemap.set(idx, newIdx);
        registerIndex(model, 'angle', newAngle.id, newIdx);
      }
    });
    
    // Clone polygons
    const polygonRemap = new Map<number, number>();
    multiSelectedPolygons.forEach(idx => {
      const poly = model.polygons[idx];
      if (poly) {
        const newLines = poly.lines.map(li => lineRemap.get(li) ?? li);
        const newPoly = {
          ...poly,
          id: nextId('polygon', model),
          lines: newLines
        };
        model.polygons.push(newPoly);
        const newIdx = model.polygons.length - 1;
        polygonRemap.set(idx, newIdx);
        registerIndex(model, 'polygon', newPoly.id, newIdx);
      }
    });
    
    // Clone ink strokes
    multiSelectedInkStrokes.forEach(idx => {
      const stroke = model.inkStrokes[idx];
      if (stroke) {
        const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `ink-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const newStroke = {
          ...stroke,
          id,
          points: stroke.points.map(pt => ({ ...pt }))
        };
        model.inkStrokes.push(newStroke);
      }
    });
    
    // Clear old selection and select cloned objects
    const newPointSelection = new Set<number>();
    pointRemap.forEach((newIdx, _) => newPointSelection.add(newIdx));
    
    const newLineSelection = new Set<number>();
    lineRemap.forEach((newIdx, _) => newLineSelection.add(newIdx));
    
    // Offset cloned points slightly so they don't overlap with originals.
    // Apply the same translation to ALL cloned points (not only free points)
    // to preserve distances between them — cloning must be a pure shift.
    const CLONE_OFFSET = 20;
    newPointSelection.forEach(idx => {
      const pt = model.points[idx];
      if (pt) {
        model.points[idx] = { ...pt, x: pt.x + CLONE_OFFSET, y: pt.y + CLONE_OFFSET };
      }
    });
    
    // Recompute dependent points (intersections, midpoints, etc.) after moving free points
    newLineSelection.forEach(lineIdx => {
      updateIntersectionsForLine(lineIdx);
    });
    newPointSelection.forEach(idx => {
      updateMidpointsForPoint(idx);
    });
    
    // Clear old selection
    multiSelectedPoints.clear();
    multiSelectedLines.clear();
    multiSelectedCircles.clear();
    multiSelectedAngles.clear();
    multiSelectedPolygons.clear();
    multiSelectedInkStrokes.clear();
    
    // Clear single selection as well
    selectedPointIndex = null;
    selectedLineIndex = null;
    selectedCircleIndex = null;
    selectedAngleIndex = null;
    selectedPolygonIndex = null;
    selectedInkStrokeIndex = null;
    selectedSegments.clear();
    selectedArcSegments.clear();
    
    // Select cloned objects
    newPointSelection.forEach(idx => multiSelectedPoints.add(idx));
    newLineSelection.forEach(idx => multiSelectedLines.add(idx));
    circleRemap.forEach((newIdx, _) => multiSelectedCircles.add(newIdx));
    angleRemap.forEach((newIdx, _) => multiSelectedAngles.add(newIdx));
    polygonRemap.forEach((newIdx, _) => multiSelectedPolygons.add(newIdx));
    
    // Activate move mode
    multiMoveActive = true;
    multiMoveBtn?.classList.add('active');
    multiMoveBtn?.setAttribute('aria-pressed', 'true');
    
    updateSelectionButtons();
    draw();
    pushHistory();
  });
  
  deleteBtn?.addEventListener('click', () => {
    let changed = false;
    
    // Handle multiselection delete
    if (hasMultiSelection()) {
      multiSelectedInkStrokes.forEach(idx => {
        if (idx >= 0 && idx < model.inkStrokes.length) {
          model.inkStrokes[idx].hidden = true;
          changed = true;
        }
      });
      
      const pointsToRemove = Array.from(multiSelectedPoints);
      if (pointsToRemove.length > 0) {
        removePointsAndRelated(pointsToRemove, true);
        changed = true;
      }
      
      const linesToRemove = Array.from(multiSelectedLines);
      linesToRemove.sort((a, b) => b - a);
      linesToRemove.forEach(idx => {
        const line = model.lines[idx];
        if (line?.label) reclaimLabel(line.label);
        model.lines.splice(idx, 1);
        changed = true;
      });
      if (linesToRemove.length > 0) {
        const remap = new Map<number, number>();
        model.lines.forEach((_, idx) => remap.set(idx, idx));
        remapAngles(remap);
        remapPolygons(remap);
      }
      
      const circlesToRemove = Array.from(multiSelectedCircles);
      circlesToRemove.sort((a, b) => b - a);
      const allCirclePointsToRemove = new Set<number>();
      circlesToRemove.forEach(idx => {
        const circle = model.circles[idx];
        if (circle) {
          if (circle.label) reclaimLabel(circle.label);
          const circleId = circle.id;
          
          // Check center point - only remove if not used as defining point for lines
          const centerUsedInLines = model.lines.some(line => line.defining_points.includes(circle.center));
          if (!centerUsedInLines) {
            allCirclePointsToRemove.add(circle.center);
          }
          
          // Check other points on circle
          const constrainedPoints = [circle.radius_point, ...circle.points];
          constrainedPoints.forEach((pid) => {
            if (circleHasDefiningPoint(circle, pid)) return;
            const point = model.points[pid];
            if (!point) return;
            const hasCircleParent = point.parent_refs.some((pr) => pr.kind === 'circle' && pr.id === circleId);
            
            // Only remove if not used as defining point for lines
            const usedInLines = model.lines.some(line => line.defining_points.includes(pid));
            if (!usedInLines && (!isCircleThroughPoints(circle) || hasCircleParent)) {
              allCirclePointsToRemove.add(pid);
            }
          });
          
          // Remove circle from parent_refs of points that are not being deleted
          model.points = model.points.map((pt, ptIdx) => {
            if (allCirclePointsToRemove.has(ptIdx)) return pt;
            const before = pt.parent_refs || [];
            const afterRefs = before.filter((pr) => !(pr.kind === 'circle' && pr.id === circleId));
            if (afterRefs.length !== before.length) {
              const newKind = resolveConstructionKind(afterRefs);
              return {
                ...pt,
                parent_refs: afterRefs,
                defining_parents: afterRefs.map((p) => p.id),
                construction_kind: newKind
              };
            }
            return pt;
          });
          
          model.circles.splice(idx, 1);
          changed = true;
        }
      });
      
      // Remove collected circle points after all circles are processed
      if (allCirclePointsToRemove.size > 0) {
        removePointsAndRelated(Array.from(allCirclePointsToRemove), true);
      }
      
      const anglesToRemove = Array.from(multiSelectedAngles);
      anglesToRemove.sort((a, b) => b - a);
      anglesToRemove.forEach(idx => {
        const angle = model.angles[idx];
        if (angle?.label) reclaimLabel(angle.label);
        model.angles.splice(idx, 1);
        changed = true;
      });
      
      const polygonsToRemove = Array.from(multiSelectedPolygons);
      polygonsToRemove.sort((a, b) => b - a);
      polygonsToRemove.forEach(idx => {
        const poly = model.polygons[idx];
        if (poly) {
          poly.lines.forEach(li => {
            const line = model.lines[li];
            if (line?.label) reclaimLabel(line.label);
          });
          model.polygons.splice(idx, 1);
          changed = true;
        }
      });
      
      clearMultiSelection();
      updateSelectionButtons();
      if (changed) {
        rebuildIndexMaps();
        draw();
        pushHistory();
      }
      return;
    }
    
    if (selectedInkStrokeIndex !== null) {
      if (selectedInkStrokeIndex >= 0 && selectedInkStrokeIndex < model.inkStrokes.length) {
        model.inkStrokes.splice(selectedInkStrokeIndex, 1);
        selectedInkStrokeIndex = null;
        changed = true;
      }
    } else if (selectedLabel) {
      switch (selectedLabel.kind) {
        case 'point':
          if (model.points[selectedLabel.id]?.label) {
            reclaimLabel(model.points[selectedLabel.id].label);
            model.points[selectedLabel.id].label = undefined;
            changed = true;
          }
          break;
        case 'line':
          if (model.lines[selectedLabel.id]?.label) {
            reclaimLabel(model.lines[selectedLabel.id].label);
            model.lines[selectedLabel.id].label = undefined;
            changed = true;
          }
          break;
        case 'angle':
          if (model.angles[selectedLabel.id]?.label) {
            reclaimLabel(model.angles[selectedLabel.id].label);
            model.angles[selectedLabel.id].label = undefined;
            changed = true;
          }
          break;
        case 'free':
          if (selectedLabel.id >= 0 && selectedLabel.id < model.labels.length) {
            model.labels.splice(selectedLabel.id, 1);
            changed = true;
          }
          break;
      }
      selectedLabel = null;
      if (labelTextInput) labelTextInput.value = '';
    } else if (selectedPolygonIndex !== null) {
      const poly = model.polygons[selectedPolygonIndex];
      if (poly) {
        const polygonPoints = new Set<number>(polygonVertices(selectedPolygonIndex));
        poly.lines.forEach((li) => {
          const line = model.lines[li];
          if (line?.label) reclaimLabel(line.label);
        });
        const remap = new Map<number, number>();
        const toRemove = new Set(poly.lines);
        const kept: Line[] = [];
        model.lines.forEach((line, idx) => {
          if (toRemove.has(idx)) {
            remap.set(idx, -1);
          } else {
            remap.set(idx, kept.length);
            kept.push(line);
          }
        });
        model.lines = kept;
        remapAngles(remap);
        remapPolygons(remap);
        const orphanVertices = Array.from(polygonPoints).filter((pi) => !pointUsedAnywhere(pi));
        if (orphanVertices.length) {
          removePointsAndRelated(orphanVertices, false);
        } else {
          polygonPoints.forEach((pi) => clearPointLabelIfUnused(pi));
        }
      }
      selectedPolygonIndex = null;
      selectedLineIndex = null;
      selectedPointIndex = null;
      selectedCircleIndex = null;
      selectedArcSegments.clear();
      changed = true;
    } else if (selectedLineIndex !== null) {
      const line = model.lines[selectedLineIndex];
      const deletedLineId = line?.id;
      if (line?.label) reclaimLabel(line.label);
      if (selectionVertices) {
        const pts = Array.from(new Set(line.points));
        removePointsAndRelated(pts, true);
        if (deletedLineId) {
          const removedParallelIds = removeParallelLinesReferencing(deletedLineId);
          const removedPerpendicularIds = removePerpendicularLinesReferencing(deletedLineId);
          const idsToRemove = new Set<string>([deletedLineId, ...removedParallelIds, ...removedPerpendicularIds]);
          model.points = model.points.map((pt) => {
            const before = pt.parent_refs || [];
            const afterRefs = before.filter((pr) => !(pr.kind === 'line' && idsToRemove.has(pr.id)));
            if (afterRefs.length !== before.length) {
              const newKind = resolveConstructionKind(afterRefs);
              return {
                ...pt,
                parent_refs: afterRefs,
                defining_parents: afterRefs.map((p) => p.id),
                construction_kind: newKind
              };
            }
            return pt;
          });
        }
      } else {
        const lineIdx = selectedLineIndex;
        const remap = new Map<number, number>();
        model.lines.forEach((_, idx) => {
          if (idx === lineIdx) remap.set(idx, -1);
          else remap.set(idx, idx > lineIdx ? idx - 1 : idx);
        });
        model.lines.splice(lineIdx, 1);
        remapAngles(remap);
        remapPolygons(remap);
        // detach deleted line as parent from points that referenced it
        if (deletedLineId) {
          const removedParallelIds = removeParallelLinesReferencing(deletedLineId);
          const idsToRemove = new Set<string>([deletedLineId, ...removedParallelIds]);
          model.points = model.points.map((pt) => {
            const before = pt.parent_refs || [];
            const afterRefs = before.filter((pr) => !(pr.kind === 'line' && idsToRemove.has(pr.id)));
            if (afterRefs.length !== before.length) {
              const newKind = resolveConstructionKind(afterRefs);
              return {
                ...pt,
                parent_refs: afterRefs,
                defining_parents: afterRefs.map((p) => p.id),
                construction_kind: newKind
              };
            }
            return pt;
          });
        }
      }
      selectedLineIndex = null;
      selectedPointIndex = null;
      selectedCircleIndex = null;
      selectedPolygonIndex = null;
      changed = true;
    } else if (selectedAngleIndex !== null) {
      const angle = model.angles[selectedAngleIndex];
      if (angle?.label) reclaimLabel(angle.label);
      model.angles.splice(selectedAngleIndex, 1);
      selectedAngleIndex = null;
      selectedLineIndex = null;
      selectedPointIndex = null;
      selectedCircleIndex = null;
      selectedPolygonIndex = null;
      changed = true;
    } else if (selectedCircleIndex !== null) {
      const circle = model.circles[selectedCircleIndex];
      if (circle) {
        if (selectionVertices) {
          const pointsToDelete = new Set<number>();
          if (circle.center !== null) pointsToDelete.add(circle.center);
          if (circle.radius_point !== null) pointsToDelete.add(circle.radius_point);
          circle.defining_parents.forEach(pid => {
            const idx = model.points.findIndex(p => p.id === pid);
            if (idx !== -1) pointsToDelete.add(idx);
          });
          removePointsAndRelated(Array.from(pointsToDelete), true);
        } else {
          if (circle.label) reclaimLabel(circle.label);
          const circleId = circle.id;
          const idx = model.indexById.circle[circleId];
          if (idx !== undefined) {
            model.circles.splice(idx, 1);
          }
          
          model.points = model.points.map((pt) => {
            const before = pt.parent_refs || [];
            const afterRefs = before.filter((pr) => !(pr.kind === 'circle' && pr.id === circleId));
            if (afterRefs.length !== before.length) {
              const newKind = resolveConstructionKind(afterRefs);
              return {
                ...pt,
                parent_refs: afterRefs,
                defining_parents: afterRefs.map((p) => p.id),
                construction_kind: newKind
              };
            }
            return pt;
          });
        }
      }
      selectedCircleIndex = null;
      selectedLineIndex = null;
      selectedPointIndex = null;
      selectedPolygonIndex = null;
      changed = true;
    } else if (selectedPointIndex !== null) {
      removePointsAndRelated([selectedPointIndex], true);
      selectedPointIndex = null;
      selectedCircleIndex = null;
      selectedPolygonIndex = null;
      changed = true;
    }
    
    // Wyłącz tryb kopiowania stylu po usunięciu obiektu
    if (changed && copyStyleActive) {
      copyStyleActive = false;
      copiedStyle = null;
    }
    
    updateSelectionButtons();
    if (changed) {
      rebuildIndexMaps();
      draw();
      pushHistory();
    }
  });
  showHiddenBtn?.addEventListener('click', () => {
    showHidden = !showHidden;
    updateOptionButtons();
    draw();
  });
  showMeasurementsBtn?.addEventListener('click', () => {
    // When disabling measurements, convert pinned labels to free labels
    if (showMeasurements) {
      const pinnedLabels = measurementLabels.filter(ml => ml.pinned);
      pinnedLabels.forEach(ml => {
        const text = getMeasurementLabelText(ml);
        if (text && text !== '—') {
          model.labels.push({
            text,
            pos: { x: ml.pos.x, y: ml.pos.y },
            color: ml.color ?? THEME.defaultStroke,
            fontSize: ml.fontSize ?? getLabelFontDefault()
          });
        }
      });
      
      // Clear all measurement labels
      measurementLabels = [];
      closeMeasurementInputBox();
      
      showMeasurements = false;
      updateOptionButtons();
      draw();
      
      if (pinnedLabels.length > 0) {
        pushHistory();
      }
    } else {
      // Enabling measurements
      showMeasurements = true;
      generateMeasurementLabels();
      updateOptionButtons();
      draw();
    }
  });
  copyImageBtn?.addEventListener('click', async () => {
    try {
      const blob = await captureCanvasAsPng();
      const ClipboardItemCtor = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function' || !ClipboardItemCtor) {
        throw new Error('Clipboard API niedostępne');
      }
      await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
      closeZoomMenu();
    } catch (err) {
      console.error('Nie udało się skopiować obrazu', err);
      window.alert('Nie udało się skopiować obrazu do schowka. Sprawdź uprawnienia przeglądarki.');
    }
  });
  saveImageBtn?.addEventListener('click', async () => {
    try {
      const blob = await captureCanvasAsPng();
      const stamp = getTimestampString();
      const filename = `geometry-${stamp}.png`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      closeZoomMenu();
    } catch (err) {
      console.error('Nie udało się zapisać obrazu', err);
      window.alert('Nie udało się przygotować pliku PNG.');
    }
  });
  exportJsonBtn?.addEventListener('click', async () => {
    try {
      const snapshot = serializeCurrentDocument();
      const json = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      
      // Try to use File System Access API with default folder as starting location
      if ('showSaveFilePicker' in window) {
        try {
          const stamp = getTimestampString();
          const defaultName = `geometry-${stamp}.json`;

          // Show the save file picker, starting in default folder if set
          // @ts-ignore
          const pickerOpts: SaveFilePickerOptions = {
            suggestedName: defaultName,
            types: [
              {
                description: 'JSON File',
                accept: { 'application/json': ['.json'] }
              }
            ]
          };
          
          // If default folder is set, start picker there
          if (defaultFolderHandle) {
            // Ensure we have permission before using the handle
            const hasPermission = await ensureFolderPermission(defaultFolderHandle);
            if (hasPermission) {
              // @ts-ignore
              pickerOpts.startIn = defaultFolderHandle;
            } else {
              // Permission denied, clear the handle
              defaultFolderHandle = null;
              await saveDefaultFolderHandle(null);
              updateDefaultFolderDisplay();
            }
          }
          
          // @ts-ignore - use the platform picker if available
          const fileHandle = await (window as any).showSaveFilePicker(pickerOpts);
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          closeZoomMenu();
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') return; // User cancelled
          // If saving via picker fails, fall back to traditional download
          console.warn('Save via showSaveFilePicker failed, falling back:', err);
        }
      }
      
      // Fallback to traditional download
      const stamp = getTimestampString();
      const filename = `geometry-${stamp}.json`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      closeZoomMenu();
    } catch (err) {
      console.error('Nie udało się wyeksportować JSON', err);
      window.alert('Nie udało się przygotować pliku JSON.');
    }
  });
  importJsonBtn?.addEventListener('click', () => {
    if (!importJsonInput) return;
    importJsonInput.value = '';
    importJsonInput.click();
  });
  importJsonInput?.addEventListener('change', async () => {
    if (!importJsonInput) return;
    const file = importJsonInput.files && importJsonInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      applyPersistedDocument(parsed);
      closeZoomMenu();
    } catch (err) {
      console.error('Nie udało się wczytać szkicu', err);
      window.alert('Nie udało się wczytać pliku JSON. Sprawdź poprawność danych.');
    } finally {
      importJsonInput.value = '';
    }
  });
  clearAllBtn?.addEventListener('click', () => {
    model = createEmptyModel();
    resetLabelState();
    selectedLineIndex = null;
    selectedPointIndex = null;
    selectedCircleIndex = null;
    selectedAngleIndex = null;
    selectedPolygonIndex = null;
    selectedInkStrokeIndex = null;
    selectedLabel = null;
    selectedSegments.clear();
    selectedArcSegments.clear();
    segmentStartIndex = null;
    panOffset = { x: 0, y: 0 };
    zoomFactor = 1;
    closeStyleMenu();
    closeZoomMenu();
    closeViewMenu();
    closeRayMenu();
    styleMenuSuppressed = false;
    updateSelectionButtons();
    draw();
    pushHistory();
  });
  undoBtn?.addEventListener('click', undo);
  redoBtn?.addEventListener('click', redo);
  zoomMenuBtn?.addEventListener('click', toggleZoomMenu);
  styleMenuBtn?.addEventListener('click', toggleStyleMenu);
  styleColorInput?.addEventListener('input', () => {
    if (!styleColorInput) return;
    rememberColor(styleColorInput.value);
    applyStyleFromInputs();
    updateStyleMenuValues();
  });
  styleWidthInput?.addEventListener('input', () => {
    applyStyleFromInputs();
    updateLineWidthControls();
  });
  styleTypeSelect?.addEventListener('change', applyStyleFromInputs);
  styleTickButton?.addEventListener('click', () => {
    cycleTickState();
  });
  labelTextInput?.addEventListener('input', () => {
    if (!labelTextInput) return;
    if (!selectedLabel) return;
    const text = labelTextInput.value;
    let changed = false;
    switch (selectedLabel.kind) {
      case 'point':
        if (model.points[selectedLabel.id]?.label) {
          model.points[selectedLabel.id].label = { ...model.points[selectedLabel.id].label!, text };
          changed = true;
        }
        break;
      case 'line':
        if (model.lines[selectedLabel.id]?.label) {
          model.lines[selectedLabel.id].label = { ...model.lines[selectedLabel.id].label!, text };
          changed = true;
        }
        break;
      case 'angle':
        if (model.angles[selectedLabel.id]?.label) {
          model.angles[selectedLabel.id].label = { ...model.angles[selectedLabel.id].label!, text };
          changed = true;
        }
        break;
      case 'free':
        if (model.labels[selectedLabel.id]) {
          model.labels[selectedLabel.id] = { ...model.labels[selectedLabel.id], text };
          changed = true;
        }
        break;
    }
    if (changed) {
      draw();
      pushHistory();
    }
  });
  labelGreekButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!labelTextInput) return;
      const symbol = btn.dataset.letter ?? btn.textContent ?? '';
      if (!symbol) return;
      insertLabelSymbol(symbol);
    });
  });
  if (labelScriptBtn) {
    labelScriptBtn.addEventListener('click', () => {
      if (selectedLabel === null) return;
      labelScriptVisible = !labelScriptVisible;
      // ensure greek panel is visible when switching to script
      if (labelScriptVisible) labelGreekVisible = true;
      refreshLabelKeyboard(true);
    });
  }
  labelGreekToggleBtn?.addEventListener('click', () => {
    if (selectedLabel === null) return;
    labelGreekVisible = !labelGreekVisible;
    refreshLabelKeyboard(true);
  });
  labelGreekShiftBtn?.addEventListener('click', () => {
    if (selectedLabel === null) return;
    labelGreekUppercase = !labelGreekUppercase;
    refreshLabelKeyboard(true);
  });
  labelFontDecreaseBtn?.addEventListener('click', () => {
    adjustSelectedLabelFont(-LABEL_FONT_STEP);
  });
  labelFontIncreaseBtn?.addEventListener('click', () => {
    adjustSelectedLabelFont(LABEL_FONT_STEP);
  });
  document.addEventListener('click', (e) => {
    if (zoomMenuOpen && !zoomMenuContainer?.contains(e.target as Node)) {
      closeZoomMenu();
    }
    if (viewModeOpen && !viewModeMenuContainer?.contains(e.target as Node)) {
      closeViewMenu();
    }
    if (rayModeOpen && !rayModeMenuContainer?.contains(e.target as Node)) {
      closeRayMenu();
    }
  });
  updateToolButtons();
  updateSelectionButtons();
  updateOptionButtons();
  updateColorButtons();
  pushHistory();
  
  // Appearance tab initialization
  initAppearanceTab();
  
  // Apply button configuration after DOM is ready
  applyButtonConfiguration();
}

function tryApplyLabelToSelection() {
  if (mode !== 'label') return;
  const anySelection =
    selectedLineIndex !== null ||
    selectedPolygonIndex !== null ||
    selectedPointIndex !== null ||
    selectedAngleIndex !== null;
  if (!anySelection) return;
  // simulate a label application without user click by reusing current mode logic on selection
  const color = styleColorInput?.value || '#000';
  let changed = false;
  if (selectedAngleIndex !== null && !model.angles[selectedAngleIndex].label) {
    const { text, seq } = nextGreek();
    model.angles[selectedAngleIndex].label = {
      text,
      color,
      offset: defaultAngleLabelOffset(selectedAngleIndex),
      fontSize: getLabelFontDefault(),
      seq
    };
    changed = true;
  } else if (selectedPolygonIndex !== null) {
    const verts = polygonVerticesOrdered(selectedPolygonIndex).filter((vi) => !model.points[vi]?.label);
    verts.forEach((vi) => {
      const { text, seq } = nextUpper();
      model.points[vi].label = {
        text,
        color,
        offset: defaultPointLabelOffset(vi),
        fontSize: getLabelFontDefault(),
        seq
      };
    });
    if (verts.length) {
      changed = true;
    }
  } else if (selectedLineIndex !== null) {
    // Jeśli zaznaczone są wierzchołki, etykietuj je
    if (selectionVertices) {
      const line = model.lines[selectedLineIndex];
      if (line) {
        const verts = line.points.filter((vi) => !model.points[vi]?.label);
        verts.forEach((vi) => {
          const { text, seq } = nextUpper();
          model.points[vi].label = {
            text,
            color,
            offset: defaultPointLabelOffset(vi),
            fontSize: getLabelFontDefault(),
            seq
          };
        });
        if (verts.length) {
          changed = true;
        }
      }
    }
    // Jeśli zaznaczone są krawędzie (lub oba), etykietuj linię
    if (selectionEdges && !model.lines[selectedLineIndex].label) {
      const { text, seq } = nextLower();
      model.lines[selectedLineIndex].label = {
        text,
        color,
        offset: defaultLineLabelOffset(selectedLineIndex),
        fontSize: getLabelFontDefault(),
        seq
      };
      changed = true;
    }
  } else if (selectedPointIndex !== null && !model.points[selectedPointIndex].label) {
    const { text, seq } = nextUpper();
    model.points[selectedPointIndex].label = {
      text,
      color,
      offset: defaultPointLabelOffset(selectedPointIndex),
      fontSize: getLabelFontDefault(),
      seq
    };
    changed = true;
  }
  if (changed) {
    draw();
    pushHistory();
  }
  if (changed || anySelection) {
    // leave select mode after applying/attempting
    if (stickyTool === null) setMode('move');
    updateToolButtons();
    updateSelectionButtons();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initRuntime);
}

// helpers
function findPoint(p: { x: number; y: number }): number | null {
  const tol = currentHitRadius();
  for (let i = model.points.length - 1; i >= 0; i--) {
    const pt = model.points[i];
    if (pt.style.hidden && !showHidden) continue;
    const dx = pt.x - p.x;
    const dy = pt.y - p.y;
    if (Math.hypot(dx, dy) <= tol) return i;
  }
  return null;
}

function findPointWithRadius(p: { x: number; y: number }, radius: number): number | null {
  for (let i = model.points.length - 1; i >= 0; i--) {
    const pt = model.points[i];
    if (pt.style.hidden && !showHidden) continue;
    if (Math.hypot(pt.x - p.x, pt.y - p.y) <= radius) return i;
  }
  return null;
}

function findLinesContainingPoint(idx: number): number[] {
  const res: number[] = [];
  for (let i = 0; i < model.lines.length; i++) {
    if (model.lines[i].points.includes(idx)) res.push(i);
  }
  return res;
}

function normalize(v: { x: number; y: number }) {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

function snapDir(start: { x: number; y: number }, target: { x: number; y: number }) {
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const dist = Math.hypot(dx, dy) || 1;
  const candidates = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: Math.SQRT1_2, y: Math.SQRT1_2 },
    { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
    { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
    { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }
  ];
  const dir = { x: dx / dist, y: dy / dist };
  let best = candidates[0];
  let bestDot = -Infinity;
  for (const c of candidates) {
    const dot = c.x * dir.x + c.y * dir.y;
    if (dot > bestDot) {
      bestDot = dot;
      best = c;
    }
  }
  return { x: start.x + best.x * dist, y: start.y + best.y * dist };
}

function captureLineContext(pointIdx: number): { lineIdx: number; fractions: number[] } | null {
  const lineIdx = findLinesContainingPoint(pointIdx)[0];
  if (lineIdx === undefined) return null;
  const line = model.lines[lineIdx];
  if (line.points.length < 2) return null;
  // Use defining points if available, otherwise fall back to first/last (e.g. for free lines without defining points?)
  // Actually all lines should have defining points or be defined by 2 points.
  const def0 = line.defining_points?.[0] ?? line.points[0];
  const def1 = line.defining_points?.[1] ?? line.points[line.points.length - 1];
  const origin = model.points[def0];
  const end = model.points[def1];
  if (!origin || !end) return null;
  const dir = normalize({ x: end.x - origin.x, y: end.y - origin.y });
  const len = Math.hypot(end.x - origin.x, end.y - origin.y);
  if (len === 0) return null;
  const fractions = line.points.map((idx) => {
    const p = model.points[idx];
    if (!p) return 0;
    const t = ((p.x - origin.x) * dir.x + (p.y - origin.y) * dir.y) / len;
    return t;
  });
  return { lineIdx, fractions };
}

function calculateLineFractions(lineIdx: number): number[] {
  const line = model.lines[lineIdx];
  if (!line || line.points.length < 2) return [];
  const def0 = line.defining_points?.[0] ?? line.points[0];
  const def1 = line.defining_points?.[1] ?? line.points[line.points.length - 1];
  const origin = model.points[def0];
  const end = model.points[def1];
  if (!origin || !end) return [];
  const dir = normalize({ x: end.x - origin.x, y: end.y - origin.y });
  const len = Math.hypot(end.x - origin.x, end.y - origin.y);
  if (len === 0) return [];
  
  return line.points.map((idx) => {
    const p = model.points[idx];
    if (!p) return 0;
    return ((p.x - origin.x) * dir.x + (p.y - origin.y) * dir.y) / len;
  });
}

function applyFractionsToLine(lineIdx: number, fractions: number[]) {
  const line = model.lines[lineIdx];
  if (!line || line.points.length < 2) return;
  const def0 = line.defining_points?.[0] ?? line.points[0];
  const def1 = line.defining_points?.[1] ?? line.points[line.points.length - 1];
  const origin = model.points[def0];
  const end = model.points[def1];
  if (!origin || !end) return;
  const dir = normalize({ x: end.x - origin.x, y: end.y - origin.y });
  const len = Math.hypot(end.x - origin.x, end.y - origin.y);
  if (len === 0) return;
  
  const changed = new Set<number>();
  fractions.forEach((t, idx) => {
    if (idx >= line.points.length) return;
    const pIdx = line.points[idx];
    
    // Don't reposition defining_points - they define the line!
    if (line.defining_points.includes(pIdx)) return;
    
    const pos = { x: origin.x + dir.x * t * len, y: origin.y + dir.y * t * len };
    model.points[pIdx] = { ...model.points[pIdx], ...pos };
    changed.add(pIdx);
  });
  enforceIntersections(lineIdx);
  changed.forEach((idx) => {
    updateMidpointsForPoint(idx);
    updateCirclesForPoint(idx);
  });
}

function applyLineFractions(lineIdx: number) {
  if (!lineDragContext || lineDragContext.lineIdx !== lineIdx) return;
  const line = model.lines[lineIdx];
  if (line.points.length < 2) return;
  const def0 = line.defining_points?.[0] ?? line.points[0];
  const def1 = line.defining_points?.[1] ?? line.points[line.points.length - 1];
  const origin = model.points[def0];
  const end = model.points[def1];
  if (!origin || !end) return;
  const dir = normalize({ x: end.x - origin.x, y: end.y - origin.y });
  const len = Math.hypot(end.x - origin.x, end.y - origin.y);
  if (len === 0) return;
  
  let fractions = lineDragContext.fractions;
  
  // If the line has more points than when we captured the context,
  // recalculate fractions for the new points
  if (fractions.length !== line.points.length) {
    // Use the stored fractions as a base, but recalculate based on current positions
    // This handles cases where points were added to the line after drag started
    // Use defining points for recalculation too
    const oldOrigin = model.points[def0];
    const oldEnd = model.points[def1];
    if (!oldOrigin || !oldEnd) return;
    const oldDir = normalize({ x: oldEnd.x - oldOrigin.x, y: oldEnd.y - oldOrigin.y });
    const oldLen = Math.hypot(oldEnd.x - oldOrigin.x, oldEnd.y - oldOrigin.y);
    if (oldLen === 0) return;
    
    fractions = line.points.map((idx) => {
      const p = model.points[idx];
      if (!p) return 0;
      const t = ((p.x - oldOrigin.x) * oldDir.x + (p.y - oldOrigin.y) * oldDir.y) / oldLen;
      return t;
    });
  }
  
  const changed = new Set<number>();
  fractions.forEach((t, idx) => {
    const pIdx = line.points[idx];
    if (idx === 0 || idx === line.points.length - 1) return;
    
    // Don't reposition defining_points - they define the line!
    if (line.defining_points.includes(pIdx)) return;
    
    const pos = { x: origin.x + dir.x * t * len, y: origin.y + dir.y * t * len };
    model.points[pIdx] = { ...model.points[pIdx], ...pos };
    changed.add(pIdx);
  });
  enforceIntersections(lineIdx);
  changed.forEach((idx) => {
    updateMidpointsForPoint(idx);
    updateCirclesForPoint(idx);
  });
}

type LineHit =
  | { line: number; part: 'segment'; seg: number }
  | { line: number; part: 'rayLeft' }
  | { line: number; part: 'rayRight' };
type CircleHit = { circle: number };

function findLineHits(p: { x: number; y: number }): LineHit[] {
  const hits: LineHit[] = [];
  const tol = currentHitRadius();
  for (let i = model.lines.length - 1; i >= 0; i--) {
    const line = model.lines[i];
    if (line.hidden && !showHidden) continue;
    if (line.points.length >= 2) {
      for (let s = 0; s < line.points.length - 1; s++) {
        const a = model.points[line.points[s]];
        const b = model.points[line.points[s + 1]];
        const style = line.segmentStyles?.[s] ?? line.style;
        if (!a || !b) continue;
        if (style.hidden && !showHidden) continue;
        // Removed check for hidden endpoints
        if (pointToSegmentDistance(p, a, b) <= tol) {
          hits.push({ line: i, part: 'segment', seg: s });
          break;
        }
      }
      const a = model.points[line.points[0]];
      const b = model.points[line.points[line.points.length - 1]];
      if (a && b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const dir = { x: dx / len, y: dy / len };
        const extend = (canvas!.width + canvas!.height) / (dpr * zoomFactor);
        if (line.leftRay && !(line.leftRay.hidden && !showHidden)) {
          const rayEnd = { x: a.x - dir.x * extend, y: a.y - dir.y * extend };
          if (pointToSegmentDistance(p, a, rayEnd) <= tol) hits.push({ line: i, part: 'rayLeft' });
        }
        if (line.rightRay && !(line.rightRay.hidden && !showHidden)) {
          const rayEnd = { x: b.x + dir.x * extend, y: b.y + dir.y * extend };
          if (pointToSegmentDistance(p, b, rayEnd) <= tol) hits.push({ line: i, part: 'rayRight' });
        }
      }
    }
  }
  return hits;
}

function findLine(p: { x: number; y: number }): LineHit | null {
  const hits = findLineHits(p);
  return hits.length ? hits[0] : null;
}

function normalizeAngle(a: number) {
  let ang = a;
  while (ang < 0) ang += Math.PI * 2;
  while (ang >= Math.PI * 2) ang -= Math.PI * 2;
  return ang;
}

type DerivedArc = {
  circle: number;
  start: number;
  end: number;
  clockwise: boolean;
  center: { x: number; y: number };
  radius: number;
  style: StrokeStyle;
  hidden?: boolean;
};

function arcKey(circleIdx: number, arcIdx: number) {
  return `${circleIdx}:${arcIdx}`;
}

function parseArcKey(key: string): { circle: number; arcIdx: number } | null {
  const [c, a] = key.split(':').map((v) => Number(v));
  if (Number.isFinite(c) && Number.isFinite(a)) return { circle: c, arcIdx: a };
  return null;
}

function ensureArcStyles(circleIdx: number, count: number) {
  const circle = model.circles[circleIdx];
  if (!circle.arcStyles || circle.arcStyles.length !== count) {
    circle.arcStyles = Array.from({ length: count }, () => ({ ...circle.style }));
  }
}

function circleArcs(circleIdx: number): DerivedArc[] {
  const circle = model.circles[circleIdx];
  if (!circle) return [];
  const center = model.points[circle.center];
  if (!center) return [];
  const radius = circleRadius(circle);
  if (radius <= 1e-3) return [];
  const pts = circlePerimeterPoints(circle)
    .map((pi) => {
      const p = model.points[pi];
      if (!p) return null;
      const ang = Math.atan2(p.y - center.y, p.x - center.x);
      return { idx: pi, ang };
    })
    .filter((v): v is { idx: number; ang: number } => v !== null)
    .sort((a, b) => a.ang - b.ang);
  if (pts.length < 2) return [];
  ensureArcStyles(circleIdx, pts.length);
  const arcs: DerivedArc[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const start = a.ang;
    const end = b.ang;
    const clockwise = false;
    const style = circle.arcStyles?.[i] ?? circle.style;
    arcs.push({
      circle: circleIdx,
      start,
      end,
      clockwise,
      center,
      radius,
      style,
      hidden: style.hidden || circle.style.hidden
    });
  }
  return arcs;
}

function angleOnArc(test: number, start: number, end: number, clockwise: boolean) {
  const t = normalizeAngle(test);
  const s = normalizeAngle(start);
  const e = normalizeAngle(end);
  if (!clockwise) {
    const span = (e - s + Math.PI * 2) % (Math.PI * 2);
    const pos = (t - s + Math.PI * 2) % (Math.PI * 2);
    return pos <= span + 1e-6;
  }
  const span = (s - e + Math.PI * 2) % (Math.PI * 2);
  const pos = (s - t + Math.PI * 2) % (Math.PI * 2);
  return pos <= span + 1e-6;
}

function findArcAt(
  p: { x: number; y: number },
  tolerance = currentHitRadius(),
  onlyCircle?: number
): { circle: number; arcIdx: number } | null {
  for (let ci = model.circles.length - 1; ci >= 0; ci--) {
    if (onlyCircle !== undefined && ci !== onlyCircle) continue;
    if (model.circles[ci].hidden && !showHidden) continue;
    const arcs = circleArcs(ci);
    for (let ai = arcs.length - 1; ai >= 0; ai--) {
      const arc = arcs[ai];
      const center = arc.center;
      const dist = Math.hypot(p.x - center.x, p.y - center.y);
      if (Math.abs(dist - arc.radius) > tolerance) continue;
      const ang = Math.atan2(p.y - center.y, p.x - center.x);
      if (angleOnArc(ang, arc.start, arc.end, arc.clockwise)) return { circle: ci, arcIdx: ai };
    }
  }
  return null;
}

function angleBaseGeometry(ang: Angle) {
  const l1 = model.lines[ang.leg1.line];
  const l2 = model.lines[ang.leg2.line];
  if (!l1 || !l2) return null;
  const v = model.points[ang.vertex];
  const a1 = model.points[l1.points[ang.leg1.seg]];
  const b1 = model.points[l1.points[ang.leg1.seg + 1]];
  const a2 = model.points[l2.points[ang.leg2.seg]];
  const b2 = model.points[l2.points[ang.leg2.seg + 1]];
  if (!v || !a1 || !b1 || !a2 || !b2) return null;
  const p1 = ang.vertex === l1.points[ang.leg1.seg] ? b1 : a1;
  const p2 = ang.vertex === l2.points[ang.leg2.seg] ? b2 : a2;
  const ang1 = normalizeAngle(Math.atan2(p1.y - v.y, p1.x - v.x));
  const ang2 = normalizeAngle(Math.atan2(p2.y - v.y, p2.x - v.x));
  let ccw = (ang2 - ang1 + Math.PI * 2) % (Math.PI * 2);
  let start = ang1;
  let end = ang2;
  if (ccw > Math.PI) {
    // swap to always take the smaller arc counterclockwise
    start = ang2;
    end = ang1;
    ccw = (end - start + Math.PI * 2) % (Math.PI * 2);
  }
  const clockwise = false;
  const legLen1 = Math.hypot(p1.x - v.x, p1.y - v.y);
  const legLen2 = Math.hypot(p2.x - v.x, p2.y - v.y);
  const legLimit = Math.max(4, Math.min(legLen1, legLen2) - ANGLE_RADIUS_MARGIN);
  const maxRadius = Math.max(500, legLimit);
  const minRadius = ANGLE_MIN_RADIUS;
  let radius = Math.min(ANGLE_DEFAULT_RADIUS, maxRadius);
  radius = clamp(radius, minRadius, maxRadius);
  return { v, p1, p2, start, end, span: ccw, clockwise, radius, minRadius, maxRadius };
}

function angleGeometry(ang: Angle) {
  const base = angleBaseGeometry(ang);
  if (!base) return null;
  const offset = ang.style.arcRadiusOffset ?? 0;
  const rawRadius = base.radius + offset;
  const radius = clamp(rawRadius, base.minRadius, base.maxRadius);
  
  // Handle exterior angles by inverting the direction (draws the reflex angle > 180°)
  const isExterior = !!ang.style.exterior;
  const clockwise = isExterior ? !base.clockwise : base.clockwise;
  
  return { ...base, start: base.start, end: base.end, clockwise, radius, style: ang.style };
}

function defaultAngleRadius(ang: Angle): number | null {
  const base = angleBaseGeometry(ang);
  return base ? base.radius : null;
}

function adjustSelectedAngleRadius(direction: 1 | -1) {
  if (selectedAngleIndex === null) return;
  const ang = model.angles[selectedAngleIndex];
  const base = angleBaseGeometry(ang);
  if (!base) return;
  const currentOffset = ang.style.arcRadiusOffset ?? 0;
  const desiredRadius = clamp(base.radius + currentOffset + direction * ANGLE_RADIUS_STEP, base.minRadius, base.maxRadius);
  const nextOffset = desiredRadius - base.radius;
  if (Math.abs(nextOffset - currentOffset) < 1e-6) {
    updateStyleMenuValues();
    return;
  }
  model.angles[selectedAngleIndex] = { ...ang, style: { ...ang.style, arcRadiusOffset: nextOffset } };
  draw();
  pushHistory();
  updateStyleMenuValues();
}

function findAngleAt(p: { x: number; y: number }, tolerance = currentHitRadius()): number | null {
  for (let i = model.angles.length - 1; i >= 0; i--) {
    const geom = angleGeometry(model.angles[i]);
    if (!geom) continue;
    const { v, start, end, clockwise, radius } = geom;
    const dist = Math.abs(Math.hypot(p.x - v.x, p.y - v.y) - radius);
    if (dist > tolerance) continue;
    const ang = Math.atan2(p.y - v.y, p.x - v.x);
    if (angleOnArc(ang, start, end, clockwise)) return i;
  }
  return null;
}

function pointInLine(idx: number, line: Line): boolean {
  return line.points.includes(idx);
}

function pointToSegmentDistance(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const l2 = Math.max(1, (b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2));
  const proj = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  return Math.hypot(p.x - proj.x, p.y - proj.y);
}

function circlesContainingPoint(idx: number): number[] {
  const res = new Set<number>();
  model.circles.forEach((c, ci) => {
    // Only include points that are actually on the circle (constrained to it)
    // NOT the radius_point which just defines the circle size
    if (c.points.includes(idx) && !circleHasDefiningPoint(c, idx)) res.add(ci);
  });
  return Array.from(res);
}

function circlesReferencingPoint(idx: number): number[] {
  const res = new Set<number>();
  model.circles.forEach((c, ci) => {
    if (c.center === idx) res.add(ci);
    if (c.radius_point === idx) res.add(ci);
    if (c.points.includes(idx) && !circleHasDefiningPoint(c, idx)) res.add(ci);
    if (isCircleThroughPoints(c) && c.defining_points.includes(idx)) res.add(ci);
  });
  return Array.from(res);
}

function circlesWithCenter(idx: number): number[] {
  const res: number[] = [];
  model.circles.forEach((c, ci) => {
    if (c.center === idx) res.push(ci);
  });
  return res;
}

function strokeBounds(stroke: InkStroke): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (!stroke.points.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  stroke.points.forEach(pt => {
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
  });
  const margin = stroke.baseWidth * 2;
  return { minX: minX - margin, minY: minY - margin, maxX: maxX + margin, maxY: maxY + margin };
}

function findInkStrokeAt(p: { x: number; y: number }): number | null {
  for (let i = model.inkStrokes.length - 1; i >= 0; i--) {
    const stroke = model.inkStrokes[i];
    if (stroke.hidden && !showHidden) continue;
    const bounds = strokeBounds(stroke);
    if (!bounds) continue;
    if (p.x < bounds.minX || p.x > bounds.maxX || p.y < bounds.minY || p.y > bounds.maxY) continue;
    
    const tolerance = currentHitRadius();
    for (let j = 0; j < stroke.points.length; j++) {
      const pt = stroke.points[j];
      if (j === 0) {
        if (Math.hypot(p.x - pt.x, p.y - pt.y) <= tolerance) return i;
      } else {
        const prev = stroke.points[j - 1];
        if (pointToSegmentDistance(p, prev, pt) <= tolerance) return i;
      }
    }
  }
  return null;
}

function applyStrokeStyle(kind: StrokeStyle['type']) {
  if (!ctx) return;
  switch (kind) {
    case 'dashed':
      ctx.setLineDash([6, 4]);
      break;
    case 'dotted':
      ctx.setLineDash([2, 4]);
      break;
    default:
      ctx.setLineDash([]);
  }
}

function getPointLabelPos(idx: number): { x: number; y: number } | null {
  const p = model.points[idx];
  if (!p || !p.label) return null;
  if (!p.label.offset) p.label.offset = defaultPointLabelOffset(idx);
  const offScreen = p.label.offset ?? { x: 8, y: -8 };
  const offWorld = screenOffsetToWorld(offScreen);
  return { x: p.x + offWorld.x, y: p.y + offWorld.y };
}

function getLineLabelPos(idx: number): { x: number; y: number } | null {
  const line = model.lines[idx];
  if (!line || !line.label) return null;
  const ext = lineExtent(idx);
  if (!ext) return null;
  if (!line.label.offset) line.label.offset = defaultLineLabelOffset(idx);
  const offScreen = line.label.offset ?? { x: 0, y: -10 };
  const offWorld = screenOffsetToWorld(offScreen);
  return { x: ext.center.x + offWorld.x, y: ext.center.y + offWorld.y };
}

function getAngleLabelPos(idx: number): { x: number; y: number } | null {
  const ang = model.angles[idx];
  if (!ang || !ang.label) return null;
  const geom = angleGeometry(ang);
  if (!geom) return null;
  if (!ang.label.offset) ang.label.offset = defaultAngleLabelOffset(idx);
  const offScreen = ang.label.offset ?? { x: 0, y: 0 };
  const offWorld = screenOffsetToWorld(offScreen);
  return { x: geom.v.x + offWorld.x, y: geom.v.y + offWorld.y };
}

function isPointInLabelBox(pScreen: {x: number, y: number}, labelPosWorld: {x: number, y: number}, label: Pick<Label, 'text' | 'fontSize'>) {
  const posScreen = worldToCanvas(labelPosWorld.x, labelPosWorld.y);
  const dim = getLabelScreenDimensions(label);
  const padX = 6;
  const padY = 4;
  const halfW = dim.width / 2 + padX;
  const halfH = dim.height / 2 + padY;
  
  return (
    pScreen.x >= posScreen.x - halfW &&
    pScreen.x <= posScreen.x + halfW &&
    pScreen.y >= posScreen.y - halfH &&
    pScreen.y <= posScreen.y + halfH
  );
}

function findLabelAt(p: { x: number; y: number }): { kind: 'point' | 'line' | 'angle' | 'free'; id: number } | null {
  const pScreen = worldToCanvas(p.x, p.y);
  
  for (let i = model.angles.length - 1; i >= 0; i--) {
    const pos = getAngleLabelPos(i);
    const label = model.angles[i].label;
    if (pos && label && isPointInLabelBox(pScreen, pos, label)) return { kind: 'angle', id: i };
  }
  for (let i = model.lines.length - 1; i >= 0; i--) {
    const pos = getLineLabelPos(i);
    const label = model.lines[i].label;
    if (pos && label && isPointInLabelBox(pScreen, pos, label)) return { kind: 'line', id: i };
  }
  for (let i = model.points.length - 1; i >= 0; i--) {
    const pos = getPointLabelPos(i);
    const label = model.points[i].label;
    if (pos && label && isPointInLabelBox(pScreen, pos, label)) return { kind: 'point', id: i };
  }
  for (let i = model.labels.length - 1; i >= 0; i--) {
    const lab = model.labels[i];
    if (lab.hidden && !showHidden) continue;
    if (isPointInLabelBox(pScreen, lab.pos, lab)) return { kind: 'free', id: i };
  }
  return null;
}

function toPoint(ev: PointerEvent) {
  const rect = canvas!.getBoundingClientRect();
  const canvasX = ev.clientX - rect.left;
  const canvasY = ev.clientY - rect.top;
  return canvasToWorld(canvasX, canvasY);
}

function canvasToWorld(canvasX: number, canvasY: number) {
  return {
    x: (canvasX - panOffset.x) / zoomFactor,
    y: (canvasY - panOffset.y) / zoomFactor
  };
}

function worldToCanvas(worldX: number, worldY: number) {
  return {
    x: worldX * zoomFactor + panOffset.x,
    y: worldY * zoomFactor + panOffset.y
  };
}

function screenOffsetToWorld(offset: { x: number; y: number }): { x: number; y: number } {
  return { x: offset.x / zoomFactor, y: offset.y / zoomFactor };
}

function worldOffsetToScreen(offset: { x: number; y: number }): { x: number; y: number } {
  return { x: offset.x * zoomFactor, y: offset.y * zoomFactor };
}

function updateTouchPointFromEvent(ev: PointerEvent) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  activeTouches.set(ev.pointerId, { x: ev.clientX - rect.left, y: ev.clientY - rect.top });
}

function removeTouchPoint(pointerId: number) {
  activeTouches.delete(pointerId);
  if (pinchState && !pinchState.pointerIds.every((id) => activeTouches.has(id))) {
    pinchState = null;
  }
}

function startPinchFromTouches(): boolean {
  const entries = Array.from(activeTouches.entries());
  if (entries.length < 2) return false;
  const [[idA, ptA], [idB, ptB]] = entries as [[number, TouchPoint], [number, TouchPoint]];
  const distance = Math.hypot(ptA.x - ptB.x, ptA.y - ptB.y);
  if (!(distance > 0)) return false;
  pinchState = {
    pointerIds: [idA, idB],
    initialDistance: distance,
    initialZoom: zoomFactor
  };
  draggingSelection = false;
  resizingLine = null;
  lineDragContext = null;
  pendingPanCandidate = null;
  isPanning = false;
  return true;
}

function continuePinchGesture(): boolean {
  if (!pinchState) return false;
  const [idA, idB] = pinchState.pointerIds;
  const ptA = activeTouches.get(idA);
  const ptB = activeTouches.get(idB);
  if (!ptA || !ptB) return false;
  const distance = Math.hypot(ptA.x - ptB.x, ptA.y - ptB.y);
  if (!(distance > 0)) return false;
  const ratio = distance / pinchState.initialDistance;
  const midpoint = { x: (ptA.x + ptB.x) / 2, y: (ptA.y + ptB.y) / 2 };
  const worldBefore = canvasToWorld(midpoint.x, midpoint.y);
  const nextZoom = clamp(pinchState.initialZoom * ratio, MIN_ZOOM, MAX_ZOOM);
  const zoomChanged = Math.abs(nextZoom - zoomFactor) > 1e-6;
  const prevPan = { ...panOffset };
  zoomFactor = nextZoom;
  panOffset = {
    x: midpoint.x - worldBefore.x * zoomFactor,
    y: midpoint.y - worldBefore.y * zoomFactor
  };
  const panChanged = Math.abs(panOffset.x - prevPan.x) > 1e-6 || Math.abs(panOffset.y - prevPan.y) > 1e-6;
  if (zoomChanged || panChanged) {
    movedDuringPan = true;
    draw();
  }
  pinchState.initialDistance = distance;
  pinchState.initialZoom = zoomFactor;
  return zoomChanged || panChanged;
}

function handleCanvasWheel(ev: WheelEvent) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const canvasX = ev.clientX - rect.left;
  const canvasY = ev.clientY - rect.top;
  const focusWorld = canvasToWorld(canvasX, canvasY);
  const deltaY = ev.deltaMode === WheelEvent.DOM_DELTA_LINE ? ev.deltaY * 16 : ev.deltaY;
  const zoomDelta = Math.exp(-deltaY * 0.001);
  const nextZoom = clamp(zoomFactor * zoomDelta, MIN_ZOOM, MAX_ZOOM);
  if (Math.abs(nextZoom - zoomFactor) < 1e-6) {
    ev.preventDefault();
    return;
  }
  zoomFactor = nextZoom;
  panOffset = {
    x: canvasX - focusWorld.x * zoomFactor,
    y: canvasY - focusWorld.y * zoomFactor
  };
  movedDuringPan = true;
  ev.preventDefault();
  draw();
}

function selectLabel(sel: { kind: 'point' | 'line' | 'angle' | 'free'; id: number } | null) {
  // Cleanup empty free label if we are switching selection
  if (selectedLabel && selectedLabel.kind === 'free') {
    const isSame = sel && sel.kind === 'free' && sel.id === selectedLabel.id;
    if (!isSame) {
      const l = model.labels[selectedLabel.id];
      if (l && (!l.text || !l.text.trim())) {
        model.labels.splice(selectedLabel.id, 1);
        // Adjust sel if it is a free label and index needs shifting
        if (sel && sel.kind === 'free' && sel.id > selectedLabel.id) {
          sel.id--;
        }
      }
    }
  }

  selectedLabel = sel;
  if (sel) {
    selectedPointIndex = null;
    selectedLineIndex = null;
    selectedCircleIndex = null;
    selectedAngleIndex = null;
    selectedPolygonIndex = null;
    selectedSegments.clear();
    selectedArcSegments.clear();
  }
  updateSelectionButtons();
  draw();
}

function clearLabelSelection() {
  selectLabel(null);
}

function handleToolClick(tool: Mode) {
  // Cleanup empty free label
  if (selectedLabel && selectedLabel.kind === 'free') {
    const l = model.labels[selectedLabel.id];
    if (l && (!l.text || !l.text.trim())) {
      model.labels.splice(selectedLabel.id, 1);
      selectedLabel = null;
      draw();
    }
  }

  if (stickyTool === tool) {
    stickyTool = null;
    setMode('move');
    return;
  }
  stickyTool = null;
  const symmetricSeed = tool === 'symmetric' ? selectedPointIndex : null;
  if (tool === 'midpoint') {
    if (selectedPointIndex !== null) {
      clearSelectionState();
      updateSelectionButtons();
      draw();
    } else {
      const segEntry =
        Array.from(selectedSegments)
          .map(parseSegmentKey)
          .find((k) => k && k.part === 'segment' && k.seg !== undefined) ?? null;
      const candidateLine = segEntry?.line ?? selectedLineIndex;
      const candidateSeg = segEntry?.seg ?? 0;
      if (candidateLine !== null) {
        const line = model.lines[candidateLine];
        if (line && line.points[candidateSeg] !== undefined && line.points[candidateSeg + 1] !== undefined) {
          const a = model.points[line.points[candidateSeg]];
          const b = model.points[line.points[candidateSeg + 1]];
          if (a && b) {
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const midIdx = addPoint(model, {
              ...mid,
              style: currentPointStyle(),
              defining_parents: line?.id ? [{ kind: 'line', id: line.id }] : []
            });
            insertPointIntoLine(candidateLine, midIdx, mid);
            clearSelectionState();
            selectedPointIndex = midIdx;
            selectedLineIndex = candidateLine;
            updateSelectionButtons();
            draw();
            pushHistory();
            setMode('move');
            updateToolButtons();
            return;
          }
        }
      }
    }
  }
  if (tool === 'parallelLine') {
    parallelAnchorPointIndex = selectedPointIndex;
    parallelReferenceLineIndex = selectedLineIndex;
    if (parallelAnchorPointIndex !== null && parallelReferenceLineIndex !== null) {
      const created = createParallelLineThroughPoint(parallelAnchorPointIndex, parallelReferenceLineIndex);
      parallelAnchorPointIndex = null;
      parallelReferenceLineIndex = null;
      if (created !== null) {
        selectedLineIndex = created;
        selectedPointIndex = null;
        draw();
        pushHistory();
        maybeRevertMode();
        updateSelectionButtons();
        return;
      }
    }
  }
  if (
    tool === 'triangleUp' ||
    tool === 'square' ||
    tool === 'polygon' ||
    tool === 'ngon' ||
    tool === 'angle' ||
    tool === 'bisector' ||
    tool === 'circleThree'
  ) {
    clearSelectionState();
    updateSelectionButtons();
    draw();
  }
  setMode(tool);
  if (tool === 'symmetric') {
    symmetricSourceIndex = symmetricSeed;
    if (symmetricSourceIndex !== null) draw();
  }
  if (tool === 'label') {
    tryApplyLabelToSelection();
  }
  updateToolButtons();
  updateSelectionButtons();
}

function handleToolSticky(tool: Mode) {
  // Cleanup empty free label
  if (selectedLabel && selectedLabel.kind === 'free') {
    const l = model.labels[selectedLabel.id];
    if (l && (!l.text || !l.text.trim())) {
      model.labels.splice(selectedLabel.id, 1);
      selectedLabel = null;
      draw();
    }
  }

  if (stickyTool === tool) {
    stickyTool = null;
    setMode('move');
  } else {
    stickyTool = tool;
    setMode(tool);
  }
  updateToolButtons();
  updateSelectionButtons();
}

function setupDoubleTapSticky(btn: HTMLButtonElement | null, tool: Mode) {
  if (!btn) return;
  
  btn.addEventListener('touchend', (e) => {
    const now = Date.now();
    const lastTap = doubleTapTimeouts.get(btn);
    
    if (lastTap && now - lastTap < DOUBLE_TAP_DELAY) {
      // Double tap detected
      e.preventDefault();
      doubleTapTimeouts.delete(btn);
      handleToolSticky(tool);
    } else {
      // First tap
      doubleTapTimeouts.set(btn, now);
      // Clear timeout after delay
      setTimeout(() => {
        doubleTapTimeouts.delete(btn);
      }, DOUBLE_TAP_DELAY);
    }
  }, { passive: false });
}

function maybeRevertMode() {
  if (stickyTool === null && mode !== 'move') {
    setMode('move');
  }
  
  // Reset multi-buttons to their first (main) function after use
  Object.keys(buttonConfig.multiButtons).forEach(mainId => {
    if (multiButtonStates[mainId] !== 0) {
      multiButtonStates[mainId] = 0;
      
      // Update button visual to show first tool
      const mainBtn = document.getElementById(mainId);
      if (mainBtn) {
        const buttonIds = buttonConfig.multiButtons[mainId];
        const firstToolId = buttonIds[0];
        const firstTool = TOOL_BUTTONS.find(t => t.id === firstToolId);
        
        if (firstTool) {
          const svgElement = mainBtn.querySelector('svg');
          if (svgElement) {
            svgElement.setAttribute('viewBox', firstTool.viewBox);
            svgElement.innerHTML = firstTool.icon;
          }
          mainBtn.setAttribute('title', firstTool.label);
          mainBtn.setAttribute('aria-label', firstTool.label);
        }
      }
    }
  });
}

function updateToolButtons() {
  const applyClasses = (btn: HTMLButtonElement | null, tool: Mode) => {
    if (!btn) return;
    btn.classList.toggle('active', mode === tool);
    btn.classList.toggle('sticky', stickyTool === tool);
  };
  applyClasses(modeAddBtn, 'add');
  applyClasses(modeSegmentBtn, 'segment');
  applyClasses(modeParallelBtn, 'parallel');
  applyClasses(modePerpBtn, 'perpendicular');
  applyClasses(modeTriangleBtn, 'triangleUp');
  applyClasses(modeSquareBtn, 'square');
  applyClasses(modeCircleThreeBtn, 'circleThree');
  applyClasses(modeLabelBtn, 'label');
  applyClasses(modeAngleBtn, 'angle');
  applyClasses(modePolygonBtn, 'polygon');
  applyClasses(modeBisectorBtn, 'bisector');
  applyClasses(modeMidpointBtn, 'midpoint');
  applyClasses(modeSymmetricBtn, 'symmetric');
  applyClasses(modeParallelLineBtn, 'parallelLine');
  applyClasses(modeNgonBtn, 'ngon');
  applyClasses(modeMultiselectBtn, 'multiselect');
  applyClasses(document.getElementById('modeCircle') as HTMLButtonElement | null, 'circle');
  applyClasses(modeHandwritingBtn, 'handwriting');
    if (modeMoveBtn) {
    modeMoveBtn.classList.toggle('active', mode === 'move');
    modeMoveBtn.classList.toggle('sticky', false);
    const moveLabel = 'Zaznacz';
    modeMoveBtn.title = moveLabel;
    modeMoveBtn.setAttribute('aria-label', moveLabel);
    modeMoveBtn.innerHTML = `${ICONS.moveSelect}<span class="sr-only">${moveLabel}</span>`;
  }
  
  // Handle multi-buttons - check if current tool matches any in the group
  Object.entries(buttonConfig.multiButtons).forEach(([mainId, buttonIds]) => {
    const mainBtn = document.getElementById(mainId);
    if (!mainBtn) return;
    
    const currentIndex = multiButtonStates[mainId] || 0;
    const currentToolId = buttonIds[currentIndex];
    const currentTool = TOOL_BUTTONS.find(t => t.id === currentToolId);
    
    if (currentTool) {
      let isActive = false;
      if (currentToolId === 'copyStyleBtn') {
        isActive = copyStyleActive;
      } else {
        isActive = mode === currentTool.mode;
      }
      
      mainBtn.classList.toggle('active', isActive);
      mainBtn.classList.toggle('sticky', stickyTool === currentTool.mode);
    }
  });
}

function updateSelectionButtons() {
  const visible = selectedLineIndex !== null || selectedPolygonIndex !== null;
  if (viewModeToggleBtn) {
    if (viewModeMenuContainer) viewModeMenuContainer.style.display = 'none';
    const mode = getViewModeState();
    if (mode === 'edges') viewModeToggleBtn.innerHTML = ICONS.viewEdges;
    else viewModeToggleBtn.innerHTML = ICONS.viewVertices;
  }
  const anySelection =
    selectedLineIndex !== null ||
    selectedPointIndex !== null ||
    selectedCircleIndex !== null ||
    selectedPolygonIndex !== null ||
    selectedArcSegments.size > 0 ||
    selectedAngleIndex !== null ||
    selectedInkStrokeIndex !== null ||
    selectedLabel !== null ||
    hasMultiSelection();
  if (hideBtn) {
    hideBtn.style.display = anySelection ? 'inline-flex' : 'none';
  }
  if (deleteBtn) {
    deleteBtn.style.display = anySelection ? 'inline-flex' : 'none';
  }
  if (copyStyleBtn) {
    const canCopyStyle = mode !== 'multiselect' && (selectedPointIndex !== null || selectedLineIndex !== null || 
      selectedCircleIndex !== null || selectedAngleIndex !== null || selectedInkStrokeIndex !== null);
    copyStyleBtn.style.display = canCopyStyle ? 'inline-flex' : 'none';
    if (copyStyleActive) {
      copyStyleBtn.classList.add('active');
      copyStyleBtn.setAttribute('aria-pressed', 'true');
    } else {
      copyStyleBtn.classList.remove('active');
      copyStyleBtn.setAttribute('aria-pressed', 'false');
    }
  }
  
  // Show multiselect move and clone buttons
  const showMultiButtons = mode === 'multiselect' && hasMultiSelection();
  if (multiMoveBtn) {
    multiMoveBtn.style.display = showMultiButtons ? 'inline-flex' : 'none';
  }
  if (multiCloneBtn) {
    multiCloneBtn.style.display = showMultiButtons ? 'inline-flex' : 'none';
  }
  
  if (styleMenuContainer) {
    // Show style menu when there is a selection OR when in handwriting mode
    const showStyle = (anySelection && !hasMultiSelection()) || mode === 'handwriting';
    styleMenuContainer.style.display = showStyle ? 'inline-flex' : 'none';
    if (!anySelection && mode !== 'handwriting') {
      closeStyleMenu();
      styleMenuSuppressed = false;
    }
    updateStyleMenuValues();
  }
  if (eraserBtn) {
    const showEraser = mode === 'handwriting';
    eraserBtn.style.display = showEraser ? 'inline-flex' : 'none';
    eraserBtn.classList.toggle('active', eraserActive);
    eraserBtn.setAttribute('aria-pressed', eraserActive ? 'true' : 'false');
  }
}

function renderWidth(w: number) {
  return Math.max(0.1, w / (dpr * zoomFactor));
}

function screenUnits(value: number) {
  return value / zoomFactor;
}

function renderInkStroke(stroke: InkStroke, context: CanvasRenderingContext2D) {
  const points = stroke.points;
  if (!points.length) return;
  context.save();
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (points.length === 1) {
    const pt = points[0];
    const radius = renderWidth(stroke.baseWidth * Math.max(pt.pressure, 0.25)) * 0.5;
    context.beginPath();
    context.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const avgPressure = Math.max(0.2, (prev.pressure + curr.pressure) * 0.5);
    context.lineWidth = renderWidth(stroke.baseWidth * avgPressure);
    context.beginPath();
    context.moveTo(prev.x, prev.y);
    context.lineTo(curr.x, curr.y);
    context.stroke();
  }
  context.restore();
}

function drawSegmentTicks(
  a: { x: number; y: number },
  b: { x: number; y: number },
  level: TickLevel,
  context: CanvasRenderingContext2D
) {
  if (level <= 0) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= screenUnits(2)) return;
  const dir = { x: dx / length, y: dy / length };
  const perp = { x: -dir.y, y: dir.x };
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const tickLength = screenUnits(TICK_LENGTH_UNITS);
  const edgeMargin = screenUnits(TICK_MARGIN_UNITS);
  const maxOffset = Math.max(0, length / 2 - edgeMargin);
  const rawStep = level === 1 ? 0 : screenUnits(TICK_SPACING_UNITS);
  const maxStep = maxOffset * 2 / Math.max(1, level - 1);
  const step = level === 1 ? 0 : Math.min(rawStep, maxStep);
  context.save();
  context.setLineDash([]);
  context.lineCap = 'round';
  for (let i = 0; i < level; i++) {
    const offset = step * (i - (level - 1) / 2);
    const clampedOffset = clamp(offset, -maxOffset, maxOffset);
    const base = {
      x: mid.x + dir.x * clampedOffset,
      y: mid.y + dir.y * clampedOffset
    };
    const start = {
      x: base.x + perp.x * (tickLength / 2),
      y: base.y + perp.y * (tickLength / 2)
    };
    const end = {
      x: base.x - perp.x * (tickLength / 2),
      y: base.y - perp.y * (tickLength / 2)
    };
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
  context.restore();
}

function drawArcTicks(
  center: { x: number; y: number },
  radius: number,
  start: number,
  end: number,
  clockwise: boolean,
  level: TickLevel,
  context: CanvasRenderingContext2D
) {
  if (level <= 0 || radius <= 0) return;
  let span = clockwise ? (start - end + Math.PI * 2) % (Math.PI * 2) : (end - start + Math.PI * 2) % (Math.PI * 2);
  if (span < 1e-4) span = Math.PI * 2;
  const dir = clockwise ? -1 : 1;
  const mid = clockwise ? normalizeAngle(start - span / 2) : normalizeAngle(start + span / 2);
  const tickLength = screenUnits(TICK_LENGTH_UNITS);
  const margin = Math.min(span / 4, screenUnits(TICK_MARGIN_UNITS) / Math.max(radius, 1e-3));
  const maxAngleOffset = Math.max(0, span / 2 - margin);
  const rawStep = level === 1 ? 0 : screenUnits(TICK_SPACING_UNITS) / Math.max(radius, 1e-3);
  const maxStep = maxAngleOffset * 2 / Math.max(1, level - 1);
  const step = level === 1 ? 0 : Math.min(rawStep, maxStep);
  context.save();
  context.setLineDash([]);
  context.lineCap = 'round';
  for (let i = 0; i < level; i++) {
    const offset = step * (i - (level - 1) / 2);
    const clampedOffset = clamp(offset, -maxAngleOffset, maxAngleOffset);
    const angle = normalizeAngle(mid + dir * clampedOffset);
    const base = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };
    const normal = { x: Math.cos(angle), y: Math.sin(angle) };
    const startPt = {
      x: base.x + normal.x * (tickLength / 2),
      y: base.y + normal.y * (tickLength / 2)
    };
    const endPt = {
      x: base.x - normal.x * (tickLength / 2),
      y: base.y - normal.y * (tickLength / 2)
    };
    context.beginPath();
    context.moveTo(startPt.x, startPt.y);
    context.lineTo(endPt.x, endPt.y);
    context.stroke();
  }
  context.restore();
}

function drawCircleTicks(
  center: { x: number; y: number },
  radius: number,
  level: TickLevel,
  context: CanvasRenderingContext2D
) {
  drawArcTicks(center, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2, false, level, context);
}

function currentHitRadius(multiplier = 1) {
  return (HIT_RADIUS * multiplier) / zoomFactor;
}

function currentLabelHitRadius(multiplier = 1) {
  return (LABEL_HIT_RADIUS * multiplier) / zoomFactor;
}

function pointRadius(size: number) {
  const start = 4; // size 1
  const end = 6; // size 6
  const clamped = Math.max(1, Math.min(6, size));
  if (clamped <= 1) return start;
  return start + ((clamped - 1) * (end - start)) / 5;
}

function lineMidpoint(lineIdx: number) {
  const line = model.lines[lineIdx];
  if (!line || line.points.length < 2) return null;
  const a = model.points[line.points[0]];
  const b = model.points[line.points[line.points.length - 1]];
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, a, b };
}

function defaultLineLabelOffset(lineIdx: number): { x: number; y: number } {
  const mp = lineMidpoint(lineIdx);
  if (!mp) return worldOffsetToScreen({ x: 0, y: -16 });
  const dx = mp.b.x - mp.a.x;
  const dy = mp.b.y - mp.a.y;
  const len = Math.hypot(dx, dy) || 1;
  let normal = { x: -dy / len, y: dx / len };
  const polyIdx = polygonForLine(lineIdx);
  if (polyIdx !== null) {
    const c = polygonCentroid(polyIdx);
    if (c) {
      const toCentroid = { x: c.x - mp.x, y: c.y - mp.y };
      const dot = normal.x * toCentroid.x + normal.y * toCentroid.y;
      if (dot > 0) normal = { x: -normal.x, y: -normal.y }; // push outward
    }
  } else if (Math.abs(dx) < 1e-3) {
    normal = { x: -1, y: 0 };
  } else if (normal.y > 0) {
    normal = { x: -normal.x, y: -normal.y }; // aim upward
  }
  const margin = 18;
  return worldOffsetToScreen({ x: normal.x * margin, y: normal.y * margin });
}

function pointLineDirections(pointIdx: number): { x: number; y: number }[] {
  const dirs: { x: number; y: number }[] = [];
  const lines = findLinesContainingPoint(pointIdx);
  lines.forEach((li) => {
    const line = model.lines[li];
    const pos = line.points.indexOf(pointIdx);
    if (pos === -1) return;
    const prev = pos > 0 ? model.points[line.points[pos - 1]] : null;
    const next = pos < line.points.length - 1 ? model.points[line.points[pos + 1]] : null;
    const p = model.points[pointIdx];
    if (!p) return;
    if (prev) {
      const dx = prev.x - p.x;
      const dy = prev.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      dirs.push({ x: dx / len, y: dy / len });
    }
    if (next) {
      const dx = next.x - p.x;
      const dy = next.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      dirs.push({ x: dx / len, y: dy / len });
    }
  });
  return dirs;
}

function defaultPointLabelOffset(pointIdx: number): { x: number; y: number } {
  const p = model.points[pointIdx];
  const fallbackWorld = { x: 12, y: -12 };
  if (!p) return worldOffsetToScreen(fallbackWorld);

  const circleIdxs = circlesContainingPoint(pointIdx);
  if (circleIdxs.length) {
    const c = model.circles[circleIdxs[0]];
    const center = model.points[c.center];
    if (center) {
      const dir = normalize({ x: p.x - center.x, y: p.y - center.y });
      const margin = 18;
      return worldOffsetToScreen({ x: dir.x * margin, y: dir.y * margin });
    }
  }

  const dirs = pointLineDirections(pointIdx);
  const margin = 18;
  if (dirs.length >= 2) {
    const sum = dirs.reduce((acc, d) => ({ x: acc.x + d.x, y: acc.y + d.y }), { x: 0, y: 0 });
    const len = Math.hypot(sum.x, sum.y);
    let dir =
      len > 1e-3
        ? { x: sum.x / len, y: sum.y / len }
        : { x: -dirs[0].y, y: dirs[0].x }; // perpendicular fallback
    dir = { x: -dir.x, y: -dir.y }; // outside the angle
    return worldOffsetToScreen({ x: dir.x * margin, y: dir.y * margin });
  }

  if (dirs.length === 1) {
    let dir = { x: -dirs[0].y, y: dirs[0].x }; // perpendicular
    if (dir.y > 0) dir = { x: -dir.x, y: -dir.y };
    return worldOffsetToScreen({ x: dir.x * margin, y: dir.y * margin });
  }

  return worldOffsetToScreen(fallbackWorld);
}

function defaultAngleLabelOffset(angleIdx: number): { x: number; y: number } {
  const geom = angleGeometry(model.angles[angleIdx]);
  if (!geom) return worldOffsetToScreen({ x: 0, y: -12 });
  const mid = geom.start + geom.span / 2;
  const dir = { x: Math.cos(mid), y: Math.sin(mid) };
  const radius = Math.max(geom.radius * 0.65, 12);
  return worldOffsetToScreen({ x: dir.x * radius, y: dir.y * radius });
}

function getLabelScreenDimensions(label: Pick<Label, 'text' | 'fontSize'>) {
  if (!ctx) return { width: 0, height: 0, lines: [], lineWidths: [], lineHeight: 0 };
  
  const fontSize = normalizeLabelFontSize(label.fontSize);
  ctx.save();
  ctx.font = `${fontSize}px sans-serif`;
  
  // Trim trailing newlines
  let text = label.text;
  while (text.endsWith('\n')) {
    text = text.slice(0, -1);
  }
  
  const lines = text.split('\n');
  const lineHeight = fontSize * 1.2;
  let maxWidth = 0;
  const lineWidths: number[] = [];
  
  lines.forEach(line => {
    const w = measureFormattedText(ctx!, line);
    lineWidths.push(w);
    if (w > maxWidth) maxWidth = w;
  });
  
  const totalHeight = lines.length * lineHeight;
  
  ctx.restore();
  
  return { width: maxWidth, height: totalHeight, lines, lineWidths, lineHeight };
}

function drawLabelText(
  label: Pick<Label, 'text' | 'color' | 'fontSize'>,
  anchor: { x: number; y: number },
  selected = false,
  screenOffset?: { x: number; y: number }
) {
  if (!ctx) return;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const anchorScreen = worldToCanvas(anchor.x, anchor.y);
  const screenPos = {
    x: anchorScreen.x + (screenOffset?.x ?? 0),
    y: anchorScreen.y + (screenOffset?.y ?? 0)
  };
  ctx.translate(screenPos.x, screenPos.y);
  const fontSize = normalizeLabelFontSize(label.fontSize);
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const { width: maxWidth, height: totalHeight, lines, lineWidths, lineHeight } = getLabelScreenDimensions(label);
  const startY = -(totalHeight / 2) + (lineHeight / 2);

  if (selected) {
    const padX = 6;
    const padY = 4;
    const w = maxWidth + padX * 2;
    const h = totalHeight + padY * 2;
    ctx.fillStyle = 'rgba(251,191,36,0.18)'; // soft highlight
    ctx.strokeStyle = THEME.highlight;
    ctx.lineWidth = 1;
    const x = -w / 2;
    const y = -h / 2;
    const r = 6;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = label.color ?? '#000';
  
  lines.forEach((line, i) => {
    const w = lineWidths[i];
    const y = startY + i * lineHeight;
    renderFormattedText(ctx!, line, -w / 2, y);
  });
  
  ctx.restore();
}

/**
 * Parse label text and automatically add braces for subscripts/superscripts
 * Examples:
 * - P_11 -> P_{11}
 * - a_BCd_EF -> a_{BC}d_{EF}
 * - P_abc -> P_{abc}
 */
function autoAddBraces(text: string): string {
  let result = '';
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    
    // Check for _ or ^
    if ((char === '_' || char === '^') && i + 1 < text.length) {
      result += char;
      i++;
      
      // If already has braces, keep them
      if (text[i] === '{') {
        result += char;
        i++;
        continue;
      }
      
      // Auto-group: collect consecutive chars of same type
      const startIdx = i;
      const firstChar = text[i];
      
      // Determine grouping type based on first character
      const isDigit = /\d/.test(firstChar);
      const isLowercase = /[a-z]/.test(firstChar);
      const isUppercase = /[A-Z]/.test(firstChar);
      const isGreek = /[α-ωΑ-Ω]/.test(firstChar);
      
      // Collect characters of the same type
      while (i < text.length) {
        const c = text[i];
        const matches = isDigit ? /\d/.test(c) :
                       isLowercase ? /[a-z]/.test(c) :
                       isUppercase ? /[A-Z]/.test(c) :
                       isGreek ? /[α-ωΑ-Ω]/.test(c) : false;
        
        if (!matches) break;
        i++;
      }
      
      const group = text.substring(startIdx, i);
      if (group.length > 0) {
        result += '{' + group + '}';
      }
    } else {
      result += char;
      i++;
    }
  }
  
  return result;
}

function measureFormattedText(ctx: CanvasRenderingContext2D, text: string): number {
  const processedText = autoAddBraces(text);
  const baseFontSize = parseFloat(ctx.font) || 16;
  const subSupSize = baseFontSize * 0.7;
  
  let width = 0;
  let i = 0;
  
  while (i < processedText.length) {
    const char = processedText[i];
    
    if ((char === '_' || char === '^') && i + 1 < processedText.length && processedText[i + 1] === '{') {
      i += 2; // Skip _{ or ^{
      let content = '';
      let braceCount = 1;
      
      while (i < processedText.length && braceCount > 0) {
        if (processedText[i] === '{') braceCount++;
        else if (processedText[i] === '}') {
          braceCount--;
          if (braceCount === 0) break;
        }
        content += processedText[i];
        i++;
      }
      
      ctx.save();
      ctx.font = `${subSupSize}px ${ctx.font.split('px ')[1] || 'sans-serif'}`;
      width += ctx.measureText(content).width;
      ctx.restore();
      
      i++; // Skip closing }
    } else {
      width += ctx.measureText(char).width;
      i++;
    }
  }
  return width;
}

/**
 * Render text with subscript/superscript support
 * Supports: P_{11}, P^{2}, mixed P_{1}^{2}
 */
function renderFormattedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.textAlign = 'left';
  // First, auto-add braces where needed
  const processedText = autoAddBraces(text);
  
  const baseFontSize = parseFloat(ctx.font) || 16;
  const subSupSize = baseFontSize * 0.7;
  const subOffset = baseFontSize * 0.3;
  const supOffset = -baseFontSize * 0.4;
  
  let currentX = x;
  let i = 0;
  
  while (i < processedText.length) {
    const char = processedText[i];
    
    // Handle subscript
    if (char === '_' && i + 1 < processedText.length && processedText[i + 1] === '{') {
      i += 2; // Skip _{
      let content = '';
      let braceCount = 1;
      
      while (i < processedText.length && braceCount > 0) {
        if (processedText[i] === '{') braceCount++;
        else if (processedText[i] === '}') {
          braceCount--;
          if (braceCount === 0) break;
        }
        content += processedText[i];
        i++;
      }
      
      // Render subscript
      ctx.save();
      ctx.font = `${subSupSize}px ${ctx.font.split('px ')[1] || 'sans-serif'}`;
      ctx.fillText(content, currentX, y + subOffset);
      currentX += ctx.measureText(content).width;
      ctx.restore();
      
      i++; // Skip closing }
    }
    // Handle superscript
    else if (char === '^' && i + 1 < processedText.length && processedText[i + 1] === '{') {
      i += 2; // Skip ^{
      let content = '';
      let braceCount = 1;
      
      while (i < processedText.length && braceCount > 0) {
        if (processedText[i] === '{') braceCount++;
        else if (processedText[i] === '}') {
          braceCount--;
          if (braceCount === 0) break;
        }
        content += processedText[i];
        i++;
      }
      
      // Render superscript
      ctx.save();
      ctx.font = `${subSupSize}px ${ctx.font.split('px ')[1] || 'sans-serif'}`;
      ctx.fillText(content, currentX, y + supOffset);
      currentX += ctx.measureText(content).width;
      ctx.restore();
      
      i++; // Skip closing }
    }
    // Regular character
    else {
      ctx.fillText(char, currentX, y);
      currentX += ctx.measureText(char).width;
      i++;
    }
  }
}

function updateOptionButtons() {
  if (showHiddenBtn) {
    showHiddenBtn.classList.toggle('active', showHidden);
    showHiddenBtn.innerHTML = showHidden ? ICONS.eyeOff : ICONS.eye;
  }
  if (showMeasurementsBtn) {
    showMeasurementsBtn.classList.toggle('active', showMeasurements);
    showMeasurementsBtn.setAttribute('aria-pressed', showMeasurements ? 'true' : 'false');
    showMeasurementsBtn.title = showMeasurements ? 'Ukryj wymiary' : 'Pokaż wymiary';
    showMeasurementsBtn.setAttribute('aria-label', showMeasurements ? 'Ukryj wymiary' : 'Pokaż wymiary');
  }
  if (themeDarkBtn) {
    const isDark = currentTheme === 'dark';
    themeDarkBtn.classList.toggle('active', isDark);
    themeDarkBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  }
}

function normalizeColor(color: string) {
  return color.trim().toLowerCase();
}

function rememberColor(color: string) {
  const norm = normalizeColor(color);
  const existing = recentColors.findIndex((c) => normalizeColor(c) === norm);
  if (existing >= 0) recentColors.splice(existing, 1);
  recentColors.unshift(color);
  if (recentColors.length > 20) recentColors = recentColors.slice(0, 20);
  updateColorButtons();
}

function paletteColors(): string[] {
  const palette: string[] = [];
  recentColors.forEach((c) => {
    if (!palette.some((p) => normalizeColor(p) === normalizeColor(c))) palette.push(c);
  });
  const baseColors = THEME.palette;
  if (baseColors.length) {
    baseColors.forEach((c) => {
      if (palette.length < 5 && !palette.some((p) => normalizeColor(p) === normalizeColor(c))) palette.push(c);
    });
    while (palette.length < 5) {
      palette.push(baseColors[palette.length % baseColors.length]);
    }
  } else {
    while (palette.length < 5) {
      palette.push(THEME.defaultStroke);
    }
  }
  return palette.slice(0, 5);
}

function updateColorButtons() {
  const colorInput = styleColorInput;
  if (!colorInput) return;
  const currentColor = colorInput.value;
  const palette = paletteColors();
  colorSwatchButtons.forEach((btn, idx) => {
    const color = palette[idx] ?? THEME.defaultStroke;
    btn.dataset.color = color;
    btn.style.background = color;
    btn.classList.remove('active');
  });
  if (customColorBtn) {
    const isCustom = !palette.some((c) => normalizeColor(c) === normalizeColor(currentColor));
    customColorBtn.classList.toggle('active', isCustom);
  }
}

function insertLabelSymbol(symbol: string) {
  if (!labelTextInput) return;
  const input = labelTextInput;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const nextValue = input.value.slice(0, start) + symbol + input.value.slice(end);
  input.value = nextValue;
  const caret = start + symbol.length;
  input.focus();
  if (typeof input.setSelectionRange === 'function') {
    input.setSelectionRange(caret, caret);
  }
  const evt = new Event('input', { bubbles: true });
  input.dispatchEvent(evt);
}

function refreshLabelKeyboard(labelEditing: boolean) {
  if (!labelEditing) {
    labelGreekVisible = false;
    labelGreekUppercase = false;
  }
  if (labelGreekToggleBtn) {
    labelGreekToggleBtn.style.display = labelEditing ? 'inline-flex' : 'none';
    const active = labelEditing && labelGreekVisible;
    labelGreekToggleBtn.classList.toggle('active', active);
    labelGreekToggleBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  if (labelGreekRow) {
    labelGreekRow.style.display = labelEditing && labelGreekVisible ? 'flex' : 'none';
  }
  // use top-level SCRIPT_UPPER / SCRIPT_LOWER
  // Assign script letters only to non-symbol keys and stop when letters run out (no repeats)
  let scriptIndex = 0;
  labelGreekButtons.forEach((btn) => {
    if (labelScriptVisible) {
      // Preserve explicit symbol buttons (they have class 'label-symbol-btn')
      if (btn.classList.contains('label-symbol-btn')) {
        btn.disabled = false;
        btn.style.display = '';
        return;
      }
      if (scriptIndex < SCRIPT_LOWER.length) {
        const lower = SCRIPT_LOWER[scriptIndex];
        const upper = SCRIPT_UPPER[scriptIndex] || lower.toUpperCase();
        const symbol = labelGreekUppercase ? upper : lower;
        btn.dataset.letter = symbol;
        btn.textContent = symbol;
        btn.disabled = false;
        btn.style.display = '';
        scriptIndex += 1;
      } else {
        // No more letters — clear and disable the remaining keys to avoid repeats
        btn.dataset.letter = '';
        btn.textContent = '';
        btn.disabled = true;
        btn.style.display = 'none';
      }
    } else {
      // Restore original greek/symbol behavior
      const lower = btn.dataset.letterLower ?? btn.dataset.letter ?? btn.textContent ?? '';
      const upper = btn.dataset.letterUpper ?? lower.toUpperCase();
      const symbol = labelGreekUppercase ? upper : lower;
      btn.dataset.letter = symbol;
      btn.textContent = symbol;
      
      if (symbol) {
        btn.disabled = false;
        btn.style.display = '';
      } else {
        btn.disabled = true;
        btn.style.display = 'none';
      }
    }
  });
  if (labelGreekShiftBtn) {
    // const visible = labelEditing && labelGreekVisible;
    // labelGreekShiftBtn.style.display = visible ? 'inline-flex' : 'none';
    labelGreekShiftBtn.style.display = 'none';
    // labelGreekShiftBtn.classList.toggle('active', labelGreekUppercase && visible);
    // labelGreekShiftBtn.setAttribute('aria-pressed', labelGreekUppercase ? 'true' : 'false');
  }
  if (labelScriptBtn) {
    // const visible = labelEditing && labelGreekVisible;
    // labelScriptBtn.style.display = visible ? 'inline-flex' : 'none';
    labelScriptBtn.style.display = 'none';
    // labelScriptBtn.classList.toggle('active', labelScriptVisible && visible);
    // labelScriptBtn.setAttribute('aria-pressed', labelScriptVisible ? 'true' : 'false');
  }
}

function labelFontSizeForSelection(): number | null {
  if (!selectedLabel) return null;
  switch (selectedLabel.kind) {
    case 'point': {
      const point = model.points[selectedLabel.id];
      const label = point?.label;
      if (!label) return null;
      const size = normalizeLabelFontSize(label.fontSize);
      if (label.fontSize !== size) {
        model.points[selectedLabel.id].label = { ...label, fontSize: size };
      }
      return size;
    }
    case 'line': {
      const line = model.lines[selectedLabel.id];
      const label = line?.label;
      if (!label) return null;
      const size = normalizeLabelFontSize(label.fontSize);
      if (label.fontSize !== size) {
        model.lines[selectedLabel.id].label = { ...label, fontSize: size };
      }
      return size;
    }
    case 'angle': {
      const angle = model.angles[selectedLabel.id];
      const label = angle?.label;
      if (!label) return null;
      const size = normalizeLabelFontSize(label.fontSize);
      if (label.fontSize !== size) {
        model.angles[selectedLabel.id].label = { ...label, fontSize: size };
      }
      return size;
    }
    case 'free': {
      const label = model.labels[selectedLabel.id];
      if (!label) return null;
      const size = normalizeLabelFontSize(label.fontSize);
      if (label.fontSize !== size) {
        model.labels[selectedLabel.id] = { ...label, fontSize: size };
      }
      return size;
    }
  }
}

function updateLabelFontControls() {
  const size = labelFontSizeForSelection();
  const display = size !== null ? `${size} px` : '—';
  if (labelFontSizeDisplay) labelFontSizeDisplay.textContent = display;
  const atMin = size !== null && size <= LABEL_FONT_MIN;
  const atMax = size !== null && size >= LABEL_FONT_MAX;
  const belowDefault = size !== null && size < LABEL_FONT_DEFAULT;
  const aboveDefault = size !== null && size > LABEL_FONT_DEFAULT;
  if (labelFontDecreaseBtn) {
    labelFontDecreaseBtn.disabled = size === null || atMin;
    labelFontDecreaseBtn.classList.toggle('limit', size !== null && atMin);
    labelFontDecreaseBtn.classList.toggle('active', belowDefault);
  }
  if (labelFontIncreaseBtn) {
    labelFontIncreaseBtn.disabled = size === null || atMax;
    labelFontIncreaseBtn.classList.toggle('limit', size !== null && atMax);
    labelFontIncreaseBtn.classList.toggle('active', aboveDefault);
  }
}

function adjustSelectedLabelFont(delta: number) {
  const activeLabel = selectedLabel;
  if (!activeLabel || delta === 0) {
    updateLabelFontControls();
    return;
  }
  let changed = false;
  const apply = <T extends { fontSize?: number }>(label: T, setter: (next: T) => void) => {
    const current = normalizeLabelFontSize(label.fontSize);
    const nextSize = clampLabelFontSize(current + delta);
    if (nextSize === current) return;
    setter({ ...label, fontSize: nextSize });
    changed = true;
  };
  switch (activeLabel.kind) {
    case 'point': {
      const point = model.points[activeLabel.id];
      if (point?.label) {
        apply(point.label, (next) => {
          model.points[activeLabel.id].label = next;
        });
      }
      break;
    }
    case 'line': {
      const line = model.lines[activeLabel.id];
      if (line?.label) {
        apply(line.label, (next) => {
          model.lines[activeLabel.id].label = next;
        });
      }
      break;
    }
    case 'angle': {
      const angle = model.angles[activeLabel.id];
      if (angle?.label) {
        apply(angle.label, (next) => {
          model.angles[activeLabel.id].label = next;
        });
      }
      break;
    }
    case 'free': {
      const freeLabel = model.labels[activeLabel.id];
      if (freeLabel) {
        apply(freeLabel, (next) => {
          model.labels[activeLabel.id] = next;
        });
      }
      break;
    }
  }
  updateLabelFontControls();
  if (changed) {
    draw();
    pushHistory();
  }
  updateLineWidthControls();
}

function updateLineWidthControls() {
  if (!styleWidthInput) return;
  const min = Number(styleWidthInput.min) || 0.1;
  const max = Number(styleWidthInput.max) || 50;
  const raw = Number(styleWidthInput.value);
  const current = clamp(Number.isFinite(raw) ? Math.round(raw * 10) / 10 : min, min, max);
  if (styleWidthInput.value !== String(current)) styleWidthInput.value = String(current);
  const disabled = styleWidthInput.disabled;
  if (lineWidthValueDisplay) {
    lineWidthValueDisplay.textContent = disabled ? '—' : `${current} px`;
  }
  const defaultWidth = styleTypeSelect?.disabled ? THEME.pointSize : THEME.lineWidth;
  if (lineWidthDecreaseBtn) {
    const atMin = current <= min;
    lineWidthDecreaseBtn.disabled = disabled || atMin;
    lineWidthDecreaseBtn.classList.toggle('limit', atMin);
    lineWidthDecreaseBtn.classList.toggle('active', !disabled && current < defaultWidth);
  }
  if (lineWidthIncreaseBtn) {
    const atMax = current >= max;
    lineWidthIncreaseBtn.disabled = disabled || atMax;
    lineWidthIncreaseBtn.classList.toggle('limit', atMax);
    lineWidthIncreaseBtn.classList.toggle('active', !disabled && current > defaultWidth);
  }
}

function adjustLineWidth(delta: number) {
  if (!styleWidthInput || delta === 0) {
    updateLineWidthControls();
    return;
  }
  if (styleWidthInput.disabled) {
    updateLineWidthControls();
    return;
  }
  const min = Number(styleWidthInput.min) || 0.1;
  const max = Number(styleWidthInput.max) || 50;
  const current = Number(styleWidthInput.value) || min;
  const step = 0.1;
  const next = clamp(Math.round((current + delta * step) * 10) / 10, min, max);
  if (next === current) {
    updateLineWidthControls();
    return;
  }
  styleWidthInput.value = String(next);
  applyStyleFromInputs();
  updateLineWidthControls();
}

function getTickStateForSelection(labelEditing: boolean): {
  available: boolean;
  state: TickLevel;
  mixed: boolean;
} {
  if (labelEditing) return { available: false, state: 0, mixed: false };
  if (selectedLineIndex !== null || selectedPolygonIndex !== null) {
    const lines = new Set<number>();
    if (selectedLineIndex !== null) lines.add(selectedLineIndex);
    if (selectedPolygonIndex !== null) {
      const poly = model.polygons[selectedPolygonIndex];
      poly?.lines.forEach((li) => lines.add(li));
    }
    const ticks: TickLevel[] = [];
    lines.forEach((lineIdx) => {
      const line = model.lines[lineIdx];
      if (!line) return;
      const segCount = Math.max(0, line.points.length - 1);
      ensureSegmentStylesForLine(lineIdx);
      const allSegments = selectedSegments.size === 0;
      for (let i = 0; i < segCount; i++) {
        const key = segmentKey(lineIdx, 'segment', i);
        if (!allSegments && !selectedSegments.has(key)) continue;
        const style = line.segmentStyles?.[i] ?? line.style;
        ticks.push(style.tick ?? 0);
      }
    });
    if (!ticks.length) return { available: true, state: 0, mixed: false };
    const first = ticks[0];
    const mixed = ticks.some((t) => t !== first);
    return { available: true, state: mixed ? 0 : first ?? 0, mixed };
  }
  if (selectedCircleIndex !== null) {
    const circleIdx = selectedCircleIndex;
    const arcs = circleArcs(circleIdx);
    ensureArcStyles(circleIdx, arcs.length);
    const circleStyle = model.circles[circleIdx]?.style;
    const ticks: TickLevel[] = [];
    arcs.forEach((arc, idx) => {
      const key = arcKey(circleIdx, idx);
      if (selectedArcSegments.size > 0 && !selectedArcSegments.has(key)) return;
      const baseTick = circleStyle?.tick ?? 0;
      ticks.push((arc.style.tick ?? baseTick) as TickLevel);
    });
    if (!ticks.length) return { available: true, state: 0, mixed: false };
    const first = ticks[0];
    const mixed = ticks.some((t) => t !== first);
    return { available: true, state: mixed ? 0 : first ?? 0, mixed };
  }
  return { available: false, state: 0, mixed: false };
}

function applyTickState(nextTick: TickLevel) {
  let changed = false;
  const applyToSegment = (lineIdx: number, segIdx: number, tick: TickLevel) => {
    const line = model.lines[lineIdx];
    if (!line) return;
    ensureSegmentStylesForLine(lineIdx);
    if (!line.segmentStyles) line.segmentStyles = [];
    const base = line.segmentStyles[segIdx] ?? line.style;
    line.segmentStyles[segIdx] = { ...base, tick };
    changed = true;
  };
  const applyToLine = (lineIdx: number, tick: TickLevel) => {
    const line = model.lines[lineIdx];
    if (!line) return;
    ensureSegmentStylesForLine(lineIdx);
    const segCount = Math.max(0, line.points.length - 1);
    if (!line.segmentStyles) line.segmentStyles = [];
    line.style = { ...line.style, tick };
    changed = true;
    for (let i = 0; i < segCount; i++) {
      applyToSegment(lineIdx, i, tick);
    }
    line.leftRay = line.leftRay ? { ...line.leftRay, tick } : line.leftRay;
    line.rightRay = line.rightRay ? { ...line.rightRay, tick } : line.rightRay;
  };
  const applyToArc = (circleIdx: number, arcIdx: number, tick: TickLevel) => {
    ensureArcStyles(circleIdx, circleArcs(circleIdx).length);
    const circle = model.circles[circleIdx];
    if (!circle.arcStyles) circle.arcStyles = [];
    const base = circle.arcStyles[arcIdx] ?? circle.style;
    circle.arcStyles[arcIdx] = { ...base, tick };
    changed = true;
  };
  const applyToCircle = (circleIdx: number, tick: TickLevel) => {
    const circle = model.circles[circleIdx];
    if (!circle) return;
    ensureArcStyles(circleIdx, circleArcs(circleIdx).length);
    circle.style = { ...circle.style, tick };
    if (!circle.arcStyles) circle.arcStyles = [];
    changed = true;
    for (let i = 0; i < circle.arcStyles.length; i++) {
      applyToArc(circleIdx, i, tick);
    }
  };

  if (selectedLineIndex !== null || selectedPolygonIndex !== null) {
    const lines = new Set<number>();
    if (selectedLineIndex !== null) lines.add(selectedLineIndex);
    if (selectedPolygonIndex !== null) {
      const poly = model.polygons[selectedPolygonIndex];
      poly?.lines.forEach((li) => lines.add(li));
    }
    lines.forEach((lineIdx) => {
      const line = model.lines[lineIdx];
      if (!line) return;
      const segCount = Math.max(0, line.points.length - 1);
      const specificSegments = selectedSegments.size > 0;
      if (!specificSegments) {
        applyToLine(lineIdx, nextTick);
        changed = true;
      } else {
        for (let i = 0; i < segCount; i++) {
          const key = segmentKey(lineIdx, 'segment', i);
          if (selectedSegments.has(key)) applyToSegment(lineIdx, i, nextTick);
        }
      }
    });
  } else if (selectedCircleIndex !== null) {
    const circleIdx = selectedCircleIndex;
    const arcs = circleArcs(circleIdx);
    const specificArcs = selectedArcSegments.size > 0;
    if (!specificArcs) {
      applyToCircle(circleIdx, nextTick);
      changed = true;
    } else {
      arcs.forEach((arc, idx) => {
        const key = arcKey(circleIdx, idx);
        if (selectedArcSegments.has(key)) applyToArc(circleIdx, idx, nextTick);
      });
    }
  }

  if (changed) {
    draw();
    pushHistory();
    updateStyleMenuValues();
  }
}

function cycleTickState() {
  const tickInfo = getTickStateForSelection(false);
  if (!tickInfo.available) return;
  const current = tickInfo.mixed ? 0 : tickInfo.state;
  const next = ((current + 1) % 4) as TickLevel;
  applyTickState(next);
}

function updateStyleMenuValues() {
  if (!styleColorInput || !styleWidthInput || !styleTypeSelect) return;
  const setRowVisible = (row: HTMLElement | null, visible: boolean) => {
    if (!row) return;
    row.style.display = visible ? 'flex' : 'none';
  };
  if (angleRadiusIncreaseBtn) {
    angleRadiusIncreaseBtn.disabled = true;
    angleRadiusIncreaseBtn.classList.remove('active');
    angleRadiusIncreaseBtn.classList.remove('limit');
  }
  if (angleRadiusDecreaseBtn) {
    angleRadiusDecreaseBtn.disabled = true;
    angleRadiusDecreaseBtn.classList.remove('active');
    angleRadiusDecreaseBtn.classList.remove('limit');
  }
  const labelEditing = selectedLabel !== null;
  const polygonLines =
    selectedPolygonIndex !== null ? model.polygons[selectedPolygonIndex]?.lines ?? [] : [];
  const lineIdxForStyle =
    selectedLineIndex !== null ? selectedLineIndex : polygonLines.length ? polygonLines[0] : null;
  const isPoint = selectedPointIndex !== null;
  const isLineLike = selectedLineIndex !== null || selectedPolygonIndex !== null;
  const preferPoints = selectionVertices && (!selectionEdges || selectedSegments.size > 0);
  if (labelTextRow) labelTextRow.style.display = labelEditing ? 'flex' : 'none';
  if (labelFontRow) labelFontRow.style.display = labelEditing ? 'flex' : 'none';
  refreshLabelKeyboard(labelEditing);
  updateLabelFontControls();

  if (labelEditing && selectedLabel) {
    let labelColor = styleColorInput.value;
    let text = '';
    switch (selectedLabel.kind) {
      case 'point':
        labelColor = model.points[selectedLabel.id]?.label?.color ?? labelColor;
        text = model.points[selectedLabel.id]?.label?.text ?? '';
        break;
      case 'line':
        labelColor = model.lines[selectedLabel.id]?.label?.color ?? labelColor;
        text = model.lines[selectedLabel.id]?.label?.text ?? '';
        break;
      case 'angle':
        labelColor = model.angles[selectedLabel.id]?.label?.color ?? labelColor;
        text = model.angles[selectedLabel.id]?.label?.text ?? '';
        break;
      case 'free':
        labelColor = model.labels[selectedLabel.id]?.color ?? labelColor;
        text = model.labels[selectedLabel.id]?.text ?? '';
        break;
    }
    styleColorInput.value = labelColor;
    if (labelTextInput) labelTextInput.value = text;
    styleWidthInput.disabled = true;
    styleTypeSelect.disabled = true;
  } else if (lineIdxForStyle !== null) {
    const line = model.lines[lineIdxForStyle];
    const style = line.segmentStyles?.[0] ?? line.style;
    if (preferPoints) {
      const ptIdx = line.points[0];
      const pt = ptIdx !== undefined ? model.points[ptIdx] : null;
      const base = pt ?? { style: { color: style.color, size: THEME.pointSize } as PointStyle };
      styleColorInput.value = base.style.color;
      styleWidthInput.value = String(base.style.size);
      styleTypeSelect.value = 'solid';
      styleWidthInput.disabled = false;
      styleTypeSelect.disabled = true;
    } else {
      styleColorInput.value = style.color;
      styleWidthInput.value = String(style.width);
      styleTypeSelect.value = style.type;
      styleWidthInput.disabled = false;
      styleTypeSelect.disabled = false;
    }
  } else if (selectedCircleIndex !== null) {
    const c = model.circles[selectedCircleIndex];
    const arcs = circleArcs(selectedCircleIndex);
    const style =
      selectedArcSegments.size > 0
        ? (() => {
            const key = Array.from(selectedArcSegments)[0];
            const parsed = parseArcKey(key);
            if (parsed && parsed.circle === selectedCircleIndex && arcs[parsed.arcIdx]) {
              return arcs[parsed.arcIdx].style;
            }
            return c.style;
          })()
        : c.style;
    styleColorInput.value = style.color;
    styleWidthInput.value = String(style.width);
    styleTypeSelect.value = style.type;
    styleWidthInput.disabled = false;
    styleTypeSelect.disabled = false;
  } else if (selectedAngleIndex !== null) {
    const ang = model.angles[selectedAngleIndex];
    const style = ang.style;
    styleColorInput.value = style.color;
    styleWidthInput.value = String(style.width);
    styleTypeSelect.value = style.type;
    styleWidthInput.disabled = false;
    styleTypeSelect.disabled = false;
    arcCountButtons.forEach((btn) => {
      const count = Number(btn.dataset.count) || 1;
      btn.classList.toggle('active', count === (style.arcCount ?? 1));
    });
    if (rightAngleBtn) {
      rightAngleBtn.classList.toggle('active', !!style.right);
      if (style.right) arcCountButtons.forEach((b) => b.classList.remove('active'));
    }
    if (exteriorAngleBtn) {
      exteriorAngleBtn.classList.toggle('active', !!style.exterior);
      exteriorAngleBtn.setAttribute('aria-pressed', style.exterior ? 'true' : 'false');
    }
    const baseGeom = angleBaseGeometry(ang);
    const actualGeom = angleGeometry(ang);
    const offset = style.arcRadiusOffset ?? 0;
    const hasRadius = !!(baseGeom && actualGeom);
    let atMin = false;
    let atMax = false;
    if (baseGeom && actualGeom) {
      atMin = actualGeom.radius <= baseGeom.minRadius + ANGLE_RADIUS_EPSILON;
      atMax = actualGeom.radius >= baseGeom.maxRadius - ANGLE_RADIUS_EPSILON;
    }
    if (angleRadiusIncreaseBtn) {
      angleRadiusIncreaseBtn.disabled = !hasRadius || atMax;
      angleRadiusIncreaseBtn.classList.toggle('active', offset > 0);
      angleRadiusIncreaseBtn.classList.toggle('limit', hasRadius && atMax);
    }
    if (angleRadiusDecreaseBtn) {
      angleRadiusDecreaseBtn.disabled = !hasRadius || atMin;
      angleRadiusDecreaseBtn.classList.toggle('active', offset < 0);
      angleRadiusDecreaseBtn.classList.toggle('limit', hasRadius && atMin);
    }
  } else if (selectedPointIndex !== null) {
    const pt = model.points[selectedPointIndex];
    styleColorInput.value = pt.style.color;
    styleWidthInput.value = String(pt.style.size);
    styleTypeSelect.value = 'solid';
    styleWidthInput.disabled = false;
    styleTypeSelect.disabled = true;
  } else if (selectedInkStrokeIndex !== null) {
    const stroke = model.inkStrokes[selectedInkStrokeIndex];
    if (stroke) {
      styleColorInput.value = stroke.color;
      styleWidthInput.value = String(stroke.baseWidth);
      styleTypeSelect.value = 'solid';
      styleWidthInput.disabled = false;
      styleTypeSelect.disabled = true;
    }
  } else if (preferPoints && selectedLineIndex !== null) {
    const line = model.lines[selectedLineIndex];
    const firstPt = line?.points[0];
    const pt = firstPt !== undefined ? model.points[firstPt] : null;
    const base = pt ?? { style: { color: styleColorInput.value, size: THEME.pointSize } as PointStyle };
    styleColorInput.value = base.style.color;
    styleWidthInput.value = String(base.style.size);
    styleTypeSelect.value = 'solid';
    styleWidthInput.disabled = false;
    styleTypeSelect.disabled = true;
  } else if (preferPoints && selectedPolygonIndex !== null) {
    const verts = polygonVerticesOrdered(selectedPolygonIndex);
    const firstPt = verts[0] !== undefined ? model.points[verts[0]] : null;
    const base = firstPt ?? { style: { color: styleColorInput.value, size: THEME.pointSize } as PointStyle };
    styleColorInput.value = base.style.color;
    styleWidthInput.value = String(base.style.size);
    styleTypeSelect.value = 'solid';
    styleWidthInput.disabled = false;
    styleTypeSelect.disabled = true;
  }
  updateLineWidthControls();
  const showTypeGroup = !isPoint && !labelEditing && selectedInkStrokeIndex === null && mode !== 'handwriting';
  if (styleTypeInline) {
    styleTypeInline.style.display = showTypeGroup ? 'inline-flex' : 'none';
    setRowVisible(styleTypeRow, false);
  } else {
    setRowVisible(styleTypeRow, showTypeGroup);
  }
  if (styleTypeGap) styleTypeGap.style.display = showTypeGroup ? 'flex' : 'none';
  const showRays = selectedLineIndex !== null && !labelEditing;
  if (styleRayGroup) styleRayGroup.style.display = showRays ? 'flex' : 'none';
  const tickInfo = getTickStateForSelection(labelEditing);
  const tickVisible = tickInfo.available && !labelEditing;
  if (styleTickGroup) styleTickGroup.style.display = tickVisible ? 'flex' : 'none';
  if (styleTickButton) {
    styleTickButton.disabled = !tickVisible;
    const iconState = (tickInfo.mixed || tickInfo.state === 0 ? 1 : tickInfo.state) as 1 | 2 | 3;
    const iconMarkup = iconState === 3 ? ICONS.tick3 : iconState === 2 ? ICONS.tick2 : ICONS.tick1;
    styleTickButton.innerHTML = iconMarkup;
    styleTickButton.classList.toggle('active', tickInfo.state > 0 && !tickInfo.mixed);
    styleTickButton.classList.toggle('mixed', tickInfo.mixed);
    styleTickButton.setAttribute('aria-pressed', tickInfo.state > 0 && !tickInfo.mixed ? 'true' : 'false');
    styleTickButton.dataset.tickState = tickInfo.mixed ? 'mixed' : String(tickInfo.state);
    const tickTitle = tickInfo.mixed
      ? 'Znacznik zgodności: różne'
      : tickInfo.state === 0
      ? 'Znacznik zgodności: brak'
      : tickInfo.state === 1
      ? 'Znacznik zgodności: pojedynczy'
      : tickInfo.state === 2
      ? 'Znacznik zgodności: podwójny'
      : 'Znacznik zgodności: potrójny';
    styleTickButton.title = tickTitle;
    styleTickButton.setAttribute('aria-label', tickTitle);
  }
  setRowVisible(styleArcRow, selectedAngleIndex !== null && !labelEditing);
  setRowVisible(styleHideRow, !labelEditing);
  setRowVisible(styleEdgesRow, isLineLike && !labelEditing);
  const styleCircleRow = document.getElementById('styleCircleRow');
  setRowVisible(styleCircleRow, selectedCircleIndex !== null && !labelEditing);
  setRowVisible(styleColorRow, true);
  setRowVisible(styleWidthRow, !labelEditing);
  // Show/hide exterior angle button
  if (exteriorAngleBtn) {
    exteriorAngleBtn.style.display = selectedAngleIndex !== null && !labelEditing ? '' : 'none';
  }
  // sync toggles
  const typeVal = styleTypeSelect?.value;
  styleTypeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === typeVal);
  });
  const viewVerticesBtn = document.getElementById('viewVerticesOption');
  const viewEdgesBtn = document.getElementById('viewEdgesOption');
  if (viewVerticesBtn && viewEdgesBtn) {
    const mode = getViewModeState();
    const verticesActive = mode === 'vertices' || mode === 'both';
    const edgesActive = mode === 'edges' || mode === 'both';
    viewVerticesBtn.classList.toggle('active', verticesActive);
    viewEdgesBtn.classList.toggle('active', edgesActive);
  }
  const viewCirclePointsBtn = document.getElementById('viewCirclePointsOption');
  const viewCircleLineBtn = document.getElementById('viewCircleLineOption');
  if (viewCirclePointsBtn && viewCircleLineBtn) {
    const mode = getViewModeState();
    const verticesActive = mode === 'vertices' || mode === 'both';
    const edgesActive = mode === 'edges' || mode === 'both';
    viewCirclePointsBtn.classList.toggle('active', verticesActive);
    viewCircleLineBtn.classList.toggle('active', edgesActive);
  }
  if (selectedLineIndex !== null && raySegmentBtn && rayLeftBtn && rayRightBtn) {
    const line = model.lines[selectedLineIndex];
    const leftOn = !!line.leftRay && !line.leftRay.hidden;
    const rightOn = !!line.rightRay && !line.rightRay.hidden;
    const segmentOn = !leftOn && !rightOn;
    raySegmentBtn.classList.toggle('active', segmentOn);
    rayLeftBtn.classList.toggle('active', leftOn);
    rayRightBtn.classList.toggle('active', rightOn);
  }
  updateColorButtons();
}

function setTheme(theme: ThemeName) {
  currentTheme = theme;
  const body = document.body;
  const root = document.documentElement;
  body?.classList.remove('theme-dark', 'theme-light');
  root?.classList.remove('theme-dark', 'theme-light');
  applyThemeWithOverrides(theme);
  const palette = THEME.palette;
  if (theme === 'light') {
    body?.classList.add('theme-light');
    root?.classList.add('theme-light');
  } else {
    body?.classList.add('theme-dark');
    root?.classList.add('theme-dark');
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage failures
    }
  }
  HIGHLIGHT_LINE.color = THEME.highlight;
  HIGHLIGHT_LINE.width = THEME.highlightWidth;
  if (strokeColorInput) strokeColorInput.value = palette[0] ?? THEME.defaultStroke;
  if (styleWidthInput) styleWidthInput.value = String(THEME.lineWidth);
  recentColors = palette.length ? [palette[0]] : [THEME.defaultStroke];
  updateOptionButtons();
  updateColorButtons();
  draw();
}

function applyStyleFromInputs() {
  if (!styleColorInput || !styleWidthInput || !styleTypeSelect) return;
  const color = styleColorInput.value;
  rememberColor(color);
  const width = Number(styleWidthInput.value) || 1;
  const type = styleTypeSelect.value as StrokeStyle['type'];
  let changed = false;
  const applyPointStyle = (pointIdx: number) => {
    const pt = model.points[pointIdx];
    if (!pt) return;
    model.points[pointIdx] = { ...pt, style: { ...pt.style, color, size: width } };
    changed = true;
  };
  const applyPointsForLine = (lineIdx: number) => {
    if (!selectionVertices) return;
    const line = model.lines[lineIdx];
    if (!line) return;
    const seen = new Set<number>();
    line.points.forEach((pi) => {
      if (seen.has(pi)) return;
      seen.add(pi);
      applyPointStyle(pi);
    });
  };
  const applyPointsForPolygon = (polyIdx: number) => {
    if (!selectionVertices) return;
    const poly = model.polygons[polyIdx];
    if (!poly) return;
    const seen = new Set<number>();
    poly.lines.forEach((li) => {
      const line = model.lines[li];
      line?.points.forEach((pi) => {
        if (seen.has(pi)) return;
        seen.add(pi);
        applyPointStyle(pi);
      });
    });
  };
  if (selectedLabel) {
    switch (selectedLabel.kind) {
      case 'point':
        if (model.points[selectedLabel.id]?.label) {
          model.points[selectedLabel.id].label = { ...model.points[selectedLabel.id].label!, color };
          changed = true;
        }
        break;
      case 'line':
        if (model.lines[selectedLabel.id]?.label) {
          model.lines[selectedLabel.id].label = { ...model.lines[selectedLabel.id].label!, color };
          changed = true;
        }
        break;
      case 'angle':
        if (model.angles[selectedLabel.id]?.label) {
          model.angles[selectedLabel.id].label = { ...model.angles[selectedLabel.id].label!, color };
          changed = true;
        }
        break;
      case 'free':
        if (model.labels[selectedLabel.id]) {
          model.labels[selectedLabel.id] = { ...model.labels[selectedLabel.id], color };
          changed = true;
        }
        break;
    }
    if (changed) {
      draw();
      pushHistory();
    }
    return;
  }
  const applyStyleToLine = (lineIdx: number) => {
    const canStyleLine = selectionEdges || selectedSegments.size > 0;
    if (!canStyleLine) return;
    ensureSegmentStylesForLine(lineIdx);
    const line = model.lines[lineIdx];
    const segCount = Math.max(0, line.points.length - 1);
    if (!line.segmentStyles || line.segmentStyles.length !== segCount) {
      line.segmentStyles = Array.from({ length: segCount }, () => ({ ...line.style }));
    }
    const updateSegment = (segIdx: number) => {
      if (!line.segmentStyles) line.segmentStyles = [];
      line.segmentStyles[segIdx] = { ...(line.segmentStyles[segIdx] ?? line.style), color, width, type };
      changed = true;
    };
    const updateRay = (side: 'left' | 'right') => {
      const src = side === 'left' ? line.leftRay : line.rightRay;
      const updated = { ...(src ?? line.style), color, width, type };
      if (side === 'left') line.leftRay = updated;
      else line.rightRay = updated;
      changed = true;
    };

    if (selectedSegments.size > 0) {
      selectedSegments.forEach((key) => {
        const parsed = parseSegmentKey(key);
        if (!parsed || parsed.line !== lineIdx) return;
        if (parsed.part === 'segment' && parsed.seg !== undefined) {
          updateSegment(parsed.seg);
        } else if (parsed.part === 'rayLeft') {
          updateRay('left');
        } else if (parsed.part === 'rayRight') {
          updateRay('right');
        }
      });
    } else {
      line.style = { ...line.style, color, width, type };
      for (let i = 0; i < segCount; i++) {
        updateSegment(i);
      }
      if (line.leftRay) line.leftRay = { ...line.leftRay, color, width, type };
      if (line.rightRay) line.rightRay = { ...line.rightRay, color, width, type };
    }
  };
  if (selectedLineIndex !== null || selectedPolygonIndex !== null) {
    if (selectedPolygonIndex !== null) {
      const poly = model.polygons[selectedPolygonIndex];
      poly?.lines.forEach((li) => {
        applyStyleToLine(li);
        applyPointsForLine(li);
      });
      if (poly) applyPointsForPolygon(selectedPolygonIndex);
    }
    if (selectedLineIndex !== null) {
      applyStyleToLine(selectedLineIndex);
      applyPointsForLine(selectedLineIndex);
    }
  } else if (selectedCircleIndex !== null) {
    const c = model.circles[selectedCircleIndex];
    const arcs = circleArcs(selectedCircleIndex);
    const segCount = arcs.length;
    ensureArcStyles(selectedCircleIndex, segCount);
    const applyArc = (arcIdx: number) => {
      if (!c.arcStyles) c.arcStyles = Array.from({ length: segCount }, () => ({ ...c.style }));
      c.arcStyles[arcIdx] = { ...(c.arcStyles[arcIdx] ?? c.style), color, width, type };
      changed = true;
    };
    if (selectedArcSegments.size > 0) {
      selectedArcSegments.forEach((key) => {
        const parsed = parseArcKey(key);
        if (!parsed || parsed.circle !== selectedCircleIndex) return;
        if (parsed.arcIdx >= 0 && parsed.arcIdx < segCount) applyArc(parsed.arcIdx);
      });
    } else {
      c.style = { ...c.style, color, width, type };
      changed = true;
      for (let i = 0; i < segCount; i++) applyArc(i);
    }
  } else if (selectedAngleIndex !== null) {
    const ang = model.angles[selectedAngleIndex];
    const arcBtn = arcCountButtons.find((b) => b.classList.contains('active'));
    const arcCount = arcBtn ? Number(arcBtn.dataset.count) || 1 : ang.style.arcCount ?? 1;
    const right = rightAngleBtn ? rightAngleBtn.classList.contains('active') : false;
    model.angles[selectedAngleIndex] = { ...ang, style: { ...ang.style, color, width, type, arcCount, right } };
    changed = true;
  } else if (selectedPointIndex !== null) {
    const pt = model.points[selectedPointIndex];
    model.points[selectedPointIndex] = { ...pt, style: { ...pt.style, color, size: width } };
    changed = true;
  } else if (selectedInkStrokeIndex !== null) {
    const stroke = model.inkStrokes[selectedInkStrokeIndex];
    if (stroke) {
      model.inkStrokes[selectedInkStrokeIndex] = { ...stroke, color, baseWidth: width };
      changed = true;
    }
  }
  else if (!changed && mode === 'handwriting') {
    // Update default handwriting style for new strokes
    inkBaseWidth = width;
    // color is already taken from styleColorInput via currentInkColor()
  }
  if (changed) {
    draw();
    pushHistory();
  }
}

function addCircleWithCenter(centerIdx: number, radius: number, points: number[]) {
  const style = currentStrokeStyle();
  const center = model.points[centerIdx];
  const id = nextId('circle', model);
  if (!center) return -1;
  const assignedPoints = points.length ? [...points] : [addPoint(model, { x: center.x + radius, y: center.y, style: currentPointStyle() })];
  const adjustedPoints: number[] = [];
  assignedPoints.forEach((pid, i) => {
    const pt = model.points[pid];
    if (!pt) return;
    const angle = Math.atan2(pt.y - center.y, pt.x - center.x);
    const safeAngle = Number.isFinite(angle) ? angle : i * (Math.PI / 4);
    const pos = { x: center.x + Math.cos(safeAngle) * radius, y: center.y + Math.sin(safeAngle) * radius };
    model.points[pid] = { ...pt, ...pos };
    if (i > 0) adjustedPoints.push(pid);
  });
  const radiusPointIdx = assignedPoints[0];
  if (!Number.isFinite(radius) || radius < 1e-6) return -1;
  const circle: CircleWithCenter = {
    object_type: 'circle',
    id,
    center: centerIdx,
    radius_point: radiusPointIdx,
    points: adjustedPoints,
    style,
    circle_kind: 'center-radius',
    construction_kind: 'free',
    defining_parents: [],
    children: [],
    recompute: () => {},
    on_parent_deleted: () => {}
  };
  const circleIdx = model.circles.length;
  model.circles.push(circle);
  registerIndex(model, 'circle', id, circleIdx);
  // Don't change construction_kind of existing free points - they define the circle, but aren't constrained by it
  // Only mark additional points as on_object
  adjustedPoints.forEach((pid) => applyPointConstruction(pid, [{ kind: 'circle', id }]));
  return circleIdx;
}

function addCircleThroughPoints(definingPoints: [number, number, number]): number | null {
  const unique = Array.from(new Set(definingPoints));
  if (unique.length !== 3) return null;
  const [aIdx, bIdx, cIdx] = unique as [number, number, number];
  const a = model.points[aIdx];
  const b = model.points[bIdx];
  const c = model.points[cIdx];
  if (!a || !b || !c) return null;
  const centerPos = circleFromThree(a, b, c);
  if (!centerPos) return null;
  const centerIdx = addPoint(model, { ...centerPos, style: currentPointStyle() });
  const radius = Math.hypot(centerPos.x - a.x, centerPos.y - a.y);
  if (!Number.isFinite(radius) || radius < 1e-6) {
    removePointsKeepingOrder([centerIdx]);
    return null;
  }
  const style = currentStrokeStyle();
  const id = nextId('circle', model);
  const circle: CircleThroughPoints = {
    object_type: 'circle',
    id,
    center: centerIdx,
    radius_point: aIdx,
    points: [],
    style,
    circle_kind: 'three-point',
    defining_points: [aIdx, bIdx, cIdx],
    construction_kind: 'free',
    defining_parents: [],
    children: [],
    recompute: () => {},
    on_parent_deleted: () => {}
  };
  const circleIdx = model.circles.length;
  model.circles.push(circle);
  registerIndex(model, 'circle', id, circleIdx);
  return circleIdx;
}

function recomputeCircleThroughPoints(circleIdx: number) {
  const circle = model.circles[circleIdx];
  if (!circle || !isCircleThroughPoints(circle)) return;
  const [aIdx, bIdx, cIdx] = circle.defining_points;
  const a = model.points[aIdx];
  const b = model.points[bIdx];
  const c = model.points[cIdx];
  if (!a || !b || !c) return;
  const centerPos = circleFromThree(a, b, c);
  if (!centerPos) return;
  const newRadius = Math.hypot(centerPos.x - a.x, centerPos.y - a.y);
  if (!Number.isFinite(newRadius) || newRadius < 1e-6) return;
  const centerPoint = model.points[circle.center];
  if (centerPoint) {
    model.points[circle.center] = { ...centerPoint, x: centerPos.x, y: centerPos.y };
    updateMidpointsForPoint(circle.center);
  }
  circle.points.forEach((pid) => {
    if (circleHasDefiningPoint(circle, pid)) return;
    const pt = model.points[pid];
    if (!pt) return;
    const angle = Math.atan2(pt.y - centerPos.y, pt.x - centerPos.x);
    if (!Number.isFinite(angle)) return;
    const projected = {
      x: centerPos.x + Math.cos(angle) * newRadius,
      y: centerPos.y + Math.sin(angle) * newRadius
    };
    model.points[pid] = { ...pt, ...projected };
    updateMidpointsForPoint(pid);
  });
  updateIntersectionsForCircle(circleIdx);
}

function updateCirclesForPoint(pointIdx: number) {
  const handled = new Set<number>();
  model.circles.forEach((circle, ci) => {
    if (!isCircleThroughPoints(circle)) return;
    if (!circle.defining_points.includes(pointIdx)) return;
    if (handled.has(ci)) return;
    handled.add(ci);
    recomputeCircleThroughPoints(ci);
  });
  updateMidpointsForPoint(pointIdx);
}

function recomputeMidpoint(pointIdx: number) {
  const point = model.points[pointIdx];
  if (!isMidpointPoint(point)) return;
  const [parentAId, parentBId] = point.midpoint.parents;
  const parentAIdx = pointIndexById(parentAId);
  const parentBIdx = pointIndexById(parentBId);
  if (parentAIdx === null || parentBIdx === null) return;
  const parentA = model.points[parentAIdx];
  const parentB = model.points[parentBIdx];
  if (!parentA || !parentB) return;
  let target = {
    x: (parentA.x + parentB.x) / 2,
    y: (parentA.y + parentB.y) / 2
  };
  const parentLineId = point.midpoint.parentLineId;
  if (parentLineId) {
    const lineIdx = lineIndexById(parentLineId);
    if (lineIdx !== null) {
      target = constrainToLineIdx(lineIdx, target);
    }
  }
  const constrained = constrainToCircles(pointIdx, target);
  model.points[pointIdx] = { ...point, ...constrained };
  updateMidpointsForPoint(pointIdx);
}

function reflectPointAcrossLine(source: { x: number; y: number }, line: Line): { x: number; y: number } | null {
  if (!line || line.points.length < 2) return null;
  const a = model.points[line.points[0]];
  const b = model.points[line.points[line.points.length - 1]];
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-9) return null;
  const t = ((source.x - a.x) * dx + (source.y - a.y) * dy) / lenSq;
  const proj = { x: a.x + dx * t, y: a.y + dy * t };
  return { x: 2 * proj.x - source.x, y: 2 * proj.y - source.y };
}

function recomputeSymmetricPoint(pointIdx: number) {
  const point = model.points[pointIdx];
  if (!isSymmetricPoint(point)) return;
  const sourceIdx = pointIndexById(point.symmetric.source);
  if (sourceIdx === null) return;
  const source = model.points[sourceIdx];
  if (!source) return;
  let target: { x: number; y: number } | null = null;
  if (point.symmetric.mirror.kind === 'point') {
    const mirrorIdx = pointIndexById(point.symmetric.mirror.id);
    if (mirrorIdx === null) return;
    const mirror = model.points[mirrorIdx];
    if (!mirror) return;
    target = { x: mirror.x * 2 - source.x, y: mirror.y * 2 - source.y };
  } else {
    const lineIdx = lineIndexById(point.symmetric.mirror.id);
    if (lineIdx === null) return;
    const line = model.lines[lineIdx];
    if (!line) return;
    target = reflectPointAcrossLine(source, line);
  }
  if (!target) return;
  const constrained = constrainToCircles(pointIdx, target);
  model.points[pointIdx] = { ...point, ...constrained };
  updateMidpointsForPoint(pointIdx);
}

function updateSymmetricPointsForLine(lineIdx: number) {
  const line = model.lines[lineIdx];
  if (!line) return;
  const lineId = line.id;
  model.points.forEach((pt, idx) => {
    if (isSymmetricPoint(pt) && pt.symmetric.mirror.kind === 'line' && pt.symmetric.mirror.id === lineId) {
      recomputeSymmetricPoint(idx);
    }
  });
}

function updateParallelLinesForPoint(pointIdx: number) {
  const point = model.points[pointIdx];
  if (!point) return;
  const pid = point.id;
  model.lines.forEach((line, li) => {
    if (!isParallelLine(line)) return;
    if (line.parallel.throughPoint === pid || line.parallel.helperPoint === pid) {
      recomputeParallelLine(li);
    }
  });
}

function updateParallelLinesForLine(lineIdx: number) {
  const line = model.lines[lineIdx];
  if (!line) return;
  const lineId = line.id;
  model.lines.forEach((other, idx) => {
    if (idx === lineIdx) return;
    if (isParallelLine(other) && other.parallel.referenceLine === lineId) {
      recomputeParallelLine(idx);
    }
  });
}

function updatePerpendicularLinesForPoint(pointIdx: number) {
  const point = model.points[pointIdx];
  if (!point) return;
  const pid = point.id;
  model.lines.forEach((line, li) => {
    if (!isPerpendicularLine(line)) return;
    if (line.perpendicular.throughPoint === pid || line.perpendicular.helperPoint === pid) {
      recomputePerpendicularLine(li);
    }
  });
}

function updatePerpendicularLinesForLine(lineIdx: number) {
  const line = model.lines[lineIdx];
  if (!line) return;
  const lineId = line.id;
  model.lines.forEach((other, idx) => {
    if (idx === lineIdx) return;
    if (isPerpendicularLine(other) && other.perpendicular.referenceLine === lineId) {
      recomputePerpendicularLine(idx);
    }
  });
}

function updateMidpointsForPoint(parentIdx: number) {
  const parent = model.points[parentIdx];
  if (!parent) return;
  const parentId = parent.id;
  model.points.forEach((pt, idx) => {
    if (isMidpointPoint(pt)) {
      if (pt.midpoint.parents[0] === parentId || pt.midpoint.parents[1] === parentId) {
        recomputeMidpoint(idx);
      }
    }
    if (isSymmetricPoint(pt)) {
      const meta = pt.symmetric;
      if (meta.source === parentId || (meta.mirror.kind === 'point' && meta.mirror.id === parentId)) {
        recomputeSymmetricPoint(idx);
      }
    }
  });
  updateParallelLinesForPoint(parentIdx);
  updatePerpendicularLinesForPoint(parentIdx);
}

function findCircles(
  p: { x: number; y: number },
  tolerance = currentHitRadius(),
  includeInterior = true
): CircleHit[] {
  const hits: CircleHit[] = [];
  for (let i = model.circles.length - 1; i >= 0; i--) {
    const c = model.circles[i];
    if (c.hidden && !showHidden) continue;
    const center = model.points[c.center];
    if (!center) continue;
    const radius = circleRadius(c);
    if (radius <= 0) continue;
    const dist = Math.hypot(center.x - p.x, center.y - p.y);
    if (Math.abs(dist - radius) <= tolerance || (includeInterior && dist <= radius)) {
      hits.push({ circle: i });
    }
  }
  return hits;
}

function findCircle(
  p: { x: number; y: number },
  tolerance = currentHitRadius(),
  includeInterior = true
): CircleHit | null {
  const hits = findCircles(p, tolerance, includeInterior);
  return hits.length ? hits[0] : null;
}

function createOffsetLineThroughPoint(kind: 'parallel' | 'perpendicular', pointIdx: number, baseLineIdx: number) {
  if (kind === 'parallel') {
    return createParallelLineThroughPoint(pointIdx, baseLineIdx);
  }
  if (kind === 'perpendicular') {
    return createPerpendicularLineThroughPoint(pointIdx, baseLineIdx);
  }
  return null;
}

function primaryLineDirection(line: Line): { dir: { x: number; y: number }; length: number } | null {
  const candidateIdxs = [...line.defining_points, ...line.points];
  const seen = new Set<number>();
  let origin: Point | null = null;
  for (const idx of candidateIdxs) {
    if (idx === undefined) continue;
    if (seen.has(idx)) continue;
    seen.add(idx);
    const pt = model.points[idx];
    if (!pt) continue;
    if (!origin) {
      origin = pt;
      continue;
    }
    const dx = pt.x - origin.x;
    const dy = pt.y - origin.y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-6) {
      return { dir: { x: dx / len, y: dy / len }, length: len };
    }
  }
  return null;
}

function createParallelLineThroughPoint(pointIdx: number, baseLineIdx: number): number | null {
  const anchor = model.points[pointIdx];
  const baseLine = model.lines[baseLineIdx];
  if (!anchor || !baseLine) return null;
  if (!baseLine.id || !anchor.id) return null;
  const dirInfo = primaryLineDirection(baseLine);
  if (!dirInfo) return null;
  const baseLength = lineLength(baseLineIdx) ?? dirInfo.length;
  const helperDistance = baseLength > 1e-6 ? baseLength : 120;
  const helperPos = {
    x: anchor.x + dirInfo.dir.x * helperDistance,
    y: anchor.y + dirInfo.dir.y * helperDistance
  };
  const helperIdx = addPoint(model, {
    ...helperPos,
    style: { color: anchor.style.color, size: anchor.style.size },
    construction_kind: 'free'
  });
  const helperPoint = model.points[helperIdx];
  if (!helperPoint) return null;
  const baseStroke = baseLine.segmentStyles?.[0] ?? baseLine.style;
  const style: StrokeStyle = { ...baseStroke, hidden: false };
  const id = nextId('line', model);
  const meta: ParallelLineMeta = {
    throughPoint: anchor.id,
    referenceLine: baseLine.id,
    helperPoint: helperPoint.id
  };
  const parallelLine: ParallelLine = {
    object_type: 'line',
    id,
    points: [pointIdx, helperIdx],
    defining_points: [pointIdx, helperIdx],
    segmentStyles: [{ ...style }],
    segmentKeys: [segmentKeyForPoints(pointIdx, helperIdx)],
    leftRay: baseLine.leftRay ? { ...baseLine.leftRay } : { ...style, hidden: true },
    rightRay: baseLine.rightRay ? { ...baseLine.rightRay } : { ...style, hidden: true },
    style,
    hidden: false,
    construction_kind: 'parallel',
    defining_parents: [anchor.id, baseLine.id],
    children: [],
    parallel: meta,
    recompute: () => {},
    on_parent_deleted: () => {}
  };
  model.lines.push(parallelLine);
  const lineIdx = model.lines.length - 1;
  registerIndex(model, 'line', id, lineIdx);
  model.lines[lineIdx] = {
    ...parallelLine,
    recompute: () => recomputeParallelLine(lineIdx)
  } as ParallelLine;
  model.points[helperIdx] = { ...helperPoint, parallel_helper_for: id };
  applyPointConstruction(helperIdx, [{ kind: 'line', id }]);
  recomputeParallelLine(lineIdx);
  ensureSegmentStylesForLine(lineIdx);
  updateIntersectionsForLine(lineIdx);
  updateMidpointsForPoint(helperIdx);
  return lineIdx;
}

function createPerpendicularLineThroughPoint(pointIdx: number, baseLineIdx: number): number | null {
  const anchor = model.points[pointIdx];
  const baseLine = model.lines[baseLineIdx];
  if (!anchor || !baseLine) return null;
  if (!baseLine.id || !anchor.id) return null;
  const dirInfo = primaryLineDirection(baseLine);
  if (!dirInfo) return null;
  const baseLength = lineLength(baseLineIdx) ?? dirInfo.length;
  const baseNormal = { x: -dirInfo.dir.y, y: dirInfo.dir.x };
  const baseFirstIdx = baseLine.points[0];
  const baseLastIdx = baseLine.points[baseLine.points.length - 1];
  const baseFirst = baseFirstIdx !== undefined ? model.points[baseFirstIdx] : null;
  const baseLast = baseLastIdx !== undefined ? model.points[baseLastIdx] : null;
  const ON_LINE_EPS = 1e-3;
  let helperMode: 'projection' | 'normal' = 'normal';
  let helperPos: { x: number; y: number } | null = null;
  if (baseFirst && baseLast) {
    const anchorVec = { x: anchor.x - baseFirst.x, y: anchor.y - baseFirst.y };
    const signedDistance = anchorVec.x * baseNormal.x + anchorVec.y * baseNormal.y;
    const anchorOnBase = Math.abs(signedDistance) <= ON_LINE_EPS;
    if (!anchorOnBase) {
      const projected = projectPointOnLine(anchor, baseFirst, baseLast);
      const projDist = Math.hypot(projected.x - anchor.x, projected.y - anchor.y);
      if (projDist >= ON_LINE_EPS) {
        helperMode = 'projection';
        helperPos = projected;
      }
    }
  }
  const normalA = { x: -dirInfo.dir.y, y: dirInfo.dir.x };
  if (!helperPos) {
    const reflected = reflectPointAcrossLine(anchor, baseLine);
    helperPos = reflected;
    if (!helperPos || Math.hypot(helperPos.x - anchor.x, helperPos.y - anchor.y) < ON_LINE_EPS) {
      const fallback = baseLength > 1e-3 ? baseLength : 120;
      helperPos = {
        x: anchor.x + normalA.x * fallback,
        y: anchor.y + normalA.y * fallback
      };
      helperMode = 'normal';
    }
  }
  const helperIdx = addPoint(model, {
    ...helperPos,
    style: { color: anchor.style.color, size: anchor.style.size },
    construction_kind: 'free'
  });
  if (helperMode === 'projection') {
    insertPointIntoLine(baseLineIdx, helperIdx, helperPos);
  }
  let helperPoint = model.points[helperIdx];
  if (!helperPoint) return null;
  const helperVector = { x: helperPoint.x - anchor.x, y: helperPoint.y - anchor.y };
  let helperDistance = Math.hypot(helperVector.x, helperVector.y);
  if (!Number.isFinite(helperDistance) || helperDistance < 1e-3) {
    helperDistance = Math.max(baseLength, 120);
  }
  const helperOrientation: 1 | -1 = helperVector.x * baseNormal.x + helperVector.y * baseNormal.y >= 0 ? 1 : -1;
  const baseStroke = baseLine.segmentStyles?.[0] ?? baseLine.style;
  const style: StrokeStyle = { ...baseStroke, hidden: false };
  const id = nextId('line', model);
  const meta: PerpendicularLineMeta = {
    throughPoint: anchor.id,
    referenceLine: baseLine.id,
    helperPoint: helperPoint.id,
    helperDistance,
    helperOrientation
  };
  if (helperMode === 'projection') {
    meta.helperMode = 'projection';
  }
  const perpendicularLine: PerpendicularLine = {
    object_type: 'line',
    id,
    points: [pointIdx, helperIdx],
    defining_points: [pointIdx, helperIdx],
    segmentStyles: [{ ...style }],
    segmentKeys: [segmentKeyForPoints(pointIdx, helperIdx)],
    leftRay: baseLine.leftRay ? { ...baseLine.leftRay } : { ...style, hidden: true },
    rightRay: baseLine.rightRay ? { ...baseLine.rightRay } : { ...style, hidden: true },
    style,
    hidden: false,
    construction_kind: 'perpendicular',
    defining_parents: [anchor.id, baseLine.id],
    children: [],
    perpendicular: meta,
    recompute: () => {},
    on_parent_deleted: () => {}
  };
  model.lines.push(perpendicularLine);
  const lineIdx = model.lines.length - 1;
  registerIndex(model, 'line', id, lineIdx);
  model.lines[lineIdx] = {
    ...perpendicularLine,
    recompute: () => recomputePerpendicularLine(lineIdx)
  } as PerpendicularLine;
  helperPoint = model.points[helperIdx];
  model.points[helperIdx] = { ...helperPoint, perpendicular_helper_for: id };
  const helperParents: ConstructionParent[] = [{ kind: 'line', id }];
  if (helperMode === 'projection' && baseLine.id) {
    helperParents.push({ kind: 'line', id: baseLine.id });
  }
  applyPointConstruction(helperIdx, helperParents);
  recomputePerpendicularLine(lineIdx);
  ensureSegmentStylesForLine(lineIdx);
  updateIntersectionsForLine(lineIdx);
  updateMidpointsForPoint(helperIdx);
  return lineIdx;
}

function recomputeParallelLine(lineIdx: number) {
  if (parallelRecomputeStack.has(lineIdx)) return;
  const line = model.lines[lineIdx];
  if (!isParallelLine(line)) return;
  const throughIdx = pointIndexById(line.parallel.throughPoint);
  const helperIdx = pointIndexById(line.parallel.helperPoint);
  const baseIdx = lineIndexById(line.parallel.referenceLine);
  if (throughIdx === null || helperIdx === null || baseIdx === null) return;
  const anchor = model.points[throughIdx];
  const helper = model.points[helperIdx];
  const baseLine = model.lines[baseIdx];
  if (!anchor || !helper || !baseLine) return;
  const dirInfo = primaryLineDirection(baseLine);
  if (!dirInfo) return;
  parallelRecomputeStack.add(lineIdx);
  try {
    const direction = dirInfo.dir;
    const distances = new Map<number, number>();
    line.points.forEach((idx) => {
      const pt = model.points[idx];
      if (!pt) return;
      const vec = { x: pt.x - anchor.x, y: pt.y - anchor.y };
      const dist = vec.x * direction.x + vec.y * direction.y;
      distances.set(idx, dist);
    });
    if (!distances.has(helperIdx)) {
      const vec = { x: helper.x - anchor.x, y: helper.y - anchor.y };
      distances.set(helperIdx, vec.x * direction.x + vec.y * direction.y);
    }
    const helperDist = distances.get(helperIdx) ?? 0;
    if (Math.abs(helperDist) < 1e-3) {
      const baseLen = lineLength(baseIdx) ?? dirInfo.length;
      const fallback = Math.max(baseLen, 120);
      distances.set(helperIdx, fallback);
    }
    const touched = new Set<number>();
    distances.forEach((dist, idx) => {
      if (idx === throughIdx) return;
      const target = { x: anchor.x + direction.x * dist, y: anchor.y + direction.y * dist };
      const current = model.points[idx];
      if (!current) return;
      const constrained = constrainToCircles(idx, target);
      if (Math.abs(current.x - constrained.x) > 1e-6 || Math.abs(current.y - constrained.y) > 1e-6) {
        model.points[idx] = { ...current, ...constrained };
        touched.add(idx);
      }
    });
    if (!line.points.includes(throughIdx)) line.points.unshift(throughIdx);
    if (!line.points.includes(helperIdx)) line.points.push(helperIdx);
    line.defining_points = [throughIdx, helperIdx];
    ensureSegmentStylesForLine(lineIdx);
    reorderLinePoints(lineIdx);
    touched.forEach((idx) => updateMidpointsForPoint(idx));
    updateIntersectionsForLine(lineIdx);
    updateParallelLinesForLine(lineIdx);
    updatePerpendicularLinesForLine(lineIdx);
  } finally {
    parallelRecomputeStack.delete(lineIdx);
  }
}

function recomputePerpendicularLine(lineIdx: number) {
  if (perpendicularRecomputeStack.has(lineIdx)) return;
  const line = model.lines[lineIdx];
  if (!isPerpendicularLine(line)) return;
  const throughIdx = pointIndexById(line.perpendicular.throughPoint);
  const helperIdx = pointIndexById(line.perpendicular.helperPoint);
  const baseIdx = lineIndexById(line.perpendicular.referenceLine);
  if (throughIdx === null || helperIdx === null || baseIdx === null) return;
  const anchor = model.points[throughIdx];
  let helper = model.points[helperIdx];
  const baseLine = model.lines[baseIdx];
  if (!anchor || !helper || !baseLine) return;
  const dirInfo = primaryLineDirection(baseLine);
  if (!dirInfo) return;
  perpendicularRecomputeStack.add(lineIdx);
  try {
    const baseNormal = { x: -dirInfo.dir.y, y: dirInfo.dir.x };
    const helperMode = line.perpendicular.helperMode ?? 'normal';
    if (helperMode === 'projection' && baseLine.points.length >= 2) {
      const baseStartIdx = baseLine.points[0];
      const baseEndIdx = baseLine.points[baseLine.points.length - 1];
      const baseStart = baseStartIdx !== undefined ? model.points[baseStartIdx] : null;
      const baseEnd = baseEndIdx !== undefined ? model.points[baseEndIdx] : null;
      if (baseStart && baseEnd) {
        const projected = projectPointOnLine(anchor, baseStart, baseEnd);
        const constrained = constrainToCircles(helperIdx, projected);
        if (
          Math.abs(helper.x - constrained.x) > 1e-6 ||
          Math.abs(helper.y - constrained.y) > 1e-6
        ) {
          model.points[helperIdx] = { ...helper, ...constrained };
          helper = model.points[helperIdx];
        }
        helper = model.points[helperIdx];
      }
    }
    const helperVecRaw = { x: helper.x - anchor.x, y: helper.y - anchor.y };
    const baseProjection = helperVecRaw.x * baseNormal.x + helperVecRaw.y * baseNormal.y;
    let orientation: 1 | -1 = line.perpendicular.helperOrientation ?? (baseProjection >= 0 ? 1 : -1);
    if (selectedPointIndex === helperIdx && draggingSelection) {
      orientation = baseProjection >= 0 ? 1 : -1;
    }
    if (helperMode === 'projection') {
      orientation = baseProjection >= 0 ? 1 : -1;
    }
    line.perpendicular.helperOrientation = orientation;
    const direction = orientation === 1 ? baseNormal : { x: -baseNormal.x, y: -baseNormal.y };
    const distances = new Map<number, number>();
    line.points.forEach((idx) => {
      const pt = model.points[idx];
      if (!pt) return;
      const vec = { x: pt.x - anchor.x, y: pt.y - anchor.y };
      const dist = vec.x * direction.x + vec.y * direction.y;
      distances.set(idx, dist);
    });
    const helperProjection = helperVecRaw.x * direction.x + helperVecRaw.y * direction.y;
    let helperDistance = line.perpendicular.helperDistance;
    if (helperMode === 'projection') {
      const inferred = Math.abs(helperProjection);
      helperDistance = inferred;
      line.perpendicular.helperDistance = helperDistance;
    } else if (selectedPointIndex === helperIdx && draggingSelection) {
      let updatedDistance = Math.abs(helperProjection);
      if (!Number.isFinite(updatedDistance) || updatedDistance < 1e-3) {
        const fallback = Math.abs(helperProjection);
        if (Number.isFinite(fallback) && fallback > 1e-3) {
          updatedDistance = fallback;
        } else {
          const baseLen = lineLength(baseIdx) ?? dirInfo.length;
          updatedDistance = baseLen > 1e-3 ? baseLen : 120;
        }
      }
      helperDistance = updatedDistance;
      line.perpendicular.helperDistance = helperDistance;
    } else if (helperDistance === undefined || helperDistance < 1e-3) {
      let inferred = Math.abs(helperProjection);
      if (!Number.isFinite(inferred) || inferred < 1e-3) {
        const baseLen = lineLength(baseIdx) ?? dirInfo.length;
        inferred = baseLen > 1e-3 ? baseLen : 120;
      }
      helperDistance = inferred;
      line.perpendicular.helperDistance = helperDistance;
    }
    helperDistance = line.perpendicular.helperDistance ?? helperDistance ?? 0;
    if (!Number.isFinite(helperDistance) || helperDistance < 1e-3) {
      const baseLen = lineLength(baseIdx) ?? dirInfo.length;
      helperDistance = baseLen > 1e-3 ? baseLen : 120;
    }
    line.perpendicular.helperDistance = helperDistance;
    distances.set(helperIdx, helperDistance);
    const touched = new Set<number>();
    distances.forEach((dist, idx) => {
      if (idx === throughIdx) return;
      const target = {
        x: anchor.x + direction.x * dist,
        y: anchor.y + direction.y * dist
      };
      const current = model.points[idx];
      if (!current) return;
      const constrained = constrainToCircles(idx, target);
      if (Math.abs(current.x - constrained.x) > 1e-6 || Math.abs(current.y - constrained.y) > 1e-6) {
        model.points[idx] = { ...current, ...constrained };
        touched.add(idx);
      }
    });
    if (!line.points.includes(throughIdx)) line.points.unshift(throughIdx);
    if (!line.points.includes(helperIdx)) line.points.push(helperIdx);
    line.defining_points = [throughIdx, helperIdx];
    ensureSegmentStylesForLine(lineIdx);
    reorderLinePoints(lineIdx);
    touched.forEach((idx) => updateMidpointsForPoint(idx));
    updateIntersectionsForLine(lineIdx);
    updateParallelLinesForLine(lineIdx);
    updatePerpendicularLinesForLine(lineIdx);
  } finally {
    perpendicularRecomputeStack.delete(lineIdx);
  }
}

function pushHistory() {
  rebuildIndexMaps();
  const snapshot: Snapshot = {
    model: deepClone(model),
    panOffset: { ...panOffset },
    zoom: zoomFactor,
    labelState: {
      upperIdx: labelUpperIdx,
      lowerIdx: labelLowerIdx,
      greekIdx: labelGreekIdx,
      freeUpper: [...freeUpperIdx],
      freeLower: [...freeLowerIdx],
      freeGreek: [...freeGreekIdx]
    }
  };
  history = history.slice(0, historyIndex + 1);
  history.push(snapshot);
  historyIndex = history.length - 1;
  updateUndoRedoButtons();
}

function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj);
    } catch {
      // Fallback when cloning functions or non-cloneable fields
    }
  }
  return JSON.parse(JSON.stringify(obj));
}

function serializeCurrentDocument(): PersistedDocument {
  rebuildIndexMaps();
  const pointData = model.points.map((point) => {
    const { incident_objects, recompute: _r, on_parent_deleted: _d, ...rest } = point;
    const cloned = deepClone(rest) as Omit<PersistedPoint, 'incident_objects'>;
    return {
      ...cloned,
      incident_objects: Array.from(incident_objects)
    } satisfies PersistedPoint;
  });
  const lineData = model.lines.map((line) => {
    const { recompute: _r, on_parent_deleted: _d, ...rest } = line;
    return deepClone(rest) as PersistedLine;
  });
  const circleData = model.circles.map((circle) => {
    const { recompute: _r, on_parent_deleted: _d, ...rest } = circle;
    return deepClone(rest) as PersistedCircle;
  });
  const angleData = model.angles.map((angle) => {
    const { recompute: _r, on_parent_deleted: _d, ...rest } = angle;
    return deepClone(rest) as PersistedAngle;
  });
  const polygonData = model.polygons.map((polygon) => {
    const { recompute: _r, on_parent_deleted: _d, ...rest } = polygon;
    return deepClone(rest) as PersistedPolygon;
  });
  return {
    version: PERSIST_VERSION,
    model: {
      points: pointData,
      lines: lineData,
      circles: circleData,
      angles: angleData,
      polygons: polygonData,
      inkStrokes: deepClone(model.inkStrokes),
      labels: deepClone(model.labels),
      idCounters: deepClone(model.idCounters)
    },
    panOffset: { ...panOffset },
    zoom: zoomFactor,
    labelState: {
      upper: labelUpperIdx,
      lower: labelLowerIdx,
      greek: labelGreekIdx,
      freeUpper: [...freeUpperIdx],
      freeLower: [...freeLowerIdx],
      freeGreek: [...freeGreekIdx]
    },
    recentColors: [...recentColors],
    showHidden,
    measurementReferenceSegment,
    measurementReferenceValue
  } satisfies PersistedDocument;
}

function applyPersistedDocument(raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new Error('Brak danych w pliku JSON');
  const doc = raw as Partial<PersistedDocument>;
  if (doc.version !== PERSIST_VERSION) throw new Error('Nieobsługiwana wersja pliku JSON');
  if (!doc.model) throw new Error('Brak sekcji modelu w pliku JSON');
  resetLabelState();
  const persistedModel = doc.model;
  const toPoint = (p: PersistedPoint): Point => {
    const clone = deepClone(p) as PersistedPoint;
    const incidents = Array.isArray(clone.incident_objects) ? clone.incident_objects : [];
    if (clone.label) clone.label = { ...clone.label, fontSize: normalizeLabelFontSize(clone.label.fontSize) };
    const { incident_objects: _ignore, ...rest } = clone;
    return {
      ...rest,
      incident_objects: new Set<string>(incidents.map((id) => String(id))),
      recompute: () => {},
      on_parent_deleted: () => {}
    };
  };
  const toLine = (l: PersistedLine): Line => {
    const clone = deepClone(l) as PersistedLine;
    if (clone.label) clone.label = { ...clone.label, fontSize: normalizeLabelFontSize(clone.label.fontSize) };
    return {
      ...clone,
      recompute: () => {},
      on_parent_deleted: () => {}
    };
  };
  const toCircle = (c: PersistedCircle): Circle => {
    const clone = deepClone(c) as PersistedCircle;
    if (clone.label) clone.label = { ...clone.label, fontSize: normalizeLabelFontSize(clone.label.fontSize) };
    return {
      ...clone,
      recompute: () => {},
      on_parent_deleted: () => {}
    };
  };
  const toAngle = (a: PersistedAngle): Angle => {
    const clone = deepClone(a) as PersistedAngle;
    if (clone.label) clone.label = { ...clone.label, fontSize: normalizeLabelFontSize(clone.label.fontSize) };
    return {
      ...clone,
      recompute: () => {},
      on_parent_deleted: () => {}
    };
  };
  const toPolygon = (p: PersistedPolygon): Polygon => ({
    ...(deepClone(p) as PersistedPolygon),
    recompute: () => {},
    on_parent_deleted: () => {}
  });
  const restored: Model = {
    points: Array.isArray(persistedModel.points) ? persistedModel.points.map(toPoint) : [],
    lines: Array.isArray(persistedModel.lines) ? persistedModel.lines.map(toLine) : [],
    circles: Array.isArray(persistedModel.circles) ? persistedModel.circles.map(toCircle) : [],
    angles: Array.isArray(persistedModel.angles) ? persistedModel.angles.map(toAngle) : [],
    polygons: Array.isArray(persistedModel.polygons) ? persistedModel.polygons.map(toPolygon) : [],
    inkStrokes: Array.isArray(persistedModel.inkStrokes) ? deepClone(persistedModel.inkStrokes) : [],
    labels: Array.isArray(persistedModel.labels)
      ? deepClone(persistedModel.labels).map((label) => ({
          ...label,
          fontSize: normalizeLabelFontSize(label.fontSize)
        }))
      : [],
    idCounters: {
      point: 0,
      line: 0,
      circle: 0,
      angle: 0,
      polygon: 0
    },
    indexById: {
      point: {},
      line: {},
      circle: {},
      angle: {},
      polygon: {}
    }
  };
  const providedCounters = persistedModel.idCounters ?? {};
  const counters: Record<GeometryKind, number> = {
    point: Number(providedCounters.point) || 0,
    line: Number(providedCounters.line) || 0,
    circle: Number(providedCounters.circle) || 0,
    angle: Number(providedCounters.angle) || 0,
    polygon: Number(providedCounters.polygon) || 0
  };
  const bumpCounter = (kind: GeometryKind, id: string | undefined) => {
    if (!id) return;
    const prefix = ID_PREFIX[kind];
    if (!id.startsWith(prefix)) return;
    const parsed = Number(id.slice(prefix.length));
    if (Number.isFinite(parsed) && parsed > counters[kind]) counters[kind] = parsed;
  };
  restored.points.forEach((p) => bumpCounter('point', p.id));
  restored.lines.forEach((l) => bumpCounter('line', l.id));
  restored.circles.forEach((c) => bumpCounter('circle', c.id));
  restored.angles.forEach((a) => bumpCounter('angle', a.id));
  restored.polygons.forEach((p) => bumpCounter('polygon', p.id));
  restored.idCounters = counters;
  model = restored;
  panOffset = doc.panOffset
    ? { x: Number(doc.panOffset.x) || 0, y: Number(doc.panOffset.y) || 0 }
    : { x: 0, y: 0 };
  zoomFactor = clamp(Number(doc.zoom) || 1, MIN_ZOOM, MAX_ZOOM);
  const sanitizeNumbers = (values: unknown): number[] =>
    Array.isArray(values)
      ? values
          .map((v) => (typeof v === 'number' ? v : Number(v)))
          .filter((v): v is number => Number.isFinite(v))
      : [];
  const labels = doc.labelState ?? {
    upper: 0,
    lower: 0,
    greek: 0,
    freeUpper: [],
    freeLower: [],
    freeGreek: []
  };
  labelUpperIdx = Number(labels.upper) || 0;
  labelLowerIdx = Number(labels.lower) || 0;
  labelGreekIdx = Number(labels.greek) || 0;
  freeUpperIdx = sanitizeNumbers(labels.freeUpper);
  freeLowerIdx = sanitizeNumbers(labels.freeLower);
  freeGreekIdx = sanitizeNumbers(labels.freeGreek);
  rebuildIndexMaps();
  selectedPointIndex = null;
  selectedLineIndex = null;
  selectedCircleIndex = null;
  selectedAngleIndex = null;
  selectedPolygonIndex = null;
  selectedLabel = null;
  selectedSegments.clear();
  selectedArcSegments.clear();
  segmentStartIndex = null;
  segmentStartTemporary = false;
  circleCenterIndex = null;
  triangleStartIndex = null;
  squareStartIndex = null;
  polygonChain = [];
  currentPolygonLines = [];
  angleFirstLeg = null;
  anglePoints = [];
  bisectorFirstLeg = null;
  midpointFirstIndex = null;
  symmetricSourceIndex = null;
  parallelAnchorPointIndex = null;
  parallelReferenceLineIndex = null;
  pendingParallelPoint = null;
  pendingParallelLine = null;
  pendingCircleRadiusPoint = null;
  pendingCircleRadiusLength = null;
  circleThreePoints = [];
  activeAxisSnap = null;
  draggingLabel = null;
  draggingCircleCenterAngles = null;
  draggingSelection = false;
  resizingLine = null;
  lineDragContext = null;
  hoverPointIndex = null;
  isPanning = false;
  panStart = { x: 0, y: 0 };
  panStartOffset = { x: 0, y: 0 };
  dragStart = { x: 0, y: 0 };
  pendingPanCandidate = null;
  stickyTool = null;
  showHidden = !!doc.showHidden;
  styleMenuSuppressed = false;
  styleMenuOpen = false;
  viewModeOpen = false;
  rayModeOpen = false;
  zoomMenuOpen = false;
  movedDuringDrag = false;
  movedDuringPan = false;
  debugPanelPos = null;
  
  // Restore measurement scale from reference value (DPI-independent)
  measurementReferenceSegment = doc.measurementReferenceSegment ?? null;
  measurementReferenceValue = typeof doc.measurementReferenceValue === 'number' ? doc.measurementReferenceValue : null;
  
  if (measurementReferenceSegment && measurementReferenceValue && measurementReferenceValue > 0) {
    const { lineIdx, segIdx } = measurementReferenceSegment;
    if (lineIdx >= 0 && lineIdx < model.lines.length) {
      const currentLength = getSegmentLength(lineIdx, segIdx);
      measurementScale = currentLength / measurementReferenceValue;
    } else {
      // Reference segment doesn't exist anymore, clear scale
      measurementScale = null;
      measurementReferenceSegment = null;
      measurementReferenceValue = null;
    }
  } else {
    // No scale set
    measurementScale = null;
  }
  
  measurementLabels = [];
  measurementLabelIdCounter = 0;
  showMeasurements = false;
  editingMeasurementLabel = null;
  closeMeasurementInputBox();
  endDebugPanelDrag();
  closeStyleMenu();
  closeZoomMenu();
  closeViewMenu();
  closeRayMenu();
  setMode('move');
  if (Array.isArray(doc.recentColors) && doc.recentColors.length > 0) {
    recentColors = doc.recentColors.map((c) => String(c)).slice(0, 20);
    updateColorButtons();
  }
  updateSelectionButtons();
  updateOptionButtons();
  draw();
  history = [];
  historyIndex = -1;
  pushHistory();
  if (debugVisible) {
    requestAnimationFrame(() => ensureDebugPanelPosition());
  }
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  restoreHistory();
}

function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex += 1;
  restoreHistory();
}

function restoreHistory() {
  const snap = history[historyIndex];
  if (!snap) return;
  model = deepClone(snap.model);
  panOffset = { ...snap.panOffset };
  zoomFactor = clamp(snap.zoom ?? 1, MIN_ZOOM, MAX_ZOOM);
  if (snap.labelState) {
    labelUpperIdx = snap.labelState.upperIdx;
    labelLowerIdx = snap.labelState.lowerIdx;
    labelGreekIdx = snap.labelState.greekIdx;
    freeUpperIdx = [...snap.labelState.freeUpper];
    freeLowerIdx = [...snap.labelState.freeLower];
    freeGreekIdx = [...snap.labelState.freeGreek];
  }
  rebuildIndexMaps();
  selectedLineIndex = null;
  selectedPointIndex = null;
  selectedPolygonIndex = null;
  selectedCircleIndex = null;
  selectedAngleIndex = null;
  selectedArcSegments.clear();
  updateSelectionButtons();
  updateUndoRedoButtons();
  draw();
}

function updateUndoRedoButtons() {
  undoBtn?.classList.toggle('disabled', historyIndex <= 0);
  redoBtn?.classList.toggle('disabled', historyIndex >= history.length - 1);
}

async function captureCanvasAsPng(): Promise<Blob> {
  if (!canvas) throw new Error('Płótno jest niedostępne');
  return await new Promise<Blob>((resolve, reject) => {
    canvas!.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Brak danych obrazu'));
      }
    }, 'image/png');
  });
}

function toggleZoomMenu() {
  zoomMenuOpen = !zoomMenuOpen;
  if (zoomMenuOpen) {
    if (zoomMenuBtn && zoomMenuDropdown) {
      const rect = zoomMenuBtn.getBoundingClientRect();
      zoomMenuDropdown.style.position = 'fixed';
      zoomMenuDropdown.style.top = `${rect.bottom + 6}px`;
      zoomMenuDropdown.style.left = `${rect.left}px`;
      zoomMenuDropdown.style.right = 'auto';
    }
    zoomMenuContainer?.classList.add('open');
  } else {
    closeZoomMenu();
  }
}

function closeZoomMenu() {
  zoomMenuOpen = false;
  zoomMenuContainer?.classList.remove('open');
}

function toggleStyleMenu() {
  if (!styleMenuContainer) return;
  styleMenuOpen = !styleMenuOpen;
  if (styleMenuOpen) {
    // Dezaktywuj tryb kopiowania stylu przy otwieraniu menu
    if (copyStyleActive) {
      copyStyleActive = false;
      copiedStyle = null;
      updateSelectionButtons();
    }
    openStyleMenu();
  } else {
    styleMenuSuppressed = true;
    closeStyleMenu();
  }
}

function closeStyleMenu() {
  styleMenuOpen = false;
  styleMenuContainer?.classList.remove('open');
}

function openStyleMenu() {
  if (!styleMenuContainer) return;
  if (styleMenuDropdown) {
    styleMenuDropdown.style.position = 'fixed';
    const btnRect = styleMenuBtn?.getBoundingClientRect();
    styleMenuDropdown.style.top = `${btnRect ? btnRect.bottom + 6 : 52}px`;
    styleMenuDropdown.style.left = `${btnRect ? btnRect.left : 8}px`;
    styleMenuDropdown.style.right = 'auto';
    styleMenuDropdown.style.width = 'auto';
    styleMenuDropdown.style.minWidth = '240px';
    styleMenuDropdown.style.maxWidth = '360px';
  }
  styleMenuContainer.classList.add('open');
  styleMenuOpen = true;
  updateStyleMenuValues();
}

type ViewModeState = 'edges' | 'vertices' | 'both';

function getViewModeState(): ViewModeState {
  if (selectionEdges && selectionVertices) return 'both';
  if (selectionVertices && !selectionEdges) return 'vertices';
  return 'edges';
}

function setViewMode(mode: 'edges' | 'vertices') {
  if (mode === 'edges') {
    selectionEdges = !selectionEdges;
    if (!selectionEdges && !selectionVertices) selectionVertices = true;
  } else {
    selectionVertices = !selectionVertices;
    if (!selectionEdges && !selectionVertices) selectionEdges = true;
  }
  updateSelectionButtons();
  updateStyleMenuValues();
  draw();
  closeViewMenu();
}

function toggleViewMenu() {
  viewModeOpen = !viewModeOpen;
  if (viewModeOpen) {
    if (viewModeToggleBtn && viewModeMenuContainer) {
      const dropdown = viewModeMenuContainer.querySelector('.dropdown-menu') as HTMLElement | null;
      if (dropdown) {
        const rect = viewModeToggleBtn.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.top = `${rect.bottom + 6}px`;
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.right = 'auto';
      }
    }
    viewModeMenuContainer?.classList.add('open');
  } else {
    closeViewMenu();
  }
}

function closeViewMenu() {
  viewModeOpen = false;
  viewModeMenuContainer?.classList.remove('open');
}

function setRayMode(next: 'segment' | 'left' | 'right') {
  if (selectedLineIndex === null) return;
  const line = model.lines[selectedLineIndex];
  const ensureRay = (side: 'left' | 'right') => {
    if (side === 'left' && !line.leftRay) line.leftRay = { ...line.style, hidden: true };
    if (side === 'right' && !line.rightRay) line.rightRay = { ...line.style, hidden: true };
  };
  ensureRay('left');
  ensureRay('right');
  const leftOn = !!line.leftRay && !line.leftRay.hidden;
  const rightOn = !!line.rightRay && !line.rightRay.hidden;
  if (next === 'segment') {
    if (!leftOn && !rightOn) {
      line.leftRay!.hidden = false;
      line.rightRay!.hidden = false;
    } else {
      line.leftRay!.hidden = true;
      line.rightRay!.hidden = true;
    }
  } else if (next === 'right') {
    const newState = !rightOn;
    line.rightRay!.hidden = !newState;
    if (!line.leftRay) line.leftRay = { ...line.style, hidden: true };
    const leftAfter = !!line.leftRay && !line.leftRay.hidden;
    if (!leftAfter && !newState) {
      line.leftRay!.hidden = true;
      line.rightRay!.hidden = true;
    }
  } else if (next === 'left') {
    const newState = !leftOn;
    line.leftRay!.hidden = !newState;
    if (!line.rightRay) line.rightRay = { ...line.style, hidden: true };
    const rightAfter = !!line.rightRay && !line.rightRay.hidden;
    if (!rightAfter && !newState) {
      line.leftRay!.hidden = true;
      line.rightRay!.hidden = true;
    }
  }
  updateStyleMenuValues();
  updateSelectionButtons();
  draw();
  pushHistory();
  closeRayMenu();
}

function toggleRayMenu() {
  rayModeOpen = !rayModeOpen;
  if (rayModeOpen) {
    if (rayModeToggleBtn && rayModeMenuContainer) {
      const dropdown = rayModeMenuContainer.querySelector('.dropdown-menu') as HTMLElement | null;
      if (dropdown) {
        const rect = rayModeToggleBtn.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.top = `${rect.bottom + 6}px`;
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.right = 'auto';
      }
    }
    rayModeMenuContainer?.classList.add('open');
  } else {
    closeRayMenu();
  }
}

function closeRayMenu() {
  rayModeOpen = false;
  rayModeMenuContainer?.classList.remove('open');
}

function removePointsAndRelated(points: number[], removeLines = false) {
  if (!points.length) return;
  const toRemove = new Set(points);
  const extraPoints: number[] = [];
  if (removeLines) {
    const remap = new Map<number, number>();
    const kept: Line[] = [];
    model.lines.forEach((line, idx) => {
      if (line.defining_points.some((pi) => toRemove.has(pi))) {
        if (line.label) reclaimLabel(line.label);
        remap.set(idx, -1);
        if (isParallelLine(line)) {
          const helperIdx = pointIndexById(line.parallel.helperPoint);
          if (helperIdx !== null) extraPoints.push(helperIdx);
        }
      } else {
        const filteredPoints = line.points.filter((pi) => !toRemove.has(pi));
        remap.set(idx, kept.length);
        kept.push({ ...line, points: filteredPoints });
      }
    });
    model.lines = kept;
    remapAngles(remap);
    remapPolygons(remap);
    model.circles = model.circles.filter((circle) => {
      const removeCircle =
        toRemove.has(circle.center) ||
        toRemove.has(circle.radius_point) ||
        (isCircleThroughPoints(circle) && circle.defining_points.some((pi) => toRemove.has(pi)));
      if (removeCircle && circle.label) reclaimLabel(circle.label);
      return !removeCircle;
    });
    model.angles = model.angles.filter((ang) => {
      if (toRemove.has(ang.vertex)) {
        if (ang.label) reclaimLabel(ang.label);
        return false;
      }
      return true;
    });
  } else {
    const remap = new Map<number, number>();
    const rebuiltLines: Line[] = [];
    model.lines.forEach((line, idx) => {
      const filteredPoints = line.points.filter((idx) => !toRemove.has(idx));
      if (filteredPoints.length < 2) {
        if (line.label) reclaimLabel(line.label);
        remap.set(idx, -1);
        return;
      }
      const segCount = Math.max(0, filteredPoints.length - 1);
      const styles =
        line.segmentStyles && line.segmentStyles.length
          ? Array.from({ length: segCount }, (_, i) => line.segmentStyles![Math.min(i, line.segmentStyles!.length - 1)])
          : undefined;
      const rebuilt: Line = { ...line, points: filteredPoints, segmentStyles: styles };
      remap.set(idx, rebuiltLines.length);
      rebuiltLines.push(rebuilt);
    });
    model.lines = rebuiltLines;
    remapAngles(remap);
    remapPolygons(remap);
    model.circles = model.circles
      .map((circle) => {
        if (toRemove.has(circle.center) || toRemove.has(circle.radius_point)) {
          if (circle.label) reclaimLabel(circle.label);
          return null;
        }
        if (isCircleThroughPoints(circle) && circle.defining_points.some((pi) => toRemove.has(pi))) {
          if (circle.label) reclaimLabel(circle.label);
          return null;
        }
        const pts = circle.points.filter((idx) => !toRemove.has(idx));
        return { ...circle, points: pts };
      })
      .filter((c): c is Circle => c !== null);
    model.angles = model.angles.filter((ang) => {
      if (toRemove.has(ang.vertex)) {
        if (ang.label) reclaimLabel(ang.label);
        return false;
      }
      return true;
    });
  }
  if (extraPoints.length) {
    extraPoints
      .filter((idx) => !toRemove.has(idx))
      .forEach((idx) => {
        toRemove.add(idx);
        points.push(idx);
      });
  }
  // Reclaim labels from removed points
  points.forEach((idx) => {
    const pt = model.points[idx];
    if (pt?.label) reclaimLabel(pt.label);
  });
  removePointsKeepingOrder(points);
}

function removeParallelLinesReferencing(lineId: string): string[] {
  if (!lineId) return [];
  const lineIndices: number[] = [];
  const helperPoints: number[] = [];
  const removedIds: string[] = [];
  model.lines.forEach((line, idx) => {
    if (!isParallelLine(line)) return;
    if (line.parallel.referenceLine !== lineId) return;
    if (line.label) reclaimLabel(line.label);
    lineIndices.push(idx);
    removedIds.push(line.id);
    const helperIdx = pointIndexById(line.parallel.helperPoint);
    if (helperIdx !== null) helperPoints.push(helperIdx);
  });
  if (!lineIndices.length) return [];
  const remap = new Map<number, number>();
  const kept: Line[] = [];
  model.lines.forEach((line, idx) => {
    if (lineIndices.includes(idx)) {
      remap.set(idx, -1);
    } else {
      remap.set(idx, kept.length);
      kept.push(line);
    }
  });
  model.lines = kept;
  remapAngles(remap);
  remapPolygons(remap);
  if (helperPoints.length) {
    const uniqueHelpers = Array.from(new Set(helperPoints));
    removePointsKeepingOrder(uniqueHelpers, false);
  } else {
    rebuildIndexMaps();
  }
  cleanupDependentPoints();
  return removedIds;
}

function removePerpendicularLinesReferencing(lineId: string): string[] {
  if (!lineId) return [];
  const lineIndices: number[] = [];
  const helperPoints: number[] = [];
  const removedIds: string[] = [];
  model.lines.forEach((line, idx) => {
    if (!isPerpendicularLine(line)) return;
    if (line.perpendicular.referenceLine !== lineId) return;
    if (line.label) reclaimLabel(line.label);
    lineIndices.push(idx);
    removedIds.push(line.id);
    const helperIdx = pointIndexById(line.perpendicular.helperPoint);
    if (helperIdx !== null) helperPoints.push(helperIdx);
  });
  if (!lineIndices.length) return [];
  const remap = new Map<number, number>();
  const kept: Line[] = [];
  model.lines.forEach((line, idx) => {
    if (lineIndices.includes(idx)) {
      remap.set(idx, -1);
    } else {
      remap.set(idx, kept.length);
      kept.push(line);
    }
  });
  model.lines = kept;
  remapAngles(remap);
  remapPolygons(remap);
  if (helperPoints.length) {
    const uniqueHelpers = Array.from(new Set(helperPoints));
    removePointsKeepingOrder(uniqueHelpers, false);
  } else {
    rebuildIndexMaps();
  }
  cleanupDependentPoints();
  return removedIds;
}

function removePointsKeepingOrder(points: number[], allowCleanup = true) {
  const sorted = [...points].sort((a, b) => b - a);
  sorted.forEach((idx) => {
    const point = model.points[idx];
    if (point?.label) reclaimLabel(point.label);
    model.points.splice(idx, 1);
    // shift point indices in remaining lines
    model.lines.forEach((line) => {
      const mapped = line.defining_points.map((pIdx) => (pIdx > idx ? pIdx - 1 : pIdx));
      line.defining_points = [mapped[0], mapped[1]] as [number, number];
      line.points = line.points.map((pIdx) => (pIdx > idx ? pIdx - 1 : pIdx));
    });
    // adjust circles
    model.circles = model.circles
      .map((c) => {
        if (c.center === idx) return null;
        if (isCircleThroughPoints(c) && c.defining_points.includes(idx)) return null;
        if (c.radius_point === idx) return null;
        const center = c.center > idx ? c.center - 1 : c.center;
        const radius_point = c.radius_point > idx ? c.radius_point - 1 : c.radius_point;
        const pts = c.points
          .map((p) => (p > idx ? p - 1 : p))
          .filter((p) => p !== idx);
        if (isCircleThroughPoints(c)) {
          const defining = c.defining_points.map((p) => (p > idx ? p - 1 : p)) as [number, number, number];
          return { ...c, center, radius_point, points: pts, defining_points: defining };
        }
        return { ...c, center, radius_point, points: pts };
      })
      .filter((c): c is Circle => c !== null);
  });
  model.lines.forEach((_, li) => ensureSegmentStylesForLine(li));
  rebuildIndexMaps();
  if (allowCleanup) cleanupDependentPoints();
}

function cleanupDependentPoints() {
  const orphanIdxs = new Set<number>();
  model.points.forEach((pt, idx) => {
    if (isMidpointPoint(pt)) {
      const missingParent = pt.midpoint.parents.some((pid) => pointIndexById(pid) === null);
      if (missingParent) orphanIdxs.add(idx);
    }
    if (isSymmetricPoint(pt)) {
      const sourceMissing = pointIndexById(pt.symmetric.source) === null;
      const mirrorMissing =
        pt.symmetric.mirror.kind === 'point'
          ? pointIndexById(pt.symmetric.mirror.id) === null
          : lineIndexById(pt.symmetric.mirror.id) === null;
      if (sourceMissing || mirrorMissing) orphanIdxs.add(idx);
    }
    if (pt.parallel_helper_for) {
      if (lineIndexById(pt.parallel_helper_for) === null) {
        orphanIdxs.add(idx);
      }
    }
    if (pt.perpendicular_helper_for) {
      if (lineIndexById(pt.perpendicular_helper_for) === null) {
        orphanIdxs.add(idx);
      }
    }
  });
  if (orphanIdxs.size) {
    removePointsKeepingOrder(Array.from(orphanIdxs), false);
  }
}

function pointUsedAnywhere(idx: number): boolean {
  const point = model.points[idx];
  if (!point) return false;
  const usedByLines = model.lines.some((line) => line.points.includes(idx));
  if (usedByLines) return true;
  const usedByCircles = model.circles.some((circle) => {
    if (circle.center === idx || circle.radius_point === idx) return true;
    return circle.points.includes(idx);
  });
  if (usedByCircles) return true;
  const usedByAngles = model.angles.some((angle) => angle.vertex === idx);
  if (usedByAngles) return true;
  const usedByPolygons = model.polygons.some((poly) =>
    poly.lines.some((li) => {
      const line = model.lines[li];
      return !!line && line.points.includes(idx);
    })
  );
  if (usedByPolygons) return true;
  if (point.children.length > 0) return true;
  if (point.parent_refs.length > 0) return true;
  if (point.parallel_helper_for || point.perpendicular_helper_for) return true;
  return false;
}

function clearPointLabelIfUnused(idx: number) {
  const point = model.points[idx];
  if (!point?.label) return;
  if (pointUsedAnywhere(idx)) return;
  reclaimLabel(point.label);
  model.points[idx] = { ...point, label: undefined };
}

function lineLength(idx: number): number | null {
  const line = model.lines[idx];
  if (!line || line.points.length < 2) return null;
  const a = model.points[line.points[0]];
  const b = model.points[line.points[line.points.length - 1]];
  if (!a || !b) return null;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function circleFromThree(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-6) return null;
  const ux =
    ((a.x * a.x + a.y * a.y) * (b.y - c.y) + (b.x * b.x + b.y * b.y) * (c.y - a.y) + (c.x * c.x + c.y * c.y) * (a.y - b.y)) /
    d;
  const uy =
    ((a.x * a.x + a.y * a.y) * (c.x - b.x) + (b.x * b.x + b.y * b.y) * (a.x - c.x) + (c.x * c.x + c.y * c.y) * (b.x - a.x)) /
    d;
  return { x: ux, y: uy };
}

function segmentKey(line: number, part: 'segment' | 'rayLeft' | 'rayRight', seg?: number) {
  if (part === 'segment') return `${line}:s:${seg ?? 0}`;
  return `${line}:${part}`;
}

function hitKey(hit: LineHit) {
  return segmentKey(hit.line, hit.part, hit.part === 'segment' ? hit.seg : undefined);
}

function clearSelectedSegmentsForLine(lineIdx: number) {
  Array.from(selectedSegments).forEach((key) => {
    const parsed = parseSegmentKey(key);
    if (parsed && parsed.line === lineIdx) selectedSegments.delete(key);
  });
}

function parseSegmentKey(
  key: string
): { line: number; part: 'segment' | 'rayLeft' | 'rayRight'; seg?: number } | null {
  if (key.includes(':s:')) {
    const [lineStr, , segStr] = key.split(':');
    const line = Number(lineStr);
    const seg = Number(segStr);
    if (Number.isNaN(line) || Number.isNaN(seg)) return null;
    return { line, part: 'segment', seg };
  }
  const [lineStr, part] = key.split(':');
  const line = Number(lineStr);
  if (Number.isNaN(line)) return null;
  if (part === 'rayLeft' || part === 'rayRight') return { line, part };
  return null;
}

function lineAnchorForHit(hit: LineHit): { a: { x: number; y: number }; b: { x: number; y: number } } | null {
  const line = model.lines[hit.line];
  if (!line) return null;
  if (hit.part === 'segment') {
    const a = model.points[line.points[hit.seg]];
    const b = model.points[line.points[hit.seg + 1]];
    if (!a || !b) return null;
    return { a, b };
  }
  const firstIdx = line.points[0];
  const lastIdx = line.points[line.points.length - 1];
  const anchorIdx = hit.part === 'rayLeft' ? firstIdx : lastIdx;
  const otherIdx = hit.part === 'rayLeft' ? line.points[1] ?? lastIdx : line.points[line.points.length - 2] ?? firstIdx;
  const anchor = model.points[anchorIdx];
  const other = model.points[otherIdx];
  if (!anchor || !other) return null;
  const extent = (canvas ? canvas.width + canvas.height : 2000) / dpr;
  const dirRaw = { x: anchor.x - other.x, y: anchor.y - other.y };
  const len = Math.hypot(dirRaw.x, dirRaw.y) || 1;
  const dir = { x: dirRaw.x / len, y: dirRaw.y / len };
  return {
    a: anchor,
    b: {
      x: anchor.x + dir.x * extent,
      y: anchor.y + dir.y * extent
    }
  };
}

function rebuildSegmentStylesAfterInsert(line: Line, insertAt: number) {
  const segCount = Math.max(0, line.points.length - 1);
  const srcStyles = line.segmentStyles?.length ? line.segmentStyles : undefined;
  const srcKeys = line.segmentKeys ?? [];
  const styles: StrokeStyle[] = [];
  const keys: string[] = [];
  for (let i = 0; i < segCount; i++) {
    let refIdx = i;
    if (i >= insertAt) refIdx = Math.max(0, i - 1);
    const base = srcStyles?.[Math.min(refIdx, (srcStyles?.length ?? 1) - 1)] ?? line.style;
    styles.push({ ...base });
    const key = segmentKeyForPoints(line.points[i], line.points[i + 1]);
    keys.push(key);
  }
  line.segmentStyles = styles;
  line.segmentKeys = keys;
}

function attachPointToLine(pointIdx: number, hit: LineHit, click: { x: number; y: number }, fixedPos?: { x: number; y: number }) {
  const line = model.lines[hit.line];
  if (!line) return;
  const point = model.points[pointIdx];
  if (!point) return;

  if (hit.part === 'segment') {
    const aIdx = line.points[hit.seg];
    const bIdx = line.points[hit.seg + 1];
    const a = model.points[aIdx];
    const b = model.points[bIdx];
    if (!a || !b) return;
    const proj = fixedPos ?? projectPointOnSegment(click, a, b);
    model.points[pointIdx] = { ...point, x: proj.x, y: proj.y };
    line.points.splice(hit.seg + 1, 0, pointIdx);
    const style = line.segmentStyles?.[hit.seg] ?? line.style;
    if (!line.segmentStyles) line.segmentStyles = [];
    line.segmentStyles.splice(hit.seg, 1, { ...style }, { ...style });
  } else if (hit.part === 'rayLeft' || hit.part === 'rayRight') {
    if (line.points.length < 1) return;
    const anchorIdx = hit.part === 'rayLeft' ? line.points[0] : line.points[line.points.length - 1];
    const otherIdx = hit.part === 'rayLeft' ? line.points[1] ?? anchorIdx : line.points[line.points.length - 2] ?? anchorIdx;
    const anchor = model.points[anchorIdx];
    const other = model.points[otherIdx];
    if (!anchor || !other) return;
    const dirProj = fixedPos ?? projectPointOnLine(click, anchor, other);
    model.points[pointIdx] = { ...point, x: dirProj.x, y: dirProj.y };
    if (hit.part === 'rayLeft') {
      const insertAt = Math.min(1, line.points.length);
      line.points.splice(insertAt, 0, pointIdx);
      reorderLinePoints(hit.line);
      clearSelectedSegmentsForLine(hit.line);
      selectedSegments.add(segmentKey(hit.line, 'segment', 0));
    } else {
      const insertAt = Math.max(line.points.length - 1, 1);
      line.points.splice(insertAt, 0, pointIdx);
      reorderLinePoints(hit.line);
      clearSelectedSegmentsForLine(hit.line);
      const segIdx = Math.max(0, line.points.length - 2);
      selectedSegments.add(segmentKey(hit.line, 'segment', segIdx));
    }
  }
  if (line.id) applyPointConstruction(pointIdx, [{ kind: 'line', id: line.id }]);
  ensureSegmentStylesForLine(hit.line);
  clearSelectedSegmentsForLine(hit.line);
  recomputeIntersectionPoint(pointIdx);
}

function projectPointOnSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return { x: a.x, y: a.y };
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2)
  );
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function projectPointOnLine(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return { x: a.x, y: a.y };
  const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function constrainToCircles(idx: number, desired: { x: number; y: number }) {
  const circleIdxs = circlesContainingPoint(idx);
  if (!circleIdxs.length) return desired;
  const circle = model.circles[circleIdxs[0]];
  const center = model.points[circle.center];
  const current = model.points[idx];
  if (!center || !current) return desired;
  const radius = circleRadius(circle);
  if (radius <= 0) return desired;
  let dir = { x: desired.x - center.x, y: desired.y - center.y };
  let len = Math.hypot(dir.x, dir.y);
  if (len < 1e-6) {
    dir = { x: current.x - center.x, y: current.y - center.y };
    len = Math.hypot(dir.x, dir.y) || 1;
  }
  const norm = { x: dir.x / len, y: dir.y / len };
  return { x: center.x + norm.x * radius, y: center.y + norm.y * radius };
}

function constrainToLineParent(idx: number, desired: { x: number; y: number }) {
  const p = model.points[idx];
  if (!p) return desired;
  const line = primaryLineParent(p);
  if (!line || line.points.length < 2) return desired;
  const a = model.points[line.points[0]];
  const b = model.points[line.points[line.points.length - 1]];
  if (!a || !b) return desired;
  return projectPointOnLine(desired, a, b);
}

function constrainToLineIdx(lineIdx: number | null | undefined, desired: { x: number; y: number }) {
  if (lineIdx === null || lineIdx === undefined) return desired;
  const line = model.lines[lineIdx];
  if (!line || line.points.length < 2) return desired;
  // Use DEFINING points to establish the line, not first/last in sorted array
  const aIdx = line.defining_points?.[0] ?? line.points[0];
  const bIdx = line.defining_points?.[1] ?? line.points[line.points.length - 1];
  const a = model.points[aIdx];
  const b = model.points[bIdx];
  if (!a || !b) return desired;
  return projectPointOnLine(desired, a, b);
}

function lineCircleIntersections(
  a: { x: number; y: number },
  b: { x: number; y: number },
  center: { x: number; y: number },
  radius: number,
  clampToSegment = true
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - center.x;
  const fy = a.y - center.y;
  const aCoeff = dx * dx + dy * dy;
  const bCoeff = 2 * (fx * dx + fy * dy);
  const cCoeff = fx * fx + fy * fy - radius * radius;
  const disc = bCoeff * bCoeff - 4 * aCoeff * cCoeff;
  if (disc < 0) return [] as { x: number; y: number }[];
  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-bCoeff - sqrtDisc) / (2 * aCoeff);
  const t2 = (-bCoeff + sqrtDisc) / (2 * aCoeff);
  const res: { x: number; y: number }[] = [];
  [t1, t2].forEach((t) => {
    if (!Number.isFinite(t)) return;
    if (clampToSegment && (t < 0 || t > 1)) return;
    res.push({ x: a.x + dx * t, y: a.y + dy * t });
  });
  return res;
}

function circleCircleIntersections(
  c1: { x: number; y: number },
  r1: number,
  c2: { x: number; y: number },
  r2: number
) {
  const d = Math.hypot(c2.x - c1.x, c2.y - c1.y);
  if (d === 0 || d > r1 + r2 || d < Math.abs(r1 - r2)) return [] as { x: number; y: number }[];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(r1 * r1 - a * a, 0));
  const xm = c1.x + (a * (c2.x - c1.x)) / d;
  const ym = c1.y + (a * (c2.y - c1.y)) / d;
  const rx = -(c2.y - c1.y) * (h / d);
  const ry = -(c2.x - c1.x) * (h / d);
  return [
    { x: xm + rx, y: ym - ry },
    { x: xm - rx, y: ym + ry }
  ];
}

function insertPointIntoLine(lineIdx: number, pointIdx: number, pos: { x: number; y: number }) {
  const line = model.lines[lineIdx];
  if (!line) return;
  if (line.points.includes(pointIdx)) return;
  const origin = model.points[line.points[0]];
  const end = model.points[line.points[line.points.length - 1]];
  if (!origin || !end) return;
  const dir = normalize({ x: end.x - origin.x, y: end.y - origin.y });
  const len = Math.hypot(end.x - origin.x, end.y - origin.y) || 1;
  const tFor = (p: { x: number; y: number }) => ((p.x - origin.x) * dir.x + (p.y - origin.y) * dir.y) / len;
  const tNew = tFor(pos);
  const params = line.points.map((idx) => tFor(model.points[idx]));
  let insertAt = params.findIndex((t) => t > tNew + 1e-6);
  if (insertAt === -1) insertAt = line.points.length;
  line.points.splice(insertAt, 0, pointIdx);
  rebuildSegmentStylesAfterInsert(line, insertAt);
  clearSelectedSegmentsForLine(lineIdx);
}

function attachPointToCircle(circleIdx: number, pointIdx: number, pos: { x: number; y: number }) {
  const circle = model.circles[circleIdx];
  const center = model.points[circle.center];
  if (!circle || !center) return;
  const radius = circleRadius(circle);
  if (radius <= 0) return;
  const angle = Math.atan2(pos.y - center.y, pos.x - center.x);
  const target = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
  model.points[pointIdx] = { ...model.points[pointIdx], ...target };
  if (!circle.points.includes(pointIdx)) circle.points.push(pointIdx);
  applyPointConstruction(pointIdx, [{ kind: 'circle', id: circle.id }]);
  if (selectedCircleIndex === circleIdx) {
    selectedArcSegments.clear();
  }
  recomputeIntersectionPoint(pointIdx);
}

function intersectLines(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number }
): { x: number; y: number } | null {
  const dxa = a2.x - a1.x;
  const dya = a2.y - a1.y;
  const dxb = b2.x - b1.x;
  const dyb = b2.y - b1.y;
  const denom = dxa * dyb - dya * dxb;
  if (Math.abs(denom) < 1e-6) return null;
  const t = ((b1.x - a1.x) * dyb - (b1.y - a1.y) * dxb) / denom;
  return { x: a1.x + dxa * t, y: a1.y + dya * t };
}

function enforceIntersections(lineIdx: number) {
  const line = model.lines[lineIdx];
  if (!line || line.points.length < 2) return;
  const a = model.points[line.points[0]];
  const b = model.points[line.points[line.points.length - 1]];
  if (!a || !b) return;
  line.points.forEach((pIdx) => {
    const otherLines = findLinesContainingPoint(pIdx).filter((li) => li !== lineIdx);
    if (!otherLines.length) return;
    otherLines.forEach((li) => {
      const other = model.lines[li];
      if (!other || other.points.length < 2) return;
      const oa = model.points[other.points[0]];
      const ob = model.points[other.points[other.points.length - 1]];
      if (!oa || !ob) return;
      const inter = intersectLines(a, b, oa, ob);
      if (inter) {
        model.points[pIdx] = { ...model.points[pIdx], ...inter };
      }
    });
  });
}

function getLineHandle(lineIdx: number) {
  const line = model.lines[lineIdx];
  if (!line) return null;
  if (line.hidden && !showHidden) return null;
  const raysHidden = (!line.leftRay || line.leftRay.hidden) && (!line.rightRay || line.rightRay.hidden);
  if (!raysHidden) return null;
  const extent = lineExtent(lineIdx);
  if (!extent) return null;
  const end = extent.endPointCoord;
  // offset handle further along the line direction and slightly perpendicular to avoid overlap
  const offset = 26;
  const vec = { x: end.x - extent.center.x, y: end.y - extent.center.y };
  const len = Math.hypot(vec.x, vec.y) || 1;
  const dir = { x: vec.x / len, y: vec.y / len };
  const perp = { x: -dir.y, y: dir.x };
  const perpOffset = 8;
  return {
    x: end.x + dir.x * offset + perp.x * perpOffset,
    y: end.y + dir.y * offset + perp.y * perpOffset
  };
}

function lineExtent(lineIdx: number) {
  const line = model.lines[lineIdx];
  if (!line) return null;
  if (line.points.length < 2) return null;
  const a = model.points[line.points[0]];
  const b = model.points[line.points[line.points.length - 1]];
  if (!a || !b) return null;
  const dirVec = { x: b.x - a.x, y: b.y - a.y };
  const len = Math.hypot(dirVec.x, dirVec.y) || 1;
  const dir = { x: dirVec.x / len, y: dirVec.y / len };
  const base = a;
  const projections: { idx: number; proj: number }[] = [];
  line.points.forEach((idx) => {
    if (!projections.some((p) => p.idx === idx)) {
      const p = model.points[idx];
      if (p) projections.push({ idx, proj: (p.x - base.x) * dir.x + (p.y - base.y) * dir.y });
    }
  });
  if (!projections.length) return null;
  const sorted = projections.sort((p1, p2) => p1.proj - p2.proj);
  const startProj = sorted[0];
  const endProj = sorted[sorted.length - 1];
  const centerProj = (startProj.proj + endProj.proj) / 2;
  const center = { x: base.x + dir.x * centerProj, y: base.y + dir.y * centerProj };
  const startPoint = model.points[startProj.idx];
  const endPoint = model.points[endProj.idx];
  const half = Math.abs(endProj.proj - centerProj);
  return {
    center,
    centerProj,
    dir,
    startPoint,
    endPoint,
    order: sorted,
    half,
    endPointIdx: endProj.idx,
    endPointCoord: endPoint ?? { x: base.x + dir.x * endProj.proj, y: base.y + dir.y * endProj.proj }
  };
}

function enforceAxisAlignment(lineIdx: number, axis: 'horizontal' | 'vertical') {
  const line = model.lines[lineIdx];
  if (!line) return;
  const refPoints = line.points
    .map((idx) => model.points[idx])
    .filter((pt): pt is Point => !!pt);
  if (!refPoints.length) return;
  const movable = line.points.filter((idx) => {
    const pt = model.points[idx];
    if (!pt) return false;
    if (!isPointDraggable(pt)) return false;
    if (circlesWithCenter(idx).length > 0) return false;
    return true;
  });
  if (!movable.length) return;
  const axisValue = axis === 'horizontal'
    ? refPoints.reduce((sum, p) => sum + p.y, 0) / refPoints.length
    : refPoints.reduce((sum, p) => sum + p.x, 0) / refPoints.length;
  const moved = new Set<number>();
  movable.forEach((idx) => {
    const pt = model.points[idx];
    if (!pt) return;
    if (axis === 'horizontal') {
      if (pt.y !== axisValue) {
        model.points[idx] = { ...pt, y: axisValue };
        moved.add(idx);
      }
    } else if (pt.x !== axisValue) {
      model.points[idx] = { ...pt, x: axisValue };
      moved.add(idx);
    }
  });
  if (moved.size) {
    updateIntersectionsForLine(lineIdx);
    updateParallelLinesForLine(lineIdx);
    updatePerpendicularLinesForLine(lineIdx);
    moved.forEach((idx) => {
      updateMidpointsForPoint(idx);
      updateCirclesForPoint(idx);
    });
  }
}

function polygonForLine(lineIdx: number): number | null {
  for (let i = 0; i < model.polygons.length; i++) {
    if (model.polygons[i].lines.includes(lineIdx)) return i;
  }
  return null;
}

function polygonHasPoint(pointIdx: number, poly: Polygon | undefined): boolean {
  if (!poly) return false;
  return poly.lines.some((li) => {
    const line = model.lines[li];
    return !!line && line.points.includes(pointIdx);
  });
}

function polygonVertices(polyIdx: number): number[] {
  const poly = model.polygons[polyIdx];
  const pts = new Set<number>();
  poly.lines.forEach((li) => model.lines[li]?.points.forEach((p) => pts.add(p)));
  return Array.from(pts);
}

function polygonVerticesOrdered(polyIdx: number): number[] {
  const lines = model.polygons[polyIdx]?.lines ?? [];
  const verts: number[] = [];
  lines.forEach((li) => {
    const line = model.lines[li];
    if (!line) return;
    const start = line.points[0];
    const end = line.points[line.points.length - 1];
    verts.push(start, end);
  });
  const uniqueVerts = Array.from(new Set(verts));
  const points = uniqueVerts.map((idx) => ({ idx, p: model.points[idx] })).filter((v) => !!v.p);
  if (!points.length) return [];
  const centroid = {
    x: points.reduce((s, v) => s + v.p.x, 0) / points.length,
    y: points.reduce((s, v) => s + v.p.y, 0) / points.length
  };
  points.sort(
    (a, b) => Math.atan2(a.p.y - centroid.y, a.p.x - centroid.x) - Math.atan2(b.p.y - centroid.y, b.p.x - centroid.x)
  );
  const startIdx = points.reduce((best, cur, i) => {
    const bestPt = points[best].p;
    const curPt = cur.p;
    if (curPt.y > bestPt.y + 1e-6) return i;
    if (Math.abs(curPt.y - bestPt.y) < 1e-6 && curPt.x < bestPt.x) return i;
    return best;
  }, 0);
  const ordered: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const idx = (startIdx - i + points.length) % points.length;
    ordered.push(points[idx].idx);
  }
  return ordered;
}

function ensurePolygonClosed(poly: Polygon): Polygon {
  // Jeśli za mało linii – nic nie robimy (prawdziwy wielokąt wymaga >=2 linii do sensownego sprawdzenia)
  if (poly.lines.length < 2) return poly;

  // Zbuduj ciąg wierzchołków na podstawie kolejności linii.
  const verts: number[] = [];
  for (const li of poly.lines) {
    const line = model.lines[li];
    if (!line || line.defining_points.length < 2) continue;
    const s = line.defining_points[0];
    const e = line.defining_points[1];
    if (verts.length === 0) {
      verts.push(s, e);
    } else {
      const last = verts[verts.length - 1];
      if (s === last) {
        verts.push(e);
      } else if (e === last) {
        verts.push(s);
      } else {
        // próba dopięcia od przodu
        const first = verts[0];
        if (e === first) {
          verts.unshift(s);
        } else if (s === first) {
          verts.unshift(e);
        } else {
          // rozłączna linia – pozostawiamy (może być chwilowo po remapie); ignorujemy w domykaniu
        }
      }
    }
  }

  // Usuwamy ewentualne duplikaty następujące po sobie (jeśli wstawiono identyczny punkt dwa razy).
  const orderedVerts: number[] = [];
  for (let i = 0; i < verts.length; i++) {
    if (i === 0 || verts[i] !== verts[i - 1]) orderedVerts.push(verts[i]);
  }
  if (orderedVerts.length < 3 || (orderedVerts[orderedVerts.length-1] == orderedVerts[0])) return poly; // domknięty lub za mało wierzchołków na sensowny wielokąt

  // Pomocniczo: sprawdzenie czy istnieje linia między dwoma punktami.
  const hasEdge = (a: number, b: number) =>
    poly.lines.some((li) => {
      const line = model.lines[li];
      if (!line || line.defining_points.length < 2) return false;
      const s = line.defining_points[0];
      const e = line.defining_points[1];
      return (s === a && e === b) || (s === b && e === a);
    });

  // Styl bazowy dla nowych linii (pierwsza istniejąca albo domyślny).
  const baseStyle = (() => {
    for (const li of poly.lines) {
      const line = model.lines[li];
      if (line) return { ...line.style };
    }
    return currentStrokeStyle();
  })();

  const newLineIndices: number[] = [];

  // Dodaj brakujące krawędzie między kolejnymi wierzchołkami.
  for (let i = 0; i < orderedVerts.length - 1; i++) {
    const a = orderedVerts[i];
    const b = orderedVerts[i + 1];
    if (!hasEdge(a, b)) {
      const ln = addLineFromPoints(model, a, b, { ...baseStyle });
      newLineIndices.push(ln);
    }
  }

  // Domknięcie ostatni -> pierwszy.
  const first = orderedVerts[0];
  const last = orderedVerts[orderedVerts.length - 1];
  if (!hasEdge(last, first)) {
    const ln = addLineFromPoints(model, last, first, { ...baseStyle });
    newLineIndices.push(ln);
  }

  if (newLineIndices.length === 0) return poly;
  return { ...poly, lines: [...poly.lines, ...newLineIndices] };
}

function remapAngles(lineRemap: Map<number, number>) {
  model.angles = model.angles.filter((ang) => {
    const newLeg1Line = lineRemap.get(ang.leg1.line);
    const newLeg2Line = lineRemap.get(ang.leg2.line);
    
    // Remove angle if either of its legs references a deleted line (mapped to -1 or undefined)
    if (newLeg1Line === undefined || newLeg1Line < 0 || newLeg2Line === undefined || newLeg2Line < 0) {
      if (ang.label) reclaimLabel(ang.label);
      return false;
    }
    
    // Update the angle's leg line references
    ang.leg1.line = newLeg1Line;
    ang.leg2.line = newLeg2Line;
    return true;
  });
}

function remapPolygons(lineRemap: Map<number, number>) {
  const remapped = model.polygons
  .map((poly) => {
      const lines = poly.lines
        .map((li) => lineRemap.get(li))
        .filter((v): v is number => v !== undefined && v >= 0);
      return {
        object_type: 'polygon' as const,
        id: poly.id,
        lines,
        construction_kind: poly.construction_kind,
        defining_parents: [...poly.defining_parents],
        children: [...poly.children],
        recompute: poly.recompute,
        on_parent_deleted: poly.on_parent_deleted
      };
    })
    .filter((p) => p.lines.length > 1);
    model.polygons = remapped.map((poly) => ensurePolygonClosed(poly)).filter((p) => p.lines.length >= 3);
  rebuildIndexMaps();
}

function lineIndexById(id: string): number | null {
  const idx = model.indexById.line[id];
  return Number.isInteger(idx) ? (idx as number) : null;
}

function pointIndexById(id: string): number | null {
  const idx = model.points.findIndex((p) => p.id === id);
  return idx >= 0 ? idx : null;
}

function anyIndexById(id: string): { kind: GeometryKind; idx: number } | null {
  const kinds: GeometryKind[] = ['point', 'line', 'circle', 'angle', 'polygon'];
  for (const k of kinds) {
    const mapIdx = model.indexById[k][id];
    if (Number.isInteger(mapIdx)) return { kind: k, idx: mapIdx as number };
  }
  return null;
}

function friendlyLabelForId(id: string): string {
  const resolved = anyIndexById(id);
  if (!resolved) return '?';
  // if (!resolved) return id;
  const prefix = LABEL_PREFIX[resolved.kind] ?? '';
  return `${prefix}${resolved.idx + 1}`;
}

function primaryLineParent(p: Point): Line | null {
  const lp = p.parent_refs.find((pr) => pr.kind === 'line');
  if (!lp) return null;
  const idx = lineIndexById(lp.id);
  if (idx === null) return null;
  return model.lines[idx] ?? null;
}

function ensureSegmentStylesForLine(lineIdx: number) {
  const line = model.lines[lineIdx];
  if (!line) return;
  const segCount = Math.max(0, line.points.length - 1);
  const srcStyles = line.segmentStyles ?? [];
  const srcKeys = line.segmentKeys ?? [];
  const styles: StrokeStyle[] = [];
  const keys: string[] = [];
  for (let i = 0; i < segCount; i++) {
    const key = segmentKeyForPoints(line.points[i], line.points[i + 1]);
    const existingIdx = srcKeys.indexOf(key);
    const base =
      (existingIdx >= 0 ? srcStyles[existingIdx] : srcStyles[Math.min(i, srcStyles.length - 1)]) ?? line.style;
    styles.push({ ...base });
    keys.push(key);
  }
  line.segmentStyles = styles;
  line.segmentKeys = keys;
}

function reorderLinePoints(lineIdx: number) {
  const line = model.lines[lineIdx];
  if (!line) return;
  const aIdx = line.defining_points?.[0] ?? line.points[0];
  const bIdx = line.defining_points?.[1] ?? line.points[line.points.length - 1];
  const a = model.points[aIdx];
  const b = model.points[bIdx];
  if (!a || !b) return;
  const dir = normalize({ x: b.x - a.x, y: b.y - a.y });
  const unique = Array.from(new Set(line.points));
  // Sort ALL points (including defining_points) by their position along the line
  unique.sort((p1, p2) => {
    const pt1 = model.points[p1];
    const pt2 = model.points[p2];
    if (!pt1 || !pt2) return 0;
    const t1 = (pt1.x - a.x) * dir.x + (pt1.y - a.y) * dir.y;
    const t2 = (pt2.x - a.x) * dir.x + (pt2.y - a.y) * dir.y;
    return t1 - t2;
  });
  line.points = unique;
  ensureSegmentStylesForLine(lineIdx);
}

function applyDebugPanelPosition() {
  if (!debugPanel || !debugPanelPos) return;
  debugPanel.style.left = `${debugPanelPos.x}px`;
  debugPanel.style.top = `${debugPanelPos.y}px`;
}

function ensureDebugPanelPosition() {
  if (!debugPanel || debugPanel.style.display === 'none') return;
  const rect = debugPanel.getBoundingClientRect();
  const width = rect.width || debugPanel.offsetWidth || 320;
  const height = rect.height || debugPanel.offsetHeight || 240;
  const maxX = Math.max(DEBUG_PANEL_MARGIN.x, window.innerWidth - width - DEBUG_PANEL_MARGIN.x);
  const maxY = Math.max(DEBUG_PANEL_TOP_MIN, window.innerHeight - height - DEBUG_PANEL_MARGIN.y);
  if (!debugPanelPos) {
    debugPanelPos = {
      x: clamp(window.innerWidth - width - DEBUG_PANEL_MARGIN.x, DEBUG_PANEL_MARGIN.x, maxX),
      y: clamp(80, DEBUG_PANEL_TOP_MIN, maxY)
    };
  } else {
    debugPanelPos = {
      x: clamp(debugPanelPos.x, DEBUG_PANEL_MARGIN.x, maxX),
      y: clamp(debugPanelPos.y, DEBUG_PANEL_TOP_MIN, maxY)
    };
  }
  applyDebugPanelPosition();
}

function endDebugPanelDrag(pointerId?: number) {
  if (!debugDragState) return;
  if (pointerId !== undefined && debugDragState.pointerId !== pointerId) return;
  try {
    debugPanelHeader?.releasePointerCapture(debugDragState.pointerId);
  } catch (err) {
    // ignore
  }
  debugPanel?.classList.remove('debug-panel--dragging');
  debugDragState = null;
}

function renderDebugPanel() {
  if (!debugPanel || !debugContent) return;
  if (!debugVisible) {
    debugPanel.style.display = 'none';
    debugPanel.setAttribute('aria-hidden', 'true');
    endDebugPanelDrag();
    return;
  }

  debugPanel.style.display = 'flex';
  debugPanel.setAttribute('aria-hidden', 'false');
  const sections: string[] = [];
  const fmtList = (items: string[]) => (items.length ? items.join(', ') : '');
  const setPart = (ids: string[], joiner = ', ') => (ids.length ? ids.map(friendlyLabelForId).join(joiner) : '');
  const fmtPoint = (p: Point) => {
    const coords = ` <span style="color:#9ca3af;">(${p.x.toFixed(1)}, ${p.y.toFixed(1)})</span>`;
    const parentLabels = (p.parent_refs ?? []).map((pr) => friendlyLabelForId(pr.id));
    const parentsInfo = (() => {
      if (!parentLabels.length) return '';
      if (p.construction_kind === 'intersection' && parentLabels.length === 2) {
        return ` <span style="color:#9ca3af;">${parentLabels[0]} ∩ ${parentLabels[1]}</span>`;
      }
      // Don't show parents for on_object - they'll be shown in kindInfo with ∈ symbol
      if (p.construction_kind === 'on_object') return '';
      return ` <span style="color:#9ca3af;">${parentLabels.join(', ')}</span>`;
    })();
    const kindInfo = (() => {
      if (!p.construction_kind || p.construction_kind === 'free' || p.construction_kind === 'intersection') return '';
      if (p.construction_kind === 'on_object' && parentLabels.length > 0) {
        return ` <span style="color:#9ca3af;">∈ ${parentLabels[0]}</span>`;
      }
      return ` <span style="color:#9ca3af;">${p.construction_kind}</span>`;
    })();
    const hiddenInfo = p.style.hidden ? ' <span style="color:#ef4444;">hidden</span>' : '';
    return `${friendlyLabelForId(p.id)}${parentsInfo}${kindInfo}${coords}${hiddenInfo}`;
  };

  const ptRows = model.points.map((p) => fmtPoint(p));
  if (ptRows.length) {
    sections.push(
      `<div style="margin-bottom:12px;"><div style="font-weight:600;margin-bottom:4px;">Punkty (${ptRows.length})</div><div>${ptRows
        .map((r) => `<div style="margin-bottom:3px;line-height:1.4;">${r}</div>`)
        .join('')}</div></div>`
    );
  }

  const lineRows = model.lines.map((l) => {
    const isParallel = isParallelLine(l);
    const isPerpendicular = isPerpendicularLine(l);
    const children = setPart(l.children);
    const anchorId = isParallel ? l.parallel!.throughPoint : isPerpendicular ? l.perpendicular!.throughPoint : null;
    const referenceId = isParallel
      ? l.parallel!.referenceLine
      : isPerpendicular
      ? l.perpendicular!.referenceLine
      : null;
    const relationSymbol = isParallel ? '∥' : isPerpendicular ? '⊥' : '';
    
    // Show all points on the line, with defining_points highlighted
    const allPointLabels = l.points
      .map((pi) => {
        const p = model.points[pi];
        if (!p) return null;
        const label = friendlyLabelForId(p.id);
        const isDefining = l.defining_points.includes(pi);
        return isDefining ? `<b>${label}</b>` : label;
      })
      .filter((v): v is string => !!v);
    const pointsPart = allPointLabels.length > 0 ? `[${allPointLabels.join(', ')}]` : '';
    
    const childTail = children ? ` <span style="color:#9ca3af;">↘ ${children}</span>` : '';
    const relationTail = relationSymbol && referenceId
      ? ` ${relationSymbol} ${friendlyLabelForId(referenceId)}`
      : '';
    return `<div style="margin-bottom:3px;line-height:1.4;">${friendlyLabelForId(l.id)} ${pointsPart}${relationTail}${childTail}</div>`;
  });
  if (lineRows.length) {
    sections.push(
      `<div style="margin-bottom:12px;"><div style="font-weight:600;margin-bottom:4px;">Linie (${lineRows.length})</div>${lineRows.join('')}</div>`
    );
  }

  const circleRows = model.circles.map((c) => {
    const center = model.points[c.center];
    const centerLabel = center ? friendlyLabelForId(center.id) : `p${c.center}`;
    const parents = setPart(c.defining_parents);
    const children = setPart(c.children);
    const meta =
      parents || children
        ? ` <span style="color:#9ca3af;">${[parents && `⊂ ${parents}`, children && `↘ ${children}`]
            .filter(Boolean)
            .join(' • ')}</span>`
        : '';

    const main = isCircleThroughPoints(c)
      ? `[${c.defining_points
        .map((pi) => friendlyLabelForId(model.points[pi]?.id ?? `p${pi}`))
        .join(', ')}] {${centerLabel}}`
      : (() => {
        const radiusLabel = friendlyLabelForId(model.points[c.radius_point]?.id ?? `p${c.radius_point}`);
        const radiusValue = circleRadius(c).toFixed(1);
        return `[${centerLabel}, ${radiusLabel}] <span style="color:#9ca3af;">r=${radiusValue}</span>`;
      })();

    return `<div style="margin-bottom:3px;line-height:1.4;">${friendlyLabelForId(c.id)} ${main}${meta}</div>`;
  });
  if (circleRows.length) {
    sections.push(
      `<div style="margin-bottom:12px;"><div style="font-weight:600;margin-bottom:4px;">Okręgi (${circleRows.length})</div>${circleRows.join('')}</div>`
    );
  }

  const polyRows = model.polygons.map((p) => {
    const lines = p.lines.map((li) => friendlyLabelForId(model.lines[li]?.id ?? `l${li}`)).join(', ');
    const parents = setPart(p.defining_parents);
    const children = setPart(p.children);
    const meta =
      parents || children
        ? ` <span style="color:#9ca3af;">${[parents && `⊂ ${parents}`, children && `↘ ${children}`]
            .filter(Boolean)
            .join(' • ')}</span>`
        : '';
    return `<div style="margin-bottom:3px;line-height:1.4;">${friendlyLabelForId(p.id)} [${lines}${meta}]</div>`;
  });
  if (polyRows.length) {
    sections.push(
      `<div style="margin-bottom:12px;"><div style="font-weight:600;margin-bottom:4px;">Wielokąty (${polyRows.length})</div>${polyRows.join('')}</div>`
    );
  }

  const angleRows = model.angles.map((a) => {
    const l1 = model.lines[a.leg1.line];
    const l2 = model.lines[a.leg2.line];
    const parents = setPart(a.defining_parents);
    const children = setPart(a.children);
    const meta =
      parents || children
        ? ` <span style="color:#9ca3af;">${[parents && `⊂ ${parents}`, children && `↘ ${children}`]
            .filter(Boolean)
            .join(' • ')}</span>`
        : '';

    // Prefer showing the traditional three-point representation: [point_on_leg1, vertex, point_on_leg2]
    // Compute the point on each leg that is different from the vertex (using the segment endpoints)
    if (l1 && l2) {
      const vIdx = a.vertex;
      const a1Idx = l1.points[a.leg1.seg];
      const b1Idx = l1.points[a.leg1.seg + 1];
      const a2Idx = l2.points[a.leg2.seg];
      const b2Idx = l2.points[a.leg2.seg + 1];
      const p1Idx = vIdx === a1Idx ? b1Idx : a1Idx;
      const p2Idx = vIdx === a2Idx ? b2Idx : a2Idx;
      const p1Label = friendlyLabelForId(model.points[p1Idx]?.id ?? `p${p1Idx}`);
      const vertexLabel = friendlyLabelForId(model.points[vIdx]?.id ?? `p${vIdx}`);
      const p2Label = friendlyLabelForId(model.points[p2Idx]?.id ?? `p${p2Idx}`);
      return `<div style="margin-bottom:3px;line-height:1.4;">${friendlyLabelForId(a.id)} [${p1Label}, ${vertexLabel}, ${p2Label}]${meta}</div>`;
    }

    // Fallback: show vertex and the two leg labels if line data isn't available
    const vertexLabel = friendlyLabelForId(model.points[a.vertex]?.id ?? `p${a.vertex}`);
    const leg1Label = l1 ? friendlyLabelForId(l1.id) : `l${a.leg1.line}`;
    const leg2Label = l2 ? friendlyLabelForId(l2.id) : `l${a.leg2.line}`;
    return `<div style="margin-bottom:3px;line-height:1.4;">${friendlyLabelForId(a.id)} [${vertexLabel}, ${leg1Label}, ${leg2Label}]${meta}</div>`;
  });
  if (angleRows.length) {
    sections.push(
      `<div style="margin-bottom:12px;"><div style="font-weight:600;margin-bottom:4px;">Kąty (${angleRows.length})</div>${angleRows.join('')}</div>`
    );
  }

  debugContent.innerHTML = sections.length
    ? sections.join('')
    : '<div style="color:#9ca3af;">Brak obiektów do wyświetlenia.</div>';

  requestAnimationFrame(() => ensureDebugPanelPosition());
}

function drawDebugLabels() {
  if (!debugVisible || !ctx) return;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = '12px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const labels: { x: number; y: number; w: number; h: number; text: string }[] = [];
  const padding = 4;
  const h = 16;

  const addLabel = (pos: { x: number; y: number }, text: string) => {
    const screenPos = worldToCanvas(pos.x, pos.y);
    const metrics = ctx!.measureText(text);
    const w = metrics.width + padding * 2;
    labels.push({
      x: screenPos.x,
      y: screenPos.y,
      w,
      h,
      text
    });
  };

  model.points.forEach((p) => {
    if (p.style.hidden && !showHidden) return;
    const topOffset = pointRadius(p.style.size) / zoomFactor + screenUnits(10);
    addLabel({ x: p.x, y: p.y - topOffset }, friendlyLabelForId(p.id));
  });
  model.lines.forEach((l, idx) => {
    if (l.hidden && !showHidden) return;
    const ext = lineExtent(idx);
    if (!ext) return;
    addLabel({ x: ext.center.x, y: ext.center.y - screenUnits(10) }, friendlyLabelForId(l.id));
  });
  model.circles.forEach((c) => {
    if (c.hidden && !showHidden) return;
    const center = model.points[c.center];
    if (!center) return;
    const radius = circleRadius(c);
    addLabel({ x: center.x, y: center.y - radius - screenUnits(10) }, friendlyLabelForId(c.id));
  });
  model.angles.forEach((a) => {
    const v = model.points[a.vertex];
    if (!v) return;
    addLabel({ x: v.x + screenUnits(12), y: v.y + screenUnits(12) }, friendlyLabelForId(a.id));
  });
  model.polygons.forEach((p, idx) => {
    const centroid = polygonCentroid(idx);
    if (!centroid) return;
    addLabel(centroid, friendlyLabelForId(p.id));
  });

  // Collision resolution
  for (let iter = 0; iter < 5; iter++) {
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i];
        const b = labels[j];
        
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        
        const w = (a.w + b.w) / 2 + 2; // +2 padding
        const h = (a.h + b.h) / 2 + 2;
        
        if (Math.abs(dx) < w && Math.abs(dy) < h) {
          // Overlap
          const ox = w - Math.abs(dx);
          const oy = h - Math.abs(dy);
          
          if (ox < oy) {
            // Push in X
            const dir = dx > 0 ? 1 : -1;
            a.x += dir * ox * 0.5;
            b.x -= dir * ox * 0.5;
          } else {
            // Push in Y
            const dir = dy > 0 ? 1 : -1;
            a.y += dir * oy * 0.5;
            b.y -= dir * oy * 0.5;
          }
        }
      }
    }
  }

  labels.forEach((l) => {
    ctx!.save();
    ctx!.translate(l.x, l.y);
    ctx!.fillStyle = 'rgba(17,24,39,0.8)';
    ctx!.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx!.lineWidth = 1;
    ctx!.beginPath();
    ctx!.roundRect(-l.w / 2, -l.h / 2, l.w, l.h, 4);
    ctx!.fill();
    ctx!.stroke();
    ctx!.fillStyle = '#e5e7eb';
    ctx!.fillText(l.text, 0, 0); // Centered because textAlign is center? No, wait.
    ctx!.restore();
  });

  ctx.restore();
}

function recomputeIntersectionPoint(pointIdx: number) {
  const point = model.points[pointIdx];
  if (!point || point.parent_refs.length !== 2) return;
  const [pa, pb] = point.parent_refs;
  const finalize = () => updateMidpointsForPoint(pointIdx);

  const styleWithHidden = (target: Point, hidden: boolean) => {
    const currentHidden = target.style.hidden ?? false;
    if (hidden === currentHidden) return target.style;
    return { ...target.style, hidden };
  };

  // line-line
  if (pa.kind === 'line' && pb.kind === 'line') {
    const lineAIdx = lineIndexById(pa.id);
    const lineBIdx = lineIndexById(pb.id);
    if (lineAIdx === null || lineBIdx === null) return;
    const lineA = model.lines[lineAIdx];
    const lineB = model.lines[lineBIdx];
    if (!lineA || !lineB || lineA.points.length < 2 || lineB.points.length < 2) return;
    const a1 = model.points[lineA.points[0]];
    const a2 = model.points[lineA.points[lineA.points.length - 1]];
    const b1 = model.points[lineB.points[0]];
    const b2 = model.points[lineB.points[lineB.points.length - 1]];
    if (!a1 || !a2 || !b1 || !b2) return;
    const inter = intersectLines(a1, a2, b1, b2);
    if (inter) {
      model.points[pointIdx] = { ...point, x: inter.x, y: inter.y, style: styleWithHidden(point, false) };
    }
    finalize();
    return;
  }

  // line-circle
  if ((pa.kind === 'line' && pb.kind === 'circle') || (pa.kind === 'circle' && pb.kind === 'line')) {
    const lineRef = pa.kind === 'line' ? pa : pb;
    const circRef = pa.kind === 'circle' ? pa : pb;
    const lineIdx = lineIndexById(lineRef.id);
    const circleIdx = model.indexById.circle[circRef.id];
    if (lineIdx === null || circleIdx === undefined) return;
    const line = model.lines[lineIdx];
    const circle = model.circles[circleIdx];
    if (!line || !circle || line.points.length < 2) return;
    const a = model.points[line.points[0]];
    const b = model.points[line.points[line.points.length - 1]];
    const center = model.points[circle.center];
    const radius = circleRadius(circle);
    if (!a || !b || !center || radius <= 0) return;
    const pts = lineCircleIntersections(a, b, center, radius, false);
    if (!pts.length) {
      const fallback = projectPointOnLine({ x: point.x, y: point.y }, a, b);
      model.points[pointIdx] = { ...point, ...fallback, style: styleWithHidden(point, true) };
      finalize();
      return;
    }
    pts.sort((p1, p2) => Math.hypot(p1.x - point.x, p1.y - point.y) - Math.hypot(p2.x - point.x, p2.y - point.y));
    const best = pts[0];
    model.points[pointIdx] = { ...point, x: best.x, y: best.y, style: styleWithHidden(point, false) };
    finalize();
    return;
  }

  // circle-circle
  if (pa.kind === 'circle' && pb.kind === 'circle') {
    const circleAIdx = model.indexById.circle[pa.id];
    const circleBIdx = model.indexById.circle[pb.id];
    if (circleAIdx === undefined || circleBIdx === undefined) return;
    const circleA = model.circles[circleAIdx];
    const circleB = model.circles[circleBIdx];
    if (!circleA || !circleB) return;
    const centerA = model.points[circleA.center];
    const centerB = model.points[circleB.center];
    const radiusA = circleRadius(circleA);
    const radiusB = circleRadius(circleB);
    if (!centerA || !centerB || radiusA <= 0 || radiusB <= 0) return;
    const pts = circleCircleIntersections(centerA, radiusA, centerB, radiusB);
    const shareSameParentPair = (other: Point) => {
      if (other.parent_refs.length !== 2) return false;
      const circles = other.parent_refs.filter((pr) => pr.kind === 'circle');
      if (circles.length !== 2) return false;
      const ids = circles.map((pr) => pr.id);
      return ids.includes(pa.id) && ids.includes(pb.id);
    };
    const siblingIdxs = model.points
      .map((other, idx) => (idx !== pointIdx && other && other.construction_kind === 'intersection' && shareSameParentPair(other) ? idx : null))
      .filter((idx): idx is number => idx !== null);
    const groupIdxs = [pointIdx, ...siblingIdxs].filter((idx, i, arr) => arr.indexOf(idx) === i);

    if (!pts.length) {
      groupIdxs.forEach((idx) => {
        const target = model.points[idx];
        if (!target) return;
        model.points[idx] = { ...target, style: styleWithHidden(target, true) };
      });
      finalize();
      return;
    }

    if (pts.length === 1) {
      const pos = pts[0];
      groupIdxs.forEach((idx) => {
        const target = model.points[idx];
        if (!target) return;
        model.points[idx] = { ...target, x: pos.x, y: pos.y, style: styleWithHidden(target, false) };
      });
      finalize();
      return;
    }

    if (groupIdxs.length >= 2) {
      const idxA = groupIdxs[0];
      const idxB = groupIdxs[1];
      const pointA = model.points[idxA];
      const pointB = model.points[idxB];
      if (pointA && pointB) {
        const dist = (pt: Point, pos: { x: number; y: number }) => Math.hypot(pt.x - pos.x, pt.y - pos.y);
        const dA0 = dist(pointA, pts[0]);
        const dA1 = dist(pointA, pts[1]);
        const dB0 = dist(pointB, pts[0]);
        const dB1 = dist(pointB, pts[1]);
        const assignFirst = dA0 + dB1 <= dA1 + dB0;
        const assignments = assignFirst
          ? [
              { idx: idxA, target: pointA, pos: pts[0] },
              { idx: idxB, target: pointB, pos: pts[1] }
            ]
          : [
              { idx: idxA, target: pointA, pos: pts[1] },
              { idx: idxB, target: pointB, pos: pts[0] }
            ];
        assignments.forEach(({ idx, target, pos }) => {
          model.points[idx] = { ...target, x: pos.x, y: pos.y, style: styleWithHidden(target, false) };
        });
        if (groupIdxs.length > 2) {
          groupIdxs.slice(2).forEach((idx) => {
            const target = model.points[idx];
            if (!target) return;
            model.points[idx] = { ...target, style: styleWithHidden(target, true) };
          });
        }
        finalize();
        return;
      }
    }

    pts.sort((p1, p2) => Math.hypot(p1.x - point.x, p1.y - point.y) - Math.hypot(p2.x - point.x, p2.y - point.y));
    const best = pts[0];
    model.points[pointIdx] = { ...point, x: best.x, y: best.y, style: styleWithHidden(point, false) };
    finalize();
    return;
  }

  finalize();
}

function updateIntersectionsForLine(lineIdx: number) {
  const line = model.lines[lineIdx];
  if (!line) return;
  const lineId = line.id;
  model.points.forEach((_, pi) => {
    const pt = model.points[pi];
    if (!pt) return;
    if (pt.parent_refs.some((pr) => pr.kind === 'line' && pr.id === lineId)) {
      if (pt.construction_kind === 'intersection') {
        recomputeIntersectionPoint(pi);
      }
      // Don't constrain on_object points - they are already positioned correctly
      // by applyLineFractions when line endpoints move
    }
  });
  updateSymmetricPointsForLine(lineIdx);
}

function updateIntersectionsForCircle(circleIdx: number) {
  const circle = model.circles[circleIdx];
  if (!circle) return;
  const cid = circle.id;
  model.points.forEach((pt, pi) => {
    if (!pt) return;
    if (pt.parent_refs.some((pr) => pr.kind === 'circle' && pr.id === cid)) {
      if (pt.construction_kind === 'intersection') {
        recomputeIntersectionPoint(pi);
      } else {
        const constrained = constrainToCircles(pi, constrainToLineParent(pi, { x: pt.x, y: pt.y }));
        model.points[pi] = { ...pt, ...constrained };
        updateMidpointsForPoint(pi);
      }
    }
  });
}

function findHandle(p: { x: number; y: number }): number | null {
  for (let i = model.lines.length - 1; i >= 0; i--) {
    const handle = getLineHandle(i);
    if (!handle) continue;
    const half = screenUnits(HANDLE_SIZE / 2);
    if (Math.abs(p.x - handle.x) <= half && Math.abs(p.y - handle.y) <= half) {
      return i;
    }
  }
  return null;
}

// Load button configuration from localStorage
loadButtonOrder();
loadButtonConfiguration();
// applyButtonConfiguration() is called in initRuntime() after DOM is ready

