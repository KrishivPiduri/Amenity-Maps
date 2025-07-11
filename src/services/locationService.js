// ===== CONFIGURATION =====
const API_KEY = "AIzaSyBnxpK2n_vnXX5CoDMN6mFk3rgJ2Mi6S24";

// Priority list - higher on the list = higher priority
const priority = [
  "grocery_store",
  "supermarket",
  "pharmacy",
  "hospital",
  "doctor",
  "dentist",
  "medical_lab",
  "dental_clinic",
  "bank",
  "atm",
  "post_office",
  "library",
  "secondary_school",
  "primary_school",
  "school",
  "university",
  "park",
  "natural_features",
  "restaurant",
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
  "book_store",
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
  "post_office",
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
  "meal_delivery",
  "meal_takeaway",
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

// Search radius reduced to 2km for higher relevance
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

// ===== HIGH-IMPACT POI FILTERING =====

/**
 * Get priority score for a place based on its types
 * @param {Array} types - Place types from Google Places API
 * @returns {number} Priority score (lower number = higher priority, Infinity = not in priority list)
 */
const getPriorityScore = (types = []) => {
  if (!types || types.length === 0) return Infinity;

  // Find the highest priority type (lowest index in priority array)
  let bestPriority = Infinity;
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
 * @returns {string} Primary category or 'unknown'
 */
const getPrimaryCategory = (types = []) => {
  if (!types || types.length === 0) return 'unknown';

  let bestPriority = Infinity;
  let primaryCategory = 'unknown';

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
 * Define hierarchical relationships between categories
 * Higher priority categories exclude lower priority ones
 */
const CATEGORY_HIERARCHIES = {
  'bank': ['atm'], // If bank is selected, exclude ATMs
  'hospital': ['doctor', 'medical_lab'], // If hospital is selected, exclude individual doctors/labs
  'university': ['school', 'primary_school', 'secondary_school'], // If university is selected, exclude other schools
  'shopping_mall': ['department_store', 'clothing_store', 'shoe_store'], // If mall is selected, exclude individual stores
  'supermarket': ['grocery_store', 'convenience_store'], // If supermarket is selected, exclude smaller stores
};

/**
 * Check if a category should be excluded based on already selected categories
 * @param {string} category - Category to check
 * @param {Array} selectedCategories - Already selected categories
 * @returns {boolean} True if category should be excluded
 */
const shouldExcludeCategory = (category, selectedCategories) => {
  // Check if any selected category hierarchically excludes this category
  for (const selectedCategory of selectedCategories) {
    const excludedCategories = CATEGORY_HIERARCHIES[selectedCategory];
    if (excludedCategories && excludedCategories.includes(category)) {
      return true;
    }
  }
  return false;
};

/**
 * Selects top 8 POIs based on priority list with diversity penalty for duplicates
 * and hierarchical exclusion rules
 * @param {Array} amenities - Raw amenities from Places API
 * @param {number} inputLat - Input location latitude
 * @param {number} inputLng - Input location longitude
 * @param {number} maxResults - Maximum number of results to return (default: 8)
 * @returns {Array} Top priority POIs with diversity and hierarchy rules
 */
const selectHighImpactPOIs = (amenities, inputLat, inputLng, maxResults = MAX_POIS) => {
  // Process all amenities and assign priority scores
  const processedAmenities = amenities
    .map(place => {
      const priorityScore = getPriorityScore(place.types);

      // Skip places not in priority list
      if (priorityScore === Infinity) return null;

      return {
        ...place,
        priorityScore,
        primaryCategory: getPrimaryCategory(place.types),
        distance: place.geometry?.location ? calculateDistance(
          inputLat,
          inputLng,
          place.geometry.location.lat(),
          place.geometry.location.lng()
        ) : null
      };
    })
    .filter(place => place !== null); // Remove places not in priority list

  if (processedAmenities.length === 0) {
    return [];
  }

  // Sort by priority first (lower priorityScore = higher priority)
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

  // Smart selection with diversity penalty and hierarchical exclusion
  const selectedPOIs = [];
  const categoryCount = {}; // Track how many of each category we've selected
  const selectedCategories = []; // Track which categories have been selected

  for (const place of sortedAmenities) {
    if (selectedPOIs.length >= maxResults) break;

    const category = place.primaryCategory;
    const currentCount = categoryCount[category] || 0;

    // Check if this category should be excluded due to hierarchy rules
    if (shouldExcludeCategory(category, selectedCategories)) {
      console.log(`🚫 Excluding ${place.name} (${category}) due to hierarchy rules`);
      continue;
    }

    // Calculate diversity penalty
    // First of a category: no penalty
    // Second of a category: moderate penalty (effective priority score * 1.5)
    // Third of a category: heavy penalty (effective priority score * 3)
    // Fourth+ of a category: severe penalty (effective priority score * 5)
    let diversityPenalty = 1;
    if (currentCount >= 3) {
      diversityPenalty = 5; // Severe penalty for 4th+ duplicate
    } else if (currentCount === 2) {
      diversityPenalty = 3; // Heavy penalty for 3rd duplicate
    } else if (currentCount === 1) {
      diversityPenalty = 1.5; // Moderate penalty for 2nd duplicate
    }

    const adjustedPriorityScore = place.priorityScore * diversityPenalty;

    // Check if this place should be included based on diversity
    let shouldInclude = true;

    // If we have room, always include the first of any category
    if (currentCount === 0) {
      shouldInclude = true;
    } else {
      // For duplicates, check if the adjusted priority is still competitive
      // Compare against the worst currently selected item
      if (selectedPOIs.length > 0) {
        const worstSelected = selectedPOIs[selectedPOIs.length - 1];
        const worstAdjustedScore = worstSelected.priorityScore * (categoryCount[worstSelected.primaryCategory] > 1 ? 1.5 : 1);

        // Only include if this duplicate is significantly better than the worst selected
        if (adjustedPriorityScore > worstAdjustedScore * 1.2) {
          shouldInclude = false;
        }
      }
    }

    if (shouldInclude) {
      selectedPOIs.push({
        ...place,
        adjustedPriorityScore,
        diversityPenalty
      });
      categoryCount[category] = currentCount + 1;

      // Add to selected categories list (only first time)
      if (currentCount === 0) {
        selectedCategories.push(category);
      }

      console.log(`✅ Selected ${place.name} (${category}) - Priority: ${place.priorityScore}, Adjusted: ${adjustedPriorityScore.toFixed(1)}`);
    }
  }

  return selectedPOIs;
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
  const topHighImpactPOIs = selectHighImpactPOIs(allAmenities, lat, lng, MAX_POIS);

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
