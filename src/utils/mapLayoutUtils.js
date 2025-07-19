import mapboxgl from 'mapbox-gl';
import { getPoiDisplayData, CATEGORY_ICONS } from './poiUtils.js';

// --- LAYOUT CONSTANTS ---
const LABEL_MIN_HEIGHT = 50;
const LABEL_MAX_HEIGHT = 80;
export const LABEL_WIDTH = 180;
export const LABEL_HEIGHT = 50;
export const EDGE_PADDING = 60;   // Min distance from label to map edge
export const STROKE_WIDTH = 1.5;  // Connector line thickness

// --- SIMULATED ANNEALING PARAMETERS ---
// Tuned for finding high-quality, non-overlapping layouts
const SA = {
  initialTemp: 10000,    // Higher initial temperature for more exploration
  coolingRate: 0.99,     // Slower cooling to find better solutions
  minTemp: 0.01,         // Lower minimum temperature for more refinement
  maxIter: 10000         // More iterations to ensure convergence
};

// --- PENALTIES ---
// These values guide the optimization. They are intentionally large
// to strongly forbid undesirable outcomes like overlaps.
const PENALTY_OVERLAP = 1e15;    // Extreme penalty for overlaps
const PENALTY_CROSSING = 1e8;
const MIN_BOX_DISTANCE = 10;     // Minimum pixels between boxes

/**
 * Utility: Axis-aligned rectangle overlap test.
 * Returns true if two rectangles, a and b, overlap.
 */
function rectsOverlap(a, b) {
  // Add padding to ensure minimum distance between boxes
  const padded_a = {
    x: a.x - MIN_BOX_DISTANCE,
    y: a.y - MIN_BOX_DISTANCE,
    width: a.width + 2 * MIN_BOX_DISTANCE,
    height: a.height + 2 * MIN_BOX_DISTANCE
  };
  return !(
    padded_a.x + padded_a.width < b.x ||
    b.x + b.width < padded_a.x ||
    padded_a.y + padded_a.height < b.y ||
    b.y + b.height < padded_a.y
  );
}

/**
 * Utility: Line-segment intersection test.
 * Returns true if the line from a1-a2 intersects with b1-b2.
 */
function intersects(a1, a2, b1, b2) {
  const det = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
  if (Math.abs(det) < 1e-6) return false; // Parallel or collinear
  const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / det;
  const u = -((a2.x - a1.x) * (b1.y - a1.y) - (a2.y - a1.y) * (b1.x - a1.x)) / det;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
}

/**
 * Builds a connector path from a POI to its label.
 * This version connects to the *center* of the closest edge of the label box.
 * The path is a clean L-shape (or a straight line if already aligned).
 * This function is self-contained and does not affect the optimization algorithm.
 */
function buildConnector(poi, lblRect) {
  const { x: lx, y: ly, width: w, height: h } = lblRect;
  const { x: starX, y: starY } = poi;
  
  // Find the closest edge to connect to
  const edges = [
    { type: 'left', x: lx, y: ly + h/2 },
    { type: 'right', x: lx + w, y: ly + h/2 },
    { type: 'top', x: lx + w/2, y: ly },
    { type: 'bottom', x: lx + w/2, y: ly + h }
  ];
  
  // Calculate distances to each edge
  const distanceToEdge = edges.map(edge => ({
    ...edge,
    distance: Math.hypot(edge.x - starX, edge.y - starY)
  }));
  
  // Find the closest edge
  const targetEdge = distanceToEdge.reduce((a, b) => a.distance < b.distance ? a : b);
  const entryX = targetEdge.x;
  const entryY = targetEdge.y;
  
  // Determine which axis has the longer distance to travel
  const dx = Math.abs(entryX - starX);
  const dy = Math.abs(entryY - starY);
  const goVerticalFirst = dy > dx;

  // For horizontal edges (top/bottom), use horizontal approach
  // For vertical edges (left/right), use vertical approach
  const isHorizontalEdge = targetEdge.type === 'top' || targetEdge.type === 'bottom';
  const isVerticalEdge = targetEdge.type === 'left' || targetEdge.type === 'right';

  // If we're very close to being aligned, just use a straight line
  if (dx < 5 || dy < 5) {
    return [{ from: poi, to: { x: entryX, y: entryY } }];
  }

  if (goVerticalFirst) {
    // Move vertically first, then horizontally
    return [
      { from: poi, to: { x: starX, y: entryY } },
      { from: { x: starX, y: entryY }, to: { x: entryX, y: entryY } }
    ];
  } else {
    // Move horizontally first, then vertically
    return [
      { from: poi, to: { x: entryX, y: starY } },
      { from: { x: entryX, y: starY }, to: { x: entryX, y: entryY } }
    ];
  }
}

/**
 * Check if a line passes through a rectangle
 */
/**
 * Utility: Calculate the shortest distance from a point to a line segment
 */
function pointToLineDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineLength = Math.hypot(dx, dy);
  
  if (lineLength === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  
  // Calculate projection
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (lineLength * lineLength);
  
  // If projection is outside line segment, use distance to nearest endpoint
  if (t < 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  if (t > 1) return Math.hypot(point.x - lineEnd.x, point.y - lineEnd.y);
  
  // Calculate perpendicular distance
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

function linePassesThroughRectangle(line, rect) {
  const { x, y, width, height } = rect;
  const corners = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];

  // Check if line intersects any edge of the rectangle
  const edges = [
    { from: corners[0], to: corners[1] },
    { from: corners[1], to: corners[2] },
    { from: corners[2], to: corners[3] },
    { from: corners[3], to: corners[0] }
  ];

  return edges.some(edge => intersects(line.from, line.to, edge.from, edge.to));
}

/**
 * The "energy" function for simulated annealing. It calculates a cost for a
 * given layout. The algorithm's goal is to find the layout with the minimum energy.
 */
function computeEnergy(angles, pois, centroid, rx, ry) {
  const n = pois.length;
  let energy = 0;
  const mapWidth = mapContainer.clientWidth;
  const mapHeight = mapContainer.clientHeight;

  const centers = angles.map(a => ({
    x: centroid.x + Math.cos(a) * rx,
    y: centroid.y + Math.sin(a) * ry
  }));
  
  // Calculate dynamic label sizes based on content
  const rects = centers.map((c, i) => {
    const name = pois[i].name;
    const width = Math.max(LABEL_WIDTH, Math.min(name.length * 8 + 60, 300));
    const height = Math.max(LABEL_MIN_HEIGHT, Math.min(Math.ceil(name.length / 20) * 20 + 30, LABEL_MAX_HEIGHT));
    
    return {
      x: c.x - width / 2,
      y: c.y - height / 2,
      width,
      height,
      poi: pois[i]
    };
  });

  const allSegments = [];
  for (let i = 0; i < n; i++) {
    const segments = buildConnector(pois[i], rects[i]);
    allSegments.push(segments);
    segments.forEach(seg => {
      energy += Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y) ** 2;
    });
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (rectsOverlap(rects[i], rects[j])) {
        energy += PENALTY_OVERLAP;
      }
      for (const seg1 of allSegments[i]) {
        for (const seg2 of allSegments[j]) {
          if (intersects(seg1.from, seg1.to, seg2.from, seg2.to)) {
            energy += PENALTY_CROSSING;
          }
        }
      }
    }
  }

  // Add strict penalties for labels going out of bounds
  for (const rect of rects) {
    if (rect.x < EDGE_PADDING || rect.y < EDGE_PADDING ||
        rect.x + rect.width > mapWidth - EDGE_PADDING ||
        rect.y + rect.height > mapHeight - EDGE_PADDING) {
      energy += 5000; // Extreme penalty for out of bounds
    }
  }

  // Strict penalties for any non-orthogonal lines or overlaps
  for (let i = 0; i < n; i++) {
    const segments = allSegments[i];
    
    // Check each segment for strict orthogonality
    segments.forEach(seg => {
      const dx = Math.abs(seg.to.x - seg.from.x);
      const dy = Math.abs(seg.to.y - seg.from.y);
      if (dx > 1 && dy > 1) {
        energy += 2000; // Penalty for non-orthogonal lines
      }
    });

    // Check for lines intersecting with any element
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        // Check for intersections with labels
        for (const seg of segments) {
          if (linePassesThroughRectangle(seg, rects[j])) {
            energy += 3000; // Severe penalty for lines through labels
          }
        }
        
        // Check for lines too close to POIs
        const poi = pois[j];
        for (const seg of segments) {
          const distToPOI = pointToLineDistance(poi, seg.from, seg.to);
          if (distToPOI < 20) {
            energy += 1000; // Penalty for lines too close to POIs
          }
        }
      }
    }
  }

  // Preference for labels near edges
  for (const rect of rects) {
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const distanceFromEdge = Math.min(
      centerX,
      mapWidth - centerX,
      centerY,
      mapHeight - centerY
    );
    if (distanceFromEdge > 100) {
      energy += (distanceFromEdge - 100) * 0.5;
    }
  }

  // Preference for shorter connector lines
  for (const segments of allSegments) {
    for (const seg of segments) {
      const length = Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y);
      energy += length * 0.1;
    }
  }

  return energy;
}

/**
 * Proposes a new arrangement of labels (a "neighbor" state) for the optimizer.
 */
function neighborAngles(angles) {
  const n = angles.length;
  const candidate = angles.slice();

  if (Math.random() < 0.5) {
    const i = Math.floor(Math.random() * n);
    const j = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
  } else {
    const k = Math.floor(Math.random() * n);
    const nudge = (Math.random() - 0.5) * (Math.PI / n);
    candidate[k] = (candidate[k] + nudge + 2 * Math.PI) % (2 * Math.PI);
  }
  return candidate;
}

/**
 * The main optimization function. Uses simulated annealing to find the
 * arrangement of angles (label positions) that minimizes the energy function.
 */
function optimizeAngles(pois, centroid, rx, ry) {
  const n = pois.length;
  let currentAngles = Array.from({ length: n }, (_, i) => 2 * Math.PI * i / n);
  let bestAngles = currentAngles.slice();
  let currentEnergy = computeEnergy(currentAngles, pois, centroid, rx, ry);
  let bestEnergy = currentEnergy;
  let temperature = SA.initialTemp;
  let iterationsWithoutImprovement = 0;

  console.log('🔥 Starting Simulated Annealing optimization...');
  console.log(`Initial energy: ${currentEnergy.toFixed(2)}`);

  for (let i = 0; i < SA.maxIter && temperature > SA.minTemp; i++) {
    const candidateAngles = neighborAngles(currentAngles);
    const candidateEnergy = computeEnergy(candidateAngles, pois, centroid, rx, ry);
    const deltaEnergy = candidateEnergy - currentEnergy;

    if (deltaEnergy < 0 || Math.random() < Math.exp(-deltaEnergy / temperature)) {
      currentAngles = candidateAngles;
      currentEnergy = candidateEnergy;
      iterationsWithoutImprovement = 0;

      if (currentEnergy < bestEnergy) {
        bestEnergy = currentEnergy;
        bestAngles = currentAngles.slice();
        console.log(`✅ New best solution found at iteration ${i}: energy = ${bestEnergy.toFixed(2)}`);
      }
    } else {
      iterationsWithoutImprovement++;
    }

    // Early termination if no improvements for a while
    if (iterationsWithoutImprovement > SA.maxIter / 10) {
      console.log(`🛑 Optimization terminated early at iteration ${i} due to lack of improvement`);
      break;
    }

    temperature *= SA.coolingRate;

    // Log progress periodically
    if (i % 100 === 0) {
      console.log(`Iteration ${i}: current energy = ${currentEnergy.toFixed(2)}, temperature = ${temperature.toFixed(2)}`);
    }
  }
  return bestAngles;
}

/**
 * MAIN EXPORTED FUNCTION
 * Fits the map, projects POIs, runs the optimization, and renders the
 * complete layout of labels, connectors, and POI markers.
 */
export const generateProfessionalMapLayout = async (
  map, coords, amenities, mapContainer, overlayRef
) => {
  if (!map || !coords || !amenities || !amenities.length) return;

  if (overlayRef.current) {
    overlayRef.current.remove();
  }

  const bounds = new mapboxgl.LngLatBounds();
  bounds.extend([coords.lng, coords.lat]);
  amenities.forEach(a => {
    if (a.coordinates) {
      bounds.extend([a.coordinates.lng, a.coordinates.lat]);
    }
  });
  map.fitBounds(bounds, { padding: 250, duration: 500 });
  await new Promise(resolve => map.once('idle', resolve));

  const overlay = document.createElement('div');
  overlay.style.cssText = `position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:10;`;
  mapContainer.appendChild(overlay);
  overlayRef.current = overlay;

  const W = mapContainer.clientWidth, H = mapContainer.clientHeight;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', `${W}`);
  svg.setAttribute('height', `${H}`);
  svg.style.cssText = `position:absolute; top:0; left:0; pointer-events:none; z-index:12;`;

  const pois = amenities
    .filter(a => a.coordinates)
    .map(a => {
      const point = map.project([a.coordinates.lng, a.coordinates.lat]);
      return { name: a.name, x: point.x, y: point.y };
    });

  // Calculate initial positions and importance scores for all POIs
  const initialPositions = pois.map(poi => {
    const mapCenter = { x: W / 2, y: H / 2 };
    const dx = poi.x - mapCenter.x;
    const dy = poi.y - mapCenter.y;
    const placeOnLeft = dx < 0;
    const horizontalGap = Math.min(Math.max(Math.abs(dx) * 0.3, 60), 120);
    const baseX = placeOnLeft ? 
      poi.x - LABEL_WIDTH - horizontalGap :
      poi.x + horizontalGap;
    const baseY = poi.y - LABEL_HEIGHT / 2;

    // Calculate importance score (closer to center = more important)
    // You can modify this scoring based on your needs
    const distanceFromCenter = Math.hypot(dx, dy);
    const maxDistance = Math.hypot(W/2, H/2);
    const importance = 1 - (distanceFromCenter / maxDistance);
    
    return {
      x: baseX,
      y: baseY,
      placeOnLeft,
      poi,
      importance,
      visible: true // Initially all are visible
    };
  });

  // Sort by importance (most important first)
  initialPositions.sort((a, b) => b.importance - a.importance);

  // Filter out overlapping labels, keeping the more important ones
  initialPositions.forEach((pos, i) => {
    if (!pos.visible) return; // Skip already hidden labels

    const thisRect = {
      x: pos.x,
      y: pos.y,
      width: LABEL_WIDTH,
      height: LABEL_HEIGHT
    };

    // Check against all less important labels
    for (let j = i + 1; j < initialPositions.length; j++) {
      const otherPos = initialPositions[j];
      if (!otherPos.visible) continue;

      const otherRect = {
        x: otherPos.x,
        y: otherPos.y,
        width: LABEL_WIDTH,
        height: LABEL_HEIGHT
      };

      // If boxes are too close (using a stricter overlap check)
      const tooClose = Math.abs(thisRect.x - otherRect.x) < LABEL_WIDTH * 0.8 &&
                      Math.abs(thisRect.y - otherRect.y) < LABEL_HEIGHT * 0.8;

      if (tooClose) {
        // Hide the less important label
        otherPos.visible = false;
      }
    }
  });

  // Filter out hidden labels
  const labelPositions = initialPositions.filter(pos => pos.visible);
  
  // Adjust positions to avoid overlaps
  for (let i = 0; i < labelPositions.length; i++) {
    const pos = labelPositions[i];
    let overlapped = true;
    let attempts = 0;
    const maxAttempts = 10;
    const stepSize = LABEL_HEIGHT * 1.2;
    
    while (overlapped && attempts < maxAttempts) {
      overlapped = false;
      
      // Check for overlaps with other labels
      for (let j = 0; j < labelPositions.length; j++) {
        if (i === j) continue;
        const other = labelPositions[j];
        
        // Calculate minimum vertical separation needed
        const minVerticalSep = LABEL_HEIGHT * 1.2;
        
        // Check for potential overlaps, including same-side and cross-side conflicts
        const horizontalOverlap = Math.abs(pos.x - other.x) < (LABEL_WIDTH + 40);
        const verticalOverlap = Math.abs(pos.y - other.y) < minVerticalSep;
        
        if (horizontalOverlap && verticalOverlap) {
          overlapped = true;
          
          // Determine direction to move based on relative POI positions and available space
          const moveUp = pos.poi.y < other.poi.y;
          const newY = moveUp ? 
            other.y - minVerticalSep - LABEL_HEIGHT :
            other.y + minVerticalSep + LABEL_HEIGHT;
          
          // Check if new position would be within bounds
          if (newY >= EDGE_PADDING && newY + LABEL_HEIGHT <= H - EDGE_PADDING) {
            pos.y = newY;
          } else {
            // If out of bounds, try opposite direction
            pos.y += moveUp ? stepSize : -stepSize;
          }
          break;
        }
      }
      attempts++;
    }
  }
  
  // Calculate starStates for size adjustments of overlapping stars
  const minStarDist = 28;
  // Calculate star scales and create POI mapping
  const starStates = new Map();
  const visiblePosMap = new Map();
  
  // First pass: calculate star scales
  pois.forEach((p, i) => {
    let scale = 1;
    for (let j = 0; j < pois.length; j++) {
      if (i !== j) {
        const dx = p.x - pois[j].x, dy = p.y - pois[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < minStarDist) {
          scale = Math.min(scale, 0.7);
        }
      }
    }
    starStates.set(p, { scale });
  });
  
  // Second pass: create mapping of visible POIs to their positions
  labelPositions.forEach(pos => {
    visiblePosMap.set(pos.poi, pos);
  });

  // Process all POIs
  pois.forEach((p, i) => {
    // Get the label position if it exists (not filtered out due to overlap)
    const labelPos = visiblePosMap.get(p);
    
    // Define the label rectangle if we have a position
    const rect = labelPos ? {
      x: labelPos.x,
      y: labelPos.y,
      width: LABEL_WIDTH,
      height: LABEL_HEIGHT
    } : null;

    // Always draw the star
    const star = document.createElement('div');
    star.innerHTML = '★';
    const starSize = 16 * starStates.get(p).scale;
    star.style.cssText = `
      position: absolute; left: ${p.x - starSize / 2}px; top: ${p.y - starSize / 2}px;
      font-size: ${starSize}px; color: black;
      text-shadow: 0 0 3px #fff, 0 0 5px #fff; z-index: 13;
      transition: font-size 0.2s;
    `;
    overlay.appendChild(star);

    // Only draw connector and label if we have a valid position
    if (rect) {
      // Draw connector
      const connectorSegments = buildConnector(p, rect);
      connectorSegments.forEach(seg => {
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', `M ${seg.from.x},${seg.from.y} L ${seg.to.x},${seg.to.y}`);
        path.setAttribute('stroke', '#333');
        path.setAttribute('stroke-width', STROKE_WIDTH);
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
      });

      // Create label box
      const box = document.createElement('div');
    box.style.cssText = `
      position: absolute; left: ${rect.x}px; top: ${rect.y}px;
      width: ${LABEL_WIDTH}px; height: ${LABEL_HEIGHT}px;
      background: white; border: 1px solid #333; border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font: 600 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 8px; box-sizing: border-box; z-index: 11;
      display: flex; align-items: center; text-align: left;
    `;

    // Add loading placeholder
    box.innerHTML = `
      <div style="display: flex; align-items: center; width: 100%; gap: 8px;">
        <div style="width: 35px; height: 35px; background: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <div style="font-size: 10px; color: #666;">⏳</div>
        </div>
        <div style="font-size: 13px; line-height: 1.3; font-weight: 600; flex: 1;">
          ${p.name}
        </div>
      </div>
    `;
    
    overlay.appendChild(box);

    // Load and update POI display data
    getPoiDisplayData(p).then(displayData => {
      if (displayData.type === 'brand' && displayData.logo) {
        box.innerHTML = `
          <div style="display: flex; align-items: center; width: 100%; gap: 8px;">
            <img src="${displayData.logo}" 
                 style="height: 35px; width: auto; max-width: 60px; object-fit: contain; flex-shrink: 0;" 
                 alt="${p.name} logo" 
                 crossorigin="anonymous">
            <div style="font-size: 13px; line-height: 1.3; font-weight: 600; flex: 1;">
              ${p.name}
            </div>
          </div>
        `;
      } else {
        const icon = displayData.icon || CATEGORY_ICONS[p.types?.[0]] || CATEGORY_ICONS.default;
        box.innerHTML = `
          <div style="display: flex; align-items: center; width: 100%; gap: 8px;">
            <div style="font-size: 24px; flex-shrink: 0; width: 35px; text-align: center;">${icon}</div>
            <div style="font-size: 13px; line-height: 1.3; font-weight: 600; flex: 1;">
              ${p.name}
            </div>
          </div>
        `;
      }
    }).catch(error => {
      console.error('Error loading POI display data:', error);
      const icon = CATEGORY_ICONS[p.types?.[0]] || CATEGORY_ICONS.default;
      box.innerHTML = `
        <div style="display: flex; align-items: center; width: 100%; gap: 8px;">
          <div style="font-size: 24px; flex-shrink: 0; width: 35px; text-align: center;">${icon}</div>
          <div style="font-size: 13px; line-height: 1.3; font-weight: 600; flex: 1;">
            ${p.name}
          </div>
        </div>
      `;
    });
  }

  overlay.appendChild(svg);
  
  const centerPt = map.project([coords.lng, coords.lat]);
  const pin = document.createElement('div');
  pin.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24"><path fill="#FF3131" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="white"/></svg>`;
  pin.style.cssText = `position:absolute; left:${centerPt.x-24}px; top:${centerPt.y-48}px; z-index:14;`;
  overlay.appendChild(pin);
});

  overlay.appendChild(svg);
  
  const centerPt = map.project([coords.lng, coords.lat]);
  const pin = document.createElement('div');
  pin.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24"><path fill="#FF3131" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="white"/></svg>`;
  pin.style.cssText = `position:absolute; left:${centerPt.x-24}px; top:${centerPt.y-48}px; z-index:14;`;
  overlay.appendChild(pin);
};
