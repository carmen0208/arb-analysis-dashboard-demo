import Moralis from "moralis";
import dotenv from "dotenv";

dotenv.config();

let moralisStarted = false;

/**
 * Initializes Moralis SDK if not already started.
 * Loads the API key from process.env.MORALIS_API_KEY.
 */
export async function initMoralis(): Promise<typeof Moralis> {
  if (!moralisStarted) {
    const apiKey = process.env.MORALIS_API_KEY;
    if (!apiKey) {
      throw new Error("MORALIS_API_KEY is not set in environment variables");
    }
    await Moralis.start({ apiKey });
    moralisStarted = true;
  }
  return Moralis;
}
