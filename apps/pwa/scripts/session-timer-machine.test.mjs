import assert from "node:assert/strict";
import test from "node:test";

import {
  countdownRemainingSeconds,
  createInitialSessionTimerState,
  createSessionTimerPlanKey,
  millisecondsToSeconds,
  reduceSessionTimerState,
} from "../src/features/workouts/domain/sessionTimerMachine.ts";
import {
  buildSessionTimerPlan,
} from "../src/features/workouts/domain/sessionTimerPlan.ts";
import { createSessionTimerSnapshot } from "../src/features/workouts/domain/sessionTimerSnapshot.ts";
import {
  workoutIntroCue,
  workoutPhaseStartCue,
} from "../src/features/workouts/services/workoutTimerCue.ts";

function intervalPlan({ intervalSeconds = 10 } = {}) {
  const plan = buildSessionTimerPlan({
    format: {
      code: "interval-test",
      formatType: "intervalles",
      intervalSeconds,
      label: "Intervalle test",
      restSeconds: 0,
      seriesCount: 1,
    },
    label: "Intervalle test",
  });

  assert.ok(plan);
  return plan;
}

function seriesPlan({ restSeconds = 10 } = {}) {
  const plan = buildSessionTimerPlan({
    format: {
      code: "series-test",
      formatType: "repetitions",
      label: "Séries test",
      repetitions: 10,
      restSeconds,
      seriesCount: 2,
    },
    label: "Séries test",
  });

  assert.ok(plan);
  return plan;
}

function dispatch(state, action) {
  return reduceSessionTimerState(state, action);
}

test("the plan key changes when timer semantics change under the same id", () => {
  const firstPlan = seriesPlan({ restSeconds: 10 });
  const changedPlan = seriesPlan({ restSeconds: 20 });

  assert.notEqual(
    createSessionTimerPlanKey(firstPlan),
    createSessionTimerPlanKey(changedPlan),
  );
});

test("a delayed callback catches up from timestamps instead of adding one tick", () => {
  const plan = intervalPlan();
  let state = createInitialSessionTimerState(createSessionTimerPlanKey(plan));

  state = dispatch(state, { nowMs: 0, plan, type: "toggle" });
  assert.equal(countdownRemainingSeconds(state), 3);

  state = dispatch(state, { nowMs: 3_000, plan, type: "tick" });
  assert.equal(state.status, "running");

  state = dispatch(state, { nowMs: 8_500, plan, type: "tick" });
  assert.equal(state.elapsedMs, 5_500);
  assert.equal(millisecondsToSeconds(state.elapsedMs), 5);

  state = dispatch(state, { nowMs: 20_000, plan, type: "tick" });
  assert.equal(state.status, "completed");
  assert.equal(state.elapsedMs, 10_000);
  assert.equal(state.sessionElapsedMs, 10_000);
});

test("pause excludes suspended time and resume uses a fresh countdown", () => {
  const plan = intervalPlan();
  let state = createInitialSessionTimerState(createSessionTimerPlanKey(plan));

  state = dispatch(state, { nowMs: 0, plan, type: "toggle" });
  state = dispatch(state, { nowMs: 3_000, plan, type: "tick" });
  state = dispatch(state, { nowMs: 5_000, plan, type: "tick" });
  state = dispatch(state, { nowMs: 5_000, plan, type: "toggle" });
  assert.equal(state.status, "paused");
  assert.equal(state.elapsedMs, 2_000);

  state = dispatch(state, { nowMs: 15_000, plan, type: "tick" });
  assert.equal(state.elapsedMs, 2_000);

  state = dispatch(state, { nowMs: 15_000, plan, type: "toggle" });
  assert.equal(state.status, "countdown");
  state = dispatch(state, { nowMs: 20_000, plan, type: "tick" });

  assert.equal(state.status, "running");
  assert.equal(state.elapsedMs, 4_000);
});

test("the preparation countdown can be cancelled without starting the clock", () => {
  const plan = intervalPlan();
  let state = createInitialSessionTimerState(createSessionTimerPlanKey(plan));

  state = dispatch(state, { nowMs: 1_000, plan, type: "toggle" });
  state = dispatch(state, { nowMs: 2_000, plan, type: "toggle" });
  state = dispatch(state, { nowMs: 20_000, plan, type: "tick" });

  assert.equal(state.status, "idle");
  assert.equal(state.elapsedMs, 0);
  assert.equal(countdownRemainingSeconds(state), null);
});

test("manual series track session time while scheduled time tracks only rest", () => {
  const plan = seriesPlan();
  let state = createInitialSessionTimerState(createSessionTimerPlanKey(plan));

  state = dispatch(state, { nowMs: 0, plan, type: "toggle" });
  state = dispatch(state, { nowMs: 3_000, plan, type: "tick" });
  state = dispatch(state, { nowMs: 8_000, plan, type: "tick" });

  assert.equal(state.seriesPhaseKind, "effort");
  assert.equal(state.elapsedMs, 0);
  assert.equal(state.sessionElapsedMs, 5_000);

  state = dispatch(state, { nowMs: 8_000, plan, type: "completeEffort" });
  state = dispatch(state, { nowMs: 13_000, plan, type: "tick" });

  assert.equal(state.seriesPhaseKind, "repos");
  assert.equal(state.elapsedMs, 5_000);
  assert.equal(state.sessionElapsedMs, 10_000);

  state = dispatch(state, { nowMs: 22_000, plan, type: "tick" });

  assert.equal(state.seriesIndex, 1);
  assert.equal(state.seriesPhaseKind, "effort");
  assert.equal(state.status, "running");
  assert.equal(state.elapsedMs, 10_000);
  assert.equal(state.sessionElapsedMs, 19_000);
});

test("manual series can pause without counting suspended time", () => {
  const plan = seriesPlan();
  let state = createInitialSessionTimerState(createSessionTimerPlanKey(plan));

  state = dispatch(state, { nowMs: 0, plan, type: "toggle" });
  state = dispatch(state, { nowMs: 3_000, plan, type: "tick" });
  state = dispatch(state, { nowMs: 8_000, plan, type: "toggle" });

  assert.equal(state.status, "paused");
  assert.equal(state.sessionElapsedMs, 5_000);

  state = dispatch(state, { nowMs: 60_000, plan, type: "tick" });
  state = dispatch(state, { nowMs: 60_000, plan, type: "toggle" });
  state = dispatch(state, { nowMs: 65_000, plan, type: "tick" });

  assert.equal(state.status, "running");
  assert.equal(state.sessionElapsedMs, 7_000);
});

test("a zero-duration rest advances directly to the next manual series", () => {
  const plan = seriesPlan({ restSeconds: 0 });
  let state = createInitialSessionTimerState(createSessionTimerPlanKey(plan));

  state = dispatch(state, { nowMs: 0, plan, type: "toggle" });
  state = dispatch(state, { nowMs: 3_000, plan, type: "tick" });
  state = dispatch(state, { nowMs: 5_000, plan, type: "completeEffort" });

  assert.equal(state.status, "running");
  assert.equal(state.seriesIndex, 1);
  assert.equal(state.seriesPhaseKind, "effort");
  assert.equal(countdownRemainingSeconds(state), null);
});

test("manual series counts down inside the last three rest seconds", () => {
  const plan = seriesPlan({ restSeconds: 10 });
  let state = createInitialSessionTimerState(createSessionTimerPlanKey(plan));

  state = dispatch(state, { nowMs: 0, plan, type: "toggle" });
  state = dispatch(state, { nowMs: 3_000, plan, type: "tick" });
  state = dispatch(state, { nowMs: 8_000, plan, type: "completeEffort" });
  state = dispatch(state, { nowMs: 15_000, plan, type: "tick" });

  const restSnapshot = createSessionTimerSnapshot({
    elapsedSeconds: millisecondsToSeconds(state.elapsedMs),
    plan,
    seriesState: {
      currentSeriesIndex: state.seriesIndex,
      phaseKind: state.seriesPhaseKind,
      restElapsedSeconds: millisecondsToSeconds(state.seriesRestElapsedMs),
    },
    sessionElapsedSeconds: millisecondsToSeconds(state.sessionElapsedMs),
    status: state.status,
  });

  assert.equal(state.status, "running");
  assert.equal(countdownRemainingSeconds(state), null);
  assert.equal(restSnapshot.phaseRemainingSeconds, 3);
  assert.equal(restSnapshot.eventKind, "decompte");

  state = dispatch(state, { nowMs: 18_000, plan, type: "tick" });

  assert.equal(state.status, "running");
  assert.equal(state.seriesIndex, 1);
  assert.equal(state.seriesPhaseKind, "effort");
  assert.equal(countdownRemainingSeconds(state), null);
});

test("manual finish records the last partial clock delta", () => {
  const plan = seriesPlan();
  let state = createInitialSessionTimerState(createSessionTimerPlanKey(plan));

  state = dispatch(state, { nowMs: 0, plan, type: "toggle" });
  state = dispatch(state, { nowMs: 3_000, plan, type: "tick" });
  state = dispatch(state, { nowMs: 4_250, plan, type: "finish" });

  assert.equal(state.status, "completed");
  assert.equal(state.sessionElapsedMs, 1_250);
  assert.equal(state.elapsedMs, plan.totalSeconds * 1_000);
});

test("series snapshots expose session elapsed time independently from rest", () => {
  const plan = seriesPlan();
  const snapshot = createSessionTimerSnapshot({
    elapsedSeconds: 0,
    plan,
    seriesState: {
      currentSeriesIndex: 0,
      phaseKind: "effort",
      restElapsedSeconds: 0,
    },
    sessionElapsedSeconds: 12,
    status: "running",
  });

  assert.equal(snapshot.elapsedSeconds, 0);
  assert.equal(snapshot.sessionElapsedSeconds, 12);
  assert.equal(snapshot.totalRemainingSeconds, 10);
  assert.equal(snapshot.isManualPhase, true);
});

test("a plan change resets every state field atomically", () => {
  const firstPlan = intervalPlan();
  const nextPlan = intervalPlan({ intervalSeconds: 20 });
  let state = createInitialSessionTimerState(createSessionTimerPlanKey(firstPlan));

  state = dispatch(state, { nowMs: 0, plan: firstPlan, type: "toggle" });
  state = dispatch(state, { nowMs: 6_000, plan: firstPlan, type: "tick" });
  state = dispatch(state, {
    planKey: createSessionTimerPlanKey(nextPlan),
    type: "planChanged",
  });

  assert.deepEqual(
    state,
    createInitialSessionTimerState(createSessionTimerPlanKey(nextPlan)),
  );
});

test("interval formats use the same numbered series voices", () => {
  const plan = buildSessionTimerPlan({
    format: {
      code: "interval-voices",
      formatType: "intervalles",
      intervalSeconds: 10,
      label: "12 intervalles",
      restSeconds: 5,
      seriesCount: 12,
    },
    label: "12 intervalles",
  });

  assert.ok(plan);

  const effortPhases = plan.phases.filter((phase) => phase.kind === "effort");

  assert.deepEqual(
    effortPhases.map((phase) => phase.seriesIndex),
    Array.from({ length: 12 }, (_, index) => index),
  );

  assert.deepEqual(
    effortPhases.map((_, index) =>
      workoutPhaseStartCue(
        "voice",
        intervalSnapshot(plan, index * 15),
      ),
    ),
    Array.from({ length: 12 }, (_, index) => `series${index + 1}`),
  );
});

test("series voice numbering also works for intervals without rest phases", () => {
  const plan = buildSessionTimerPlan({
    format: {
      code: "interval-voices-no-rest",
      formatType: "intervalles",
      intervalSeconds: 10,
      label: "3 intervalles sans repos",
      restSeconds: 0,
      seriesCount: 3,
    },
    label: "3 intervalles sans repos",
  });

  assert.ok(plan);

  assert.deepEqual(
    plan.phases.map((_, index) =>
      workoutPhaseStartCue("voice", intervalSnapshot(plan, index * 10)),
    ),
    ["series1", "series2", "series3"],
  );
});

test("a single repetition or interval series uses the lets go voice", () => {
  const repetitionPlan = buildSessionTimerPlan({
    format: {
      code: "single-repetition-series",
      formatType: "repetitions",
      label: "1 série de 10 répétitions",
      repetitions: 10,
      restSeconds: 0,
      seriesCount: 1,
    },
    label: "1 série de 10 répétitions",
  });
  const intervalPlan = buildSessionTimerPlan({
    format: {
      code: "single-interval-series",
      formatType: "intervalles",
      intervalSeconds: 30,
      label: "1 série de 30 secondes",
      restSeconds: 0,
      seriesCount: 1,
    },
    label: "1 série de 30 secondes",
  });

  assert.ok(repetitionPlan);
  assert.ok(intervalPlan);

  const repetitionSnapshot = createSessionTimerSnapshot({
    elapsedSeconds: 0,
    plan: repetitionPlan,
    seriesState: {
      currentSeriesIndex: 0,
      phaseKind: "effort",
      restElapsedSeconds: 0,
    },
    sessionElapsedSeconds: 0,
    status: "running",
  });

  assert.equal(workoutPhaseStartCue("voice", repetitionSnapshot), "letsGo");
  assert.equal(
    workoutPhaseStartCue("voice", intervalSnapshot(intervalPlan, 0)),
    "letsGo",
  );
  assert.equal(
    workoutPhaseStartCue("sound", intervalSnapshot(intervalPlan, 0)),
    "exerciseStart",
  );
});

test("workout phase selects the warmup and cooldown intro voices", () => {
  assert.equal(workoutIntroCue("warmup"), "warmUpStart");
  assert.equal(workoutIntroCue("cooldown"), "coldDownStart");
  assert.equal(workoutIntroCue("main"), "exerciseStart");
});

function intervalSnapshot(plan, elapsedSeconds) {
  return createSessionTimerSnapshot({
    elapsedSeconds,
    plan,
    seriesState: null,
    sessionElapsedSeconds: elapsedSeconds,
    status: "running",
  });
}
