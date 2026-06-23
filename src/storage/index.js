const SETS_KEY       = 'wt_sets';
const EXER_KEY       = 'wt_exercises';
const PRESCRIBED_KEY = 'wt_prescribed';
const SETTINGS_KEY   = 'wt_settings';

export function loadSettings() {
  try { return { showBodyweightProgress: false, showBodyweightDiet: false, weightUnit: 'lb', distUnit: 'mi', sprintUnit: 'yd', powerUnit: 'ft', theme: 'DEFAULT', ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }; }
  catch { return { showBodyweightProgress: false, showBodyweightDiet: false, weightUnit: 'lb', distUnit: 'mi', sprintUnit: 'yd', powerUnit: 'ft', theme: 'DEFAULT' }; }
}
export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export const DEFAULT_EXERCISES = [
  // Strength
  { name: 'Bench press',         type: 'strength'   },
  { name: 'Incline bench press', type: 'strength'   },
  { name: 'Squat',               type: 'strength'   },
  { name: 'Front squat',         type: 'strength'   },
  { name: 'Deadlift',            type: 'strength'   },
  { name: 'Romanian deadlift',   type: 'strength'   },
  { name: 'OHP',                 type: 'strength'   },
  { name: 'Barbell row',                      type: 'strength'   },
  { name: 'Barbell rows supinated',           type: 'strength'   },
  { name: 'Dumbbell rows',                    type: 'strength'   },
  { name: 'Chest supported dumbbell rows',    type: 'strength'   },
  { name: 'Chest supported T-bar rows',       type: 'strength'   },
  { name: 'Lat pulldown',                     type: 'strength'   },
  { name: 'Cable row',           type: 'strength'   },
  { name: 'Leg press',           type: 'strength'   },
  { name: 'Leg curl',            type: 'strength'   },
  { name: 'Leg extension',       type: 'strength'   },
  { name: 'Hip thrust',          type: 'strength'   },
  { name: 'Calf raise',          type: 'strength'   },
  { name: 'Dumbbell curl',       type: 'strength'   },
  { name: 'Skull crusher',       type: 'strength'   },
  { name: 'Tricep pushdown',     type: 'strength'   },
  { name: 'Face pull',           type: 'strength'   },
  { name: 'Shrug',               type: 'strength'   },
  // Olympic lifts
  { name: 'Clean',              type: 'strength'   },
  { name: 'Hang clean',         type: 'strength'   },
  { name: 'Power clean',        type: 'strength'   },
  { name: 'Clean pull',         type: 'strength'   },
  { name: 'Clean high pull',    type: 'strength'   },
  { name: 'Snatch',             type: 'strength'   },
  { name: 'Hang snatch',        type: 'strength'   },
  { name: 'Power snatch',       type: 'strength'   },
  { name: 'Snatch pull',        type: 'strength'   },
  { name: 'Snatch high pull',   type: 'strength'   },
  { name: 'Jerk',               type: 'strength'   },
  { name: 'Rack jerk',          type: 'strength'   },
  { name: 'Squat jerk',         type: 'strength'   },
  { name: 'Overhead squat',     type: 'strength'   },
  // Bodyweight
  { name: 'Pull-ups',            type: 'bodyweight' },
  { name: 'Chin-ups',            type: 'bodyweight' },
  { name: 'Push-ups',            type: 'bodyweight' },
  { name: 'Dips',                type: 'bodyweight' },
  { name: 'Inverted rows',       type: 'bodyweight' },
  { name: 'Burpees',             type: 'bodyweight' },
  // Power — distance-based throws, jumps, bounds
  { name: 'Broad jump',          type: 'power'      },
  { name: 'Triple broad jump',   type: 'power'      },
  { name: 'Box jump',            type: 'power'      },
  { name: 'Vertical jump',       type: 'power'      },
  { name: 'Medball throw',       type: 'power'      },
  { name: 'Medball chest pass',  type: 'power'      },
  { name: 'Medball overhead throw', type: 'power'   },
  { name: 'Medball rotational throw', type: 'power' },
  { name: 'Standing long jump',  type: 'power'      },
  { name: 'Interval Sprints 100m',  type: 'sprint'    },
  // Cardio
  { name: 'Running',             type: 'cardio'     },
  { name: 'Rowing',              type: 'cardio'     },
  { name: 'Walking',             type: 'cardio'     },
  { name: 'Swimming',            type: 'cardio'     },
  { name: 'Jump rope',           type: 'jumprope'   },
  { name: 'Rowing machine',      type: 'cardio'     },
  { name: 'Elliptical',          type: 'cardio'     },
  // Cycling
  { name: 'Cycling',             type: 'cycling'    },
];

export function loadSets() {
  try { return JSON.parse(localStorage.getItem(SETS_KEY)) || []; }
  catch { return []; }
}

export function saveSets(sets) {
  localStorage.setItem(SETS_KEY, JSON.stringify(sets));
}

export function addSet(set) {
  const sets = loadSets();
  const updated = [...sets, set];
  saveSets(updated);
  return updated;
}

export function updateSet(id, newVals) {
  const sets = loadSets();
  const updated = sets.map(s => s.id === id ? { ...s, vals: { ...s.vals, ...newVals } } : s);
  saveSets(updated);
  return updated;
}

export function deleteSet(id) {
  const updated = loadSets().filter(s => s.id !== id);
  saveSets(updated);
  return updated;
}

export function loadExercises() {
  try {
    const stored = JSON.parse(localStorage.getItem(EXER_KEY));
    if (!stored) return DEFAULT_EXERCISES.map(e => ({ ...e, origin: 'default' }));
    // Backfill origin for entries saved before origin tagging existed
    return stored.map(e => e.origin ? e : { ...e, origin: DEFAULT_EXERCISES.some(d => d.name === e.name) ? 'default' : 'coach' });
  } catch { return DEFAULT_EXERCISES.map(e => ({ ...e, origin: 'default' })); }
}

export function saveExercises(exs) {
  localStorage.setItem(EXER_KEY, JSON.stringify(exs));
}

// ── Custom exercise library ─────────────────────────────────────────────────
// Custom exercises are user-added/edited/deleted only. Default and coach-imported
// exercises are never exposed for deletion through this API.
export function addCustomExercise({ name, type }) {
  const exs = loadExercises();
  if (exs.some(e => e.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('An exercise with this name already exists');
  }
  const updated = [...exs, { name, type, origin: 'custom' }];
  saveExercises(updated);
  return updated;
}

export function updateCustomExercise(origName, { name, type }) {
  const exs = loadExercises();
  const target = exs.find(e => e.name === origName);
  if (!target || target.origin !== 'custom') throw new Error('Only custom exercises can be edited');
  const updated = exs.map(e => e.name === origName ? { ...e, name, type } : e);
  saveExercises(updated);
  return updated;
}

export function deleteCustomExercise(name) {
  const exs = loadExercises();
  const target = exs.find(e => e.name === name);
  if (!target || target.origin !== 'custom') throw new Error('Only custom exercises can be deleted');
  const updated = exs.filter(e => e.name !== name);
  saveExercises(updated);
  return updated;
}

export const FIELD_DEFS = {
  strength:   [
    { fields: [{ id:'weight',label:'Weight',ph:'185' },{ id:'reps',label:'Reps',ph:'8' }] },
    { fields: [{ id:'rest',label:'Rest',ph:'90' },{ id:'rpe',label:'RPE',ph:'8' }] },
  ],
  bodyweight: [
    { fields: [{ id:'reps',label:'Reps',ph:'10' },{ id:'rest',label:'Rest',ph:'60' }] },
    { fields: [{ id:'added',label:'Added wt',ph:'0' },{ id:'rpe',label:'RPE',ph:'7' }] },
  ],
  cardio: [
    { fields: [{ id:'dist',label:'Distance (mi)',ph:'3.1' },{ id:'dur',label:'Duration (min)',ph:'28' }] },
    { fields: [{ id:'pace',label:'Pace (min/mi)',ph:'9:00' },{ id:'hr',label:'Avg HR',ph:'155' },{ id:'cal',label:'Calories',ph:'300' }] },
  ],
  sprint: [
    { fields: [{ id:'stime',label:'Time (sec)',ph:'4.45' },{ id:'sdist',label:'Distance',ph:'100' },{ id:'reps',label:'Reps',ph:'7' }] },
    { fields: [{ id:'wind',label:'Wind (mph)',ph:'0.0' },{ id:'surf',label:'Surface',ph:'Track' }] },
  ],
  cycling: [
    { fields: [{ id:'dist',label:'Distance (mi)',ph:'12' },{ id:'dur',label:'Duration (min)',ph:'45' }] },
    { fields: [{ id:'speed',label:'Speed (mph)',ph:'16' },{ id:'power',label:'Power (W)',ph:'220' },{ id:'elev',label:'Elev (ft)',ph:'400' }] },
  ],
  jumprope: [
    { fields: [{ id:'reps',label:'Jumps',ph:'100' },{ id:'dur',label:'Duration (min)',ph:'3' }] },
    { fields: [{ id:'rest',label:'Rest',ph:'60' },{ id:'rpe',label:'RPE',ph:'7' }] },
  ],
  power: [
    { fields: [{ id:'reps',label:'Reps',ph:'5' },{ id:'pdist',label:'Distance/Height',ph:'9.5' }] },
    { fields: [{ id:'rest',label:'Rest (sec)',ph:'90' },{ id:'rpe',label:'RPE',ph:'7' }] },
  ],
};

export const METRIC_DEFS = {
  strength:   ['weight','reps','volume','rpe'],
  bodyweight: ['reps','added','volume','rpe'],
  cardio:     ['dist','dur','hr'],
  sprint:     ['stime'],
  cycling:    ['dist','dur','speed','power'],
  jumprope:   ['reps','dur','rpe'],
  power:      ['pdist','reps','rpe'],
};

export const METRIC_LABELS = {
  weight:'Weight (lb)',reps:'Reps',volume:'Volume',rpe:'RPE',
  added:'Added (lb)',dist:'Distance (mi)',dur:'Duration (min)',
  pace:'Pace',hr:'Avg HR',cal:'Calories',
  stime:'Time (sec)',sdist:'Distance',wind:'Wind',surf:'Surface',
  speed:'Speed (mph)',power:'Power (W)',elev:'Elevation (ft)',
  pdist:'Distance',
};

// Volume = weight × reps per set (handles eachSide "e" suffix)
export function calcSetVolume(set) {
  const weight = parseFloat(set.vals.weight) || parseFloat(set.vals.added) || 0;
  const repsRaw = String(set.vals.reps || '0');
  const reps = parseInt(repsRaw.match(/\d+/)?.[0]) || 0;
  const eachSide = /e$|each/i.test(repsRaw);
  return weight * reps * (eachSide ? 2 : 1);
}

export const PR_METRIC = {
  strength:'weight', bodyweight:'reps', cardio:'dist', sprint:'stime', cycling:'dist', jumprope:'reps', power:'pdist',
};

export const SPRINT_DISTANCES = ['40yd Dash','100m','200m','400m','1 Mile'];

// ── PR logic ──────────────────────────────────────────────────────────────────
// A set is a PR only if its value is strictly greater than ALL previous sets
// (not just the current max — equal doesn't count).
// For strength: tracks weight PR and reps PR separately.
// Returns { weightPR, repsPR } for strength, or { pr } for other types.

export function getStrengthPRs(sets, exerciseName) {
  const exSets = sets
    .filter(s => s.ex === exerciseName && s.type === 'strength')
    .sort((a, b) => a.id - b.id); // chronological

  let bestWeight = -Infinity;
  let bestReps   = -Infinity;
  const weightPRs = new Set();
  const repsPRs   = new Set();

  exSets.forEach(s => {
    const w = parseFloat(s.vals.weight);
    const r = parseFloat(s.vals.reps);
    if (!isNaN(w) && w > bestWeight) { bestWeight = w; weightPRs.add(s.id); }
    if (!isNaN(r) && r > bestReps)   { bestReps   = r; repsPRs.add(s.id);   }
  });

  return {
    weightPRs,
    repsPRs,
    bestWeight: bestWeight === -Infinity ? null : bestWeight,
    bestReps:   bestReps   === -Infinity ? null : bestReps,
  };
}

export function getPRsForSet(allPRData, set) {
  // Returns array of PR label strings for a given set
  if (!allPRData) return [];
  const labels = [];
  if (allPRData.weightPRs && allPRData.weightPRs.has(set.id)) labels.push('Weight PR');
  if (allPRData.repsPRs   && allPRData.repsPRs.has(set.id))   labels.push('Reps PR');
  if (allPRData.distPRs   && allPRData.distPRs.has(set.id))   labels.push('Distance PR');
  if (allPRData.timePRs   && allPRData.timePRs.has(set.id))   labels.push('Time PR');
  return labels;
}

export function getGenericPRs(sets, exerciseName, type) {
  // For non-strength: single metric PR (strictly greater than prior best)
  const met = PR_METRIC[type] || 'dist';
  const isTime = type === 'sprint';
  const exSets = sets
    .filter(s => s.ex === exerciseName && s.type === type)
    .sort((a, b) => a.id - b.id);

  let best = isTime ? Infinity : -Infinity;
  const prSet = new Set();

  exSets.forEach(s => {
    const v = parseFloat(s.vals[met]);
    if (isNaN(v)) return;
    if (isTime  ? v < best : v > best) { best = v; prSet.add(s.id); }
  });

  return { prSet, best: (best === Infinity || best === -Infinity) ? null : best };
}

// Best single-session volume for an exercise (strength + bodyweight only)
export function getVolumePR(sets, exerciseName) {
  const exSets = sets.filter(s =>
    s.ex === exerciseName &&
    (s.type === 'strength' || s.type === 'bodyweight')
  );
  if (!exSets.length) return null;
  const byDate = {};
  exSets.forEach(s => {
    const vol = calcSetVolume(s);
    if (vol > 0) byDate[s.date] = (byDate[s.date] || 0) + vol;
  });
  const sessions = Object.values(byDate);
  if (!sessions.length) return null;
  const best = Math.max(...sessions);
  return { val: best.toLocaleString() + ' lb', label: 'Volume PR' };
}

// Backward-compatible single PR summary for the PR strip at top of History
export function getPR(sets, exerciseName) {
  const pts = sets.filter(s => s.ex === exerciseName);
  if (!pts.length) return null;
  const type = pts[0].type;

  if (type === 'strength') {
    const { bestWeight, bestReps } = getStrengthPRs(sets, exerciseName);
    if (bestWeight !== null) return { val: `${bestWeight} lb`, label: 'Weight PR' };
    if (bestReps   !== null) return { val: `${bestReps} reps`, label: 'Reps PR'   };
    return null;
  }

  const met  = PR_METRIC[type] || 'reps';
  const vals = pts.map(s => parseFloat(s.vals[met])).filter(v => !isNaN(v));
  if (!vals.length) return null;
  const isTime = type === 'sprint';
  const best   = isTime ? Math.min(...vals) : Math.max(...vals);
  return { val: isTime ? best.toFixed(2)+'s' : String(best), label: METRIC_LABELS[met] || met };
}

// ── Prescribed Workouts ───────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = d => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

function buildDefaultWeek() {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  const plans = [
    { name: 'Push Day', exercises: [
      { name: 'Bench press',         sets: 4, reps: 8  },
      { name: 'Incline bench press', sets: 3, reps: 10 },
      { name: 'OHP',                 sets: 3, reps: 10 },
      { name: 'Tricep pushdown',     sets: 3, reps: 12 },
      { name: 'Skull crusher',       sets: 3, reps: 10 },
    ]},
    { name: 'Pull Day', exercises: [
      { name: 'Deadlift',      sets: 3, reps: 5  },
      { name: 'Barbell row',   sets: 3, reps: 8  },
      { name: 'Lat pulldown',  sets: 3, reps: 10 },
      { name: 'Dumbbell curl', sets: 3, reps: 12 },
      { name: 'Face pull',     sets: 3, reps: 15 },
    ]},
    { name: 'Leg Day', exercises: [
      { name: 'Squat',              sets: 4, reps: 6  },
      { name: 'Romanian deadlift',  sets: 3, reps: 10 },
      { name: 'Leg press',          sets: 3, reps: 12 },
      { name: 'Leg curl',           sets: 3, reps: 12 },
      { name: 'Calf raise',         sets: 4, reps: 15 },
    ]},
    { name: 'Cardio', exercises: [
      { name: 'Running',   sets: 1, reps: null },
      { name: 'Jump rope', sets: 3, reps: null },
    ]},
    { name: 'Upper Body', exercises: [
      { name: 'Bench press', sets: 4, reps: 5  },
      { name: 'Cable row',   sets: 3, reps: 10 },
      { name: 'Pull-ups',    sets: 3, reps: 8  },
      { name: 'Dips',        sets: 3, reps: 10 },
      { name: 'Face pull',   sets: 3, reps: 15 },
    ]},
    { name: 'Lower Body', exercises: [
      { name: 'Deadlift',      sets: 4, reps: 4  },
      { name: 'Hip thrust',    sets: 3, reps: 10 },
      { name: 'Leg extension', sets: 3, reps: 12 },
      { name: 'Leg curl',      sets: 3, reps: 12 },
      { name: 'Calf raise',    sets: 4, reps: 20 },
    ]},
    { name: 'Active Recovery', exercises: [
      { name: 'Walking',   sets: 1, reps: null },
      { name: 'Swimming',  sets: 1, reps: null },
    ]},
  ];

  return plans.map((p, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: fmtDate(d), ...p };
  });
}

const PROGRAM_WORKOUTS = [
  {
    date: 'Jun 6',
    name: 'Interval Sprints',
    exercises: [
      { name: 'Interval Sprints 100m', sets: 2, reps: 7 },
    ],
  },
  {
    date: 'Jun 9',
    name: 'Interval Sprints',
    exercises: [
      { name: 'Interval Sprints 100m', sets: 1, reps: 8 },
      { name: 'Interval Sprints 100m', sets: 1, reps: 7 },
    ],
  },
  {
    date: 'Jun 13',
    name: 'Interval Sprints',
    exercises: [
      { name: 'Interval Sprints 100m', sets: 2, reps: 8 },
    ],
  },
];

function mergeProgram(workouts) {
  const merged = [...workouts];
  PROGRAM_WORKOUTS.forEach(pw => {
    const idx = merged.findIndex(w => w.date === pw.date);
    if (idx >= 0) merged[idx] = pw; else merged.push(pw);
  });
  return merged;
}

// ─── Seed: Coach Smith program (baked in so fresh installs load immediately) ──
const COACH_SEED = {"_coach_export":true,"client":"Coach Smith","workouts":[{"date":"Jun 8","name":"Legs Day","exercises":[{"name":"Squat","sets":3,"reps":5},{"name":"Back Extension w/ Rotation","sets":3,"reps":"8 each"},{"name":"SL Hamstring Curl","sets":3,"reps":"10 each"},{"name":"SL Quad Extension","sets":3,"reps":"10 each"},{"name":"SL RDL","sets":3,"reps":"8 each"}],"circuits":[{"name":"Hard Abs","exercises":[{"name":"Dragon Flag","sets":3,"reps":6},{"name":"Toes-to-Bar","sets":3,"reps":6},{"name":"Ab Wheel Rollouts","sets":3,"reps":8},{"name":"PB Rollback","sets":3,"reps":8}]}]},{"date":"Jun 9","name":"Chest and Arms","exercises":[{"name":"Bench","sets":3,"reps":10},{"name":"SA DB Row","sets":3,"reps":"10 each"},{"name":"Dips","sets":3,"reps":15},{"name":"Lat Pulldowns","sets":3,"reps":20},{"name":"BB Curl","sets":2,"reps":20},{"name":"SA Preacher Curl","sets":3,"reps":"15 each"},{"name":"DB Hammer Curl","sets":2,"reps":20},{"name":"DB Concentration Curl","sets":2,"reps":"20 each"},{"name":"Tricep Rope Extension","sets":2,"reps":20},{"name":"Pushups","sets":2,"reps":50}],"circuits":[]},{"date":"Jun 10","name":"Cardio - Interval Sprints","exercises":[{"name":"Interval Sprints 100m","sets":1,"reps":8},{"name":"Interval Sprints 100m","sets":1,"reps":7}],"circuits":[]},{"date":"Jun 11","name":"Legs Day","exercises":[{"name":"Squat","sets":3,"reps":5},{"name":"Back Extension w/ Rotation","sets":3,"reps":"8 each"},{"name":"SL Hamstring Curl","sets":3,"reps":"10 each"},{"name":"SL Quad Extension","sets":3,"reps":"10 each"},{"name":"SL RDL","sets":3,"reps":"8 each"}],"circuits":[{"name":"Hard Abs","exercises":[{"name":"Dragon Flag","sets":3,"reps":6},{"name":"Toes-to-Bar","sets":3,"reps":6},{"name":"Ab Wheel Rollouts","sets":3,"reps":8},{"name":"PB Rollback","sets":3,"reps":8}]}]},{"date":"Jun 12","name":"Chest and Arms","exercises":[{"name":"Bench","sets":3,"reps":10},{"name":"SA DB Row","sets":3,"reps":"10 each"},{"name":"Dips","sets":3,"reps":15},{"name":"Lat Pulldowns","sets":3,"reps":20},{"name":"BB Curl","sets":2,"reps":20},{"name":"SA Preacher Curl","sets":3,"reps":"15 each"},{"name":"DB Hammer Curl","sets":2,"reps":20},{"name":"DB Concentration Curl","sets":2,"reps":"20 each"},{"name":"Tricep Rope Extension","sets":2,"reps":20},{"name":"Pushups","sets":2,"reps":50}],"circuits":[]},{"date":"Jun 13","name":"Cardio - Interval Sprints","exercises":[{"name":"Interval Sprints 100m","sets":2,"reps":8}],"circuits":[]},{"date":"Jun 15","name":"Legs Day","exercises":[{"name":"Squat","sets":3,"reps":5},{"name":"Back Extension w/ Rotation","sets":3,"reps":"8 each"},{"name":"SL Hamstring Curl","sets":3,"reps":"10 each"},{"name":"SL Quad Extension","sets":3,"reps":"10 each"},{"name":"SL RDL","sets":3,"reps":"8 each"}],"circuits":[{"name":"Hard Abs","exercises":[{"name":"Dragon Flag","sets":3,"reps":6},{"name":"Toes-to-Bar","sets":3,"reps":6},{"name":"Ab Wheel Rollouts","sets":3,"reps":8},{"name":"PB Rollback","sets":3,"reps":8}]}]},{"date":"Jun 16","name":"Chest and Arms","exercises":[{"name":"Bench","sets":3,"reps":10},{"name":"SA DB Row","sets":3,"reps":"10 each"},{"name":"Dips","sets":3,"reps":15},{"name":"Lat Pulldowns","sets":3,"reps":20},{"name":"BB Curl","sets":2,"reps":20},{"name":"SA Preacher Curl","sets":3,"reps":"15 each"},{"name":"DB Hammer Curl","sets":2,"reps":20},{"name":"DB Concentration Curl","sets":2,"reps":"20 each"},{"name":"Tricep Rope Extension","sets":2,"reps":20},{"name":"Pushups","sets":2,"reps":50}],"circuits":[]},{"date":"Jun 17","name":"Cardio - Interval Sprints","exercises":[{"name":"Interval Sprints 100m","sets":1,"reps":8},{"name":"Interval Sprints 100m","sets":1,"reps":7}],"circuits":[]},{"date":"Jun 18","name":"Legs Day","exercises":[{"name":"Squat","sets":3,"reps":5},{"name":"Back Extension w/ Rotation","sets":3,"reps":"8 each"},{"name":"SL Hamstring Curl","sets":3,"reps":"10 each"},{"name":"SL Quad Extension","sets":3,"reps":"10 each"},{"name":"SL RDL","sets":3,"reps":"8 each"}],"circuits":[{"name":"Hard Abs","exercises":[{"name":"Dragon Flag","sets":3,"reps":6},{"name":"Toes-to-Bar","sets":3,"reps":6},{"name":"Ab Wheel Rollouts","sets":3,"reps":8},{"name":"PB Rollback","sets":3,"reps":8}]}]},{"date":"Jun 19","name":"Chest and Arms","exercises":[{"name":"Bench","sets":3,"reps":10},{"name":"SA DB Row","sets":3,"reps":"10 each"},{"name":"Dips","sets":3,"reps":15},{"name":"Lat Pulldowns","sets":3,"reps":20},{"name":"BB Curl","sets":2,"reps":20},{"name":"SA Preacher Curl","sets":3,"reps":"15 each"},{"name":"DB Hammer Curl","sets":2,"reps":20},{"name":"DB Concentration Curl","sets":2,"reps":"20 each"},{"name":"Tricep Rope Extension","sets":2,"reps":20},{"name":"Pushups","sets":2,"reps":50}],"circuits":[]},{"date":"Jun 20","name":"Cardio - Interval Sprints","exercises":[{"name":"Interval Sprints 100m","sets":2,"reps":8}],"circuits":[]},{"date":"Jun 22","name":"Legs Day","exercises":[{"name":"Squat","sets":3,"reps":5},{"name":"Back Extension w/ Rotation","sets":3,"reps":"8 each"},{"name":"SL Hamstring Curl","sets":3,"reps":"10 each"},{"name":"SL Quad Extension","sets":3,"reps":"10 each"},{"name":"SL RDL","sets":3,"reps":"8 each"}],"circuits":[{"name":"Hard Abs","exercises":[{"name":"Dragon Flag","sets":3,"reps":6},{"name":"Toes-to-Bar","sets":3,"reps":6},{"name":"Ab Wheel Rollouts","sets":3,"reps":8},{"name":"PB Rollback","sets":3,"reps":8}]}]},{"date":"Jun 23","name":"Chest and Arms","exercises":[{"name":"Bench","sets":3,"reps":10},{"name":"SA DB Row","sets":3,"reps":"10 each"},{"name":"Dips","sets":3,"reps":15},{"name":"Lat Pulldowns","sets":3,"reps":20},{"name":"BB Curl","sets":2,"reps":20},{"name":"SA Preacher Curl","sets":3,"reps":"15 each"},{"name":"DB Hammer Curl","sets":2,"reps":20},{"name":"DB Concentration Curl","sets":2,"reps":"20 each"},{"name":"Tricep Rope Extension","sets":2,"reps":20},{"name":"Pushups","sets":2,"reps":50}],"circuits":[]},{"date":"Jun 24","name":"Cardio - Interval Sprints","exercises":[{"name":"Interval Sprints 100m","sets":1,"reps":8},{"name":"Interval Sprints 100m","sets":1,"reps":7}],"circuits":[]},{"date":"Jun 25","name":"Legs Day","exercises":[{"name":"Squat","sets":3,"reps":5},{"name":"Back Extension w/ Rotation","sets":3,"reps":"8 each"},{"name":"SL Hamstring Curl","sets":3,"reps":"10 each"},{"name":"SL Quad Extension","sets":3,"reps":"10 each"},{"name":"SL RDL","sets":3,"reps":"8 each"}],"circuits":[{"name":"Hard Abs","exercises":[{"name":"Dragon Flag","sets":3,"reps":6},{"name":"Toes-to-Bar","sets":3,"reps":6},{"name":"Ab Wheel Rollouts","sets":3,"reps":8},{"name":"PB Rollback","sets":3,"reps":8}]}]},{"date":"Jun 26","name":"Chest and Arms","exercises":[{"name":"Bench","sets":3,"reps":10},{"name":"SA DB Row","sets":3,"reps":"10 each"},{"name":"Dips","sets":3,"reps":15},{"name":"Lat Pulldowns","sets":3,"reps":20},{"name":"BB Curl","sets":2,"reps":20},{"name":"SA Preacher Curl","sets":3,"reps":"15 each"},{"name":"DB Hammer Curl","sets":2,"reps":20},{"name":"DB Concentration Curl","sets":2,"reps":"20 each"},{"name":"Tricep Rope Extension","sets":2,"reps":20},{"name":"Pushups","sets":2,"reps":50}],"circuits":[]},{"date":"Jun 27","name":"Cardio - Interval Sprints","exercises":[{"name":"Interval Sprints 100m","sets":2,"reps":8}],"circuits":[]}]};

function initSeed() {
  if (localStorage.getItem(PRESCRIBED_KEY)) return;
  // Transform coach JSON into prescribed format (same logic as Settings import)
  const prescribed = COACH_SEED.workouts.map(w => {
    const circuitExes = (w.circuits || []).flatMap(ct =>
      ct.exercises.map((ex, j) => ({
        ...ex,
        inCircuit: true,
        circuitLabel: j === 0 ? (ct.name || 'Circuit') : undefined,
        isLastInCircuit: j === ct.exercises.length - 1,
      }))
    );
    return { ...w, exercises: [...(w.exercises || []), ...circuitExes] };
  });
  localStorage.setItem(PRESCRIBED_KEY, JSON.stringify(prescribed));
  // Seed custom exercises if not yet stored
  if (!localStorage.getItem(EXER_KEY)) {
    const known = new Set(DEFAULT_EXERCISES.map(e => e.name.toLowerCase()));
    const toAdd = [];
    COACH_SEED.workouts.forEach(w => {
      [...(w.exercises || []), ...(w.circuits || []).flatMap(c => c.exercises || [])].forEach(ex => {
        if (ex.name && !known.has(ex.name.toLowerCase())) {
          known.add(ex.name.toLowerCase());
          toAdd.push({ name: ex.name, type: ex.type || 'strength' });
        }
      });
    });
    if (toAdd.length) localStorage.setItem(EXER_KEY, JSON.stringify([...DEFAULT_EXERCISES, ...toAdd]));
  }
}
try { initSeed(); } catch(e) {}

export function loadPrescribed() {
  try {
    const stored = JSON.parse(localStorage.getItem(PRESCRIBED_KEY));
    return mergeProgram(stored || buildDefaultWeek());
  } catch { return mergeProgram(buildDefaultWeek()); }
}

export function savePrescribed(data) {
  localStorage.setItem(PRESCRIBED_KEY, JSON.stringify(data));
}

export function getPrescribedForDate(date) {
  return loadPrescribed().find(w => w.date === date) || null;
}

export function setMainValue(set) {
  const distUnit   = set.vals.distUnit   || 'mi';
  const weightUnit = set.vals.weightUnit || 'lb';
  const v = set.vals;
  if (set.type === 'sprint') {
    const su = v.sprintUnit || '';
    const sd = v.sdist ? `${v.sdist}${su ? ' '+su : ''}` : '';
    const st = v.stime ? `${v.stime}s` : '';
    return [st, sd].filter(Boolean).join(' · ') || '—';
  }
  if (set.type === 'power') {
    const pu = v.powerUnit || 'ft';
    return v.pdist ? `${v.pdist} ${pu}` : '—';
  }
  if (v.weight) return `${v.weight} ${weightUnit}`;
  if (v.dist)   return `${v.dist} ${distUnit}`;
  if (v.reps)   return `${v.reps} reps`;
  return '—';
}
