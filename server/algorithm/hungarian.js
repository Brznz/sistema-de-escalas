/**
 * Kuhn-Munkres (Hungarian) Algorithm for Linear Sum Assignment Problem (LSAP)
 * Finds min-cost 1-to-1 matching in O(N^3) time.
 */

export function solveHungarian(costMatrix) {
  const n = costMatrix.length;
  if (n === 0) return { assignment: [], totalCost: 0 };
  const m = costMatrix[0].length;
  if (n !== m) {
    throw new Error(`Cost matrix must be square (received ${n}x${m})`);
  }

  // Handle n=1 edge case
  if (n === 1) {
    return {
      assignment: [0],
      totalCost: costMatrix[0][0]
    };
  }

  // Shift to ensure non-negative entries
  let minVal = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (costMatrix[i][j] < minVal) minVal = costMatrix[i][j];
    }
  }

  const shift = minVal < 0 ? -minVal : 0;
  // 1-indexed for standard potential-based implementation
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity);
    const used = new Array(n + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= n; j++) {
        if (!used[j]) {
          const cur = (costMatrix[i0 - 1][j - 1] + shift) - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }

      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }

      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  // Extract assignment: row i (0..n-1) -> col j (0..n-1)
  const assignment = new Array(n).fill(-1);
  let totalCost = 0;

  for (let j = 1; j <= n; j++) {
    if (p[j] > 0) {
      const row = p[j] - 1;
      const col = j - 1;
      assignment[row] = col;
    }
  }

  for (let i = 0; i < n; i++) {
    const col = assignment[i];
    if (col >= 0 && col < n) {
      totalCost += costMatrix[i][col];
    }
  }

  return { assignment, totalCost };
}
