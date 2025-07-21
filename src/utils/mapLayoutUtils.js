// mapLayoutUtils.js

import mapboxgl from 'mapbox-gl';
import { getPoiDisplayData, CATEGORY_ICONS } from './poiUtils.js';

// --- LAYOUT CONSTANTS ---
const LABEL_MIN_HEIGHT = 50;
const LABEL_MAX_HEIGHT = 80;
export const LABEL_WIDTH  = 180;
export const LABEL_HEIGHT = 50;
export const EDGE_PADDING = 60;   // Min distance from label to map edge
export const STROKE_WIDTH = 1.5;  // Connector line thickness

// --- SIMULATED ANNEALING PARAMETERS ---
const SA = {
  initialTemp: 10000,    // Higher initial temperature for more exploration
  coolingRate: 0.99,     // Slower cooling to find better solutions
  minTemp: 0.01,         // Lower minimum temperature for more refinement
  maxIter: 10000         // More iterations to ensure convergence
};

// --- PENALTIES ---
const PENALTY_OVERLAP  = 1e15;    // Extreme penalty for overlaps
const PENALTY_CROSSING = 1e8;
const MIN_BOX_DISTANCE = 10;      // Minimum pixels between boxes

// --- UTILITY FUNCTIONS ---

/**
 * Axis-aligned rectangle overlap test (with padding).
 */
function rectsOverlap(a, b) {
  const pad = MIN_BOX_DISTANCE;
  return !(
    a.x + a.width  + pad < b.x - pad ||
    b.x + b.width  + pad < a.x - pad ||
    a.y + a.height + pad < b.y - pad ||
    b.y + b.height + pad < a.y - pad
  );
}

/**
 * Line‐segment intersection test.
 */
function intersects(a1, a2, b1, b2) {
  const det = (a2.x - a1.x)*(b2.y - b1.y)
            - (a2.y - a1.y)*(b2.x - b1.x);
  if (Math.abs(det) < 1e-6) return false; // Parallel or nearly so
  const t = ((b1.x - a1.x)*(b2.y - b1.y)
           - (b1.y - a1.y)*(b2.x - b1.x)) / det;
  const u = ((b1.x - a1.x)*(a2.y - a1.y)
           - (b1.y - a1.y)*(a2.x - a1.x)) / det;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

/**
 * BUILD CONNECTOR
 * Always ends perpendicular to the middle of the closest edge.
 */
function buildConnector(poi, lblRect) {
  const sx = poi.x, sy = poi.y;
  const { x: lx, y: ly, width: w, height: h } = lblRect;

  // Midpoints of each edge:
  const edges = {
    left:   { x: lx,     y: ly + h/2 },
    right:  { x: lx + w, y: ly + h/2 },
    top:    { x: lx + w/2, y: ly    },
    bottom: { x: lx + w/2, y: ly + h }
  };

  // Choose the closest edge:
  let bestSide = null, bestDist = Infinity;
  for (const side in edges) {
    const e = edges[side];
    const d = Math.hypot(e.x - sx, e.y - sy);
    if (d < bestDist) { bestDist = d; bestSide = side; }
  }
  const { x: tx, y: ty } = edges[bestSide];

  // Build an L-shape that ensures the **last** segment
  // is perpendicular to that edge:
  if (bestSide === 'left' || bestSide === 'right') {
    // vertical-first, then horizontal
    const mid = { x: sx, y: ty };
    return [
      { from: poi, to: mid },
      { from: mid, to: { x: tx, y: ty } }
    ];
  } else {
    // top or bottom → horizontal-first, then vertical
    const mid = { x: tx, y: sy };
    return [
      { from: poi, to: mid },
      { from: mid, to: { x: tx, y: ty } }
    ];
  }
}

// --- ENERGY FUNCTION & SIMULATED ANNEALING ---

function computeEnergy(angles, pois, centroid, rx, ry, mapW, mapH) {
  const n = pois.length;
  let energy = 0;

  // Place label centers on ellipse:
  const centers = angles.map(a => ({
    x: centroid.x + Math.cos(a)*rx,
    y: centroid.y + Math.sin(a)*ry
  }));

  // Build label rects:
  const rects = centers.map((c,i) => ({
    x: c.x - LABEL_WIDTH/2,
    y: c.y - LABEL_HEIGHT/2,
    width: LABEL_WIDTH,
    height: LABEL_HEIGHT,
    poi: pois[i]
  }));

  // Connector lengths:
  rects.forEach((r,i) => {
    const dx = pois[i].x - (r.x + r.width/2),
          dy = pois[i].y - (r.y + r.height/2);
    energy += dx*dx + dy*dy;
  });

  // Overlap penalties:
  for (let i=0; i<n; i++) {
    for (let j=i+1; j<n; j++) {
      if (rectsOverlap(rects[i], rects[j])) {
        energy += PENALTY_OVERLAP;
      }
    }
  }

  // Connector crossings:
  const allSegs = [];
  rects.forEach(r => allSegs.push(...buildConnector(r.poi, r)));
  for (let i=0; i<allSegs.length; i++) {
    for (let j=i+1; j<allSegs.length; j++) {
      if (intersects(
            allSegs[i].from, allSegs[i].to,
            allSegs[j].from, allSegs[j].to
          )) {
        energy += PENALTY_CROSSING;
      }
    }
  }

  // Out-of-bounds penalty:
  rects.forEach(r => {
    if (
      r.x < EDGE_PADDING ||
      r.y < EDGE_PADDING ||
      r.x + r.width  > mapW - EDGE_PADDING ||
      r.y + r.height > mapH - EDGE_PADDING
    ) {
      energy += PENALTY_OVERLAP;
    }
  });

  return energy;
}

function neighborAngles(angles) {
  const n = angles.length;
  const cand = angles.slice();
  if (Math.random() < 0.3) {
    const i = Math.floor(Math.random()*n),
          j = (i+1+Math.floor(Math.random()*(n-1)))%n;
    [cand[i], cand[j]] = [cand[j], cand[i]];
  } else {
    const k = Math.floor(Math.random()*n);
    cand[k] = (cand[k] + (Math.random()*2-1)*(Math.PI/n) + 2*Math.PI) % (2*Math.PI);
  }
  return cand;
}

function optimizeAngles(pois, centroid, rx, ry, mapW, mapH) {
  const n = pois.length;
  let angles = Array.from({length:n},(_,i)=>2*Math.PI*i/n),
      bestA  = angles.slice(),
      bestE  = computeEnergy(angles,pois,centroid,rx,ry,mapW,mapH),
      currE  = bestE,
      T      = SA.initialTemp;

  for (let i=0; i<SA.maxIter && T>SA.minTemp; i++, T*=SA.coolingRate) {
    const candA = neighborAngles(angles),
          candE = computeEnergy(candA,pois,centroid,rx,ry,mapW,mapH),
          dE    = candE - currE;

    if (dE < 0 || Math.random() < Math.exp(-dE/T)) {
      angles = candA; currE = candE;
      if (currE < bestE) {
        bestE = currE; bestA = angles.slice();
      }
    }
  }
  return bestA;
}

// --- MAIN EXPORT ---

export const generateProfessionalMapLayout = async (
  map, coords, amenities, mapContainer, overlayRef
) => {
  if (!map || !coords || !amenities?.length) return;
  overlayRef.current?.remove();

  // fit bounds
  const bounds = new mapboxgl.LngLatBounds();
  bounds.extend([coords.lng, coords.lat]);
  amenities.forEach(a => {
    if (a.coordinates) {
      bounds.extend([a.coordinates.lng, a.coordinates.lat]);
    }
  });
  map.fitBounds(bounds, { padding: 200, duration: 400 });
  await new Promise(res => map.once('idle', res));

  // overlay container
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:absolute; top:0; left:0;
    width:100%; height:100%;
    pointer-events:none; z-index:1000;
  `;
  mapContainer.appendChild(overlay);
  overlayRef.current = overlay;

  const W = mapContainer.clientWidth,
        H = mapContainer.clientHeight,
        svgNS = 'http://www.w3.org/2000/svg';

  // svg for connectors
  const svg = document.createElementNS(svgNS,'svg');
  svg.setAttribute('width',`${W}`); 
  svg.setAttribute('height',`${H}`);
  svg.style.cssText = `
    position:absolute; top:0; left:0;
    pointer-events:none; z-index:1001;
  `;

  // project POIs
  const pois = amenities
    .filter(a => a.coordinates)
    .map(a => {
      const p = map.project([a.coordinates.lng, a.coordinates.lat]);
      return { name: a.name, x: p.x, y: p.y, types: a.types };
    });

  // compute centroid & radii for ellipse
  const centroid = pois.reduce((c,p)=>({ x:c.x+p.x, y:c.y+p.y }),{x:0,y:0});
  centroid.x /= pois.length; 
  centroid.y /= pois.length;
  const rx = Math.min(
    centroid.x - EDGE_PADDING - LABEL_WIDTH/2,
    W - centroid.x - EDGE_PADDING - LABEL_WIDTH/2
  );
  const ry = Math.min(
    centroid.y - EDGE_PADDING - LABEL_HEIGHT/2,
    H - centroid.y - EDGE_PADDING - LABEL_HEIGHT/2
  );

  // optimize angles
  const angles = optimizeAngles(pois, centroid, rx, ry, W, H);

  // render each POI
  pois.forEach((poi, i) => {
    const θ  = angles[i],
          cx = centroid.x + Math.cos(θ)*rx,
          cy = centroid.y + Math.sin(θ)*ry,
          rect = {
            x: cx - LABEL_WIDTH/2,
            y: cy - LABEL_HEIGHT/2,
            width:  LABEL_WIDTH,
            height: LABEL_HEIGHT
          };

    // draw connector
    buildConnector(poi, rect).forEach(seg => {
      const path = document.createElementNS(svgNS,'path');
      path.setAttribute('d', `M${seg.from.x},${seg.from.y} L${seg.to.x},${seg.to.y}`);
      path.setAttribute('stroke', '#333');
      path.setAttribute('stroke-width', STROKE_WIDTH);
      path.setAttribute('fill', 'none');
      svg.appendChild(path);
    });

    // draw label
    const box = document.createElement('div');
    box.style.cssText = `
      position:absolute;
      left:${rect.x}px; top:${rect.y}px;
      width:${LABEL_WIDTH}px; height:${LABEL_HEIGHT}px;
      background:white; border:1px solid #333; border-radius:4px;
      box-shadow:0 2px 8px rgba(0,0,0,0.15);
      font:600 13px/1.2 Arial; padding:8px;
      pointer-events:none; z-index:1002;
      display:flex; align-items:center; white-space:nowrap;
    `;
    box.innerHTML = `
      <div style="flex-shrink:0;width:35px;height:35px;
                  background:#f0f0f0;border-radius:4px;
                  display:flex;align-items:center;
                  justify-content:center;margin-right:8px;">
        <div style="font-size:10px;color:#666;">⏳</div>
      </div>
      <div style="flex:1;font-size:13px;font-weight:600;">
        ${poi.name}
      </div>
    `;
    overlay.appendChild(box);

    // replace placeholder with icon/logo
    getPoiDisplayData(poi).then(d => {
      let html;
      if (d.type==='brand' && d.logo) {
        html = `
          <img src="${d.logo}"
            style="width:35px;height:35px;object-fit:contain;margin-right:8px"/>
          <div style="flex:1;font-size:13px;font-weight:600;">${poi.name}</div>`;
      } else {
        const icon = CATEGORY_ICONS[poi.types?.[0]] || CATEGORY_ICONS.default;
        html = `
          <div style="font-size:24px;margin-right:8px;line-height:35px;">${icon}</div>
          <div style="flex:1;font-size:13px;font-weight:600;">${poi.name}</div>`;
      }
      box.innerHTML = `<div style="display:flex;align-items:center;">${html}</div>`;
    }).catch(() => {
      const icon = CATEGORY_ICONS[poi.types?.[0]] || CATEGORY_ICONS.default;
      box.innerHTML = `
        <div style="font-size:24px;margin-right:8px;line-height:35px;">${icon}</div>
        <div style="flex:1;font-size:13px;font-weight:600;">${poi.name}</div>`;
    });

    // draw star
    const star = document.createElement('div');
    star.innerHTML = '★';
    star.style.cssText = `
      position:absolute;
      left:${poi.x-8}px; top:${poi.y-8}px;
      font-size:16px;color:black;
      text-shadow:0 0 3px #fff,0 0 5px #fff;
      pointer-events:none; z-index:1003;
    `;
    overlay.appendChild(star);
  });

  // append connectors first, then pin on top
  overlay.appendChild(svg);

  const cp = map.project([coords.lng, coords.lat]);
  const pin = document.createElement('div');
  pin.innerHTML = `
    <svg width="48" height="48" viewBox="0 0 24 24">
      <path fill="#FF3131"
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 
           7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>`;
  pin.style.cssText = `
    position:absolute;
    left:${cp.x-24}px; top:${cp.y-48}px;
    pointer-events:none;z-index:1004;
  `;
  overlay.appendChild(pin);
};
