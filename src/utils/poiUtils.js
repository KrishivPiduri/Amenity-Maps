import { fetchBrandLogo, extractDomainFromName } from '../services/brandService.js';

// Category icons for fallback when no brand logo is available
export const CATEGORY_ICONS = {
  'restaurant': '🍽️',
  'food': '🍽️',
  'gas_station': '⛽',
  'grocery_or_supermarket': '🛒',
  'pharmacy': '💊',
  'finance': '🏦',
  'hospital': '🏥',
  'gym': '💪',
  'shopping_mall': '🛍️',
  'store': '🏪',
  'cafe': '☕',
  'bar': '🍺',
  'park': '🌳',
  'primary_school': '🏫',
  'secondary_school': '🏫',
  'school': '🏫',
  'atm': '🏦',
  'bank': '🏦',
  'library': '📚',
  'lodging': '🏨',
  'default': '📍'
};

/**
 * Get display data for a POI (logo or icon + category) with Brandfetch integration
 * @param {Object} poi - POI object
 * @returns {Promise<Object>} Display data with type, logo/icon, and name
 */
export const getPoiDisplayData = async (poi) => {
  const name = poi.name || '';
  const types = poi.types || [];

  // Try to get brand logo from Brandfetch
  const domain = extractDomainFromName(name);
  if (domain) {
    try {
      const logoUrl = await fetchBrandLogo(domain);
      if (logoUrl) {
        return {
          type: 'brand',
          logo: logoUrl,
          name: poi.name,
          isAsync: true
        };
      }
    } catch (error) {
      console.error('Error fetching brand logo:', error);
    }
  }

  // Fallback to category icons
  const primaryType = types[0] || 'default';
  const icon = CATEGORY_ICONS[primaryType] || CATEGORY_ICONS.default;

  return {
    type: 'category',
    icon,
    name: poi.name,
    isAsync: false
  };
};
