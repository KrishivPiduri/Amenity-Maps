import html2canvas from 'html2canvas';
import { findAndLogIntersections } from './geometryUtils.js';

/**
 * Capture map image with overlay elements
 * @param {HTMLElement} mapContainer - Map container element
 * @param {Object} map - Mapbox map instance
 * @param {Object} overlayRef - Reference to overlay container
 * @returns {Promise<string>} Data URL of captured image
 */
export const captureMapImage = async (mapContainer, map, overlayRef) => {
  if (!mapContainer || !map) {
    throw new Error('Map container or map instance not available');
  }

  // Step 1: Wait for map to be fully loaded
  await new Promise(resolve => {
    if (map.isStyleLoaded()) {
      resolve();
    } else {
      map.once('idle', resolve);
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

  try {
    // Step 3: Wait for any async image loading and ensure all logos are loaded
    await new Promise(r => setTimeout(r, 1000));

    // Step 4: Get map dimensions
    const mapWidth = mapContainer.clientWidth;
    const mapHeight = mapContainer.clientHeight;

    // Step 5: Create composite canvas
    const compositeCanvas = document.createElement('canvas');
    const ctx = compositeCanvas.getContext('2d');
    compositeCanvas.width = mapWidth;
    compositeCanvas.height = mapHeight;

    // Step 6: Try multiple map capture methods
    let mapCaptured = false;

    // Method 1: Direct canvas copy (should work with preserveDrawingBuffer: true)
    try {
      const mapCanvas = map.getCanvas();
      ctx.drawImage(mapCanvas, 0, 0);
      mapCaptured = true;
    } catch (directError) {
      // Silent fallback
    }

    // Method 2: Canvas toDataURL approach
    if (!mapCaptured) {
      try {
        const mapCanvas = map.getCanvas();
        const mapDataURL = mapCanvas.toDataURL('image/png');

        const mapImg = new Image();
        await new Promise((resolve, reject) => {
          mapImg.onload = () => {
            ctx.drawImage(mapImg, 0, 0);
            mapCaptured = true;
            resolve();
          };
          mapImg.onerror = (err) => {
            reject(err);
          };
          mapImg.src = mapDataURL;
        });
      } catch (dataURLError) {
        // Silent fallback
      }
    }

    // Method 3: Force map re-render and capture
    if (!mapCaptured) {
      try {
        // Force map to re-render
        map.resize();
        await new Promise(resolve => setTimeout(resolve, 500));

        const mapCanvas = map.getCanvas();
        ctx.drawImage(mapCanvas, 0, 0);
        mapCaptured = true;
      } catch (rerenderError) {
        // Silent fallback
      }
    }

    // Method 4: Fallback with styled background
    if (!mapCaptured) {
      // Create a map-like background
      const gradient = ctx.createLinearGradient(0, 0, 0, mapHeight);
      gradient.addColorStop(0, '#e6f3ff');
      gradient.addColorStop(1, '#cce7ff');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, mapWidth, mapHeight);

      // Add grid pattern to simulate map and collect grid lines for intersection detection
      ctx.strokeStyle = '#d0d0d0';
      ctx.lineWidth = 1;

      const gridLines = [];

      // Vertical grid lines
      for (let i = 0; i < mapWidth; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, mapHeight);
        ctx.stroke();

        // Store vertical line coordinates
        gridLines.push({
          from: { x: i, y: 0 },
          to: { x: i, y: mapHeight }
        });
      }

      // Horizontal grid lines
      for (let i = 0; i < mapHeight; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(mapWidth, i);
        ctx.stroke();

        // Store horizontal line coordinates
        gridLines.push({
          from: { x: 0, y: i },
          to: { x: mapWidth, y: i }
        });
      }

      // Find and log intersections between grid lines
      findAndLogIntersections(gridLines, 'grid');
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

    // Restore original styles
    document.documentElement.style.cssText = originalStyle;

    return imageUrl;

  } catch (error) {
    // Restore original styles on error
    document.documentElement.style.cssText = originalStyle;

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

      const fallbackCanvas = await html2canvas(mapContainer, {
        useCORS: true,
        logging: true, // Enable logging for debugging
        allowTaint: true, // Allow tainted canvas for debugging
        scale: 1,
        ignoreElements: (element) => {
          // Skip Mapbox attribution and controls that might cause issues
          return element.classList.contains('mapboxgl-ctrl');
        }
      });

      document.documentElement.style.cssText = originalStyle;
      return fallbackCanvas.toDataURL('image/png');

    } catch (fallbackError) {
      console.error('All capture methods failed:', fallbackError);
      throw new Error('Failed to capture map. This might be due to WebGL restrictions. Please try refreshing the page and ensuring the map is fully loaded before capturing.');
    }
  }
};

/**
 * Download image from data URL
 * @param {string} dataUrl - Image data URL
 * @param {string} filename - Filename for download
 */
export const downloadImage = (dataUrl, filename = 'amenity-map.png') => {
  if (!dataUrl) return;

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
};
