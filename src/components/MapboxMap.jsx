import {useEffect, useRef, useState} from 'react';
import mapboxgl from 'mapbox-gl';
import html2canvas from 'html2canvas';
import 'mapbox-gl/dist/mapbox-gl.css';

// You'll need to add your Mapbox access token here
const MAPBOX_TOKEN = 'pk.eyJ1IjoiZW1pci1kYW5pc2lrIiwiYSI6ImNtY25wNXN3eDA5NnYybHBwbmI1OGk5ZzYifQ.ylvc39cPbQysrVCRW_JcHA';

// Configuration constants
const LABEL_HEIGHT = 50;
const LABEL_WIDTH = 180;
const V_SPACE = 10;
const PADDING = 20;

// Brand logo mappings for major POI brands
const BRAND_LOGOS = {
  'starbucks': 'https://logos-world.net/wp-content/uploads/2020/05/Starbucks-Emblem.png',
  'mcdonalds': 'https://logos-world.net/wp-content/uploads/2020/04/McDonalds-Logo.png',
  'subway': 'https://logos-world.net/wp-content/uploads/2020/05/Subway-Logo.png',
  'walmart': 'https://logos-world.net/wp-content/uploads/2020/05/Walmart-Logo.png',
  'target': 'https://logos-world.net/wp-content/uploads/2020/04/Target-Logo.png',
  'cvs': 'https://logos-world.net/wp-content/uploads/2020/12/CVS-Logo.png',
  'walgreens': 'https://logos-world.net/wp-content/uploads/2020/12/Walgreens-Logo.png',
  'shell': 'https://logos-world.net/wp-content/uploads/2020/04/Shell-Logo.png',
  'exxon': 'https://logos-world.net/wp-content/uploads/2020/06/Exxon-Mobil-Logo.png',
  'bp': 'https://logos-world.net/wp-content/uploads/2020/06/BP-Logo.png'
};

// Category icons for fallback when no brand logo is available
const CATEGORY_ICONS = {
  'restaurant': '🍽️',
  'food': '🍽️',
  'gas_station': '⛽',
  'grocery_or_supermarket': '🛒',
  'pharmacy': '💊',
  'bank': '🏦',
  'hospital': '🏥',
  'school': '🏫',
  'gym': '💪',
  'shopping_mall': '🛍️',
  'store': '🏪',
  'cafe': '☕',
  'bar': '🍺',
  'lodging': '🏨',
  'default': '📍'
};

/**
 * Get display data for a POI (logo or icon + category)
 */
const getPoiDisplayData = (poi) => {
  const name = poi.name?.toLowerCase() || '';
  const types = poi.types || [];

  // Check for brand logos first
  for (const [brand, logo] of Object.entries(BRAND_LOGOS)) {
    if (name.includes(brand)) {
      return { type: 'brand', logo, name: poi.name };
    }
  }

  // Fallback to category icons
  const primaryType = types[0] || 'default';
  const icon = CATEGORY_ICONS[primaryType] || CATEGORY_ICONS.default;

  return { type: 'category', icon, name: poi.name };
};

/**
 * Professional MapboxMap component with sophisticated amenity layout and image capture
 */
const MapboxMap = ({ coords, amenities = [], className = '' }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const centerMarkerRef = useRef(null);
  const overlayRef = useRef(null);

  const [generatedMapUrl, setGeneratedMapUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!coords || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [coords.lng, coords.lat],
      zoom: 14
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [coords]);

  // Generate professional amenity map with labels and connector lines
  const generateProfessionalMap = async () => {
    if (!map.current || !amenities.length || !coords) return;

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
    map.current.fitBounds(bounds, { padding: 200, duration: 1500 });

    // Wait for map animation to complete
    await new Promise(resolve => map.current?.once('idle', resolve));

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
    mapContainer.current.appendChild(overlayNode);
    overlayRef.current = overlayNode;

    // Step 3: Project coordinates to screen pixels
    const centerPoint = map.current.project([coords.lng, coords.lat]);
    const poiPoints = amenities
      .filter(amenity => amenity.coordinates)
      .map(amenity => ({
        poi: amenity,
        point: map.current.project([amenity.coordinates.lng, amenity.coordinates.lat])
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
    const mapWidth = mapContainer.current.clientWidth;
    const mapHeight = mapContainer.current.clientHeight;

    // Divide POIs by screen position
    const leftPois = poiPoints
      .filter(p => p.point.x < mapWidth / 2)
      .sort((a, b) => a.point.y - b.point.y);

    const rightPois = poiPoints
      .filter(p => p.point.x >= mapWidth / 2)
      .sort((a, b) => a.point.y - b.point.y);

    // Label placement function
    const placeLabels = (poiList, side) => {
      let currentY = PADDING;

      return poiList.map(({ poi, point }) => {
        const labelX = side === 'left' ?
          PADDING :
          mapWidth - LABEL_WIDTH - PADDING;

        const labelY = Math.min(currentY, mapHeight - LABEL_HEIGHT - PADDING);
        currentY += LABEL_HEIGHT + V_SPACE;

        // Create label element
        const displayData = getPoiDisplayData(poi);
        const label = document.createElement('div');
        label.style.cssText = `
          position: absolute;
          left: ${labelX}px;
          top: ${labelY}px;
          width: ${LABEL_WIDTH}px;
          height: ${LABEL_HEIGHT}px;
          background: white;
          border: 1px solid black;
          display: flex;
          align-items: center;
          padding: 5px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          pointer-events: none;
        `;

        // Generate label content
        let logoHtml = '';
        if (displayData.type === 'brand' && displayData.logo) {
          logoHtml = `<img src="${displayData.logo}" 
            style="height: 35px; width: auto; max-width: 100%; object-fit: contain;" 
            alt="${poi.name} logo" 
            crossorigin="anonymous">`;
        } else if (displayData.type === 'category') {
          logoHtml = `
            <div style="font-size: 24px; margin-right: 8px;">${displayData.icon}</div>
            <div style="font-size: 12px; line-height: 1.2; font-weight: 600; word-wrap: break-word;">
              ${poi.name}
            </div>
          `;
        }

        label.innerHTML = logoHtml;
        overlayNode.appendChild(label);

        // Return connector line coordinates
        return {
          from: { x: point.x, y: point.y },
          to: {
            x: side === 'left' ? labelX + LABEL_WIDTH : labelX,
            y: labelY + LABEL_HEIGHT / 2
          }
        };
      });
    };

    // Place labels on both sides
    const leftLines = placeLabels(leftPois, 'left');
    const rightLines = placeLabels(rightPois, 'right');

    // Step 7: Draw SVG connector lines
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

    [...leftLines, ...rightLines].forEach(({ from, to }) => {
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

    overlayNode.appendChild(svg);
  };

  // Image capture process
  const captureMapImage = async () => {
    if (!mapContainer.current) return;

    setIsGenerating(true);

    try {
      // Step 1: CSS Variable Override - critical for html2canvas compatibility
      const originalStyle = document.documentElement.style.cssText;

      document.documentElement.style.cssText = `
        --background: #ffffff;
        --foreground: #000000;
        --card: #ffffff;
        --card-foreground: #000000;
        --primary: #000000;
        --primary-foreground: #ffffff;
        --border: #e5e5e5;
        --ring: #999999;
      `;

      // Additional scrubbing for any remaining oklch/oklab values
      const root = document.documentElement;
      const computed = getComputedStyle(root);
      for (let i = 0; i < computed.length; i++) {
        const name = computed[i];
        const value = computed.getPropertyValue(name);
        if (value.includes('oklab') || value.includes('oklch')) {
          root.style.setProperty(name, '#000');
        }
      }

      // Step 2: Wait for any async image loading
      await new Promise(r => setTimeout(r, 500));

      // Step 3: Canvas generation
      const canvas = await html2canvas(mapContainer.current, {
        useCORS: true,
        logging: false,
        allowTaint: false,
        scale: 1
      });

      // Step 4: Convert to downloadable image
      const imageUrl = canvas.toDataURL('image/png');
      setGeneratedMapUrl(imageUrl);

      // Restore original styles
      document.documentElement.style.cssText = originalStyle;

    } catch (error) {
      console.error('Error capturing map:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle amenity changes
  useEffect(() => {
    if (!map.current || !amenities.length) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add center marker
    if (centerMarkerRef.current) {
      centerMarkerRef.current.remove();
    }

    centerMarkerRef.current = new mapboxgl.Marker({ color: 'red' })
      .setLngLat([coords.lng, coords.lat])
      .setPopup(new mapboxgl.Popup().setHTML('<div><strong>Search Location</strong></div>'))
      .addTo(map.current);

    // Generate the professional map layout
    setTimeout(() => generateProfessionalMap(), 500);

  }, [amenities, coords]);

  const downloadImage = () => {
    if (!generatedMapUrl) return;

    const link = document.createElement('a');
    link.download = 'amenity-map.png';
    link.href = generatedMapUrl;
    link.click();
  };

  return (
    <div className={`relative ${className}`}>
      <div
        ref={mapContainer}
        className="w-full h-full min-h-[600px] rounded-lg"
        style={{ minHeight: '600px' }}
      />

      {/* Control Panel */}
      <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-lg z-[1001]">
        <button
          onClick={captureMapImage}
          disabled={isGenerating || !amenities.length}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 mb-2 w-full"
        >
          {isGenerating ? 'Generating...' : 'Capture Map'}
        </button>

        {generatedMapUrl && (
          <button
            onClick={downloadImage}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 w-full"
          >
            Download Image
          </button>
        )}
      </div>

      {/* Generated Image Preview */}
      {generatedMapUrl && (
        <div className="absolute bottom-4 right-4 bg-white p-2 rounded-lg shadow-lg z-[1001]">
          <img
            src={generatedMapUrl}
            alt="Generated map preview"
            className="w-32 h-24 object-cover rounded"
          />
        </div>
      )}
    </div>
  );
};

export default MapboxMap;
