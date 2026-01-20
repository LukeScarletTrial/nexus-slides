import { GoogleGenAI, Type } from "@google/genai";
import { SlideElement } from "../types";

export type AIProvider = 'gemini' | 'openai' | 'grok' | 'deepseek';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

const SYSTEM_PROMPT = `You are Nexus Assistant AI, a high-speed presentation designer.
ACTION: Analyze user request -> Generate JSON response immediately.

Response Schema (Strict JSON):
{
  "reply": "string (Short confirmation)",
  "slides": [
    {
      "name": "string",
      "backgroundColor": "string (Hex)",
      "backgroundImagePrompt": "string (Optional: Use for immersive/photo backgrounds. 16:9 aspect ratio)",
      "transition": "fade" | "slide" | "cover" | "zoom" | "push" | "none",
      "elements": [
        {
          "type": "text" | "image" | "shape" | "button",
          "content": "string (For images: provide a detailed image generation prompt)",
          "link": "string (Optional)",
          "x": number,
          "y": number,
          "width": number,
          "height": number,
          "fontSize": number,
          "fontFamily": "string",
          "textColor": "string (Hex)",
          "bgColor": "string (Hex)",
          "shapeType": "string (rectangle, circle, triangle, star, rounded, diamond, arrow)"
        }
      ]
    }
  ]
}

Design Rules:
1. Canvas: 960x540. Center: 480, 270.
2. Fonts: Inter, Roboto, Playfair Display.
3. Layout: Clean, professional, high contrast.
4. Backgrounds: Use 'backgroundImagePrompt' for title slides, cover pages, or when the user requests specific imagery (e.g., "city skyline", "nature", "space"). For text-heavy slides, use solid 'backgroundColor'.
5. Slide Count & Depth: 
   - **User Specified**: If the user asks for a specific number, generate exactly that many.
   - **Auto-Detect**: If no number is specified, analyze complexity. Short: 3-5 slides. Long: 10+ slides.
6. Content Density:
   - **Text Amount**: Write detailed text if needed. Use smaller fontSize (12-16) for dense text.
7. Visuals & Images (CRITICAL):
   - **MANDATORY**: You MUST include 'image' elements frequently. At least 1 image per 2 slides, or more for visual topics.
   - When using type="image", the 'content' MUST be a prompt (e.g., "High-tech server room, blue neon lights, 4k photorealistic").
   - DO NOT use URLs. Only Prompts.
8. Speed: Be concise in the JSON structure.
`;

// --- Gemini Implementation ---
const getGeminiClient = (apiKey: string) => new GoogleGenAI({ apiKey });

async function generateGemini(prompt: string, apiKey: string, model: string) {
  if (!apiKey) throw new Error("API Key is missing for Gemini");
  
  const ai = getGeminiClient(apiKey);
  
  const schema = {
     type: Type.OBJECT,
     properties: {
         reply: { type: Type.STRING },
         slides: {
             type: Type.ARRAY,
             items: {
                 type: Type.OBJECT,
                 properties: {
                     name: { type: Type.STRING },
                     backgroundColor: { type: Type.STRING },
                     backgroundImagePrompt: { type: Type.STRING },
                     transition: { type: Type.STRING },
                     elements: {
                         type: Type.ARRAY,
                         items: {
                             type: Type.OBJECT,
                             properties: {
                                 type: { type: Type.STRING },
                                 content: { type: Type.STRING },
                                 link: { type: Type.STRING },
                                 x: { type: Type.NUMBER },
                                 y: { type: Type.NUMBER },
                                 width: { type: Type.NUMBER },
                                 height: { type: Type.NUMBER },
                                 fontSize: { type: Type.NUMBER },
                                 fontFamily: { type: Type.STRING },
                                 textColor: { type: Type.STRING },
                                 bgColor: { type: Type.STRING },
                                 shapeType: { type: Type.STRING }
                             },
                             required: ["type", "content", "x", "y", "width", "height"]
                         }
                     }
                 },
                 required: ["name", "backgroundColor", "elements"]
             }
         }
     },
     required: ["reply"]
  };

  try {
      const response = await ai.models.generateContent({
        model: model || 'gemini-3-flash-preview',
        contents: [
            {
                role: 'user',
                parts: [{ text: prompt }]
            }
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: schema,
          maxOutputTokens: 8192
        }
      });

      if (!response.text) {
          if (response.candidates?.[0]?.finishReason) {
              throw new Error(`Generation stopped: ${response.candidates[0].finishReason}`);
          }
          throw new Error("Empty response from AI");
      }
      
      return JSON.parse(response.text);
  } catch (e: any) {
      console.error("Gemini Error:", e);
      if (e.message.includes("JSON")) {
          throw new Error("The content was too long and the response was cut off. Try asking for fewer slides or breaking your request into parts.");
      }
      throw new Error(e.message || "Failed to generate content");
  }
}

async function generateGeminiImage(prompt: string, apiKey: string): Promise<string | null> {
    if (!apiKey) return null;
    try {
        const ai = getGeminiClient(apiKey);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: prompt, 
            config: { imageConfig: { aspectRatio: "16:9" } }, 
        });
        
        if (!response.candidates?.[0]?.content?.parts && response.candidates?.[0]?.finishReason) {
             console.warn(`Image generation blocked: ${response.candidates[0].finishReason}`);
             return null;
        }

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        }
        return null;
    } catch (e) {
        console.error("Gemini Image Gen Error", e);
        return null;
    }
}

// --- Web Search Image Fallback ---
export async function findImageOnWeb(query: string, apiKey: string): Promise<string | null> {
    if (!apiKey) return null;
    try {
        const ai = getGeminiClient(apiKey);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Find a direct, publicly accessible image URL for: "${query}". 
            Rules:
            1. Return ONLY the raw URL string.
            2. Do not include markdown or explanations.
            3. The URL should ideally end in .jpg, .png, or .webp.
            4. Choose high-quality, relevant images from sources like Wikimedia, Unsplash, or public CDNs.`,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });

        // 1. Try to extract from grounding metadata (most reliable for source links)
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
            for (const chunk of chunks) {
                if (chunk.web?.uri) {
                    // Check if URI looks like an image or we can use it
                    const uri = chunk.web.uri;
                    if (uri.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                        return uri;
                    }
                }
            }
        }

        // 2. Fallback to extracting from text
        const text = response.text?.trim();
        if (text && text.startsWith('http')) {
            // Basic cleanup if it included markdown
            return text.replace(/`/g, '').split(/\s+/)[0]; 
        }
        
        return null;
    } catch (e) {
        console.error("Web Image Search Error", e);
        return null;
    }
}

// --- OpenAI / Grok / DeepSeek Implementation (OpenAI Compatible) ---

async function generateOpenAICompatible(
  prompt: string, 
  apiKey: string, 
  baseUrl: string, 
  model: string
) {
  try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT + "\n\nIMPORTANT: Return ONLY valid, minified JSON. Do not include markdown formatting like ```json." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          max_tokens: 8192
        })
      });

      if (!response.ok) {
         const err = await response.text();
         throw new Error(`API Error (${baseUrl}): ${err}`);
      }

      const data = await response.json();
      let content = data.choices[0].message.content;
      
      content = content.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      
      return JSON.parse(content);
  } catch (error: any) {
      console.error("OpenAI Compatible Gen Error:", error);
      throw error;
  }
}

async function generateOpenAIImage(prompt: string, apiKey: string): Promise<string | null> {
    try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "dall-e-3",
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                response_format: "b64_json"
            })
        });
        const data = await response.json();
        if (data.data && data.data[0]) {
            return `data:image/png;base64,${data.data[0].b64_json}`;
        }
        return null;
    } catch (e) {
        console.error("OpenAI Image Gen Error", e);
        return null;
    }
}


// --- Main Exported Functions ---

export async function generateSlideContent(topic: string, config: AIConfig): Promise<any> {
    const key = config.apiKey || process.env.API_KEY || '';
    if (!key && config.provider !== 'gemini') {
        throw new Error(`API Key required for ${config.provider}`);
    }

    switch (config.provider) {
        case 'gemini':
            return generateGemini(topic, key, config.model || 'gemini-3-flash-preview');
        case 'openai':
            return generateOpenAICompatible(topic, config.apiKey, 'https://api.openai.com/v1', config.model || 'gpt-4o');
        case 'grok':
            return generateOpenAICompatible(topic, config.apiKey, 'https://api.x.ai/v1', config.model || 'grok-beta');
        case 'deepseek':
            return generateOpenAICompatible(topic, config.apiKey, 'https://api.deepseek.com', config.model || 'deepseek-chat');
        default:
            throw new Error("Unknown provider");
    }
}

export async function generateImage(prompt: string, config: AIConfig): Promise<string | null> {
    const key = config.apiKey || process.env.API_KEY || '';
    switch (config.provider) {
        case 'gemini':
            return generateGeminiImage(prompt, key);
        case 'openai':
            return generateOpenAIImage(prompt, config.apiKey);
        case 'grok':
        case 'deepseek':
            console.warn("Image generation not supported for this provider yet.");
            return null; 
        default:
            return null;
    }
}