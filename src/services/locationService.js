const API_KEY = "AIzaSyBnxpK2n_vnXX5CoDMN6mFk3rgJ2Mi6S24";

// Load Google Maps JavaScript API
let googleMapsLoaded = false;
let googleMapsPromise = null;

const loadGoogleMaps = () => {
  if (googleMapsLoaded && window.google) {
    return Promise.resolve(window.google);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    if (window.google) {
      googleMapsLoaded = true;
      resolve(window.google);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      googleMapsLoaded = true;
      resolve(window.google);
    };

    script.onerror = () => {
      reject(new Error('Failed to load Google Maps API'));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
};

/**
 * Get coordinates from an address using Google Maps JavaScript SDK
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

/**
 * Get nearby amenities using Google Places JavaScript SDK
 */
export const getNearbyAmenities = async (placesService, lat, lng, radius = 5000) => {
  const location = new window.google.maps.LatLng(lat, lng);

  const fetchAllResults = (request) => {
    return new Promise((resolve, reject) => {
      let allAmenities = [];
      placesService.nearbySearch(request, (results, status, pagination) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK && status !== window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          return reject(new Error(`Places API error: ${status}`));
        }

        if (results) {
            allAmenities = allAmenities.concat(results);
        }

        if (pagination && pagination.hasNextPage) {
          // Adding a short delay before fetching the next page to avoid rate limiting issues
          setTimeout(() => pagination.nextPage(), 200); // 200ms delay
        } else {
          resolve(allAmenities);
        }
      });
    });
  };

  const request = {
    location: location,
    radius: radius,
    keyword: ['bank', 'bar', 'cafe', 'hospital', 'park', 'pharmacy', 'school', 'supermarket', 'gym', 'restaurant', 'shopping_mall', 'store'].join(' | '),
  };

  const allAmenities = await fetchAllResults(request);

  if (allAmenities.length === 0) {
    return [];
  }

  // AI-powered selection of amenities
  const selectedAmenities = selectProminentAmenities(allAmenities);

  const detailedAmenityPromises = selectedAmenities.map(place => {
    return new Promise((resolveDetail) => {
      const detailRequest = {
        placeId: place.place_id,
        fields: ['place_id', 'name', 'types', 'rating', 'price_level', 'vicinity', 'photos', 'user_ratings_total']
      };
      placesService.getDetails(detailRequest, (detailResult, detailStatus) => {
        if (detailStatus === window.google.maps.places.PlacesServiceStatus.OK) {
          resolveDetail({
            id: detailResult.place_id,
            name: detailResult.name,
            types: detailResult.types || [],
            rating: detailResult.rating,
            priceLevel: detailResult.price_level,
            vicinity: detailResult.vicinity,
            photoReference: detailResult.photos?.[0]?.photo_reference,
            photoUrl: detailResult.photos?.[0] ? detailResult.photos[0].getUrl({ maxWidth: 200 }) : null,
            user_ratings_total: detailResult.user_ratings_total
          });
        } else {
          // Fallback to basic info if getDetails fails
          resolveDetail({
            id: place.place_id,
            name: place.name,
            types: place.types || [],
            rating: place.rating,
            priceLevel: place.price_level,
            vicinity: place.vicinity,
            photoReference: place.photos?.[0]?.photo_reference,
            photoUrl: place.photos?.[0] ? place.photos[0].getUrl({ maxWidth: 200 }) : null,
            user_ratings_total: place.user_ratings_total
          });
        }
      });
    });
  });

  return Promise.all(detailedAmenityPromises);
};

const selectProminentAmenities = (amenities) => {
  const categories = {
    restaurant: { weight: 1.2, minScore: 0 },
    cafe: { weight: 1.0, minScore: 0 },
    supermarket: { weight: 1.0, minScore: 0 },
    park: { weight: 1.0, minScore: 0 },
    bank: { weight: 0.8, minScore: 0 },
    pharmacy: { weight: 0.8, minScore: 0 },
    gym: { weight: 0.9, minScore: 0 },
    shopping_mall: { weight: 1.1, minScore: 0 },
  };

  // Known prominent brands/chains
  const prominentBrands = [
    'starbucks', 'mcdonald', 'subway', 'pizza hut', 'domino', 'kfc', 'burger king', 'taco bell',
    'chase', 'bank of america', 'wells fargo', 'citibank', 'td bank', 'pnc bank',
    'cvs', 'walgreens', 'rite aid', 'walmart', 'target', 'whole foods', 'trader joe',
    'planet fitness', 'la fitness', '24 hour fitness', 'gold\'s gym',
    'marriott', 'hilton', 'hyatt', 'best western', 'holiday inn'
  ];

  const calculateProminence = (place) => {
    const name = place.name.toLowerCase();
    let score = 0;

    // Check if it's a known brand
    const isBrand = prominentBrands.some(brand => name.includes(brand));
    if (isBrand) {
      score += 100; // High base score for recognized brands
    }

    // Add points for number of reviews (popularity indicator)
    const reviews = place.user_ratings_total || 0;
    score += Math.log10(reviews + 1) * 10;

    // Small bonus for decent rating, but not the main factor
    const rating = place.rating || 0;
    if (rating >= 4.0) score += 10;
    else if (rating >= 3.5) score += 5;

    return score;
  };

  const scoredAmenities = amenities.map(p => ({ ...p, prominence: calculateProminence(p) }));

  const categoryTops = {};

  Object.keys(categories).forEach(category => {
    const placesInCategory = scoredAmenities.filter(p => p.types.includes(category));
    if (placesInCategory.length > 0) {
      placesInCategory.sort((a, b) => b.prominence - a.prominence);
      categoryTops[category] = placesInCategory[0];
    }
  });

  const sortedCategories = Object.keys(categoryTops)
    .sort((a, b) => {
      const scoreA = categoryTops[a].prominence * categories[a].weight;
      const scoreB = categoryTops[b].prominence * categories[b].weight;
      return scoreB - scoreA;
    });

  let selected = [];
  const selectedIds = new Set();
  const usedCategories = new Set();

  // First pass: select top category representatives
  sortedCategories.forEach(category => {
    const place = categoryTops[category];
    if (!selectedIds.has(place.place_id) && !usedCategories.has(category)) {
      selected.push(place);
      selectedIds.add(place.place_id);
      usedCategories.add(category);
    }
  });

  // If we have less than 6, consider adding more from the same categories
  // but only if they have exceptionally high prominence scores
  if (selected.length < 6) {
    const remainingSorted = scoredAmenities
      .filter(p => !selectedIds.has(p.place_id))
      .sort((a, b) => b.prominence - a.prominence);

    const needed = 6 - selected.length;

    for (let i = 0; i < remainingSorted.length && selected.length < 6; i++) {
      const place = remainingSorted[i];
      const placeCategories = Object.keys(categories).filter(cat => place.types.includes(cat));
      const categoryAlreadyUsed = placeCategories.some(cat => usedCategories.has(cat));

      if (!categoryAlreadyUsed) {
        // No category conflict, add it
        selected.push(place);
        selectedIds.add(place.place_id);
        placeCategories.forEach(cat => usedCategories.add(cat));
      } else if (place.prominence > 120) {
        // Exceptionally high score (brand + lots of reviews) - worth showing duplicate category
        selected.push(place);
        selectedIds.add(place.place_id);
      }
    }
  }

  return selected.slice(0, 6);
};

/**
 * Get photo URL from photo reference or return SDK photo URL
 */
export const getPhotoUrl = (photoReference, maxWidth = 400) => {
  if (!photoReference) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${API_KEY}`;
};
