// LLM Provider API clients

interface LLMResponse {
  text: string;
  model: string;
  provider: string;
}

export async function callOpenAI(
  apiKey: string,
  model: string,
  prompt: string
): Promise<LLMResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      // temperature removed - GPT-5 models use default value (1)
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
  }

  const data: any = await response.json();
  
  return {
    text: data.choices[0]?.message?.content || '',
    model,
    provider: 'openai',
  };
}

export async function callAnthropic(
  apiKey: string,
  model: string,
  prompt: string
): Promise<LLMResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorBody}`);
  }

  const data: any = await response.json();
  
  return {
    text: data.content[0]?.text || '',
    model: data.model || model,
    provider: 'anthropic',
  };
}

export async function callGoogle(
  apiKey: string,
  model: string,
  prompt: string
): Promise<LLMResponse> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Google API error: ${response.statusText}`);
  }

  const data: any = await response.json();
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    model,
    provider: 'google',
  };
}

export async function callPerplexity(
  apiKey: string,
  model: string,
  prompt: string
): Promise<LLMResponse> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.statusText}`);
  }

  const data: any = await response.json();
  return {
    text: data.choices[0]?.message?.content || '',
    model,
    provider: 'perplexity',
  };
}
