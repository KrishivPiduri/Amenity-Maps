import { useState, useEffect, useRef } from 'react';

// ===== CONFIGURATION =====
const API_KEY = "AIzaSyBnxpK2n_vnXX5CoDMN6mFk3rgJ2Mi6S24";

// ===== GOOGLE MAPS API LOADING =====
let googleMapsPromise = null;

/**
 * Loads the Google Maps JavaScript API with Places library
 * Uses singleton pattern to prevent multiple script loads
 * @returns {Promise<google>} Promise that resolves to the Google Maps API object
 */
const loadGoogleMaps = () => {
  if (!googleMapsPromise) {
    googleMapsPromise = new Promise((resolve, reject) => {
      // Check if Google Maps is already available
      if (window.google) {
        resolve(window.google);
        return;
      }

      // Create and configure the script element
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;

      // Handle successful loading
      script.onload = () => resolve(window.google);

      // Handle loading errors
      script.onerror = (error) => reject(new Error('Failed to load Google Maps API'));

      document.head.appendChild(script);
    });
  }
  return googleMapsPromise;
};

// ===== CUSTOM HOOK =====

/**
 * Custom React hook for managing Google Maps services
 * Provides geocoder and places service instances along with required DOM element
 *
 * @returns {Object} Object containing:
 *   - services: { geocoder, placesService } - Google Maps service instances
 *   - placesServiceDiv: React element required by PlacesService for attributions
 *   - loading: boolean indicating if services are still loading
 *   - error: string containing any loading errors
 */
export const useGoogleMapsService = () => {
  // State for managing service instances
  const [services, setServices] = useState({
    geocoder: null,
    placesService: null
  });

  // State for loading and error handling
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Ref for the div element required by PlacesService
  const placesServiceDivRef = useRef(null);

  useEffect(() => {
    /**
     * Initialize Google Maps services
     * Creates geocoder and places service instances when API loads
     */
    const initializeServices = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load the Google Maps API
        const google = await loadGoogleMaps();

        // Create geocoder service
        const geocoder = new google.maps.Geocoder();

        // Create places service (requires a DOM element for attributions)
        let placesService = null;
        if (placesServiceDivRef.current) {
          placesService = new google.maps.places.PlacesService(placesServiceDivRef.current);
        }

        // Update state with initialized services
        setServices({ geocoder, placesService });
        setLoading(false);

      } catch (err) {
        console.error("Failed to load Google Maps API", err);
        setError(err.message || "Failed to load Google Maps API");
        setLoading(false);
      }
    };

    initializeServices();
  }, []);

  return {
    services,
    loading,
    error,
    // Hidden div element required by PlacesService for displaying attributions
    placesServiceDiv: (
      <div
        ref={placesServiceDivRef}
        style={{ display: 'none' }}
        aria-hidden="true"
        data-testid="places-service-attribution"
      />
    )
  };
};
