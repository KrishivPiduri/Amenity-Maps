import { useState } from 'react'
import './App.css'
import { getCoordinatesFromAddress, getNearbyAmenities } from './services/locationService'
import CoordinatesDisplay from './components/CoordinatesDisplay'
import AmenitiesDisplay from './components/AmenitiesDisplay'
import { useGoogleMapsService } from './services/useGoogleMapsService';

function App() {
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState(null);
  const [formattedAddress, setFormattedAddress] = useState('');
  const [amenities, setAmenities] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [amenitiesLoading, setAmenitiesLoading] = useState(false);
  const [amenitiesError, setAmenitiesError] = useState(null);
  const { services, placesServiceDiv } = useGoogleMapsService();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!services.geocoder || !services.placesService) {
      setError('Google Maps services are not available yet.');
      return;
    }

    setError(null);
    setCoords(null);
    setFormattedAddress('');
    setAmenities([]);
    setAmenitiesError(null);
    setLoading(true);

    try {
      const locationData = await getCoordinatesFromAddress(services.geocoder, address);
      setCoords({ lat: locationData.lat, lng: locationData.lng });
      setFormattedAddress(locationData.formattedAddress);

      setAmenitiesLoading(true);
      try {
        const nearbyAmenities = await getNearbyAmenities(services.placesService, locationData.lat, locationData.lng);
        setAmenities(nearbyAmenities);
      } catch (amenitiesErr) {
        setAmenitiesError(amenitiesErr.message);
      } finally {
        setAmenitiesLoading(false);
      }

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {placesServiceDiv}
      <div className="max-w-4xl mx-auto">
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
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded font-medium"
            >
              {loading ? 'Exploring...' : 'Explore Location'}
            </button>
          </form>

          {error && <p className="mt-4 text-red-500">{error}</p>}

          <CoordinatesDisplay coords={coords} address={formattedAddress} />
        </div>

        {(coords || amenitiesLoading || amenitiesError) && (
          <div className="bg-white p-8 rounded-lg shadow">
            <AmenitiesDisplay
              amenities={amenities}
              loading={amenitiesLoading}
              error={amenitiesError}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default App
