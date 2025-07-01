import { getPhotoUrl } from '../services/locationService';

/**
 * Component for displaying nearby amenities with name and coordinates only
 * @param {Array} amenities - List of amenity objects to display
 * @param {boolean} loading - Loading state for amenities
 * @param {string} error - Error message if any
 */
const AmenitiesDisplay = ({ amenities, loading, error }) => {
  // ===== EARLY RETURNS FOR DIFFERENT STATES =====

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

  // ===== UTILITY FUNCTIONS =====

  /**
   * Renders a single simplified amenity card with name and coordinates
   * @param {Object} amenity - Amenity object to render
   * @returns {JSX.Element} Simple amenity card
   */
  const renderSimpleAmenityCard = (amenity) => (
    <div key={amenity.id} className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Place Name */}
      <h4 className="font-medium text-gray-900 mb-3">{amenity.name}</h4>

      {/* Coordinates */}
      {amenity.coordinates ? (
        <div className="text-sm text-gray-600 space-y-1">
          <p>
            <span className="font-medium">Latitude:</span> {amenity.coordinates.lat.toFixed(6)}
          </p>
          <p>
            <span className="font-medium">Longitude:</span> {amenity.coordinates.lng.toFixed(6)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic">Coordinates not available</p>
      )}
    </div>
  );

  // ===== MAIN RENDER =====
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">
        Nearby Amenities ({amenities.length})
      </h3>

      <div className="grid gap-4 max-h-96 overflow-y-auto">
        {amenities.map(renderSimpleAmenityCard)}
      </div>
    </div>
  );
};

export default AmenitiesDisplay;
