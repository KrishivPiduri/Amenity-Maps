// Test the brand mappings
const testBrands = ['panera bread', 'wendys', 'wendy\'s', 'popeyes', 'sonic', 'sonic drive-in'];

console.log('Testing brand mappings:');
testBrands.forEach(brand => {
  console.log(`"${brand}" -> needs mapping`);
});

// Required additions to brandDomains object:
console.log('\nAdd these to brandDomains:');
console.log("'wendys': 'wendys.com',");
console.log("'wendy\\'s': 'wendys.com',");
console.log("'popeyes': 'popeyes.com',");
console.log("'sonic': 'sonicdrivein.com',");
console.log("'sonic drive-in': 'sonicdrivein.com'");

// Required additions to static logo mapping:
console.log('\nAdd these to getStaticLogoMapping:');
console.log("'wendys.com': 'https://upload.wikimedia.org/wikipedia/en/thumb/5/59/Wendy%27s_logo_2012.svg/64px-Wendy%27s_logo_2012.svg.png',");
console.log("'popeyes.com': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Popeyes_Louisiana_Kitchen_logo.svg/64px-Popeyes_Louisiana_Kitchen_logo.svg.png',");
console.log("'sonicdrivein.com': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Sonic_Drive-In_logo.svg/64px-Sonic_Drive-In_logo.svg.png'");
