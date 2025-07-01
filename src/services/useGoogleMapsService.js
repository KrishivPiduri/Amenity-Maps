import { useState, useEffect, useRef } from 'react';

const API_KEY = "AIzaSyBnxpK2n_vnXX5CoDMN6mFk3rgJ2Mi6S24";

let googleMapsPromise = null;

const loadGoogleMaps = () => {
  if (!googleMapsPromise) {
    googleMapsPromise = new Promise((resolve, reject) => {
      if (window.google) {
        resolve(window.google);
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = (error) => reject(error);
      document.head.appendChild(script);
    });
  }
  return googleMapsPromise;
};

export const useGoogleMapsService = () => {
  const [services, setServices] = useState({ geocoder: null, placesService: null });
  const placesServiceDivRef = useRef(null);

  useEffect(() => {
    loadGoogleMaps().then(google => {
      const geocoder = new google.maps.Geocoder();
      if (placesServiceDivRef.current) {
        const placesService = new google.maps.places.PlacesService(placesServiceDivRef.current);
        setServices({ geocoder, placesService });
      }
    }).catch(error => {
      console.error("Failed to load Google Maps API", error);
    });
  }, []);

  return {
    services,
    // This div is required by the PlacesService for attributions
    placesServiceDiv: <div ref={placesServiceDivRef} style={{ display: 'none' }} />
  };
};
