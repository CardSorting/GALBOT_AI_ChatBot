require("dotenv").config();
const axios = require("axios");

class ApiHandler {
  constructor() {
    // Set the endpoint URL and API key directly in the constructor
    this.endpointUrl = "https://api.together.xyz/inference";
    this.apiKey = process.env.TOGETHER_API_KEY; // Use API key from environment variables
  }

  async makeRequest(prompt) {
    // Create the request object with the correct parameters
    const requestData = {
      model: "teknium/OpenHermes-2p5-Mistral-7B",
      prompt: prompt, // Use the prompt parameter
      temperature: 0.7,
      top_p: 0.7,
      top_k: 50,
      max_tokens: 15,
      repetition_penalty: 1
    };

    try {
      const response = await axios.post(this.endpointUrl, requestData, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      // Extracting the text from the first choice in the choices array
      const choiceText = response.data.output.choices[0].text;

      return choiceText; // Return only the text property
    } catch (error) {
      console.error("Error making API request:", error);
      throw error; // Re-throw the error for upstream handling
    }
  }
}

module.exports = ApiHandler;