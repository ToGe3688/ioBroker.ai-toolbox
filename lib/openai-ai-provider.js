"use strict";
/**
 * OpenAiProvider class
 */
class OpenAiProvider {
    /**
     * @param adapter - The adapter instance
     */
    constructor(adapter) {
        this.name = "OpenAI Provider";
        this.apiToken = adapter.config.opai_api_token;
        this.adapter = adapter;
        this.requestData = {};
        this.responseData = {};
        this.error = null;
        this.defaultTimeout = 30000;
        this.adapter.log.debug(`Created new ${this.name}`);
    }

    /**
     * Sends a request to the OpenRouter AI API
     *
     * @param requestObject - The request object
     * @returns - The response from the AI
     * @throws {Error} - If the request fails
     */
    async request(requestObject) {
        let response = {};
        try {
            response = await this.sendRequest(
                requestObject.model,
                requestObject.messages,
                requestObject.max_tokens,
                requestObject.system_prompt,
                requestObject.temperature,
            );
        } catch (error) {
            response.error = error.message;
        }
        return response;
    }

    /**
     * Checks if the API token is set
     *
     * @returns - True if the API token is set
     */
    apiTokenCheck() {
        if (!this.apiToken) {
            return false;
        }
        return true;
    }

    /**
     * Sends the actual HTTP request to the OpenRouter AI API
     *
     * @param model - The model to use
     * @param messages - The messages to send to the AI
     * @param max_tokens - The maximum number of tokens to generate
     * @param system_prompt - The system prompt
     * @param temperature - The temperature
     * @returns - The response from the AI
     * @throws {Error} - If the request fails
     */
    async sendRequest(model, messages, max_tokens = 2000, system_prompt = null, temperature = 0.6) {
        const url = "https://api.openai.com/v1/chat/completions";

        if (system_prompt) {
            messages.unshift({ role: "system", content: system_prompt });
        }

        // Convert image objects to content objects for the API
        const convertedMessages = [];
        for (const message of messages) {
            if (typeof message.image !== "undefined") {
                this.adapter.log.debug(`${this.name}: Image detected in message, adding to content`);
                if (typeof message.image.base64withMime !== "undefined") {
                    message.content = [
                        { type: "text", text: message.content },
                        { type: "image_url", image_url: { url: message.image.base64withMime } },
                    ];
                    delete message.image;
                } else {
                    this.adapter.log.warn(
                        `${this.name}: Image object is missing base64 or mimeType property, skipping image`,
                    );
                }
            }
            convertedMessages.push(message);
        }
        messages = convertedMessages;

        this.adapter.log.debug(`${this.name}: Messages array: ${JSON.stringify(messages)}`);

        // Create the request body
        const body = {
            model: model,
            max_tokens: max_tokens,
            temperature: temperature,
            messages: messages,
        };

        this.adapter.log.debug(`${this.name}: Request body: ${JSON.stringify(body)}`);
        this.requestData = body;

        let response = {};

        // Send the request
        try {
            response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiToken}`,
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(this.defaultTimeout),
            });
        } catch (e) {
            if (e.name === "TimeoutError") {
                this.adapter.log.warn(`${this.name}: Request timed out`);
                throw new Error(`Request timed out`);
            } else {
                this.adapter.log.warn(`${this.name}: Request failed: ${e.message}`);
                throw new Error(`Request failed: ${e.message}`);
            }
        }

        this.adapter.log.debug(`Code: ${response.status}`);
        this.adapter.log.debug(`Code: ${response.statusText}`);

        if (response.status != 200) {
            if (response.status == 400) {
                this.adapter.log.warn(`${this.name}: API invalid request error`);
                const data = await response.json();
                this.adapter.log.warn(`${this.name}: ${data.error.message}`);
                throw new Error(data.error.message);
            }
            if (response.status == 401) {
                this.adapter.log.warn(`${this.name}: API token invalid`);
                throw new Error(`API token invalid`);
            }
            if (response.status == 403) {
                this.adapter.log.warn(`${this.name}: API token forbidden`);
                throw new Error(`API token forbidden`);
            }
            if (response.status == 404) {
                this.adapter.log.warn(`${this.name}: API endpoint not found`);
                throw new Error(`API endpoint not found`);
            }
            if (response.status == 413) {
                this.adapter.log.warn(`${this.name}: API request too large error`);
                throw new Error(`API request too large error`);
            }
            if (response.status == 429) {
                this.adapter.log.warn(`${this.name}: API rate limit exceeded`);
                throw new Error(`API rate limit exceeded`);
            }
            if (response.status == 500) {
                this.adapter.log.warn(`${this.name}: API server error`);
                throw new Error(`API server error`);
            }
            if (response.status == 529) {
                this.adapter.log.warn(`${this.name}: API overload error`);
                throw new Error(`API overload error`);
            }
            this.adapter.log.warn(`${this.name}: Unknown error http code${response.status}`);
            throw new Error(`Unknown error http code${response.status}`);
        }

        const data = await response.json();

        this.adapter.log.debug(`${this.name}: Data: ${JSON.stringify(data)}`);
        this.responseData = data;

        if (!data) {
            this.adapter.log.warn(`${this.name}: No data from API error`);
            throw new Error(`No data error`);
        }

        if (data.error) {
            this.adapter.log.warn(`${this.name}: Error from API, see raw response for details: ${data.error.message}`);
            throw new Error(`Error from API, see raw response for details: ${data.error.message}`);
        }

        if (!data.choices || data.choices.length == 0) {
            this.adapter.log.warn(`${this.name}: No answer in data from API error`);
            throw new Error(`No answer in data from API error`);
        }

        if (data.choices[0].message.content == "") {
            this.adapter.log.warn(`${this.name}: Empty assistant answer in data from API`);
            throw new Error(`Empty assistant answer in data from API`);
        }

        if (!data.usage) {
            this.adapter.log.warn(`${this.name}: No usage data in response from API, using defaults`);
            data.usage = {
                input_tokens: 0,
                output_tokens: 0,
            };
        }

        const responseObj = {
            text: data.choices[0].message.content,
            model: model,
            tokens_input: data.usage.prompt_tokens,
            tokens_output: data.usage.completion_tokens,
            error: null,
        };

        return responseObj;
    }
}

module.exports = OpenAiProvider;
