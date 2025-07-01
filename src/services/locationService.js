const API_KEY = "AIzaSyBnxpK2n_vnXX5CoDMN6mFk3rgJ2Mi6S24";

// Load Google Maps JavaScript API
let googleMapsLoaded = false;
let googleMapsPromise = null;

const loadGoogleMaps = () => {
  console.log('🔄 Loading Google Maps API...');

  if (googleMapsLoaded && window.google) {
    console.log('✅ Google Maps already loaded');
    return Promise.resolve(window.google);
  }

  if (googleMapsPromise) {
    console.log('⏳ Google Maps loading in progress...');
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    if (window.google) {
      console.log('✅ Google Maps found in window');
      googleMapsLoaded = true;
      resolve(window.google);
      return;
    }

    console.log('📥 Creating script tag for Google Maps API');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log('✅ Google Maps API loaded successfully');
      googleMapsLoaded = true;
      resolve(window.google);
    };

    script.onerror = (error) => {
      console.error('❌ Failed to load Google Maps API:', error);
      reject(new Error('Failed to load Google Maps API'));
    };

    document.head.appendChild(script);
    console.log('📤 Script tag added to document head');
  });

  return googleMapsPromise;
};

/**
 * Get coordinates from an address using Google Maps JavaScript SDK
 */
export const getCoordinatesFromAddress = async (address) => {
  console.log('🔍 Starting geocoding for address:', address);

  if (!address.trim()) {
    throw new Error('Please enter a valid address.');
  }

  try {
    const google = await loadGoogleMaps();
    console.log('✅ Google Maps loaded, creating geocoder...');
    const geocoder = new google.maps.Geocoder();

    return new Promise((resolve, reject) => {
      console.log('🌍 Calling geocoder.geocode...');
      geocoder.geocode({ address }, (results, status) => {
        console.log('📍 Geocoding response - Status:', status, 'Results:', results);

        if (status === 'OK' && results.length > 0) {
          const location = results[0].geometry.location;
          const result = {
            lat: location.lat(),
            lng: location.lng(),
            formattedAddress: results[0].formatted_address
          };
          console.log('✅ Geocoding successful:', result);
          resolve(result);
        } else {
          console.error('❌ Geocoding failed - Status:', status);
          reject(new Error('No results found for the provided address.'));
        }
      });
    });
  } catch (error) {
    console.error('❌ Geocoding error:', error);
    throw new Error(`Geocoding error: ${error.message}`);
  }
};

/**
 * Get nearby amenities using Google Places JavaScript SDK
 */
export const getNearbyAmenities = async (lat, lng, radius = 1000) => {
  console.log('🏪 Starting places search for coordinates:', lat, lng, 'radius:', radius);

  try {
    const google = await loadGoogleMaps();
    console.log('✅ Google Maps loaded for places search');

    // Create a proper div element and add it to the DOM temporarily
    const serviceDiv = document.createElement('div');
    serviceDiv.style.display = 'none';
    document.body.appendChild(serviceDiv);

    const service = new google.maps.places.PlacesService(serviceDiv);
    const location = new google.maps.LatLng(lat, lng);
    console.log('📍 Created LatLng object and PlacesService with proper DOM element');

    return new Promise((resolve, reject) => {
      const request = {
        location: location,
        radius: radius,
        // Use a single type instead of array for better compatibility
        type: 'restaurant'
      };

      console.log('🔍 Calling nearbySearch with request:', request);

      service.nearbySearch(request, (results, status) => {
        // Clean up the DOM element
        document.body.removeChild(serviceDiv);

        console.log('🏪 Places search response - Status:', status, 'Results count:', results?.length);

        if (status === google.maps.places.PlacesServiceStatus.OK) {
          const amenities = results.map(place => ({
            id: place.place_id,
            name: place.name,
            types: place.types || [],
            rating: place.rating,
            priceLevel: place.price_level,
            vicinity: place.vicinity,
            openNow: place.opening_hours?.open_now,
            photoReference: place.photos?.[0]?.photo_reference,
            photoUrl: place.photos?.[0] ? place.photos[0].getUrl({ maxWidth: 200 }) : null
          }));
          console.log('✅ Places search successful, mapped amenities:', amenities.length);
          resolve(amenities);
        } else {
          console.error('❌ Places search failed - Status:', status);
          reject(new Error(`Places API error: ${status}`));
        }
      });
    });
  } catch (error) {
    console.error('❌ Places service error:', error);
    throw new Error(`Places service error: ${error.message}`);
  }
};

/**
 * Get photo URL from photo reference or return SDK photo URL
 */
export const getPhotoUrl = (photoReference, maxWidth = 400) => {
  if (!photoReference) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${API_KEY}`;
};
