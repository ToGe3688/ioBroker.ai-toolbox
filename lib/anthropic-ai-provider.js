"use strict";

class AnthropicAiProvider {
	/**
     * @param {object} adapter - The adapter instance
     * @param {object} bot - The bot object
     */
	constructor(adapter, bot) {
		this.apiToken = adapter.config.anth_api_token;
		this.adapter = adapter;
		this.bot = bot;
		this.adapter.log.debug(`Created new Anthropic AI provider for assistant: ${bot.bot_name}`);
	}

	/**
     * Sends a request to the Anthropic AI API
     * @param {Array} messages - The messages to send to the AI
     */
	async request(messages) {
		let response = {};
		try {
			response = await this.sendRequest(messages);
		} catch (error) {
			response.error = error.message;
		}
		return response;
	}

	/**
     * Sends the actual HTTP request to the Anthropic AI API
     * @param {Array} messages - The messages to send to the AI
     * @returns {Promise<object>} - The response from the AI
     */
	async sendRequest(messages) {
		const url = "https://api.anthropic.com/v1/messages";

		if (!messages || messages.length == 0) {
			this.adapter.log.debug("No messages provided for request");
			throw new Error(`No messages provided for request`);
		}

		this.adapter.log.debug("Messages array: " + JSON.stringify(messages));

		const body = {
			model: this.bot.bot_model,
			system: this.bot.bot_system_prompt,
			messages: messages,
			max_tokens: this.bot.max_tokens,
			temperature: this.bot.temperature
		};

		this.adapter.log.debug("Request body: " + JSON.stringify(body));
		this.adapter.setStateAsync(this.bot.bot_name + ".request.body", { val: JSON.stringify(body), ack: true });

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"anthropic-version": "2023-06-01",
				"x-api-key": this.apiToken,
			},
			body: JSON.stringify(body),
		});

		this.adapter.log.debug(`Code: ` + response.status);

		if (response.status != 200) {

			if (response.status == 400) {
				this.adapter.log.warn(`API invalid request error`);
				throw new Error(`API invalid request error`);
			}
			if (response.status == 401) {
				this.adapter.log.warn(`API token invalid`);
				throw new Error(`API token invalid`);
			}
			if (response.status == 403) {
				this.adapter.log.warn(`API token forbidden`);
				throw new Error(`API token forbidden`);
			}
			if (response.status == 404) {
				this.adapter.log.warn(`API endpoint not found`);
				throw new Error(`API endpoint not found`);
			}
			if (response.status == 413) {
				this.adapter.log.warn(`API request too large error`);
				throw new Error(`API request too large error`);
			}
			if (response.status == 429) {
				this.adapter.log.warn(`API rate limit exceeded`);
				throw new Error(`API rate limit exceeded`);
			}
			if (response.status == 500) {
				this.adapter.log.warn(`API server error`);
				throw new Error(`API server error`);
			}
			if (response.status == 529) {
				this.adapter.log.warn(`API overload error`);
				throw new Error(`API overload error`);
			}
			this.adapter.log.warn(`Unknown error http code` + response.status);
			throw new Error(`Unknown error http code` + response.status);
		}

		const data = await response.json();

		this.adapter.log.debug(`Data: ` + JSON.stringify(data));
		this.adapter.setStateAsync(this.bot.bot_name + ".response.raw", { val: JSON.stringify(data), ack: true });

		if (!data) {
			this.adapter.log.warn(`No data from API error`);
			throw new Error(`No data error`);
		}

		if (data.error) {
			this.adapter.log.warn(`Error from API, see raw response for details: ` + data.error.message);
			throw new Error(`Error from API, see raw response for details: ` + data.error.message);
		}

		if (!data.content || data.content.length == 0) {
			this.adapter.log.warn(`No answer in data from API error`);
			throw new Error(`No answer in data from API error`);
		}

		if (data.role != "assistant") {
			this.adapter.log.warn(`No assistant answer in data from API error`);
			throw new Error(`No assistant answer in data from API error`);
		}

		if (data.content[0].text == "") {
			this.adapter.log.warn(`Empty assistant answer in data from API`);
			throw new Error(`Empty assistant answer in data from API`);
		}

		if (!data.usage) {
			this.adapter.log.warn(`No usage data in response from API, using defaults`);
			data.usage = {
				input_tokens: 0,
				output_tokens: 0
			};
		}

		if (!data.model) {
			data.model = this.bot.bot_model;
		}

		const responseObj = {
			text: data.content[0].text,
			raw: data,
			model: data.model,
			tokens_input: data.usage.input_tokens,
			tokens_output: data.usage.output_tokens,
		};


		return responseObj;
	}
}

module.exports = AnthropicAiProvider;
