// ===== CONFIGURATION =====
const API_KEY = "AIzaSyBnxpK2n_vnXX5CoDMN6mFk3rgJ2Mi6S24";

// High-impact POI categories with priority scoring (based on property value impact)
const HIGH_IMPACT_CATEGORIES = [
  {
    type: "grocery",
    keywords: ["whole foods", "fred meyer", "trader joe", "kroger", "safeway", "publix", "wegmans", "costco", "sam's club"],
    priority: 9,
    googleTypes: ["grocery_or_supermarket", "supermarket"]
  },
  {
    type: "school",
    keywords: ["elementary", "middle school", "high school", "school", "academy", "university", "college"],
    priority: 10,
    googleTypes: ["school", "university"]
  },
  {
    type: "hospital",
    keywords: ["hospital", "urgent care", "medical center", "clinic", "kaiser permanente"],
    priority: 9,
    googleTypes: ["hospital", "doctor"]
  },
  {
    type: "shopping",
    keywords: ["outlet", "mall", "shopping center", "target", "walmart", "best buy", "home depot", "lowe"],
    priority: 8,
    googleTypes: ["shopping_mall", "department_store"]
  },
  {
    type: "pharmacy",
    keywords: ["walgreens", "cvs", "rite aid", "pharmacy"],
    priority: 7,
    googleTypes: ["pharmacy"]
  },
  {
    type: "restaurant",
    keywords: ["mcdonald", "chipotle", "starbucks", "subway", "pizza hut", "kfc", "taco bell", "panera"],
    priority: 6,
    googleTypes: ["restaurant", "meal_takeaway", "cafe"]
  },
  {
    type: "transit",
    keywords: ["station", "subway", "transit center", "bus stop", "metro"],
    priority: 6,
    googleTypes: ["transit_station", "bus_station", "subway_station"]
  },
  {
    type: "park",
    keywords: ["park", "greenway", "recreation", "playground"],
    priority: 5,
    googleTypes: ["park"]
  }
];

// Maximum number of high-impact POIs to return
const MAX_HIGH_IMPACT_POIS = 8;

// Search radius reduced to 2km for higher relevance
const DEFAULT_SEARCH_RADIUS = 2000; // 2km in meters

// Search keywords optimized for high-impact categories
const AMENITY_KEYWORDS = [
  'grocery', 'supermarket', 'school', 'hospital', 'shopping_mall',
  'pharmacy', 'restaurant', 'transit_station', 'park'
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

// ===== HIGH-IMPACT POI FILTERING =====

/**
 * Determines if a place matches high-impact criteria
 * @param {Object} place - Place object from Places API
 * @returns {Object|null} Category match with priority or null if no match
 */
const getHighImpactCategory = (place) => {
  if (!place.name && !place.types) return null;

  const placeName = (place.name || '').toLowerCase();
  const placeTypes = place.types || [];

  // Check each high-impact category
  for (const category of HIGH_IMPACT_CATEGORIES) {
    // Check if place name matches any keywords
    const nameMatch = category.keywords.some(keyword =>
      placeName.includes(keyword.toLowerCase())
    );

    // Check if place types match any Google types
    const typeMatch = category.googleTypes.some(googleType =>
      placeTypes.includes(googleType)
    );

    if (nameMatch || typeMatch) {
      return {
        type: category.type,
        priority: category.priority
      };
    }
  }

  return null; // Not a high-impact POI
};

/**
 * Calculate high-impact score combining priority, proximity, and brand recognition
 * @param {Object} place - Place object from Places API
 * @param {number} inputLat - Input location latitude
 * @param {number} inputLng - Input location longitude
 * @param {number} maxDistance - Maximum search radius
 * @returns {number} High-impact score (0-1000)
 */
const calculateHighImpactScore = (place, inputLat, inputLng, maxDistance = DEFAULT_SEARCH_RADIUS) => {
  // First check if this is a high-impact POI
  const categoryMatch = getHighImpactCategory(place);
  if (!categoryMatch) {
    return 0; // Filter out non-high-impact POIs
  }

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
  const priorityScore = categoryMatch.priority * 10; // Scale priority to 0-100

  // Check for brand recognition bonus
  const placeName = (place.name || '').toLowerCase();
  const isBrandName = categoryMatch.type === 'grocery' &&
    ['whole foods', 'trader joe'].some(brand => placeName.includes(brand));
  const brandBonus = isBrandName ? 20 : 0;

  // Combined score: priority (50%) + proximity (40%) + brand bonus (10%)
  const totalScore = (priorityScore * 0.5) + (proximityScore * 0.4) + brandBonus;

  return Math.round(totalScore * 100) / 100;
};

/**
 * Selects top 8 high-impact POIs with category diversity
 * @param {Array} amenities - Raw amenities from Places API
 * @param {number} inputLat - Input location latitude
 * @param {number} inputLng - Input location longitude
 * @param {number} maxResults - Maximum number of results to return (default: 8)
 * @returns {Array} Top high-impact POIs with category diversity
 */
const selectHighImpactPOIs = (amenities, inputLat, inputLng, maxResults = MAX_HIGH_IMPACT_POIS) => {
  // Filter and score only high-impact amenities
  const highImpactAmenities = amenities
    .map(place => {
      const categoryMatch = getHighImpactCategory(place);
      if (!categoryMatch) return null;

      return {
        ...place,
        score: calculateHighImpactScore(place, inputLat, inputLng),
        distance: place.geometry?.location ? calculateDistance(
          inputLat,
          inputLng,
          place.geometry.location.lat(),
          place.geometry.location.lng()
        ) : null,
        highImpactCategory: categoryMatch.type,
        priority: categoryMatch.priority
      };
    })
    .filter(place => place && place.score > 0); // Remove null and zero-scored places

  if (highImpactAmenities.length === 0) {
    return [];
  }

  // Sort by score (highest first)
  const sortedAmenities = highImpactAmenities.sort((a, b) => {
    // Primary sort by score
    if (Math.abs(a.score - b.score) > 1) {
      return b.score - a.score;
    }
    // Secondary sort by priority if scores are close
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    // Tertiary sort by distance
    if (a.distance && b.distance) {
      return a.distance - b.distance;
    }
    return a.name.localeCompare(b.name);
  });

  // Implement category diversity selection
  const selectedPOIs = [];
  const categoryGroups = {};

  // Group by high-impact category
  sortedAmenities.forEach(poi => {
    const category = poi.highImpactCategory;
    if (!categoryGroups[category]) {
      categoryGroups[category] = [];
    }
    categoryGroups[category].push(poi);
  });

  // First pass: select best POI from each category (prioritizing highest-priority categories)
  const categories = Object.keys(categoryGroups).sort((a, b) => {
    const priorityA = HIGH_IMPACT_CATEGORIES.find(c => c.type === a)?.priority || 0;
    const priorityB = HIGH_IMPACT_CATEGORIES.find(c => c.type === b)?.priority || 0;
    return priorityB - priorityA;
  });

  for (const category of categories) {
    if (selectedPOIs.length >= maxResults) break;

    const bestInCategory = categoryGroups[category][0]; // Already sorted by score
    selectedPOIs.push(bestInCategory);
  }

  // Second pass: fill remaining slots with highest-scoring POIs
  const maxPerCategory = Math.max(1, Math.floor(maxResults / categories.length));
  const categoryCounts = {};

  // Initialize category counts
  selectedPOIs.forEach(poi => {
    const category = poi.highImpactCategory;
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  });

  // Add more POIs while respecting reasonable category limits
  for (const poi of sortedAmenities) {
    if (selectedPOIs.length >= maxResults) break;

    // Skip if already selected
    if (selectedPOIs.some(selected => selected.place_id === poi.place_id)) {
      continue;
    }

    const category = poi.highImpactCategory;
    const currentCount = categoryCounts[category] || 0;

    // Allow up to 2 POIs per category for high-priority categories (schools, hospitals, grocery)
    const maxForCategory = poi.priority >= 9 ? 2 : maxPerCategory;

    if (currentCount < maxForCategory) {
      selectedPOIs.push(poi);
      categoryCounts[category] = currentCount + 1;
    }
  }

  // Final sort by score to maintain quality ordering
  return selectedPOIs
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
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
const calculateProximityScore = (distance, maxDistance = DEFAULT_SEARCH_RADIUS) => {
  if (distance >= maxDistance) return 0;

  // Linear decay: closer = higher score
  return Math.max(0, 100 * (1 - distance / maxDistance));
};

/**
 * Main function to get high-impact nearby amenities
 * @param {google.maps.places.PlacesService} placesService - Places service instance
 * @param {number} lat - Latitude coordinate
 * @param {number} lng - Longitude coordinate
 * @param {number} radius - Search radius in meters (default: 2000)
 * @returns {Promise<Array>} Array of top 8 high-impact amenities with details
 */
export const getNearbyAmenities = async (placesService, lat, lng, radius = DEFAULT_SEARCH_RADIUS) => {
  const location = new window.google.maps.LatLng(lat, lng);

  // Configure search request for high-impact categories
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

  // Select top 8 high-impact POIs
  const topHighImpactPOIs = selectHighImpactPOIs(allAmenities, lat, lng, MAX_HIGH_IMPACT_POIS);

  if (topHighImpactPOIs.length === 0) {
    return [];
  }

  // Fetch detailed information for selected POIs
  const detailedPOIPromises = topHighImpactPOIs.map(place =>
    fetchPlaceDetails(placesService, place)
  );

  const detailedPOIs = await Promise.all(detailedPOIPromises);

  // Preserve the score, distance, and category information in the final results
  return detailedPOIs.map((detailed, index) => ({
    ...detailed,
    score: topHighImpactPOIs[index].score,
    distance: topHighImpactPOIs[index].distance,
    highImpactCategory: topHighImpactPOIs[index].highImpactCategory,
    priority: topHighImpactPOIs[index].priority
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
