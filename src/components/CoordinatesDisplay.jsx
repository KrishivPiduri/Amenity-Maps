const CoordinatesDisplay = ({ coords, address }) => {
  if (!coords) return null;

  return (
    <div className="mt-6 bg-gray-50 p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">Location Details</h3>
      {address && (
        <p className="text-gray-700 mb-2">
          <span className="font-medium">Address:</span> {address}
        </p>
      )}
      <p className="text-gray-700">
        <span className="font-medium">Latitude:</span> {coords.lat}
      </p>
      <p className="text-gray-700">
        <span className="font-medium">Longitude:</span> {coords.lng}
      </p>
    </div>
  );
};

export default CoordinatesDisplay;
