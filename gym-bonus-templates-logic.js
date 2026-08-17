// gym-bonus-templates-logic.js — pure CRUD for Carl's reusable bonus-workout
// templates (Shoulders & Arms, Chest & Back, Push, Pull, etc.). No DOM, no
// Supabase. Templates reference exercises BY NAME into the real exercise
// catalog (state.exercises) rather than duplicating exercise objects, so
// logging/history/getRx() progression work unchanged once resolved to real
// exercise ids. See docs/superpowers/specs/2026-08-17-bonus-workout-templates-design.md.
(function () {
  'use strict';

  function makeId() {
    return 'bonus_tmpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  function createTemplate(templates, name) {
    var trimmed = (name || '').trim();
    return templates.concat([{ id: makeId(), name: trimmed, exerciseNames: [] }]);
  }

  function renameTemplate(templates, id, newName) {
    var trimmed = (newName || '').trim();
    return templates.map(function (t) {
      return t.id === id ? Object.assign({}, t, { name: trimmed }) : t;
    });
  }

  function deleteTemplate(templates, id) {
    return templates.filter(function (t) { return t.id !== id; });
  }

  function addExerciseToTemplate(templates, id, exerciseName) {
    return templates.map(function (t) {
      if (t.id !== id) return t;
      if (t.exerciseNames.indexOf(exerciseName) !== -1) return t;
      return Object.assign({}, t, { exerciseNames: t.exerciseNames.concat([exerciseName]) });
    });
  }

  function removeExerciseFromTemplate(templates, id, exerciseName) {
    return templates.map(function (t) {
      if (t.id !== id) return t;
      return Object.assign({}, t, {
        exerciseNames: t.exerciseNames.filter(function (n) { return n !== exerciseName; }),
      });
    });
  }

  // Maps a template's stored exercise names to real exercise objects from
  // the current catalog, in template order. An exercise Carl later renamed
  // or deleted from his catalog simply drops out silently rather than
  // crashing the workout list -- same "guard, don't throw" posture as
  // applyCheckinOverride()'s own undefined-checkin handling elsewhere in
  // this codebase.
  function resolveTemplateExercises(template, exerciseCatalog, activeGym) {
    var byName = {};
    exerciseCatalog.forEach(function (ex) {
      if (ex.gym !== activeGym && ex.gym !== 'both') return;
      if (!(ex.name in byName)) byName[ex.name] = ex;
    });
    return template.exerciseNames
      .map(function (name) { return byName[name]; })
      .filter(Boolean);
  }

  var api = {
    createTemplate: createTemplate,
    renameTemplate: renameTemplate,
    deleteTemplate: deleteTemplate,
    addExerciseToTemplate: addExerciseToTemplate,
    removeExerciseFromTemplate: removeExerciseFromTemplate,
    resolveTemplateExercises: resolveTemplateExercises,
  };
  if (typeof window !== 'undefined') window.GymBonusTemplatesLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
