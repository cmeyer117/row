// Run with: node gym-bonus-templates-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'gym-bonus-templates-logic.js'), 'utf8'), sandbox);
const {
  createTemplate, renameTemplate, deleteTemplate,
  addExerciseToTemplate, removeExerciseFromTemplate, resolveTemplateExercises,
} = sandbox.window.GymBonusTemplatesLogic;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
    process.exit(1);
  }
}

// createTemplate — appends with a fresh id, name trimmed, starts empty.
let templates = [];
templates = createTemplate(templates, '  Shoulders & Arms  ');
assertEqual(templates.length, 1, 'createTemplate: appends one template');
assertEqual(templates[0].name, 'Shoulders & Arms', 'createTemplate: trims the name');
assertEqual(templates[0].exerciseNames, [], 'createTemplate: starts with no exercises');
const id1 = templates[0].id;

templates = createTemplate(templates, 'Chest & Back');
assertEqual(templates.length, 2, 'createTemplate: second call appends, does not replace');
assertEqual(templates[0].id, id1, 'createTemplate: first template keeps its id');

// renameTemplate — only touches the matching id.
templates = renameTemplate(templates, id1, 'Shoulders + Arms');
assertEqual(templates[0].name, 'Shoulders + Arms', 'renameTemplate: renames the matching template');
assertEqual(templates[1].name, 'Chest & Back', 'renameTemplate: leaves other templates untouched');

// addExerciseToTemplate — no duplicates.
templates = addExerciseToTemplate(templates, id1, 'Dumbbell Lateral Raise');
templates = addExerciseToTemplate(templates, id1, 'Dumbbell Lateral Raise');
assertEqual(templates[0].exerciseNames, ['Dumbbell Lateral Raise'], 'addExerciseToTemplate: adding the same name twice does not duplicate');
templates = addExerciseToTemplate(templates, id1, 'Machine Preacher Curl');
assertEqual(templates[0].exerciseNames, ['Dumbbell Lateral Raise', 'Machine Preacher Curl'], 'addExerciseToTemplate: second distinct exercise appends');

// removeExerciseFromTemplate
templates = removeExerciseFromTemplate(templates, id1, 'Dumbbell Lateral Raise');
assertEqual(templates[0].exerciseNames, ['Machine Preacher Curl'], 'removeExerciseFromTemplate: removes only the named exercise');

// deleteTemplate
templates = deleteTemplate(templates, id1);
assertEqual(templates.length, 1, 'deleteTemplate: removes the matching template');
assertEqual(templates[0].name, 'Chest & Back', 'deleteTemplate: leaves the other template');

// resolveTemplateExercises — maps names to real exercise objects for the
// active gym, preserving template order, skipping names with no match
// (e.g. an exercise Carl later deleted from his catalog).
const catalog = [
  { id: 'ex1', name: 'Lat Pulldown', gym: 'comm' },
  { id: 'ex2', name: 'Cable Rear Delt Fly', gym: 'comm' },
  { id: 'ex3', name: 'Lat Pulldown', gym: 'home' },
];
const resolved = resolveTemplateExercises(
  { id: 't1', name: 'Pull', exerciseNames: ['Cable Rear Delt Fly', 'Nonexistent Exercise', 'Lat Pulldown'] },
  catalog,
  'comm'
);
assertEqual(resolved.map(e => e.id), ['ex2', 'ex1'], 'resolveTemplateExercises: resolves in template order, skips unmatched names, matches active gym');

const resolvedBothGym = resolveTemplateExercises(
  { id: 't2', name: 'Test', exerciseNames: ['Lat Pulldown'] },
  [{ id: 'ex4', name: 'Lat Pulldown', gym: 'both' }],
  'comm'
);
assertEqual(resolvedBothGym.map(e => e.id), ['ex4'], 'resolveTemplateExercises: an exercise tagged gym "both" matches any active gym');

console.log('gym-bonus-templates-logic.selfcheck.cjs: all assertions passed');
