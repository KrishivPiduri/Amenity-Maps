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
  let allAmenities = [];

  const processPage = (results, status, pagination) => {
    return new Promise((resolve, reject) => {
      if (status !== window.google.maps.places.PlacesServiceStatus.OK) {
        return reject(new Error(`Places API error: ${status}`));
      }

      const amenityPromises = results.map(place => {
        return new Promise((resolveDetail) => {
          const detailRequest = {
            placeId: place.place_id,
            fields: ['place_id', 'name', 'types', 'rating', 'price_level', 'vicinity', 'photos']
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
                photoUrl: detailResult.photos?.[0] ? detailResult.photos[0].getUrl({ maxWidth: 200 }) : null
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
                photoUrl: place.photos?.[0] ? place.photos[0].getUrl({ maxWidth: 200 }) : null
              });
            }
          });
        });
      });

      Promise.all(amenityPromises).then(amenities => {
        allAmenities = allAmenities.concat(amenities);
        if (pagination && pagination.hasNextPage) {
          // Adding a short delay before fetching the next page to avoid rate limiting issues
          setTimeout(() => pagination.nextPage(), 1000);
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

  return new Promise((resolve, reject) => {
    placesService.nearbySearch(request, (results, status, pagination) => {
      if (status !== window.google.maps.places.PlacesServiceStatus.OK) {
        return reject(new Error(`Places API error: ${status}`));
      }

      const processAllPages = (paginatedResults, paginatedStatus) => {
        if (paginatedStatus !== window.google.maps.places.PlacesServiceStatus.OK) {
          return reject(new Error(`Places API error: ${paginatedStatus}`));
        }

        allAmenities = allAmenities.concat(paginatedResults);

        if (pagination.hasNextPage) {
          setTimeout(() => pagination.nextPage(), 1000); // Wait before fetching next page
        } else {
          const amenityPromises = allAmenities.map(place => {
            return new Promise((resolveDetail) => {
              const detailRequest = {
                placeId: place.place_id,
                fields: ['place_id', 'name', 'types', 'rating', 'price_level', 'vicinity', 'photos']
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
                    photoUrl: detailResult.photos?.[0] ? detailResult.photos[0].getUrl({ maxWidth: 200 }) : null
                  });
                } else {
                  resolveDetail({
                    id: place.place_id,
                    name: place.name,
                    types: place.types || [],
                    rating: place.rating,
                    priceLevel: place.price_level,
                    vicinity: place.vicinity,
                    photoReference: place.photos?.[0]?.photo_reference,
                    photoUrl: place.photos?.[0] ? place.photos[0].getUrl({ maxWidth: 200 }) : null
                  });
                }
              });
            });
          });
          Promise.all(amenityPromises).then(detailedAmenities => {
            resolve(detailedAmenities);
          });
        }
      };

      placesService.nearbySearch(request, processAllPages);
    });
  });
};

/**
 * Get photo URL from photo reference or return SDK photo URL
 */
export const getPhotoUrl = (photoReference, maxWidth = 400) => {
  if (!photoReference) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${API_KEY}`;
};
