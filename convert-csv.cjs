const fs = require('fs');
const path = require('path');

// Read and parse the CSV file
const csvPath = path.join(__dirname, 'data', 'AristoCratWhereToPlay.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Parse CSV (handling quoted fields with commas and newlines)
function parseCSV(content) {
  const lines = [];
  let currentLine = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentLine.push(currentField);
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && content[i + 1] === '\n') i++;
      if (currentField || currentLine.length > 0) {
        currentLine.push(currentField);
        lines.push(currentLine);
        currentLine = [];
        currentField = '';
      }
    } else {
      currentField += char;
    }
  }
  
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField);
    lines.push(currentLine);
  }
  
  return lines;
}

const rows = parseCSV(csvContent);
const headers = rows[0];
const dataRows = rows.slice(1);

// Helper to create slug from name
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper to create SKU from name
function createSku(name) {
  const slug = slugify(name);
  return `ari-${slug}`.substring(0, 50);
}

// Helper to extract game group from URL
function extractGameGroup(url) {
  if (!url) return null;
  if (url.includes('/game-groups/')) {
    return 'Game Group';
  }
  return 'Slot Game';
}

// Parse CSV rows into objects
const games = dataRows.map(row => {
  const obj = {};
  headers.forEach((header, i) => {
    obj[header] = row[i] || '';
  });
  return obj;
}).filter(game => game.GameLink && game.GameLink.trim());

// Create products array
const products = games.map(game => {
  const name = game.GameLink.trim();
  const sku = createSku(name);
  const slug = slugify(name);
  const description = game.GameDescription || game.GameHeading || '';
  const shortDescription = game.GameHeading || '';
  const gameUrl = game['GameLink-href'] || '';
  const logoSrc = game['GameLogo-src'] || '';
  const imageSrc = game['GameImage1-src'] || '';
  
  // Build features array
  const features = [];
  for (let i = 1; i <= 5; i++) {
    const featureName = game[`GameFeature${i}`];
    const featureText = game[`GameFeature${i}Text`] || game[`GameFeature${i}text`];
    if (featureName && featureName.trim()) {
      features.push({
        name: featureName.trim(),
        description: featureText ? featureText.trim() : ''
      });
    }
  }
  
  // Build images array
  const images = [];
  if (logoSrc) {
    images.push({
      url: logoSrc.startsWith('http') ? logoSrc : `https://www.aristocratgaming.com${logoSrc}`,
      label: `${name} Logo`,
      roles: ['THUMBNAIL', 'SMALL']
    });
  }
  if (imageSrc) {
    images.push({
      url: imageSrc.startsWith('http') ? imageSrc : `https://www.aristocratgaming.com${imageSrc}`,
      label: `${name} Cabinet`,
      roles: ['BASE']
    });
  }
  // Add placeholder if no images
  if (images.length === 0) {
    images.push({
      url: 'https://www.aristocratgaming.com/_product-assets/games-assets/placeholder.png',
      label: name,
      roles: ['THUMBNAIL', 'BASE', 'SMALL']
    });
  }
  
  // Extract game type from URL
  const gameType = extractGameGroup(gameUrl);
  
  // Build keywords
  const keywords = ['aristocrat', 'slots', 'gaming', 'casino'];
  const nameWords = name.toLowerCase().replace(/[™®©]/g, '').split(/\s+/);
  nameWords.forEach(word => {
    if (word.length > 2 && !keywords.includes(word)) {
      keywords.push(word);
    }
  });
  
  // Build attributes
  const attributes = [
    {
      code: 'brand',
      type: 'STRING',
      values: ['Aristocrat Gaming']
    },
    {
      code: 'game_type',
      type: 'STRING',
      values: [gameType]
    }
  ];
  
  // Add each feature as a separate attribute entry with the same code
  features.forEach(feature => {
    attributes.push({
      code: 'game_feature',
      type: 'STRING',
      values: [feature.name]
    });
  });
  
  // Build full description with features
  let fullDescription = description;
  if (features.length > 0) {
    fullDescription += '\n\nGame Features:\n';
    features.forEach(f => {
      fullDescription += `\n• ${f.name}`;
      if (f.description) {
        fullDescription += `: ${f.description}`;
      }
    });
  }
  
  return {
    sku,
    source: {
      locale: 'en-US'
    },
    name,
    slug,
    status: 'ENABLED',
    description: fullDescription,
    shortDescription,
    visibleIn: ['CATALOG', 'SEARCH'],
    metaTags: {
      title: name,
      description: shortDescription || name,
      keywords
    },
    attributes,
    images,
    links: [],
    routes: [
      { path: 'slots' },
      { path: `slots/${slug}` }
    ]
  };
});

// Create prices array (using existing pricebooks)
const pricebooks = [
  { id: 'main', price: 0 },
  { id: 'west_coast_inc', price: 25000 },
  { id: 'vip_west_coast_inc', price: 22500 },
  { id: 'east_coast_inc', price: 27500 },
  { id: 'vip_east_coast_inc', price: 25000 },
  { id: 'global_visibility', price: 30000 }
];

const prices = [];
products.forEach(product => {
  pricebooks.forEach(pb => {
    prices.push({
      sku: product.sku,
      priceBookId: pb.id,
      regular: pb.price
    });
  });
});

// Create metadata array for slot game attributes
const metadata = [
  {
    code: 'sku',
    source: { locale: 'en-US' },
    label: 'SKU',
    dataType: 'TEXT',
    visibleIn: ['PRODUCT_DETAIL', 'PRODUCT_LISTING', 'SEARCH_RESULTS', 'PRODUCT_COMPARE'],
    filterable: false,
    sortable: false,
    searchable: true,
    searchWeight: 1,
    searchTypes: ['AUTOCOMPLETE']
  },
  {
    code: 'name',
    source: { locale: 'en-US' },
    label: 'Game Name',
    dataType: 'TEXT',
    visibleIn: ['PRODUCT_DETAIL', 'PRODUCT_LISTING', 'SEARCH_RESULTS', 'PRODUCT_COMPARE'],
    filterable: false,
    sortable: true,
    searchable: true,
    searchWeight: 2,
    searchTypes: ['AUTOCOMPLETE']
  },
  {
    code: 'description',
    source: { locale: 'en-US' },
    label: 'Description',
    dataType: 'TEXT',
    visibleIn: ['PRODUCT_DETAIL'],
    filterable: false,
    sortable: false,
    searchable: true,
    searchWeight: 1,
    searchTypes: ['AUTOCOMPLETE']
  },
  {
    code: 'shortDescription',
    source: { locale: 'en-US' },
    label: 'Short Description',
    dataType: 'TEXT',
    visibleIn: ['PRODUCT_DETAIL', 'PRODUCT_LISTING'],
    filterable: false,
    sortable: false,
    searchable: true,
    searchWeight: 1,
    searchTypes: ['AUTOCOMPLETE']
  },
  {
    code: 'brand',
    source: { locale: 'en-US' },
    label: 'Brand',
    dataType: 'TEXT',
    visibleIn: ['PRODUCT_DETAIL', 'PRODUCT_LISTING', 'SEARCH_RESULTS', 'PRODUCT_COMPARE'],
    filterable: true,
    sortable: false,
    searchable: true,
    searchWeight: 2,
    searchTypes: ['AUTOCOMPLETE']
  },
  {
    code: 'game_type',
    source: { locale: 'en-US' },
    label: 'Game Type',
    dataType: 'TEXT',
    visibleIn: ['PRODUCT_DETAIL', 'PRODUCT_LISTING', 'SEARCH_RESULTS', 'PRODUCT_COMPARE'],
    filterable: true,
    sortable: false,
    searchable: true,
    searchWeight: 2,
    searchTypes: ['AUTOCOMPLETE']
  },
  {
    code: 'game_feature',
    source: { locale: 'en-US' },
    label: 'Game Feature',
    dataType: 'TEXT',
    visibleIn: ['PRODUCT_DETAIL', 'PRODUCT_LISTING'],
    filterable: true,
    sortable: false,
    searchable: true,
    searchWeight: 2,
    searchTypes: ['AUTOCOMPLETE']
  },
  {
    code: 'price',
    source: { locale: 'en-US' },
    label: 'Price',
    dataType: 'DECIMAL',
    visibleIn: ['PRODUCT_DETAIL', 'PRODUCT_LISTING', 'SEARCH_RESULTS', 'PRODUCT_COMPARE'],
    filterable: true,
    sortable: true,
    searchable: false,
    searchWeight: 1,
    searchTypes: []
  }
];

// Write output files
fs.writeFileSync(
  path.join(__dirname, 'data', 'products.json'),
  JSON.stringify(products, null, 2)
);
console.log(`Created products.json with ${products.length} products`);

fs.writeFileSync(
  path.join(__dirname, 'data', 'prices.json'),
  JSON.stringify(prices, null, 2)
);
console.log(`Created prices.json with ${prices.length} price entries`);

fs.writeFileSync(
  path.join(__dirname, 'data', 'metadata.json'),
  JSON.stringify(metadata, null, 2)
);
console.log(`Created metadata.json with ${metadata.length} attribute definitions`);

console.log('\nConversion complete!');

