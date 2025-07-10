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

// ===== BRAND FILTERING =====

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
 * Calculate prominence score based on brand recognition
 * @param {string} placeName - The name of the place
 * @returns {number} Prominence score (0-100)
 */
const calculateProminenceScore = (placeName) => {
  if (!placeName) return 0;

  const normalizedName = placeName.toLowerCase();

  // Check if it's a well-known brand
  const isKnownBrand = WELL_KNOWN_BRANDS.some(brand =>
    normalizedName.includes(brand.toLowerCase())
  );

  if (isKnownBrand) {
    return 100; // Maximum score for well-known brands
  }

  return 0; // No score for unknown brands
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in meters
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lng2-lng1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

/**
 * Calculate proximity score based on distance from input location
 * @param {number} distance - Distance in meters
 * @param {number} maxDistance - Maximum search radius in meters
 * @returns {number} Proximity score (0-100)
 */
const calculateProximityScore = (distance, maxDistance = 5000) => {
  if (distance >= maxDistance) return 0;

  // Linear decay: closer = higher score
  return Math.max(0, 100 * (1 - distance / maxDistance));
};

/**
 * Calculate overall score for a place
 * @param {Object} place - Place object from Places API
 * @param {number} inputLat - Input location latitude
 * @param {number} inputLng - Input location longitude
 * @param {number} maxDistance - Maximum search radius
 * @returns {number} Overall score (0-200)
 */
const calculatePlaceScore = (place, inputLat, inputLng, maxDistance = 5000) => {
  // Get place coordinates
  const placeLat = place.geometry?.location?.lat() || place.coordinates?.lat;
  const placeLng = place.geometry?.location?.lng() || place.coordinates?.lng;

  if (!placeLat || !placeLng) {
    return 0; // No score if coordinates are missing
  }

  // Calculate distance from input location
  const distance = calculateDistance(inputLat, inputLng, placeLat, placeLng);

  // Calculate component scores
  const proximityScore = calculateProximityScore(distance, maxDistance);
  const prominenceScore = calculateProminenceScore(place.name);

  // Weighted combination: proximity (60%) + prominence (40%)
  const totalScore = (proximityScore * 0.6) + (prominenceScore * 0.4);

  return Math.round(totalScore * 100) / 100; // Round to 2 decimal places
};

/**
 * Selects top 6 places based on combined proximity and prominence scoring
 * @param {Array} amenities - Raw amenities from Places API
 * @param {number} inputLat - Input location latitude
 * @param {number} inputLng - Input location longitude
 * @param {number} maxResults - Maximum number of results to return (default: 6)
 * @returns {Array} Top scored amenities
 */
const selectTopScoredAmenities = (amenities, inputLat, inputLng, maxResults = 6) => {
  // Calculate scores for all amenities
  const scoredAmenities = amenities.map(place => ({
    ...place,
    score: calculatePlaceScore(place, inputLat, inputLng),
    distance: place.geometry?.location ? calculateDistance(
      inputLat,
      inputLng,
      place.geometry.location.lat(),
      place.geometry.location.lng()
    ) : null
  }));

  // Sort by score (highest first) and take top results
  return scoredAmenities
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
};

/**
 * Main function to get nearby amenities with score-based selection
 * @param {google.maps.places.PlacesService} placesService - Places service instance
 * @param {number} lat - Latitude coordinate
 * @param {number} lng - Longitude coordinate
 * @param {number} radius - Search radius in meters (default: 5000)
 * @returns {Promise<Array>} Array of top 6 scored amenities with details
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

  // Select top 6 based on proximity + prominence scoring
  const topScoredAmenities = selectTopScoredAmenities(allAmenities, lat, lng, 6);

  if (topScoredAmenities.length === 0) {
    return [];
  }

  // Fetch detailed information for top scored amenities
  const detailedAmenityPromises = topScoredAmenities.map(place =>
    fetchPlaceDetails(placesService, place)
  );

  const detailedAmenities = await Promise.all(detailedAmenityPromises);

  // Preserve the score and distance information in the final results
  return detailedAmenities.map((detailed, index) => ({
    ...detailed,
    score: topScoredAmenities[index].score,
    distance: topScoredAmenities[index].distance
  }));
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
