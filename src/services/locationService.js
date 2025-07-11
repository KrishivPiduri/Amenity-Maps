// ===== CONFIGURATION =====
const API_KEY = "AIzaSyBnxpK2n_vnXX5CoDMN6mFk3rgJ2Mi6S24";

// Priority list - higher on the list = higher priority
const priority = [
  "grocery_store",
  "supermarket",
  "grocery_or_supermarket",
  "establishment",
  "store",
  "pharmacy",
  "hospital",
  "doctor",
  "dentist",
  "medical_lab",
  "dental_clinic",
  "bank",
  "atm",
  "finance",
  "post_office",
  "library",
  "secondary_school",
  "primary_school",
  "school",
  "university",
  "park",
  "natural_features",
  "restaurant",
  "meal_takeaway",
  "meal_delivery",
  "food",
  "cafe",
  "coffee_shop",
  "bakery",
  "ice_cream_shop",
  "fine_dining_restaurant",
  "brunch_restaurant",
  "vegetarian_restaurant",
  "vegan_restaurant",
  "wine_bar",
  "tea_house",
  "book_store",
  "shopping_mall",
  "department_store",
  "home_goods_store",
  "furniture_store",
  "hardware_store",
  "electronics_store",
  "pet_store",
  "fitness_center",
  "gym",
  "yoga_studio",
  "spa",
  "massage",
  "beauty_salon",
  "hair_salon",
  "nail_salon",
  "barber_shop",
  "public_transport",
  "subway_station",
  "train_station",
  "bus_station",
  "light_rail_station",
  "transit_station",
  "tourist_attraction",
  "museum",
  "art_gallery",
  "concert_hall",
  "performing_arts_theater",
  "cultural_center",
  "church",
  "synagogue",
  "mosque",
  "hindu_temple",
  "golf_course",
  "swimming_pool",
  "zoo",
  "dog_park",
  "botanical_garden",
  "community_center",
  "senior_center",
  "convenience_store",
  "food_store",
  "gift_shop",
  "clothing_store",
  "shoe_store",
  "liquor_store",
  "candy_store",
  "market",
  "warehouse_store",
  "auto_parts_store",
  "car_repair",
  "car_wash",
  "gas_station",
  "parking",
  "laundry",
  "locksmith",
  "courier_service",
  "storage",
  "moving_company",
  "plumber",
  "electrician",
  "roofing_contractor",
  "real_estate_agency",
  "insurance_agency",
  "lawyer",
  "consultant",
  "city_hall",
  "government_office",
  "fire_station",
  "police",
  "courthouse",
  "cemetery",
  "funeral_home",
  "embassy",
  "neighborhood_police_station",
  "wellness_center",
  "skin_care_clinic",
  "sauna",
  "tanning_studio",
  "makeup_artist",
  "florist",
  "art_studio",
  "sculpture",
  "historical_place",
  "historical_landmark",
  "monument",
  "planetarium",
  "observation_deck",
  "movie_theater",
  "video_arcade",
  "amusement_park",
  "casino",
  "night_club",
  "bar",
  "karaoke",
  "comedy_club",
  "dog_cafe",
  "cat_cafe",
  "fast_food_restaurant",
  "hamburger_restaurant",
  "pizza_restaurant",
  "barbecue_restaurant",
  "chinese_restaurant",
  "indian_restaurant",
  "japanese_restaurant",
  "korean_restaurant",
  "thai_restaurant",
  "turkish_restaurant",
  "mexican_restaurant",
  "greek_restaurant",
  "french_restaurant",
  "spanish_restaurant",
  "lebanese_restaurant",
  "middle_eastern_restaurant",
  "american_restaurant",
  "asian_restaurant",
  "ramen_restaurant",
  "sushi_restaurant",
  "dessert_shop",
  "donut_shop",
  "bagel_shop",
  "confectionery",
  "buffet_restaurant",
  "acai_shop",
  "juice_shop",
  "smoothie_shop",
  "warehouse",
  "auto_repair",
  "car_dealer",
  "car_rental",
  "truck_stop",
  "electric_vehicle_charging_station",
  "rest_stop",
  "heliport",
  "airport",
  "international_airport",
  "airstrip",
  "taxi_stand",
  "bike_share_station",
  "ferry_terminal",
  "transit_depot"
];

// Maximum number of POIs to return
const MAX_POIS = 8;

// Search radius - 2km for relevance
const DEFAULT_SEARCH_RADIUS = 2000; // 2km in meters

// Search keywords for broad search
const AMENITY_KEYWORDS = [
  'grocery', 'supermarket', 'school', 'hospital', 'shopping_mall',
  'pharmacy', 'restaurant', 'transit_station', 'park', 'bank', 'cafe'
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

// ===== SIMPLE POI SELECTION =====

/**
 * Get priority score for a place based on its types
 * @param {Array} types - Place types from Google Places API
 * @returns {number} Priority score (lower number = higher priority)
 */
const getPriorityScore = (types = []) => {
  if (!types || types.length === 0) return 999;

  // Find the highest priority type (lowest index in priority array)
  let bestPriority = 999;
  for (const type of types) {
    const priorityIndex = priority.indexOf(type);
    if (priorityIndex !== -1 && priorityIndex < bestPriority) {
      bestPriority = priorityIndex;
    }
  }

  return bestPriority;
};

/**
 * Get the primary category for a place (the highest priority type)
 * @param {Array} types - Place types from Google Places API
 * @returns {string} Primary category or the first type if not in priority list
 */
const getPrimaryCategory = (types = []) => {
  if (!types || types.length === 0) return 'unknown';

  let bestPriority = 999;
  let primaryCategory = types[0] || 'unknown';

  for (const type of types) {
    const priorityIndex = priority.indexOf(type);
    if (priorityIndex !== -1 && priorityIndex < bestPriority) {
      bestPriority = priorityIndex;
      primaryCategory = type;
    }
  }

  return primaryCategory;
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
 * Simple selection of top POIs based on priority list
 * @param {Array} amenities - Raw amenities from Places API
 * @param {number} inputLat - Input location latitude
 * @param {number} inputLng - Input location longitude
 * @param {number} maxResults - Maximum number of results to return (default: 8)
 * @returns {Array} Top priority POIs
 */
const selectHighImpactPOIs = (amenities, inputLat, inputLng, maxResults = MAX_POIS) => {
  console.log(`🔍 Starting simple selection from ${amenities.length} total places`);

  // Process all amenities and assign priority scores
  const processedAmenities = amenities.map((place, index) => {
    const priorityScore = getPriorityScore(place.types);
    const primaryCategory = getPrimaryCategory(place.types);

    const distance = place.geometry?.location ? calculateDistance(
      inputLat,
      inputLng,
      place.geometry.location.lat(),
      place.geometry.location.lng()
    ) : null;

    return {
      ...place,
      priorityScore,
      primaryCategory,
      distance
    };
  });

  // Sort by priority (lower score = higher priority), then by distance
  const sortedAmenities = processedAmenities.sort((a, b) => {
    if (a.priorityScore !== b.priorityScore) {
      return a.priorityScore - b.priorityScore;
    }
    // Same priority, sort by distance
    if (a.distance && b.distance) {
      return a.distance - b.distance;
    }
    return 0;
  });

  // Take the top N results
  const selectedPOIs = sortedAmenities.slice(0, maxResults);

  console.log(`🎉 Selected ${selectedPOIs.length} places:`);
  selectedPOIs.forEach((place, idx) => {
    const priorityLabel = place.priorityScore === 999 ? 'LOW PRIORITY' : `Priority ${place.priorityScore}`;
    console.log(`   ${idx + 1}. ${place.name} (${place.primaryCategory}) - ${priorityLabel}`);
  });

  return selectedPOIs;
};

/**
 * Main function to get nearby amenities
 * @param {google.maps.places.PlacesService} placesService - Places service instance
 * @param {number} lat - Latitude coordinate
 * @param {number} lng - Longitude coordinate
 * @param {number} radius - Search radius in meters (default: 2000)
 * @returns {Promise<Array>} Array of top 8 amenities with details
 */
export const getNearbyAmenities = async (placesService, lat, lng, radius = DEFAULT_SEARCH_RADIUS) => {
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

  // Select top POIs
  const topPOIs = selectHighImpactPOIs(allAmenities, lat, lng, MAX_POIS);

  if (topPOIs.length === 0) {
    return [];
  }

  // Fetch detailed information for selected POIs
  const detailedPOIPromises = topPOIs.map(place =>
    fetchPlaceDetails(placesService, place)
  );

  const detailedPOIs = await Promise.all(detailedPOIPromises);

  // Return the detailed POIs
  return detailedPOIs.map((detailed, index) => ({
    ...detailed,
    score: topPOIs[index].score,
    distance: topPOIs[index].distance,
    priority: topPOIs[index].priority
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
