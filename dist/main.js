const LINE_SNAP_SIN_ANGLE = Math.sin((5 * Math.PI) / 180);
const LINE_SNAP_BLEND_STRENGTH = 0.25;
const LINE_SNAP_FULL_THRESHOLD = 0.9;
const LINE_SNAP_INDICATOR_THRESHOLD = LINE_SNAP_FULL_THRESHOLD;
const ANGLE_RADIUS_STEP = 8;
const ANGLE_DEFAULT_RADIUS = 28;
const ANGLE_MIN_RADIUS = 10;
const ANGLE_RADIUS_MARGIN = 6;
const ANGLE_RADIUS_EPSILON = 0.5;
const RIGHT_ANGLE_MARK_MIN = 14;
const RIGHT_ANGLE_MARK_RATIO = 0.65;
const RIGHT_ANGLE_MARK_MAX = 72;
const RIGHT_ANGLE_MARK_MARGIN = 4;
const LABEL_FONT_DEFAULT = 12;
const LABEL_FONT_MIN = 8;
const LABEL_FONT_MAX = 48;
const LABEL_FONT_STEP = 2;
const TICK_LENGTH_UNITS = 12;
const TICK_SPACING_UNITS = 8;
const TICK_MARGIN_UNITS = 4;
function axisSnapWeight(closeness) {
    if (closeness >= LINE_SNAP_FULL_THRESHOLD)
        return 1;
    if (closeness <= 0)
        return 0;
    return Math.min(1, closeness * closeness * LINE_SNAP_BLEND_STRENGTH);
}
export const createEmptyModel = () => ({
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
const ID_PREFIX = {
    point: 'pt',
    line: 'ln',
    circle: 'c',
    angle: 'ang',
    polygon: 'poly'
};
const LABEL_PREFIX = {
    point: 'P',
    line: 'L',
    circle: 'O',
    angle: '∠',
    polygon: 'W'
};
const segmentKeyForPoints = (aIdx, bIdx) => {
    const pa = model.points[aIdx];
    const pb = model.points[bIdx];
    const aid = pa?.id ?? `p${aIdx}`;
    const bid = pb?.id ?? `p${bIdx}`;
    return aid < bid ? `${aid}-${bid}` : `${bid}-${aid}`;
};
function nextId(kind, target = model) {
    target.idCounters[kind] += 1;
    return `${ID_PREFIX[kind]}${target.idCounters[kind]}`;
}
function registerIndex(target, kind, id, idx) {
    target.indexById[kind][id] = idx;
}
function rebuildIndexMaps(target = model) {
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
const normalizeParents = (parents) => {
    const res = [];
    parents?.forEach((p) => {
        if (!p)
            return;
        if (p.kind !== 'line' && p.kind !== 'circle')
            return;
        if (typeof p.id !== 'string' || !p.id.length)
            return;
        if (!res.some((r) => r.kind === p.kind && r.id === p.id))
            res.push({ kind: p.kind, id: p.id });
    });
    return res;
};
const resolveConstructionKind = (parents, explicit) => {
    if (explicit)
        return explicit;
    if (parents.length >= 2)
        return 'intersection';
    if (parents.length === 1)
        return 'on_object';
    return 'free';
};
const isMidpointPoint = (point) => !!point && point.construction_kind === 'midpoint' && !!point.midpoint;
const isSymmetricPoint = (point) => !!point && point.construction_kind === 'symmetric' && !!point.symmetric;
const isPointDraggable = (point) => !!point &&
    point.construction_kind !== 'intersection' &&
    point.construction_kind !== 'midpoint' &&
    point.construction_kind !== 'symmetric';
const isParallelLine = (line) => !!line && line.construction_kind === 'parallel' && !!line.parallel;
const isPerpendicularLine = (line) => !!line && line.construction_kind === 'perpendicular' && !!line.perpendicular;
const isLineDraggable = (line) => !line || (line.construction_kind !== 'parallel' && line.construction_kind !== 'perpendicular');
export const addPoint = (model, p) => {
    const { style: maybeStyle, construction_kind, defining_parents, id, ...rest } = p;
    const style = maybeStyle ?? { color: '#ffffff', size: 4 };
    const parents = normalizeParents(defining_parents);
    const pid = id ?? nextId('point', model);
    const point = {
        object_type: 'point',
        id: pid,
        ...rest,
        style,
        defining_parents: parents.map((pr) => pr.id),
        parent_refs: parents,
        incident_objects: new Set(),
        children: [],
        construction_kind: resolveConstructionKind(parents, construction_kind),
        recompute: () => { },
        on_parent_deleted: () => { }
    };
    model.points.push(point);
    registerIndex(model, 'point', pid, model.points.length - 1);
    return model.points.length - 1;
};
export const addLineFromPoints = (model, a, b, style) => {
    const id = nextId('line', model);
    const line = {
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
        recompute: () => { },
        on_parent_deleted: () => { }
    };
    model.lines.push(line);
    registerIndex(model, 'line', id, model.lines.length - 1);
    return model.lines.length - 1;
};
const isCircleThroughPoints = (circle) => circle.circle_kind === 'three-point';
const circleDefiningPoints = (circle) => (isCircleThroughPoints(circle) ? circle.defining_points : []);
const circlePerimeterPoints = (circle) => {
    const result = [];
    const seen = new Set();
    const pushUnique = (idx) => {
        if (idx === circle.center)
            return;
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
const circleRadius = (circle) => {
    const center = model.points[circle.center];
    const radiusPt = model.points[circle.radius_point];
    if (!center || !radiusPt)
        return 0;
    return Math.hypot(radiusPt.x - center.x, radiusPt.y - center.y);
};
const circleRadiusVector = (circle) => {
    const center = model.points[circle.center];
    const radiusPt = model.points[circle.radius_point];
    if (!center || !radiusPt)
        return null;
    return { x: radiusPt.x - center.x, y: radiusPt.y - center.y };
};
const circleHasDefiningPoint = (circle, pointIdx) => isCircleThroughPoints(circle) && circle.defining_points.includes(pointIdx);
const dpr = window.devicePixelRatio || 1;
const HIT_RADIUS = 16;
const HANDLE_SIZE = 16;
const DEFAULT_COLORS_DARK = ['#15a3ff', '#ff4d4f', '#22c55e', '#f59e0b', '#a855f7', '#0ea5e9'];
const DEFAULT_COLORS_LIGHT = ['#000000', '#404040', '#808080', '#bfbfbf'];
const THEME_PRESETS = {
    dark: {
        palette: DEFAULT_COLORS_DARK,
        defaultStroke: DEFAULT_COLORS_DARK[0],
        highlight: '#fbbf24',
        preview: '#22c55e',
        pointSize: 2,
        lineWidth: 2,
        angleStrokeWidth: 2,
        angleDefaultRadius: 28,
        midpointColor: '#9ca3af'
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
        midpointColor: '#737373'
    }
};
const THEME = { ...THEME_PRESETS.dark };
let currentTheme = 'dark';
const THEME_STORAGE_KEY = 'geometry.theme';
const normalizeThemeName = (value) => {
    if (value === 'dark' || value === 'light')
        return value;
    if (value === 'default')
        return 'dark';
    if (value === 'eink')
        return 'light';
    return null;
};
if (typeof window !== 'undefined') {
    try {
        const storedTheme = normalizeThemeName(window.localStorage?.getItem(THEME_STORAGE_KEY));
        if (storedTheme)
            currentTheme = storedTheme;
    }
    catch {
        // ignore storage access issues
    }
}
const HIGHLIGHT_LINE = { color: THEME.highlight, width: 1.5, dash: [4, 4] };
const LABEL_HIT_RADIUS = 18;
const DEBUG_PANEL_MARGIN = { x: 12, y: 12 };
const DEBUG_PANEL_TOP_MIN = 56;
let canvas = null;
let ctx = null;
let model = createEmptyModel();
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const clampLabelFontSize = (value) => clamp(value, LABEL_FONT_MIN, LABEL_FONT_MAX);
const normalizeLabelFontSize = (value) => {
    if (!Number.isFinite(value ?? NaN))
        return LABEL_FONT_DEFAULT;
    const rounded = Math.round(value);
    const snapped = LABEL_FONT_MIN + Math.round((rounded - LABEL_FONT_MIN) / LABEL_FONT_STEP) * LABEL_FONT_STEP;
    return clampLabelFontSize(snapped);
};
const mergeParents = (existing = [], incoming = []) => normalizeParents([...(existing ?? []), ...incoming]);
function applyPointConstruction(pointIdx, parents) {
    const point = model.points[pointIdx];
    if (!point)
        return;
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
let selectedPointIndex = null;
let selectedLineIndex = null;
let selectedCircleIndex = null;
let selectedAngleIndex = null;
let selectedPolygonIndex = null;
let selectedInkStrokeIndex = null;
let selectedLabel = null;
const selectedSegments = new Set();
const selectedArcSegments = new Set();
// Multi-selection
const multiSelectedPoints = new Set();
const multiSelectedLines = new Set();
const multiSelectedCircles = new Set();
const multiSelectedAngles = new Set();
const multiSelectedPolygons = new Set();
const multiSelectedInkStrokes = new Set();
let multiselectBoxStart = null;
let multiselectBoxEnd = null;
let mode = 'move';
let segmentStartIndex = null;
let segmentStartTemporary = false;
let circleCenterIndex = null;
let triangleStartIndex = null;
let squareStartIndex = null;
let polygonChain = [];
let angleFirstLeg = null;
let bisectorFirstLeg = null;
let midpointFirstIndex = null;
let symmetricSourceIndex = null;
let parallelAnchorPointIndex = null;
let parallelReferenceLineIndex = null;
let ngonSides = 5;
let currentPolygonLines = [];
let hoverPointIndex = null;
let strokeColorInput = null;
let modeAddBtn = null;
let modeMoveBtn = null;
let modeMultiselectBtn = null;
let modeSegmentBtn = null;
let modeParallelBtn = null;
let modePerpBtn = null;
let modeCircleThreeBtn = null;
let modeTriangleBtn = null;
let modeSquareBtn = null;
let modePolygonBtn = null;
let modeAngleBtn = null;
let modeBisectorBtn = null;
let modeMidpointBtn = null;
let modeSymmetricBtn = null;
let modeParallelLineBtn = null;
let modeNgonBtn = null;
let modeLabelBtn = null;
let modeHandwritingBtn = null;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let panOffset = { x: 0, y: 0 };
let panStartOffset = { x: 0, y: 0 };
let pendingPanCandidate = null;
let zoomFactor = 1;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const activeTouches = new Map();
const INK_BASE_WIDTH = 3;
const INK_PRESSURE_FALLBACK = 0.6;
const INK_MIN_SAMPLE_PX = 0.6;
let activeInkStroke = null;
let pinchState = null;
let circleDragContext = null;
let draggingSelection = false;
let draggingMultiSelection = false;
let dragStart = { x: 0, y: 0 };
let resizingLine = null;
let lineDragContext = null;
let stickyTool = null;
let viewModeToggleBtn = null;
let selectionVertices = false;
let selectionEdges = true;
let rayModeToggleBtn = null;
let viewModeMenuContainer = null;
let rayModeMenuContainer = null;
let raySegmentBtn = null;
let rayRightBtn = null;
let rayLeftBtn = null;
let debugToggleBtn = null;
let debugPanel = null;
let debugPanelHeader = null;
let debugCloseBtn = null;
let debugContent = null;
let debugVisible = false;
let debugPanelPos = null;
let debugDragState = null;
let styleEdgesRow = null;
let viewModeOpen = false;
let rayModeOpen = false;
let hideBtn = null;
let deleteBtn = null;
let copyStyleBtn = null;
let copyStyleActive = false;
let copiedStyle = null;
let multiMoveBtn = null;
let multiCloneBtn = null;
let multiMoveActive = false;
let showHidden = false;
let zoomMenuBtn = null;
let zoomMenuContainer = null;
let zoomMenuOpen = false;
let zoomMenuDropdown = null;
let showHiddenBtn = null;
let copyImageBtn = null;
let saveImageBtn = null;
let clearAllBtn = null;
let exportJsonBtn = null;
let importJsonBtn = null;
let importJsonInput = null;
let themeDarkBtn = null;
let undoBtn = null;
let redoBtn = null;
let styleMenuBtn = null;
let styleMenuContainer = null;
let styleMenuDropdown = null;
let styleMenuOpen = false;
let styleMenuSuppressed = false;
let styleColorRow = null;
let styleWidthRow = null;
let styleTypeRow = null;
let styleTypeInline = null;
let styleArcRow = null;
let styleHideRow = null;
let labelTextRow = null;
let labelFontRow = null;
let labelGreekRow = null;
let styleColorInput = null;
let styleWidthInput = null;
let lineWidthDecreaseBtn = null;
let lineWidthIncreaseBtn = null;
let lineWidthValueDisplay = null;
let styleTypeSelect = null;
let labelTextInput = null;
let arcCountButtons = [];
let rightAngleBtn = null;
let angleRadiusDecreaseBtn = null;
let angleRadiusIncreaseBtn = null;
let colorSwatchButtons = [];
let customColorBtn = null;
let styleTypeButtons = [];
let labelGreekButtons = [];
let labelGreekToggleBtn = null;
let labelGreekShiftBtn = null;
let styleRayGroup = null;
let styleTickGroup = null;
let styleTickButton = null;
let styleTypeGap = null;
let labelGreekVisible = false;
let labelGreekUppercase = false;
let labelFontDecreaseBtn = null;
// Default folder handle for saving/loading files
let defaultFolderHandle = null;
let selectDefaultFolderBtn = null;
let clearDefaultFolderBtn = null;
let defaultFolderPath = null;
let labelFontIncreaseBtn = null;
let labelFontSizeDisplay = null;
let recentColors = [THEME.defaultStroke];
let labelUpperIdx = 0;
let labelLowerIdx = 0;
let labelGreekIdx = 0;
let freeUpperIdx = [];
let freeLowerIdx = [];
let freeGreekIdx = [];
if (typeof document !== 'undefined') {
    setTheme(currentTheme);
}
let pendingParallelPoint = null;
let pendingParallelLine = null;
let pendingCircleRadiusPoint = null;
let pendingCircleRadiusLength = null;
let draggingLabel;
let draggingCircleCenterAngles = null;
let circleThreePoints = [];
let activeAxisSnap = null;
const ICONS = {
    moveSelect: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 9.5 5.5 12 8l2.5-2.5L12 3Zm0 13-2.5 2.5L12 21l2.5-2.5L12 16Zm-9-4 2.5 2.5L8 12 5.5 9.5 3 12Zm13 0 2.5 2.5L21 12l-2.5-2.5L16 12ZM8 12l8 0" /></svg>',
    vertices: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" class="icon-fill"/></svg>',
    edges: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    rayLeft: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H6"/><path d="m6 8-4 4 4 4"/></svg>',
    rayRight: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14"/><path d="m18 8 4 4-4 4"/></svg>',
    viewVertices: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="3.8" fill="none" stroke="currentColor"/><circle cx="8" cy="12" r="1.6" class="icon-fill"/><circle cx="16" cy="12" r="3.8" fill="none" stroke="currentColor"/><circle cx="16" cy="12" r="1.6" class="icon-fill"/></svg>',
    viewEdges: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="3.2" fill="none" stroke="currentColor"/><circle cx="6" cy="12" r="1.5" class="icon-fill"/><circle cx="18" cy="12" r="3.2" fill="none" stroke="currentColor"/><circle cx="18" cy="12" r="1.5" class="icon-fill"/><line x1="6" y1="12" x2="18" y2="12" stroke-linecap="round" stroke-width="2"/></svg>',
    viewBoth: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="3.2" fill="none" stroke="currentColor"/><circle cx="6" cy="12" r="1.5" class="icon-fill"/><circle cx="18" cy="12" r="3.2" fill="none" stroke="currentColor"/><circle cx="18" cy="12" r="1.5" class="icon-fill"/><line x1="6" y1="12" x2="18" y2="12" stroke-linecap="round" stroke-width="2"/></svg>',
    rayLine: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="12" x2="20" y2="12"/></svg>',
    rayRightOnly: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="12" x2="14" y2="12"/><path d="m14 8 6 4-6 4"/></svg>',
    rayLeftOnly: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="10" y1="12" x2="20" y2="12"/><path d="m10 8-6 4 6 4"/></svg>',
    raySegment: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="2" class="icon-fill"/><circle cx="16" cy="12" r="2" class="icon-fill"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
    tick1: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="12" x2="20" y2="12" stroke-linecap="round" stroke-width="1.8"/><line x1="12" y1="8" x2="12" y2="16" stroke-linecap="round" stroke-width="1.8"/></svg>',
    tick2: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="12" x2="20" y2="12" stroke-linecap="round" stroke-width="1.8"/><line x1="10" y1="8" x2="10" y2="16" stroke-linecap="round" stroke-width="1.8"/><line x1="14" y1="8" x2="14" y2="16" stroke-linecap="round" stroke-width="1.8"/></svg>',
    tick3: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="12" x2="20" y2="12" stroke-linecap="round" stroke-width="1.8"/><line x1="9" y1="7.5" x2="9" y2="16.5" stroke-linecap="round" stroke-width="1.8"/><line x1="12" y1="7.5" x2="12" y2="16.5" stroke-linecap="round" stroke-width="1.8"/><line x1="15" y1="7.5" x2="15" y2="16.5" stroke-linecap="round" stroke-width="1.8"/></svg>',
    eye: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="3"/><path d="M4 4 20 20"/></svg>'
};
const PERSIST_VERSION = 1;
function polygonCentroid(polyIdx) {
    const verts = polygonVertices(polyIdx);
    if (!verts.length)
        return null;
    const sum = verts.reduce((acc, vi) => {
        const p = model.points[vi];
        return p ? { x: acc.x + p.x, y: acc.y + p.y } : acc;
    }, { x: 0, y: 0 });
    return { x: sum.x / verts.length, y: sum.y / verts.length };
}
let history = [];
let historyIndex = -1;
let movedDuringDrag = false;
let movedDuringPan = false;
const parallelRecomputeStack = new Set();
const perpendicularRecomputeStack = new Set();
function currentPointStyle() {
    return { color: THEME.defaultStroke, size: THEME.pointSize };
}
function midpointPointStyle() {
    return { color: THEME.midpointColor, size: THEME.pointSize };
}
function symmetricPointStyle() {
    return { color: THEME.defaultStroke, size: THEME.pointSize };
}
function currentStrokeStyle() {
    return {
        color: THEME.defaultStroke,
        width: THEME.lineWidth,
        type: 'solid',
        tick: 0
    };
}
function currentAngleStyle() {
    const s = {
        color: THEME.defaultStroke,
        width: THEME.angleStrokeWidth,
        type: 'solid'
    };
    return { ...s, fill: undefined, arcCount: 1, right: false, arcRadiusOffset: 0 };
}
const UPPER_SEQ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER_SEQ = 'abcdefghijklmnopqrstuvwxyz';
const GREEK_SEQ = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω'];
function seqLetter(idx, alphabet) {
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
        const idx = freeUpperIdx.shift();
        return { text: seqLetter(idx, UPPER_SEQ), seq: { kind: 'upper', idx } };
    }
    const idx = labelUpperIdx;
    const res = seqLetter(idx, UPPER_SEQ);
    labelUpperIdx += 1;
    return { text: res, seq: { kind: 'upper', idx } };
}
function nextLower() {
    if (freeLowerIdx.length) {
        const idx = freeLowerIdx.shift();
        return { text: seqLetter(idx, LOWER_SEQ), seq: { kind: 'lower', idx } };
    }
    const idx = labelLowerIdx;
    const res = seqLetter(idx, LOWER_SEQ);
    labelLowerIdx += 1;
    return { text: res, seq: { kind: 'lower', idx } };
}
function nextGreek() {
    if (freeGreekIdx.length) {
        const idx = freeGreekIdx.shift();
        return { text: GREEK_SEQ[idx % GREEK_SEQ.length], seq: { kind: 'greek', idx } };
    }
    const idx = labelGreekIdx;
    const res = GREEK_SEQ[idx % GREEK_SEQ.length];
    labelGreekIdx += 1;
    return { text: res, seq: { kind: 'greek', idx } };
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
}
function copyStyleFromSelection() {
    if (selectedPointIndex !== null) {
        const pt = model.points[selectedPointIndex];
        if (!pt)
            return null;
        return {
            sourceType: 'point',
            color: pt.style.color,
            size: pt.style.size
        };
    }
    if (selectedLineIndex !== null) {
        const line = model.lines[selectedLineIndex];
        if (!line)
            return null;
        // Jeśli zaznaczony jest konkretny segment, weź jego styl
        if (selectedSegments.size > 0) {
            const firstKey = Array.from(selectedSegments)[0];
            const parsed = parseSegmentKey(firstKey);
            if (parsed && parsed.line === selectedLineIndex) {
                let style;
                if (parsed.part === 'segment' && parsed.seg !== undefined) {
                    style = line.segmentStyles?.[parsed.seg] ?? line.style;
                }
                else if (parsed.part === 'rayLeft') {
                    style = line.leftRay ?? line.style;
                }
                else if (parsed.part === 'rayRight') {
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
        if (!circle)
            return null;
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
        if (!angle)
            return null;
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
        if (!stroke)
            return null;
        return {
            sourceType: 'ink',
            color: stroke.color,
            baseWidth: stroke.baseWidth
        };
    }
    return null;
}
function applyStyleToSelection(style) {
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
                    if (!parsed || parsed.line !== selectedLineIndex)
                        return;
                    if (parsed.part === 'segment' && parsed.seg !== undefined) {
                        if (!line.segmentStyles)
                            line.segmentStyles = [];
                        const base = line.segmentStyles[parsed.seg] ?? line.style;
                        line.segmentStyles[parsed.seg] = { ...base, color: style.color, width: style.width, type: style.type };
                        if (style.tick !== undefined)
                            line.segmentStyles[parsed.seg].tick = style.tick;
                    }
                    else if (parsed.part === 'rayLeft') {
                        const base = line.leftRay ?? line.style;
                        line.leftRay = { ...base, color: style.color, width: style.width, type: style.type };
                        if (style.tick !== undefined)
                            line.leftRay.tick = style.tick;
                    }
                    else if (parsed.part === 'rayRight') {
                        const base = line.rightRay ?? line.style;
                        line.rightRay = { ...base, color: style.color, width: style.width, type: style.type };
                        if (style.tick !== undefined)
                            line.rightRay.tick = style.tick;
                    }
                });
                changed = true;
            }
            else {
                // Aplikuj do całej linii
                line.style.color = style.color;
                line.style.width = style.width;
                line.style.type = style.type;
                if (style.tick !== undefined)
                    line.style.tick = style.tick;
                // Jeśli linia ma segmentStyles, zaktualizuj też wszystkie segmenty
                if (line.segmentStyles && line.segmentStyles.length > 0) {
                    line.segmentStyles = line.segmentStyles.map(seg => ({
                        ...seg,
                        color: style.color,
                        width: style.width,
                        type: style.type,
                        tick: style.tick !== undefined ? style.tick : seg.tick
                    }));
                }
                // Zaktualizuj też półproste jeśli istnieją
                if (line.leftRay) {
                    line.leftRay = { ...line.leftRay, color: style.color, width: style.width, type: style.type };
                    if (style.tick !== undefined)
                        line.leftRay.tick = style.tick;
                }
                if (line.rightRay) {
                    line.rightRay = { ...line.rightRay, color: style.color, width: style.width, type: style.type };
                    if (style.tick !== undefined)
                        line.rightRay.tick = style.tick;
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
                    if (!parsed || parsed.circle !== selectedCircleIndex)
                        return;
                    if (!circle.arcStyles)
                        circle.arcStyles = [];
                    const base = circle.arcStyles[parsed.arcIdx] ?? circle.style;
                    circle.arcStyles[parsed.arcIdx] = { ...base, color: style.color, width: style.width, type: style.type };
                    if (style.tick !== undefined)
                        circle.arcStyles[parsed.arcIdx].tick = style.tick;
                });
                changed = true;
            }
            else {
                // Aplikuj do całego okręgu
                circle.style.color = style.color;
                circle.style.width = style.width;
                circle.style.type = style.type;
                if (style.tick !== undefined)
                    circle.style.tick = style.tick;
                // Jeśli okrąg ma arcStyles, zaktualizuj też wszystkie łuki
                if (circle.arcStyles && circle.arcStyles.length > 0) {
                    circle.arcStyles = circle.arcStyles.map(arc => ({
                        ...arc,
                        color: style.color,
                        width: style.width,
                        type: style.type,
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
            if (style.arcCount !== undefined)
                angle.style.arcCount = style.arcCount;
            if (style.right !== undefined)
                angle.style.right = style.right;
            if (style.fill !== undefined)
                angle.style.fill = style.fill;
            if (style.arcRadiusOffset !== undefined)
                angle.style.arcRadiusOffset = style.arcRadiusOffset;
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
function reclaimLabel(label) {
    if (!label?.seq)
        return;
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
function isPointInBox(p, box) {
    return p.x >= box.x1 && p.x <= box.x2 && p.y >= box.y1 && p.y <= box.y2;
}
function selectObjectsInBox(box) {
    model.points.forEach((p, idx) => {
        if (isPointInBox(p, box))
            multiSelectedPoints.add(idx);
    });
    model.lines.forEach((line, idx) => {
        const allInside = line.points.every(pi => {
            const p = model.points[pi];
            return p && isPointInBox(p, box);
        });
        if (allInside)
            multiSelectedLines.add(idx);
    });
    model.circles.forEach((circle, idx) => {
        const center = model.points[circle.center];
        if (center && isPointInBox(center, box))
            multiSelectedCircles.add(idx);
    });
    model.angles.forEach((ang, idx) => {
        const v = model.points[ang.vertex];
        if (v && isPointInBox(v, box))
            multiSelectedAngles.add(idx);
    });
    model.polygons.forEach((poly, idx) => {
        const verts = polygonVerticesOrdered(idx);
        const allInside = verts.every(vi => {
            const p = model.points[vi];
            return p && isPointInBox(p, box);
        });
        if (allInside)
            multiSelectedPolygons.add(idx);
    });
    model.inkStrokes.forEach((stroke, idx) => {
        const allInside = stroke.points.every(pt => isPointInBox(pt, box));
        if (allInside)
            multiSelectedInkStrokes.add(idx);
    });
}
function hasMultiSelection() {
    return multiSelectedPoints.size > 0 ||
        multiSelectedLines.size > 0 ||
        multiSelectedCircles.size > 0 ||
        multiSelectedAngles.size > 0 ||
        multiSelectedPolygons.size > 0 ||
        multiSelectedInkStrokes.size > 0;
}
function draw() {
    if (!canvas || !ctx)
        return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * zoomFactor, 0, 0, dpr * zoomFactor, panOffset.x * dpr, panOffset.y * dpr);
    // Helper function to check if a point should hide edges when hidden
    const pointHiddenForEdges = isPointHiddenForEdges;
    // draw lines
    model.lines.forEach((line, lineIdx) => {
        if (line.hidden && !showHidden)
            return;
        const pts = line.points.map((idx) => model.points[idx]).filter(Boolean);
        if (pts.length < 2)
            return;
        const inSelectedPolygon = selectedPolygonIndex !== null && model.polygons[selectedPolygonIndex]?.lines.includes(lineIdx);
        const lineSelected = selectedLineIndex === lineIdx || inSelectedPolygon;
        const highlightColor = isParallelLine(line) || isPerpendicularLine(line) ? '#9ca3af' : HIGHLIGHT_LINE.color;
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i];
            const b = pts[i + 1];
            const style = line.segmentStyles?.[i] ?? line.style;
            if (style.hidden && !showHidden) {
                continue;
            }
            if (!showHidden && (pointHiddenForEdges(line.points[i]) || pointHiddenForEdges(line.points[i + 1]))) {
                continue;
            }
            const segKey = segmentKey(lineIdx, 'segment', i);
            const isSegmentSelected = selectedSegments.size > 0 && selectedSegments.has(segKey);
            const shouldHighlight = lineSelected && selectionEdges && (selectedSegments.size === 0 || isSegmentSelected);
            const segHidden = !!style.hidden || line.hidden;
            ctx.save();
            ctx.globalAlpha = segHidden && showHidden ? 0.4 : 1;
            ctx.strokeStyle = style.color;
            ctx.lineWidth = renderWidth(style.width);
            applyStrokeStyle(style.type);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            if (style.tick)
                drawSegmentTicks({ x: a.x, y: a.y }, { x: b.x, y: b.y }, style.tick, ctx);
            if (shouldHighlight) {
                ctx.strokeStyle = highlightColor;
                ctx.lineWidth = renderWidth(style.width + HIGHLIGHT_LINE.width);
                ctx.setLineDash(HIGHLIGHT_LINE.dash);
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.restore();
        }
        // draw rays if enabled
        const first = pts[0];
        const last = pts[pts.length - 1];
        const dx = last.x - first.x;
        const dy = last.y - first.y;
        const len = Math.hypot(dx, dy) || 1;
        const dir = { x: dx / len, y: dy / len };
        const extend = (canvas.width + canvas.height) / dpr;
        if (line.leftRay && !(line.leftRay.hidden && !showHidden)) {
            ctx.strokeStyle = line.leftRay.color;
            ctx.lineWidth = renderWidth(line.leftRay.width);
            const hiddenRay = !!line.leftRay.hidden || line.hidden;
            ctx.save();
            ctx.globalAlpha = hiddenRay && showHidden ? 0.4 : 1;
            applyStrokeStyle(line.leftRay.type);
            ctx.beginPath();
            ctx.moveTo(first.x, first.y);
            ctx.lineTo(first.x - dir.x * extend, first.y - dir.y * extend);
            ctx.stroke();
            if (lineSelected &&
                selectionEdges &&
                (selectedSegments.size === 0 || selectedSegments.has(segmentKey(lineIdx, 'rayLeft')))) {
                ctx.strokeStyle = highlightColor;
                ctx.lineWidth = renderWidth(line.leftRay.width + HIGHLIGHT_LINE.width);
                ctx.setLineDash(HIGHLIGHT_LINE.dash);
                ctx.beginPath();
                ctx.moveTo(first.x, first.y);
                ctx.lineTo(first.x - dir.x * extend, first.y - dir.y * extend);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.restore();
        }
        if (line.rightRay && !(line.rightRay.hidden && !showHidden)) {
            ctx.strokeStyle = line.rightRay.color;
            ctx.lineWidth = renderWidth(line.rightRay.width);
            const hiddenRay = !!line.rightRay.hidden || line.hidden;
            ctx.save();
            ctx.globalAlpha = hiddenRay && showHidden ? 0.4 : 1;
            applyStrokeStyle(line.rightRay.type);
            ctx.beginPath();
            ctx.moveTo(last.x, last.y);
            ctx.lineTo(last.x + dir.x * extend, last.y + dir.y * extend);
            ctx.stroke();
            if (lineSelected &&
                selectionEdges &&
                (selectedSegments.size === 0 || selectedSegments.has(segmentKey(lineIdx, 'rayRight')))) {
                ctx.strokeStyle = highlightColor;
                ctx.lineWidth = renderWidth(line.rightRay.width + HIGHLIGHT_LINE.width);
                ctx.setLineDash(HIGHLIGHT_LINE.dash);
                ctx.beginPath();
                ctx.moveTo(last.x, last.y);
                ctx.lineTo(last.x + dir.x * extend, last.y + dir.y * extend);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.restore();
        }
        // draw handle for pure segment (both rays hidden)
        const handle = selectedLineIndex === lineIdx ? getLineHandle(lineIdx) : null;
        if (handle) {
            ctx.save();
            ctx.fillStyle = THEME.preview;
            const size = HANDLE_SIZE;
            ctx.translate(handle.x, handle.y);
            ctx.scale(1 / zoomFactor, 1 / zoomFactor);
            ctx.fillRect(-size / 2, -size / 2, size, size);
            ctx.restore();
        }
        if (line.label && !line.label.hidden) {
            const ext = lineExtent(lineIdx);
            if (ext) {
                if (!line.label.offset)
                    line.label.offset = defaultLineLabelOffset(lineIdx);
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
                const offset = activeAxisSnap.axis === 'horizontal'
                    ? { x: 0, y: -offsetAmount }
                    : { x: -offsetAmount, y: 0 };
                const pos = { x: extent.center.x + offset.x, y: extent.center.y + offset.y };
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.scale(1 / zoomFactor, 1 / zoomFactor);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.globalAlpha = 0.25 + strength * 0.35;
                ctx.fillStyle = THEME.preview;
                ctx.beginPath();
                ctx.arc(0, 0, indicatorRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = Math.min(0.6 + strength * 0.4, 0.95);
                ctx.strokeStyle = THEME.preview;
                ctx.lineWidth = renderWidth(1.4);
                ctx.beginPath();
                ctx.arc(0, 0, indicatorRadius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
                ctx.font = `${11}px sans-serif`;
                ctx.fillStyle = '#0f172a';
                const tag = activeAxisSnap.axis === 'horizontal' ? 'H' : 'V';
                ctx.fillText(tag, 0, 0);
                ctx.restore();
            }
        }
    });
    // draw circles
    model.circles.forEach((circle, idx) => {
        if (circle.hidden && !showHidden)
            return;
        const center = model.points[circle.center];
        if (!center)
            return;
        const radius = circleRadius(circle);
        if (radius <= 1e-3)
            return;
        const style = circle.style;
        const selected = selectedCircleIndex === idx;
        ctx.save();
        ctx.globalAlpha = circle.hidden && showHidden ? 0.4 : 1;
        ctx.strokeStyle = style.color;
        ctx.lineWidth = renderWidth(style.width);
        applyStrokeStyle(style.type);
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        if (style.tick)
            drawCircleTicks(center, radius, style.tick, ctx);
        if (selected) {
            ctx.strokeStyle = HIGHLIGHT_LINE.color;
            ctx.lineWidth = renderWidth(style.width + HIGHLIGHT_LINE.width);
            ctx.setLineDash(HIGHLIGHT_LINE.dash);
            ctx.beginPath();
            ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.restore();
    });
    // draw arcs derived from circle points
    model.circles.forEach((circle, ci) => {
        if (circle.hidden && !showHidden)
            return;
        const arcs = circleArcs(ci);
        arcs.forEach((arc, ai) => {
            if (arc.hidden && !showHidden)
                return;
            const center = arc.center;
            const style = arc.style;
            ctx.save();
            ctx.strokeStyle = style.color;
            ctx.lineWidth = renderWidth(style.width);
            applyStrokeStyle(style.type);
            ctx.beginPath();
            ctx.arc(center.x, center.y, arc.radius, arc.start, arc.end, arc.clockwise);
            ctx.stroke();
            const baseTick = (circle.style.tick ?? 0);
            const arcTick = (style.tick ?? baseTick);
            if (arcTick)
                drawArcTicks(center, arc.radius, arc.start, arc.end, arc.clockwise, arcTick, ctx);
            const key = arcKey(ci, ai);
            const isSelected = selectedCircleIndex === ci && (selectedArcSegments.size === 0 || selectedArcSegments.has(key));
            if (isSelected) {
                ctx.strokeStyle = HIGHLIGHT_LINE.color;
                ctx.lineWidth = renderWidth(style.width + HIGHLIGHT_LINE.width);
                ctx.setLineDash(HIGHLIGHT_LINE.dash);
                ctx.beginPath();
                ctx.arc(center.x, center.y, arc.radius, arc.start, arc.end, arc.clockwise);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.restore();
        });
    });
    // draw angles
    model.angles.forEach((ang, idx) => {
        if (ang.hidden && !showHidden)
            return;
        const leg1 = ang.leg1;
        const leg2 = ang.leg2;
        const l1 = model.lines[leg1.line];
        const l2 = model.lines[leg2.line];
        if (!l1 || !l2)
            return;
        const v = model.points[ang.vertex];
        const a = model.points[l1.points[leg1.seg]];
        const b = model.points[l1.points[leg1.seg + 1]];
        const c = model.points[l2.points[leg2.seg]];
        const d = model.points[l2.points[leg2.seg + 1]];
        if (!v || !a || !b || !c || !d)
            return;
        const p1 = ang.vertex === l1.points[leg1.seg] ? b : a;
        const p2 = ang.vertex === l2.points[leg2.seg] ? d : c;
        const geom = angleGeometry(ang);
        if (!geom)
            return;
        const { start, end, clockwise, radius: r, style } = geom;
        ctx.save();
        ctx.strokeStyle = style.color;
        ctx.lineWidth = renderWidth(style.width);
        applyStrokeStyle(style.type);
        if (style.fill) {
            ctx.beginPath();
            ctx.moveTo(v.x, v.y);
            ctx.arc(v.x, v.y, r, start, end, clockwise);
            ctx.closePath();
            ctx.fillStyle = style.fill;
            ctx.fill();
        }
        const isRight = !!style.right;
        const arcCount = Math.max(1, style.arcCount ?? 1);
        const drawArcs = () => {
            for (let i = 0; i < arcCount; i++) {
                const rr = Math.max(2, r - i * 6);
                ctx.beginPath();
                ctx.arc(v.x, v.y, rr, start, end, clockwise);
                ctx.stroke();
            }
        };
        const drawRightMark = () => {
            const p1 = ang.vertex === l1.points[leg1.seg] ? b : a;
            const p2 = ang.vertex === l2.points[leg2.seg] ? d : c;
            const legLen1 = Math.hypot(p1.x - v.x, p1.y - v.y);
            const legLen2 = Math.hypot(p2.x - v.x, p2.y - v.y);
            const usable = Math.max(0, Math.min(legLen1, legLen2) - RIGHT_ANGLE_MARK_MARGIN);
            if (usable <= 0)
                return;
            const u1 = normalize({ x: p1.x - v.x, y: p1.y - v.y });
            const u2 = normalize({ x: p2.x - v.x, y: p2.y - v.y });
            let size;
            if (usable < RIGHT_ANGLE_MARK_MIN) {
                size = usable;
            }
            else {
                const growth = Math.max(0, r - RIGHT_ANGLE_MARK_MIN) * RIGHT_ANGLE_MARK_RATIO;
                size = RIGHT_ANGLE_MARK_MIN + growth;
                size = Math.min(size, RIGHT_ANGLE_MARK_MAX, usable);
            }
            const pA = { x: v.x + u1.x * size, y: v.y + u1.y * size };
            const pC = { x: v.x + u2.x * size, y: v.y + u2.y * size };
            const pB = { x: pA.x + u2.x * size, y: pA.y + u2.y * size };
            ctx.beginPath();
            ctx.moveTo(v.x, v.y);
            ctx.lineTo(pA.x, pA.y);
            ctx.lineTo(pB.x, pB.y);
            ctx.lineTo(pC.x, pC.y);
            ctx.stroke();
        };
        if (isRight) {
            drawRightMark();
        }
        else {
            drawArcs();
        }
        const selected = selectedAngleIndex === idx;
        if (selected) {
            ctx.strokeStyle = HIGHLIGHT_LINE.color;
            ctx.lineWidth = renderWidth(style.width + HIGHLIGHT_LINE.width);
            ctx.setLineDash(HIGHLIGHT_LINE.dash);
            if (isRight) {
                drawRightMark();
            }
            else {
                drawArcs();
            }
            ctx.setLineDash([]);
        }
        if (ang.label && !ang.label.hidden) {
            if (!ang.label.offset)
                ang.label.offset = defaultAngleLabelOffset(idx);
            const off = ang.label.offset ?? { x: 0, y: 0 };
            const selected = selectedLabel?.kind === 'angle' && selectedLabel.id === idx;
            drawLabelText(ang.label, v, selected, off);
        }
        ctx.restore();
    });
    model.points.forEach((p, idx) => {
        if (p.style.hidden && !showHidden)
            return;
        const pointHidden = !!p.style.hidden;
        ctx.save();
        ctx.globalAlpha = pointHidden && showHidden ? 0.4 : 1;
        ctx.fillStyle = p.style.color;
        const r = pointRadius(p.style.size);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1 / zoomFactor, 1 / zoomFactor);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (p.label && !p.label.hidden) {
            if (!p.label.offset)
                p.label.offset = defaultPointLabelOffset(idx);
            const off = p.label.offset ?? { x: 8, y: -8 };
            const selected = selectedLabel?.kind === 'point' && selectedLabel.id === idx;
            drawLabelText(p.label, { x: p.x, y: p.y }, selected, off);
        }
        const highlightPoint = idx === selectedPointIndex;
        const hoverPoint = hoverPointIndex === idx;
        const highlightColor = p.construction_kind === 'intersection' || p.construction_kind === 'midpoint' || p.construction_kind === 'symmetric'
            ? '#9ca3af'
            : p.construction_kind === 'on_object'
                ? '#ef4444'
                : HIGHLIGHT_LINE.color;
        if ((highlightPoint ||
            hoverPoint ||
            (selectedLineIndex !== null && selectionVertices && pointInLine(idx, model.lines[selectedLineIndex])) ||
            (selectedPolygonIndex !== null && selectionVertices && polygonHasPoint(idx, model.polygons[selectedPolygonIndex]))) &&
            (!p.style.hidden || showHidden)) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(1 / zoomFactor, 1 / zoomFactor);
            ctx.strokeStyle = highlightColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
    });
    // free labels
    model.labels.forEach((lab, idx) => {
        if (lab.hidden && !showHidden)
            return;
        const selected = selectedLabel?.kind === 'free' && selectedLabel.id === idx;
        drawLabelText({ text: lab.text, color: lab.color, fontSize: lab.fontSize }, lab.pos, selected);
    });
    model.inkStrokes.forEach((stroke, idx) => {
        if (stroke.hidden && !showHidden)
            return;
        ctx.save();
        if (stroke.hidden && showHidden)
            ctx.globalAlpha = 0.4;
        renderInkStroke(stroke, ctx);
        if (idx === selectedInkStrokeIndex) {
            const bounds = strokeBounds(stroke);
            if (bounds) {
                ctx.strokeStyle = HIGHLIGHT_LINE.color;
                ctx.lineWidth = renderWidth(2);
                ctx.setLineDash(HIGHLIGHT_LINE.dash);
                const margin = screenUnits(8);
                ctx.strokeRect(bounds.minX - margin, bounds.minY - margin, bounds.maxX - bounds.minX + margin * 2, bounds.maxY - bounds.minY + margin * 2);
                ctx.setLineDash([]);
            }
        }
        ctx.restore();
    });
    // Draw multiselect box
    if (mode === 'multiselect' && multiselectBoxStart && multiselectBoxEnd) {
        ctx.save();
        ctx.strokeStyle = THEME.highlight;
        ctx.lineWidth = renderWidth(2);
        ctx.setLineDash([4, 4]);
        ctx.fillStyle = THEME.highlight + '20';
        const x1 = Math.min(multiselectBoxStart.x, multiselectBoxEnd.x);
        const y1 = Math.min(multiselectBoxStart.y, multiselectBoxEnd.y);
        const w = Math.abs(multiselectBoxEnd.x - multiselectBoxStart.x);
        const h = Math.abs(multiselectBoxEnd.y - multiselectBoxStart.y);
        ctx.fillRect(x1, y1, w, h);
        ctx.strokeRect(x1, y1, w, h);
        ctx.setLineDash([]);
        ctx.restore();
    }
    // Highlight multiselected objects
    if (mode === 'multiselect') {
        ctx.save();
        ctx.strokeStyle = THEME.highlight;
        ctx.lineWidth = renderWidth(3);
        ctx.setLineDash([6, 3]);
        multiSelectedPoints.forEach(idx => {
            const p = model.points[idx];
            if (!p)
                return;
            ctx.beginPath();
            ctx.arc(p.x, p.y, screenUnits(12), 0, Math.PI * 2);
            ctx.stroke();
        });
        multiSelectedLines.forEach(idx => {
            const line = model.lines[idx];
            if (!line)
                return;
            line.points.forEach((pi, i) => {
                if (i === 0)
                    return;
                const a = model.points[line.points[i - 1]];
                const b = model.points[pi];
                if (!a || !b)
                    return;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            });
        });
        multiSelectedCircles.forEach(idx => {
            const circle = model.circles[idx];
            if (!circle)
                return;
            const center = model.points[circle.center];
            if (!center)
                return;
            const radius = circleRadius(circle);
            ctx.beginPath();
            ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
            ctx.stroke();
        });
        multiSelectedAngles.forEach(idx => {
            const ang = model.angles[idx];
            if (!ang)
                return;
            const geom = angleGeometry(ang);
            if (!geom)
                return;
            const v = model.points[ang.vertex];
            if (!v)
                return;
            ctx.beginPath();
            ctx.arc(v.x, v.y, geom.radius, geom.start, geom.end, geom.clockwise);
            ctx.stroke();
        });
        ctx.setLineDash([]);
        ctx.restore();
    }
    drawDebugLabels();
    renderDebugPanel();
}
function resizeCanvas() {
    if (!canvas)
        return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    draw();
}
const nowTime = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
const currentInkColor = () => styleColorInput?.value ?? THEME.defaultStroke;
const pointerPressure = (ev) => {
    const raw = Number(ev.pressure);
    if (!Number.isFinite(raw) || raw <= 0)
        return INK_PRESSURE_FALLBACK;
    return clamp(raw, 0.05, 1);
};
function createInkPoint(ev) {
    const pos = toPoint(ev);
    return {
        x: pos.x,
        y: pos.y,
        pressure: pointerPressure(ev),
        time: nowTime()
    };
}
function beginInkStroke(ev) {
    if (!canvas)
        return;
    const point = createInkPoint(ev);
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `ink-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const stroke = {
        id,
        points: [point],
        color: currentInkColor(),
        baseWidth: INK_BASE_WIDTH
    };
    model.inkStrokes.push(stroke);
    activeInkStroke = { pointerId: ev.pointerId, stroke };
    clearSelectionState();
    updateSelectionButtons();
    movedDuringDrag = true;
    try {
        canvas.setPointerCapture(ev.pointerId);
    }
    catch {
        /* ignore capture errors */
    }
    ev.preventDefault();
    draw();
}
function appendInkStrokePoint(ev) {
    if (!activeInkStroke || activeInkStroke.pointerId !== ev.pointerId)
        return;
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
function endInkStroke(pointerId) {
    if (!activeInkStroke || activeInkStroke.pointerId !== pointerId)
        return;
    const { stroke } = activeInkStroke;
    if (stroke.points.length === 1) {
        const pt = stroke.points[0];
        stroke.points[0] = { ...pt, pressure: Math.max(pt.pressure, 0.5), time: pt.time };
    }
    try {
        canvas?.releasePointerCapture(pointerId);
    }
    catch {
        /* ignore release errors */
    }
    activeInkStroke = null;
}
function setMode(next) {
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
            }
            else if (currentTool) {
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
    // Clear single selections early (but not for 'move' mode)
    if (mode !== 'move') {
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
    }
    else {
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
    updateToolButtons();
    draw();
}
function handleCanvasClick(ev) {
    if (!canvas)
        return;
    if (ev.pointerType === 'touch') {
        updateTouchPointFromEvent(ev);
        try {
            canvas.setPointerCapture(ev.pointerId);
        }
        catch (_) {
            /* ignore capture errors */
        }
        if (activeTouches.size >= 2) {
            if (!pinchState)
                startPinchFromTouches();
            ev.preventDefault();
            return;
        }
    }
    if (mode === 'handwriting') {
        beginInkStroke(ev);
        return;
    }
    const { x, y } = toPoint(ev);
    draggingCircleCenterAngles = null;
    circleDragContext = null;
    if (mode === 'move') {
        const labelHit = findLabelAt({ x, y });
        if (labelHit) {
            selectLabel(labelHit);
            let initialOffset = { x: 0, y: 0 };
            switch (labelHit.kind) {
                case 'point': {
                    const p = model.points[labelHit.id];
                    if (p?.label) {
                        if (!p.label.offset)
                            p.label.offset = defaultPointLabelOffset(labelHit.id);
                        initialOffset = p.label.offset ?? { x: 0, y: 0 };
                    }
                    break;
                }
                case 'line': {
                    const l = model.lines[labelHit.id];
                    if (l?.label) {
                        if (!l.label.offset)
                            l.label.offset = defaultLineLabelOffset(labelHit.id);
                        initialOffset = l.label.offset ?? { x: 0, y: 0 };
                    }
                    break;
                }
                case 'angle': {
                    const a = model.angles[labelHit.id];
                    if (a?.label) {
                        if (!a.label.offset)
                            a.label.offset = defaultAngleLabelOffset(labelHit.id);
                        initialOffset = a.label.offset ?? { x: 0, y: 0 };
                    }
                    break;
                }
                case 'free': {
                    const lab = model.labels[labelHit.id];
                    if (lab)
                        initialOffset = { x: lab.pos.x, y: lab.pos.y };
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
        }
        else if (selectedLabel) {
            selectedLabel = null;
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
                const polyLines = selectedPolygonIndex !== null &&
                    selectedSegments.size === 0 &&
                    model.polygons[selectedPolygonIndex]?.lines.includes(handleHit)
                    ? model.polygons[selectedPolygonIndex].lines
                    : [handleHit];
                const pointSet = new Set();
                polyLines.forEach((li) => {
                    model.lines[li]?.points.forEach((pi) => pointSet.add(pi));
                });
                const pts = Array.from(pointSet).map((pi) => ({ idx: pi, p: model.points[pi] })).filter((e) => e.p);
                const center = pts.length > 0
                    ? {
                        x: pts.reduce((sum, e) => sum + e.p.x, 0) / pts.length,
                        y: pts.reduce((sum, e) => sum + e.p.y, 0) / pts.length
                    }
                    : extent.center;
                const vectors = [];
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
        let desiredPos = { x, y };
        const lineAnchors = lineHits
            .map((h) => ({ hit: h, anchors: lineAnchorForHit(h), line: model.lines[h.line] }))
            .filter((h) => !!h.anchors && !!h.line);
        const circleAnchors = circleHits
            .map((h) => {
            const c = model.circles[h.circle];
            const cen = model.points[c?.center ?? -1];
            if (!c || !cen)
                return null;
            const radius = circleRadius(c);
            if (radius <= 1e-3)
                return null;
            return { center: { x: cen.x, y: cen.y }, radius, idx: h.circle, id: c.id };
        })
            .filter((v) => !!v);
        const candidates = [];
        // line-line
        for (let i = 0; i < lineAnchors.length; i++) {
            for (let j = i + 1; j < lineAnchors.length; j++) {
                const inter = intersectLines(lineAnchors[i].anchors.a, lineAnchors[i].anchors.b, lineAnchors[j].anchors.a, lineAnchors[j].anchors.b);
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
                    if (!line)
                        return;
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
                const inters = circleCircleIntersections(circleAnchors[i].center, circleAnchors[i].radius, circleAnchors[j].center, circleAnchors[j].radius);
                inters.forEach((pos) => candidates.push({
                    pos,
                    parents: [
                        { kind: 'circle', id: circleAnchors[i].id },
                        { kind: 'circle', id: circleAnchors[j].id }
                    ]
                }));
            }
        }
        let pointParents = [];
        if (candidates.length) {
            candidates.sort((a, b) => Math.hypot(a.pos.x - x, a.pos.y - y) - Math.hypot(b.pos.x - x, b.pos.y - y));
            desiredPos = candidates[0].pos;
            pointParents = candidates[0].parents;
        }
        else if (circleAnchors.length === 1) {
            const c = circleAnchors[0];
            const dir = normalize({ x: x - c.center.x, y: y - c.center.y });
            desiredPos = { x: c.center.x + dir.x * c.radius, y: c.center.y + dir.y * c.radius };
            pointParents = [{ kind: 'circle', id: c.id }];
        }
        else if (lineAnchors.length === 1) {
            desiredPos = projectPointOnLine({ x, y }, lineAnchors[0].anchors.a, lineAnchors[0].anchors.b);
            const line = lineAnchors[0].line;
            if (line)
                pointParents = [{ kind: 'line', id: line.id }];
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
        if (!lineHits.length)
            selectedLineIndex = null;
        selectedCircleIndex = null;
        updateSelectionButtons();
        draw();
        pushHistory();
        if (stickyTool === null) {
            setMode('move');
        }
        else {
            updateToolButtons();
        }
    }
    else if (mode === 'segment') {
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
        }
        else {
            const startPt = model.points[start];
            const endIsExisting = hit !== null;
            const endPos = endIsExisting ? { x, y } : snapDir(startPt, { x, y });
            const endIdx = hit ?? addPoint(model, { ...endPos, style: currentPointStyle() });
            const endPt = model.points[endIdx];
            if (startPt && endPt && startPt.x === endPt.x && startPt.y === endPt.y) {
                if (!endIsExisting) {
                    model.points.pop();
                    rebuildIndexMaps();
                }
                else if (segmentStartTemporary) {
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
    }
    else if (mode === 'parallel' || mode === 'perpendicular') {
        let hitPoint = findPoint({ x, y });
        const lineHits = findLineHits({ x, y });
        let hitLine = null;
        if (lineHits.length) {
            if (pendingParallelPoint !== null) {
                hitLine =
                    lineHits.find((h) => !model.lines[h.line]?.points.includes(pendingParallelPoint)) ?? lineHits[0];
            }
            else {
                hitLine = lineHits[0];
            }
            if (!hitPoint && hitLine.part === 'segment') {
                const line = model.lines[hitLine.line];
                const aIdx = line.points[0];
                const bIdx = line.points[line.points.length - 1];
                const a = model.points[aIdx];
                const b = model.points[bIdx];
                const tol = currentHitRadius();
                if (a && Math.hypot(a.x - x, a.y - y) <= tol)
                    hitPoint = aIdx;
                else if (b && Math.hypot(b.x - x, b.y - y) <= tol)
                    hitPoint = bIdx;
            }
        }
        if (hitPoint !== null) {
            pendingParallelPoint = hitPoint;
            selectedPointIndex = hitPoint;
            selectedCircleIndex = null;
            // keep existing line selection if set previously
        }
        else if (pendingParallelPoint === null && selectedPointIndex !== null) {
            pendingParallelPoint = selectedPointIndex;
        }
        if (hitLine !== null) {
            if (hitPoint !== null && model.lines[hitLine.line]?.points.includes(hitPoint)) {
                // prefer point selection; avoid overriding with the same line
            }
            else {
                pendingParallelLine = hitLine.line;
                selectedLineIndex = hitLine.line;
                selectedCircleIndex = null;
            }
        }
        else if (pendingParallelLine === null && selectedLineIndex !== null) {
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
    }
    else if (mode === 'symmetric') {
        const sourceIdx = symmetricSourceIndex;
        const hitPoint = findPoint({ x, y });
        const lineHit = findLine({ x, y });
        if (sourceIdx === null) {
            if (hitPoint === null)
                return;
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
        let target = null;
        let meta = null;
        let parents = [];
        if (hitPoint !== null) {
            const mirror = model.points[hitPoint];
            if (!mirror)
                return;
            meta = { source: source.id, mirror: { kind: 'point', id: mirror.id } };
            target = { x: mirror.x * 2 - source.x, y: mirror.y * 2 - source.y };
        }
        else if (lineHit && lineHit.part === 'segment') {
            const line = model.lines[lineHit.line];
            if (!line)
                return;
            meta = { source: source.id, mirror: { kind: 'line', id: line.id } };
            parents = [{ kind: 'line', id: line.id }];
            target = reflectPointAcrossLine(source, line);
        }
        else {
            return;
        }
        if (!meta || !target)
            return;
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
    }
    else if (mode === 'parallelLine') {
        const hitPoint = findPoint({ x, y });
        const lineHit = findLine({ x, y });
        const setAnchor = (idx) => {
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
                }
                else {
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
        }
        else {
            draw();
        }
    }
    else if (mode === 'circle') {
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
        const radiusPointIdx = pendingCircleRadiusPoint ??
            (hitPoint !== null && hitPoint !== centerIdx ? hitPoint : null) ??
            addPoint(model, hitPoint === null
                ? { ...snapDir(model.points[centerIdx], { x, y }), style: currentPointStyle() }
                : { x, y, style: currentPointStyle() });
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
        }
        else {
            maybeRevertMode();
        }
        updateSelectionButtons();
    }
    else if (mode === 'circleThree') {
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
        circleThreePoints.push(ptIdx);
        selectedPointIndex = ptIdx;
        selectedLineIndex = null;
        selectedCircleIndex = null;
        if (circleThreePoints.length === 3) {
            const circleIdx = addCircleThroughPoints(circleThreePoints);
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
    }
    else if (mode === 'triangleUp') {
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
            recompute: () => { },
            on_parent_deleted: () => { }
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
    }
    else if (mode === 'square') {
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
            recompute: () => { },
            on_parent_deleted: () => { }
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
    }
    else if (mode === 'polygon') {
        const hitPoint = findPoint({ x, y });
        const wasTemporary = hitPoint === null;
        const idx = hitPoint ??
            addPoint(model, polygonChain.length === 1
                ? { ...snapDir(model.points[polygonChain[0]], { x, y }), style: currentPointStyle() }
                : { x, y, style: currentPointStyle() });
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
            if (wasTemporary)
                removePointsKeepingOrder([idx]);
            selectedPointIndex = lastIdx;
            draw();
            return;
        }
        const style = currentStrokeStyle();
        const tol = currentHitRadius();
        if (idx === firstIdx ||
            Math.hypot(model.points[firstIdx].x - model.points[idx].x, model.points[firstIdx].y - model.points[idx].y) <= tol) {
            const closingLine = addLineFromPoints(model, lastIdx, firstIdx, style);
            currentPolygonLines.push(closingLine);
            const polyId = nextId('polygon', model);
            const poly = {
                object_type: 'polygon',
                id: polyId,
                lines: [...currentPolygonLines],
                construction_kind: 'free',
                defining_parents: [],
                children: [],
                recompute: () => { },
                on_parent_deleted: () => { }
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
        }
        else {
            const newLine = addLineFromPoints(model, lastIdx, idx, style);
            currentPolygonLines.push(newLine);
            polygonChain.push(idx);
            selectedPointIndex = idx;
            selectedLineIndex = newLine;
            draw();
            updateSelectionButtons();
        }
    }
    else if (mode === 'angle') {
        const lineHit = findLine({ x, y });
        if (!lineHit || lineHit.part !== 'segment')
            return;
        const l = model.lines[lineHit.line];
        const a = l.points[lineHit.seg];
        const b = l.points[lineHit.seg + 1];
        if (a === undefined || b === undefined)
            return;
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
            recompute: () => { },
            on_parent_deleted: () => { }
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
    }
    else if (mode === 'label') {
        const pointHit = findPoint({ x, y });
        const lineHit = findLine({ x, y });
        const angleHit = findAngleAt({ x, y }, currentHitRadius(1.5));
        const polyHit = lineHit ? polygonForLine(lineHit.line) : selectedPolygonIndex;
        const color = styleColorInput?.value || '#000';
        let consumed = false;
        let changed = false;
        const polygonHasLabels = (polyIdx) => {
            if (polyIdx === null)
                return false;
            const verts = polygonVerticesOrdered(polyIdx);
            return verts.length > 0 && verts.every((vi) => !!model.points[vi]?.label);
        };
        // apply to current selection first
        if (selectedAngleIndex !== null) {
            consumed = true;
            if (!model.angles[selectedAngleIndex].label) {
                const { text, seq } = nextGreek();
                model.angles[selectedAngleIndex].label = {
                    text,
                    color,
                    offset: defaultAngleLabelOffset(selectedAngleIndex),
                    fontSize: LABEL_FONT_DEFAULT,
                    seq
                };
                changed = true;
            }
        }
        else if (selectedPolygonIndex !== null) {
            consumed = true;
            if (selectedSegments.size > 0) {
                selectedSegments.forEach((key) => {
                    const parsed = parseSegmentKey(key);
                    if (!parsed || parsed.part !== 'segment')
                        return;
                    const li = parsed.line;
                    if (!model.lines[li])
                        return;
                    if (!model.lines[li].label) {
                        const { text, seq } = nextLower();
                        model.lines[li].label = {
                            text,
                            color,
                            offset: defaultLineLabelOffset(li),
                            fontSize: LABEL_FONT_DEFAULT,
                            seq
                        };
                        changed = true;
                    }
                });
            }
            else if (!polygonHasLabels(selectedPolygonIndex)) {
                const verts = polygonVerticesOrdered(selectedPolygonIndex);
                verts.forEach((vi, i) => {
                    const idx = labelUpperIdx + i;
                    const text = seqLetter(idx, UPPER_SEQ);
                    model.points[vi].label = {
                        text,
                        color,
                        offset: defaultPointLabelOffset(vi),
                        fontSize: LABEL_FONT_DEFAULT,
                        seq: { kind: 'upper', idx }
                    };
                });
                labelUpperIdx += verts.length;
                changed = verts.length > 0;
            }
        }
        else if (selectedLineIndex !== null) {
            consumed = true;
            if (!model.lines[selectedLineIndex].label) {
                const { text, seq } = nextLower();
                model.lines[selectedLineIndex].label = {
                    text,
                    color,
                    offset: defaultLineLabelOffset(selectedLineIndex),
                    fontSize: LABEL_FONT_DEFAULT,
                    seq
                };
                changed = true;
            }
        }
        else if (selectedPointIndex !== null) {
            consumed = true;
            if (!model.points[selectedPointIndex].label) {
                const { text, seq } = nextUpper();
                model.points[selectedPointIndex].label = {
                    text,
                    color,
                    offset: defaultPointLabelOffset(selectedPointIndex),
                    fontSize: LABEL_FONT_DEFAULT,
                    seq
                };
                changed = true;
            }
        }
        if (!consumed && angleHit !== null) {
            consumed = true;
            if (!model.angles[angleHit].label) {
                const { text, seq } = nextGreek();
                model.angles[angleHit].label = {
                    text,
                    color,
                    offset: defaultAngleLabelOffset(angleHit),
                    fontSize: LABEL_FONT_DEFAULT,
                    seq
                };
                selectedAngleIndex = angleHit;
                changed = true;
            }
            else {
                selectedAngleIndex = angleHit;
            }
        }
        else if (pointHit !== null) {
            consumed = true;
            selectedPointIndex = pointHit;
            if (!model.points[pointHit].label) {
                const { text, seq } = nextUpper();
                model.points[pointHit].label = {
                    text,
                    color,
                    offset: defaultPointLabelOffset(pointHit),
                    fontSize: LABEL_FONT_DEFAULT,
                    seq
                };
                changed = true;
            }
        }
        else if (polyHit !== null && selectedPolygonIndex === polyHit) {
            consumed = true;
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
                        fontSize: LABEL_FONT_DEFAULT,
                        seq: { kind: 'upper', idx }
                    };
                });
                labelUpperIdx += verts.length;
                changed = verts.length > 0;
            }
        }
        else if (lineHit && lineHit.part === 'segment') {
            consumed = true;
            selectedLineIndex = lineHit.line;
            if (!model.lines[lineHit.line].label) {
                const { text, seq } = nextLower();
                model.lines[lineHit.line].label = {
                    text,
                    color,
                    offset: defaultLineLabelOffset(lineHit.line),
                    fontSize: LABEL_FONT_DEFAULT,
                    seq
                };
                changed = true;
            }
        }
        else {
            const text = window.prompt('Etykieta:', '');
            if (text && text.trim()) {
                const clean = text.trim();
                let seq;
                if (clean.length === 1) {
                    const ch = clean;
                    const upperIdx = UPPER_SEQ.indexOf(ch);
                    const lowerIdx = LOWER_SEQ.indexOf(ch);
                    const greekIdx = GREEK_SEQ.indexOf(ch);
                    if (upperIdx >= 0) {
                        seq = { kind: 'upper', idx: upperIdx };
                        freeUpperIdx = freeUpperIdx.filter((i) => i !== upperIdx);
                        if (upperIdx >= labelUpperIdx)
                            labelUpperIdx = upperIdx + 1;
                    }
                    else if (lowerIdx >= 0) {
                        seq = { kind: 'lower', idx: lowerIdx };
                        freeLowerIdx = freeLowerIdx.filter((i) => i !== lowerIdx);
                        if (lowerIdx >= labelLowerIdx)
                            labelLowerIdx = lowerIdx + 1;
                    }
                    else if (greekIdx >= 0) {
                        seq = { kind: 'greek', idx: greekIdx };
                        freeGreekIdx = freeGreekIdx.filter((i) => i !== greekIdx);
                        if (greekIdx >= labelGreekIdx)
                            labelGreekIdx = greekIdx + 1;
                    }
                }
                model.labels.push({ text: clean, pos: { x, y }, color, fontSize: LABEL_FONT_DEFAULT, seq });
                consumed = true;
                changed = true;
            }
        }
        if (consumed) {
            if (changed) {
                draw();
                pushHistory();
            }
            maybeRevertMode();
            updateSelectionButtons();
        }
    }
    else if (mode === 'bisector') {
        const lineHit = findLine({ x, y });
        if (!lineHit || lineHit.part !== 'segment')
            return;
        const l = model.lines[lineHit.line];
        const a = l.points[lineHit.seg];
        const b = l.points[lineHit.seg + 1];
        if (a === undefined || b === undefined)
            return;
        if (!bisectorFirstLeg) {
            bisectorFirstLeg = { line: lineHit.line, seg: lineHit.seg, a, b, vertex: a };
            selectedLineIndex = lineHit.line;
            selectedPointIndex = a;
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
            recompute: () => { },
            on_parent_deleted: () => { }
        });
        registerIndex(model, 'angle', angleId, model.angles.length - 1);
        selectedAngleIndex = model.angles.length - 1;
        selectedPointIndex = null;
        bisectorFirstLeg = null;
        draw();
        pushHistory();
        maybeRevertMode();
        updateSelectionButtons();
    }
    else if (mode === 'midpoint') {
        const hitPoint = findPoint({ x, y });
        const lineHit = findLine({ x, y });
        if (lineHit && lineHit.part === 'segment' && midpointFirstIndex === null) {
            const l = model.lines[lineHit.line];
            const a = model.points[l.points[lineHit.seg]];
            const b = model.points[l.points[lineHit.seg + 1]];
            if (a && b) {
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                const parents = [a.id, b.id];
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
        if (midpointFirstIndex === null) {
            if (hitPoint === null)
                return;
            midpointFirstIndex = hitPoint;
            selectedPointIndex = hitPoint;
            draw();
            return;
        }
        const secondIdx = hitPoint ?? addPoint(model, { x, y, style: currentPointStyle() });
        const p1 = model.points[midpointFirstIndex];
        const p2 = model.points[secondIdx];
        if (!p1 || !p2) {
            midpointFirstIndex = null;
            maybeRevertMode();
            updateSelectionButtons();
            return;
        }
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const parents = [p1.id, p2.id];
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
    }
    else if (mode === 'ngon') {
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
        const coords = [];
        for (let i = 0; i < ngonSides; i++) {
            const ang = startAng + i * signedStep;
            coords.push({ x: center.x + Math.cos(ang) * R, y: center.y + Math.sin(ang) * R });
        }
        const verts = [];
        for (let i = 0; i < coords.length; i++) {
            if (i === 0) {
                verts.push(aIdx);
                continue;
            }
            if (i === 1) {
                verts.push(bIdx);
                continue;
            }
            verts.push(addPoint(model, { ...coords[i], style: currentPointStyle() }));
        }
        const style = currentStrokeStyle();
        const polyLines = [];
        for (let i = 0; i < verts.length; i++) {
            const ln = addLineFromPoints(model, verts[i], verts[(i + 1) % verts.length], style);
            polyLines.push(ln);
        }
        const polyId = nextId('polygon', model);
        model.polygons.push({
            object_type: 'polygon',
            id: polyId,
            lines: polyLines,
            construction_kind: 'free',
            defining_parents: [],
            children: [],
            recompute: () => { },
            on_parent_deleted: () => { }
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
    }
    else if (mode === 'multiselect') {
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
                }
                else {
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
                }
                else {
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
                }
                else {
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
                }
                else {
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
                }
                else {
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
                }
                else {
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
    }
    else if (mode === 'move') {
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
            }
            else if (copiedStyle.sourceType === 'angle' && angleHit !== null) {
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
            }
            else if (copiedStyle.sourceType === 'circle' && circleHit !== null) {
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
            }
            else if (copiedStyle.sourceType === 'line' && lineHit !== null) {
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
            }
            else if (copiedStyle.sourceType === 'point' && pointHit !== null) {
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
        let fallbackCircleIdx = null;
        let circleFallback = false;
        if (pointHit !== null) {
            const pt = model.points[pointHit];
            const draggable = isPointDraggable(pt);
            const preferPointSelection = !draggable && (pt.construction_kind === 'intersection' || isMidpointPoint(pt) || isSymmetricPoint(pt));
            if (!draggable && !preferPointSelection) {
                if (circleHit !== null) {
                    fallbackCircleIdx = circleHit.circle;
                }
                else {
                    const circleParent = pt.parent_refs.find((pr) => pr.kind === 'circle');
                    if (circleParent) {
                        const idx = model.indexById.circle[circleParent.id];
                        if (idx !== undefined)
                            fallbackCircleIdx = idx;
                    }
                }
            }
            circleFallback = fallbackCircleIdx !== null;
            const lineFallback = !draggable && !preferPointSelection && lineHit !== null && isLineDraggable(model.lines[lineHit.line]);
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
                        const context = new Map();
                        centerCircles.forEach((ci) => {
                            const circle = model.circles[ci];
                            const centerPoint = pt;
                            if (!circle || !centerPoint)
                                return;
                            const angles = new Map();
                            circle.points.forEach((pid) => {
                                const pnt = model.points[pid];
                                if (!pnt)
                                    return;
                                angles.set(pid, Math.atan2(pnt.y - centerPoint.y, pnt.x - centerPoint.x));
                            });
                            const radiusPt = model.points[circle.radius_point];
                            if (radiusPt) {
                                angles.set(circle.radius_point, Math.atan2(radiusPt.y - centerPoint.y, radiusPt.x - centerPoint.x));
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
                }
                else {
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
        const arcMatchesCircle = arcHit !== null && targetedCircleIdx !== null && arcHit.circle === targetedCircleIdx;
        const allowArcToggle = arcMatchesCircle &&
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
                    if (selectedArcSegments.has(key))
                        selectedArcSegments.delete(key);
                    else
                        selectedArcSegments.add(key);
                }
                else {
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
            const originals = new Map();
            const recordPoint = (idx) => {
                if (idx === undefined || idx < 0)
                    return;
                const pt = model.points[idx];
                if (!pt)
                    return;
                originals.set(idx, { x: pt.x, y: pt.y });
            };
            recordPoint(centerIdx);
            recordPoint(c.radius_point);
            c.points.forEach((pid) => recordPoint(pid));
            circleDragContext = { circleIdx, originals };
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
                if (selectedArcSegments.has(key))
                    selectedArcSegments.delete(key);
                else
                    selectedArcSegments.add(key);
            }
            else {
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
                    }
                    else if (selectedSegments.has(key)) {
                        selectedSegments.delete(key);
                    }
                    else {
                        selectedSegments.add(key);
                    }
                }
                else {
                    selectedPolygonIndex = polyIdx;
                    selectedSegments.clear();
                }
                selectedLineIndex = lineHit.line;
                selectedArcSegments.clear();
                selectedAngleIndex = null;
            }
            else {
                if (selectedLineIndex === lineHit.line) {
                    if (selectedSegments.size === 0) {
                        selectedSegments.add(hitKey(lineHit));
                    }
                    else {
                        const key = hitKey(lineHit);
                        if (selectedSegments.has(key))
                            selectedSegments.delete(key);
                        else
                            selectedSegments.add(key);
                    }
                }
                else {
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
let buttonConfig = {
    multiButtons: {},
    secondRow: {}
};
// Track current state of multi-buttons (which button in the cycle is currently active)
let multiButtonStates = {};
// Track second row state
let secondRowVisible = false;
let secondRowActiveButton = null;
let secondRowToolIds = []; // Track which tools are in the currently visible second row
// Track double tap for sticky tool
const doubleTapTimeouts = new Map();
const DOUBLE_TAP_DELAY = 300; // ms
let configTouchDrag = null;
// Button order in palette (determines toolbar order)
let buttonOrder = [];
// Button configuration - available tool buttons for configuration
const TOOL_BUTTONS = [
    { id: 'modeMove', label: 'Zaznaczanie', mode: 'move', icon: '<path d="M12 3 9.5 5.5 12 8l2.5-2.5L12 3Zm0 13-2.5 2.5L12 21l2.5-2.5L12 16Zm-9-4 2.5 2.5L8 12 5.5 9.5 3 12Zm13 0 2.5 2.5L21 12l-2.5-2.5L16 12ZM8 12l8 0" />', viewBox: '0 0 24 24' },
    { id: 'modeAdd', label: 'Punkt', mode: 'add', icon: '<circle cx="12" cy="12" r="4.5" class="icon-fill"/>', viewBox: '0 0 24 24' },
    { id: 'modeSegment', label: 'Odcinek', mode: 'segment', icon: '<circle cx="6" cy="12" r="2.2" class="icon-fill"/><circle cx="18" cy="12" r="2.2" class="icon-fill"/><line x1="6" y1="12" x2="18" y2="12"/>', viewBox: '0 0 24 24' },
    { id: 'modeParallel', label: 'Równoległa', mode: 'parallel', icon: '<line x1="5" y1="8" x2="19" y2="8"/><line x1="5" y1="16" x2="19" y2="16"/>', viewBox: '0 0 24 24' },
    { id: 'modePerpendicular', label: 'Prostopadła', mode: 'perpendicular', icon: '<line x1="5" y1="12" x2="19" y2="12"/><line x1="12" y1="5" x2="12" y2="19"/>', viewBox: '0 0 24 24' },
    { id: 'modeCircle', label: 'Okrąg', mode: 'circle', icon: '<circle cx="12" cy="12" r="8"/><line x1="12" y1="12" x2="18" y2="12"/><circle cx="18" cy="12" r="1.4" class="icon-fill"/>', viewBox: '0 0 24 24' },
    { id: 'modeCircleThree', label: 'Okrąg przez 3 punkty', mode: 'circleThree', icon: '<ellipse cx="12" cy="12" rx="8.5" ry="7.5" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="6.5" r="2.2" class="icon-fill" stroke="currentColor" stroke-width="0.8"/><circle cx="16.5" cy="6" r="2.2" class="icon-fill" stroke="currentColor" stroke-width="0.8"/><circle cx="17.5" cy="16" r="2.2" class="icon-fill" stroke="currentColor" stroke-width="0.8"/>', viewBox: '0 0 24 24' },
    { id: 'modeTriangleUp', label: 'Trójkąt foremny', mode: 'triangleUp', icon: '<path d="M4 18h16L12 5Z"/>', viewBox: '0 0 24 24' },
    { id: 'modeSquare', label: 'Kwadrat', mode: 'square', icon: '<rect x="5" y="5" width="14" height="14"/>', viewBox: '0 0 24 24' },
    { id: 'modePolygon', label: 'Wielokąt', mode: 'polygon', icon: '<polygon points="5,4 19,7 16,19 5,15"/><circle cx="5" cy="4" r="1.2" class="icon-fill"/><circle cx="19" cy="7" r="1.2" class="icon-fill"/><circle cx="16" cy="19" r="1.2" class="icon-fill"/><circle cx="5" cy="15" r="1.2" class="icon-fill"/>', viewBox: '0 0 24 24' },
    { id: 'modeAngle', label: 'Kąt', mode: 'angle', icon: '<line x1="14" y1="54" x2="50" y2="54" stroke="currentColor" stroke-width="4" stroke-linecap="round" /><line x1="14" y1="54" x2="42" y2="18" stroke="currentColor" stroke-width="4" stroke-linecap="round" /><path d="M20 46 A12 12 0 0 1 32 54" fill="none" stroke="currentColor" stroke-width="3" />', viewBox: '0 0 64 64' },
    { id: 'modeBisector', label: 'Dwusieczna', mode: 'bisector', icon: '<line x1="6" y1="18" x2="20" y2="18" /><line x1="6" y1="18" x2="14" y2="6" /><line x1="6" y1="18" x2="20" y2="10" />', viewBox: '0 0 24 24' },
    { id: 'modeMidpoint', label: 'Punkt środkowy', mode: 'midpoint', icon: '<circle cx="6" cy="12" r="1.5" class="icon-fill"/><circle cx="18" cy="12" r="1.5" class="icon-fill"/><circle cx="12" cy="12" r="2.5" class="icon-fill"/><circle cx="12" cy="12" r="1" fill="var(--bg)" stroke="none"/>', viewBox: '0 0 24 24' },
    { id: 'modeSymmetric', label: 'Symetria', mode: 'symmetric', icon: '<line x1="12" y1="4" x2="12" y2="20" /><circle cx="7.5" cy="10" r="1.7" class="icon-fill"/><circle cx="16.5" cy="14" r="1.7" class="icon-fill"/><path d="M7.5 10 16.5 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>', viewBox: '0 0 24 24' },
    { id: 'modeNgon', label: 'N-kąt', mode: 'ngon', icon: '<polygon points="20,15.5 15.5,20 8.5,20 4,15.5 4,8.5 8.5,4 15.5,4 20,8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>', viewBox: '0 0 24 24' },
    { id: 'modeLabel', label: 'Etykieta', mode: 'label', icon: '<path d="M5 7h9l5 5-5 5H5V7Z"/><path d="M8 11h4" /><path d="M8 14h3" />', viewBox: '0 0 24 24' },
    { id: 'modeHandwriting', label: 'Pismo ręczne', mode: 'handwriting', icon: '<path d="M5.5 18.5 4 20l1.5-.1L9 19l10.5-10.5a1.6 1.6 0 0 0 0-2.2L17.7 4a1.6 1.6 0 0 0-2.2 0L5 14.5l.5 4Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 5.5 18.5 8.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>', viewBox: '0 0 24 24' },
    { id: 'modeMultiselect', label: 'Zaznacz wiele', mode: 'multiselect', icon: '<rect x="3" y="3" width="8" height="8" rx="1" stroke-dasharray="2 2"/><rect x="13" y="3" width="8" height="8" rx="1" stroke-dasharray="2 2"/><rect x="3" y="13" width="8" height="8" rx="1" stroke-dasharray="2 2"/><rect x="13" y="13" width="8" height="8" rx="1" stroke-dasharray="2 2"/>', viewBox: '0 0 24 24' }
];
function initializeButtonConfig() {
    const multiButtonArea = document.getElementById('multiButtonConfig');
    if (!multiButtonArea)
        return;
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
        if (!tool)
            return;
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
function loadConfigIntoUI(multiGroups, secondGroups) {
    // Load multi-button groups
    Object.entries(buttonConfig.multiButtons).forEach(([mainId, buttonIds]) => {
        if (buttonIds.length > 0) {
            const group = addButtonGroup(multiGroups, 'multi');
            if (!group)
                return;
            const removeBtn = group.querySelector('.group-remove-btn');
            buttonIds.forEach(toolId => {
                const toolInfo = TOOL_BUTTONS.find(t => t.id === toolId);
                if (!toolInfo)
                    return;
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
            if (!group)
                return;
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
                if (!toolInfo)
                    return;
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
    if (!toolRow)
        return;
    // Get all TOOL buttons (only from TOOL_BUTTONS list, not other buttons!)
    const allButtons = new Map();
    TOOL_BUTTONS.forEach(tool => {
        const btn = document.getElementById(tool.id);
        if (btn) {
            allButtons.set(tool.id, btn);
        }
    });
    // Track which buttons have been placed
    const placedButtons = new Set();
    // Apply multi-button configuration
    Object.entries(buttonConfig.multiButtons).forEach(([mainId, buttonIds]) => {
        const mainBtn = allButtons.get(mainId);
        if (!mainBtn || buttonIds.length === 0)
            return;
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
            if (oldIndicator)
                oldIndicator.remove();
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
            const newBtn = mainBtn.cloneNode(true);
            mainBtn.parentNode?.replaceChild(newBtn, mainBtn);
            allButtons.set(mainId, newBtn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const currentIndex = multiButtonStates[mainId];
                const currentToolId = buttonIds[currentIndex];
                const currentTool = TOOL_BUTTONS.find(t => t.id === currentToolId);
                if (!currentTool)
                    return;
                // Check if current tool is already active
                let isCurrentToolActive = false;
                if (currentToolId === 'copyStyleBtn') {
                    isCurrentToolActive = copyStyleActive;
                }
                else {
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
                            }
                            else {
                                setMode('move');
                            }
                        }
                        else {
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
                            }
                            else {
                                setMode(newTool.mode);
                            }
                        }
                    }
                }
                else {
                    // Activate current tool
                    if (currentToolId === 'copyStyleBtn') {
                        if (!copyStyleActive) {
                            const style = copyStyleFromSelection();
                            if (style) {
                                copiedStyle = style;
                                copyStyleActive = true;
                                updateSelectionButtons();
                            }
                        }
                        else {
                            copyStyleActive = false;
                            copiedStyle = null;
                            updateSelectionButtons();
                        }
                    }
                    else {
                        setMode(currentTool.mode);
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
        if (!mainBtn || secondRowIds.length === 0)
            return;
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
        const isSecondaryInMulti = Object.values(buttonConfig.multiButtons).some(group => group.includes(id) && group[0] !== id);
        // If button is in a second-row group, only show main button
        const isMainInSecondRow = Object.keys(buttonConfig.secondRow).includes(id);
        const isInSecondRow = Object.values(buttonConfig.secondRow).some(group => group.includes(id));
        if (isSecondaryInMulti || isInSecondRow) {
            // Hide secondary buttons in multi-groups and all second-row buttons
            btn.style.display = 'none';
        }
        else {
            // Show main buttons and unconfigured buttons
            btn.style.display = 'inline-flex';
        }
    });
    // Reorder buttons in toolbar according to buttonOrder
    const orderedButtons = [];
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
function attachSecondRowHandlers(allButtons) {
    // Find all buttons with has-second-row class in the actual DOM
    const toolbar = document.getElementById('toolbarMainRow');
    if (!toolbar)
        return;
    const secondRowButtons = toolbar.querySelectorAll('.has-second-row');
    secondRowButtons.forEach((btn) => {
        const htmlBtn = btn;
        const secondRowConfig = htmlBtn.dataset.secondRowConfig;
        if (!secondRowConfig)
            return;
        const secondRowIds = JSON.parse(secondRowConfig);
        const mainId = htmlBtn.id;
        // Add swipe-up/drag-up detection for both touch and mouse
        let startY = 0;
        let startTime = 0;
        let isDragging = false;
        let hasMovedEnough = false;
        const handleStart = (clientY) => {
            startY = clientY;
            startTime = Date.now();
            isDragging = false;
            hasMovedEnough = false;
        };
        const handleMove = (clientY, event) => {
            const deltaY = startY - clientY;
            const deltaTime = Date.now() - startTime;
            // Mark as moved if moved more than a small threshold
            if (Math.abs(deltaY) > 5) {
                hasMovedEnough = true;
            }
            // Detect swipe/drag up (moved up more than 20px in less than 500ms)
            if (deltaY > 20 && deltaTime < 500 && !isDragging) {
                isDragging = true;
                if (event)
                    event.preventDefault();
                toggleSecondRow(mainId, secondRowIds, allButtons);
            }
        };
        const handleEnd = () => {
            isDragging = false;
        };
        // Touch events
        htmlBtn.addEventListener('touchstart', (e) => {
            handleStart(e.touches[0].clientY);
        }, { passive: true });
        htmlBtn.addEventListener('touchmove', (e) => {
            handleMove(e.touches[0].clientY, e);
        }, { passive: false });
        htmlBtn.addEventListener('touchend', handleEnd, { passive: true });
        // Mouse events
        let mouseDown = false;
        htmlBtn.addEventListener('mousedown', (e) => {
            mouseDown = true;
            handleStart(e.clientY);
        });
        htmlBtn.addEventListener('mousemove', (e) => {
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
function toggleSecondRow(mainId, secondRowIds, allButtons) {
    const secondRowContainer = document.getElementById('toolbarSecondRow');
    if (!secondRowContainer)
        return;
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
            const clonedBtn = btn.cloneNode(true);
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
                    setMode(tool.mode);
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
    if (!secondRowContainer)
        return;
    secondRowContainer.classList.add('hidden');
    setTimeout(() => {
        secondRowContainer.style.display = 'none';
    }, 250); // Wait for animation to complete
    secondRowVisible = false;
    secondRowActiveButton = null;
    secondRowToolIds = [];
}
function updateSecondRowActiveStates() {
    if (!secondRowVisible)
        return;
    const secondRowContainer = document.getElementById('toolbarSecondRow');
    if (!secondRowContainer)
        return;
    const buttons = secondRowContainer.querySelectorAll('button.tool');
    buttons.forEach(btn => {
        const btnTool = TOOL_BUTTONS.find(t => {
            const btnTitle = btn.getAttribute('title');
            return btnTitle && t.label === btnTitle;
        });
        if (btnTool && btnTool.mode === mode) {
            btn.classList.add('active');
        }
        else {
            btn.classList.remove('active');
        }
    });
}
function setupPaletteDragAndDrop() {
    const paletteGrid = document.getElementById('paletteGrid');
    const paletteButtons = document.querySelectorAll('.config-tool-btn');
    paletteButtons.forEach(btn => {
        const htmlBtn = btn;
        htmlBtn.draggable = true;
        const toolId = htmlBtn.dataset.toolId;
        const tool = TOOL_BUTTONS.find(t => t.id === toolId);
        if (!tool)
            return;
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
                    const targetIndex = buttonOrder.indexOf(toolId);
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
                const target = e.target;
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
function setupDropZone(element, type) {
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
        if (!e.dataTransfer)
            return;
        const toolId = e.dataTransfer.getData('toolId');
        const toolIcon = e.dataTransfer.getData('toolIcon');
        const toolViewBox = e.dataTransfer.getData('toolViewBox');
        const toolLabel = e.dataTransfer.getData('toolLabel');
        const target = e.target;
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
                    }
                    else {
                        group.appendChild(toolBtn);
                    }
                    saveButtonConfig();
                }
            }
            else {
                // Create new group
                addButtonGroup(element, type);
                const newGroup = element.lastElementChild;
                if (newGroup) {
                    const removeBtn = newGroup.querySelector('.group-remove-btn');
                    const toolBtn = createConfigToolButton(toolId, toolIcon, toolViewBox, toolLabel);
                    if (removeBtn) {
                        newGroup.insertBefore(toolBtn, removeBtn);
                    }
                    else {
                        newGroup.appendChild(toolBtn);
                    }
                    saveButtonConfig();
                }
            }
        }
    });
}
function createConfigToolButton(toolId, toolIcon, toolViewBox, toolLabel) {
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
        if (!e.dataTransfer)
            return;
        const draggedToolId = e.dataTransfer.getData('toolId');
        const draggedToolIcon = e.dataTransfer.getData('toolIcon');
        const draggedToolViewBox = e.dataTransfer.getData('toolViewBox');
        const draggedToolLabel = e.dataTransfer.getData('toolLabel');
        const fromGroup = e.dataTransfer.getData('fromGroup');
        if (draggedToolId && draggedToolId !== toolId) {
            const group = toolBtn.closest('.button-group');
            if (!group)
                return;
            // If dragging from another button in group, find and remove it
            if (fromGroup) {
                const existingBtn = Array.from(group.querySelectorAll('.config-tool-item')).find(btn => btn.dataset.toolId === draggedToolId);
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
function addButtonGroup(container, type) {
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
function setupGroupDropZone(group) {
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
        if (!e.dataTransfer)
            return;
        const toolId = e.dataTransfer.getData('toolId');
        const toolIcon = e.dataTransfer.getData('toolIcon');
        const toolViewBox = e.dataTransfer.getData('toolViewBox');
        const toolLabel = e.dataTransfer.getData('toolLabel');
        if (toolId && toolIcon && toolViewBox) {
            const removeBtn = group.querySelector('.group-remove-btn');
            const toolBtn = createConfigToolButton(toolId, toolIcon, toolViewBox, toolLabel);
            if (removeBtn) {
                group.insertBefore(toolBtn, removeBtn);
            }
            else {
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
            const buttonIds = [];
            buttons.forEach(btn => {
                const toolId = btn.dataset.toolId;
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
            const buttonIds = [];
            buttons.forEach(btn => {
                const toolId = btn.dataset.toolId;
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
    }
    catch (e) {
        console.error('Failed to save button configuration:', e);
    }
}
function saveButtonOrder() {
    try {
        localStorage.setItem('geometryButtonOrder', JSON.stringify(buttonOrder));
    }
    catch (e) {
        console.error('Failed to save button order:', e);
    }
}
function loadButtonOrder() {
    try {
        const saved = localStorage.getItem('geometryButtonOrder');
        if (saved) {
            buttonOrder = JSON.parse(saved);
        }
        else {
            // Initialize with default order
            buttonOrder = TOOL_BUTTONS.map(t => t.id);
        }
    }
    catch (e) {
        console.error('Failed to load button order:', e);
        buttonOrder = TOOL_BUTTONS.map(t => t.id);
    }
}
function rebuildPalette() {
    const paletteGrid = document.getElementById('paletteGrid');
    if (!paletteGrid)
        return;
    paletteGrid.innerHTML = '';
    buttonOrder.forEach(toolId => {
        const tool = TOOL_BUTTONS.find(t => t.id === toolId);
        if (!tool)
            return;
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
function setupConfigTouchDrag(toolBtn, toolId, toolIcon, toolViewBox, toolLabel, fromGroup) {
    let isDragging = false;
    let phantom = null;
    let currentDropZone = null;
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
        if (!configTouchDrag)
            return;
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
            const svgClone = toolBtn.querySelector('svg')?.cloneNode(true);
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
                const dropZone = target.closest('#multiGroups, #secondGroups');
                // Clear previous highlights
                if (currentDropZone && currentDropZone !== group && currentDropZone !== dropZone) {
                    currentDropZone.style.background = '';
                    currentDropZone.style.borderColor = '';
                }
                if (group) {
                    if (currentDropZone !== group) {
                        group.style.background = 'rgba(59, 130, 246, 0.1)';
                    }
                    currentDropZone = group;
                }
                else if (dropZone) {
                    if (currentDropZone !== dropZone) {
                        dropZone.style.background = 'rgba(59, 130, 246, 0.05)';
                        dropZone.style.borderColor = '#3b82f6';
                    }
                    currentDropZone = dropZone;
                }
                else {
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
            const targetToolId = paletteBtn.dataset.toolId;
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
            const targetBtn = target.closest('.config-tool-item');
            if (targetBtn && targetBtn !== toolBtn) {
                // Reordering within group - check if same group
                const toolBtnGroup = toolBtn.closest('.button-group');
                if (toolBtnGroup === group) {
                    // Same group - just reorder (move, don't clone)
                    group.insertBefore(toolBtn, targetBtn);
                }
                else {
                    // Different group - remove from old, add to new
                    toolBtn.remove();
                    group.insertBefore(createConfigToolButton(configTouchDrag.toolId, configTouchDrag.toolIcon, configTouchDrag.toolViewBox, configTouchDrag.toolLabel), targetBtn);
                }
                saveButtonConfig();
            }
            else if (!targetBtn || targetBtn === toolBtn) {
                // Dropped on empty space in group but not on self
                if (targetBtn !== toolBtn) {
                    const toolBtnGroup = toolBtn.closest('.button-group');
                    if (fromGroup) {
                        const existingBtn = Array.from(group.querySelectorAll('.config-tool-item')).find(btn => btn.dataset.toolId === configTouchDrag.toolId);
                        if (existingBtn && existingBtn !== toolBtn) {
                            existingBtn.remove();
                        }
                    }
                    if (toolBtnGroup === group && fromGroup) {
                        // Same group, just dropped on empty space - do nothing
                    }
                    else {
                        // Different group or from palette
                        const removeBtn = group.querySelector('.group-remove-btn');
                        const newBtn = createConfigToolButton(configTouchDrag.toolId, configTouchDrag.toolIcon, configTouchDrag.toolViewBox, configTouchDrag.toolLabel);
                        if (removeBtn) {
                            group.insertBefore(newBtn, removeBtn);
                        }
                        else {
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
            const newGroup = addButtonGroup(dropZone, groupType);
            if (newGroup) {
                const removeBtn = newGroup.querySelector('.group-remove-btn');
                const newBtn = createConfigToolButton(configTouchDrag.toolId, configTouchDrag.toolIcon, configTouchDrag.toolViewBox, configTouchDrag.toolLabel);
                if (removeBtn) {
                    newGroup.insertBefore(newBtn, removeBtn);
                }
                else {
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
    }
    catch (e) {
        console.error('Failed to load button configuration:', e);
    }
}
async function exportButtonConfiguration() {
    const config = {
        version: 1,
        buttonOrder: buttonOrder,
        multiButtons: buttonConfig.multiButtons,
        secondRow: buttonConfig.secondRow
    };
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    // Try to use File System Access API with default folder
    if ('showSaveFilePicker' in window && defaultFolderHandle) {
        try {
            const fileName = `geometry-config-${new Date().toISOString().slice(0, 10)}.json`;
            const fileHandle = await defaultFolderHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        }
        catch (err) {
            console.warn('Failed to save config to default folder:', err);
        }
    }
    // Fallback to traditional download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geometry-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
function importButtonConfiguration(jsonString) {
    try {
        const config = JSON.parse(jsonString);
        // Validate and apply configuration with backward compatibility
        if (config.buttonOrder && Array.isArray(config.buttonOrder)) {
            // Validate that all button IDs exist
            const validIds = config.buttonOrder.filter((id) => TOOL_BUTTONS.some(t => t.id === id));
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
        // Save to localStorage
        saveButtonConfig();
        // Reload UI
        applyButtonConfiguration();
        return true;
    }
    catch (e) {
        console.error('Failed to import configuration:', e);
        return false;
    }
}
function initRuntime() {
    canvas = document.getElementById('canvas');
    ctx = canvas?.getContext('2d') ?? null;
    modeAddBtn = document.getElementById('modeAdd');
    modeLabelBtn = document.getElementById('modeLabel');
    modeMoveBtn = document.getElementById('modeMove');
    modeMultiselectBtn = document.getElementById('modeMultiselect');
    modeSegmentBtn = document.getElementById('modeSegment');
    modeParallelBtn = document.getElementById('modeParallel');
    modePerpBtn = document.getElementById('modePerpendicular');
    modeCircleThreeBtn = document.getElementById('modeCircleThree');
    modeTriangleBtn = document.getElementById('modeTriangleUp');
    modeSquareBtn = document.getElementById('modeSquare');
    modePolygonBtn = document.getElementById('modePolygon');
    modeHandwritingBtn = document.getElementById('modeHandwriting');
    modeAngleBtn = document.getElementById('modeAngle');
    modeBisectorBtn = document.getElementById('modeBisector');
    modeMidpointBtn = document.getElementById('modeMidpoint');
    modeSymmetricBtn = document.getElementById('modeSymmetric');
    modeParallelLineBtn = document.getElementById('modeParallelLine');
    modeNgonBtn = document.getElementById('modeNgon');
    debugToggleBtn = document.getElementById('debugToggle');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    debugPanel = document.getElementById('debugPanel');
    debugPanelHeader = document.getElementById('debugPanelHandle');
    debugCloseBtn = document.getElementById('debugCloseBtn');
    debugContent = document.getElementById('debugContent');
    viewModeToggleBtn = document.getElementById('viewModeToggle');
    rayModeToggleBtn = document.getElementById('rayModeToggle');
    raySegmentBtn = document.getElementById('raySegmentOption');
    rayRightBtn = document.getElementById('rayRightOption');
    rayLeftBtn = document.getElementById('rayLeftOption');
    styleEdgesRow = document.getElementById('styleEdgesRow');
    viewModeMenuContainer = document.getElementById('viewModeMenuContainer');
    rayModeMenuContainer = document.getElementById('rayModeMenuContainer');
    hideBtn = document.getElementById('hideButton');
    deleteBtn = document.getElementById('deletePoint');
    copyStyleBtn = document.getElementById('copyStyleBtn');
    multiMoveBtn = document.getElementById('multiMoveBtn');
    multiCloneBtn = document.getElementById('multiCloneBtn');
    zoomMenuBtn = document.getElementById('zoomMenu');
    zoomMenuContainer = zoomMenuBtn?.parentElement ?? null;
    zoomMenuDropdown = zoomMenuContainer?.querySelector('.dropdown-menu');
    showHiddenBtn = document.getElementById('showHiddenBtn');
    copyImageBtn = document.getElementById('copyImageBtn');
    saveImageBtn = document.getElementById('saveImageBtn');
    exportJsonBtn = document.getElementById('exportJsonBtn');
    importJsonBtn = document.getElementById('importJsonBtn');
    importJsonInput = document.getElementById('importJsonInput');
    selectDefaultFolderBtn = document.getElementById('selectDefaultFolderBtn');
    clearDefaultFolderBtn = document.getElementById('clearDefaultFolderBtn');
    defaultFolderPath = document.getElementById('defaultFolderPath');
    clearAllBtn = document.getElementById('clearAll');
    themeDarkBtn = document.getElementById('themeDark');
    undoBtn = document.getElementById('undo');
    redoBtn = document.getElementById('redo');
    styleMenuContainer = document.getElementById('styleMenuContainer');
    styleMenuBtn = document.getElementById('styleMenu');
    styleMenuDropdown = styleMenuContainer?.querySelector('.dropdown-menu');
    styleColorRow = document.getElementById('styleColorRow');
    styleWidthRow = document.getElementById('styleWidthRow');
    styleTypeRow = document.getElementById('styleTypeRow');
    styleTypeInline = document.getElementById('styleTypeInline');
    styleRayGroup = document.getElementById('styleRayGroup');
    styleTickGroup = document.getElementById('styleTickGroup');
    styleTickButton = document.getElementById('styleTickToggle');
    styleTypeGap = document.getElementById('styleTypeGap');
    styleArcRow = document.getElementById('styleArcRow');
    styleHideRow = document.getElementById('styleHideRow');
    labelTextRow = document.getElementById('labelTextRow');
    labelFontRow = document.getElementById('labelFontRow');
    labelGreekRow = document.getElementById('labelGreekRow');
    labelGreekToggleBtn = document.getElementById('labelGreekToggle');
    labelGreekShiftBtn = document.getElementById('labelGreekShift');
    styleColorInput = document.getElementById('styleColor');
    styleWidthInput = document.getElementById('styleWidth');
    lineWidthDecreaseBtn = document.getElementById('lineWidthDecrease');
    lineWidthIncreaseBtn = document.getElementById('lineWidthIncrease');
    lineWidthValueDisplay = document.getElementById('lineWidthValue');
    styleTypeSelect = document.getElementById('styleType');
    labelTextInput = document.getElementById('labelText');
    labelFontDecreaseBtn = document.getElementById('labelFontDecrease');
    labelFontIncreaseBtn = document.getElementById('labelFontIncrease');
    labelFontSizeDisplay = document.getElementById('labelFontSizeValue');
    arcCountButtons = Array.from(document.querySelectorAll('.arc-count-btn'));
    rightAngleBtn = document.getElementById('rightAngleBtn');
    angleRadiusDecreaseBtn = document.getElementById('angleRadiusDecreaseBtn');
    angleRadiusIncreaseBtn = document.getElementById('angleRadiusIncreaseBtn');
    colorSwatchButtons = Array.from(document.querySelectorAll('.color-btn:not(.custom-color-btn)'));
    customColorBtn = document.getElementById('customColorBtn');
    styleTypeButtons = Array.from(document.querySelectorAll('.type-btn'));
    labelGreekButtons = Array.from(document.querySelectorAll('.label-greek-btn'));
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
    const handleDebugPointerDown = (ev) => {
        if (!debugPanel || !debugPanelHeader)
            return;
        const target = ev.target;
        if (target && target.closest('#debugCloseBtn'))
            return;
        debugPanelHeader.setPointerCapture(ev.pointerId);
        const rect = debugPanel.getBoundingClientRect();
        if (!debugPanelPos) {
            debugPanelPos = { x: rect.left, y: rect.top };
        }
        debugDragState = {
            pointerId: ev.pointerId,
            start: { x: ev.clientX, y: ev.clientY },
            panelStart: { x: debugPanelPos.x, y: debugPanelPos.y }
        };
        debugPanel.classList.add('debug-panel--dragging');
        ev.preventDefault();
    };
    debugPanelHeader?.addEventListener('pointerdown', handleDebugPointerDown);
    debugPanelHeader?.addEventListener('pointermove', (ev) => {
        if (!debugDragState || debugDragState.pointerId !== ev.pointerId || !debugPanel)
            return;
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
    const releaseDebugPointer = (ev) => {
        if (!debugDragState || debugDragState.pointerId !== ev.pointerId)
            return;
        endDebugPanelDrag(ev.pointerId);
    };
    debugPanelHeader?.addEventListener('pointerup', releaseDebugPointer);
    debugPanelHeader?.addEventListener('pointercancel', releaseDebugPointer);
    if (!canvas || !ctx)
        return;
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('resize', () => {
        if (debugVisible)
            ensureDebugPanelPosition();
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
            const touched = new Set();
            vectors.forEach(({ idx, vx, vy }) => {
                const p = model.points[idx];
                if (!p)
                    return;
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
        }
        else if (draggingLabel && mode === 'move') {
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
                    if (lab)
                        model.labels[draggingLabel.id] = { ...lab, pos: { x: draggingLabel.initialOffset.x + dx, y: draggingLabel.initialOffset.y + dy } };
                    break;
                }
            }
            movedDuringDrag = true;
            draw();
        }
        else if (draggingMultiSelection && mode === 'multiselect') {
            const dx = x - dragStart.x;
            const dy = y - dragStart.y;
            const movedPointIndices = new Set();
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
        }
        else if (draggingSelection && mode === 'move') {
            const dx = x - dragStart.x;
            const dy = y - dragStart.y;
            const movedPoints = new Set();
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
            if (circleDragContext &&
                selectedCircleIndex !== null &&
                circleDragContext.circleIdx === selectedCircleIndex &&
                selectedPointIndex === null &&
                selectedSegments.size === 0) {
                circleDragContext.originals.forEach((orig, idx) => {
                    const pt = model.points[idx];
                    if (!pt)
                        return;
                    model.points[idx] = { ...pt, x: orig.x + dx, y: orig.y + dy };
                    movedPoints.add(idx);
                });
                if (movedPoints.size > 0) {
                    movedPoints.forEach((idx) => {
                        updateMidpointsForPoint(idx);
                        updateCirclesForPoint(idx);
                    });
                    updateIntersectionsForCircle(circleDragContext.circleIdx);
                    const referencing = new Set(movedPoints);
                    referencing.forEach((idx) => {
                        circlesReferencingPoint(idx).forEach((ci) => {
                            if (ci !== circleDragContext.circleIdx)
                                updateIntersectionsForCircle(ci);
                        });
                    });
                    movedDuringDrag = true;
                    draw();
                }
                return;
            }
            if (selectedPointIndex !== null) {
                const p = model.points[selectedPointIndex];
                if (!isPointDraggable(p))
                    return;
                const isOnObject = p?.construction_kind === 'on_object';
                const parentLineObj = primaryLineParent(p);
                const parentLineIdx = parentLineObj ? lineIndexById(parentLineObj.id) : null;
                const radiusCircleIdx = model.circles.findIndex((circle) => circle.radius_point === selectedPointIndex);
                if (radiusCircleIdx !== -1) {
                    const circle = model.circles[radiusCircleIdx];
                    const center = model.points[circle.center];
                    if (!center)
                        return;
                    const rawTarget = { x: p.x + dx, y: p.y + dy };
                    let vx = rawTarget.x - center.x;
                    let vy = rawTarget.y - center.y;
                    let len = Math.hypot(vx, vy);
                    if (len <= 1e-6) {
                        vx = p.x - center.x;
                        vy = p.y - center.y;
                        len = Math.hypot(vx, vy);
                    }
                    if (len <= 1e-6)
                        return;
                    const radius = len;
                    const norm = { x: vx / len, y: vy / len };
                    const newRadiusPos = { x: center.x + norm.x * radius, y: center.y + norm.y * radius };
                    model.points[selectedPointIndex] = { ...p, ...newRadiusPos };
                    movedPoints.add(selectedPointIndex);
                    const perimeter = circlePerimeterPoints(circle).filter((pi) => pi !== selectedPointIndex);
                    perimeter.forEach((pi) => {
                        const pt = model.points[pi];
                        if (!pt)
                            return;
                        const ang = Math.atan2(pt.y - center.y, pt.x - center.x);
                        if (!Number.isFinite(ang))
                            return;
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
                    const referencingTargets = new Set([selectedPointIndex, ...perimeter]);
                    referencingTargets.forEach((pi) => {
                        circlesReferencingPoint(pi).forEach((ci) => {
                            if (ci !== radiusCircleIdx)
                                updateIntersectionsForCircle(ci);
                        });
                    });
                    // Also apply line fractions if the radius point is an endpoint of a line
                    const linesWithRadiusPoint = findLinesContainingPoint(selectedPointIndex);
                    linesWithRadiusPoint.forEach((lineIdx) => {
                        const line = model.lines[lineIdx];
                        if (!line)
                            return;
                        const isEndpoint = selectedPointIndex === line.points[0] ||
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
                        if (!draggingCircleCenterAngles)
                            draggingCircleCenterAngles = new Map();
                        const snapshots = [];
                        centerRadiusCircles.forEach((ci) => {
                            const circle = model.circles[ci];
                            if (!circle)
                                return;
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
                                    const pt = model.points[fallbackIdx];
                                    radius = Math.hypot(pt.x - prevCenter.x, pt.y - prevCenter.y);
                                }
                            }
                            if (!(radius > 0))
                                radius = circleRadius(circle);
                            if (!(radius > 0))
                                return;
                            const existing = draggingCircleCenterAngles.get(ci);
                            const angleMap = existing ?? new Map();
                            if (!existing)
                                draggingCircleCenterAngles.set(ci, angleMap);
                            circle.points.forEach((pid) => {
                                if (angleMap.has(pid))
                                    return;
                                const pt = model.points[pid];
                                if (!pt)
                                    return;
                                angleMap.set(pid, Math.atan2(pt.y - prevCenter.y, pt.x - prevCenter.x));
                            });
                            if (radiusPoint) {
                                angleMap.set(circle.radius_point, Math.atan2(radiusPoint.y - prevCenter.y, radiusPoint.x - prevCenter.x));
                            }
                            snapshots.push({ circleIdx: ci, angleMap, fallbackRadius: radius });
                        });
                        model.points[selectedPointIndex] = { ...p, ...target };
                        movedPoints.add(selectedPointIndex);
                        snapshots.forEach(({ circleIdx, angleMap, fallbackRadius }) => {
                            const circle = model.circles[circleIdx];
                            if (!circle)
                                return;
                            const radiusPoint = model.points[circle.radius_point];
                            let radiusLength = circleRadius(circle);
                            if (!(radiusLength > 0))
                                radiusLength = fallbackRadius;
                            if (!(radiusLength > 0))
                                return;
                            if (radiusPoint) {
                                angleMap.set(circle.radius_point, Math.atan2(radiusPoint.y - target.y, radiusPoint.x - target.x));
                            }
                            angleMap.forEach((angle, pid) => {
                                if (pid === selectedPointIndex)
                                    return;
                                if (pid === circle.radius_point)
                                    return;
                                const pt = model.points[pid];
                                if (!pt)
                                    return;
                                const pos = {
                                    x: target.x + Math.cos(angle) * radiusLength,
                                    y: target.y + Math.sin(angle) * radiusLength
                                };
                                model.points[pid] = { ...pt, ...pos };
                                movedPoints.add(pid);
                            });
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
                        if (!c)
                            return;
                        const center = model.points[c.center];
                        if (!center)
                            return;
                        model.points[c.center] = { ...center, x: center.x + dx, y: center.y + dy };
                        movedPoints.add(c.center);
                        circlePerimeterPoints(c).forEach((pi) => {
                            const pt = model.points[pi];
                            if (!pt)
                                return;
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
                const mainLineIdx = selectedLineIndex !== null && linesWithPoint.includes(selectedLineIndex)
                    ? selectedLineIndex
                    : linesWithPoint[0];
                if (mainLineIdx !== undefined) {
                    const mainLine = model.lines[mainLineIdx];
                    const isEndpoint = selectedPointIndex === mainLine.points[0] ||
                        selectedPointIndex === mainLine.points[mainLine.points.length - 1];
                    if (isEndpoint) {
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
                                                if (!p)
                                                    return 0;
                                                const t = ((p.x - origin.x) * dir.x + (p.y - origin.y) * dir.y) / len;
                                                return t;
                                            });
                                            lineDragContext = { lineIdx: mainLineIdx, fractions };
                                        }
                                    }
                                }
                            }
                        }
                        const anchorIdx = selectedPointIndex === mainLine.points[0]
                            ? mainLine.points[mainLine.points.length - 1]
                            : mainLine.points[0];
                        const anchor = model.points[anchorIdx];
                        const rawTarget = { x: p.x + dx, y: p.y + dy };
                        let target = rawTarget;
                        if (parentLineIdx !== null) {
                            target = constrainToLineIdx(parentLineIdx ?? mainLineIdx, target);
                        }
                        target = constrainToCircles(selectedPointIndex, target);
                        model.points[selectedPointIndex] = { ...p, ...target };
                        movedPoints.add(selectedPointIndex);
                        if (anchor) {
                            const vx = rawTarget.x - anchor.x;
                            const vy = rawTarget.y - anchor.y;
                            const len = Math.hypot(vx, vy);
                            if (len > 0) {
                                const threshold = Math.max(1e-4, len * LINE_SNAP_SIN_ANGLE);
                                let axis = null;
                                if (Math.abs(vy) <= threshold) {
                                    axis = 'y';
                                }
                                else if (Math.abs(vx) <= threshold) {
                                    axis = 'x';
                                }
                                if (axis) {
                                    const closeness = axis === 'y'
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
                                            if (!pt)
                                                return false;
                                            if (!isPointDraggable(pt))
                                                return false;
                                            if (circlesWithCenter(idx).length > 0)
                                                return false;
                                            return true;
                                        });
                                        movableOnLine.forEach((idx) => {
                                            const pt = model.points[idx];
                                            if (!pt)
                                                return;
                                            if (axis === 'y') {
                                                const blended = pt.y * (1 - weight) + axisValue * weight;
                                                if (blended !== pt.y) {
                                                    model.points[idx] = { ...pt, y: blended };
                                                    movedPoints.add(idx);
                                                }
                                            }
                                            else {
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
                    }
                    else if (mainLine.points.length >= 2) {
                        const origin = model.points[mainLine.points[0]];
                        const end = model.points[mainLine.points[mainLine.points.length - 1]];
                        if (origin && end) {
                            const dir = normalize({ x: end.x - origin.x, y: end.y - origin.y });
                            const len = Math.hypot(end.x - origin.x, end.y - origin.y) || 1;
                            const target = { x: p.x + dx, y: p.y + dy };
                            let t = ((target.x - origin.x) * dir.x + (target.y - origin.y) * dir.y) / len;
                            const leftVisible = mainLine.leftRay && !mainLine.leftRay.hidden;
                            const rightVisible = mainLine.rightRay && !mainLine.rightRay.hidden;
                            if (!leftVisible)
                                t = Math.max(0, t);
                            if (!rightVisible)
                                t = Math.min(1, t);
                            const newPos = { x: origin.x + dir.x * t * len, y: origin.y + dir.y * t * len };
                            const deltaMove = { x: newPos.x - p.x, y: newPos.y - p.y };
                            if (deltaMove.x !== 0 || deltaMove.y !== 0) {
                                const shiftTargets = new Set();
                                linesWithPoint.forEach((li) => {
                                    if (li === mainLineIdx)
                                        return;
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
                            applyLineFractions(mainLineIdx);
                            updateIntersectionsForLine(mainLineIdx);
                            updateParallelLinesForLine(mainLineIdx);
                            updatePerpendicularLinesForLine(mainLineIdx);
                        }
                    }
                    if (linesWithPoint.length > 1) {
                        const extraLines = new Set();
                        linesWithPoint.forEach((li) => {
                            if (li !== mainLineIdx && li !== undefined && li !== null)
                                extraLines.add(li);
                        });
                        extraLines.forEach((li) => {
                            updateIntersectionsForLine(li);
                            updateParallelLinesForLine(li);
                            updatePerpendicularLinesForLine(li);
                        });
                    }
                }
                else {
                    let target = { x: p.x + dx, y: p.y + dy };
                    target = constrainToLineParent(selectedPointIndex, target);
                    target = constrainToCircles(selectedPointIndex, target);
                    model.points[selectedPointIndex] = { ...p, ...target };
                    movedPoints.add(selectedPointIndex);
                }
            }
            else if (selectedPolygonIndex !== null && selectedSegments.size === 0) {
                const poly = model.polygons[selectedPolygonIndex];
                if (poly) {
                    const pointsInPoly = new Set();
                    poly.lines.forEach((li) => {
                        const line = model.lines[li];
                        line?.points.forEach((pi) => pointsInPoly.add(pi));
                    });
                    pointsInPoly.forEach((idx) => {
                        const pt = model.points[idx];
                        if (!pt)
                            return;
                        if (!isPointDraggable(pt))
                            return;
                        if (circlesWithCenter(idx).length > 0)
                            return;
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
                }
            }
            else if (selectedLineIndex !== null) {
                const line = model.lines[selectedLineIndex];
                if (line) {
                    const movableIndices = line.points.filter((idx) => {
                        const pt = model.points[idx];
                        if (!pt)
                            return false;
                        if (!isPointDraggable(pt))
                            return false;
                        if (circlesWithCenter(idx).length > 0)
                            return false;
                        return true;
                    });
                    const proposals = new Map();
                    let snapIndicator = null;
                    line.points.forEach((idx) => {
                        const pt = model.points[idx];
                        if (!pt)
                            return;
                        if (!isPointDraggable(pt))
                            return;
                        if (circlesWithCenter(idx).length > 0)
                            return;
                        const target = { x: pt.x + dx, y: pt.y + dy };
                        const constrainedOnLine = constrainToLineParent(idx, target);
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
                                        const strength = Math.min(1, Math.max(0, (closeness - LINE_SNAP_INDICATOR_THRESHOLD) / (1 - LINE_SNAP_INDICATOR_THRESHOLD)));
                                        snapIndicator = { axis: 'horizontal', strength };
                                    }
                                    const weight = axisSnapWeight(closeness);
                                    if (weight > 0) {
                                        movableIndices.forEach((idx) => {
                                            const entry = proposals.get(idx);
                                            if (!entry)
                                                return;
                                            entry.pos = {
                                                ...entry.pos,
                                                y: entry.pos.y * (1 - weight) + axisY * weight,
                                            };
                                        });
                                    }
                                }
                            }
                            else if (Math.abs(vx) <= threshold) {
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
                                        const strength = Math.min(1, Math.max(0, (closeness - LINE_SNAP_INDICATOR_THRESHOLD) / (1 - LINE_SNAP_INDICATOR_THRESHOLD)));
                                        snapIndicator = { axis: 'vertical', strength };
                                    }
                                    const weight = axisSnapWeight(closeness);
                                    if (weight > 0) {
                                        movableIndices.forEach((idx) => {
                                            const entry = proposals.get(idx);
                                            if (!entry)
                                                return;
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
                    proposals.forEach((entry, idx) => {
                        model.points[idx] = { ...entry.original, ...entry.pos };
                        movedPoints.add(idx);
                    });
                    updateIntersectionsForLine(selectedLineIndex);
                    updateParallelLinesForLine(selectedLineIndex);
                    updatePerpendicularLinesForLine(selectedLineIndex);
                }
            }
            dragStart = { x, y };
            movedDuringDrag = true;
            movedPoints.forEach((pi) => {
                updateMidpointsForPoint(pi);
                updateCirclesForPoint(pi);
            });
            draw();
        }
        else if (isPanning && mode === 'move' && pendingPanCandidate) {
            const dx = ev.clientX - panStart.x;
            const dy = ev.clientY - panStart.y;
            panOffset = { x: panStartOffset.x + dx, y: panStartOffset.y + dy };
            movedDuringPan = true;
            draw();
        }
    });
    const handlePointerRelease = (ev) => {
        if (ev.pointerType === 'touch') {
            removeTouchPoint(ev.pointerId);
            if (activeTouches.size >= 2 && !pinchState) {
                startPinchFromTouches();
            }
            try {
                canvas.releasePointerCapture(ev.pointerId);
            }
            catch (_) {
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
        const input = window.prompt('Liczba boków (3-20):', String(ngonSides));
        if (input !== null) {
            const n = Number(input);
            if (Number.isFinite(n) && n >= 3 && n <= 20) {
                ngonSides = Math.round(n);
            }
        }
        handleToolClick('ngon');
    });
    document.getElementById('modeCircle')?.addEventListener('click', () => handleToolClick('circle'));
    modeMoveBtn?.addEventListener('click', () => {
        stickyTool = null;
        if (mode !== 'move')
            setMode('move');
    });
    modeMultiselectBtn?.addEventListener('click', () => handleToolClick('multiselect'));
    lineWidthDecreaseBtn?.addEventListener('click', () => adjustLineWidth(-1));
    lineWidthIncreaseBtn?.addEventListener('click', () => adjustLineWidth(1));
    colorSwatchButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const c = btn.dataset.color;
            if (!c || !styleColorInput)
                return;
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
        if (!rightAngleBtn)
            return;
        const active = rightAngleBtn.classList.toggle('active');
        if (active)
            arcCountButtons.forEach((b) => b.classList.remove('active'));
        if (selectedAngleIndex !== null) {
            const ang = model.angles[selectedAngleIndex];
            const arcCount = active ? 1 : ang.style.arcCount ?? 1;
            model.angles[selectedAngleIndex] = { ...ang, style: { ...ang.style, right: active, arcCount } };
            draw();
            pushHistory();
        }
    });
    angleRadiusDecreaseBtn?.addEventListener('click', () => adjustSelectedAngleRadius(-1));
    angleRadiusIncreaseBtn?.addEventListener('click', () => adjustSelectedAngleRadius(1));
    styleTypeButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const t = btn.dataset.type;
            if (styleTypeSelect && t)
                styleTypeSelect.value = t;
            applyStyleFromInputs();
            updateStyleMenuValues();
        });
    });
    viewModeToggleBtn?.addEventListener('click', toggleViewMenu);
    document.getElementById('viewEdgesOption')?.addEventListener('click', () => setViewMode('edges'));
    document.getElementById('viewVerticesOption')?.addEventListener('click', () => setViewMode('vertices'));
    rayModeToggleBtn?.addEventListener('click', toggleRayMenu);
    document.getElementById('rayRightOption')?.addEventListener('click', () => setRayMode('right'));
    document.getElementById('rayLeftOption')?.addEventListener('click', () => setRayMode('left'));
    document.getElementById('raySegmentOption')?.addEventListener('click', () => setRayMode('segment'));
    themeDarkBtn?.addEventListener('click', () => {
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
    });
    // Settings modal handlers
    settingsBtn?.addEventListener('click', () => {
        if (settingsModal) {
            settingsModal.style.display = 'flex';
            initializeButtonConfig();
        }
    });
    settingsCloseBtn?.addEventListener('click', () => {
        if (settingsModal) {
            applyButtonConfiguration();
            settingsModal.style.display = 'none';
        }
    });
    // Export/Import configuration handlers
    const exportConfigBtn = document.getElementById('exportConfigBtn');
    const importConfigBtn = document.getElementById('importConfigBtn');
    const importConfigInput = document.getElementById('importConfigInput');
    exportConfigBtn?.addEventListener('click', () => {
        exportButtonConfiguration();
    });
    importConfigBtn?.addEventListener('click', () => {
        importConfigInput?.click();
    });
    importConfigInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result;
            if (content) {
                const success = importButtonConfiguration(content);
                if (success) {
                    alert('Konfiguracja została zaimportowana pomyślnie!');
                }
                else {
                    alert('Błąd podczas importowania konfiguracji. Sprawdź czy plik jest poprawny.');
                }
            }
        };
        reader.readAsText(file);
        // Reset input so the same file can be imported again
        e.target.value = '';
    });
    // Tab switching in settings modal
    const tabButtons = document.querySelectorAll('.modal-tabs .tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            if (!tabName)
                return;
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
            const scrollingUp = e.touches[0].clientY > e.target.lastTouchY;
            // Prevent pull-to-refresh only when at top and scrolling up
            if (atTop && scrollingUp) {
                e.preventDefault();
            }
        }
        else if (modalContent && e.target instanceof Node && modalContent.contains(e.target)) {
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
            const dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });
            defaultFolderHandle = dirHandle;
            // Save to localStorage
            // Note: We can't directly store the handle, but we can request permission again on load
            localStorage.setItem('defaultFolderName', dirHandle.name);
            updateDefaultFolderDisplay();
        }
        catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Failed to select folder:', err);
            }
        }
    });
    clearDefaultFolderBtn?.addEventListener('click', () => {
        defaultFolderHandle = null;
        localStorage.removeItem('defaultFolderName');
        updateDefaultFolderDisplay();
    });
    function updateDefaultFolderDisplay() {
        if (defaultFolderPath && clearDefaultFolderBtn) {
            if (defaultFolderHandle) {
                defaultFolderPath.textContent = defaultFolderHandle.name;
                clearDefaultFolderBtn.style.display = 'block';
            }
            else {
                defaultFolderPath.textContent = 'Nie wybrano';
                clearDefaultFolderBtn.style.display = 'none';
            }
        }
    }
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
                    if (model.lines[li])
                        model.lines[li].hidden = !model.lines[li].hidden;
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
        }
        else if (selectedLabel) {
            return;
        }
        else if (selectedPolygonIndex !== null) {
            const poly = model.polygons[selectedPolygonIndex];
            poly?.lines.forEach((li) => {
                if (model.lines[li])
                    model.lines[li].hidden = !model.lines[li].hidden;
            });
        }
        else if (selectedLineIndex !== null) {
            model.lines[selectedLineIndex].hidden = !model.lines[selectedLineIndex].hidden;
        }
        else if (selectedCircleIndex !== null) {
            model.circles[selectedCircleIndex].hidden = !model.circles[selectedCircleIndex].hidden;
        }
        else if (selectedAngleIndex !== null) {
            const angle = model.angles[selectedAngleIndex];
            if (angle) {
                model.angles[selectedAngleIndex] = { ...angle, hidden: !angle.hidden };
            }
        }
        else if (selectedPointIndex !== null) {
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
        }
        else {
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
        }
        else {
            multiMoveActive = false;
            multiMoveBtn?.classList.remove('active');
            multiMoveBtn?.setAttribute('aria-pressed', 'false');
        }
    });
    multiCloneBtn?.addEventListener('click', () => {
        if (!hasMultiSelection())
            return;
        // First pass: collect all objects that need to be cloned
        const linesToClone = new Set(multiSelectedLines);
        const pointsToClone = new Set(multiSelectedPoints);
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
                if (circle.radius_point !== undefined)
                    pointsToClone.add(circle.radius_point);
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
        const pointRemap = new Map();
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
        const lineRemap = new Map();
        linesToClone.forEach(idx => {
            const line = model.lines[idx];
            if (line) {
                const newPoints = line.points.map(pi => pointRemap.get(pi) ?? pi);
                const newDefiningPoints = [
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
                        parallel.throughPoint = model.points[pointRemap.get(throughPointIdx)].id;
                    }
                    if (helperPointIdx !== null && pointRemap.has(helperPointIdx)) {
                        parallel.helperPoint = model.points[pointRemap.get(helperPointIdx)].id;
                    }
                    if (refLineIdx !== null && lineRemap.has(refLineIdx)) {
                        parallel.referenceLine = model.lines[lineRemap.get(refLineIdx)].id;
                    }
                }
                if (perpendicular) {
                    const throughPointIdx = pointIndexById(perpendicular.throughPoint);
                    const helperPointIdx = pointIndexById(perpendicular.helperPoint);
                    const refLineIdx = lineIndexById(perpendicular.referenceLine);
                    if (throughPointIdx !== null && pointRemap.has(throughPointIdx)) {
                        perpendicular.throughPoint = model.points[pointRemap.get(throughPointIdx)].id;
                    }
                    if (helperPointIdx !== null && pointRemap.has(helperPointIdx)) {
                        perpendicular.helperPoint = model.points[pointRemap.get(helperPointIdx)].id;
                    }
                    if (refLineIdx !== null && lineRemap.has(refLineIdx)) {
                        perpendicular.referenceLine = model.lines[lineRemap.get(refLineIdx)].id;
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
            if (!newPoint || !oldPoint)
                return;
            // Update parent_refs to point to cloned objects
            const updatedParentRefs = oldPoint.parent_refs?.map(ref => {
                if (ref.kind === 'line') {
                    const oldLineIdx = lineIndexById(ref.id);
                    if (oldLineIdx !== null && lineRemap.has(oldLineIdx)) {
                        const newLineIdx = lineRemap.get(oldLineIdx);
                        const newLine = model.lines[newLineIdx];
                        return { kind: 'line', id: newLine.id };
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
                    ? model.points[pointRemap.get(parentAIdx)].id
                    : parentA;
                const newParentB = parentBIdx !== null && pointRemap.has(parentBIdx)
                    ? model.points[pointRemap.get(parentBIdx)].id
                    : parentB;
                let parentLineId = midpoint.parentLineId;
                if (parentLineId) {
                    const lineIdx = lineIndexById(parentLineId);
                    if (lineIdx !== null && lineRemap.has(lineIdx)) {
                        parentLineId = model.lines[lineRemap.get(lineIdx)].id;
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
                    ? model.points[pointRemap.get(sourceIdx)].id
                    : symmetric.source;
                let mirror = symmetric.mirror;
                if (mirror.kind === 'point') {
                    const mirrorIdx = pointIndexById(mirror.id);
                    if (mirrorIdx !== null && pointRemap.has(mirrorIdx)) {
                        mirror = { kind: 'point', id: model.points[pointRemap.get(mirrorIdx)].id };
                    }
                }
                else if (mirror.kind === 'line') {
                    const mirrorIdx = lineIndexById(mirror.id);
                    if (mirrorIdx !== null && lineRemap.has(mirrorIdx)) {
                        mirror = { kind: 'line', id: model.lines[lineRemap.get(mirrorIdx)].id };
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
        const circleRemap = new Map();
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
        const angleRemap = new Map();
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
        const polygonRemap = new Map();
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
        const newPointSelection = new Set();
        pointRemap.forEach((newIdx, _) => newPointSelection.add(newIdx));
        const newLineSelection = new Set();
        lineRemap.forEach((newIdx, _) => newLineSelection.add(newIdx));
        // Offset cloned free points slightly so they don't overlap with originals
        const CLONE_OFFSET = 20;
        newPointSelection.forEach(idx => {
            const pt = model.points[idx];
            if (pt && pt.construction_kind === 'free') {
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
                if (line?.label)
                    reclaimLabel(line.label);
                model.lines.splice(idx, 1);
                changed = true;
            });
            if (linesToRemove.length > 0) {
                const remap = new Map();
                model.lines.forEach((_, idx) => remap.set(idx, idx));
                remapPolygons(remap);
            }
            const circlesToRemove = Array.from(multiSelectedCircles);
            circlesToRemove.sort((a, b) => b - a);
            const allCirclePointsToRemove = new Set();
            circlesToRemove.forEach(idx => {
                const circle = model.circles[idx];
                if (circle) {
                    if (circle.label)
                        reclaimLabel(circle.label);
                    const circleId = circle.id;
                    // Check center point - only remove if not used as defining point for lines
                    const centerUsedInLines = model.lines.some(line => line.defining_points.includes(circle.center));
                    if (!centerUsedInLines) {
                        allCirclePointsToRemove.add(circle.center);
                    }
                    // Check other points on circle
                    const constrainedPoints = [circle.radius_point, ...circle.points];
                    constrainedPoints.forEach((pid) => {
                        if (circleHasDefiningPoint(circle, pid))
                            return;
                        const point = model.points[pid];
                        if (!point)
                            return;
                        const hasCircleParent = point.parent_refs.some((pr) => pr.kind === 'circle' && pr.id === circleId);
                        // Only remove if not used as defining point for lines
                        const usedInLines = model.lines.some(line => line.defining_points.includes(pid));
                        if (!usedInLines && (!isCircleThroughPoints(circle) || hasCircleParent)) {
                            allCirclePointsToRemove.add(pid);
                        }
                    });
                    // Remove circle from parent_refs of points that are not being deleted
                    model.points = model.points.map((pt, ptIdx) => {
                        if (allCirclePointsToRemove.has(ptIdx))
                            return pt;
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
                if (angle?.label)
                    reclaimLabel(angle.label);
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
                        if (line?.label)
                            reclaimLabel(line.label);
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
        }
        else if (selectedLabel) {
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
            if (labelTextInput)
                labelTextInput.value = '';
        }
        else if (selectedPolygonIndex !== null) {
            const poly = model.polygons[selectedPolygonIndex];
            if (poly) {
                const polygonPoints = new Set(polygonVertices(selectedPolygonIndex));
                poly.lines.forEach((li) => {
                    const line = model.lines[li];
                    if (line?.label)
                        reclaimLabel(line.label);
                });
                const remap = new Map();
                const toRemove = new Set(poly.lines);
                const kept = [];
                model.lines.forEach((line, idx) => {
                    if (toRemove.has(idx)) {
                        remap.set(idx, -1);
                    }
                    else {
                        remap.set(idx, kept.length);
                        kept.push(line);
                    }
                });
                model.lines = kept;
                remapPolygons(remap);
                const orphanVertices = Array.from(polygonPoints).filter((pi) => !pointUsedAnywhere(pi));
                if (orphanVertices.length) {
                    removePointsAndRelated(orphanVertices, false);
                }
                else {
                    polygonPoints.forEach((pi) => clearPointLabelIfUnused(pi));
                }
            }
            selectedPolygonIndex = null;
            selectedLineIndex = null;
            selectedPointIndex = null;
            selectedCircleIndex = null;
            selectedArcSegments.clear();
            changed = true;
        }
        else if (selectedLineIndex !== null) {
            const line = model.lines[selectedLineIndex];
            const deletedLineId = line?.id;
            if (line?.label)
                reclaimLabel(line.label);
            if (selectionVertices) {
                const pts = Array.from(new Set(line.points));
                removePointsAndRelated(pts, true);
                if (deletedLineId) {
                    const removedParallelIds = removeParallelLinesReferencing(deletedLineId);
                    const removedPerpendicularIds = removePerpendicularLinesReferencing(deletedLineId);
                    const idsToRemove = new Set([deletedLineId, ...removedParallelIds, ...removedPerpendicularIds]);
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
            else {
                const lineIdx = selectedLineIndex;
                const remap = new Map();
                model.lines.forEach((_, idx) => {
                    if (idx === lineIdx)
                        remap.set(idx, -1);
                    else
                        remap.set(idx, idx > lineIdx ? idx - 1 : idx);
                });
                model.lines.splice(lineIdx, 1);
                remapPolygons(remap);
                // detach deleted line as parent from points that referenced it
                if (deletedLineId) {
                    const removedParallelIds = removeParallelLinesReferencing(deletedLineId);
                    const idsToRemove = new Set([deletedLineId, ...removedParallelIds]);
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
        }
        else if (selectedAngleIndex !== null) {
            const angle = model.angles[selectedAngleIndex];
            if (angle?.label)
                reclaimLabel(angle.label);
            model.angles.splice(selectedAngleIndex, 1);
            selectedAngleIndex = null;
            selectedLineIndex = null;
            selectedPointIndex = null;
            selectedCircleIndex = null;
            selectedPolygonIndex = null;
            changed = true;
        }
        else if (selectedCircleIndex !== null) {
            const circle = model.circles[selectedCircleIndex];
            if (circle) {
                if (circle.label)
                    reclaimLabel(circle.label);
                const circleId = circle.id;
                // Collect points to remove - only those that were created for this circle
                // and are not used elsewhere as defining points of other objects
                const toRemove = new Set();
                // Check center point - only remove if not used as defining point for lines
                const centerUsedInLines = model.lines.some(line => line.defining_points.includes(circle.center));
                if (!centerUsedInLines) {
                    toRemove.add(circle.center);
                }
                // Check other points on circle
                const constrainedPoints = [circle.radius_point, ...circle.points];
                constrainedPoints.forEach((pid) => {
                    if (circleHasDefiningPoint(circle, pid))
                        return;
                    const point = model.points[pid];
                    if (!point)
                        return;
                    const hasCircleParent = point.parent_refs.some((pr) => pr.kind === 'circle' && pr.id === circleId);
                    // Only remove if not used as defining point for lines
                    const usedInLines = model.lines.some(line => line.defining_points.includes(pid));
                    if (!usedInLines && (!isCircleThroughPoints(circle) || hasCircleParent)) {
                        toRemove.add(pid);
                    }
                });
                // Remove circle from parent_refs of points that are not being deleted
                model.points = model.points.map((pt, idx) => {
                    if (toRemove.has(idx))
                        return pt;
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
                if (toRemove.size > 0) {
                    removePointsAndRelated(Array.from(toRemove), true);
                }
                const idx = model.indexById.circle[circleId];
                if (idx !== undefined) {
                    model.circles.splice(idx, 1);
                }
            }
            selectedCircleIndex = null;
            selectedLineIndex = null;
            selectedPointIndex = null;
            selectedPolygonIndex = null;
            changed = true;
        }
        else if (selectedPointIndex !== null) {
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
    copyImageBtn?.addEventListener('click', async () => {
        try {
            const blob = await captureCanvasAsPng();
            const ClipboardItemCtor = window.ClipboardItem;
            if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function' || !ClipboardItemCtor) {
                throw new Error('Clipboard API niedostępne');
            }
            await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
            closeZoomMenu();
        }
        catch (err) {
            console.error('Nie udało się skopiować obrazu', err);
            window.alert('Nie udało się skopiować obrazu do schowka. Sprawdź uprawnienia przeglądarki.');
        }
    });
    saveImageBtn?.addEventListener('click', async () => {
        try {
            const blob = await captureCanvasAsPng();
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
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
        }
        catch (err) {
            console.error('Nie udało się zapisać obrazu', err);
            window.alert('Nie udało się przygotować pliku PNG.');
        }
    });
    exportJsonBtn?.addEventListener('click', async () => {
        try {
            const snapshot = serializeCurrentDocument();
            const json = JSON.stringify(snapshot, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            // Try to use File System Access API with default folder
            if ('showSaveFilePicker' in window && defaultFolderHandle) {
                try {
                    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const defaultName = `geometry-${stamp}.json`;
                    const fileHandle = await defaultFolderHandle.getFileHandle(defaultName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    closeZoomMenu();
                    return;
                }
                catch (err) {
                    // If saving to default folder fails, fall back to regular save
                    console.warn('Failed to save to default folder:', err);
                }
            }
            // Fallback to traditional download
            const url = URL.createObjectURL(blob);
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const defaultName = `geometry-${stamp}`;
            const fileName = window.prompt('Podaj nazwę pliku (bez rozszerzenia):', defaultName);
            if (!fileName) {
                URL.revokeObjectURL(url);
                closeZoomMenu();
                return;
            }
            const link = document.createElement('a');
            link.href = url;
            link.download = `${fileName}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            closeZoomMenu();
        }
        catch (err) {
            console.error('Nie udało się zapisać szkicu', err);
            window.alert('Nie udało się przygotować pliku JSON.');
        }
    });
    importJsonBtn?.addEventListener('click', () => {
        if (!importJsonInput)
            return;
        importJsonInput.value = '';
        importJsonInput.click();
    });
    importJsonInput?.addEventListener('change', async () => {
        if (!importJsonInput)
            return;
        const file = importJsonInput.files && importJsonInput.files[0];
        if (!file)
            return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            applyPersistedDocument(parsed);
            closeZoomMenu();
        }
        catch (err) {
            console.error('Nie udało się wczytać szkicu', err);
            window.alert('Nie udało się wczytać pliku JSON. Sprawdź poprawność danych.');
        }
        finally {
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
        if (!styleColorInput)
            return;
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
        if (!labelTextInput)
            return;
        if (!selectedLabel)
            return;
        const text = labelTextInput.value;
        let changed = false;
        switch (selectedLabel.kind) {
            case 'point':
                if (model.points[selectedLabel.id]?.label) {
                    model.points[selectedLabel.id].label = { ...model.points[selectedLabel.id].label, text };
                    changed = true;
                }
                break;
            case 'line':
                if (model.lines[selectedLabel.id]?.label) {
                    model.lines[selectedLabel.id].label = { ...model.lines[selectedLabel.id].label, text };
                    changed = true;
                }
                break;
            case 'angle':
                if (model.angles[selectedLabel.id]?.label) {
                    model.angles[selectedLabel.id].label = { ...model.angles[selectedLabel.id].label, text };
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
            if (!labelTextInput)
                return;
            const symbol = btn.dataset.letter ?? btn.textContent ?? '';
            if (!symbol)
                return;
            insertLabelSymbol(symbol);
        });
    });
    labelGreekToggleBtn?.addEventListener('click', () => {
        if (selectedLabel === null)
            return;
        labelGreekVisible = !labelGreekVisible;
        refreshLabelKeyboard(true);
    });
    labelGreekShiftBtn?.addEventListener('click', () => {
        if (selectedLabel === null)
            return;
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
        if (zoomMenuOpen && !zoomMenuContainer?.contains(e.target)) {
            closeZoomMenu();
        }
        if (viewModeOpen && !viewModeMenuContainer?.contains(e.target)) {
            closeViewMenu();
        }
        if (rayModeOpen && !rayModeMenuContainer?.contains(e.target)) {
            closeRayMenu();
        }
    });
    updateToolButtons();
    updateSelectionButtons();
    updateOptionButtons();
    updateColorButtons();
    pushHistory();
    // Apply button configuration after DOM is ready
    applyButtonConfiguration();
}
function tryApplyLabelToSelection() {
    if (mode !== 'label')
        return;
    const anySelection = selectedLineIndex !== null ||
        selectedPolygonIndex !== null ||
        selectedPointIndex !== null ||
        selectedAngleIndex !== null;
    if (!anySelection)
        return;
    // simulate a label application without user click by reusing current mode logic on selection
    const color = styleColorInput?.value || '#000';
    let changed = false;
    if (selectedAngleIndex !== null && !model.angles[selectedAngleIndex].label) {
        const { text, seq } = nextGreek();
        model.angles[selectedAngleIndex].label = {
            text,
            color,
            offset: defaultAngleLabelOffset(selectedAngleIndex),
            fontSize: LABEL_FONT_DEFAULT,
            seq
        };
        changed = true;
    }
    else if (selectedPolygonIndex !== null) {
        const verts = polygonVerticesOrdered(selectedPolygonIndex).filter((vi) => !model.points[vi]?.label);
        verts.forEach((vi) => {
            const { text, seq } = nextUpper();
            model.points[vi].label = {
                text,
                color,
                offset: defaultPointLabelOffset(vi),
                fontSize: LABEL_FONT_DEFAULT,
                seq
            };
        });
        if (verts.length) {
            changed = true;
        }
    }
    else if (selectedLineIndex !== null) {
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
                        fontSize: LABEL_FONT_DEFAULT,
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
                fontSize: LABEL_FONT_DEFAULT,
                seq
            };
            changed = true;
        }
    }
    else if (selectedPointIndex !== null && !model.points[selectedPointIndex].label) {
        const { text, seq } = nextUpper();
        model.points[selectedPointIndex].label = {
            text,
            color,
            offset: defaultPointLabelOffset(selectedPointIndex),
            fontSize: LABEL_FONT_DEFAULT,
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
        if (stickyTool === null)
            setMode('move');
        updateToolButtons();
        updateSelectionButtons();
    }
}
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', initRuntime);
}
// helpers
function findPoint(p) {
    const tol = currentHitRadius();
    for (let i = model.points.length - 1; i >= 0; i--) {
        const pt = model.points[i];
        if (pt.style.hidden && !showHidden)
            continue;
        const dx = pt.x - p.x;
        const dy = pt.y - p.y;
        if (Math.hypot(dx, dy) <= tol)
            return i;
    }
    return null;
}
function findPointWithRadius(p, radius) {
    for (let i = model.points.length - 1; i >= 0; i--) {
        const pt = model.points[i];
        if (pt.style.hidden && !showHidden)
            continue;
        if (Math.hypot(pt.x - p.x, pt.y - p.y) <= radius)
            return i;
    }
    return null;
}
function findLinesContainingPoint(idx) {
    const res = [];
    for (let i = 0; i < model.lines.length; i++) {
        if (model.lines[i].points.includes(idx))
            res.push(i);
    }
    return res;
}
function normalize(v) {
    const len = Math.hypot(v.x, v.y) || 1;
    return { x: v.x / len, y: v.y / len };
}
function snapDir(start, target) {
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
function captureLineContext(pointIdx) {
    const lineIdx = findLinesContainingPoint(pointIdx)[0];
    if (lineIdx === undefined)
        return null;
    const line = model.lines[lineIdx];
    if (line.points.length < 2)
        return null;
    const origin = model.points[line.points[0]];
    const end = model.points[line.points[line.points.length - 1]];
    if (!origin || !end)
        return null;
    const dir = normalize({ x: end.x - origin.x, y: end.y - origin.y });
    const len = Math.hypot(end.x - origin.x, end.y - origin.y);
    if (len === 0)
        return null;
    const fractions = line.points.map((idx) => {
        const p = model.points[idx];
        if (!p)
            return 0;
        const t = ((p.x - origin.x) * dir.x + (p.y - origin.y) * dir.y) / len;
        return t;
    });
    return { lineIdx, fractions };
}
function applyLineFractions(lineIdx) {
    if (!lineDragContext || lineDragContext.lineIdx !== lineIdx)
        return;
    const line = model.lines[lineIdx];
    if (line.points.length < 2)
        return;
    const origin = model.points[line.points[0]];
    const end = model.points[line.points[line.points.length - 1]];
    if (!origin || !end)
        return;
    const dir = normalize({ x: end.x - origin.x, y: end.y - origin.y });
    const len = Math.hypot(end.x - origin.x, end.y - origin.y);
    if (len === 0)
        return;
    let fractions = lineDragContext.fractions;
    // If the line has more points than when we captured the context,
    // recalculate fractions for the new points
    if (fractions.length !== line.points.length) {
        // Use the stored fractions as a base, but recalculate based on current positions
        // This handles cases where points were added to the line after drag started
        const oldOrigin = model.points[line.points[0]];
        const oldEnd = model.points[line.points[line.points.length - 1]];
        if (!oldOrigin || !oldEnd)
            return;
        const oldDir = normalize({ x: oldEnd.x - oldOrigin.x, y: oldEnd.y - oldOrigin.y });
        const oldLen = Math.hypot(oldEnd.x - oldOrigin.x, oldEnd.y - oldOrigin.y);
        if (oldLen === 0)
            return;
        fractions = line.points.map((idx) => {
            const p = model.points[idx];
            if (!p)
                return 0;
            const t = ((p.x - oldOrigin.x) * oldDir.x + (p.y - oldOrigin.y) * oldDir.y) / oldLen;
            return t;
        });
    }
    const changed = new Set();
    fractions.forEach((t, idx) => {
        const pIdx = line.points[idx];
        if (idx === 0 || idx === line.points.length - 1)
            return;
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
// Helper function to check if a hidden point should hide the edges it's on
function isPointHiddenForEdges(idx) {
    const pt = model.points[idx];
    if (!pt)
        return false;
    if (!pt.style.hidden)
        return false;
    if (pt.parallel_helper_for)
        return false;
    if (pt.perpendicular_helper_for)
        return false;
    return (pt.construction_kind !== 'intersection' &&
        pt.construction_kind !== 'midpoint' &&
        pt.construction_kind !== 'symmetric' &&
        pt.construction_kind !== 'on_object');
}
function findLineHits(p) {
    const hits = [];
    const tol = currentHitRadius();
    for (let i = model.lines.length - 1; i >= 0; i--) {
        const line = model.lines[i];
        if (line.hidden && !showHidden)
            continue;
        if (line.points.length >= 2) {
            for (let s = 0; s < line.points.length - 1; s++) {
                const a = model.points[line.points[s]];
                const b = model.points[line.points[s + 1]];
                const style = line.segmentStyles?.[s] ?? line.style;
                if (!a || !b)
                    continue;
                if (style.hidden && !showHidden)
                    continue;
                if (!showHidden && (isPointHiddenForEdges(line.points[s]) || isPointHiddenForEdges(line.points[s + 1])))
                    continue;
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
                const extend = (canvas.width + canvas.height) / (dpr * zoomFactor);
                if (line.leftRay && !(line.leftRay.hidden && !showHidden)) {
                    const rayEnd = { x: a.x - dir.x * extend, y: a.y - dir.y * extend };
                    if (pointToSegmentDistance(p, a, rayEnd) <= tol)
                        hits.push({ line: i, part: 'rayLeft' });
                }
                if (line.rightRay && !(line.rightRay.hidden && !showHidden)) {
                    const rayEnd = { x: b.x + dir.x * extend, y: b.y + dir.y * extend };
                    if (pointToSegmentDistance(p, b, rayEnd) <= tol)
                        hits.push({ line: i, part: 'rayRight' });
                }
            }
        }
    }
    return hits;
}
function findLine(p) {
    const hits = findLineHits(p);
    return hits.length ? hits[0] : null;
}
function normalizeAngle(a) {
    let ang = a;
    while (ang < 0)
        ang += Math.PI * 2;
    while (ang >= Math.PI * 2)
        ang -= Math.PI * 2;
    return ang;
}
function arcKey(circleIdx, arcIdx) {
    return `${circleIdx}:${arcIdx}`;
}
function parseArcKey(key) {
    const [c, a] = key.split(':').map((v) => Number(v));
    if (Number.isFinite(c) && Number.isFinite(a))
        return { circle: c, arcIdx: a };
    return null;
}
function ensureArcStyles(circleIdx, count) {
    const circle = model.circles[circleIdx];
    if (!circle.arcStyles || circle.arcStyles.length !== count) {
        circle.arcStyles = Array.from({ length: count }, () => ({ ...circle.style }));
    }
}
function circleArcs(circleIdx) {
    const circle = model.circles[circleIdx];
    if (!circle)
        return [];
    const center = model.points[circle.center];
    if (!center)
        return [];
    const radius = circleRadius(circle);
    if (radius <= 1e-3)
        return [];
    const pts = circlePerimeterPoints(circle)
        .map((pi) => {
        const p = model.points[pi];
        if (!p)
            return null;
        const ang = Math.atan2(p.y - center.y, p.x - center.x);
        return { idx: pi, ang };
    })
        .filter((v) => v !== null)
        .sort((a, b) => a.ang - b.ang);
    if (pts.length < 2)
        return [];
    ensureArcStyles(circleIdx, pts.length);
    const arcs = [];
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
function angleOnArc(test, start, end, clockwise) {
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
function findArcAt(p, tolerance = currentHitRadius(), onlyCircle) {
    for (let ci = model.circles.length - 1; ci >= 0; ci--) {
        if (onlyCircle !== undefined && ci !== onlyCircle)
            continue;
        if (model.circles[ci].hidden && !showHidden)
            continue;
        const arcs = circleArcs(ci);
        for (let ai = arcs.length - 1; ai >= 0; ai--) {
            const arc = arcs[ai];
            const center = arc.center;
            const dist = Math.hypot(p.x - center.x, p.y - center.y);
            if (Math.abs(dist - arc.radius) > tolerance)
                continue;
            const ang = Math.atan2(p.y - center.y, p.x - center.x);
            if (angleOnArc(ang, arc.start, arc.end, arc.clockwise))
                return { circle: ci, arcIdx: ai };
        }
    }
    return null;
}
function angleBaseGeometry(ang) {
    const l1 = model.lines[ang.leg1.line];
    const l2 = model.lines[ang.leg2.line];
    if (!l1 || !l2)
        return null;
    const v = model.points[ang.vertex];
    const a1 = model.points[l1.points[ang.leg1.seg]];
    const b1 = model.points[l1.points[ang.leg1.seg + 1]];
    const a2 = model.points[l2.points[ang.leg2.seg]];
    const b2 = model.points[l2.points[ang.leg2.seg + 1]];
    if (!v || !a1 || !b1 || !a2 || !b2)
        return null;
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
    const maxRadius = Math.max(4, legLimit);
    const minRadius = Math.max(4, Math.min(maxRadius, ANGLE_MIN_RADIUS));
    let radius = Math.min(ANGLE_DEFAULT_RADIUS, maxRadius);
    radius = clamp(radius, minRadius, maxRadius);
    return { v, p1, p2, start, end, span: ccw, clockwise, radius, minRadius, maxRadius };
}
function angleGeometry(ang) {
    const base = angleBaseGeometry(ang);
    if (!base)
        return null;
    const offset = ang.style.arcRadiusOffset ?? 0;
    const rawRadius = base.radius + offset;
    const radius = clamp(rawRadius, base.minRadius, base.maxRadius);
    return { ...base, radius, style: ang.style };
}
function defaultAngleRadius(ang) {
    const base = angleBaseGeometry(ang);
    return base ? base.radius : null;
}
function adjustSelectedAngleRadius(direction) {
    if (selectedAngleIndex === null)
        return;
    const ang = model.angles[selectedAngleIndex];
    const base = angleBaseGeometry(ang);
    if (!base)
        return;
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
function findAngleAt(p, tolerance = currentHitRadius()) {
    for (let i = model.angles.length - 1; i >= 0; i--) {
        const geom = angleGeometry(model.angles[i]);
        if (!geom)
            continue;
        const { v, start, end, clockwise, radius } = geom;
        const dist = Math.abs(Math.hypot(p.x - v.x, p.y - v.y) - radius);
        if (dist > tolerance)
            continue;
        const ang = Math.atan2(p.y - v.y, p.x - v.x);
        if (angleOnArc(ang, start, end, clockwise))
            return i;
    }
    return null;
}
function pointInLine(idx, line) {
    return line.points.includes(idx);
}
function pointToSegmentDistance(p, a, b) {
    const l2 = Math.max(1, (b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2));
    const proj = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    return Math.hypot(p.x - proj.x, p.y - proj.y);
}
function circlesContainingPoint(idx) {
    const res = new Set();
    model.circles.forEach((c, ci) => {
        // Only include points that are actually on the circle (constrained to it)
        // NOT the radius_point which just defines the circle size
        if (c.points.includes(idx) && !circleHasDefiningPoint(c, idx))
            res.add(ci);
    });
    return Array.from(res);
}
function circlesReferencingPoint(idx) {
    const res = new Set();
    model.circles.forEach((c, ci) => {
        if (c.center === idx)
            res.add(ci);
        if (c.radius_point === idx)
            res.add(ci);
        if (c.points.includes(idx) && !circleHasDefiningPoint(c, idx))
            res.add(ci);
        if (isCircleThroughPoints(c) && c.defining_points.includes(idx))
            res.add(ci);
    });
    return Array.from(res);
}
function circlesWithCenter(idx) {
    const res = [];
    model.circles.forEach((c, ci) => {
        if (c.center === idx)
            res.push(ci);
    });
    return res;
}
function strokeBounds(stroke) {
    if (!stroke.points.length)
        return null;
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
function findInkStrokeAt(p) {
    for (let i = model.inkStrokes.length - 1; i >= 0; i--) {
        const stroke = model.inkStrokes[i];
        if (stroke.hidden && !showHidden)
            continue;
        const bounds = strokeBounds(stroke);
        if (!bounds)
            continue;
        if (p.x < bounds.minX || p.x > bounds.maxX || p.y < bounds.minY || p.y > bounds.maxY)
            continue;
        const tolerance = currentHitRadius();
        for (let j = 0; j < stroke.points.length; j++) {
            const pt = stroke.points[j];
            if (j === 0) {
                if (Math.hypot(p.x - pt.x, p.y - pt.y) <= tolerance)
                    return i;
            }
            else {
                const prev = stroke.points[j - 1];
                if (pointToSegmentDistance(p, prev, pt) <= tolerance)
                    return i;
            }
        }
    }
    return null;
}
function applyStrokeStyle(kind) {
    if (!ctx)
        return;
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
function getPointLabelPos(idx) {
    const p = model.points[idx];
    if (!p || !p.label)
        return null;
    if (!p.label.offset)
        p.label.offset = defaultPointLabelOffset(idx);
    const offScreen = p.label.offset ?? { x: 8, y: -8 };
    const offWorld = screenOffsetToWorld(offScreen);
    return { x: p.x + offWorld.x, y: p.y + offWorld.y };
}
function getLineLabelPos(idx) {
    const line = model.lines[idx];
    if (!line || !line.label)
        return null;
    const ext = lineExtent(idx);
    if (!ext)
        return null;
    if (!line.label.offset)
        line.label.offset = defaultLineLabelOffset(idx);
    const offScreen = line.label.offset ?? { x: 0, y: -10 };
    const offWorld = screenOffsetToWorld(offScreen);
    return { x: ext.center.x + offWorld.x, y: ext.center.y + offWorld.y };
}
function getAngleLabelPos(idx) {
    const ang = model.angles[idx];
    if (!ang || !ang.label)
        return null;
    const geom = angleGeometry(ang);
    if (!geom)
        return null;
    if (!ang.label.offset)
        ang.label.offset = defaultAngleLabelOffset(idx);
    const offScreen = ang.label.offset ?? { x: 0, y: 0 };
    const offWorld = screenOffsetToWorld(offScreen);
    return { x: geom.v.x + offWorld.x, y: geom.v.y + offWorld.y };
}
function findLabelAt(p) {
    const tolerance = currentLabelHitRadius();
    for (let i = model.angles.length - 1; i >= 0; i--) {
        const pos = getAngleLabelPos(i);
        if (pos && Math.hypot(pos.x - p.x, pos.y - p.y) <= tolerance)
            return { kind: 'angle', id: i };
    }
    for (let i = model.lines.length - 1; i >= 0; i--) {
        const pos = getLineLabelPos(i);
        if (pos && Math.hypot(pos.x - p.x, pos.y - p.y) <= tolerance)
            return { kind: 'line', id: i };
    }
    for (let i = model.points.length - 1; i >= 0; i--) {
        const pos = getPointLabelPos(i);
        if (pos && Math.hypot(pos.x - p.x, pos.y - p.y) <= tolerance)
            return { kind: 'point', id: i };
    }
    for (let i = model.labels.length - 1; i >= 0; i--) {
        const lab = model.labels[i];
        if (lab.hidden && !showHidden)
            continue;
        if (Math.hypot(lab.pos.x - p.x, lab.pos.y - p.y) <= tolerance)
            return { kind: 'free', id: i };
    }
    return null;
}
function toPoint(ev) {
    const rect = canvas.getBoundingClientRect();
    const canvasX = ev.clientX - rect.left;
    const canvasY = ev.clientY - rect.top;
    return canvasToWorld(canvasX, canvasY);
}
function canvasToWorld(canvasX, canvasY) {
    return {
        x: (canvasX - panOffset.x) / zoomFactor,
        y: (canvasY - panOffset.y) / zoomFactor
    };
}
function worldToCanvas(worldX, worldY) {
    return {
        x: worldX * zoomFactor + panOffset.x,
        y: worldY * zoomFactor + panOffset.y
    };
}
function screenOffsetToWorld(offset) {
    return { x: offset.x / zoomFactor, y: offset.y / zoomFactor };
}
function worldOffsetToScreen(offset) {
    return { x: offset.x * zoomFactor, y: offset.y * zoomFactor };
}
function updateTouchPointFromEvent(ev) {
    if (!canvas)
        return;
    const rect = canvas.getBoundingClientRect();
    activeTouches.set(ev.pointerId, { x: ev.clientX - rect.left, y: ev.clientY - rect.top });
}
function removeTouchPoint(pointerId) {
    activeTouches.delete(pointerId);
    if (pinchState && !pinchState.pointerIds.every((id) => activeTouches.has(id))) {
        pinchState = null;
    }
}
function startPinchFromTouches() {
    const entries = Array.from(activeTouches.entries());
    if (entries.length < 2)
        return false;
    const [[idA, ptA], [idB, ptB]] = entries;
    const distance = Math.hypot(ptA.x - ptB.x, ptA.y - ptB.y);
    if (!(distance > 0))
        return false;
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
function continuePinchGesture() {
    if (!pinchState)
        return false;
    const [idA, idB] = pinchState.pointerIds;
    const ptA = activeTouches.get(idA);
    const ptB = activeTouches.get(idB);
    if (!ptA || !ptB)
        return false;
    const distance = Math.hypot(ptA.x - ptB.x, ptA.y - ptB.y);
    if (!(distance > 0))
        return false;
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
function handleCanvasWheel(ev) {
    if (!canvas)
        return;
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
function selectLabel(sel) {
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
    if (selectedLabel) {
        selectedLabel = null;
        updateSelectionButtons();
    }
}
function handleToolClick(tool) {
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
        }
        else {
            const segEntry = Array.from(selectedSegments)
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
    if (tool === 'triangleUp' ||
        tool === 'square' ||
        tool === 'polygon' ||
        tool === 'ngon' ||
        tool === 'angle' ||
        tool === 'bisector' ||
        tool === 'circleThree') {
        clearSelectionState();
        updateSelectionButtons();
        draw();
    }
    setMode(tool);
    if (tool === 'symmetric') {
        symmetricSourceIndex = symmetricSeed;
        if (symmetricSourceIndex !== null)
            draw();
    }
    if (tool === 'label') {
        tryApplyLabelToSelection();
    }
    updateToolButtons();
    updateSelectionButtons();
}
function handleToolSticky(tool) {
    if (stickyTool === tool) {
        stickyTool = null;
        setMode('move');
    }
    else {
        stickyTool = tool;
        setMode(tool);
    }
    updateToolButtons();
    updateSelectionButtons();
}
function setupDoubleTapSticky(btn, tool) {
    if (!btn)
        return;
    btn.addEventListener('touchend', (e) => {
        const now = Date.now();
        const lastTap = doubleTapTimeouts.get(btn);
        if (lastTap && now - lastTap < DOUBLE_TAP_DELAY) {
            // Double tap detected
            e.preventDefault();
            doubleTapTimeouts.delete(btn);
            handleToolSticky(tool);
        }
        else {
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
    const applyClasses = (btn, tool) => {
        if (!btn)
            return;
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
    applyClasses(document.getElementById('modeCircle'), 'circle');
    applyClasses(modeHandwritingBtn, 'handwriting');
    if (modeMoveBtn) {
        modeMoveBtn.classList.toggle('active', mode === 'move');
        modeMoveBtn.classList.toggle('sticky', false);
        const moveLabel = 'Edycja';
        modeMoveBtn.title = moveLabel;
        modeMoveBtn.setAttribute('aria-label', moveLabel);
        modeMoveBtn.innerHTML = `${ICONS.moveSelect}<span class="sr-only">${moveLabel}</span>`;
    }
    // Handle multi-buttons - check if current tool matches any in the group
    Object.entries(buttonConfig.multiButtons).forEach(([mainId, buttonIds]) => {
        const mainBtn = document.getElementById(mainId);
        if (!mainBtn)
            return;
        const currentIndex = multiButtonStates[mainId] || 0;
        const currentToolId = buttonIds[currentIndex];
        const currentTool = TOOL_BUTTONS.find(t => t.id === currentToolId);
        if (currentTool) {
            let isActive = false;
            if (currentToolId === 'copyStyleBtn') {
                isActive = copyStyleActive;
            }
            else {
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
        if (viewModeMenuContainer)
            viewModeMenuContainer.style.display = 'none';
        const mode = getViewModeState();
        if (mode === 'edges')
            viewModeToggleBtn.innerHTML = ICONS.viewEdges;
        else
            viewModeToggleBtn.innerHTML = ICONS.viewVertices;
    }
    const anySelection = selectedLineIndex !== null ||
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
        }
        else {
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
        styleMenuContainer.style.display = anySelection && !hasMultiSelection() ? 'inline-flex' : 'none';
        if (!anySelection) {
            closeStyleMenu();
            styleMenuSuppressed = false;
        }
        updateStyleMenuValues();
    }
}
function renderWidth(w) {
    return Math.max(0.1, w / (dpr * zoomFactor));
}
function screenUnits(value) {
    return value / zoomFactor;
}
function renderInkStroke(stroke, context) {
    const points = stroke.points;
    if (!points.length)
        return;
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
function drawSegmentTicks(a, b, level, context) {
    if (level <= 0)
        return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(length) || length <= screenUnits(2))
        return;
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
function drawArcTicks(center, radius, start, end, clockwise, level, context) {
    if (level <= 0 || radius <= 0)
        return;
    let span = clockwise ? (start - end + Math.PI * 2) % (Math.PI * 2) : (end - start + Math.PI * 2) % (Math.PI * 2);
    if (span < 1e-4)
        span = Math.PI * 2;
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
function drawCircleTicks(center, radius, level, context) {
    drawArcTicks(center, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2, false, level, context);
}
function currentHitRadius(multiplier = 1) {
    return (HIT_RADIUS * multiplier) / zoomFactor;
}
function currentLabelHitRadius(multiplier = 1) {
    return (LABEL_HIT_RADIUS * multiplier) / zoomFactor;
}
function pointRadius(size) {
    const start = 4; // size 1
    const end = 6; // size 6
    const clamped = Math.max(1, Math.min(6, size));
    if (clamped <= 1)
        return start;
    return start + ((clamped - 1) * (end - start)) / 5;
}
function lineMidpoint(lineIdx) {
    const line = model.lines[lineIdx];
    if (!line || line.points.length < 2)
        return null;
    const a = model.points[line.points[0]];
    const b = model.points[line.points[line.points.length - 1]];
    if (!a || !b)
        return null;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, a, b };
}
function defaultLineLabelOffset(lineIdx) {
    const mp = lineMidpoint(lineIdx);
    if (!mp)
        return worldOffsetToScreen({ x: 0, y: -16 });
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
            if (dot > 0)
                normal = { x: -normal.x, y: -normal.y }; // push outward
        }
    }
    else if (Math.abs(dx) < 1e-3) {
        normal = { x: -1, y: 0 };
    }
    else if (normal.y > 0) {
        normal = { x: -normal.x, y: -normal.y }; // aim upward
    }
    const margin = 18;
    return worldOffsetToScreen({ x: normal.x * margin, y: normal.y * margin });
}
function pointLineDirections(pointIdx) {
    const dirs = [];
    const lines = findLinesContainingPoint(pointIdx);
    lines.forEach((li) => {
        const line = model.lines[li];
        const pos = line.points.indexOf(pointIdx);
        if (pos === -1)
            return;
        const prev = pos > 0 ? model.points[line.points[pos - 1]] : null;
        const next = pos < line.points.length - 1 ? model.points[line.points[pos + 1]] : null;
        const p = model.points[pointIdx];
        if (!p)
            return;
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
function defaultPointLabelOffset(pointIdx) {
    const p = model.points[pointIdx];
    const fallbackWorld = { x: 12, y: -12 };
    if (!p)
        return worldOffsetToScreen(fallbackWorld);
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
        let dir = len > 1e-3
            ? { x: sum.x / len, y: sum.y / len }
            : { x: -dirs[0].y, y: dirs[0].x }; // perpendicular fallback
        dir = { x: -dir.x, y: -dir.y }; // outside the angle
        return worldOffsetToScreen({ x: dir.x * margin, y: dir.y * margin });
    }
    if (dirs.length === 1) {
        let dir = { x: -dirs[0].y, y: dirs[0].x }; // perpendicular
        if (dir.y > 0)
            dir = { x: -dir.x, y: -dir.y };
        return worldOffsetToScreen({ x: dir.x * margin, y: dir.y * margin });
    }
    return worldOffsetToScreen(fallbackWorld);
}
function defaultAngleLabelOffset(angleIdx) {
    const geom = angleGeometry(model.angles[angleIdx]);
    if (!geom)
        return worldOffsetToScreen({ x: 0, y: -12 });
    const mid = geom.start + geom.span / 2;
    const dir = { x: Math.cos(mid), y: Math.sin(mid) };
    const radius = Math.max(geom.radius * 0.65, 12);
    return worldOffsetToScreen({ x: dir.x * radius, y: dir.y * radius });
}
function drawLabelText(label, anchor, selected = false, screenOffset) {
    if (!ctx)
        return;
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
    if (selected) {
        const metrics = ctx.measureText(label.text);
        const padX = 6;
        const padY = 4;
        const w = metrics.width + padX * 2;
        const h = fontSize + padY * 2;
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
    ctx.fillText(label.text, 0, 0);
    ctx.restore();
}
function updateOptionButtons() {
    if (showHiddenBtn) {
        showHiddenBtn.classList.toggle('active', showHidden);
        showHiddenBtn.innerHTML = showHidden ? ICONS.eyeOff : ICONS.eye;
    }
    if (themeDarkBtn) {
        const isDark = currentTheme === 'dark';
        themeDarkBtn.classList.toggle('active', isDark);
        themeDarkBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    }
}
function normalizeColor(color) {
    return color.trim().toLowerCase();
}
function rememberColor(color) {
    const norm = normalizeColor(color);
    const existing = recentColors.findIndex((c) => normalizeColor(c) === norm);
    if (existing >= 0)
        recentColors.splice(existing, 1);
    recentColors.unshift(color);
    if (recentColors.length > 20)
        recentColors = recentColors.slice(0, 20);
    updateColorButtons();
}
function paletteColors() {
    const palette = [];
    recentColors.forEach((c) => {
        if (!palette.some((p) => normalizeColor(p) === normalizeColor(c)))
            palette.push(c);
    });
    const baseColors = THEME.palette;
    if (baseColors.length) {
        baseColors.forEach((c) => {
            if (palette.length < 5 && !palette.some((p) => normalizeColor(p) === normalizeColor(c)))
                palette.push(c);
        });
        while (palette.length < 5) {
            palette.push(baseColors[palette.length % baseColors.length]);
        }
    }
    else {
        while (palette.length < 5) {
            palette.push(THEME.defaultStroke);
        }
    }
    return palette.slice(0, 5);
}
function updateColorButtons() {
    const colorInput = styleColorInput;
    if (!colorInput)
        return;
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
function insertLabelSymbol(symbol) {
    if (!labelTextInput)
        return;
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
function refreshLabelKeyboard(labelEditing) {
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
    labelGreekButtons.forEach((btn) => {
        const lower = btn.dataset.letterLower ?? btn.dataset.letter ?? btn.textContent ?? '';
        const upper = btn.dataset.letterUpper ?? lower.toUpperCase();
        const symbol = labelGreekUppercase ? upper : lower;
        btn.dataset.letter = symbol;
        btn.textContent = symbol;
    });
    if (labelGreekShiftBtn) {
        const visible = labelEditing && labelGreekVisible;
        labelGreekShiftBtn.style.display = visible ? 'inline-flex' : 'none';
        labelGreekShiftBtn.classList.toggle('active', labelGreekUppercase && visible);
        labelGreekShiftBtn.setAttribute('aria-pressed', labelGreekUppercase ? 'true' : 'false');
    }
}
function labelFontSizeForSelection() {
    if (!selectedLabel)
        return null;
    switch (selectedLabel.kind) {
        case 'point': {
            const point = model.points[selectedLabel.id];
            const label = point?.label;
            if (!label)
                return null;
            const size = normalizeLabelFontSize(label.fontSize);
            if (label.fontSize !== size) {
                model.points[selectedLabel.id].label = { ...label, fontSize: size };
            }
            return size;
        }
        case 'line': {
            const line = model.lines[selectedLabel.id];
            const label = line?.label;
            if (!label)
                return null;
            const size = normalizeLabelFontSize(label.fontSize);
            if (label.fontSize !== size) {
                model.lines[selectedLabel.id].label = { ...label, fontSize: size };
            }
            return size;
        }
        case 'angle': {
            const angle = model.angles[selectedLabel.id];
            const label = angle?.label;
            if (!label)
                return null;
            const size = normalizeLabelFontSize(label.fontSize);
            if (label.fontSize !== size) {
                model.angles[selectedLabel.id].label = { ...label, fontSize: size };
            }
            return size;
        }
        case 'free': {
            const label = model.labels[selectedLabel.id];
            if (!label)
                return null;
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
    if (labelFontSizeDisplay)
        labelFontSizeDisplay.textContent = display;
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
function adjustSelectedLabelFont(delta) {
    const activeLabel = selectedLabel;
    if (!activeLabel || delta === 0) {
        updateLabelFontControls();
        return;
    }
    let changed = false;
    const apply = (label, setter) => {
        const current = normalizeLabelFontSize(label.fontSize);
        const nextSize = clampLabelFontSize(current + delta);
        if (nextSize === current)
            return;
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
    if (!styleWidthInput)
        return;
    const min = Number(styleWidthInput.min) || 1;
    const max = Number(styleWidthInput.max) || 10;
    const raw = Number(styleWidthInput.value);
    const current = clamp(Number.isFinite(raw) ? Math.round(raw) : min, min, max);
    if (styleWidthInput.value !== String(current))
        styleWidthInput.value = String(current);
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
function adjustLineWidth(delta) {
    if (!styleWidthInput || delta === 0) {
        updateLineWidthControls();
        return;
    }
    if (styleWidthInput.disabled) {
        updateLineWidthControls();
        return;
    }
    const min = Number(styleWidthInput.min) || 1;
    const max = Number(styleWidthInput.max) || 10;
    const current = Number(styleWidthInput.value) || min;
    const next = clamp(Math.round(current) + delta, min, max);
    if (next === Math.round(current)) {
        updateLineWidthControls();
        return;
    }
    styleWidthInput.value = String(next);
    applyStyleFromInputs();
    updateLineWidthControls();
}
function getTickStateForSelection(labelEditing) {
    if (labelEditing)
        return { available: false, state: 0, mixed: false };
    if (selectedLineIndex !== null || selectedPolygonIndex !== null) {
        const lines = new Set();
        if (selectedLineIndex !== null)
            lines.add(selectedLineIndex);
        if (selectedPolygonIndex !== null) {
            const poly = model.polygons[selectedPolygonIndex];
            poly?.lines.forEach((li) => lines.add(li));
        }
        const ticks = [];
        lines.forEach((lineIdx) => {
            const line = model.lines[lineIdx];
            if (!line)
                return;
            const segCount = Math.max(0, line.points.length - 1);
            ensureSegmentStylesForLine(lineIdx);
            const allSegments = selectedSegments.size === 0;
            for (let i = 0; i < segCount; i++) {
                const key = segmentKey(lineIdx, 'segment', i);
                if (!allSegments && !selectedSegments.has(key))
                    continue;
                const style = line.segmentStyles?.[i] ?? line.style;
                ticks.push(style.tick ?? 0);
            }
        });
        if (!ticks.length)
            return { available: true, state: 0, mixed: false };
        const first = ticks[0];
        const mixed = ticks.some((t) => t !== first);
        return { available: true, state: mixed ? 0 : first ?? 0, mixed };
    }
    if (selectedCircleIndex !== null) {
        const circleIdx = selectedCircleIndex;
        const arcs = circleArcs(circleIdx);
        ensureArcStyles(circleIdx, arcs.length);
        const circleStyle = model.circles[circleIdx]?.style;
        const ticks = [];
        arcs.forEach((arc, idx) => {
            const key = arcKey(circleIdx, idx);
            if (selectedArcSegments.size > 0 && !selectedArcSegments.has(key))
                return;
            const baseTick = circleStyle?.tick ?? 0;
            ticks.push((arc.style.tick ?? baseTick));
        });
        if (!ticks.length)
            return { available: true, state: 0, mixed: false };
        const first = ticks[0];
        const mixed = ticks.some((t) => t !== first);
        return { available: true, state: mixed ? 0 : first ?? 0, mixed };
    }
    return { available: false, state: 0, mixed: false };
}
function applyTickState(nextTick) {
    let changed = false;
    const applyToSegment = (lineIdx, segIdx, tick) => {
        const line = model.lines[lineIdx];
        if (!line)
            return;
        ensureSegmentStylesForLine(lineIdx);
        if (!line.segmentStyles)
            line.segmentStyles = [];
        const base = line.segmentStyles[segIdx] ?? line.style;
        line.segmentStyles[segIdx] = { ...base, tick };
        changed = true;
    };
    const applyToLine = (lineIdx, tick) => {
        const line = model.lines[lineIdx];
        if (!line)
            return;
        ensureSegmentStylesForLine(lineIdx);
        const segCount = Math.max(0, line.points.length - 1);
        if (!line.segmentStyles)
            line.segmentStyles = [];
        line.style = { ...line.style, tick };
        changed = true;
        for (let i = 0; i < segCount; i++) {
            applyToSegment(lineIdx, i, tick);
        }
        line.leftRay = line.leftRay ? { ...line.leftRay, tick } : line.leftRay;
        line.rightRay = line.rightRay ? { ...line.rightRay, tick } : line.rightRay;
    };
    const applyToArc = (circleIdx, arcIdx, tick) => {
        ensureArcStyles(circleIdx, circleArcs(circleIdx).length);
        const circle = model.circles[circleIdx];
        if (!circle.arcStyles)
            circle.arcStyles = [];
        const base = circle.arcStyles[arcIdx] ?? circle.style;
        circle.arcStyles[arcIdx] = { ...base, tick };
        changed = true;
    };
    const applyToCircle = (circleIdx, tick) => {
        const circle = model.circles[circleIdx];
        if (!circle)
            return;
        ensureArcStyles(circleIdx, circleArcs(circleIdx).length);
        circle.style = { ...circle.style, tick };
        if (!circle.arcStyles)
            circle.arcStyles = [];
        changed = true;
        for (let i = 0; i < circle.arcStyles.length; i++) {
            applyToArc(circleIdx, i, tick);
        }
    };
    if (selectedLineIndex !== null || selectedPolygonIndex !== null) {
        const lines = new Set();
        if (selectedLineIndex !== null)
            lines.add(selectedLineIndex);
        if (selectedPolygonIndex !== null) {
            const poly = model.polygons[selectedPolygonIndex];
            poly?.lines.forEach((li) => lines.add(li));
        }
        lines.forEach((lineIdx) => {
            const line = model.lines[lineIdx];
            if (!line)
                return;
            const segCount = Math.max(0, line.points.length - 1);
            const specificSegments = selectedSegments.size > 0;
            if (!specificSegments) {
                applyToLine(lineIdx, nextTick);
                changed = true;
            }
            else {
                for (let i = 0; i < segCount; i++) {
                    const key = segmentKey(lineIdx, 'segment', i);
                    if (selectedSegments.has(key))
                        applyToSegment(lineIdx, i, nextTick);
                }
            }
        });
    }
    else if (selectedCircleIndex !== null) {
        const circleIdx = selectedCircleIndex;
        const arcs = circleArcs(circleIdx);
        const specificArcs = selectedArcSegments.size > 0;
        if (!specificArcs) {
            applyToCircle(circleIdx, nextTick);
            changed = true;
        }
        else {
            arcs.forEach((arc, idx) => {
                const key = arcKey(circleIdx, idx);
                if (selectedArcSegments.has(key))
                    applyToArc(circleIdx, idx, nextTick);
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
    if (!tickInfo.available)
        return;
    const current = tickInfo.mixed ? 0 : tickInfo.state;
    const next = ((current + 1) % 4);
    applyTickState(next);
}
function updateStyleMenuValues() {
    if (!styleColorInput || !styleWidthInput || !styleTypeSelect)
        return;
    const setRowVisible = (row, visible) => {
        if (!row)
            return;
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
    const polygonLines = selectedPolygonIndex !== null ? model.polygons[selectedPolygonIndex]?.lines ?? [] : [];
    const lineIdxForStyle = selectedLineIndex !== null ? selectedLineIndex : polygonLines.length ? polygonLines[0] : null;
    const isPoint = selectedPointIndex !== null;
    const isLineLike = selectedLineIndex !== null || selectedPolygonIndex !== null;
    const preferPoints = selectionVertices && (!selectionEdges || selectedSegments.size > 0);
    if (labelTextRow)
        labelTextRow.style.display = labelEditing ? 'flex' : 'none';
    if (labelFontRow)
        labelFontRow.style.display = labelEditing ? 'flex' : 'none';
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
        if (labelTextInput)
            labelTextInput.value = text;
        styleWidthInput.disabled = true;
        styleTypeSelect.disabled = true;
    }
    else if (lineIdxForStyle !== null) {
        const line = model.lines[lineIdxForStyle];
        const style = line.segmentStyles?.[0] ?? line.style;
        if (preferPoints) {
            const ptIdx = line.points[0];
            const pt = ptIdx !== undefined ? model.points[ptIdx] : null;
            const base = pt ?? { style: { color: style.color, size: THEME.pointSize } };
            styleColorInput.value = base.style.color;
            styleWidthInput.value = String(base.style.size);
            styleTypeSelect.value = 'solid';
            styleWidthInput.disabled = false;
            styleTypeSelect.disabled = true;
        }
        else {
            styleColorInput.value = style.color;
            styleWidthInput.value = String(style.width);
            styleTypeSelect.value = style.type;
            styleWidthInput.disabled = false;
            styleTypeSelect.disabled = false;
        }
    }
    else if (selectedCircleIndex !== null) {
        const c = model.circles[selectedCircleIndex];
        const arcs = circleArcs(selectedCircleIndex);
        const style = selectedArcSegments.size > 0
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
    }
    else if (selectedAngleIndex !== null) {
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
            if (style.right)
                arcCountButtons.forEach((b) => b.classList.remove('active'));
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
    }
    else if (selectedPointIndex !== null) {
        const pt = model.points[selectedPointIndex];
        styleColorInput.value = pt.style.color;
        styleWidthInput.value = String(pt.style.size);
        styleTypeSelect.value = 'solid';
        styleWidthInput.disabled = false;
        styleTypeSelect.disabled = true;
    }
    else if (selectedInkStrokeIndex !== null) {
        const stroke = model.inkStrokes[selectedInkStrokeIndex];
        if (stroke) {
            styleColorInput.value = stroke.color;
            styleWidthInput.value = String(stroke.baseWidth);
            styleTypeSelect.value = 'solid';
            styleWidthInput.disabled = false;
            styleTypeSelect.disabled = true;
        }
    }
    else if (preferPoints && selectedLineIndex !== null) {
        const line = model.lines[selectedLineIndex];
        const firstPt = line?.points[0];
        const pt = firstPt !== undefined ? model.points[firstPt] : null;
        const base = pt ?? { style: { color: styleColorInput.value, size: THEME.pointSize } };
        styleColorInput.value = base.style.color;
        styleWidthInput.value = String(base.style.size);
        styleTypeSelect.value = 'solid';
        styleWidthInput.disabled = false;
        styleTypeSelect.disabled = true;
    }
    else if (preferPoints && selectedPolygonIndex !== null) {
        const verts = polygonVerticesOrdered(selectedPolygonIndex);
        const firstPt = verts[0] !== undefined ? model.points[verts[0]] : null;
        const base = firstPt ?? { style: { color: styleColorInput.value, size: THEME.pointSize } };
        styleColorInput.value = base.style.color;
        styleWidthInput.value = String(base.style.size);
        styleTypeSelect.value = 'solid';
        styleWidthInput.disabled = false;
        styleTypeSelect.disabled = true;
    }
    updateLineWidthControls();
    const showTypeGroup = !isPoint && !labelEditing && selectedInkStrokeIndex === null;
    if (styleTypeInline) {
        styleTypeInline.style.display = showTypeGroup ? 'inline-flex' : 'none';
        setRowVisible(styleTypeRow, false);
    }
    else {
        setRowVisible(styleTypeRow, showTypeGroup);
    }
    if (styleTypeGap)
        styleTypeGap.style.display = showTypeGroup ? 'flex' : 'none';
    const showRays = selectedLineIndex !== null && !labelEditing;
    if (styleRayGroup)
        styleRayGroup.style.display = showRays ? 'flex' : 'none';
    const tickInfo = getTickStateForSelection(labelEditing);
    const tickVisible = tickInfo.available && !labelEditing;
    if (styleTickGroup)
        styleTickGroup.style.display = tickVisible ? 'flex' : 'none';
    if (styleTickButton) {
        styleTickButton.disabled = !tickVisible;
        const iconState = (tickInfo.mixed || tickInfo.state === 0 ? 1 : tickInfo.state);
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
    setRowVisible(styleColorRow, true);
    setRowVisible(styleWidthRow, !labelEditing);
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
function setTheme(theme) {
    currentTheme = theme;
    const body = document.body;
    const root = document.documentElement;
    body?.classList.remove('theme-dark', 'theme-light');
    root?.classList.remove('theme-dark', 'theme-light');
    const config = THEME_PRESETS[theme];
    Object.assign(THEME, config);
    const palette = config.palette;
    if (theme === 'light') {
        body?.classList.add('theme-light');
        root?.classList.add('theme-light');
    }
    else {
        body?.classList.add('theme-dark');
        root?.classList.add('theme-dark');
    }
    if (typeof window !== 'undefined') {
        try {
            window.localStorage?.setItem(THEME_STORAGE_KEY, theme);
        }
        catch {
            // ignore storage failures
        }
    }
    HIGHLIGHT_LINE.color = THEME.highlight;
    if (strokeColorInput)
        strokeColorInput.value = palette[0] ?? THEME.defaultStroke;
    if (styleWidthInput)
        styleWidthInput.value = String(THEME.lineWidth);
    recentColors = palette.length ? [palette[0]] : [THEME.defaultStroke];
    updateOptionButtons();
    updateColorButtons();
    draw();
}
function applyStyleFromInputs() {
    if (!styleColorInput || !styleWidthInput || !styleTypeSelect)
        return;
    const color = styleColorInput.value;
    rememberColor(color);
    const width = Number(styleWidthInput.value) || 1;
    const type = styleTypeSelect.value;
    let changed = false;
    const applyPointStyle = (pointIdx) => {
        const pt = model.points[pointIdx];
        if (!pt)
            return;
        model.points[pointIdx] = { ...pt, style: { ...pt.style, color, size: width } };
        changed = true;
    };
    const applyPointsForLine = (lineIdx) => {
        if (!selectionVertices)
            return;
        const line = model.lines[lineIdx];
        if (!line)
            return;
        const seen = new Set();
        line.points.forEach((pi) => {
            if (seen.has(pi))
                return;
            seen.add(pi);
            applyPointStyle(pi);
        });
    };
    const applyPointsForPolygon = (polyIdx) => {
        if (!selectionVertices)
            return;
        const poly = model.polygons[polyIdx];
        if (!poly)
            return;
        const seen = new Set();
        poly.lines.forEach((li) => {
            const line = model.lines[li];
            line?.points.forEach((pi) => {
                if (seen.has(pi))
                    return;
                seen.add(pi);
                applyPointStyle(pi);
            });
        });
    };
    if (selectedLabel) {
        switch (selectedLabel.kind) {
            case 'point':
                if (model.points[selectedLabel.id]?.label) {
                    model.points[selectedLabel.id].label = { ...model.points[selectedLabel.id].label, color };
                    changed = true;
                }
                break;
            case 'line':
                if (model.lines[selectedLabel.id]?.label) {
                    model.lines[selectedLabel.id].label = { ...model.lines[selectedLabel.id].label, color };
                    changed = true;
                }
                break;
            case 'angle':
                if (model.angles[selectedLabel.id]?.label) {
                    model.angles[selectedLabel.id].label = { ...model.angles[selectedLabel.id].label, color };
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
    const applyStyleToLine = (lineIdx) => {
        const canStyleLine = selectionEdges || selectedSegments.size > 0;
        if (!canStyleLine)
            return;
        ensureSegmentStylesForLine(lineIdx);
        const line = model.lines[lineIdx];
        const segCount = Math.max(0, line.points.length - 1);
        if (!line.segmentStyles || line.segmentStyles.length !== segCount) {
            line.segmentStyles = Array.from({ length: segCount }, () => ({ ...line.style }));
        }
        const updateSegment = (segIdx) => {
            if (!line.segmentStyles)
                line.segmentStyles = [];
            line.segmentStyles[segIdx] = { ...(line.segmentStyles[segIdx] ?? line.style), color, width, type };
            changed = true;
        };
        const updateRay = (side) => {
            const src = side === 'left' ? line.leftRay : line.rightRay;
            const updated = { ...(src ?? line.style), color, width, type };
            if (side === 'left')
                line.leftRay = updated;
            else
                line.rightRay = updated;
            changed = true;
        };
        if (selectedSegments.size > 0) {
            selectedSegments.forEach((key) => {
                const parsed = parseSegmentKey(key);
                if (!parsed || parsed.line !== lineIdx)
                    return;
                if (parsed.part === 'segment' && parsed.seg !== undefined) {
                    updateSegment(parsed.seg);
                }
                else if (parsed.part === 'rayLeft') {
                    updateRay('left');
                }
                else if (parsed.part === 'rayRight') {
                    updateRay('right');
                }
            });
        }
        else {
            line.style = { ...line.style, color, width, type };
            for (let i = 0; i < segCount; i++) {
                updateSegment(i);
            }
            if (line.leftRay)
                line.leftRay = { ...line.leftRay, color, width, type };
            if (line.rightRay)
                line.rightRay = { ...line.rightRay, color, width, type };
        }
    };
    if (selectedLineIndex !== null || selectedPolygonIndex !== null) {
        if (selectedPolygonIndex !== null) {
            const poly = model.polygons[selectedPolygonIndex];
            poly?.lines.forEach((li) => {
                applyStyleToLine(li);
                applyPointsForLine(li);
            });
            if (poly)
                applyPointsForPolygon(selectedPolygonIndex);
        }
        if (selectedLineIndex !== null) {
            applyStyleToLine(selectedLineIndex);
            applyPointsForLine(selectedLineIndex);
        }
    }
    else if (selectedCircleIndex !== null) {
        const c = model.circles[selectedCircleIndex];
        const arcs = circleArcs(selectedCircleIndex);
        const segCount = arcs.length;
        ensureArcStyles(selectedCircleIndex, segCount);
        const applyArc = (arcIdx) => {
            if (!c.arcStyles)
                c.arcStyles = Array.from({ length: segCount }, () => ({ ...c.style }));
            c.arcStyles[arcIdx] = { ...(c.arcStyles[arcIdx] ?? c.style), color, width, type };
            changed = true;
        };
        if (selectedArcSegments.size > 0) {
            selectedArcSegments.forEach((key) => {
                const parsed = parseArcKey(key);
                if (!parsed || parsed.circle !== selectedCircleIndex)
                    return;
                if (parsed.arcIdx >= 0 && parsed.arcIdx < segCount)
                    applyArc(parsed.arcIdx);
            });
        }
        else {
            c.style = { ...c.style, color, width, type };
            changed = true;
            for (let i = 0; i < segCount; i++)
                applyArc(i);
        }
    }
    else if (selectedAngleIndex !== null) {
        const ang = model.angles[selectedAngleIndex];
        const arcBtn = arcCountButtons.find((b) => b.classList.contains('active'));
        const arcCount = arcBtn ? Number(arcBtn.dataset.count) || 1 : ang.style.arcCount ?? 1;
        const right = rightAngleBtn ? rightAngleBtn.classList.contains('active') : false;
        model.angles[selectedAngleIndex] = { ...ang, style: { ...ang.style, color, width, type, arcCount, right } };
        changed = true;
    }
    else if (selectedPointIndex !== null) {
        const pt = model.points[selectedPointIndex];
        model.points[selectedPointIndex] = { ...pt, style: { ...pt.style, color, size: width } };
        changed = true;
    }
    else if (selectedInkStrokeIndex !== null) {
        const stroke = model.inkStrokes[selectedInkStrokeIndex];
        if (stroke) {
            model.inkStrokes[selectedInkStrokeIndex] = { ...stroke, color, baseWidth: width };
            changed = true;
        }
    }
    if (changed) {
        draw();
        pushHistory();
    }
}
function addCircleWithCenter(centerIdx, radius, points) {
    const style = currentStrokeStyle();
    const center = model.points[centerIdx];
    const id = nextId('circle', model);
    if (!center)
        return -1;
    const assignedPoints = points.length ? [...points] : [addPoint(model, { x: center.x + radius, y: center.y, style: currentPointStyle() })];
    const adjustedPoints = [];
    assignedPoints.forEach((pid, i) => {
        const pt = model.points[pid];
        if (!pt)
            return;
        const angle = Math.atan2(pt.y - center.y, pt.x - center.x);
        const safeAngle = Number.isFinite(angle) ? angle : i * (Math.PI / 4);
        const pos = { x: center.x + Math.cos(safeAngle) * radius, y: center.y + Math.sin(safeAngle) * radius };
        model.points[pid] = { ...pt, ...pos };
        if (i > 0)
            adjustedPoints.push(pid);
    });
    const radiusPointIdx = assignedPoints[0];
    if (!Number.isFinite(radius) || radius < 1e-6)
        return -1;
    const circle = {
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
        recompute: () => { },
        on_parent_deleted: () => { }
    };
    const circleIdx = model.circles.length;
    model.circles.push(circle);
    registerIndex(model, 'circle', id, circleIdx);
    // Don't change construction_kind of existing free points - they define the circle, but aren't constrained by it
    // Only mark additional points as on_object
    adjustedPoints.forEach((pid) => applyPointConstruction(pid, [{ kind: 'circle', id }]));
    return circleIdx;
}
function addCircleThroughPoints(definingPoints) {
    const unique = Array.from(new Set(definingPoints));
    if (unique.length !== 3)
        return null;
    const [aIdx, bIdx, cIdx] = unique;
    const a = model.points[aIdx];
    const b = model.points[bIdx];
    const c = model.points[cIdx];
    if (!a || !b || !c)
        return null;
    const centerPos = circleFromThree(a, b, c);
    if (!centerPos)
        return null;
    const centerIdx = addPoint(model, { ...centerPos, style: currentPointStyle() });
    const radius = Math.hypot(centerPos.x - a.x, centerPos.y - a.y);
    if (!Number.isFinite(radius) || radius < 1e-6) {
        removePointsKeepingOrder([centerIdx]);
        return null;
    }
    const style = currentStrokeStyle();
    const id = nextId('circle', model);
    const circle = {
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
        recompute: () => { },
        on_parent_deleted: () => { }
    };
    const circleIdx = model.circles.length;
    model.circles.push(circle);
    registerIndex(model, 'circle', id, circleIdx);
    return circleIdx;
}
function recomputeCircleThroughPoints(circleIdx) {
    const circle = model.circles[circleIdx];
    if (!circle || !isCircleThroughPoints(circle))
        return;
    const [aIdx, bIdx, cIdx] = circle.defining_points;
    const a = model.points[aIdx];
    const b = model.points[bIdx];
    const c = model.points[cIdx];
    if (!a || !b || !c)
        return;
    const centerPos = circleFromThree(a, b, c);
    if (!centerPos)
        return;
    const newRadius = Math.hypot(centerPos.x - a.x, centerPos.y - a.y);
    if (!Number.isFinite(newRadius) || newRadius < 1e-6)
        return;
    const centerPoint = model.points[circle.center];
    if (centerPoint) {
        model.points[circle.center] = { ...centerPoint, x: centerPos.x, y: centerPos.y };
        updateMidpointsForPoint(circle.center);
    }
    circle.points.forEach((pid) => {
        if (circleHasDefiningPoint(circle, pid))
            return;
        const pt = model.points[pid];
        if (!pt)
            return;
        const angle = Math.atan2(pt.y - centerPos.y, pt.x - centerPos.x);
        if (!Number.isFinite(angle))
            return;
        const projected = {
            x: centerPos.x + Math.cos(angle) * newRadius,
            y: centerPos.y + Math.sin(angle) * newRadius
        };
        model.points[pid] = { ...pt, ...projected };
        updateMidpointsForPoint(pid);
    });
    updateIntersectionsForCircle(circleIdx);
}
function updateCirclesForPoint(pointIdx) {
    const handled = new Set();
    model.circles.forEach((circle, ci) => {
        if (!isCircleThroughPoints(circle))
            return;
        if (!circle.defining_points.includes(pointIdx))
            return;
        if (handled.has(ci))
            return;
        handled.add(ci);
        recomputeCircleThroughPoints(ci);
    });
    updateMidpointsForPoint(pointIdx);
}
function recomputeMidpoint(pointIdx) {
    const point = model.points[pointIdx];
    if (!isMidpointPoint(point))
        return;
    const [parentAId, parentBId] = point.midpoint.parents;
    const parentAIdx = pointIndexById(parentAId);
    const parentBIdx = pointIndexById(parentBId);
    if (parentAIdx === null || parentBIdx === null)
        return;
    const parentA = model.points[parentAIdx];
    const parentB = model.points[parentBIdx];
    if (!parentA || !parentB)
        return;
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
function reflectPointAcrossLine(source, line) {
    if (!line || line.points.length < 2)
        return null;
    const a = model.points[line.points[0]];
    const b = model.points[line.points[line.points.length - 1]];
    if (!a || !b)
        return null;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq <= 1e-9)
        return null;
    const t = ((source.x - a.x) * dx + (source.y - a.y) * dy) / lenSq;
    const proj = { x: a.x + dx * t, y: a.y + dy * t };
    return { x: 2 * proj.x - source.x, y: 2 * proj.y - source.y };
}
function recomputeSymmetricPoint(pointIdx) {
    const point = model.points[pointIdx];
    if (!isSymmetricPoint(point))
        return;
    const sourceIdx = pointIndexById(point.symmetric.source);
    if (sourceIdx === null)
        return;
    const source = model.points[sourceIdx];
    if (!source)
        return;
    let target = null;
    if (point.symmetric.mirror.kind === 'point') {
        const mirrorIdx = pointIndexById(point.symmetric.mirror.id);
        if (mirrorIdx === null)
            return;
        const mirror = model.points[mirrorIdx];
        if (!mirror)
            return;
        target = { x: mirror.x * 2 - source.x, y: mirror.y * 2 - source.y };
    }
    else {
        const lineIdx = lineIndexById(point.symmetric.mirror.id);
        if (lineIdx === null)
            return;
        const line = model.lines[lineIdx];
        if (!line)
            return;
        target = reflectPointAcrossLine(source, line);
    }
    if (!target)
        return;
    const constrained = constrainToCircles(pointIdx, target);
    model.points[pointIdx] = { ...point, ...constrained };
    updateMidpointsForPoint(pointIdx);
}
function updateSymmetricPointsForLine(lineIdx) {
    const line = model.lines[lineIdx];
    if (!line)
        return;
    const lineId = line.id;
    model.points.forEach((pt, idx) => {
        if (isSymmetricPoint(pt) && pt.symmetric.mirror.kind === 'line' && pt.symmetric.mirror.id === lineId) {
            recomputeSymmetricPoint(idx);
        }
    });
}
function updateParallelLinesForPoint(pointIdx) {
    const point = model.points[pointIdx];
    if (!point)
        return;
    const pid = point.id;
    model.lines.forEach((line, li) => {
        if (!isParallelLine(line))
            return;
        if (line.parallel.throughPoint === pid || line.parallel.helperPoint === pid) {
            recomputeParallelLine(li);
        }
    });
}
function updateParallelLinesForLine(lineIdx) {
    const line = model.lines[lineIdx];
    if (!line)
        return;
    const lineId = line.id;
    model.lines.forEach((other, idx) => {
        if (idx === lineIdx)
            return;
        if (isParallelLine(other) && other.parallel.referenceLine === lineId) {
            recomputeParallelLine(idx);
        }
    });
}
function updatePerpendicularLinesForPoint(pointIdx) {
    const point = model.points[pointIdx];
    if (!point)
        return;
    const pid = point.id;
    model.lines.forEach((line, li) => {
        if (!isPerpendicularLine(line))
            return;
        if (line.perpendicular.throughPoint === pid || line.perpendicular.helperPoint === pid) {
            recomputePerpendicularLine(li);
        }
    });
}
function updatePerpendicularLinesForLine(lineIdx) {
    const line = model.lines[lineIdx];
    if (!line)
        return;
    const lineId = line.id;
    model.lines.forEach((other, idx) => {
        if (idx === lineIdx)
            return;
        if (isPerpendicularLine(other) && other.perpendicular.referenceLine === lineId) {
            recomputePerpendicularLine(idx);
        }
    });
}
function updateMidpointsForPoint(parentIdx) {
    const parent = model.points[parentIdx];
    if (!parent)
        return;
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
function findCircles(p, tolerance = currentHitRadius(), includeInterior = true) {
    const hits = [];
    for (let i = model.circles.length - 1; i >= 0; i--) {
        const c = model.circles[i];
        if (c.hidden && !showHidden)
            continue;
        const center = model.points[c.center];
        if (!center)
            continue;
        const radius = circleRadius(c);
        if (radius <= 0)
            continue;
        const dist = Math.hypot(center.x - p.x, center.y - p.y);
        if (Math.abs(dist - radius) <= tolerance || (includeInterior && dist <= radius)) {
            hits.push({ circle: i });
        }
    }
    return hits;
}
function findCircle(p, tolerance = currentHitRadius(), includeInterior = true) {
    const hits = findCircles(p, tolerance, includeInterior);
    return hits.length ? hits[0] : null;
}
function createOffsetLineThroughPoint(kind, pointIdx, baseLineIdx) {
    if (kind === 'parallel') {
        return createParallelLineThroughPoint(pointIdx, baseLineIdx);
    }
    if (kind === 'perpendicular') {
        return createPerpendicularLineThroughPoint(pointIdx, baseLineIdx);
    }
    return null;
}
function primaryLineDirection(line) {
    const candidateIdxs = [...line.defining_points, ...line.points];
    const seen = new Set();
    let origin = null;
    for (const idx of candidateIdxs) {
        if (idx === undefined)
            continue;
        if (seen.has(idx))
            continue;
        seen.add(idx);
        const pt = model.points[idx];
        if (!pt)
            continue;
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
function createParallelLineThroughPoint(pointIdx, baseLineIdx) {
    const anchor = model.points[pointIdx];
    const baseLine = model.lines[baseLineIdx];
    if (!anchor || !baseLine)
        return null;
    if (!baseLine.id || !anchor.id)
        return null;
    const dirInfo = primaryLineDirection(baseLine);
    if (!dirInfo)
        return null;
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
    if (!helperPoint)
        return null;
    const baseStroke = baseLine.segmentStyles?.[0] ?? baseLine.style;
    const style = { ...baseStroke, hidden: false };
    const id = nextId('line', model);
    const meta = {
        throughPoint: anchor.id,
        referenceLine: baseLine.id,
        helperPoint: helperPoint.id
    };
    const parallelLine = {
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
        recompute: () => { },
        on_parent_deleted: () => { }
    };
    model.lines.push(parallelLine);
    const lineIdx = model.lines.length - 1;
    registerIndex(model, 'line', id, lineIdx);
    model.lines[lineIdx] = {
        ...parallelLine,
        recompute: () => recomputeParallelLine(lineIdx)
    };
    model.points[helperIdx] = { ...helperPoint, parallel_helper_for: id };
    applyPointConstruction(helperIdx, [{ kind: 'line', id }]);
    recomputeParallelLine(lineIdx);
    ensureSegmentStylesForLine(lineIdx);
    updateIntersectionsForLine(lineIdx);
    updateMidpointsForPoint(helperIdx);
    return lineIdx;
}
function createPerpendicularLineThroughPoint(pointIdx, baseLineIdx) {
    const anchor = model.points[pointIdx];
    const baseLine = model.lines[baseLineIdx];
    if (!anchor || !baseLine)
        return null;
    if (!baseLine.id || !anchor.id)
        return null;
    const dirInfo = primaryLineDirection(baseLine);
    if (!dirInfo)
        return null;
    const baseLength = lineLength(baseLineIdx) ?? dirInfo.length;
    const baseNormal = { x: -dirInfo.dir.y, y: dirInfo.dir.x };
    const baseFirstIdx = baseLine.points[0];
    const baseLastIdx = baseLine.points[baseLine.points.length - 1];
    const baseFirst = baseFirstIdx !== undefined ? model.points[baseFirstIdx] : null;
    const baseLast = baseLastIdx !== undefined ? model.points[baseLastIdx] : null;
    const ON_LINE_EPS = 1e-3;
    let helperMode = 'normal';
    let helperPos = null;
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
    if (!helperPoint)
        return null;
    const helperVector = { x: helperPoint.x - anchor.x, y: helperPoint.y - anchor.y };
    let helperDistance = Math.hypot(helperVector.x, helperVector.y);
    if (!Number.isFinite(helperDistance) || helperDistance < 1e-3) {
        helperDistance = Math.max(baseLength, 120);
    }
    const helperOrientation = helperVector.x * baseNormal.x + helperVector.y * baseNormal.y >= 0 ? 1 : -1;
    const baseStroke = baseLine.segmentStyles?.[0] ?? baseLine.style;
    const style = { ...baseStroke, hidden: false };
    const id = nextId('line', model);
    const meta = {
        throughPoint: anchor.id,
        referenceLine: baseLine.id,
        helperPoint: helperPoint.id,
        helperDistance,
        helperOrientation
    };
    if (helperMode === 'projection') {
        meta.helperMode = 'projection';
    }
    const perpendicularLine = {
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
        recompute: () => { },
        on_parent_deleted: () => { }
    };
    model.lines.push(perpendicularLine);
    const lineIdx = model.lines.length - 1;
    registerIndex(model, 'line', id, lineIdx);
    model.lines[lineIdx] = {
        ...perpendicularLine,
        recompute: () => recomputePerpendicularLine(lineIdx)
    };
    helperPoint = model.points[helperIdx];
    model.points[helperIdx] = { ...helperPoint, perpendicular_helper_for: id };
    const helperParents = [{ kind: 'line', id }];
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
function recomputeParallelLine(lineIdx) {
    if (parallelRecomputeStack.has(lineIdx))
        return;
    const line = model.lines[lineIdx];
    if (!isParallelLine(line))
        return;
    const throughIdx = pointIndexById(line.parallel.throughPoint);
    const helperIdx = pointIndexById(line.parallel.helperPoint);
    const baseIdx = lineIndexById(line.parallel.referenceLine);
    if (throughIdx === null || helperIdx === null || baseIdx === null)
        return;
    const anchor = model.points[throughIdx];
    const helper = model.points[helperIdx];
    const baseLine = model.lines[baseIdx];
    if (!anchor || !helper || !baseLine)
        return;
    const dirInfo = primaryLineDirection(baseLine);
    if (!dirInfo)
        return;
    parallelRecomputeStack.add(lineIdx);
    try {
        const direction = dirInfo.dir;
        const distances = new Map();
        line.points.forEach((idx) => {
            const pt = model.points[idx];
            if (!pt)
                return;
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
        const touched = new Set();
        distances.forEach((dist, idx) => {
            if (idx === throughIdx)
                return;
            const target = { x: anchor.x + direction.x * dist, y: anchor.y + direction.y * dist };
            const current = model.points[idx];
            if (!current)
                return;
            const constrained = constrainToCircles(idx, target);
            if (Math.abs(current.x - constrained.x) > 1e-6 || Math.abs(current.y - constrained.y) > 1e-6) {
                model.points[idx] = { ...current, ...constrained };
                touched.add(idx);
            }
        });
        if (!line.points.includes(throughIdx))
            line.points.unshift(throughIdx);
        if (!line.points.includes(helperIdx))
            line.points.push(helperIdx);
        line.defining_points = [throughIdx, helperIdx];
        ensureSegmentStylesForLine(lineIdx);
        reorderLinePoints(lineIdx);
        touched.forEach((idx) => updateMidpointsForPoint(idx));
        updateIntersectionsForLine(lineIdx);
        updateParallelLinesForLine(lineIdx);
        updatePerpendicularLinesForLine(lineIdx);
    }
    finally {
        parallelRecomputeStack.delete(lineIdx);
    }
}
function recomputePerpendicularLine(lineIdx) {
    if (perpendicularRecomputeStack.has(lineIdx))
        return;
    const line = model.lines[lineIdx];
    if (!isPerpendicularLine(line))
        return;
    const throughIdx = pointIndexById(line.perpendicular.throughPoint);
    const helperIdx = pointIndexById(line.perpendicular.helperPoint);
    const baseIdx = lineIndexById(line.perpendicular.referenceLine);
    if (throughIdx === null || helperIdx === null || baseIdx === null)
        return;
    const anchor = model.points[throughIdx];
    let helper = model.points[helperIdx];
    const baseLine = model.lines[baseIdx];
    if (!anchor || !helper || !baseLine)
        return;
    const dirInfo = primaryLineDirection(baseLine);
    if (!dirInfo)
        return;
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
                if (Math.abs(helper.x - constrained.x) > 1e-6 ||
                    Math.abs(helper.y - constrained.y) > 1e-6) {
                    model.points[helperIdx] = { ...helper, ...constrained };
                    helper = model.points[helperIdx];
                }
                helper = model.points[helperIdx];
            }
        }
        const helperVecRaw = { x: helper.x - anchor.x, y: helper.y - anchor.y };
        const baseProjection = helperVecRaw.x * baseNormal.x + helperVecRaw.y * baseNormal.y;
        let orientation = line.perpendicular.helperOrientation ?? (baseProjection >= 0 ? 1 : -1);
        if (selectedPointIndex === helperIdx && draggingSelection) {
            orientation = baseProjection >= 0 ? 1 : -1;
        }
        if (helperMode === 'projection') {
            orientation = baseProjection >= 0 ? 1 : -1;
        }
        line.perpendicular.helperOrientation = orientation;
        const direction = orientation === 1 ? baseNormal : { x: -baseNormal.x, y: -baseNormal.y };
        const distances = new Map();
        line.points.forEach((idx) => {
            const pt = model.points[idx];
            if (!pt)
                return;
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
        }
        else if (selectedPointIndex === helperIdx && draggingSelection) {
            let updatedDistance = Math.abs(helperProjection);
            if (!Number.isFinite(updatedDistance) || updatedDistance < 1e-3) {
                const fallback = Math.abs(helperProjection);
                if (Number.isFinite(fallback) && fallback > 1e-3) {
                    updatedDistance = fallback;
                }
                else {
                    const baseLen = lineLength(baseIdx) ?? dirInfo.length;
                    updatedDistance = baseLen > 1e-3 ? baseLen : 120;
                }
            }
            helperDistance = updatedDistance;
            line.perpendicular.helperDistance = helperDistance;
        }
        else if (helperDistance === undefined || helperDistance < 1e-3) {
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
        const touched = new Set();
        distances.forEach((dist, idx) => {
            if (idx === throughIdx)
                return;
            const target = {
                x: anchor.x + direction.x * dist,
                y: anchor.y + direction.y * dist
            };
            const current = model.points[idx];
            if (!current)
                return;
            const constrained = constrainToCircles(idx, target);
            if (Math.abs(current.x - constrained.x) > 1e-6 || Math.abs(current.y - constrained.y) > 1e-6) {
                model.points[idx] = { ...current, ...constrained };
                touched.add(idx);
            }
        });
        if (!line.points.includes(throughIdx))
            line.points.unshift(throughIdx);
        if (!line.points.includes(helperIdx))
            line.points.push(helperIdx);
        line.defining_points = [throughIdx, helperIdx];
        ensureSegmentStylesForLine(lineIdx);
        reorderLinePoints(lineIdx);
        touched.forEach((idx) => updateMidpointsForPoint(idx));
        updateIntersectionsForLine(lineIdx);
        updateParallelLinesForLine(lineIdx);
        updatePerpendicularLinesForLine(lineIdx);
    }
    finally {
        perpendicularRecomputeStack.delete(lineIdx);
    }
}
function pushHistory() {
    rebuildIndexMaps();
    const snapshot = {
        model: deepClone(model),
        panOffset: { ...panOffset },
        zoom: zoomFactor
    };
    history = history.slice(0, historyIndex + 1);
    history.push(snapshot);
    historyIndex = history.length - 1;
    updateUndoRedoButtons();
}
function deepClone(obj) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(obj);
        }
        catch {
            // Fallback when cloning functions or non-cloneable fields
        }
    }
    return JSON.parse(JSON.stringify(obj));
}
function serializeCurrentDocument() {
    rebuildIndexMaps();
    const pointData = model.points.map((point) => {
        const { incident_objects, recompute: _r, on_parent_deleted: _d, ...rest } = point;
        const cloned = deepClone(rest);
        return {
            ...cloned,
            incident_objects: Array.from(incident_objects)
        };
    });
    const lineData = model.lines.map((line) => {
        const { recompute: _r, on_parent_deleted: _d, ...rest } = line;
        return deepClone(rest);
    });
    const circleData = model.circles.map((circle) => {
        const { recompute: _r, on_parent_deleted: _d, ...rest } = circle;
        return deepClone(rest);
    });
    const angleData = model.angles.map((angle) => {
        const { recompute: _r, on_parent_deleted: _d, ...rest } = angle;
        return deepClone(rest);
    });
    const polygonData = model.polygons.map((polygon) => {
        const { recompute: _r, on_parent_deleted: _d, ...rest } = polygon;
        return deepClone(rest);
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
        theme: currentTheme,
        recentColors: [...recentColors],
        showHidden
    };
}
function applyPersistedDocument(raw) {
    if (!raw || typeof raw !== 'object')
        throw new Error('Brak danych w pliku JSON');
    const doc = raw;
    if (doc.version !== PERSIST_VERSION)
        throw new Error('Nieobsługiwana wersja pliku JSON');
    if (!doc.model)
        throw new Error('Brak sekcji modelu w pliku JSON');
    resetLabelState();
    const persistedModel = doc.model;
    const toPoint = (p) => {
        const clone = deepClone(p);
        const incidents = Array.isArray(clone.incident_objects) ? clone.incident_objects : [];
        if (clone.label)
            clone.label = { ...clone.label, fontSize: normalizeLabelFontSize(clone.label.fontSize) };
        const { incident_objects: _ignore, ...rest } = clone;
        return {
            ...rest,
            incident_objects: new Set(incidents.map((id) => String(id))),
            recompute: () => { },
            on_parent_deleted: () => { }
        };
    };
    const toLine = (l) => {
        const clone = deepClone(l);
        if (clone.label)
            clone.label = { ...clone.label, fontSize: normalizeLabelFontSize(clone.label.fontSize) };
        return {
            ...clone,
            recompute: () => { },
            on_parent_deleted: () => { }
        };
    };
    const toCircle = (c) => {
        const clone = deepClone(c);
        if (clone.label)
            clone.label = { ...clone.label, fontSize: normalizeLabelFontSize(clone.label.fontSize) };
        return {
            ...clone,
            recompute: () => { },
            on_parent_deleted: () => { }
        };
    };
    const toAngle = (a) => {
        const clone = deepClone(a);
        if (clone.label)
            clone.label = { ...clone.label, fontSize: normalizeLabelFontSize(clone.label.fontSize) };
        return {
            ...clone,
            recompute: () => { },
            on_parent_deleted: () => { }
        };
    };
    const toPolygon = (p) => ({
        ...deepClone(p),
        recompute: () => { },
        on_parent_deleted: () => { }
    });
    const restored = {
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
    const counters = {
        point: Number(providedCounters.point) || 0,
        line: Number(providedCounters.line) || 0,
        circle: Number(providedCounters.circle) || 0,
        angle: Number(providedCounters.angle) || 0,
        polygon: Number(providedCounters.polygon) || 0
    };
    const bumpCounter = (kind, id) => {
        if (!id)
            return;
        const prefix = ID_PREFIX[kind];
        if (!id.startsWith(prefix))
            return;
        const parsed = Number(id.slice(prefix.length));
        if (Number.isFinite(parsed) && parsed > counters[kind])
            counters[kind] = parsed;
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
    const sanitizeNumbers = (values) => Array.isArray(values)
        ? values
            .map((v) => (typeof v === 'number' ? v : Number(v)))
            .filter((v) => Number.isFinite(v))
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
    endDebugPanelDrag();
    closeStyleMenu();
    closeZoomMenu();
    closeViewMenu();
    closeRayMenu();
    setMode('move');
    const theme = normalizeThemeName(doc.theme ?? null) ?? 'dark';
    setTheme(theme);
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
    if (historyIndex <= 0)
        return;
    historyIndex -= 1;
    restoreHistory();
}
function redo() {
    if (historyIndex >= history.length - 1)
        return;
    historyIndex += 1;
    restoreHistory();
}
function restoreHistory() {
    const snap = history[historyIndex];
    if (!snap)
        return;
    model = deepClone(snap.model);
    panOffset = { ...snap.panOffset };
    zoomFactor = clamp(snap.zoom ?? 1, MIN_ZOOM, MAX_ZOOM);
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
async function captureCanvasAsPng() {
    if (!canvas)
        throw new Error('Płótno jest niedostępne');
    return await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            }
            else {
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
    }
    else {
        closeZoomMenu();
    }
}
function closeZoomMenu() {
    zoomMenuOpen = false;
    zoomMenuContainer?.classList.remove('open');
}
function toggleStyleMenu() {
    if (!styleMenuContainer)
        return;
    styleMenuOpen = !styleMenuOpen;
    if (styleMenuOpen) {
        // Dezaktywuj tryb kopiowania stylu przy otwieraniu menu
        if (copyStyleActive) {
            copyStyleActive = false;
            copiedStyle = null;
            updateSelectionButtons();
        }
        openStyleMenu();
    }
    else {
        styleMenuSuppressed = true;
        closeStyleMenu();
    }
}
function closeStyleMenu() {
    styleMenuOpen = false;
    styleMenuContainer?.classList.remove('open');
}
function openStyleMenu() {
    if (!styleMenuContainer)
        return;
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
function getViewModeState() {
    if (selectionEdges && selectionVertices)
        return 'both';
    if (selectionVertices && !selectionEdges)
        return 'vertices';
    return 'edges';
}
function setViewMode(mode) {
    if (mode === 'edges') {
        selectionEdges = !selectionEdges;
        if (!selectionEdges && !selectionVertices)
            selectionVertices = true;
    }
    else {
        selectionVertices = !selectionVertices;
        if (!selectionEdges && !selectionVertices)
            selectionEdges = true;
    }
    updateSelectionButtons();
    draw();
    closeViewMenu();
}
function toggleViewMenu() {
    viewModeOpen = !viewModeOpen;
    if (viewModeOpen) {
        if (viewModeToggleBtn && viewModeMenuContainer) {
            const dropdown = viewModeMenuContainer.querySelector('.dropdown-menu');
            if (dropdown) {
                const rect = viewModeToggleBtn.getBoundingClientRect();
                dropdown.style.position = 'fixed';
                dropdown.style.top = `${rect.bottom + 6}px`;
                dropdown.style.left = `${rect.left}px`;
                dropdown.style.right = 'auto';
            }
        }
        viewModeMenuContainer?.classList.add('open');
    }
    else {
        closeViewMenu();
    }
}
function closeViewMenu() {
    viewModeOpen = false;
    viewModeMenuContainer?.classList.remove('open');
}
function setRayMode(next) {
    if (selectedLineIndex === null)
        return;
    const line = model.lines[selectedLineIndex];
    const ensureRay = (side) => {
        if (side === 'left' && !line.leftRay)
            line.leftRay = { ...line.style, hidden: true };
        if (side === 'right' && !line.rightRay)
            line.rightRay = { ...line.style, hidden: true };
    };
    ensureRay('left');
    ensureRay('right');
    const leftOn = !!line.leftRay && !line.leftRay.hidden;
    const rightOn = !!line.rightRay && !line.rightRay.hidden;
    if (next === 'segment') {
        if (!leftOn && !rightOn) {
            line.leftRay.hidden = false;
            line.rightRay.hidden = false;
        }
        else {
            line.leftRay.hidden = true;
            line.rightRay.hidden = true;
        }
    }
    else if (next === 'right') {
        const newState = !rightOn;
        line.rightRay.hidden = !newState;
        if (!line.leftRay)
            line.leftRay = { ...line.style, hidden: true };
        const leftAfter = !!line.leftRay && !line.leftRay.hidden;
        if (!leftAfter && !newState) {
            line.leftRay.hidden = true;
            line.rightRay.hidden = true;
        }
    }
    else if (next === 'left') {
        const newState = !leftOn;
        line.leftRay.hidden = !newState;
        if (!line.rightRay)
            line.rightRay = { ...line.style, hidden: true };
        const rightAfter = !!line.rightRay && !line.rightRay.hidden;
        if (!rightAfter && !newState) {
            line.leftRay.hidden = true;
            line.rightRay.hidden = true;
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
            const dropdown = rayModeMenuContainer.querySelector('.dropdown-menu');
            if (dropdown) {
                const rect = rayModeToggleBtn.getBoundingClientRect();
                dropdown.style.position = 'fixed';
                dropdown.style.top = `${rect.bottom + 6}px`;
                dropdown.style.left = `${rect.left}px`;
                dropdown.style.right = 'auto';
            }
        }
        rayModeMenuContainer?.classList.add('open');
    }
    else {
        closeRayMenu();
    }
}
function closeRayMenu() {
    rayModeOpen = false;
    rayModeMenuContainer?.classList.remove('open');
}
function removePointsAndRelated(points, removeLines = false) {
    if (!points.length)
        return;
    const toRemove = new Set(points);
    const extraPoints = [];
    if (removeLines) {
        const remap = new Map();
        const kept = [];
        model.lines.forEach((line, idx) => {
            if (line.defining_points.some((pi) => toRemove.has(pi))) {
                if (line.label)
                    reclaimLabel(line.label);
                remap.set(idx, -1);
                if (isParallelLine(line)) {
                    const helperIdx = pointIndexById(line.parallel.helperPoint);
                    if (helperIdx !== null)
                        extraPoints.push(helperIdx);
                }
            }
            else {
                const filteredPoints = line.points.filter((pi) => !toRemove.has(pi));
                remap.set(idx, kept.length);
                kept.push({ ...line, points: filteredPoints });
            }
        });
        model.lines = kept;
        remapPolygons(remap);
        model.circles = model.circles.filter((circle) => {
            const removeCircle = toRemove.has(circle.center) ||
                toRemove.has(circle.radius_point) ||
                (isCircleThroughPoints(circle) && circle.defining_points.some((pi) => toRemove.has(pi)));
            if (removeCircle && circle.label)
                reclaimLabel(circle.label);
            return !removeCircle;
        });
        model.angles = model.angles.filter((ang) => {
            if (toRemove.has(ang.vertex)) {
                if (ang.label)
                    reclaimLabel(ang.label);
                return false;
            }
            return true;
        });
    }
    else {
        const remap = new Map();
        const rebuiltLines = [];
        model.lines.forEach((line, idx) => {
            const filteredPoints = line.points.filter((idx) => !toRemove.has(idx));
            if (filteredPoints.length < 2) {
                if (line.label)
                    reclaimLabel(line.label);
                remap.set(idx, -1);
                return;
            }
            const segCount = Math.max(0, filteredPoints.length - 1);
            const styles = line.segmentStyles && line.segmentStyles.length
                ? Array.from({ length: segCount }, (_, i) => line.segmentStyles[Math.min(i, line.segmentStyles.length - 1)])
                : undefined;
            const rebuilt = { ...line, points: filteredPoints, segmentStyles: styles };
            remap.set(idx, rebuiltLines.length);
            rebuiltLines.push(rebuilt);
        });
        model.lines = rebuiltLines;
        remapPolygons(remap);
        model.circles = model.circles
            .map((circle) => {
            if (toRemove.has(circle.center) || toRemove.has(circle.radius_point)) {
                if (circle.label)
                    reclaimLabel(circle.label);
                return null;
            }
            if (isCircleThroughPoints(circle) && circle.defining_points.some((pi) => toRemove.has(pi))) {
                if (circle.label)
                    reclaimLabel(circle.label);
                return null;
            }
            const pts = circle.points.filter((idx) => !toRemove.has(idx));
            return { ...circle, points: pts };
        })
            .filter((c) => c !== null);
        model.angles = model.angles.filter((ang) => {
            if (toRemove.has(ang.vertex)) {
                if (ang.label)
                    reclaimLabel(ang.label);
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
        if (pt?.label)
            reclaimLabel(pt.label);
    });
    removePointsKeepingOrder(points);
}
function removeParallelLinesReferencing(lineId) {
    if (!lineId)
        return [];
    const lineIndices = [];
    const helperPoints = [];
    const removedIds = [];
    model.lines.forEach((line, idx) => {
        if (!isParallelLine(line))
            return;
        if (line.parallel.referenceLine !== lineId)
            return;
        if (line.label)
            reclaimLabel(line.label);
        lineIndices.push(idx);
        removedIds.push(line.id);
        const helperIdx = pointIndexById(line.parallel.helperPoint);
        if (helperIdx !== null)
            helperPoints.push(helperIdx);
    });
    if (!lineIndices.length)
        return [];
    const remap = new Map();
    const kept = [];
    model.lines.forEach((line, idx) => {
        if (lineIndices.includes(idx)) {
            remap.set(idx, -1);
        }
        else {
            remap.set(idx, kept.length);
            kept.push(line);
        }
    });
    model.lines = kept;
    remapPolygons(remap);
    if (helperPoints.length) {
        const uniqueHelpers = Array.from(new Set(helperPoints));
        removePointsKeepingOrder(uniqueHelpers, false);
    }
    else {
        rebuildIndexMaps();
    }
    cleanupDependentPoints();
    return removedIds;
}
function removePerpendicularLinesReferencing(lineId) {
    if (!lineId)
        return [];
    const lineIndices = [];
    const helperPoints = [];
    const removedIds = [];
    model.lines.forEach((line, idx) => {
        if (!isPerpendicularLine(line))
            return;
        if (line.perpendicular.referenceLine !== lineId)
            return;
        if (line.label)
            reclaimLabel(line.label);
        lineIndices.push(idx);
        removedIds.push(line.id);
        const helperIdx = pointIndexById(line.perpendicular.helperPoint);
        if (helperIdx !== null)
            helperPoints.push(helperIdx);
    });
    if (!lineIndices.length)
        return [];
    const remap = new Map();
    const kept = [];
    model.lines.forEach((line, idx) => {
        if (lineIndices.includes(idx)) {
            remap.set(idx, -1);
        }
        else {
            remap.set(idx, kept.length);
            kept.push(line);
        }
    });
    model.lines = kept;
    remapPolygons(remap);
    if (helperPoints.length) {
        const uniqueHelpers = Array.from(new Set(helperPoints));
        removePointsKeepingOrder(uniqueHelpers, false);
    }
    else {
        rebuildIndexMaps();
    }
    cleanupDependentPoints();
    return removedIds;
}
function removePointsKeepingOrder(points, allowCleanup = true) {
    const sorted = [...points].sort((a, b) => b - a);
    sorted.forEach((idx) => {
        const point = model.points[idx];
        if (point?.label)
            reclaimLabel(point.label);
        model.points.splice(idx, 1);
        // shift point indices in remaining lines
        model.lines.forEach((line) => {
            const mapped = line.defining_points.map((pIdx) => (pIdx > idx ? pIdx - 1 : pIdx));
            line.defining_points = [mapped[0], mapped[1]];
            line.points = line.points.map((pIdx) => (pIdx > idx ? pIdx - 1 : pIdx));
        });
        // adjust circles
        model.circles = model.circles
            .map((c) => {
            if (c.center === idx)
                return null;
            if (isCircleThroughPoints(c) && c.defining_points.includes(idx))
                return null;
            if (c.radius_point === idx)
                return null;
            const center = c.center > idx ? c.center - 1 : c.center;
            const radius_point = c.radius_point > idx ? c.radius_point - 1 : c.radius_point;
            const pts = c.points
                .map((p) => (p > idx ? p - 1 : p))
                .filter((p) => p !== idx);
            if (isCircleThroughPoints(c)) {
                const defining = c.defining_points.map((p) => (p > idx ? p - 1 : p));
                return { ...c, center, radius_point, points: pts, defining_points: defining };
            }
            return { ...c, center, radius_point, points: pts };
        })
            .filter((c) => c !== null);
    });
    model.lines.forEach((_, li) => ensureSegmentStylesForLine(li));
    rebuildIndexMaps();
    if (allowCleanup)
        cleanupDependentPoints();
}
function cleanupDependentPoints() {
    const orphanIdxs = new Set();
    model.points.forEach((pt, idx) => {
        if (isMidpointPoint(pt)) {
            const missingParent = pt.midpoint.parents.some((pid) => pointIndexById(pid) === null);
            if (missingParent)
                orphanIdxs.add(idx);
        }
        if (isSymmetricPoint(pt)) {
            const sourceMissing = pointIndexById(pt.symmetric.source) === null;
            const mirrorMissing = pt.symmetric.mirror.kind === 'point'
                ? pointIndexById(pt.symmetric.mirror.id) === null
                : lineIndexById(pt.symmetric.mirror.id) === null;
            if (sourceMissing || mirrorMissing)
                orphanIdxs.add(idx);
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
function pointUsedAnywhere(idx) {
    const point = model.points[idx];
    if (!point)
        return false;
    const usedByLines = model.lines.some((line) => line.points.includes(idx));
    if (usedByLines)
        return true;
    const usedByCircles = model.circles.some((circle) => {
        if (circle.center === idx || circle.radius_point === idx)
            return true;
        return circle.points.includes(idx);
    });
    if (usedByCircles)
        return true;
    const usedByAngles = model.angles.some((angle) => angle.vertex === idx);
    if (usedByAngles)
        return true;
    const usedByPolygons = model.polygons.some((poly) => poly.lines.some((li) => {
        const line = model.lines[li];
        return !!line && line.points.includes(idx);
    }));
    if (usedByPolygons)
        return true;
    if (point.children.length > 0)
        return true;
    if (point.parent_refs.length > 0)
        return true;
    if (point.parallel_helper_for || point.perpendicular_helper_for)
        return true;
    return false;
}
function clearPointLabelIfUnused(idx) {
    const point = model.points[idx];
    if (!point?.label)
        return;
    if (pointUsedAnywhere(idx))
        return;
    reclaimLabel(point.label);
    model.points[idx] = { ...point, label: undefined };
}
function lineLength(idx) {
    const line = model.lines[idx];
    if (!line || line.points.length < 2)
        return null;
    const a = model.points[line.points[0]];
    const b = model.points[line.points[line.points.length - 1]];
    if (!a || !b)
        return null;
    return Math.hypot(b.x - a.x, b.y - a.y);
}
function circleFromThree(a, b, c) {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-6)
        return null;
    const ux = ((a.x * a.x + a.y * a.y) * (b.y - c.y) + (b.x * b.x + b.y * b.y) * (c.y - a.y) + (c.x * c.x + c.y * c.y) * (a.y - b.y)) /
        d;
    const uy = ((a.x * a.x + a.y * a.y) * (c.x - b.x) + (b.x * b.x + b.y * b.y) * (a.x - c.x) + (c.x * c.x + c.y * c.y) * (b.x - a.x)) /
        d;
    return { x: ux, y: uy };
}
function segmentKey(line, part, seg) {
    if (part === 'segment')
        return `${line}:s:${seg ?? 0}`;
    return `${line}:${part}`;
}
function hitKey(hit) {
    return segmentKey(hit.line, hit.part, hit.part === 'segment' ? hit.seg : undefined);
}
function clearSelectedSegmentsForLine(lineIdx) {
    Array.from(selectedSegments).forEach((key) => {
        const parsed = parseSegmentKey(key);
        if (parsed && parsed.line === lineIdx)
            selectedSegments.delete(key);
    });
}
function parseSegmentKey(key) {
    if (key.includes(':s:')) {
        const [lineStr, , segStr] = key.split(':');
        const line = Number(lineStr);
        const seg = Number(segStr);
        if (Number.isNaN(line) || Number.isNaN(seg))
            return null;
        return { line, part: 'segment', seg };
    }
    const [lineStr, part] = key.split(':');
    const line = Number(lineStr);
    if (Number.isNaN(line))
        return null;
    if (part === 'rayLeft' || part === 'rayRight')
        return { line, part };
    return null;
}
function lineAnchorForHit(hit) {
    const line = model.lines[hit.line];
    if (!line)
        return null;
    if (hit.part === 'segment') {
        const a = model.points[line.points[hit.seg]];
        const b = model.points[line.points[hit.seg + 1]];
        if (!a || !b)
            return null;
        return { a, b };
    }
    const firstIdx = line.points[0];
    const lastIdx = line.points[line.points.length - 1];
    const anchorIdx = hit.part === 'rayLeft' ? firstIdx : lastIdx;
    const otherIdx = hit.part === 'rayLeft' ? line.points[1] ?? lastIdx : line.points[line.points.length - 2] ?? firstIdx;
    const anchor = model.points[anchorIdx];
    const other = model.points[otherIdx];
    if (!anchor || !other)
        return null;
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
function rebuildSegmentStylesAfterInsert(line, insertAt) {
    const segCount = Math.max(0, line.points.length - 1);
    const srcStyles = line.segmentStyles?.length ? line.segmentStyles : undefined;
    const srcKeys = line.segmentKeys ?? [];
    const styles = [];
    const keys = [];
    for (let i = 0; i < segCount; i++) {
        let refIdx = i;
        if (i >= insertAt)
            refIdx = Math.max(0, i - 1);
        const base = srcStyles?.[Math.min(refIdx, (srcStyles?.length ?? 1) - 1)] ?? line.style;
        styles.push({ ...base });
        const key = segmentKeyForPoints(line.points[i], line.points[i + 1]);
        keys.push(key);
    }
    line.segmentStyles = styles;
    line.segmentKeys = keys;
}
function attachPointToLine(pointIdx, hit, click, fixedPos) {
    const line = model.lines[hit.line];
    if (!line)
        return;
    const point = model.points[pointIdx];
    if (!point)
        return;
    if (hit.part === 'segment') {
        const aIdx = line.points[hit.seg];
        const bIdx = line.points[hit.seg + 1];
        const a = model.points[aIdx];
        const b = model.points[bIdx];
        if (!a || !b)
            return;
        const proj = fixedPos ?? projectPointOnSegment(click, a, b);
        model.points[pointIdx] = { ...point, x: proj.x, y: proj.y };
        line.points.splice(hit.seg + 1, 0, pointIdx);
        const style = line.segmentStyles?.[hit.seg] ?? line.style;
        if (!line.segmentStyles)
            line.segmentStyles = [];
        line.segmentStyles.splice(hit.seg, 1, { ...style }, { ...style });
    }
    else if (hit.part === 'rayLeft' || hit.part === 'rayRight') {
        if (line.points.length < 1)
            return;
        const anchorIdx = hit.part === 'rayLeft' ? line.points[0] : line.points[line.points.length - 1];
        const otherIdx = hit.part === 'rayLeft' ? line.points[1] ?? anchorIdx : line.points[line.points.length - 2] ?? anchorIdx;
        const anchor = model.points[anchorIdx];
        const other = model.points[otherIdx];
        if (!anchor || !other)
            return;
        const dirProj = fixedPos ?? projectPointOnLine(click, anchor, other);
        model.points[pointIdx] = { ...point, x: dirProj.x, y: dirProj.y };
        if (hit.part === 'rayLeft') {
            const insertAt = Math.min(1, line.points.length);
            line.points.splice(insertAt, 0, pointIdx);
            reorderLinePoints(hit.line);
            clearSelectedSegmentsForLine(hit.line);
            selectedSegments.add(segmentKey(hit.line, 'segment', 0));
        }
        else {
            const insertAt = Math.max(line.points.length - 1, 1);
            line.points.splice(insertAt, 0, pointIdx);
            reorderLinePoints(hit.line);
            clearSelectedSegmentsForLine(hit.line);
            const segIdx = Math.max(0, line.points.length - 2);
            selectedSegments.add(segmentKey(hit.line, 'segment', segIdx));
        }
    }
    if (line.id)
        applyPointConstruction(pointIdx, [{ kind: 'line', id: line.id }]);
    ensureSegmentStylesForLine(hit.line);
    clearSelectedSegmentsForLine(hit.line);
    recomputeIntersectionPoint(pointIdx);
}
function projectPointOnSegment(p, a, b) {
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (l2 === 0)
        return { x: a.x, y: a.y };
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2));
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function projectPointOnLine(p, a, b) {
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (l2 === 0)
        return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function constrainToCircles(idx, desired) {
    const circleIdxs = circlesContainingPoint(idx);
    if (!circleIdxs.length)
        return desired;
    const circle = model.circles[circleIdxs[0]];
    const center = model.points[circle.center];
    const current = model.points[idx];
    if (!center || !current)
        return desired;
    const radius = circleRadius(circle);
    if (radius <= 0)
        return desired;
    let dir = { x: desired.x - center.x, y: desired.y - center.y };
    let len = Math.hypot(dir.x, dir.y);
    if (len < 1e-6) {
        dir = { x: current.x - center.x, y: current.y - center.y };
        len = Math.hypot(dir.x, dir.y) || 1;
    }
    const norm = { x: dir.x / len, y: dir.y / len };
    return { x: center.x + norm.x * radius, y: center.y + norm.y * radius };
}
function constrainToLineParent(idx, desired) {
    const p = model.points[idx];
    if (!p)
        return desired;
    const line = primaryLineParent(p);
    if (!line || line.points.length < 2)
        return desired;
    const a = model.points[line.points[0]];
    const b = model.points[line.points[line.points.length - 1]];
    if (!a || !b)
        return desired;
    return projectPointOnLine(desired, a, b);
}
function constrainToLineIdx(lineIdx, desired) {
    if (lineIdx === null || lineIdx === undefined)
        return desired;
    const line = model.lines[lineIdx];
    if (!line || line.points.length < 2)
        return desired;
    const a = model.points[line.points[0]];
    const b = model.points[line.points[line.points.length - 1]];
    if (!a || !b)
        return desired;
    return projectPointOnLine(desired, a, b);
}
function lineCircleIntersections(a, b, center, radius, clampToSegment = true) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const fx = a.x - center.x;
    const fy = a.y - center.y;
    const aCoeff = dx * dx + dy * dy;
    const bCoeff = 2 * (fx * dx + fy * dy);
    const cCoeff = fx * fx + fy * fy - radius * radius;
    const disc = bCoeff * bCoeff - 4 * aCoeff * cCoeff;
    if (disc < 0)
        return [];
    const sqrtDisc = Math.sqrt(disc);
    const t1 = (-bCoeff - sqrtDisc) / (2 * aCoeff);
    const t2 = (-bCoeff + sqrtDisc) / (2 * aCoeff);
    const res = [];
    [t1, t2].forEach((t) => {
        if (!Number.isFinite(t))
            return;
        if (clampToSegment && (t < 0 || t > 1))
            return;
        res.push({ x: a.x + dx * t, y: a.y + dy * t });
    });
    return res;
}
function circleCircleIntersections(c1, r1, c2, r2) {
    const d = Math.hypot(c2.x - c1.x, c2.y - c1.y);
    if (d === 0 || d > r1 + r2 || d < Math.abs(r1 - r2))
        return [];
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
function insertPointIntoLine(lineIdx, pointIdx, pos) {
    const line = model.lines[lineIdx];
    if (!line)
        return;
    if (line.points.includes(pointIdx))
        return;
    const origin = model.points[line.points[0]];
    const end = model.points[line.points[line.points.length - 1]];
    if (!origin || !end)
        return;
    const dir = normalize({ x: end.x - origin.x, y: end.y - origin.y });
    const len = Math.hypot(end.x - origin.x, end.y - origin.y) || 1;
    const tFor = (p) => ((p.x - origin.x) * dir.x + (p.y - origin.y) * dir.y) / len;
    const tNew = tFor(pos);
    const params = line.points.map((idx) => tFor(model.points[idx]));
    let insertAt = params.findIndex((t) => t > tNew + 1e-6);
    if (insertAt === -1)
        insertAt = line.points.length;
    line.points.splice(insertAt, 0, pointIdx);
    rebuildSegmentStylesAfterInsert(line, insertAt);
    clearSelectedSegmentsForLine(lineIdx);
}
function attachPointToCircle(circleIdx, pointIdx, pos) {
    const circle = model.circles[circleIdx];
    const center = model.points[circle.center];
    if (!circle || !center)
        return;
    const radius = circleRadius(circle);
    if (radius <= 0)
        return;
    const angle = Math.atan2(pos.y - center.y, pos.x - center.x);
    const target = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
    model.points[pointIdx] = { ...model.points[pointIdx], ...target };
    if (!circle.points.includes(pointIdx))
        circle.points.push(pointIdx);
    applyPointConstruction(pointIdx, [{ kind: 'circle', id: circle.id }]);
    if (selectedCircleIndex === circleIdx) {
        selectedArcSegments.clear();
    }
    recomputeIntersectionPoint(pointIdx);
}
function intersectLines(a1, a2, b1, b2) {
    const dxa = a2.x - a1.x;
    const dya = a2.y - a1.y;
    const dxb = b2.x - b1.x;
    const dyb = b2.y - b1.y;
    const denom = dxa * dyb - dya * dxb;
    if (Math.abs(denom) < 1e-6)
        return null;
    const t = ((b1.x - a1.x) * dyb - (b1.y - a1.y) * dxb) / denom;
    return { x: a1.x + dxa * t, y: a1.y + dya * t };
}
function enforceIntersections(lineIdx) {
    const line = model.lines[lineIdx];
    if (!line || line.points.length < 2)
        return;
    const a = model.points[line.points[0]];
    const b = model.points[line.points[line.points.length - 1]];
    if (!a || !b)
        return;
    line.points.forEach((pIdx) => {
        const otherLines = findLinesContainingPoint(pIdx).filter((li) => li !== lineIdx);
        if (!otherLines.length)
            return;
        otherLines.forEach((li) => {
            const other = model.lines[li];
            if (!other || other.points.length < 2)
                return;
            const oa = model.points[other.points[0]];
            const ob = model.points[other.points[other.points.length - 1]];
            if (!oa || !ob)
                return;
            const inter = intersectLines(a, b, oa, ob);
            if (inter) {
                model.points[pIdx] = { ...model.points[pIdx], ...inter };
            }
        });
    });
}
function getLineHandle(lineIdx) {
    const line = model.lines[lineIdx];
    if (!line)
        return null;
    if (line.hidden && !showHidden)
        return null;
    const raysHidden = (!line.leftRay || line.leftRay.hidden) && (!line.rightRay || line.rightRay.hidden);
    if (!raysHidden)
        return null;
    const extent = lineExtent(lineIdx);
    if (!extent)
        return null;
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
function lineExtent(lineIdx) {
    const line = model.lines[lineIdx];
    if (!line)
        return null;
    if (line.points.length < 2)
        return null;
    const a = model.points[line.points[0]];
    const b = model.points[line.points[line.points.length - 1]];
    if (!a || !b)
        return null;
    const dirVec = { x: b.x - a.x, y: b.y - a.y };
    const len = Math.hypot(dirVec.x, dirVec.y) || 1;
    const dir = { x: dirVec.x / len, y: dirVec.y / len };
    const base = a;
    const projections = [];
    line.points.forEach((idx) => {
        if (!projections.some((p) => p.idx === idx)) {
            const p = model.points[idx];
            if (p)
                projections.push({ idx, proj: (p.x - base.x) * dir.x + (p.y - base.y) * dir.y });
        }
    });
    if (!projections.length)
        return null;
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
function enforceAxisAlignment(lineIdx, axis) {
    const line = model.lines[lineIdx];
    if (!line)
        return;
    const refPoints = line.points
        .map((idx) => model.points[idx])
        .filter((pt) => !!pt);
    if (!refPoints.length)
        return;
    const movable = line.points.filter((idx) => {
        const pt = model.points[idx];
        if (!pt)
            return false;
        if (!isPointDraggable(pt))
            return false;
        if (circlesWithCenter(idx).length > 0)
            return false;
        return true;
    });
    if (!movable.length)
        return;
    const axisValue = axis === 'horizontal'
        ? refPoints.reduce((sum, p) => sum + p.y, 0) / refPoints.length
        : refPoints.reduce((sum, p) => sum + p.x, 0) / refPoints.length;
    const moved = new Set();
    movable.forEach((idx) => {
        const pt = model.points[idx];
        if (!pt)
            return;
        if (axis === 'horizontal') {
            if (pt.y !== axisValue) {
                model.points[idx] = { ...pt, y: axisValue };
                moved.add(idx);
            }
        }
        else if (pt.x !== axisValue) {
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
function polygonForLine(lineIdx) {
    for (let i = 0; i < model.polygons.length; i++) {
        if (model.polygons[i].lines.includes(lineIdx))
            return i;
    }
    return null;
}
function polygonHasPoint(pointIdx, poly) {
    if (!poly)
        return false;
    return poly.lines.some((li) => {
        const line = model.lines[li];
        return !!line && line.points.includes(pointIdx);
    });
}
function polygonVertices(polyIdx) {
    const poly = model.polygons[polyIdx];
    const pts = new Set();
    poly.lines.forEach((li) => model.lines[li]?.points.forEach((p) => pts.add(p)));
    return Array.from(pts);
}
function polygonVerticesOrdered(polyIdx) {
    const lines = model.polygons[polyIdx]?.lines ?? [];
    const verts = [];
    lines.forEach((li) => {
        const line = model.lines[li];
        if (!line)
            return;
        const start = line.points[0];
        const end = line.points[line.points.length - 1];
        verts.push(start, end);
    });
    const uniqueVerts = Array.from(new Set(verts));
    const points = uniqueVerts.map((idx) => ({ idx, p: model.points[idx] })).filter((v) => !!v.p);
    if (!points.length)
        return [];
    const centroid = {
        x: points.reduce((s, v) => s + v.p.x, 0) / points.length,
        y: points.reduce((s, v) => s + v.p.y, 0) / points.length
    };
    points.sort((a, b) => Math.atan2(a.p.y - centroid.y, a.p.x - centroid.x) - Math.atan2(b.p.y - centroid.y, b.p.x - centroid.x));
    const startIdx = points.reduce((best, cur, i) => {
        const bestPt = points[best].p;
        const curPt = cur.p;
        if (curPt.y > bestPt.y + 1e-6)
            return i;
        if (Math.abs(curPt.y - bestPt.y) < 1e-6 && curPt.x < bestPt.x)
            return i;
        return best;
    }, 0);
    const ordered = [];
    for (let i = 0; i < points.length; i++) {
        const idx = (startIdx - i + points.length) % points.length;
        ordered.push(points[idx].idx);
    }
    return ordered;
}
function ensurePolygonClosed(poly) {
    // Jeśli za mało linii – nic nie robimy (prawdziwy wielokąt wymaga >=2 linii do sensownego sprawdzenia)
    if (poly.lines.length < 2)
        return poly;
    // Zbuduj ciąg wierzchołków na podstawie kolejności linii.
    const verts = [];
    for (const li of poly.lines) {
        const line = model.lines[li];
        if (!line || line.defining_points.length < 2)
            continue;
        const s = line.defining_points[0];
        const e = line.defining_points[1];
        if (verts.length === 0) {
            verts.push(s, e);
        }
        else {
            const last = verts[verts.length - 1];
            if (s === last) {
                verts.push(e);
            }
            else if (e === last) {
                verts.push(s);
            }
            else {
                // próba dopięcia od przodu
                const first = verts[0];
                if (e === first) {
                    verts.unshift(s);
                }
                else if (s === first) {
                    verts.unshift(e);
                }
                else {
                    // rozłączna linia – pozostawiamy (może być chwilowo po remapie); ignorujemy w domykaniu
                }
            }
        }
    }
    // Usuwamy ewentualne duplikaty następujące po sobie (jeśli wstawiono identyczny punkt dwa razy).
    const orderedVerts = [];
    for (let i = 0; i < verts.length; i++) {
        if (i === 0 || verts[i] !== verts[i - 1])
            orderedVerts.push(verts[i]);
    }
    if (orderedVerts.length < 3 || (orderedVerts[orderedVerts.length - 1] == orderedVerts[0]))
        return poly; // domknięty lub za mało wierzchołków na sensowny wielokąt
    // Pomocniczo: sprawdzenie czy istnieje linia między dwoma punktami.
    const hasEdge = (a, b) => poly.lines.some((li) => {
        const line = model.lines[li];
        if (!line || line.defining_points.length < 2)
            return false;
        const s = line.defining_points[0];
        const e = line.defining_points[1];
        return (s === a && e === b) || (s === b && e === a);
    });
    // Styl bazowy dla nowych linii (pierwsza istniejąca albo domyślny).
    const baseStyle = (() => {
        for (const li of poly.lines) {
            const line = model.lines[li];
            if (line)
                return { ...line.style };
        }
        return currentStrokeStyle();
    })();
    const newLineIndices = [];
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
    if (newLineIndices.length === 0)
        return poly;
    return { ...poly, lines: [...poly.lines, ...newLineIndices] };
}
function remapPolygons(lineRemap) {
    const remapped = model.polygons
        .map((poly) => {
        const lines = poly.lines
            .map((li) => lineRemap.get(li))
            .filter((v) => v !== undefined && v >= 0);
        return {
            object_type: 'polygon',
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
function lineIndexById(id) {
    const idx = model.indexById.line[id];
    return Number.isInteger(idx) ? idx : null;
}
function pointIndexById(id) {
    const idx = model.points.findIndex((p) => p.id === id);
    return idx >= 0 ? idx : null;
}
function anyIndexById(id) {
    const kinds = ['point', 'line', 'circle', 'angle', 'polygon'];
    for (const k of kinds) {
        const mapIdx = model.indexById[k][id];
        if (Number.isInteger(mapIdx))
            return { kind: k, idx: mapIdx };
    }
    return null;
}
function friendlyLabelForId(id) {
    const resolved = anyIndexById(id);
    if (!resolved)
        return '?';
    // if (!resolved) return id;
    const prefix = LABEL_PREFIX[resolved.kind] ?? '';
    return `${prefix}${resolved.idx + 1}`;
}
function primaryLineParent(p) {
    const lp = p.parent_refs.find((pr) => pr.kind === 'line');
    if (!lp)
        return null;
    const idx = lineIndexById(lp.id);
    if (idx === null)
        return null;
    return model.lines[idx] ?? null;
}
function ensureSegmentStylesForLine(lineIdx) {
    const line = model.lines[lineIdx];
    if (!line)
        return;
    const segCount = Math.max(0, line.points.length - 1);
    const srcStyles = line.segmentStyles ?? [];
    const srcKeys = line.segmentKeys ?? [];
    const styles = [];
    const keys = [];
    for (let i = 0; i < segCount; i++) {
        const key = segmentKeyForPoints(line.points[i], line.points[i + 1]);
        const existingIdx = srcKeys.indexOf(key);
        const base = (existingIdx >= 0 ? srcStyles[existingIdx] : srcStyles[Math.min(i, srcStyles.length - 1)]) ?? line.style;
        styles.push({ ...base });
        keys.push(key);
    }
    line.segmentStyles = styles;
    line.segmentKeys = keys;
}
function reorderLinePoints(lineIdx) {
    const line = model.lines[lineIdx];
    if (!line)
        return;
    const aIdx = line.defining_points?.[0] ?? line.points[0];
    const bIdx = line.defining_points?.[1] ?? line.points[line.points.length - 1];
    const a = model.points[aIdx];
    const b = model.points[bIdx];
    if (!a || !b)
        return;
    const dir = normalize({ x: b.x - a.x, y: b.y - a.y });
    const unique = Array.from(new Set(line.points));
    const others = unique.filter((p) => p !== aIdx && p !== bIdx);
    others.sort((p1, p2) => {
        const pt1 = model.points[p1];
        const pt2 = model.points[p2];
        if (!pt1 || !pt2)
            return 0;
        const t1 = (pt1.x - a.x) * dir.x + (pt1.y - a.y) * dir.y;
        const t2 = (pt2.x - a.x) * dir.x + (pt2.y - a.y) * dir.y;
        return t1 - t2;
    });
    line.points = [aIdx, ...others, bIdx];
    ensureSegmentStylesForLine(lineIdx);
}
function applyDebugPanelPosition() {
    if (!debugPanel || !debugPanelPos)
        return;
    debugPanel.style.left = `${debugPanelPos.x}px`;
    debugPanel.style.top = `${debugPanelPos.y}px`;
}
function ensureDebugPanelPosition() {
    if (!debugPanel || debugPanel.style.display === 'none')
        return;
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
    }
    else {
        debugPanelPos = {
            x: clamp(debugPanelPos.x, DEBUG_PANEL_MARGIN.x, maxX),
            y: clamp(debugPanelPos.y, DEBUG_PANEL_TOP_MIN, maxY)
        };
    }
    applyDebugPanelPosition();
}
function endDebugPanelDrag(pointerId) {
    if (!debugDragState)
        return;
    if (pointerId !== undefined && debugDragState.pointerId !== pointerId)
        return;
    try {
        debugPanelHeader?.releasePointerCapture(debugDragState.pointerId);
    }
    catch (err) {
        // ignore
    }
    debugPanel?.classList.remove('debug-panel--dragging');
    debugDragState = null;
}
function renderDebugPanel() {
    if (!debugPanel || !debugContent)
        return;
    if (!debugVisible) {
        debugPanel.style.display = 'none';
        debugPanel.setAttribute('aria-hidden', 'true');
        endDebugPanelDrag();
        return;
    }
    debugPanel.style.display = 'flex';
    debugPanel.setAttribute('aria-hidden', 'false');
    const sections = [];
    const fmtList = (items) => (items.length ? items.join(', ') : '');
    const setPart = (ids, joiner = ', ') => (ids.length ? ids.map(friendlyLabelForId).join(joiner) : '');
    const fmtPoint = (p) => {
        const coords = ` <span style="color:#9ca3af;">(${p.x.toFixed(1)}, ${p.y.toFixed(1)})</span>`;
        const parentLabels = (p.parent_refs ?? []).map((pr) => friendlyLabelForId(pr.id));
        const parentsInfo = (() => {
            if (!parentLabels.length)
                return '';
            if (p.construction_kind === 'intersection' && parentLabels.length === 2) {
                return ` <span style="color:#9ca3af;">${parentLabels[0]} ∩ ${parentLabels[1]}</span>`;
            }
            // Don't show parents for on_object - they'll be shown in kindInfo with ∈ symbol
            if (p.construction_kind === 'on_object')
                return '';
            return ` <span style="color:#9ca3af;">${parentLabels.join(', ')}</span>`;
        })();
        const kindInfo = (() => {
            if (!p.construction_kind || p.construction_kind === 'free' || p.construction_kind === 'intersection')
                return '';
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
        sections.push(`<div style="margin-bottom:12px;"><div style="font-weight:600;margin-bottom:4px;">Punkty (${ptRows.length})</div><div>${ptRows
            .map((r) => `<div style="margin-bottom:3px;line-height:1.4;">${r}</div>`)
            .join('')}</div></div>`);
    }
    const lineRows = model.lines.map((l) => {
        const isParallel = isParallelLine(l);
        const isPerpendicular = isPerpendicularLine(l);
        const defLabelsRaw = l.defining_points
            .map((pi) => model.points[pi]?.id)
            .filter((id) => !!id);
        const children = setPart(l.children);
        const incident = model.points
            .map((p) => (p.parent_refs.some((pr) => pr.kind === 'line' && pr.id === l.id) ? friendlyLabelForId(p.id) : null))
            .filter((v) => !!v && !defLabelsRaw.includes(v));
        const anchorId = isParallel ? l.parallel.throughPoint : isPerpendicular ? l.perpendicular.throughPoint : null;
        const helperId = isParallel ? l.parallel.helperPoint : isPerpendicular ? l.perpendicular.helperPoint : null;
        const defLabels = anchorId && helperId
            ? [friendlyLabelForId(anchorId), friendlyLabelForId(helperId)]
            : defLabelsRaw.map((id) => friendlyLabelForId(id));
        const referenceId = isParallel
            ? l.parallel.referenceLine
            : isPerpendicular
                ? l.perpendicular.referenceLine
                : null;
        const relationSymbol = isParallel ? '∥' : isPerpendicular ? '⊥' : '';
        const defPart = anchorId && helperId ? `[${defLabels[0]}, ${defLabels[1]}]` : `[${defLabels.join(', ')}]`;
        const incidentTail = incident.length && !isParallel && !isPerpendicular ? ` {${incident.join(', ')}}` : '';
        const childTail = children ? ` <span style="color:#9ca3af;">↘ ${children}</span>` : '';
        const relationTail = relationSymbol && referenceId
            ? ` ${relationSymbol} ${friendlyLabelForId(referenceId)}`
            : '';
        return `<div style="margin-bottom:3px;line-height:1.4;">${friendlyLabelForId(l.id)} ${defPart}${relationTail}${incidentTail}${childTail}</div>`;
    });
    if (lineRows.length) {
        sections.push(`<div style="margin-bottom:12px;"><div style="font-weight:600;margin-bottom:4px;">Linie (${lineRows.length})</div>${lineRows.join('')}</div>`);
    }
    const circleRows = model.circles.map((c) => {
        const center = model.points[c.center];
        const centerLabel = center ? friendlyLabelForId(center.id) : `p${c.center}`;
        const parents = setPart(c.defining_parents);
        const children = setPart(c.children);
        const meta = parents || children
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
        sections.push(`<div style="margin-bottom:12px;"><div style="font-weight:600;margin-bottom:4px;">Okręgi (${circleRows.length})</div>${circleRows.join('')}</div>`);
    }
    const polyRows = model.polygons.map((p) => {
        const lines = p.lines.map((li) => friendlyLabelForId(model.lines[li]?.id ?? `l${li}`)).join(', ');
        const parents = setPart(p.defining_parents);
        const children = setPart(p.children);
        const meta = parents || children
            ? ` <span style="color:#9ca3af;">${[parents && `⊂ ${parents}`, children && `↘ ${children}`]
                .filter(Boolean)
                .join(' • ')}</span>`
            : '';
        return `<div style="margin-bottom:3px;line-height:1.4;">${friendlyLabelForId(p.id)} [${lines}${meta}]</div>`;
    });
    if (polyRows.length) {
        sections.push(`<div style="margin-bottom:12px;"><div style="font-weight:600;margin-bottom:4px;">Wielokąty (${polyRows.length})</div>${polyRows.join('')}</div>`);
    }
    const angleRows = model.angles.map((a) => {
        const vertexLabel = friendlyLabelForId(model.points[a.vertex]?.id ?? `p${a.vertex}`);
        const parents = setPart(a.defining_parents);
        const children = setPart(a.children);
        const meta = parents || children
            ? ` <span style="color:#9ca3af;">${[parents && `⊂ ${parents}`, children && `↘ ${children}`]
                .filter(Boolean)
                .join(' • ')}</span>`
            : '';
        return `<div style="margin-bottom:3px;line-height:1.4;">${friendlyLabelForId(a.id)} vertex: ${vertexLabel}${meta}</div>`;
    });
    if (angleRows.length) {
        sections.push(`<div style="margin-bottom:12px;"><div style="font-weight:600;margin-bottom:4px;">Kąty (${angleRows.length})</div>${angleRows.join('')}</div>`);
    }
    debugContent.innerHTML = sections.length
        ? sections.join('')
        : '<div style="color:#9ca3af;">Brak obiektów do wyświetlenia.</div>';
    requestAnimationFrame(() => ensureDebugPanelPosition());
}
function drawDebugLabels() {
    if (!debugVisible || !ctx)
        return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, panOffset.x * dpr, panOffset.y * dpr);
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'middle';
    const drawTag = (pos, text) => {
        ctx.save();
        const screenPos = worldToCanvas(pos.x, pos.y);
        ctx.translate(screenPos.x, screenPos.y);
        const padding = 4;
        const metrics = ctx.measureText(text);
        const w = metrics.width + padding * 2;
        const h = 16;
        ctx.fillStyle = 'rgba(17,24,39,0.8)';
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e5e7eb';
        ctx.fillText(text, -metrics.width / 2, 0);
        ctx.restore();
    };
    model.points.forEach((p) => {
        if (p.style.hidden && !showHidden)
            return;
        const topOffset = pointRadius(p.style.size) / zoomFactor + screenUnits(10);
        drawTag({ x: p.x, y: p.y - topOffset }, friendlyLabelForId(p.id));
    });
    model.lines.forEach((l, idx) => {
        if (l.hidden && !showHidden)
            return;
        const ext = lineExtent(idx);
        if (!ext)
            return;
        drawTag({ x: ext.center.x, y: ext.center.y - screenUnits(10) }, friendlyLabelForId(l.id));
    });
    model.circles.forEach((c) => {
        if (c.hidden && !showHidden)
            return;
        const center = model.points[c.center];
        if (!center)
            return;
        const radius = circleRadius(c);
        drawTag({ x: center.x, y: center.y - radius - screenUnits(10) }, friendlyLabelForId(c.id));
    });
    model.angles.forEach((a) => {
        const v = model.points[a.vertex];
        if (!v)
            return;
        drawTag({ x: v.x + screenUnits(12), y: v.y + screenUnits(12) }, friendlyLabelForId(a.id));
    });
    model.polygons.forEach((p, idx) => {
        const centroid = polygonCentroid(idx);
        if (!centroid)
            return;
        drawTag(centroid, friendlyLabelForId(p.id));
    });
    ctx.restore();
}
function recomputeIntersectionPoint(pointIdx) {
    const point = model.points[pointIdx];
    if (!point || point.parent_refs.length !== 2)
        return;
    const [pa, pb] = point.parent_refs;
    const finalize = () => updateMidpointsForPoint(pointIdx);
    const styleWithHidden = (target, hidden) => {
        const currentHidden = target.style.hidden ?? false;
        if (hidden === currentHidden)
            return target.style;
        return { ...target.style, hidden };
    };
    // line-line
    if (pa.kind === 'line' && pb.kind === 'line') {
        const lineAIdx = lineIndexById(pa.id);
        const lineBIdx = lineIndexById(pb.id);
        if (lineAIdx === null || lineBIdx === null)
            return;
        const lineA = model.lines[lineAIdx];
        const lineB = model.lines[lineBIdx];
        if (!lineA || !lineB || lineA.points.length < 2 || lineB.points.length < 2)
            return;
        const a1 = model.points[lineA.points[0]];
        const a2 = model.points[lineA.points[lineA.points.length - 1]];
        const b1 = model.points[lineB.points[0]];
        const b2 = model.points[lineB.points[lineB.points.length - 1]];
        if (!a1 || !a2 || !b1 || !b2)
            return;
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
        if (lineIdx === null || circleIdx === undefined)
            return;
        const line = model.lines[lineIdx];
        const circle = model.circles[circleIdx];
        if (!line || !circle || line.points.length < 2)
            return;
        const a = model.points[line.points[0]];
        const b = model.points[line.points[line.points.length - 1]];
        const center = model.points[circle.center];
        const radius = circleRadius(circle);
        if (!a || !b || !center || radius <= 0)
            return;
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
        if (circleAIdx === undefined || circleBIdx === undefined)
            return;
        const circleA = model.circles[circleAIdx];
        const circleB = model.circles[circleBIdx];
        if (!circleA || !circleB)
            return;
        const centerA = model.points[circleA.center];
        const centerB = model.points[circleB.center];
        const radiusA = circleRadius(circleA);
        const radiusB = circleRadius(circleB);
        if (!centerA || !centerB || radiusA <= 0 || radiusB <= 0)
            return;
        const pts = circleCircleIntersections(centerA, radiusA, centerB, radiusB);
        const shareSameParentPair = (other) => {
            if (other.parent_refs.length !== 2)
                return false;
            const circles = other.parent_refs.filter((pr) => pr.kind === 'circle');
            if (circles.length !== 2)
                return false;
            const ids = circles.map((pr) => pr.id);
            return ids.includes(pa.id) && ids.includes(pb.id);
        };
        const siblingIdxs = model.points
            .map((other, idx) => (idx !== pointIdx && other && other.construction_kind === 'intersection' && shareSameParentPair(other) ? idx : null))
            .filter((idx) => idx !== null);
        const groupIdxs = [pointIdx, ...siblingIdxs].filter((idx, i, arr) => arr.indexOf(idx) === i);
        if (!pts.length) {
            groupIdxs.forEach((idx) => {
                const target = model.points[idx];
                if (!target)
                    return;
                model.points[idx] = { ...target, style: styleWithHidden(target, true) };
            });
            finalize();
            return;
        }
        if (pts.length === 1) {
            const pos = pts[0];
            groupIdxs.forEach((idx) => {
                const target = model.points[idx];
                if (!target)
                    return;
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
                const dist = (pt, pos) => Math.hypot(pt.x - pos.x, pt.y - pos.y);
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
                        if (!target)
                            return;
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
function updateIntersectionsForLine(lineIdx) {
    const line = model.lines[lineIdx];
    if (!line)
        return;
    const lineId = line.id;
    model.points.forEach((_, pi) => {
        const pt = model.points[pi];
        if (!pt)
            return;
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
function updateIntersectionsForCircle(circleIdx) {
    const circle = model.circles[circleIdx];
    if (!circle)
        return;
    const cid = circle.id;
    model.points.forEach((pt, pi) => {
        if (!pt)
            return;
        if (pt.parent_refs.some((pr) => pr.kind === 'circle' && pr.id === cid)) {
            if (pt.construction_kind === 'intersection') {
                recomputeIntersectionPoint(pi);
            }
            else {
                const constrained = constrainToCircles(pi, constrainToLineParent(pi, { x: pt.x, y: pt.y }));
                model.points[pi] = { ...pt, ...constrained };
                updateMidpointsForPoint(pi);
            }
        }
    });
}
function findHandle(p) {
    for (let i = model.lines.length - 1; i >= 0; i--) {
        const handle = getLineHandle(i);
        if (!handle)
            continue;
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
//# sourceMappingURL=main.js.map