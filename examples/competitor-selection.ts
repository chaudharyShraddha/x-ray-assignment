/**
 * Example: Competitor Selection Pipeline
 * Demonstrates X-Ray SDK usage for debugging multi-step processes
 */

import { XRay, CommonStepTypes } from '@xray/sdk';

// Mock functions (in real implementation, these would call actual services)
async function generateKeywords(title: string, category: string): Promise<string[]> {
  // Simulate LLM keyword generation
  await new Promise(resolve => setTimeout(resolve, 100));
  return ['wireless charger', 'phone charger', 'mobile charger'];
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

async function filterProducts(products: any[], filters: any): Promise<any[]> {
  return products.filter(p => {
    if (filters.minPrice && p.price < filters.minPrice) return false;
    if (filters.maxPrice && p.price > filters.maxPrice) return false;
    if (filters.minRating && p.rating < filters.minRating) return false;
    if (filters.minReviews && p.reviews < filters.minReviews) return false;
    return true;
  });
}

async function rankProducts(products: any[]): Promise<any[]> {
  // Simulate LLM-based ranking
  await new Promise(resolve => setTimeout(resolve, 150));
  return products.sort((a, b) => {
    // Simple relevance scoring
    const scoreA = a.rating * 0.6 + (a.reviews / 1000) * 0.4;
    const scoreB = b.rating * 0.6 + (b.reviews / 1000) * 0.4;
    return scoreB - scoreA;
  });
}

/**
 * Main competitor selection pipeline
 */
async function competitorSelectionPipeline(sellerProduct: any) {
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

    // Step 1: Generate keywords
    const step1 = await xray.startStep({
      stepType: CommonStepTypes.KEYWORD_GENERATION,
      input: { title: sellerProduct.title, category: sellerProduct.category },
      reasoning: 'Extracting relevant search keywords from product title and category'
    });

    const keywords = await generateKeywords(sellerProduct.title, sellerProduct.category);
    
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

    // Step 3: Apply filters
    const step3 = await xray.startStep({
      stepType: CommonStepTypes.FILTERING,
      input: { candidates: searchResults },
      config: {
        minPrice: 15,
        maxPrice: 25,
        minRating: 4.3,
        minReviews: 1000
      },
      reasoning: 'Filtering candidates by price range, rating, and review count',
      captureAllCandidates: false // Use hybrid approach for large sets
    });

    const filters = {
      minPrice: 15,
      maxPrice: 25,
      minRating: 4.3,
      minReviews: 1000
    };

    const filtered = await filterProducts(searchResults, filters);
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

    // Record candidates (accepted and rejected)
    await xray.recordCandidates(
      step3.id,
      searchResults.map(p => ({
        candidateId: p.id,
        data: p,
        score: p.rating
      })),
      filtered.map(p => p.id) // Only filtered products are accepted
    );

    const filteringMessage = `Filtered ${searchResults.length} candidates down to ${filtered.length} (eliminated ${rejected.length})`;
    console.log(`[X-Ray] ${filteringMessage}`);
    await xray.completeStep(step3.id, { count: filtered.length }, undefined, filteringMessage);

    // Step 4: Rank products
    const step4 = await xray.startStep({
      stepType: CommonStepTypes.RANKING,
      input: { candidates: filtered },
      reasoning: 'Ranking filtered candidates by relevance score'
    });

    const ranked = await rankProducts(filtered);

    // Record ranked candidates with scores
    await xray.recordCandidates(
      step4.id,
      ranked.map((p, idx) => ({
        candidateId: p.id,
        data: p,
        score: p.rating * 0.6 + (p.reviews / 1000) * 0.4,
        metadata: { rank: idx + 1 }
      })),
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
    title: 'Wireless Phone Charger Stand',
    category: 'Electronics',
    price: 22.99
  };

  competitorSelectionPipeline(sellerProduct)
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

