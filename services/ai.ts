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
          "content": "string (For images: provide a detailed image generation prompt. For text: can be very long)",
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
5. Slide Count & Depth (CRITICAL): 
   - **User Specified**: If the user asks for a specific number (e.g., "10 slides", "20 slides"), YOU MUST generate exactly that many. Do not deviate.
   - **Auto-Detect**: If no number is specified, analyze the complexity and length of the prompt.
     - Short prompt: 3-5 slides.
     - Long prompt/Article: Generate as many slides as necessary to cover the content comprehensively (e.g., 10, 20, or 30 slides). Do not artificially summarize a long article into 5 slides. Break it down section by section.
6. Content Density (IMPORTANT):
   - **Text Amount**: You are ENABLED and ENCOURAGED to write very much text on a single slide if the user provides a lot of information or asks for detail. Do not summarize unnecessarily.
   - If a slide has a lot of text, use a smaller fontSize (e.g., 12, 14, or 16) and ensure the text box dimensions (width/height) are large enough to contain it.
   - Do not cut off information.
7. Visuals & Images:
   - **Image Generation**: You have a built-in image generator. ACTIVELY use elements with type="image".
   - When using type="image", the 'content' field MUST be a highly descriptive prompt for the image generator (e.g., "A futuristic robot shaking hands with a human, neon lighting, 4k render").
   - Suggest images to illustrate concepts, even if not explicitly asked.
8. Speed: Be concise in the JSON structure, but verbose in the content if needed.
`;

// --- Gemini Implementation ---
const getGeminiClient = (apiKey: string) => new GoogleGenAI({ apiKey });

async function generateGemini(prompt: string, apiKey: string, model: string) {
  if (!apiKey) throw new Error("API Key is missing for Gemini");
  
  const ai = getGeminiClient(apiKey);
  
  // Relaxed Schema to avoid 400 Bad Request on strict enum mismatch
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
            contents: { parts: [{ text: prompt }] },
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