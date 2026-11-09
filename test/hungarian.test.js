import test from 'node:test';
import assert from 'node:assert/strict';
import { solveHungarian } from '../server/algorithm/hungarian.js';

test('solveHungarian solves standard 3x3 assignment', () => {
  // Classic assignment problem
  // Matrix:
  // [ 1, 2, 3 ]
  // [ 2, 4, 6 ]
  // [ 3, 6, 9 ]
  // Optimal: (0->2: 3), (1->1: 4), (2->0: 3) => 10? Wait:
  // (0->0: 1), (1->1: 4), (2->2: 9) => 14
  // (0->2: 3), (1->0: 2), (2->1: 6) => 11
  // (0->1: 2), (1->0: 2), (2->2: 9) => 13
  // (0->2: 3), (1->1: 4), (2->0: 3) => 10!
  const matrix = [
    [1, 2, 3],
    [2, 4, 6],
    [3, 6, 9]
  ];
  const { assignment, totalCost } = solveHungarian(matrix);
  assert.equal(totalCost, 10);
  assert.equal(assignment[0], 2);
  assert.equal(assignment[1], 1);
  assert.equal(assignment[2], 0);
});

test('solveHungarian handles negative numbers and shifts', () => {
  const matrix = [
    [10, 5, -2],
    [3, 8, 2],
    [-5, 4, 1]
  ];
  // Best: row 2 -> col 0 (-5), row 0 -> col 2 (-2), row 1 -> col 1 (8)?
  // row 2 -> 0 (-5), row 1 -> 2 (2), row 0 -> 1 (5) => 2
  const { assignment, totalCost } = solveHungarian(matrix);
  assert.equal(assignment[2], 0);
  assert.equal(assignment[0], 2);
  assert.equal(assignment[1], 1);
  assert.equal(totalCost, 1);
});

test('solveHungarian 4x4 matrix', () => {
  const matrix = [
    [90, 75, 75, 80],
    [35, 85, 55, 65],
    [125, 95, 90, 105],
    [45, 110, 95, 115]
  ];
  // Optimal assignment:
  // row 0 -> col 1 (75)
  // row 1 -> col 2 (55)
  // row 2 -> col 3 (105)
  // row 3 -> col 0 (45)
  // total = 280 (or row 0->3 (80), row 1->2 (55), row 2->1 (95), row 3->0 (45) = 275!)
  const { assignment, totalCost } = solveHungarian(matrix);
  assert.equal(totalCost, 275);
  // Verify all rows and cols are uniquely assigned
  const assignedCols = new Set(assignment);
  assert.equal(assignedCols.size, 4);
});
