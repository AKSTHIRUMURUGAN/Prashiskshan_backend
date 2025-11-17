import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "./index.js";

const generativeAI = new GoogleGenerativeAI(config.gemini.apiKey);

export const flashModel = generativeAI.getGenerativeModel({ model: config.gemini.flashModel });
export const proModel = generativeAI.getGenerativeModel({ model: config.gemini.proModel });

export default generativeAI;

