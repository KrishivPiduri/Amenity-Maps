import { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// You'll need to add your Mapbox access token here
const MAPBOX_TOKEN = 'pk.eyJ1IjoiZW1pci1kYW5pc2lrIiwiYSI6ImNtY25wNXN3eDA5NnYybHBwbmI1OGk5ZzYifQ.ylvc39cPbQysrVCRW_JcHA';

/**
 * Simple MapboxMap component with basic markers
 * @param {Object} coords - Center coordinates {lat, lng}
 * @param {Array} amenities - Array of amenity objects with coordinates and names
 * @param {string} className - CSS classes for styling
 */
const MapboxMap = ({ coords, amenities = [], className = '' }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const centerMarkerRef = useRef(null);

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

    // Add simple marker for the searched location (red)
    centerMarkerRef.current = new mapboxgl.Marker({ color: 'red' })
      .setLngLat([coords.lng, coords.lat])
      .setPopup(new mapboxgl.Popup().setHTML('<div><strong>Search Location</strong></div>'))
      .addTo(map.current);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [coords]);

  // Handle amenity markers separately - this will run whenever amenities change
  useEffect(() => {
    if (!map.current) return;

    // Clear existing amenity markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // If no amenities, just return
    if (!amenities || amenities.length === 0) return;

    // Add simple blue markers for each amenity
    amenities.forEach((amenity) => {
      //if (!amenity.geometry?.location) return;

      const { lat, lng } = amenity.geometry.location;

      // Create simple popup content
      /*const popupContent = `
        <div>
          <strong>${amenity.name}</strong><br/>
          ${amenity.types?.[0] || 'Amenity'}<br/>
          ${amenity.vicinity || ''}
        </div>
      `;*/

      //const popup = new mapboxgl.Popup().setHTML(popupContent);

      centerMarkerRef.current = new mapboxgl.Marker({ color: 'red' })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup().setHTML('<div><strong>Search Location</strong></div>'))
          .addTo(map.current);

      //markersRef.current.push(marker);
    });

    // Fit map to show all markers after amenities are added
    if (amenities.length > 0 && coords) {
      const bounds = new mapboxgl.LngLatBounds();

      // Add center point
      bounds.extend([coords.lng, coords.lat]);

      // Add all amenity points
      amenities.forEach(amenity => {
        if (amenity.geometry?.location) {
          bounds.extend([amenity.geometry.location.lng, amenity.geometry.location.lat]);
        }
      });

      // Zoom out to fit all markers with padding
      map.current.fitBounds(bounds, {
        padding: 80,
        maxZoom: 15
      });
    }
  }, [amenities, coords]); // This effect depends on both amenities and coords

  return (
    <div className={`relative ${className}`}>
      <div
        ref={mapContainer}
        className="w-full h-full min-h-[400px] rounded-lg"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
};

export default MapboxMap;
