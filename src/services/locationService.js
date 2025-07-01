// ===== CONFIGURATION =====
const API_KEY = "AIzaSyBnxpK2n_vnXX5CoDMN6mFk3rgJ2Mi6S24";

// Configuration for amenity categories and their importance weights
const AMENITY_CATEGORIES = {
  restaurant: { weight: 1.2, minScore: 0 },
  cafe: { weight: 1.0, minScore: 0 },
  supermarket: { weight: 1.0, minScore: 0 },
  park: { weight: 1.0, minScore: 0 },
  bank: { weight: 0.8, minScore: 0 },
  pharmacy: { weight: 0.8, minScore: 0 },
  gym: { weight: 0.9, minScore: 0 },
  shopping_mall: { weight: 1.1, minScore: 0 },
};

// List of prominent brand names for scoring algorithm
const PROMINENT_BRANDS = [
  'starbucks', 'mcdonald', 'subway', 'pizza hut', 'domino', 'kfc', 'burger king', 'taco bell',
  'chase', 'bank of america', 'wells fargo', 'citibank', 'td bank', 'pnc bank',
  'cvs', 'walgreens', 'rite aid', 'walmart', 'target', 'whole foods', 'trader joe',
  'planet fitness', 'la fitness', '24 hour fitness', 'gold\'s gym',
  'marriott', 'hilton', 'hyatt', 'best western', 'holiday inn'
];

// Search keywords for finding nearby amenities
const AMENITY_KEYWORDS = [
  'bank', 'bar', 'cafe', 'hospital', 'park', 'pharmacy',
  'school', 'supermarket', 'gym', 'restaurant', 'shopping_mall', 'store'
];

// Constants for the selection algorithm
const MAX_SELECTED_AMENITIES = 6;
const HIGH_PROMINENCE_THRESHOLD = 120;
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
 * Fetches detailed information for a single place
 * @param {google.maps.places.PlacesService} placesService - Places service instance
 * @param {Object} place - Basic place information from search
 * @returns {Promise<Object>} Detailed place information
 */
const fetchPlaceDetails = (placesService, place) => {
  return new Promise((resolveDetail) => {
    const detailRequest = {
      placeId: place.place_id,
      fields: ['place_id', 'name', 'types', 'rating', 'price_level', 'vicinity', 'photos', 'user_ratings_total']
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
        user_ratings_total: place.user_ratings_total
      };

      if (detailStatus === window.google.maps.places.PlacesServiceStatus.OK) {
        // Use detailed information if available
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
          user_ratings_total: detailResult.user_ratings_total || baseInfo.user_ratings_total
        });
      } else {
        // Fallback to basic info if getDetails fails
        resolveDetail(baseInfo);
      }
    });
  });
};

/**
 * Main function to get nearby amenities with intelligent selection
 * @param {google.maps.places.PlacesService} placesService - Places service instance
 * @param {number} lat - Latitude coordinate
 * @param {number} lng - Longitude coordinate
 * @param {number} radius - Search radius in meters (default: 5000)
 * @returns {Promise<Array>} Array of selected prominent amenities with details
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

  // Select the most prominent amenities using intelligent algorithm
  const selectedAmenities = selectProminentAmenities(allAmenities);

  // Fetch detailed information for selected amenities
  const detailedAmenityPromises = selectedAmenities.map(place =>
    fetchPlaceDetails(placesService, place)
  );

  return Promise.all(detailedAmenityPromises);
};

// ===== AMENITY SELECTION ALGORITHM =====

/**
 * Calculates a prominence score for a place based on brand recognition,
 * review count, and rating quality
 * @param {Object} place - Place object from Places API
 * @returns {number} Prominence score
 */
const calculatePlaceProminence = (place) => {
  const name = place.name.toLowerCase();
  let score = 0;

  // High score for recognized brands/chains
  const isBrand = PROMINENT_BRANDS.some(brand => name.includes(brand));
  if (isBrand) {
    score += 100;
  }

  // Score based on review count (logarithmic scale for popularity)
  const reviews = place.user_ratings_total || 0;
  score += Math.log10(reviews + 1) * 10;

  // Bonus points for good ratings (secondary factor)
  const rating = place.rating || 0;
  if (rating >= 4.0) {
    score += 10;
  } else if (rating >= 3.5) {
    score += 5;
  }

  return score;
};

/**
 * Finds the top-rated place in each category
 * @param {Array} scoredAmenities - Amenities with prominence scores
 * @returns {Object} Map of category -> top place in that category
 */
const getCategoryTopPlaces = (scoredAmenities) => {
  const categoryTops = {};

  Object.keys(AMENITY_CATEGORIES).forEach(category => {
    const placesInCategory = scoredAmenities.filter(place =>
      place.types.includes(category)
    );

    if (placesInCategory.length > 0) {
      // Sort by prominence and take the top one
      placesInCategory.sort((a, b) => b.prominence - a.prominence);
      categoryTops[category] = placesInCategory[0];
    }
  });

  return categoryTops;
};

/**
 * Selects category representatives based on weighted prominence scores
 * @param {Object} categoryTops - Top place for each category
 * @returns {Array} Selected places representing different categories
 */
const selectCategoryRepresentatives = (categoryTops) => {
  // Sort categories by weighted prominence scores
  const sortedCategories = Object.keys(categoryTops)
    .sort((a, b) => {
      const scoreA = categoryTops[a].prominence * AMENITY_CATEGORIES[a].weight;
      const scoreB = categoryTops[b].prominence * AMENITY_CATEGORIES[b].weight;
      return scoreB - scoreA;
    });

  const selected = [];
  const selectedIds = new Set();
  const usedCategories = new Set();

  // Select top representative from each category
  sortedCategories.forEach(category => {
    const place = categoryTops[category];
    if (!selectedIds.has(place.place_id) && !usedCategories.has(category)) {
      selected.push(place);
      selectedIds.add(place.place_id);
      usedCategories.add(category);
    }
  });

  return { selected, selectedIds, usedCategories };
};

/**
 * Fills remaining slots with high-prominence places if we have less than max
 * @param {Array} selected - Currently selected places
 * @param {Set} selectedIds - Set of already selected place IDs
 * @param {Set} usedCategories - Set of categories already represented
 * @param {Array} scoredAmenities - All amenities with prominence scores
 * @returns {Array} Final selection of places
 */
const fillRemainingSlots = (selected, selectedIds, usedCategories, scoredAmenities) => {
  if (selected.length >= MAX_SELECTED_AMENITIES) {
    return selected;
  }

  // Sort remaining places by prominence
  const remainingSorted = scoredAmenities
    .filter(place => !selectedIds.has(place.place_id))
    .sort((a, b) => b.prominence - a.prominence);

  for (let i = 0; i < remainingSorted.length && selected.length < MAX_SELECTED_AMENITIES; i++) {
    const place = remainingSorted[i];
    const placeCategories = Object.keys(AMENITY_CATEGORIES).filter(cat =>
      place.types.includes(cat)
    );
    const categoryAlreadyUsed = placeCategories.some(cat => usedCategories.has(cat));

    if (!categoryAlreadyUsed) {
      // Add if it's a new category
      selected.push(place);
      selectedIds.add(place.place_id);
      placeCategories.forEach(cat => usedCategories.add(cat));
    } else if (place.prominence > HIGH_PROMINENCE_THRESHOLD) {
      // Add if it has exceptionally high prominence (worth showing duplicate category)
      selected.push(place);
      selectedIds.add(place.place_id);
    }
  }

  return selected;
};

/**
 * Intelligently selects the most prominent and diverse amenities from a list
 * Uses a combination of brand recognition, review count, ratings, and category diversity
 * @param {Array} amenities - Raw amenities from Places API
 * @returns {Array} Selected prominent amenities (max 6)
 */
const selectProminentAmenities = (amenities) => {
  // Calculate prominence scores for all amenities
  const scoredAmenities = amenities.map(place => ({
    ...place,
    prominence: calculatePlaceProminence(place)
  }));

  // Get the top place in each category
  const categoryTops = getCategoryTopPlaces(scoredAmenities);

  // Select category representatives
  const { selected, selectedIds, usedCategories } = selectCategoryRepresentatives(categoryTops);

  // Fill remaining slots with high-prominence places
  const finalSelection = fillRemainingSlots(selected, selectedIds, usedCategories, scoredAmenities);

  // Ensure we don't exceed the maximum
  return finalSelection.slice(0, MAX_SELECTED_AMENITIES);
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
