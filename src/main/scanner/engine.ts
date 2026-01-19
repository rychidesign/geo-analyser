import * as db from '../database/operations';
import { getDecryptedApiKey } from '../ipc/handlers';
import { callOpenAI, callAnthropic, callGoogle, callPerplexity } from '../llm/providers';
import { evaluateScan } from './evaluator';

interface ScanProgress {
  total: number;
  completed: number;
  current: string;
}

type ProgressCallback = (progress: ScanProgress) => void;

export async function runScan(
  projectId: string,
  onProgress?: ProgressCallback
): Promise<string> {
  console.log('Starting scan for project:', projectId);

  // Create scan record
  const scan = await db.createScan({
    projectId,
    status: 'running',
    overallScore: null,
    completedAt: null,
  });

  const scanId = scan.id;

  try {
    // Get active queries
    const queries = await db.getActiveProjectQueries(projectId);
    
    if (queries.length === 0) {
      throw new Error('No active queries found for this project');
    }

    // Get active provider settings
    const activeProviders = await db.getActiveSettings();
    
    if (activeProviders.length === 0) {
      throw new Error('No active LLM providers configured');
    }

    const total = queries.length * activeProviders.length;
    let completed = 0;

    // For each query x provider combination
    for (const query of queries) {
      for (const providerSetting of activeProviders) {
        onProgress?.({
          total,
          completed,
          current: `${providerSetting.provider}: ${query.queryText.substring(0, 50)}...`,
        });

        try {
          // Get decrypted API key
          const apiKey = await getDecryptedApiKey(providerSetting.provider);
          
          if (!apiKey) {
            console.warn(`No API key for provider: ${providerSetting.provider}`);
            continue;
          }

          // Call the LLM
          let response;
          switch (providerSetting.provider) {
            case 'openai':
              response = await callOpenAI(apiKey, providerSetting.model, query.queryText);
              break;
            case 'anthropic':
              response = await callAnthropic(apiKey, providerSetting.model, query.queryText);
              break;
            case 'google':
              response = await callGoogle(apiKey, providerSetting.model, query.queryText);
              break;
            case 'perplexity':
              response = await callPerplexity(apiKey, providerSetting.model, query.queryText);
              break;
            default:
              console.warn(`Unknown provider: ${providerSetting.provider}`);
              continue;
          }

          // Save raw response
          await db.createScanResult({
            scanId,
            provider: providerSetting.provider,
            queryText: query.queryText,
            aiResponseRaw: response.text,
            metricsJson: null, // Will be filled by evaluation step
          });

          completed++;
        } catch (error) {
          console.error(`Error calling ${providerSetting.provider}:`, error);
          // Continue with next provider
        }
      }
    }

    // Run evaluation
    onProgress?.({
      total,
      completed: total,
      current: 'Evaluating responses...',
    });

    await evaluateScan(scanId);

    // Mark scan as completed
    await db.updateScan(scanId, {
      status: 'completed',
      completedAt: new Date(Date.now()),
    });

    onProgress?.({
      total,
      completed: total,
      current: 'Scan completed',
    });

    return scanId;
  } catch (error) {
    // Mark scan as failed
    await db.updateScan(scanId, {
      status: 'failed',
    });
    
    throw error;
  }
}

// AI-assisted query generation
export async function generateQueries(
  brandVariations: string[],
  domain: string,
  keywords: string[],
  language: string = 'en',
  includeBrand: boolean = false
): Promise<Array<{ queryText: string; type: string }>> {
  // Get OpenAI API key
  const apiKey = await getDecryptedApiKey('openai');
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const languageInstructions: Record<string, string> = {
    cs: 'Generate queries in CZECH language (česky).',
    sk: 'Generate queries in SLOVAK language (slovensky).',
    en: 'Generate queries in ENGLISH language.',
    de: 'Generate queries in GERMAN language (deutsch).',
    other: 'Generate queries in the most appropriate language for this market.',
  };

  const primaryBrand = brandVariations[0] || 'the brand';
  const allBrands = brandVariations.join(', ');

  // Different prompts based on whether to include brand name
  const prompt = includeBrand
    ? // WITH BRAND NAME → For sentiment analysis
      `You are a GEO (Generative Engine Optimization) expert. Generate 10 diverse test queries that users might ask AI assistants SPECIFICALLY about the brand.

Context:
- Brand Variations: ${allBrands}
- Domain: ${domain}
- Keywords: ${keywords.join(', ')}
- Query Language: ${languageInstructions[language] || languageInstructions.en}

IMPORTANT: All queries MUST mention ONE of these brand variations: ${allBrands}
Use different brand variations across queries (for sentiment analysis).

Generate queries with DIFFERENT intents:
- INFORMATIONAL: "What is ${primaryBrand}?", "How does ${brandVariations[0] || 'it'} work?", "Tell me about ${brandVariations[1] || primaryBrand}"
- TRANSACTIONAL: "Where to buy from ${primaryBrand}?", "Best price for ${brandVariations[0] || primaryBrand}", "${brandVariations[1] || primaryBrand} discount code"
- COMPARISON: "${primaryBrand} vs competitors", "Is ${brandVariations[0] || primaryBrand} better than...", "Alternative to ${brandVariations[1] || primaryBrand}"

CRITICAL FORMAT RULE:
- The TYPE labels MUST be in ENGLISH: INFORMATIONAL, TRANSACTIONAL, or COMPARISON
- The query text MUST be in the specified language
- Format: ENGLISH_TYPE: query in target language

Example for Czech:
INFORMATIONAL: Co je ${primaryBrand}?
TRANSACTIONAL: Kde koupit ${primaryBrand}?
COMPARISON: ${primaryBrand} vs konkurence

${languageInstructions[language] || languageInstructions.en}

Return EXACTLY in this format, one per line.`
    : // WITHOUT BRAND NAME → For brand awareness/acquisition
      `You are a GEO (Generative Engine Optimization) expert. Generate 10 diverse test queries that users might ask AI assistants about topics related to ${domain}.

Context:
- Domain: ${domain}
- Keywords: ${keywords.join(', ')}
- Target brands (DO NOT MENTION): ${allBrands}
- Query Language: ${languageInstructions[language] || languageInstructions.en}

IMPORTANT: Do NOT mention ANY of these brands: ${allBrands}
Testing if AI will mention them organically (brand awareness).

Generate GENERIC queries where these brands COULD be mentioned as solutions:
- INFORMATIONAL: "What are the best...", "How to choose...", "What should I know about..."
- TRANSACTIONAL: "Where to buy...", "Best store for...", "Recommended sellers..."
- COMPARISON: "X vs Y comparison", "Best alternatives for...", "Top options for..."

Focus on topics: ${keywords.join(', ')}

CRITICAL FORMAT RULE:
- The TYPE labels MUST be in ENGLISH: INFORMATIONAL, TRANSACTIONAL, or COMPARISON
- The query text MUST be in the specified language
- Format: ENGLISH_TYPE: query in target language

Example for Czech:
INFORMATIONAL: Jaké jsou nejlepší horská kola?
TRANSACTIONAL: Kde koupit enduro kolo?
COMPARISON: Canyon vs Trek

${languageInstructions[language] || languageInstructions.en}

Return EXACTLY in this format, one per line.`;

  try {
    const response = await callOpenAI(apiKey, 'gpt-4o', prompt);
    
    console.log('AI Response:', response.text); // Debug logging
    
    // Parse response into array of queries with types
    const queries = response.text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.includes(':'))
      .map(line => {
        // Remove leading numbers like "1. " or "1) "
        const cleanLine = line.replace(/^\d+[\.\)]\s*/, '');
        
        // Parse "TYPE: query text" format (case-insensitive, flexible whitespace)
        const match = cleanLine.match(/^\s*(INFORMATIONAL|TRANSACTIONAL|COMPARISON)\s*:\s*(.+)$/i);
        if (match) {
          const type = match[1].toLowerCase();
          const queryText = match[2].trim();
          console.log(`Parsed: ${type} -> ${queryText}`); // Debug logging
          return { type, queryText };
        }
        
        // Fallback if format is wrong
        console.log(`Failed to parse line: "${line}"`); // Debug logging
        return {
          type: 'informational',
          queryText: cleanLine.replace(/^[^:]+:\s*/, '')
        };
      })
      .slice(0, 10); // Limit to 10
    
    console.log('Generated queries:', queries); // Debug logging
    return queries;
  } catch (error) {
    console.error('Failed to generate queries:', error);
    throw new Error('Failed to generate queries. Please check your OpenAI API key.');
  }
}
