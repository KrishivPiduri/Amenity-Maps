import { useState } from 'react'
import './App.css'
import { getCoordinatesFromAddress, getNearbyAmenities } from './services/locationService'
import CoordinatesDisplay from './components/CoordinatesDisplay'
import AmenitiesDisplay from './components/AmenitiesDisplay'
import MapboxMap from './components/MapboxMap'
import { useGoogleMapsService } from './services/useGoogleMapsService.jsx';

function App() {
  // ===== STATE MANAGEMENT =====
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState(null);
  const [formattedAddress, setFormattedAddress] = useState('');
  const [amenities, setAmenities] = useState([]);

  // Error and loading states
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [amenitiesLoading, setAmenitiesLoading] = useState(false);
  const [amenitiesError, setAmenitiesError] = useState(null);

  // Google Maps services
  const { services, placesServiceDiv, loading: servicesLoading, error: servicesError } = useGoogleMapsService();

  // ===== EVENT HANDLERS =====

  /**
   * Handles form submission for address exploration
   * Geocodes the address and fetches nearby amenities
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate that Google Maps services are available
    if (!services.geocoder || !services.placesService) {
      setError('Google Maps services are not available yet. Please wait and try again.');
      return;
    }

    // Reset all states
    resetStates();
    setLoading(true);

    try {
      // Geocode the address to get coordinates
      const locationData = await getCoordinatesFromAddress(services.geocoder, address);
      setCoords({ lat: locationData.lat, lng: locationData.lng });
      setFormattedAddress(locationData.formattedAddress);

      // Fetch nearby amenities
      await fetchNearbyAmenities(locationData.lat, locationData.lng);

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetches nearby amenities for given coordinates
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   */
  const fetchNearbyAmenities = async (lat, lng) => {
    setAmenitiesLoading(true);
    setAmenitiesError(null);

    try {
      const nearbyAmenities = await getNearbyAmenities(services.placesService, lat, lng);
      setAmenities(nearbyAmenities);
    } catch (amenitiesErr) {
      setAmenitiesError(amenitiesErr.message);
    } finally {
      setAmenitiesLoading(false);
    }
  };

  /**
   * Resets all form and result states
   */
  const resetStates = () => {
    setError(null);
    setCoords(null);
    setFormattedAddress('');
    setAmenities([]);
    setAmenitiesError(null);
  };

  // ===== RENDER HELPERS =====

  /**
   * Renders the main form section
   */
  const renderForm = () => (
    <div className="bg-white p-8 rounded-lg shadow mb-6">
      <h1 className="text-2xl font-semibold mb-6 text-center">
        Address Explorer
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter an address to explore"
          className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          disabled={loading || servicesLoading}
        />

        <button
          type="submit"
          disabled={loading || servicesLoading}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded font-medium transition-colors"
        >
          {loading ? 'Exploring...' : servicesLoading ? 'Loading Services...' : 'Explore Location'}
        </button>
      </form>

      {/* Error Messages */}
      {(error || servicesError) && (
        <p className="mt-4 text-red-500">
          {error || servicesError}
        </p>
      )}

      {/* Location Results */}
      <CoordinatesDisplay coords={coords} address={formattedAddress} />
    </div>
  );

  /**
   * Renders the amenities section with map
   */
  const renderAmenitiesAndMap = () => {
    if (!coords && !amenitiesLoading && !amenitiesError) return null;

    return (
      <div className="space-y-6">
        {/* Map Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Map View</h3>
          <MapboxMap
            coords={coords}
            amenities={amenities}
            className="w-full"
          />
        </div>

        {/* Amenities List Section */}
        <div className="bg-white p-8 rounded-lg shadow">
          <AmenitiesDisplay
            amenities={amenities}
            loading={amenitiesLoading}
            error={amenitiesError}
          />
        </div>
      </div>
    );
  };

  // ===== MAIN RENDER =====
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Hidden div required for Google Places Service */}
      {placesServiceDiv}

      <div className="max-w-6xl mx-auto">
        {renderForm()}
        {renderAmenitiesAndMap()}
      </div>
    </div>
  );
}

export default App;
