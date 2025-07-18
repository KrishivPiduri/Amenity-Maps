import mapboxgl from 'mapbox-gl';
import { getPoiDisplayData, CATEGORY_ICONS } from './poiUtils.js';
import { findAndLogIntersections, findAndResolveIntersections } from './geometryUtils.js';

// Configuration constants
export const LABEL_MIN_HEIGHT = 50;
export const LABEL_MAX_HEIGHT = 80;
export const LABEL_WIDTH = 180;
export const V_SPACE = 10;
export const PADDING = 20;

/**
 * Generate professional map layout with labels and connector lines
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

  // Step 6: Smart label layout algorithm
  const mapWidth = mapContainer.clientWidth;
  const mapHeight = mapContainer.clientHeight;

  // Divide POIs by screen position
  const leftPois = poiPoints
    .filter(p => p.point.x < mapWidth / 2)
    .sort((a, b) => a.point.y - b.point.y);

  const rightPois = poiPoints
    .filter(p => p.point.x >= mapWidth / 2)
    .sort((a, b) => a.point.y - b.point.y);

  // Place labels on both sides (now async)
  const [leftLines, rightLines] = await Promise.all([
    placeLabels(leftPois, 'left', mapWidth, mapHeight, overlayNode),
    placeLabels(rightPois, 'right', mapWidth, mapHeight, overlayNode)
  ]);

  // Step 7: Draw SVG connector lines with intersection resolution
  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute('width', `${mapWidth}`);
  svg.setAttribute('height', `${mapHeight}`);
  svg.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
  `;

  // Collect all connector line coordinates for intersection detection and resolution
  const allConnectorLines = [...leftLines, ...rightLines];

  // Resolve intersections and get separated line arrays
  console.log('🔍 Analyzing and resolving connector line intersections...');
  const { originalLines, alternativeLines, hasIntersections } = findAndResolveIntersections(allConnectorLines, 'connector');

  // Draw original lines (non-intersecting) in black
  originalLines.forEach(({ from, to }) => {
    const line = document.createElementNS(svgNs, 'line');
    line.setAttribute('x1', `${from.x}`);
    line.setAttribute('y1', `${from.y}`);
    line.setAttribute('x2', `${to.x}`);
    line.setAttribute('y2', `${to.y}`);
    line.setAttribute('stroke', 'black');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('opacity', '0.8');
    svg.appendChild(line);
  });

  // Draw alternative lines (resolved intersections) in red
  alternativeLines.forEach(({ from, to, originalIndex }) => {
    const line = document.createElementNS(svgNs, 'line');
    line.setAttribute('x1', `${from.x}`);
    line.setAttribute('y1', `${from.y}`);
    line.setAttribute('x2', `${to.x}`);
    line.setAttribute('y2', `${to.y}`);
    line.setAttribute('stroke', 'red');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('opacity', '0.9');
    line.setAttribute('stroke-dasharray', '5,3'); // Dashed line to make it more obvious
    svg.appendChild(line);
  });

  // Add legend if there are alternative lines
  if (hasIntersections) {
    const legend = document.createElement('div');
    legend.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(255, 255, 255, 0.9);
      padding: 8px;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      font-size: 12px;
      font-family: Arial, sans-serif;
      z-index: 1002;
    `;
    legend.innerHTML = `
      <div style="margin-bottom: 4px;"><span style="color: black; font-weight: bold;">━</span> Original lines</div>
      <div><span style="color: red; font-weight: bold;">┅</span> Resolved intersections</div>
    `;
    overlayNode.appendChild(legend);
  }

  overlayNode.appendChild(svg);
};

/**
 * Label placement function with async logo fetching and dynamic sizing
 * @param {Array} poiList - List of POI objects with points
 * @param {string} side - 'left' or 'right'
 * @param {number} mapWidth - Map container width
 * @param {number} mapHeight - Map container height
 * @param {HTMLElement} overlayNode - Overlay container element
 * @returns {Promise<Array>} Array of connector line coordinates
 */
const placeLabels = async (poiList, side, mapWidth, mapHeight, overlayNode) => {
  let currentY = 0; // Remove vertical padding constraint
  const labelPromises = [];

  // First pass: create all labels with placeholders and collect promises
  for (const { poi, point } of poiList) {
    // Calculate dynamic label width based on text length
    const textLength = poi.name.length;
    const dynamicWidth = Math.max(LABEL_WIDTH, Math.min(textLength * 8 + 60, 300)); // Min 180px, max 300px
    // Calculate dynamic height - allow more height for longer text
    const estimatedLines = Math.ceil(textLength / 20); // Rough estimate of text lines
    const dynamicHeight = Math.max(LABEL_MIN_HEIGHT, Math.min(estimatedLines * 20 + 30, LABEL_MAX_HEIGHT));

    const labelX = side === 'left' ?
      PADDING :
      mapWidth - dynamicWidth - PADDING;

    // Remove vertical padding constraint - allow labels to go to edge
    const labelY = Math.min(currentY, mapHeight - dynamicHeight);
    currentY += dynamicHeight + V_SPACE;

    // Create label element with loading state and dynamic dimensions
    const label = document.createElement('div');
    label.style.cssText = `
      position: absolute;
      left: ${labelX}px;
      top: ${labelY}px;
      width: ${dynamicWidth}px;
      min-height: ${dynamicHeight}px;
      max-height: ${LABEL_MAX_HEIGHT}px;
      background: white;
      border: 1px solid black;
      display: flex;
      align-items: flex-start;
      padding: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      pointer-events: none;
      box-sizing: border-box;
    `;

    // Add loading placeholder with improved text styling
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

    // Create promise to update label content
    const labelPromise = getPoiDisplayData(poi).then(displayData => {
      let logoHtml = '';
      if (displayData.type === 'brand' && displayData.logo) {
        logoHtml = `
          <div style="display: flex; align-items: flex-start; width: 100%; gap: 8px;">
            <img src="${displayData.logo}" 
              style="height: 35px; width: auto; max-width: 60px; object-fit: contain; flex-shrink: 0;" 
              alt="${poi.name} logo" 
              crossorigin="anonymous"
              onload="this.style.opacity='1'"
              >
            <div style="display: none; font-size: 20px; flex-shrink: 0;">${CATEGORY_ICONS[poi.types?.[0]] || CATEGORY_ICONS.default}</div>
            <div style="font-size: 12px; line-height: 1.3; font-weight: 600; word-wrap: break-word; flex: 1; overflow-wrap: break-word; hyphens: auto;">
              ${poi.name}
            </div>
          </div>
        `;
      } else if (displayData.type === 'category') {
        logoHtml = `
          <div style="display: flex; align-items: flex-start; width: 100%; gap: 8px;">
            <div style="font-size: 20px; flex-shrink: 0;">${displayData.icon}</div>
            <div style="font-size: 12px; line-height: 1.3; font-weight: 600; word-wrap: break-word; flex: 1; overflow-wrap: break-word; hyphens: auto;">
              ${poi.name}
            </div>
          </div>
        `;
      }

      // Update label content
      label.innerHTML = logoHtml;

      return displayData;
    }).catch(error => {
      console.error('Error loading POI display data:', error);
      // Fallback to category icon with improved text styling
      const primaryType = poi.types?.[0] || 'default';
      const icon = CATEGORY_ICONS[primaryType] || CATEGORY_ICONS.default;
      label.innerHTML = `
        <div style="display: flex; align-items: flex-start; width: 100%; gap: 8px;">
          <div style="font-size: 20px; flex-shrink: 0;">${icon}</div>
          <div style="font-size: 12px; line-height: 1.3; font-weight: 600; word-wrap: break-word; flex: 1; overflow-wrap: break-word; hyphens: auto;">
            ${poi.name}
          </div>
        </div>
      `;
    });

    labelPromises.push(labelPromise);

    // Store connector line coordinates with dynamic width
    labelPromises[labelPromises.length - 1].lineCoords = {
      from: { x: point.x, y: point.y },
      to: {
        x: side === 'left' ? labelX + dynamicWidth : labelX,
        y: labelY + dynamicHeight / 2 // Use actual dynamic height for connector
      }
    };
  }

  // Wait for all logos to load or timeout after 3 seconds
  await Promise.allSettled(labelPromises.map(p =>
    Promise.race([p, new Promise(resolve => setTimeout(resolve, 3000))])
  ));

  // Return connector line coordinates
  return labelPromises.map(promise => promise.lineCoords);
};
