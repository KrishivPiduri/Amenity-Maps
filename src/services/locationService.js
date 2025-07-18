// ===== CONFIGURATION =====
const API_KEY = "AIzaSyBnxpK2n_vnXX5CoDMN6mFk3rgJ2Mi6S24";

// Search radius - 1 mile for relevance
const DEFAULT_SEARCH_RADIUS = 1609; // 1 mile in meters (1.0 mile * 1609.34)

// Constants for API calls
const PAGINATION_DELAY_MS = 200;

// ===== FILTERING CONFIGURATION =====

// Updated parameters to match the new pseudocode
const R_MAX = 2.0; // miles radius
const MIN_RATING = 4.0;
const MIN_REVIEWS = 50;
const MAX_CANDIDATES = 30; // HARD LIMIT on how many POIs we'll ever score
const DESIRED_COUNT = 8; // final map count (6–8)

// Brand list for scoring (known restaurant/retail chains)
const BRAND_LIST = new Set([
  'starbucks', 'whole foods', 'trader joe\'s', 'target', 'walmart', 'cvs', 'walgreens',
  'mcdonald\'s', 'burger king', 'subway', 'kfc', 'pizza hut', 'domino\'s', 'taco bell',
  'wendy\'s', 'popeyes', 'chipotle', 'panera bread', 'sonic', 'sonic drive-in',
  'dunkin\'', 'dunkin\' donuts', 'tim hortons', 'chick-fil-a', 'five guys',
  'in-n-out', 'shake shack', 'white castle', 'arby\'s', 'dairy queen',
  'baskin-robbins', 'coldstone creamery', 'kroger', 'safeway',
  '7-eleven', 'circle k', 'shell', 'bp', 'exxon', 'chevron', 'mobil',
  'texaco', 'speedway', 'wawa', 'sheetz', 'rite aid'
]);

// Category weights for scoring (fit per audience)
const CATEGORY_WEIGHTS = {
  'grocery_or_supermarket': 5,
  'gym': 4,
  'transit_station': 4,
  'cafe': 3,
  'restaurant': 3,
  'meal_takeaway': 3,
  'bakery': 2,
  'pharmacy': 3,
  'convenience_store': 2,
  'gas_station': 2,
  'bank': 2,
  'atm': 1,
  'hospital': 3,
  'doctor': 2,
  'shopping_mall': 2,
  'store': 2,
  'clothing_store': 1,
  'electronics_store': 1,
  'hardware_store': 2,
  'park': 3,
  'tourist_attraction': 2,
  'lodging': 1,
  'school': 1,
  'university': 2,
  'library': 2,
  'church': 1,
  'synagogue': 1,
  'mosque': 1
};

// Diversity caps in final selection
const CATEGORY_CAPS = {
  'grocery_or_supermarket': 2,
  'gym': 1,
  'transit_station': 1,
  'cafe': 2,
  'restaurant': 1,
  'meal_takeaway': 1,
  'bakery': 1,
  'pharmacy': 1,
  'convenience_store': 1,
  'gas_station': 1,
  'bank': 1,
  'atm': 1,
  'hospital': 1,
  'doctor': 1,
  'shopping_mall': 1,
  'store': 1,
  'clothing_store': 1,
  'electronics_store': 1,
  'hardware_store': 1,
  'park': 2,
  'tourist_attraction': 1,
  'lodging': 1,
  'school': 1,
  'university': 1,
  'library': 1,
  'church': 1,
  'synagogue': 1,
  'mosque': 1
};

// Updated scoring weights
const WEIGHTS = {
  brand: 0.4,
  rating: 0.2,
  popularity: 0.2,
  distance: 0.1,
  category: 0.1
};

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

// ===== FILTERING UTILITY FUNCTIONS =====

/**
 * Converts miles to meters
 * @param {number} miles - Distance in miles
 * @returns {number} Distance in meters
 */
const milesToMeters = (miles) => miles * 1609.34;

/**
 * Calculates the distance between two coordinates using Haversine formula
 * @param {number} lat1 - First latitude
 * @param {number} lng1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lng2 - Second longitude
 * @returns {number} Distance in miles
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 3959; // Earth's radius in miles
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in miles
};

/**
 * Pre-filters places based on quality and distance criteria
 * @param {Array} places - Array of places to filter
 * @param {number} centerLat - Center latitude for distance calculation
 * @param {number} centerLng - Center longitude for distance calculation
 * @returns {Array} Filtered places with distance_to_asset added
 */
const preFilterPlaces = (places, centerLat, centerLng) => {
  return places.filter(place => {
    // Calculate distance if coordinates are available
    let distanceToAsset = 0;
    if (place.coordinates) {
      distanceToAsset = calculateDistance(
        centerLat, centerLng,
        place.coordinates.lat, place.coordinates.lng
      );
    }

    // Apply filters: rating >= MIN_RATING, reviews >= MIN_REVIEWS, distance <= R_MAX
    return (
      (place.rating || 0) >= MIN_RATING &&
      (place.user_ratings_total || 0) >= MIN_REVIEWS &&
      distanceToAsset <= R_MAX
    );
  }).map(place => ({
    ...place,
    distance_to_asset: place.coordinates ? calculateDistance(
      centerLat, centerLng,
      place.coordinates.lat, place.coordinates.lng
    ) : 0
  }));
};

/**
 * Simple deduplication by name
 * @param {Array} places - Array of places to deduplicate
 * @returns {Array} Deduplicated places
 */
const dedupeByName = (places) => {
  const nameMap = new Map();

  places.forEach(place => {
    const normalizedName = place.name?.toLowerCase().trim();
    if (!normalizedName) return;

    if (!nameMap.has(normalizedName)) {
      nameMap.set(normalizedName, place);
    }
  });

  return Array.from(nameMap.values());
};

/**
 * Gets the primary category for a place
 * @param {Array} types - Array of place types from Google Places
 * @returns {string} Primary category
 */
const getPrimaryCategory = (types) => {
  if (!types || types.length === 0) return 'other';

  // Find the first type that has a weight defined
  for (const type of types) {
    if (CATEGORY_WEIGHTS[type]) {
      return type;
    }
  }

  // Return the first type if no weighted category found
  return types[0] || 'other';
};

/**
 * Checks if a place name matches a known brand
 * @param {string} name - Place name
 * @returns {boolean} True if it's a known brand
 */
const isBrand = (name) => {
  if (!name) return false;
  const normalizedName = name.toLowerCase().trim();
  return BRAND_LIST.has(normalizedName);
};

/**
 * Calculates quick proxy score for initial ranking
 * @param {Object} place - Place object
 * @returns {Object} Place with quick_score added
 */
const calculateQuickScore = (place) => {
  const brandBonus = isBrand(place.name) ? 2.0 : 0.0;
  const ratingBonus = place.rating ? (place.rating - MIN_RATING) : 0;
  const popularityBonus = place.user_ratings_total ? Math.log1p(place.user_ratings_total) / 5.0 : 0;

  const quickScore = brandBonus + ratingBonus + popularityBonus;

  return {
    ...place,
    quick_score: quickScore
  };
};

/**
 * Calculates detailed scores for a place based on various factors
 * @param {Object} place - Place object
 * @param {number} maxReviews - Maximum review count for normalization
 * @returns {Object} Place with detailed scoring properties
 */
const calculateDetailedScores = (place, maxReviews) => {
  const primaryCategory = getPrimaryCategory(place.types);

  // Brand score: 1 if known brand, 0 otherwise
  const brandScore = isBrand(place.name) ? 1 : 0;

  // Rating score: normalized between MIN_RATING and 5.0
  const ratingScore = place.rating ?
    (place.rating - MIN_RATING) / (5.0 - MIN_RATING) : 0;

  // Popularity score: log1p normalization
  const popularityScore = place.user_ratings_total && maxReviews > 0 ?
    Math.log1p(place.user_ratings_total) / Math.log1p(maxReviews) : 0;

  // Distance score: 1 - (distance / R_MAX)
  const distanceScore = Math.max(0, 1 - (place.distance_to_asset / R_MAX));

  // Category score: normalized category weight
  const maxCategoryWeight = Math.max(...Object.values(CATEGORY_WEIGHTS));
  const categoryScore = (CATEGORY_WEIGHTS[primaryCategory] || 1) / maxCategoryWeight;

  // Total weighted score
  const totalScore = (
    WEIGHTS.brand * brandScore +
    WEIGHTS.rating * ratingScore +
    WEIGHTS.popularity * popularityScore +
    WEIGHTS.distance * distanceScore +
    WEIGHTS.category * categoryScore
  );

  return {
    ...place,
    type: primaryCategory, // Add 'type' field for consistency with pseudocode
    primaryCategory,
    brandScore,
    ratingScore,
    popularityScore,
    distanceScore,
    categoryScore,
    score: totalScore
  };
};

/**
 * Applies diversity-enforced selection with fallback
 * @param {Array} candidates - Sorted candidate places
 * @param {number} desiredCount - Desired number of results
 * @returns {Array} Diversity-enforced selection
 */
const diversityEnforcedSelection = (candidates, desiredCount) => {
  const selected = [];
  const counts = new Map();

  // Sort by score (highest first)
  const sortedCandidates = [...candidates].sort((a, b) => b.score - a.score);

  // Primary selection with diversity caps
  for (const place of sortedCandidates) {
    const category = place.type;
    const currentCount = counts.get(category) || 0;
    const categoryLimit = CATEGORY_CAPS[category] || 1;

    if (currentCount < categoryLimit) {
      selected.push(place);
      counts.set(category, currentCount + 1);

      if (selected.length >= desiredCount) {
        break;
      }
    }
  }

  // Fallback if underflow: allow one extra of top-scoring category
  if (selected.length < desiredCount) {
    const selectedIds = new Set(selected.map(p => p.id));

    for (const place of sortedCandidates) {
      if (!selectedIds.has(place.id)) {
        selected.push(place);
        if (selected.length >= desiredCount) {
          break;
        }
      }
    }
  }

  return selected;
};

// ===== MAIN EXPORT FUNCTION =====

/**
 * Main function to get all nearby amenities without filtering
 * @param {google.maps.places.PlacesService} placesService - Places service instance
 * @param {number} lat - Latitude coordinate
 * @param {number} lng - Longitude coordinate
 * @param {number} radius - Search radius in meters (default: 2000)
 * @returns {Promise<Array>} Array of all amenities with details
 */
export const getNearbyAmenities = async (placesService, lat, lng, radius = DEFAULT_SEARCH_RADIUS) => {
  const location = new window.google.maps.LatLng(lat, lng);

  // Configure search request for broad search
  const request = {
    location: location,
    radius: radius,
  };

  // Fetch all results from Places API
  const allAmenities = await fetchAllPlacesResults(placesService, request);

  if (allAmenities.length === 0) {
    return [];
  }

  console.log(`📍 Found ${allAmenities.length} places nearby - returning all results`);

  // Fetch detailed information for all POIs
  const detailedPOIPromises = allAmenities.map(place =>
    fetchPlaceDetails(placesService, place)
  );

  // Return all detailed POIs without filtering
  return await Promise.all(detailedPOIPromises);
};

// ===== MAIN EXPORT FUNCTION (FILTERED) =====

/**
 * Main function to get filtered and scored nearby amenities
 * Implements the complete filtering pipeline from the updated pseudocode
 * Only applies complex filtering when there are more places than DESIRED_COUNT
 * @param {google.maps.places.PlacesService} placesService - Places service instance
 * @param {number} lat - Latitude coordinate
 * @param {number} lng - Longitude coordinate
 * @param {number} desiredCount - Desired number of results (default: DESIRED_COUNT)
 * @returns {Promise<Array>} Array of filtered, scored, and diversity-capped amenities
 */
export const getFilteredNearbyAmenities = async (placesService, lat, lng, desiredCount = DESIRED_COUNT) => {
  const location = new window.google.maps.LatLng(lat, lng);

  // Step 1: FETCH & PREFILTER
  // Fetch slightly beyond R_MAX (1.2x buffer)
  const fetchRadius = milesToMeters(R_MAX * 1.2);
  const request = {
    location: location,
    radius: fetchRadius,
  };

  console.log(`🔍 Starting filtered search with R_MAX: ${R_MAX} miles (${milesToMeters(R_MAX)}m), desired count: ${desiredCount}`);

  // Fetch all results from Places API
  const rawPlaces = await fetchAllPlacesResults(placesService, request);

  if (rawPlaces.length === 0) {
    console.log('❌ No places found in the area');
    return [];
  }

  console.log(`📍 Found ${rawPlaces.length} raw places from Google Places API`);

  // Fetch detailed information for all POIs
  const detailedPOIPromises = rawPlaces.map(place =>
    fetchPlaceDetails(placesService, place)
  );
  const detailedPlaces = await Promise.all(detailedPOIPromises);

  // Pre-filter: keep only decent quality & within absolute max radius
  console.log('🔧 Step 1: Pre-filtering places...');
  let preFiltered = preFilterPlaces(detailedPlaces, lat, lng);
  console.log(`✅ After pre-filtering: ${preFiltered.length} places (rating >= ${MIN_RATING}, reviews >= ${MIN_REVIEWS}, distance <= ${R_MAX} miles)`);

  if (preFiltered.length === 0) {
    console.log('❌ No places passed pre-filtering criteria');
    return [];
  }

  // Dedupe by name
  preFiltered = dedupeByName(preFiltered);
  console.log(`✅ After deduplication: ${preFiltered.length} places`);

  // EARLY RETURN: If we have desiredCount or fewer places, just return them all
  if (preFiltered.length <= desiredCount) {
    console.log(`🎯 Found ${preFiltered.length} places (≤ ${desiredCount}), returning all without complex filtering`);

    // Add basic distance info and primary category for consistency
    const basicResults = preFiltered.map(place => ({
      ...place,
      type: getPrimaryCategory(place.types),
      primaryCategory: getPrimaryCategory(place.types)
    }));

    // Sort by rating and distance for a reasonable ordering
    return basicResults.sort((a, b) => {
      // Primary sort: rating (higher better)
      if (b.rating !== a.rating) {
        return (b.rating || 0) - (a.rating || 0);
      }
      // Secondary sort: distance (closer better)
      return a.distance_to_asset - b.distance_to_asset;
    });
  }

  // COMPLEX FILTERING: Only when we have more places than desired
  console.log(`🧠 Found ${preFiltered.length} places (> ${desiredCount}), applying complex filtering algorithm...`);

  // Step 2: INITIAL RANK & HARD TRUNCATION
  console.log('🔧 Step 2: Initial ranking with quick proxy score...');

  // Calculate quick proxy scores
  let scoredPlaces = preFiltered.map(place => calculateQuickScore(place));

  // Sort by quick_score and cap at MAX_CANDIDATES
  let candidates = scoredPlaces
    .sort((a, b) => b.quick_score - a.quick_score)
    .slice(0, MAX_CANDIDATES);

  console.log(`✅ After initial ranking & truncation: ${candidates.length} candidates (max: ${MAX_CANDIDATES})`);

  // Step 3: DETAILED SCORING
  console.log('🔧 Step 3: Calculating detailed scores...');
  const maxReviews = Math.max(...candidates.map(p => p.user_ratings_total || 0));
  candidates = candidates.map(place => calculateDetailedScores(place, maxReviews));

  // Log scoring statistics
  const avgScore = candidates.reduce((sum, p) => sum + p.score, 0) / candidates.length;
  const brandCount = candidates.filter(p => p.brandScore > 0).length;
  console.log(`✅ Detailed scoring complete - Avg score: ${avgScore.toFixed(3)}, Brands found: ${brandCount}/${candidates.length}`);

  // Step 4: DIVERSITY-ENFORCED SELECTION
  console.log('🔧 Step 4: Applying diversity-enforced selection...');
  const selected = diversityEnforcedSelection(candidates, desiredCount);

  // Log diversity statistics
  const categoryBreakdown = selected.reduce((acc, place) => {
    acc[place.type] = (acc[place.type] || 0) + 1;
    return acc;
  }, {});

  console.log(`✅ Final selection: ${selected.length} places`);
  console.log('📊 Category breakdown:', categoryBreakdown);

  // Step 5: Return results sorted by score
  return selected.sort((a, b) => b.score - a.score);
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
