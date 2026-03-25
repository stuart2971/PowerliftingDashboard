// Standard RPE percentage table (% of true 1RM)
// Rows: reps 1-10, Columns: RPE 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10
const RPE_TABLE = {
  1:  { 6: 78,   6.5: 79,   7: 81,   7.5: 82,   8: 84,   8.5: 85.5, 9: 87,  9.5: 88.5, 10: 100 },
  2:  { 6: 76,   6.5: 77,   7: 79,   7.5: 80.5, 8: 82,   8.5: 83.5, 9: 85,  9.5: 86.5, 10: 88  },
  3:  { 6: 74,   6.5: 75.5, 7: 77,   7.5: 78.5, 8: 80,   8.5: 81.5, 9: 83,  9.5: 84.5, 10: 86  },
  4:  { 6: 72,   6.5: 73.5, 7: 75,   7.5: 76.5, 8: 78,   8.5: 79.5, 9: 81,  9.5: 82.5, 10: 84  },
  5:  { 6: 70,   6.5: 71.5, 7: 73,   7.5: 74.5, 8: 76,   8.5: 77.5, 9: 79,  9.5: 80.5, 10: 82  },
  6:  { 6: 68,   6.5: 69.5, 7: 71,   7.5: 72.5, 8: 74,   8.5: 75.5, 9: 77,  9.5: 78.5, 10: 80  },
  7:  { 6: 66,   6.5: 67.5, 7: 69,   7.5: 70.5, 8: 72,   8.5: 73.5, 9: 75,  9.5: 76.5, 10: 78  },
  8:  { 6: 64,   6.5: 65.5, 7: 67,   7.5: 68.5, 8: 70,   8.5: 71.5, 9: 73,  9.5: 74.5, 10: 76  },
  9:  { 6: 62,   6.5: 63.5, 7: 65,   7.5: 66.5, 8: 68,   8.5: 69.5, 9: 71,  9.5: 72.5, 10: 74  },
  10: { 6: 60,   6.5: 61.5, 7: 63,   7.5: 64.5, 8: 66,   8.5: 67.5, 9: 69,  9.5: 70.5, 10: 72  }
};

const VALID_RPES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

function snapRpe(rpe) {
  // Snap to nearest valid RPE value (handles inputs like 7.3 → 7.5)
  return VALID_RPES.reduce((prev, curr) =>
    Math.abs(curr - rpe) < Math.abs(prev - rpe) ? curr : prev
  );
}

function getPercentage(reps, rpe) {
  const r = Math.min(10, Math.max(1, Math.round(reps)));
  const snapped = snapRpe(Number(rpe));
  return (RPE_TABLE[r]?.[snapped] ?? 70) / 100;
}

function calcE1RM(load, reps, rpe) {
  const pct = getPercentage(reps, rpe);
  return pct > 0 ? load / pct : null;
}

function roundToNearest(value, increment = 2.5) {
  return Math.round(value / increment) * increment;
}

function calcBackdownLoad(e1rm, backdownReps, targetRpe, increment = 2.5) {
  const pct = getPercentage(backdownReps, targetRpe);
  return roundToNearest(e1rm * pct, increment);
}

function calcIntensityPct(load, e1rm) {
  if (!e1rm || e1rm === 0) return null;
  return Math.round((load / e1rm) * 1000) / 10; // one decimal
}

module.exports = { RPE_TABLE, getPercentage, calcE1RM, calcBackdownLoad, calcIntensityPct, roundToNearest, snapRpe };
