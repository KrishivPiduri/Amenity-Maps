import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { generateProfessionalMapLayout } from '../utils/mapLayoutUtils.js';
import { captureMapImage, downloadImage } from '../utils/imageUtils.js';

// You'll need to add your Mapbox access token here
const MAPBOX_TOKEN = 'pk.eyJ1IjoiZW1pci1kYW5pc2lrIiwiYSI6ImNtY25wNXN3eDA5NnYybHBwbmI1OGk5ZzYifQ.ylvc39cPbQysrVCRW_JcHA';

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

  // Image capture process - Fixed to capture both map and overlay
  const handleCaptureMapImage = async () => {
    if (!mapContainer.current || !map.current) return;

    setIsGenerating(true);

    try {
      const imageUrl = await captureMapImage(mapContainer.current, map.current, overlayRef);
      setGeneratedMapUrl(imageUrl);
    } catch (error) {
      console.error('Error capturing map:', error);
      alert(error.message || 'Failed to capture map. Please try again.');
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
    setTimeout(() => {
      generateProfessionalMapLayout(
        map.current,
        coords,
        amenities,
        mapContainer.current,
        overlayRef
      );
    }, 500);

  }, [amenities, coords]);

  const handleDownloadImage = () => {
    downloadImage(generatedMapUrl, 'amenity-map.png');
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
          onClick={handleCaptureMapImage}
          disabled={isGenerating || !amenities.length}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 mb-2 w-full"
        >
          {isGenerating ? 'Generating...' : 'Capture Map'}
        </button>

        {generatedMapUrl && (
          <button
            onClick={handleDownloadImage}
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

