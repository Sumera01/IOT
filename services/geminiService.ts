
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
    fixCode: { type: Type.STRING, description: "Python code snippet (e.g. paho-mqtt, requests) OR step-by-step instructions." },
    fixExplanation: { type: Type.STRING, description: "Brief explanation of what the fix does." },
    riskProbability: { type: Type.NUMBER, description: "Estimated probability (0-100) of exploit based on IoT stats." },
    mitigatedRiskProbability: { type: Type.NUMBER, description: "Estimated probability (0-100) AFTER applying the fix." },
    mitigationDetails: { type: Type.STRING, description: "Specific description of the system state after the fix (e.g., 'Traffic moved to TLS port 8883')." },
    fixCategory: { 
        type: Type.STRING, 
        enum: ['Encryption', 'Network', 'Authentication', 'Device', 'Monitoring', 'Isolation', 'General', 'Physical', 'Data'],
        description: "The category of security fix required." 
    },
    cve: { type: Type.STRING, nullable: true, description: "Relevant CVE ID (e.g. CVE-2023-28121) if applicable to the pattern." },
  },
  required: ["id", "title", "severity", "description", "fixCode", "fixExplanation", "riskProbability", "mitigatedRiskProbability", "mitigationDetails", "fixCategory"],
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

  // Fallback if inputs are empty
  if (parts.length === 0) {
      throw new Error("No input provided. Please upload an image, speak, or paste config.");
  }

  const prompt = `
    You are IoT Sentinel, a world-class cyber-security auditor for IoT infrastructure.
    Analyze the provided inputs (Image, Audio, Config) multimodal-style to detect vulnerabilities.
    
    CRITICAL INSTRUCTION:
    Identify **4 to 6 distinct vulnerabilities**. Do not group them excessively. Separate network issues, device config issues, physical security risks, and code issues into individual threats to allow for granular patching.

    RULES:
    1. **Context Fusion**: Combine image (visual devices), audio (user description), and text (config code).
    2. **Protocol Specifics**:
       - **MQTT**: Check for Port 1883 (No TLS). Flag as HIGH. Fix: Enforce TLS 1.3 on Port 8883.
       - **CoAP**: Check for UDP amplification risks. Fix: Rate limiting or DTLS.
       - **HTTP**: Check for plain HTTP. Fix: HTTPS redirect.
       - **Default Creds**: Generic/unbranded devices. Fix: Strong password enforcement.
       - **Physical**: Open ports (JTAG/UART) visible on board? FixCategory: Physical.
       - **Data**: Unencrypted storage or excessive data collection? FixCategory: Data.
       - **Logging**: Lack of audit trails. FixCategory: Monitoring.
       - **Network**: Flat network structure. FixCategory: Isolation (VLANs).
    3. **Probabilistic Scoring**:
       - Base risk on common stats (e.g., Unencrypted MQTT = 80% exploit chance).
       - Mitigation should drop risk significantly (e.g., to <10%).
    4. **False Positives**: If you see 'tls_set()' or 'ssl', score risk LOW.
    
    OUTPUT FORMAT:
    Return pure JSON matching the schema. 
    - 'mitigationDetails' must be specific: "Enables TLS 1.3, moves traffic to port 8883."
    - 'cve' should be a real or representative ID.
  `;

  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: auditResultSchema,
        systemInstruction: "You are a precise, paranoid security expert. Assume worst-case for unencrypted traffic.",
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
