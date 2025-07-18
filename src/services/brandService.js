// Brand fetching service with Brandfetch API integration
const BRANDFETCH_API_KEY = 'HMHMAUXlZLFR4kLzfYjWFz4CyaQ+C5sC/ZkN+rs98+Y='; // Replace with actual API key
const BRANDFETCH_BASE_URL = 'https://api.brandfetch.io/v2';

// Cache for fetched logos to avoid duplicate API calls
const logoCache = new Map();

/**
 * Fetch brand logo using Brandfetch API with proper CORS handling
 * @param {string} domain - The domain to fetch logo for
 * @returns {Promise<string|null>} Logo URL or null if not found
 */
export const fetchBrandLogo = async (domain) => {
  // Check cache first
  if (logoCache.has(domain)) {
    const cachedResult = logoCache.get(domain);
    return cachedResult;
  }

  // Method 1: Try Brandfetch API with proper configuration
  try {
    const response = await fetch(`${BRANDFETCH_BASE_URL}/brands/${domain}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BRANDFETCH_API_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      mode: 'cors',
      credentials: 'omit'
    });

    if (response.ok) {
      const data = await response.json();
      const logoUrl = extractLogoFromBrandfetchData(data, domain);
      if (logoUrl) {
        logoCache.set(domain, logoUrl);
        return logoUrl;
      }
    } else {
      // Try alternative domain formats for 404 errors
      if (response.status === 404) {
        const altDomain = domain.replace('www.', '');
        if (altDomain !== domain) {
          return await fetchBrandLogoAlternative(altDomain);
        }
      }
    }
  } catch (error) {
    // Check if it's a CORS error and try workaround
    if (error.message.includes('CORS') || error.message.includes('fetch')) {
      return await fetchBrandLogoWithProxy(domain);
    }
  }

  // Method 2: Try Clearbit as immediate fallback
  try {
    const clearbitUrl = `https://logo.clearbit.com/${domain}`;
    const logoExists = await testImageUrl(clearbitUrl, 2000);
    if (logoExists) {
      logoCache.set(domain, clearbitUrl);
      return clearbitUrl;
    }
  } catch (error) {
    // Silent fallback
  }

  // Method 3: Google Favicon as last resort
  try {
    const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    logoCache.set(domain, faviconUrl);
    return faviconUrl;
  } catch (error) {
    // Silent fallback
  }

  logoCache.set(domain, null);
  return null;
};

/**
 * Try alternative domain format for Brandfetch
 */
const fetchBrandLogoAlternative = async (domain) => {
  try {
    const response = await fetch(`${BRANDFETCH_BASE_URL}/brands/${domain}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BRANDFETCH_API_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      mode: 'cors',
      credentials: 'omit'
    });

    if (response.ok) {
      const data = await response.json();
      const logoUrl = extractLogoFromBrandfetchData(data, domain);
      if (logoUrl) {
        logoCache.set(domain, logoUrl);
        return logoUrl;
      }
    }
  } catch (error) {
    // Silent fallback
  }
  return null;
};

/**
 * Try Brandfetch with CORS proxy (if available)
 */
const fetchBrandLogoWithProxy = async (domain) => {
  try {
    // You can use a CORS proxy service like cors-anywhere or allorigins
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`${BRANDFETCH_BASE_URL}/brands/${domain}`)}`;

    const response = await fetch(proxyUrl, {
      headers: {
        'Authorization': `Bearer ${BRANDFETCH_API_KEY}`
      }
    });

    if (response.ok) {
      const proxyData = await response.json();
      const data = JSON.parse(proxyData.contents);
      const logoUrl = extractLogoFromBrandfetchData(data, domain);
      if (logoUrl) {
        logoCache.set(domain, logoUrl);
        return logoUrl;
      }
    }
  } catch (error) {
    // Silent fallback
  }
  return null;
};

/**
 * Test if an image URL is valid and loads successfully
 */
const testImageUrl = (url, timeout = 3000) => {
  return new Promise((resolve) => {
    const img = new Image();

    const timer = setTimeout(() => {
      resolve(false);
    }, timeout);

    img.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };

    img.src = url;
  });
};

/**
 * Extract logo URL from Brandfetch API response with improved logic
 */
const extractLogoFromBrandfetchData = (data, domain) => {
  try {
    const logos = data.logos || [];
    console.log(`🎨 Found ${logos.length} logos for ${domain}`);

    if (logos.length === 0) {
      console.log(`❌ No logos in Brandfetch response for ${domain}`);
      return null;
    }

    // Priority order: icon > logo > symbol > any other type
    const logoTypes = ['icon', 'logo', 'symbol'];
    let bestLogo = null;

    for (const type of logoTypes) {
      bestLogo = logos.find(logo => logo.type === type);
      if (bestLogo) break;
    }

    // If no preferred type found, use the first logo
    if (!bestLogo) {
      bestLogo = logos[0];
    }

    console.log(`🎯 Selected logo type "${bestLogo.type}" for ${domain}`);

    // Extract the best format (prefer PNG > SVG > JPEG > WebP)
    const formats = bestLogo.formats || [];
    const formatPriority = ['png', 'svg', 'jpeg', 'jpg', 'webp'];

    let bestFormat = null;
    for (const format of formatPriority) {
      bestFormat = formats.find(f => f.format === format);
      if (bestFormat) break;
    }

    if (!bestFormat && formats.length > 0) {
      bestFormat = formats[0]; // Fallback to first available format
    }

    if (!bestFormat) {
      console.log(`❌ No usable formats found for ${domain}`);
      return null;
    }

    const logoUrl = bestFormat.src;
    console.log(`✅ Extracted logo URL for ${domain}: ${logoUrl}`);
    return logoUrl;

  } catch (error) {
    console.error(`Error extracting logo from Brandfetch data for ${domain}:`, error);
    return null;
  }
};

/**
 * Extract domain from POI name for Brandfetch lookup
 * @param {string} name - POI name
 * @returns {string|null} Domain to lookup or null
 */
export const extractDomainFromName = (name) => {
  const normalizedName = name.toLowerCase().trim();
  console.log(`🔍 Trying to match: "${normalizedName}"`);

  // Known brand mappings to domains
  const brandDomains = {
    'starbucks': 'starbucks.com',
    'mcdonalds': 'mcdonalds.com',
    'mcdonald\'s': 'mcdonalds.com',
    'subway': 'subway.com',
    'walmart': 'walmart.com',
    'target': 'target.com',
    'cvs': 'cvs.com',
    'walgreens': 'walgreens.com',
    'shell': 'shell.com',
    'exxon': 'exxonmobil.com',
    'mobil': 'exxonmobil.com',
    'bp': 'bp.com',
    'chevron': 'chevron.com',
    'texaco': 'texaco.com',
    'circle k': 'circlek.com',
    '7-eleven': '7eleven.com',
    'best buy': 'bestbuy.com',
    'home depot': 'homedepot.com',
    'lowes': 'lowes.com',
    'costco': 'costco.com',
    'sam\'s club': 'samsclub.com',
    'kroger': 'kroger.com',
    'safeway': 'safeway.com',
    'whole foods': 'wholefoodsmarket.com',
    'trader joe\'s': 'traderjoes.com',
    'chipotle': 'chipotle.com',
    'taco bell': 'tacobell.com',
    'kfc': 'kfc.com',
    'pizza hut': 'pizzahut.com',
    'domino\'s': 'dominos.com',
    'papa john\'s': 'papajohns.com',
    'dunkin\'': 'dunkindonuts.com',
    'dunkin donuts': 'dunkindonuts.com',
    'tim hortons': 'timhortons.com',
    'panera': 'panerabread.com',
    'panera bread': 'panerabread.com',
    'wendys': 'wendys.com',
    'wendy\'s': 'wendys.com',
    'popeyes': 'popeyes.com',
    'sonic': 'sonicdrivein.com',
    'sonic drive-in': 'sonicdrivein.com'
  };

  // Check for exact matches first
  if (brandDomains[normalizedName]) {
    console.log(`✅ Exact match found: "${normalizedName}" -> ${brandDomains[normalizedName]}`);
    return brandDomains[normalizedName];
  }

  // Check for partial matches - sort by length descending to match longer brands first
  const sortedBrands = Object.entries(brandDomains).sort((a, b) => b[0].length - a[0].length);

  for (const [brand, domain] of sortedBrands) {
    // Use word boundary matching for better accuracy
    const brandWords = brand.split(/\s+/);
    const nameWords = normalizedName.split(/\s+/);

    console.log(`  🔎 Checking brand "${brand}" (${brandWords.join(', ')}) against name words (${nameWords.join(', ')})`);

    // Check if all words from the brand appear in the name
    const allWordsMatch = brandWords.every(brandWord => {
      const found = nameWords.some(nameWord => nameWord.includes(brandWord));
      console.log(`    • Brand word "${brandWord}" ${found ? '✅ found' : '❌ not found'} in name words`);
      return found;
    });

    if (allWordsMatch) {
      console.log(`✅ Word match found: "${normalizedName}" -> brand "${brand}" -> ${domain}`);
      return domain;
    }
  }

  // Fallback to simple includes check
  console.log(`🔄 Trying fallback simple includes check...`);
  for (const [brand, domain] of sortedBrands) {
    if (normalizedName.includes(brand)) {
      console.log(`✅ Fallback matched "${normalizedName}" to brand "${brand}" -> ${domain}`);
      return domain;
    }
  }

  console.log(`❌ No brand match found for: "${normalizedName}"`);
  return null;
};
