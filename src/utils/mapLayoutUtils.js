import mapboxgl from 'mapbox-gl';
import { getPoiDisplayData, CATEGORY_ICONS } from './poiUtils.js';

// Configuration constants
export const LABEL_MIN_HEIGHT = 50;
export const LABEL_MAX_HEIGHT = 80;
export const LABEL_WIDTH = 180;
export const V_SPACE = 10;
export const PADDING = 20;

// Simulated Annealing Parameters
export const SA_PARAMS = {
  initialTemperature: 1000,
  coolingRate: 0.95,
  minTemperature: 1,
  maxIterations: 1000,
  maxIterationsWithoutImprovement: 100
};

/**
 * Check if two rectangles overlap
 */
const rectanglesOverlap = (rect1, rect2) => {
  return !(rect1.x + rect1.width < rect2.x ||
           rect2.x + rect2.width < rect1.x ||
           rect1.y + rect1.height < rect2.y ||
           rect2.y + rect2.height < rect1.y);
};

/**
 * Check if two line segments intersect
 */
const linesIntersect = (line1, line2) => {
  const { x: x1, y: y1 } = line1.from;
  const { x: x2, y: y2 } = line1.to;
  const { x: x3, y: y3 } = line2.from;
  const { x: x4, y: y4 } = line2.to;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return false;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
};

/**
 * Check if a line passes through a rectangle
 */
const linePassesThroughRectangle = (line, rect) => {
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

  return edges.some(edge => linesIntersect(line, edge));
};

/**
 * Calculate the energy (cost) of a layout configuration
 */
const calculateEnergy = (labels, lines, mapWidth, mapHeight) => {
  let energy = 0;

  // Penalty for overlapping labels
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (rectanglesOverlap(labels[i].rect, labels[j].rect)) {
        energy += 1000; // High penalty for overlapping labels
      }
    }
  }

  // Penalty for intersecting lines
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      if (linesIntersect(lines[i], lines[j])) {
        energy += 500; // Medium penalty for intersecting lines
      }
    }
  }

  // Penalty for lines passing through labels
  for (const line of lines) {
    for (const label of labels) {
      if (linePassesThroughRectangle(line, label.rect)) {
        energy += 750; // High penalty for lines through labels
      }
    }
  }

  // Penalty for labels going out of bounds
  for (const label of labels) {
    if (label.rect.x < 0 || label.rect.y < 0 ||
        label.rect.x + label.rect.width > mapWidth ||
        label.rect.y + label.rect.height > mapHeight) {
      energy += 2000; // Very high penalty for out of bounds
    }
  }

  // Preference for shorter connector lines
  for (const line of lines) {
    const length = Math.sqrt(
      Math.pow(line.to.x - line.from.x, 2) +
      Math.pow(line.to.y - line.from.y, 2)
    );
    energy += length * 0.1; // Small penalty for longer lines
  }

  // Preference for labels near screen edges (easier to read)
  for (const label of labels) {
    const centerX = label.rect.x + label.rect.width / 2;
    const centerY = label.rect.y + label.rect.height / 2;
    const distanceFromEdge = Math.min(
      centerX,
      mapWidth - centerX,
      centerY,
      mapHeight - centerY
    );
    if (distanceFromEdge > 100) {
      energy += (distanceFromEdge - 100) * 0.5; // Prefer labels near edges
    }
  }

  return energy;
};

/**
 * Generate a random neighboring solution
 */
const generateNeighbor = (labels, lines, poiPoints, mapWidth, mapHeight) => {
  const newLabels = [...labels];
  const newLines = [...lines];

  // Randomly select a label to move
  const labelIndex = Math.floor(Math.random() * newLabels.length);
  const label = { ...newLabels[labelIndex] };

  // Generate a random new position within bounds
  const maxX = mapWidth - label.rect.width;
  const maxY = mapHeight - label.rect.height;

  const newX = Math.random() * maxX;
  const newY = Math.random() * maxY;

  label.rect = {
    ...label.rect,
    x: newX,
    y: newY
  };

  newLabels[labelIndex] = label;

  // Update corresponding line
  const poiPoint = poiPoints[labelIndex].point;
  newLines[labelIndex] = {
    from: { x: poiPoint.x, y: poiPoint.y },
    to: {
      x: newX + label.rect.width / 2,
      y: newY + label.rect.height / 2
    }
  };

  return { labels: newLabels, lines: newLines };
};

/**
 * Simulated Annealing algorithm for optimal label placement
 */
const simulatedAnnealing = (poiPoints, mapWidth, mapHeight) => {
  // Initialize random solution
  let currentLabels = poiPoints.map((poi, index) => {
    const width = Math.max(LABEL_WIDTH, Math.min(poi.poi.name.length * 8 + 60, 300));
    const height = Math.max(LABEL_MIN_HEIGHT, Math.min(Math.ceil(poi.poi.name.length / 20) * 20 + 30, LABEL_MAX_HEIGHT));

    return {
      poi: poi.poi,
      rect: {
        x: Math.random() * (mapWidth - width),
        y: Math.random() * (mapHeight - height),
        width,
        height
      }
    };
  });

  let currentLines = currentLabels.map((label, index) => ({
    from: { x: poiPoints[index].point.x, y: poiPoints[index].point.y },
    to: {
      x: label.rect.x + label.rect.width / 2,
      y: label.rect.y + label.rect.height / 2
    }
  }));

  let currentEnergy = calculateEnergy(currentLabels, currentLines, mapWidth, mapHeight);
  let bestLabels = [...currentLabels];
  let bestLines = [...currentLines];
  let bestEnergy = currentEnergy;

  let temperature = SA_PARAMS.initialTemperature;
  let iterationsWithoutImprovement = 0;

  console.log('🔥 Starting Simulated Annealing optimization...');
  console.log(`Initial energy: ${currentEnergy.toFixed(2)}`);

  for (let iteration = 0; iteration < SA_PARAMS.maxIterations; iteration++) {
    // Generate neighbor solution
    const neighbor = generateNeighbor(currentLabels, currentLines, poiPoints, mapWidth, mapHeight);
    const neighborEnergy = calculateEnergy(neighbor.labels, neighbor.lines, mapWidth, mapHeight);

    // Calculate acceptance probability
    const deltaE = neighborEnergy - currentEnergy;
    const acceptanceProbability = deltaE < 0 ? 1 : Math.exp(-deltaE / temperature);

    // Accept or reject the neighbor
    if (Math.random() < acceptanceProbability) {
      currentLabels = neighbor.labels;
      currentLines = neighbor.lines;
      currentEnergy = neighborEnergy;
      iterationsWithoutImprovement = 0;

      // Update best solution if this is better
      if (neighborEnergy < bestEnergy) {
        bestLabels = [...neighbor.labels];
        bestLines = [...neighbor.lines];
        bestEnergy = neighborEnergy;
        console.log(`✅ New best solution found at iteration ${iteration}: energy = ${bestEnergy.toFixed(2)}`);
      }
    } else {
      iterationsWithoutImprovement++;
    }

    // Cool down temperature
    temperature *= SA_PARAMS.coolingRate;

    // Early termination conditions
    if (temperature < SA_PARAMS.minTemperature ||
        iterationsWithoutImprovement > SA_PARAMS.maxIterationsWithoutImprovement) {
      console.log(`🛑 Optimization terminated at iteration ${iteration}`);
      break;
    }

    // Progress logging
    if (iteration % 100 === 0) {
      console.log(`Iteration ${iteration}: current energy = ${currentEnergy.toFixed(2)}, temperature = ${temperature.toFixed(2)}`);
    }
  }

  console.log(`🎯 Final best energy: ${bestEnergy.toFixed(2)}`);
  return { labels: bestLabels, lines: bestLines };
};

/**
 * Generate professional map layout with labels and connector lines using Simulated Annealing
 * @param {Object} map - Mapbox map instance
 * @param {Object} coords - Center coordinates
 * @param {Array} amenities - Array of amenity objects
 * @param {HTMLElement} mapContainer - Map container element
 * @param {Object} overlayRef - Reference to overlay container
 * @returns {Promise<void>}
 */
export const generateProfessionalMapLayout = async (map, coords, amenities, mapContainer, overlayRef) => {
  if (!map || !amenities.length || !coords) return;

  // Clear existing overlays
  if (overlayRef.current) {
    overlayRef.current.remove();
  }

  // Step 1: Calculate optimal map bounds
  const bounds = new mapboxgl.LngLatBounds();
  bounds.extend([coords.lng, coords.lat]);
  amenities.forEach(amenity => {
    if (amenity.coordinates) {
      bounds.extend([amenity.coordinates.lng, amenity.coordinates.lat]);
    }
  });

  // Fit map to show all points with padding
  map.fitBounds(bounds, { padding: 200, duration: 1500 });

  // Wait for map animation to complete
  await new Promise(resolve => map?.once('idle', resolve));

  // Step 2: Create overlay container
  const overlayNode = document.createElement('div');
  overlayNode.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1000;
  `;
  mapContainer.appendChild(overlayNode);
  overlayRef.current = overlayNode;

  // Step 3: Project coordinates to screen pixels
  const centerPoint = map.project([coords.lng, coords.lat]);
  const poiPoints = amenities
    .filter(amenity => amenity.coordinates)
    .map(amenity => ({
      poi: amenity,
      point: map.project([amenity.coordinates.lng, amenity.coordinates.lat])
    }));

  // Step 4: Add property marker (red pin)
  const propertyMarker = document.createElement('div');
  propertyMarker.innerHTML = `
    <svg width="48" height="48" viewBox="0 0 24 24" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
      <path fill="#FF3131" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
      <circle cx="12" cy="9" r="2.5" fill="white"></circle>
    </svg>
  `;
  propertyMarker.style.cssText = `
    position: absolute;
    left: ${centerPoint.x - 24}px;
    top: ${centerPoint.y - 48}px;
    pointer-events: none;
  `;
  overlayNode.appendChild(propertyMarker);

  // Step 5: Add POI markers (black stars)
  poiPoints.forEach(({ point }) => {
    const marker = document.createElement('div');
    marker.innerHTML = '★';
    marker.style.cssText = `
      position: absolute;
      left: ${point.x - 8}px;
      top: ${point.y - 8}px;
      font-size: 16px;
      color: black;
      text-shadow: 0 0 3px white, 0 0 5px white;
      pointer-events: none;
    `;
    overlayNode.appendChild(marker);
  });

  // Step 6: Use Simulated Annealing for optimal label placement
  console.log('🧠 Using Simulated Annealing for intelligent label placement...');
  const mapWidth = mapContainer.clientWidth;
  const mapHeight = mapContainer.clientHeight;

  const { labels: optimizedLabels, lines: optimizedLines } = simulatedAnnealing(
    poiPoints,
    mapWidth,
    mapHeight
  );

  // Step 7: Draw optimized connector lines FIRST (so they appear behind labels)
  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute('width', `${mapWidth}`);
  svg.setAttribute('height', `${mapHeight}`);
  svg.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 1001;
  `;

  optimizedLines.forEach(line => {
    const lineElement = document.createElementNS(svgNs, 'line');
    lineElement.setAttribute('x1', `${line.from.x}`);
    lineElement.setAttribute('y1', `${line.from.y}`);
    lineElement.setAttribute('x2', `${line.to.x}`);
    lineElement.setAttribute('y2', `${line.to.y}`);
    lineElement.setAttribute('stroke', 'black');
    lineElement.setAttribute('stroke-width', '1.5');
    lineElement.setAttribute('opacity', '0.8');
    svg.appendChild(lineElement);
  });

  // Add SVG first so lines are behind labels
  overlayNode.appendChild(svg);

  // Step 8: Create optimized labels AFTER lines (so they appear on top)
  const labelPromises = optimizedLabels.map(async (labelConfig, index) => {
    const { poi, rect } = labelConfig;

    // Create label element
    const label = document.createElement('div');
    label.style.cssText = `
      position: absolute;
      left: ${rect.x}px;
      top: ${rect.y}px;
      width: ${rect.width}px;
      min-height: ${rect.height}px;
      max-height: ${LABEL_MAX_HEIGHT}px;
      background: white;
      border: 1px solid black;
      display: flex;
      align-items: flex-start;
      padding: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      pointer-events: none;
      box-sizing: border-box;
      z-index: 1002;
    `;

    // Add loading placeholder
    label.innerHTML = `
      <div style="display: flex; align-items: flex-start; width: 100%; gap: 8px;">
        <div style="width: 35px; height: 35px; background: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <div style="font-size: 10px; color: #666;">⏳</div>
        </div>
        <div style="font-size: 12px; line-height: 1.3; font-weight: 600; word-wrap: break-word; flex: 1; overflow-wrap: break-word; hyphens: auto;">
          ${poi.name}
        </div>
      </div>
    `;

    overlayNode.appendChild(label);

    // Load display data and update label
    try {
      const displayData = await getPoiDisplayData(poi);
      let logoHtml = '';

      if (displayData.type === 'brand' && displayData.logo) {
        logoHtml = `
          <div style="display: flex; align-items: flex-start; width: 100%; gap: 8px;">
            <img src="${displayData.logo}" 
              style="height: 35px; width: auto; max-width: 60px; object-fit: contain; flex-shrink: 0;" 
              alt="${poi.name} logo" 
              crossorigin="anonymous"
              >
            <div style="font-size: 12px; line-height: 1.3; font-weight: 600; word-wrap: break-word; flex: 1; overflow-wrap: break-word; hyphens: auto;">
              ${poi.name}
            </div>
          </div>
        `;
      } else {
        const icon = displayData.icon || CATEGORY_ICONS[poi.types?.[0]] || CATEGORY_ICONS.default;
        logoHtml = `
          <div style="display: flex; align-items: flex-start; width: 100%; gap: 8px;">
            <div style="font-size: 20px; flex-shrink: 0;">${icon}</div>
            <div style="font-size: 12px; line-height: 1.3; font-weight: 600; word-wrap: break-word; flex: 1; overflow-wrap: break-word; hyphens: auto;">
              ${poi.name}
            </div>
          </div>
        `;
      }

      label.innerHTML = logoHtml;
    } catch (error) {
      console.error('Error loading POI display data:', error);
      const icon = CATEGORY_ICONS[poi.types?.[0]] || CATEGORY_ICONS.default;
      label.innerHTML = `
        <div style="display: flex; align-items: flex-start; width: 100%; gap: 8px;">
          <div style="font-size: 20px; flex-shrink: 0;">${icon}</div>
          <div style="font-size: 12px; line-height: 1.3; font-weight: 600; word-wrap: break-word; flex: 1; overflow-wrap: break-word; hyphens: auto;">
            ${poi.name}
          </div>
        </div>
      `;
    }
  });

  // Wait for all labels to load
  await Promise.allSettled(labelPromises);

  // Add optimization info legend (highest z-index)
  const infoLegend = document.createElement('div');
  infoLegend.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(255, 255, 255, 0.9);
    padding: 8px;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    font-size: 12px;
    font-family: Arial, sans-serif;
    z-index: 1003;
  `;
  overlayNode.appendChild(infoLegend);
};
