/**
 * Example: Competitor Selection Pipeline - BAD MATCH SCENARIO (Laptop Stand)
 * Demonstrates X-Ray SDK usage for debugging when wrong competitor is selected
 * 
 * This example intentionally produces a bad match: Phone Case -> Laptop Stand
 */

import { XRay, CommonStepTypes } from '@xray/sdk';

// Mock functions (in real implementation, these would call actual services)
async function generateKeywordsBad(title: string, category: string): Promise<string[]> {
  // INTENTIONALLY BAD: Generate wrong keywords
  await new Promise(resolve => setTimeout(resolve, 100));
  // Wrong keywords - generates "laptop" instead of "phone case"
  return ['laptop', 'stand', 'desk', 'office'];
}

async function searchProducts(keywords: string[]): Promise<any[]> {
  // Simulate product search API
  await new Promise(resolve => setTimeout(resolve, 200));
  return [
    { id: 'P001', title: 'Wireless Phone Charger', price: 19.99, rating: 4.5, reviews: 1200, category: 'Electronics' },
    { id: 'P002', title: 'Laptop Stand', price: 29.99, rating: 4.2, reviews: 800, category: 'Office Supplies' },
    { id: 'P003', title: 'Phone Case', price: 12.99, rating: 4.7, reviews: 5000, category: 'Accessories' },
    { id: 'P004', title: 'USB-C Charger', price: 15.99, rating: 4.3, reviews: 2000, category: 'Electronics' },
    { id: 'P005', title: 'Wireless Charging Pad', price: 24.99, rating: 4.6, reviews: 3500, category: 'Electronics' },
  ];
}

async function filterProductsBad(products: any[], filters: any): Promise<any[]> {
  // INTENTIONALLY BAD: 
  // 1. Filter logic doesn't check category match
  // 2. Price filter logic is implemented but thresholds are too lenient
  return products.filter(p => {
    if (filters.minPrice && p.price < filters.minPrice) return false;
    if (filters.maxPrice && p.price > filters.maxPrice) return false;
    if (filters.minRating && p.rating < filters.minRating) return false;
    if (filters.minReviews && p.reviews < filters.minReviews) return false;
    // BUG: Missing category check - allows Office Supplies products through
    // Should check: if (p.category !== expectedCategory) return false;
    return true;
  });
}

async function rankProductsBad(products: any[]): Promise<any[]> {
  // INTENTIONALLY BAD: Ranking heavily favors products matching wrong keywords
  await new Promise(resolve => setTimeout(resolve, 150));
  return products.sort((a, b) => {
    // BUG: Gives massive boost to products that match keywords "laptop" or "stand"
    let scoreA = a.rating * 0.6 + (a.reviews / 1000) * 0.4;
    let scoreB = b.rating * 0.6 + (b.reviews / 1000) * 0.4;
    
    // Artificially boost Laptop Stand score massively
    if (a.title.toLowerCase().includes('laptop') || a.title.toLowerCase().includes('stand')) {
      scoreA += 5.0; // Massive boost to ensure it wins
    }
    if (b.title.toLowerCase().includes('laptop') || b.title.toLowerCase().includes('stand')) {
      scoreB += 5.0; // Massive boost to ensure it wins
    }
    
    return scoreB - scoreA;
  });
}

/**
 * Main competitor selection pipeline - BAD MATCH VERSION (Laptop Stand)
 */
async function competitorSelectionPipelineBad(sellerProduct: any) {
  // Initialize X-Ray SDK
  const xray = new XRay({
    apiUrl: process.env.XRAY_API_URL || 'http://localhost:3000'
  });

  try {
    // Start a run
    const run = await xray.startRun({
      pipelineId: 'competitor-selection',
      pipelineVersion: '1.0.0',
      input: sellerProduct,
      metadata: {
        sellerId: sellerProduct.sellerId,
        productCategory: sellerProduct.category
      }
    });

    console.log(`[X-Ray] Started run: ${run.id}`);

    // Step 1: Generate keywords - INTENTIONALLY BAD
    const step1 = await xray.startStep({
      stepType: CommonStepTypes.KEYWORD_GENERATION,
      input: { title: sellerProduct.title, category: sellerProduct.category },
      reasoning: 'Extracting relevant search keywords from product title and category'
    });

    const keywords = await generateKeywordsBad(sellerProduct.title, sellerProduct.category);
    
    await xray.completeStep(step1.id, { keywords }, undefined, 
      `Generated ${keywords.length} keywords: ${keywords.join(', ')}`);

    // Step 2: Search products
    const step2 = await xray.startStep({
      stepType: CommonStepTypes.SEARCH,
      input: { keywords },
      reasoning: 'Searching product catalog for candidate competitors'
    });

    const searchResults = await searchProducts(keywords);
    
    // Record all candidates from search
    await xray.recordCandidates(
      step2.id,
      searchResults.map(p => ({
        candidateId: p.id,
        data: p,
        score: p.rating
      })),
      searchResults.map(p => p.id) // All accepted at this stage
    );

    await xray.completeStep(step2.id, { count: searchResults.length }, undefined,
      `Found ${searchResults.length} candidate products`);

    // Step 3: Apply filters - INTENTIONALLY BAD
    const step3 = await xray.startStep({
      stepType: CommonStepTypes.FILTERING,
      input: { candidates: searchResults },
      config: {
        minPrice: 15,
        maxPrice: 30,  // BUG: Too lenient - allows P002 (29.99) through
        minRating: 4.0,  // BUG: Too lenient - allows P002 (4.2) through
        minReviews: 500  // BUG: Too lenient - allows P002 (800) through
      },
      reasoning: 'Filtering candidates by price range, rating, and review count',
      captureAllCandidates: false
    });

    const filters = {
      minPrice: 15,
      maxPrice: 30,  // BUG: Increased to allow P002 (29.99) through
      minRating: 4.0,  // BUG: Lowered to allow P002 (4.2) through
      minReviews: 500  // BUG: Lowered to allow P002 (800) through
    };

    const filtered = await filterProductsBad(searchResults, filters);
    const filteredIds = new Set(filtered.map(p => p.id));
    const rejected = searchResults.filter(p => !filteredIds.has(p.id));

    // Record filter details
    await xray.recordFilter(step3.id, {
      filterType: 'price-range',
      config: { min: filters.minPrice, max: filters.maxPrice },
      candidatesAffected: searchResults.length,
      candidatesRejected: rejected.filter(p => p.price < filters.minPrice || p.price > filters.maxPrice).length
    });

    await xray.recordFilter(step3.id, {
      filterType: 'rating-threshold',
      config: { min: filters.minRating },
      candidatesAffected: searchResults.length,
      candidatesRejected: rejected.filter(p => p.rating < filters.minRating).length
    });

    await xray.recordFilter(step3.id, {
      filterType: 'review-count-threshold',
      config: { min: filters.minReviews },
      candidatesAffected: searchResults.length,
      candidatesRejected: rejected.filter(p => p.reviews < filters.minReviews).length
    });

    // BUG: Missing category filter - this is a critical problem!
    // Should have: await xray.recordFilter(step3.id, { 
    //   filterType: 'category-match',
    //   config: { requiredCategory: sellerProduct.category },
    //   candidatesAffected: searchResults.length,
    //   candidatesRejected: rejected.filter(p => p.category !== sellerProduct.category).length
    // })

    // Record candidates (accepted and rejected)
    await xray.recordCandidates(
      step3.id,
      searchResults.map(p => ({
        candidateId: p.id,
        data: p,
        score: p.rating
      })),
      filtered.map(p => p.id)
    );

    const filteringMessage = `Filtered ${searchResults.length} candidates down to ${filtered.length} (eliminated ${rejected.length})`;
    console.log(`[X-Ray] ${filteringMessage}`);
    await xray.completeStep(step3.id, { count: filtered.length }, undefined, filteringMessage);

    // Step 4: Rank products - INTENTIONALLY BAD
    const step4 = await xray.startStep({
      stepType: CommonStepTypes.RANKING,
      input: { candidates: filtered },
      reasoning: 'Ranking filtered candidates by relevance score'
    });

    const ranked = await rankProductsBad(filtered);

    // Record ranked candidates with scores (matching the ranking logic)
    await xray.recordCandidates(
      step4.id,
      ranked.map((p, idx) => {
        let score = p.rating * 0.6 + (p.reviews / 1000) * 0.4;
        // BUG: Artificially boost products matching wrong keywords (same as ranking logic)
        if (p.title.toLowerCase().includes('laptop') || p.title.toLowerCase().includes('stand')) {
          score += 5.0; // Massive boost to match ranking logic
        }
        return {
          candidateId: p.id,
          data: p,
          score: score,
          metadata: { rank: idx + 1 }
        };
      }),
      ranked.map(p => p.id)
    );

    await xray.completeStep(step4.id, { ranked: ranked.map(p => p.id) }, undefined,
      `Ranked ${ranked.length} products by relevance`);

    // Step 5: Select best competitor
    const step5 = await xray.startStep({
      stepType: CommonStepTypes.SELECTION,
      input: { topCandidates: ranked.slice(0, 3) },
      reasoning: 'Selecting the single best competitor product'
    });

    const bestCompetitor = ranked[0];

    await xray.completeStep(step5.id, { selected: bestCompetitor }, undefined,
      `Selected ${bestCompetitor.title} as best competitor`);

    // Complete the run
    await xray.completeRun({ competitor: bestCompetitor });

    console.log(`[X-Ray] Completed run: ${run.id}`);
    console.log(`[X-Ray] Selected competitor: ${bestCompetitor.title} (${bestCompetitor.id})`);

    return bestCompetitor;

  } catch (error: any) {
    console.error('[X-Ray] Pipeline error:', error);
    if (xray.getCurrentRun()) {
      await xray.completeRun(undefined, error.message);
    }
    throw error;
  }
}

// Run the example
if (require.main === module) {
  const sellerProduct = {
    sellerId: 'S123',
    title: 'Phone Case for iPhone',
    category: 'Accessories',
    price: 12.99
  };

  competitorSelectionPipelineBad(sellerProduct)
    .then(result => {
      console.log('\n✅ Pipeline completed successfully!');
      console.log('Result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Pipeline failed:', error);
      process.exit(1);
    });
}

