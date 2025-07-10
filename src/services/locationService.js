// ===== CONFIGURATION =====
const API_KEY = "AIzaSyBnxpK2n_vnXX5CoDMN6mFk3rgJ2Mi6S24";

// List of well-known brand names for filtering
const WELL_KNOWN_BRANDS = [
  // Fast Food & Restaurants
  'starbucks', 'mcdonald', 'subway', 'pizza hut', 'domino', 'kfc', 'burger king',
  'taco bell', 'wendy', 'chipotle', 'panera', 'dunkin', 'tim hortons', 'popeyes',
  'chick-fil-a', 'papa john', 'little caesars', 'dairy queen', 'arby', 'sonic',
  'five guys', 'in-n-out', 'white castle', 'papa murphy', 'jimmy john',

  // Banks & Financial
  'chase', 'bank of america', 'wells fargo', 'citibank', 'td bank', 'pnc bank',
  'us bank', 'capital one', 'regions bank', 'bb&t', 'suntrust', 'fifth third',
  'huntington bank', 'key bank', 'citizens bank', 'comerica', 'zions bank',

  // Pharmacies & Healthcare
  'cvs', 'walgreens', 'rite aid', 'walmart pharmacy', 'kroger pharmacy',
  'kaiser permanente', 'urgent care', 'minute clinic',

  // Retail & Grocery
  'walmart', 'target', 'whole foods', 'trader joe', 'safeway', 'kroger',
  'publix', 'albertsons', 'wegmans', 'giant', 'stop & shop', 'food lion',
  'harris teeter', 'king soopers', 'fred meyer', 'costco', 'sam\'s club',
  'home depot', 'lowe\'s', 'best buy', 'staples', 'office depot',

  // Gas Stations
  'shell', 'exxon', 'bp', 'chevron', 'mobil', 'texaco', 'citgo', 'sunoco',
  'speedway', 'marathon', 'valero', 'phillips 66', '76', 'arco', 'wawa',
  '7-eleven', 'circle k', 'casey\'s',

  // Fitness & Gyms
  'planet fitness', 'la fitness', '24 hour fitness', 'gold\'s gym', 'lifetime fitness',
  'snap fitness', 'anytime fitness', 'crossfit', 'orange theory', 'pure barre',

  // Hotels & Lodging
  'marriott', 'hilton', 'hyatt', 'best western', 'holiday inn', 'hampton inn',
  'comfort inn', 'quality inn', 'motel 6', 'super 8', 'days inn', 'la quinta',
  'courtyard', 'residence inn', 'extended stay', 'homewood suites',

  // Coffee & Cafes
  'starbucks', 'dunkin', 'tim hortons', 'caribou coffee', 'peet\'s coffee',
  'panera bread', 'einstein bros', 'bruegger\'s bagels',

  // Auto Services
  'jiffy lube', 'valvoline instant oil', 'midas', 'firestone', 'goodyear',
  'discount tire', 'pep boys', 'autozone', 'advance auto parts', 'o\'reilly',

  // Other Services
  'fedex', 'ups', 'usps', 'dhl', 'kinko\'s', 'ups store', 'mailboxes etc',
  'great clips', 'supercuts', 'sport clips', 'fantastic sams'
];

// Search keywords for finding nearby amenities - expanded to include more types
const AMENITY_KEYWORDS = [
  'bank', 'bar', 'cafe', 'hospital', 'park', 'pharmacy',
  'school', 'supermarket', 'gym', 'restaurant', 'shopping_mall', 'store',
  'gas_station', 'atm', 'lodging', 'museum', 'library', 'post_office',
  'movie_theater', 'beauty_salon', 'car_repair', 'dentist', 'doctor',
  'veterinary_care', 'night_club', 'amusement_park', 'zoo', 'church'
];

// Constants for API calls
const PAGINATION_DELAY_MS = 200;

// ===== GOOGLE MAPS API LOADING =====
let googleMapsLoaded = false;
let googleMapsPromise = null;

/**
 * Loads the Google Maps JavaScript API with Places library
 * Uses singleton pattern to avoid multiple script loads
 * @returns {Promise<google>} Promise that resolves to the Google Maps API object
 */
const loadGoogleMaps = () => {
  // Return immediately if already loaded
  if (googleMapsLoaded && window.google) {
    return Promise.resolve(window.google);
  }

  // Return existing promise if loading is in progress
  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    // Check if Google Maps is already available
    if (window.google) {
      googleMapsLoaded = true;
      resolve(window.google);
      return;
    }

    // Create and configure the script element
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;

    // Handle successful loading
    script.onload = () => {
      googleMapsLoaded = true;
      resolve(window.google);
    };

    // Handle loading errors
    script.onerror = () => {
      reject(new Error('Failed to load Google Maps API'));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
};

// ===== GEOCODING FUNCTIONS =====

/**
 * Converts an address string to geographic coordinates
 * @param {google.maps.Geocoder} geocoder - Google Maps Geocoder instance
 * @param {string} address - The address to geocode
 * @returns {Promise<{lat: number, lng: number, formattedAddress: string}>} Location data
 * @throws {Error} When address is invalid or geocoding fails
 */
export const getCoordinatesFromAddress = async (geocoder, address) => {
  if (!address || !address.trim()) {
    throw new Error('Please enter a valid address.');
  }

  return new Promise((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results.length > 0) {
        const location = results[0].geometry.location;
        const result = {
          lat: location.lat(),
          lng: location.lng(),
          formattedAddress: results[0].formatted_address
        };
        resolve(result);
      } else {
        reject(new Error('No results found for the provided address.'));
      }
    });
  });
};

// ===== PLACES API FUNCTIONS =====

/**
 * Fetches all results from a Places API search, handling pagination
 * @param {google.maps.places.PlacesService} placesService - Places service instance
 * @param {Object} request - Search request parameters
 * @returns {Promise<Array>} All search results across all pages
 */
const fetchAllPlacesResults = (placesService, request) => {
  return new Promise((resolve, reject) => {
    let allAmenities = [];

    const handleResults = (results, status, pagination) => {
      // Check for API errors
      if (status !== window.google.maps.places.PlacesServiceStatus.OK &&
          status !== window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        return reject(new Error(`Places API error: ${status}`));
      }

      // Accumulate results
      if (results) {
        allAmenities = allAmenities.concat(results);
      }

      // Handle pagination
      if (pagination && pagination.hasNextPage) {
        // Add delay to avoid rate limiting
        setTimeout(() => {
          pagination.nextPage(handleResults);
        }, PAGINATION_DELAY_MS);
      } else {
        resolve(allAmenities);
      }
    };

    placesService.nearbySearch(request, handleResults);
  });
};

/**
 * Fetches detailed information for a single place including coordinates
 * @param {google.maps.places.PlacesService} placesService - Places service instance
 * @param {Object} place - Basic place information from search
 * @returns {Promise<Object>} Detailed place information with coordinates
 */
const fetchPlaceDetails = (placesService, place) => {
  return new Promise((resolveDetail) => {
    const detailRequest = {
      placeId: place.place_id,
      // Include geometry field to get coordinates
      fields: ['place_id', 'name', 'types', 'rating', 'price_level', 'vicinity', 'photos', 'user_ratings_total', 'geometry']
    };

    placesService.getDetails(detailRequest, (detailResult, detailStatus) => {
      const baseInfo = {
        id: place.place_id,
        name: place.name,
        types: place.types || [],
        rating: place.rating,
        priceLevel: place.price_level,
        vicinity: place.vicinity,
        photoReference: place.photos?.[0]?.photo_reference,
        photoUrl: place.photos?.[0] ? place.photos[0].getUrl({ maxWidth: 200 }) : null,
        user_ratings_total: place.user_ratings_total,
        // Try to get coordinates from the basic place info (if available)
        coordinates: place.geometry?.location ? {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        } : null
      };

      if (detailStatus === window.google.maps.places.PlacesServiceStatus.OK) {
        // Use detailed information if available, including coordinates
        resolveDetail({
          ...baseInfo,
          id: detailResult.place_id,
          name: detailResult.name,
          types: detailResult.types || baseInfo.types,
          rating: detailResult.rating || baseInfo.rating,
          priceLevel: detailResult.price_level || baseInfo.priceLevel,
          vicinity: detailResult.vicinity || baseInfo.vicinity,
          photoReference: detailResult.photos?.[0]?.photo_reference || baseInfo.photoReference,
          photoUrl: detailResult.photos?.[0] ? detailResult.photos[0].getUrl({ maxWidth: 200 }) : baseInfo.photoUrl,
          user_ratings_total: detailResult.user_ratings_total || baseInfo.user_ratings_total,
          // Get coordinates from detailed result
          coordinates: detailResult.geometry?.location ? {
            lat: detailResult.geometry.location.lat(),
            lng: detailResult.geometry.location.lng()
          } : baseInfo.coordinates
        });
      } else {
        // Fallback to base info if getDetails fails
        resolveDetail(baseInfo);
      }
    });
  });
};

/**
 * Checks if a place name matches any well-known brand
 * @param {string} placeName - The name of the place to check
 * @returns {boolean} True if the place name contains a well-known brand
 */
const isWellKnownBrand = (placeName) => {
  if (!placeName) return false;

  const normalizedName = placeName.toLowerCase();

  return WELL_KNOWN_BRANDS.some(brand => {
    // Check for exact matches and partial matches
    return normalizedName.includes(brand.toLowerCase());
  });
};

/**
 * Filters amenities to keep only those with well-known brand names
 * @param {Array} amenities - Array of amenity objects from Places API
 * @returns {Array} Filtered array containing only well-known brands
 */
const filterWellKnownBrands = (amenities) => {
  return amenities.filter(amenity => isWellKnownBrand(amenity.name));
};

/**
 * Main function to get nearby amenities filtered by well-known brands
 * @param {google.maps.places.PlacesService} placesService - Places service instance
 * @param {number} lat - Latitude coordinate
 * @param {number} lng - Longitude coordinate
 * @param {number} radius - Search radius in meters (default: 5000)
 * @returns {Promise<Array>} Array of well-known brand amenities with details
 */
export const getNearbyAmenities = async (placesService, lat, lng, radius = 5000) => {
  const location = new window.google.maps.LatLng(lat, lng);

  // Configure search request
  const request = {
    location: location,
    radius: radius,
    keyword: AMENITY_KEYWORDS.join(' | '),
  };

  // Fetch all results from Places API
  const allAmenities = await fetchAllPlacesResults(placesService, request);

  if (allAmenities.length === 0) {
    return [];
  }

  // Filter to keep only well-known brands
  const brandAmenities = filterWellKnownBrands(allAmenities);

  if (brandAmenities.length === 0) {
    return [];
  }

  // Fetch detailed information for brand amenities
  const detailedAmenityPromises = brandAmenities.map(place =>
    fetchPlaceDetails(placesService, place)
  );

  return Promise.all(detailedAmenityPromises);
};

// ===== UTILITY FUNCTIONS =====

/**
 * Generates a photo URL from a Google Places photo reference
 * @param {string} photoReference - Photo reference from Places API
 * @param {number} maxWidth - Maximum width for the photo (default: 400)
 * @returns {string|null} Photo URL or null if no reference provided
 */
export const getPhotoUrl = (photoReference, maxWidth = 400) => {
  if (!photoReference) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${API_KEY}`;
};

// Export the Google Maps loader for use in components
export { loadGoogleMaps };
