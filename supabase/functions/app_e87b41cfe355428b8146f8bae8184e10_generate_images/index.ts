import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Request received:`, req.method, req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    console.log(`[${requestId}] Parsing request body...`);
    const { products, type, customSettings } = await req.json();
    
    console.log(`[${requestId}] Processing ${products.length} products for type: ${type}`);
    console.log(`[${requestId}] Custom settings:`, customSettings);
    
    const generatedImages = [];

    switch (type) {
      case 'single':
        for (const product of products) {
          const filename = `${product.price}-${product.spu}.png`;
          const imageUrl = await generateSingleImage(product, customSettings, requestId);
          generatedImages.push({ filename, url: imageUrl, type: 'single' });
        }
        break;
        
      case 'batch_grid4':
        const grid4Count = Math.floor(products.length / 4);
        for (let i = 0; i < grid4Count; i++) {
          const selectedProducts = products.slice(i * 4, (i + 1) * 4);
          const filename = `4宫格_${i + 1}.png`;
          const imageUrl = await generateGridImage(selectedProducts, 2, 2, customSettings, requestId);
          generatedImages.push({ filename, url: imageUrl, type: 'grid4' });
        }
        break;
        
      case 'batch_grid6':
        const grid6Count = Math.floor(products.length / 6);
        for (let i = 0; i < grid6Count; i++) {
          const selectedProducts = products.slice(i * 6, (i + 1) * 6);
          const filename = `6宫格_${i + 1}.png`;
          const imageUrl = await generateGridImage(selectedProducts, 3, 2, customSettings, requestId);
          generatedImages.push({ filename, url: imageUrl, type: 'grid6' });
        }
        break;
        
      case 'batch_grid9':
        const grid9Count = Math.floor(products.length / 9);
        for (let i = 0; i < grid9Count; i++) {
          const selectedProducts = products.slice(i * 9, (i + 1) * 9);
          const filename = `9宫格_${i + 1}.png`;
          const imageUrl = await generateGridImage(selectedProducts, 3, 3, customSettings, requestId);
          generatedImages.push({ filename, url: imageUrl, type: 'grid9' });
        }
        break;
        
      case 'batch_grid16':
        const grid16Count = Math.floor(products.length / 16);
        for (let i = 0; i < grid16Count; i++) {
          const selectedProducts = products.slice(i * 16, (i + 1) * 16);
          const filename = `16宫格_${i + 1}.png`;
          const imageUrl = await generateGridImage(selectedProducts, 4, 4, customSettings, requestId);
          generatedImages.push({ filename, url: imageUrl, type: 'grid16' });
        }
        // Handle remaining products if any
        const remaining16 = products.length % 16;
        if (remaining16 >= 4) {
          const remainingProducts = products.slice(grid16Count * 16);
          if (remaining16 >= 9) {
            const filename = `16宫格剩余_9宫格.png`;
            const imageUrl = await generateGridImage(remainingProducts.slice(0, 9), 3, 3, customSettings, requestId);
            generatedImages.push({ filename, url: imageUrl, type: 'grid9' });
          } else if (remaining16 >= 6) {
            const filename = `16宫格剩余_6宫格.png`;
            const imageUrl = await generateGridImage(remainingProducts.slice(0, 6), 3, 2, customSettings, requestId);
            generatedImages.push({ filename, url: imageUrl, type: 'grid6' });
          } else {
            const filename = `16宫格剩余_4宫格.png`;
            const imageUrl = await generateGridImage(remainingProducts.slice(0, 4), 2, 2, customSettings, requestId);
            generatedImages.push({ filename, url: imageUrl, type: 'grid4' });
          }
        }
        break;
        
      case 'carousel':
        for (const product of products) {
          if (product.links.length >= 1) {
            const filename1 = `${product.price}-${product.spu}-01.png`;
            const imageUrl1 = await generateSingleImage(product, customSettings, requestId, 0);
            generatedImages.push({ filename: filename1, url: imageUrl1, type: 'carousel' });
          }
          if (product.links.length >= 2) {
            const filename2 = `${product.price}-${product.spu}-02.png`;
            const imageUrl2 = await generateSingleImage(product, customSettings, requestId, 1);
            generatedImages.push({ filename: filename2, url: imageUrl2, type: 'carousel' });
          }
        }
        break;
    }

    console.log(`[${requestId}] Generated ${generatedImages.length} images`);

    return new Response(JSON.stringify({
      success: true,
      images: generatedImages
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});

// Generate single product image - clean with only price, no SPU text
function generateSingleImage(product, customSettings, requestId, linkIndex = 0) {
  console.log(`[${requestId}] Generating single image for ${product.spu}`);
  
  const priceSettings = customSettings?.priceLabel || {
    color: '#FF4500',
    fontSize: 36,
    fontFamily: 'Arial, sans-serif',
    position: 'bottom-center'
  };
  
  // Calculate price position
  let priceX = 400, priceY = 750, textAnchor = 'middle';
  switch (priceSettings.position) {
    case 'top-left':
      priceX = 50; priceY = 80; textAnchor = 'start';
      break;
    case 'top-right':
      priceX = 750; priceY = 80; textAnchor = 'end';
      break;
    case 'bottom-left':
      priceX = 50; priceY = 750; textAnchor = 'start';
      break;
    case 'bottom-right':
      priceX = 750; priceY = 750; textAnchor = 'end';
      break;
    case 'bottom-center':
    default:
      priceX = 400; priceY = 750; textAnchor = 'middle';
      break;
  }
  
  // Logo positioning
  let logoElement = '';
  if (customSettings?.logo) {
    let logoX = 50, logoY = 50;
    switch (customSettings.logoPosition) {
      case 'top-left':
        logoX = 50; logoY = 50;
        break;
      case 'top-right':
        logoX = 700; logoY = 50;
        break;
      case 'bottom-left':
        logoX = 50; logoY = 700;
        break;
      case 'bottom-right':
        logoX = 700; logoY = 700;
        break;
    }
    logoElement = `<rect x="${logoX}" y="${logoY}" width="80" height="80" fill="#E0E0E0" stroke="#CCCCCC" stroke-width="2" rx="8"/>
                  <text x="${logoX + 40}" y="${logoY + 45}" font-family="Arial" font-size="14" fill="#666666" text-anchor="middle" font-weight="bold">LOGO</text>`;
  }

  // Load actual product image if available
  let productImageElement = '';
  if (product.links && product.links[linkIndex]) {
    // For demo purposes, show a placeholder that indicates the image would be loaded
    productImageElement = `
      <rect x="100" y="100" width="600" height="500" fill="#F8F8F8" stroke="#E0E0E0" stroke-width="2" rx="12"/>
      <text x="400" y="340" font-family="Arial" font-size="18" fill="#999999" text-anchor="middle">商品图片</text>
      <text x="400" y="370" font-family="Arial" font-size="14" fill="#BBBBBB" text-anchor="middle">${product.links[linkIndex].substring(0, 50)}...</text>
    `;
  } else {
    productImageElement = `
      <rect x="100" y="100" width="600" height="500" fill="#F8F8F8" stroke="#E0E0E0" stroke-width="2" rx="12"/>
      <text x="400" y="350" font-family="Arial" font-size="18" fill="#999999" text-anchor="middle">暂无商品图片</text>
    `;
  }
  
  const svg = `
    <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="800" fill="#FFFFFF"/>
      ${productImageElement}
      ${logoElement}
      <text x="${priceX}" y="${priceY}" font-family="${priceSettings.fontFamily}" font-size="${priceSettings.fontSize}" fill="${priceSettings.color}" text-anchor="${textAnchor}" font-weight="bold">MX$${product.price}</text>
    </svg>
  `;
  
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
}

function generateGridImage(products, cols, rows, customSettings, requestId) {
  console.log(`[${requestId}] Generating ${cols}x${rows} grid image`);
  
  const cellWidth = 800 / cols;
  const cellHeight = 800 / rows;
  const padding = 5;
  
  let gridItems = '';
  for (let i = 0; i < Math.min(products.length, cols * rows); i++) {
    const product = products[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    
    const x = col * cellWidth + padding;
    const y = row * cellHeight + padding;
    const width = cellWidth - padding * 2;
    const height = cellHeight - padding * 2;
    
    const fontSize = Math.max(12, Math.min(20, width / 10));
    const priceColor = customSettings?.priceLabel?.color || '#FF4500';
    
    // Product image area - larger, no SPU text
    const imageHeight = height - 40; // Reserve space for price only
    
    gridItems += `
      <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="1" rx="8"/>
      <rect x="${x + 5}" y="${y + 5}" width="${width - 10}" height="${imageHeight - 10}" fill="#F8F8F8" stroke="#E0E0E0" stroke-width="1" rx="6"/>
      <text x="${x + width/2}" y="${y + imageHeight/2}" font-family="Arial" font-size="10" fill="#CCCCCC" text-anchor="middle">商品图片</text>
      <text x="${x + width/2}" y="${y + height - 15}" font-family="Arial" font-size="${fontSize}" fill="${priceColor}" text-anchor="middle" font-weight="bold">MX$${product.price}</text>
    `;
  }
  
  // Logo positioning for grid
  let logoElement = '';
  if (customSettings?.logo) {
    let logoX = 20, logoY = 20;
    switch (customSettings.logoPosition) {
      case 'top-left':
        logoX = 20; logoY = 20;
        break;
      case 'top-right':
        logoX = 720; logoY = 20;
        break;
      case 'bottom-left':
        logoX = 20; logoY = 720;
        break;
      case 'bottom-right':
        logoX = 720; logoY = 720;
        break;
    }
    logoElement = `<rect x="${logoX}" y="${logoY}" width="60" height="60" fill="#E0E0E0" stroke="#CCCCCC" stroke-width="2" rx="6"/>
                  <text x="${logoX + 30}" y="${logoY + 35}" font-family="Arial" font-size="12" fill="#666666" text-anchor="middle" font-weight="bold">LOGO</text>`;
  }
  
  const svg = `
    <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="800" fill="#FFFFFF"/>
      ${gridItems}
      ${logoElement}
    </svg>
  `;
  
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
}