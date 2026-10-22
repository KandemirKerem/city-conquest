import { Delaunay } from 'd3-delaunay';

// Seeded PRNG (Mulberry32)
function createRng(seed) {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Calculate polygon centroid and area
function getPolygonCentroid(pts) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-5) {
    const avgX = pts.reduce((s, p) => s + p[0], 0) / n;
    const avgY = pts.reduce((s, p) => s + p[1], 0) / n;
    return [avgX, avgY];
  }
  cx /= 6 * area;
  cy /= 6 * area;
  return [Math.round(cx * 10) / 10, Math.round(cy * 10) / 10];
}

// Check if two polygons share a real border edge (not just a tiny corner point)
function shareRealBorder(polyA, polyB, minEdgeLen = 12) {
  const eps = 2.5;
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % polyA.length];
    const lenA = Math.hypot(a2[0] - a1[0], a2[1] - a1[1]);
    if (lenA < minEdgeLen) continue;

    for (let j = 0; j < polyB.length; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % polyB.length];

      const matchSame =
        Math.hypot(a1[0] - b1[0], a1[1] - b1[1]) < eps &&
        Math.hypot(a2[0] - b2[0], a2[1] - b2[1]) < eps;
      const matchRev =
        Math.hypot(a1[0] - b2[0], a1[1] - b2[1]) < eps &&
        Math.hypot(a2[0] - b1[0], a2[1] - b1[1]) < eps;

      if (matchSame || matchRev) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Generates a procedural "hand-drawn on paper" Voronoi territory map.
 * @param {number} regionCount Number of territories (default: 22)
 * @param {number} seed Random seed
 */
export function generateVoronoiMap(regionCount = 22, seed = Date.now()) {
  const width = 1000;
  const height = 700;
  const margin = 65;
  const rng = createRng(seed);

  // 1. Initial random points
  let points = Array.from({ length: regionCount }, () => [
    margin + rng() * (width - margin * 2),
    margin + rng() * (height - margin * 2),
  ]);

  // 2. Lloyd's Relaxation (2 passes) for organic, balanced hand-drawn paper territories
  for (let iter = 0; iter < 2; iter++) {
    const delaunay = Delaunay.from(points);
    const voronoi = delaunay.voronoi([0, 0, width, height]);
    points = points.map((pt, i) => {
      const cell = voronoi.cellPolygon(i);
      if (!cell || cell.length < 3) return pt;
      const cleanPts = cell.slice(0, -1); // remove duplicate closing vertex
      const [cx, cy] = getPolygonCentroid(cleanPts);
      return [
        Math.max(margin, Math.min(width - margin, cx)),
        Math.max(margin, Math.min(height - margin, cy)),
      ];
    });
  }

  // Sort points roughly top-to-bottom, left-to-right so territory numbers (#1..#N) read naturally
  points.sort((a, b) => {
    const rowA = Math.floor(a[1] / 175);
    const rowB = Math.floor(b[1] / 175);
    if (rowA !== rowB) return rowA - rowB;
    return a[0] - b[0];
  });

  // 3. Final Voronoi diagram
  const delaunay = Delaunay.from(points);
  const voronoi = delaunay.voronoi([0, 0, width, height]);

  const rawPolygons = points.map((_, i) => {
    const cell = voronoi.cellPolygon(i);
    // Remove duplicate closing point and round coordinates
    return cell
      .slice(0, -1)
      .map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  });

  // 4. Build territories with verified neighbor adjacency graph
  const territories = points.map((_, i) => {
    const polygon = rawPolygons[i];
    const center = getPolygonCentroid(polygon);
    const rawNeighbors = Array.from(voronoi.neighbors(i));
    const verifiedNeighbors = rawNeighbors.filter((nIdx) =>
      shareRealBorder(polygon, rawPolygons[nIdx], 12)
    );

    return {
      id: i,
      label: `${i + 1}`,
      polygon,
      center,
      neighbors: verifiedNeighbors,
      owner: null, // player ID or null
    };
  });

  // Ensure symmetry in neighbor graph
  for (const t of territories) {
    for (const nId of t.neighbors) {
      const neighbor = territories[nId];
      if (neighbor && !neighbor.neighbors.includes(t.id)) {
        neighbor.neighbors.push(t.id);
      }
    }
  }

  return {
    seed,
    width,
    height,
    totalTerritories: territories.length,
    winTargetCount: Math.ceil(territories.length * 0.8), // 80% rule
    territories,
  };
}
