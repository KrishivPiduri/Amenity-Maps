import {useEffect, useRef, useState} from 'react';
import mapboxgl from 'mapbox-gl';
import html2canvas from 'html2canvas';
import 'mapbox-gl/dist/mapbox-gl.css';


// You'll need to add your Mapbox access token here
const MAPBOX_TOKEN = 'pk.eyJ1IjoiZW1pci1kYW5pc2lrIiwiYSI6ImNtY25wNXN3eDA5NnYybHBwbmI1OGk5ZzYifQ.ylvc39cPbQysrVCRW_JcHA';

// Brandfetch API configuration
const BRANDFETCH_API_KEY = 'HMHMAUXlZLFR4kLzfYjWFz4CyaQ+C5sC/ZkN+rs98+Y='; // Replace with actual API key
const BRANDFETCH_BASE_URL = 'https://api.brandfetch.io/v2';

// Configuration constants
const LABEL_MIN_HEIGHT = 50;
const LABEL_MAX_HEIGHT = 80;
const LABEL_WIDTH = 180;
const V_SPACE = 10;
const PADDING = 20;

// Cache for fetched logos to avoid duplicate API calls
const logoCache = new Map();

/**
 * Fetch brand logo from Brandfetch API
 * @param {string} domain - The domain to fetch logo for
 * @returns {Promise<string|null>} Logo URL or null if not found
 */
const fetchBrandLogo = async (domain) => {
  console.log(`🌐 Attempting to fetch logo for domain: ${domain}`);

  // Check cache first
  if (logoCache.has(domain)) {
    const cachedResult = logoCache.get(domain);
    console.log(`💾 Cache hit for ${domain}: ${cachedResult ? 'has logo' : 'no logo'}`);
    return cachedResult;
  }

  try {
    console.log(`📡 Making API request to Brandfetch for: ${domain}`);
    const response = await fetch(`${BRANDFETCH_BASE_URL}/brands/${domain}`, {
      headers: {
        'Authorization': `Bearer ${BRANDFETCH_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📊 Brandfetch API response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.log(`❌ Brandfetch API failed for ${domain}: ${response.status} ${response.statusText}`);
      logoCache.set(domain, null);
      return null;
    }

    const data = await response.json();
    console.log(`📦 Brandfetch API response data for ${domain}:`, data);

    // Get the best logo (prefer icon format, then logo)
    const logos = data.logos || [];
    console.log(`🎨 Found ${logos.length} logos for ${domain}:`, logos.map(l => ({ type: l.type, formats: l.formats?.length || 0 })));

    const bestLogo = logos.find(logo => logo.type === 'icon') ||
                    logos.find(logo => logo.type === 'logo') ||
                    logos[0];

    if (!bestLogo) {
      console.log(`❌ No usable logo found for ${domain}`);
      logoCache.set(domain, null);
      return null;
    }

    console.log(`🎯 Selected logo for ${domain}:`, { type: bestLogo.type, formats: bestLogo.formats?.length || 0 });

    const logoUrl = bestLogo?.formats?.find(format =>
      format.format === 'png' || format.format === 'svg' || format.format === 'jpeg' || format.format === 'webp'
    )?.src || null;

    if (logoUrl) {
      console.log(`✅ Logo URL found for ${domain}: ${logoUrl}`);
    } else {
      console.log(`❌ No supported format (PNG/SVG/JPEG/WebP) found for ${domain}`);
      console.log(`Available formats:`, bestLogo?.formats?.map(f => f.format));
    }

    // Cache the result
    logoCache.set(domain, logoUrl);
    return logoUrl;

  } catch (error) {
    console.error(`💥 Error fetching logo for ${domain}:`, error);
    logoCache.set(domain, null);
    return null;
  }
};

/**
 * Extract domain from POI name for Brandfetch lookup
 * @param {string} name - POI name
 * @returns {string|null} Domain to lookup or null
 */
const extractDomainFromName = (name) => {
  const normalizedName = name.toLowerCase().trim();
  console.log(`🔍 Trying to match: "${normalizedName}"`);

  // Known brand mappings to domains
  const brandDomains = {
    'starbucks': 'starbucks.com',
    'mcdonalds': 'mcdonalds.com',
    'mcdonald\'s': 'mcdonalds.com',
    'subway': 'subway.com',
    'walmart': 'walmart.com',
    'target': 'target.com',
    'cvs': 'cvs.com',
    'walgreens': 'walgreens.com',
    'shell': 'shell.com',
    'exxon': 'exxonmobil.com',
    'mobil': 'exxonmobil.com',
    'bp': 'bp.com',
    'chevron': 'chevron.com',
    'texaco': 'texaco.com',
    'circle k': 'circlek.com',
    '7-eleven': '7eleven.com',
    'best buy': 'bestbuy.com',
    'home depot': 'homedepot.com',
    'lowes': 'lowes.com',
    'costco': 'costco.com',
    'sam\'s club': 'samsclub.com',
    'kroger': 'kroger.com',
    'safeway': 'safeway.com',
    'whole foods': 'wholefoodsmarket.com',
    'trader joe\'s': 'traderjoes.com',
    'chipotle': 'chipotle.com',
    'taco bell': 'tacobell.com',
    'kfc': 'kfc.com',
    'pizza hut': 'pizzahut.com',
    'domino\'s': 'dominos.com',
    'papa john\'s': 'papajohns.com',
    'dunkin\'': 'dunkindonuts.com',
    'dunkin donuts': 'dunkindonuts.com',
    'tim hortons': 'timhortons.com',
    'panera': 'panerabread.com',
    'panera bread': 'panerabread.com'
  };

  // Check for exact matches first
  if (brandDomains[normalizedName]) {
    console.log(`✅ Exact match found: "${normalizedName}" -> ${brandDomains[normalizedName]}`);
    return brandDomains[normalizedName];
  }

  // Check for partial matches - sort by length descending to match longer brands first
  const sortedBrands = Object.entries(brandDomains).sort((a, b) => b[0].length - a[0].length);

  for (const [brand, domain] of sortedBrands) {
    // Use word boundary matching for better accuracy
    const brandWords = brand.split(/\s+/);
    const nameWords = normalizedName.split(/\s+/);

    console.log(`  🔎 Checking brand "${brand}" (${brandWords.join(', ')}) against name words (${nameWords.join(', ')})`);

    // Check if all words from the brand appear in the name
    const allWordsMatch = brandWords.every(brandWord => {
      const found = nameWords.some(nameWord => nameWord.includes(brandWord));
      console.log(`    • Brand word "${brandWord}" ${found ? '✅ found' : '❌ not found'} in name words`);
      return found;
    });

    if (allWordsMatch) {
      console.log(`✅ Word match found: "${normalizedName}" -> brand "${brand}" -> ${domain}`);
      return domain;
    }
  }

  // Fallback to simple includes check
  console.log(`🔄 Trying fallback simple includes check...`);
  for (const [brand, domain] of sortedBrands) {
    if (normalizedName.includes(brand)) {
      console.log(`✅ Fallback matched "${normalizedName}" to brand "${brand}" -> ${domain}`);
      return domain;
    }
  }

  console.log(`❌ No brand match found for: "${normalizedName}"`);
  return null;
};

/**
 * Get display data for a POI (logo or icon + category) with Brandfetch integration
 * @param {Object} poi - POI object
 * @returns {Promise<Object>} Display data with type, logo/icon, and name
 */
const getPoiDisplayData = async (poi) => {
  const name = poi.name || '';
  const types = poi.types || [];

  // Try to get brand logo from Brandfetch
  const domain = extractDomainFromName(name);
  if (domain) {
    try {
      const logoUrl = await fetchBrandLogo(domain);
      if (logoUrl) {
        return {
          type: 'brand',
          logo: logoUrl,
          name: poi.name,
          isAsync: true
        };
      }
    } catch (error) {
      console.error('Error fetching brand logo:', error);
    }
  }

  // Fallback to category icons
  const primaryType = types[0] || 'default';
  const icon = CATEGORY_ICONS[primaryType] || CATEGORY_ICONS.default;

  return {
    type: 'category',
    icon,
    name: poi.name,
    isAsync: false
  };
};

// Category icons for fallback when no brand logo is available
const CATEGORY_ICONS = {
  'restaurant': '🍽️',
  'food': '🍽️',
  'gas_station': '⛽',
  'grocery_or_supermarket': '🛒',
  'pharmacy': '💊',
  'finance': '🏦',
  'hospital': '🏥',
  'gym': '💪',
  'shopping_mall': '🛍️',
  'store': '🏪',
  'cafe': '☕',
  'bar': '🍺',
  'park': '🌳',
  'primary_school': '🏫',
  'secondary_school': '🏫',
  'atm': '🏦',
  'bank': '🏦',
  'library': '📚',
  'lodging': '🏨',
  'default': '📍'
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
      zoom: 14,
      preserveDrawingBuffer: true, // Critical for canvas capture
      // Disable all interactions initially
      interactive: false,
      scrollZoom: false,
      boxZoom: false,
      dragRotate: false,
      dragPan: false,
      keyboard: false,
      doubleClickZoom: false,
      touchZoomRotate: false
    });

    // Don't add navigation controls since we want the map frozen

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [coords]);

  // Generate professional map with labels and connector lines
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

    // Label placement function with async logo fetching and dynamic sizing
    const placeLabels = async (poiList, side) => {
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
                  onerror="this.style.display='none'; this.nextElementSibling.style.display='block'"
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

    // Place labels on both sides (now async)
    const [leftLines, rightLines] = await Promise.all([
      placeLabels(leftPois, 'left'),
      placeLabels(rightPois, 'right')
    ]);

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

  // Image capture process - Fixed to capture both map and overlay
  const captureMapImage = async () => {
    if (!mapContainer.current || !map.current) return;

    setIsGenerating(true);

    try {
      // Step 1: Wait for map to be fully loaded
      await new Promise(resolve => {
        if (map.current.isStyleLoaded()) {
          resolve();
        } else {
          map.current.once('idle', resolve);
        }
      });

      // Step 2: CSS Variable Override - critical for html2canvas compatibility
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

      // Step 3: Wait for any async image loading and ensure all logos are loaded
      await new Promise(r => setTimeout(r, 1000));

      // Step 4: Get map dimensions
      const mapWidth = mapContainer.current.clientWidth;
      const mapHeight = mapContainer.current.clientHeight;

      // Step 5: Create composite canvas
      const compositeCanvas = document.createElement('canvas');
      const ctx = compositeCanvas.getContext('2d');
      compositeCanvas.width = mapWidth;
      compositeCanvas.height = mapHeight;

      // Step 6: Try multiple map capture methods
      let mapCaptured = false;

      // Method 1: Direct canvas copy (should work with preserveDrawingBuffer: true)
      try {
        const mapCanvas = map.current.getCanvas();
        console.log('Attempting direct canvas copy...');
        ctx.drawImage(mapCanvas, 0, 0);
        mapCaptured = true;
        console.log('✅ Direct canvas copy successful');
      } catch (directError) {
        console.log('❌ Direct canvas copy failed:', directError);
      }

      // Method 2: Canvas toDataURL approach
      if (!mapCaptured) {
        try {
          const mapCanvas = map.current.getCanvas();
          const mapDataURL = mapCanvas.toDataURL('image/png');
          console.log('Attempting canvas toDataURL...');

          const mapImg = new Image();
          await new Promise((resolve, reject) => {
            mapImg.onload = () => {
              ctx.drawImage(mapImg, 0, 0);
              mapCaptured = true;
              console.log('✅ Canvas toDataURL successful');
              resolve();
            };
            mapImg.onerror = (err) => {
              console.log('❌ Canvas toDataURL failed:', err);
              reject(err);
            };
            mapImg.src = mapDataURL;
          });
        } catch (dataURLError) {
          console.log('❌ Canvas toDataURL method failed:', dataURLError);
        }
      }

      // Method 3: Force map re-render and capture
      if (!mapCaptured) {
        try {
          console.log('Attempting force re-render...');
          // Force map to re-render
          map.current.resize();
          await new Promise(resolve => setTimeout(resolve, 500));

          const mapCanvas = map.current.getCanvas();
          ctx.drawImage(mapCanvas, 0, 0);
          mapCaptured = true;
          console.log('✅ Force re-render successful');
        } catch (rerenderError) {
          console.log('❌ Force re-render failed:', rerenderError);
        }
      }

      // Method 4: Fallback with styled background
      if (!mapCaptured) {
        console.log('⚠️ All map capture methods failed, using styled background');
        // Create a map-like background
        const gradient = ctx.createLinearGradient(0, 0, 0, mapHeight);
        gradient.addColorStop(0, '#e6f3ff');
        gradient.addColorStop(1, '#cce7ff');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, mapWidth, mapHeight);

        // Add grid pattern to simulate map
        ctx.strokeStyle = '#d0d0d0';
        ctx.lineWidth = 1;
        for (let i = 0; i < mapWidth; i += 50) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, mapHeight);
          ctx.stroke();
        }
        for (let i = 0; i < mapHeight; i += 50) {
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(mapWidth, i);
          ctx.stroke();
        }
      }

      // Step 7: Capture overlay elements
      if (overlayRef.current) {
        try {
          const overlayCanvas = await html2canvas(overlayRef.current, {
            useCORS: true,
            logging: false,
            allowTaint: false,
            scale: 1,
            backgroundColor: null,
            width: mapWidth,
            height: mapHeight
          });

          // Draw overlay on top of map
          ctx.drawImage(overlayCanvas, 0, 0);

        } catch (overlayError) {
          console.error('Failed to capture overlay:', overlayError);
        }
      }

      // Step 8: Convert to downloadable image
      const imageUrl = compositeCanvas.toDataURL('image/png', 1.0);
      setGeneratedMapUrl(imageUrl);

      // Restore original styles
      document.documentElement.style.cssText = originalStyle;

    } catch (error) {
      console.error('Error capturing map:', error);

      // Ultimate fallback: capture the entire container
      try {
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

        const fallbackCanvas = await html2canvas(mapContainer.current, {
          useCORS: true,
          logging: true, // Enable logging for debugging
          allowTaint: true, // Allow tainted canvas for debugging
          scale: 1,
          ignoreElements: (element) => {
            // Skip Mapbox attribution and controls that might cause issues
            return element.classList.contains('mapboxgl-ctrl');
          }
        });

        setGeneratedMapUrl(fallbackCanvas.toDataURL('image/png'));
        document.documentElement.style.cssText = originalStyle;

      } catch (fallbackError) {
        console.error('All capture methods failed:', fallbackError);
        alert('Failed to capture map. This might be due to WebGL restrictions. Please try refreshing the page and ensuring the map is fully loaded before capturing.');
      }
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

    // Remove center marker since we have overlay pin
    if (centerMarkerRef.current) {
      centerMarkerRef.current.remove();
      centerMarkerRef.current = null;
    }

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
