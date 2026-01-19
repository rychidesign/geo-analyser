import * as db from '../database/operations';
import { getDecryptedApiKey } from '../ipc/handlers';
import { callOpenAI } from '../llm/providers';

interface EvaluationMetrics {
  is_visible: boolean;
  sentiment_score: number; // -1 to 1
  citation_found: boolean;
  ranking_position: number | null; // 1-10 or null if not mentioned
  recommendation_strength: number; // 0-100
}

export async function evaluateScan(scanId: string): Promise<void> {
  console.log('Starting evaluation for scan:', scanId);

  // Get scan info
  const scan = await db.getScan(scanId);
  if (!scan) {
    throw new Error('Scan not found');
  }

  // Get project info for brand names
  const project = await db.getProject(scan.projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const brandVariations = JSON.parse(project.brandVariations || '[]');
  const domain = project.domain;

  // Get all scan results that need evaluation
  const results = await db.getScanResults(scanId);
  const unevaluatedResults = results.filter((r) => !r.metricsJson);

  console.log(`Evaluating ${unevaluatedResults.length} responses`);

  // Get OpenAI API key for judge
  const apiKey = await getDecryptedApiKey('openai');
  if (!apiKey) {
    throw new Error('OpenAI API key not configured for evaluation');
  }

  let totalScore = 0;
  let evaluatedCount = 0;

  // Evaluate each result
  for (const result of unevaluatedResults) {
    try {
      const metrics = await evaluateResponse(
        result.aiResponseRaw,
        brandVariations,
        domain,
        apiKey
      );

      // Calculate score for this response (0-100)
      const responseScore = calculateScore(metrics);
      totalScore += responseScore;
      evaluatedCount++;

      // Update the scan result with metrics
      await db.updateScanResult(result.id, {
        metricsJson: JSON.stringify(metrics),
      });

      console.log(
        `Evaluated ${result.provider}: ${metrics.is_visible ? '✓' : '✗'} visible, sentiment: ${metrics.sentiment_score}`
      );
    } catch (error) {
      console.error(`Failed to evaluate result ${result.id}:`, error);
    }
  }

  // Update overall scan score
  const overallScore = evaluatedCount > 0 ? Math.round(totalScore / evaluatedCount) : 0;
  await db.updateScan(scanId, {
    overallScore,
  });

  console.log(`Evaluation completed. Overall score: ${overallScore}/100`);
}

async function evaluateResponse(
  aiResponse: string,
  brandVariations: string[],
  domain: string,
  apiKey: string
): Promise<EvaluationMetrics> {
  const brandList = brandVariations.join(', ');

  const prompt = `You are a GEO (Generative Engine Optimization) analyst. Analyze this AI response and determine if and how a brand is mentioned.

BRAND NAMES TO LOOK FOR: ${brandList}
DOMAIN: ${domain}

AI RESPONSE TO ANALYZE:
"""
${aiResponse}
"""

Analyze and return ONLY a JSON object with these fields:
{
  "is_visible": boolean (true if any brand variation is mentioned),
  "sentiment_score": number (-1 to 1, where -1=negative, 0=neutral, 1=positive),
  "citation_found": boolean (true if domain URL is linked or mentioned),
  "ranking_position": number or null (1-10 if brand is in a ranked list, null otherwise),
  "recommendation_strength": number (0-100, how strongly is the brand recommended)
}

Rules:
- is_visible: true if ANY brand variation appears (case-insensitive)
- sentiment_score: evaluate the tone when mentioning the brand
- citation_found: true if ${domain} appears anywhere
- ranking_position: if mentioned in a list like "Top 5 tools", what position? (null if not in a list)
- recommendation_strength: 0=not mentioned, 50=neutral mention, 100=strong recommendation

Return ONLY valid JSON, no explanations.`;

  try {
    const response = await callOpenAI(apiKey, 'gpt-4o', prompt);
    
    // Parse JSON response
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const metrics: EvaluationMetrics = JSON.parse(jsonMatch[0]);
    
    // Validate and clamp values
    return {
      is_visible: Boolean(metrics.is_visible),
      sentiment_score: Math.max(-1, Math.min(1, metrics.sentiment_score || 0)),
      citation_found: Boolean(metrics.citation_found),
      ranking_position: metrics.ranking_position,
      recommendation_strength: Math.max(0, Math.min(100, metrics.recommendation_strength || 0)),
    };
  } catch (error) {
    console.error('Failed to parse evaluation response:', error);
    
    // Fallback: basic string matching
    const lowerResponse = aiResponse.toLowerCase();
    const isVisible = brandVariations.some((brand) =>
      lowerResponse.includes(brand.toLowerCase())
    );
    const citationFound = lowerResponse.includes(domain.toLowerCase());

    return {
      is_visible: isVisible,
      sentiment_score: 0,
      citation_found: citationFound,
      ranking_position: null,
      recommendation_strength: isVisible ? 50 : 0,
    };
  }
}

function calculateScore(metrics: EvaluationMetrics): number {
  let score = 0;

  // Visibility (40 points)
  if (metrics.is_visible) {
    score += 40;
  }

  // Sentiment (20 points)
  // Convert -1 to 1 range to 0 to 20
  score += (metrics.sentiment_score + 1) * 10;

  // Citation (20 points)
  if (metrics.citation_found) {
    score += 20;
  }

  // Ranking position (10 points)
  if (metrics.ranking_position) {
    // Better ranking = more points (1st place = 10 points, 10th place = 1 point)
    score += Math.max(0, 11 - metrics.ranking_position);
  }

  // Recommendation strength (10 points)
  score += metrics.recommendation_strength * 0.1;

  return Math.min(100, Math.max(0, score));
}
