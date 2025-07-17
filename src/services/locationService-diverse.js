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

// ===== DIVERSITY SYSTEM =====

/**
 * Define category groups for diversity scoring
 */
const CATEGORY_GROUPS = {
  'fast_food': ['restaurant', 'fast_food_restaurant', 'meal_takeaway', 'hamburger_restaurant', 'pizza_restaurant'],
  'education': ['school', 'primary_school', 'secondary_school', 'university', 'library'],
  'healthcare': ['hospital', 'pharmacy', 'doctor', 'dentist', 'medical_lab', 'dental_clinic'],
  'shopping': ['grocery_store', 'supermarket', 'grocery_or_supermarket', 'shopping_mall', 'store'],
  'finance': ['bank', 'atm', 'finance'],
  'recreation': ['park', 'gym', 'fitness_center', 'spa', 'movie_theater'],
  'transportation': ['gas_station', 'subway_station', 'train_station', 'bus_station', 'transit_station'],
  'services': ['post_office', 'government_office', 'real_estate_agency', 'insurance_agency']
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

// ===== POI SELECTION WITH DIVERSITY =====

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
 * Get category group for a place type
 * @param {Array} types - Place types from Google Places API
 * @returns {string} Category group name or 'other'
 */
const getCategoryGroup = (types = []) => {
  for (const [groupName, groupTypes] of Object.entries(CATEGORY_GROUPS)) {
    if (types.some(type => groupTypes.includes(type))) {
      return groupName;
    }
  }
  return 'other';
};

/**
 * Calculate diversity penalty based on already selected POIs
 * @param {Array} selectedPOIs - Already selected POIs
 * @param {Object} candidate - Candidate POI to evaluate
 * @returns {number} Penalty score (higher = worse diversity)
 */
const calculateDiversityPenalty = (selectedPOIs, candidate) => {
  const candidateGroup = getCategoryGroup(candidate.types);

  // Count how many POIs we already have in this category group
  const sameGroupCount = selectedPOIs.filter(poi =>
    getCategoryGroup(poi.types) === candidateGroup
  ).length;

  // Heavy penalty for having too many of the same category
  let penalty = 0;

  if (candidateGroup === 'fast_food') {
    // Heavily penalize multiple fast food restaurants
    penalty = sameGroupCount * 50;

    // Extra penalty if we already have 2+ fast food places
    if (sameGroupCount >= 2) {
      penalty += 100;
    }
  } else if (candidateGroup === 'education') {
    // Light penalty for education (we want at least one school)
    penalty = Math.max(0, (sameGroupCount - 1) * 20);
  } else {
    // Moderate penalty for other categories
    penalty = sameGroupCount * 30;
  }

  return penalty;
};

/**
 * Calculate education bonus to ensure we have at least one school
 * @param {Array} selectedPOIs - Already selected POIs
 * @param {Object} candidate - Candidate POI to evaluate
 * @returns {number} Bonus score (negative = better)
 */
const calculateEducationBonus = (selectedPOIs, candidate) => {
  const candidateGroup = getCategoryGroup(candidate.types);

  // Check if we already have an education POI
  const hasEducation = selectedPOIs.some(poi =>
    getCategoryGroup(poi.types) === 'education'
  );

  // If we don't have education and this is an education POI, give big bonus
  if (!hasEducation && candidateGroup === 'education') {
    return -100; // Negative = bonus
  }

  return 0;
};

/**
 * Advanced selection of POIs with diversity penalties and education guarantee
 * @param {Array} amenities - Raw amenities from Places API
 * @param {number} inputLat - Input location latitude
 * @param {number} inputLng - Input location longitude
 * @param {number} maxResults - Maximum number of results to return (default: 8)
 * @returns {Array} Diverse set of high-priority POIs
 */
const selectDiversePOIs = (amenities, inputLat, inputLng, maxResults = MAX_POIS) => {
  console.log(`🔍 Starting diverse selection from ${amenities.length} total places`);

  // Process all amenities and assign scores
  const processedAmenities = amenities.map((place, index) => {
    const priorityScore = getPriorityScore(place.types);
    const primaryCategory = getPrimaryCategory(place.types);
    const categoryGroup = getCategoryGroup(place.types);

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
      categoryGroup,
      distance
    };
  });

  // Sort by base priority first
  const sortedByPriority = processedAmenities.sort((a, b) => {
    if (a.priorityScore !== b.priorityScore) {
      return a.priorityScore - b.priorityScore;
    }
    if (a.distance && b.distance) {
      return a.distance - b.distance;
    }
    return 0;
  });

  // Iteratively select POIs with diversity considerations
  const selectedPOIs = [];
  const remainingCandidates = [...sortedByPriority];

  console.log(`🎯 Selecting POIs with diversity penalties...`);

  while (selectedPOIs.length < maxResults && remainingCandidates.length > 0) {
    // Calculate final scores for all remaining candidates
    const candidatesWithScores = remainingCandidates.map(candidate => {
      const diversityPenalty = calculateDiversityPenalty(selectedPOIs, candidate);
      const educationBonus = calculateEducationBonus(selectedPOIs, candidate);

      // Final score combines priority, diversity penalty, and education bonus
      const finalScore = candidate.priorityScore + diversityPenalty + educationBonus;

      return {
        ...candidate,
        diversityPenalty,
        educationBonus,
        finalScore
      };
    });

    // Sort by final score and select the best candidate
    candidatesWithScores.sort((a, b) => a.finalScore - b.finalScore);
    const selected = candidatesWithScores[0];

    console.log(`   Selected: ${selected.name} (${selected.categoryGroup}) - Priority: ${selected.priorityScore}, Penalty: ${selected.diversityPenalty}, Bonus: ${selected.educationBonus}, Final: ${selected.finalScore}`);

    selectedPOIs.push(selected);

    // Remove selected candidate from remaining list
    const selectedIndex = remainingCandidates.findIndex(c => c.place_id === selected.place_id);
    if (selectedIndex !== -1) {
      remainingCandidates.splice(selectedIndex, 1);
    }
  }

  // Log final category distribution
  const categoryDistribution = {};
  selectedPOIs.forEach(poi => {
    const group = poi.categoryGroup || 'other';
    categoryDistribution[group] = (categoryDistribution[group] || 0) + 1;
  });

  console.log(`🎉 Final selection with category distribution:`, categoryDistribution);
  console.log(`Selected ${selectedPOIs.length} places:`);
  selectedPOIs.forEach((place, idx) => {
    const priorityLabel = place.priorityScore === 999 ? 'LOW PRIORITY' : `Priority ${place.priorityScore}`;
    console.log(`   ${idx + 1}. ${place.name} (${place.categoryGroup}) - ${priorityLabel}`);
  });

  return selectedPOIs;
};

// ===== MAIN AMENITY SEARCH FUNCTION =====

/**
 * Find nearby amenities using the Google Places API
 * @param {number} lat - Latitude of the search location
 * @param {number} lng - Longitude of the search location
 * @param {number} radius - Search radius in meters (default: 2000)
 * @returns {Promise<Array>} Array of nearby amenities with coordinates
 */
export const findNearbyAmenities = async (lat, lng, radius = DEFAULT_SEARCH_RADIUS) => {
  try {
    // Load Google Maps API
    const google = await loadGoogleMaps();

    // Create map element (required for PlacesService)
    const mapDiv = document.createElement('div');
    const map = new google.maps.Map(mapDiv, {
      center: { lat, lng },
      zoom: 15
    });

    // Initialize Places service
    const placesService = new google.maps.places.PlacesService(map);

    // Configure search request
    const request = {
      location: { lat, lng },
      radius: radius,
      type: 'establishment'
    };

    console.log(`🔍 Searching for amenities within ${radius}m of (${lat}, ${lng})`);

    // Fetch all amenities
    const allAmenities = await fetchAllPlacesResults(placesService, request);

    if (allAmenities.length === 0) {
      return [];
    }

    // Select diverse POIs with penalties for similar types
    const topPOIs = selectDiversePOIs(allAmenities, lat, lng, MAX_POIS);

    if (topPOIs.length === 0) {
      return [];
    }

    // Fetch detailed information for selected POIs
    const detailedPOIPromises = topPOIs.map(place =>
      fetchPlaceDetails(placesService, place)
    );

    const detailedPOIs = await Promise.all(detailedPOIPromises);

    // Return the detailed POIs
    return detailedPOIs.filter(poi => poi !== null);

  } catch (error) {
    console.error('Error finding nearby amenities:', error);
    throw error;
  }
};
