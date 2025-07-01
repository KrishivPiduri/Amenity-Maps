import { getPhotoUrl } from '../services/locationService';

const AmenitiesDisplay = ({ amenities, loading, error }) => {
  if (loading) {
    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3 text-gray-800">Nearby Amenities</h3>
        <p className="text-gray-500 italic">Loading amenities...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3 text-gray-800">Nearby Amenities</h3>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!amenities || amenities.length === 0) return null;

  const formatTypes = (types) => {
    return types
      .filter(type => !type.includes('establishment') && !type.includes('point_of_interest'))
      .map(type => type.replace(/_/g, ' '))
      .slice(0, 3)
      .join(', ');
  };

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">
        Nearby Amenities ({amenities.length})
      </h3>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {amenities.map((amenity) => (
          <div key={amenity.id} className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-medium text-gray-900">{amenity.name}</h4>
              {amenity.rating && (
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                  ⭐ {amenity.rating}
                </span>
              )}
            </div>

            {formatTypes(amenity.types) && (
              <p className="text-sm text-gray-600 mb-1 capitalize">
                {formatTypes(amenity.types)}
              </p>
            )}

            {amenity.vicinity && (
              <p className="text-sm text-gray-500 mb-2">{amenity.vicinity}</p>
            )}

            <div className="flex items-center gap-3 text-xs text-gray-500">
              {amenity.openNow !== undefined && (
                <span className={`px-2 py-1 rounded ${
                  amenity.openNow 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {amenity.openNow ? 'Open' : 'Closed'}
                </span>
              )}

              {amenity.priceLevel && (
                <span className="text-gray-600">
                  {'$'.repeat(amenity.priceLevel)}
                </span>
              )}
            </div>

            {(amenity.photoUrl || amenity.photoReference) && (
              <img
                src={amenity.photoUrl || getPhotoUrl(amenity.photoReference, 200)}
                alt={amenity.name}
                className="mt-3 w-full h-32 object-cover rounded"
                loading="lazy"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AmenitiesDisplay;
