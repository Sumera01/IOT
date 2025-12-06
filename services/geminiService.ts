import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { AuditResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const boundingBoxSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ymin: { type: Type.NUMBER, description: "Top coordinate (0-1000)" },
    xmin: { type: Type.NUMBER, description: "Left coordinate (0-1000)" },
    ymax: { type: Type.NUMBER, description: "Bottom coordinate (0-1000)" },
    xmax: { type: Type.NUMBER, description: "Right coordinate (0-1000)" },
  },
  required: ["ymin", "xmin", "ymax", "xmax"],
};

const threatSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    title: { type: Type.STRING },
    severity: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
    description: { type: Type.STRING },
    boundingBox: { ...boundingBoxSchema, nullable: true, description: "Bounding box of the device/code area involved. Use 0-1000 scale." },
    fixCode: { type: Type.STRING, description: "Python code snippet OR step-by-step pseudocode if no code is applicable." },
    fixExplanation: { type: Type.STRING, description: "Brief explanation of what the fix does." },
    riskProbability: { type: Type.NUMBER, description: "Estimated probability (0-100) of this threat being exploited in its current state." },
    mitigatedRiskProbability: { type: Type.NUMBER, description: "Estimated probability (0-100) of exploit AFTER applying the fix." },
    fixCategory: { 
        type: Type.STRING, 
        enum: ['Encryption', 'Network', 'Authentication', 'Device', 'General'],
        description: "The category of security fix required." 
    },
  },
  required: ["id", "title", "severity", "description", "fixCode", "fixExplanation", "riskProbability", "mitigatedRiskProbability", "fixCategory"],
};

const auditResultSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    overallRiskScore: { type: Type.NUMBER, description: "0-100 risk score, where 100 is critical." },
    threats: { type: Type.ARRAY, items: threatSchema },
  },
  required: ["overallRiskScore", "threats"],
};

export async function analyzeIoTSetup(imageUrl?: string, configText?: string, audioData?: string): Promise<AuditResult> {
  const parts: any[] = [];

  if (imageUrl) {
    const base64Data = imageUrl.split(",")[1];
    const mimeType = imageUrl.split(";")[0].split(":")[1];
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    });
  }

  if (audioData) {
    let mimeType = "audio/webm"; 
    let data = audioData;
    if (audioData.includes(",")) {
        mimeType = audioData.split(";")[0].split(":")[1];
        data = audioData.split(",")[1];
    }
    parts.push({
      inlineData: {
        data: data,
        mimeType: mimeType,
      }
    });
    parts.push({ text: "The user has provided an audio description. Transcribe and use it for context." });
  }

  if (configText) {
    parts.push({
      text: `Configuration Snippet:\n${configText}`,
    });
  }

  const prompt = `
    You are IoT Sentinel, an expert cyber-security auditor.
    Analyze the provided inputs (Image, Config, Audio) for security vulnerabilities.
    
    Tasks:
    1. Identify threats like exposed ports, weak encryption, physical risks, or bad config.
    2. Categorize each threat into: 'Encryption', 'Network', 'Authentication', 'Device', or 'General'.
    3. Assign a 'riskProbability' (0-100%) for how likely an attack is now.
    4. Simulate a fix and assign a 'mitigatedRiskProbability' (0-100%) assuming the fix is applied.
    5. Provide specific Python fix code (e.g. paho-mqtt TLS setup, ufw rules). If Python is not applicable (e.g. physical security), provide clear numbered steps in the code block.

    Output pure JSON matching the schema.
  `;

  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: auditResultSchema,
        systemInstruction: "You are a helpful, precise security expert. Be realistic with risk probabilities.",
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response text from Gemini");
    
    return JSON.parse(text) as AuditResult;
  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
}

export async function generateAudioGuide(textToSpeak: string): Promise<AudioBuffer> {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: textToSpeak }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Fenrir' },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data generated");

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        audioContext,
        24000,
        1
    );
    return audioBuffer;
}

// Helpers for Audio Decoding
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}