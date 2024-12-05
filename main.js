"use strict";

/*
 * Created with @iobroker/create-adapter v2.6.5
 */
const utils = require("@iobroker/adapter-core");
const AnthropicAiProvider = require("./lib/anthropic-ai-provider");
const OpenAiProvider = require("./lib/openai-ai-provider");
const PerplexityAiProvider = require("./lib/perplexity-ai-provider");
const OpenRouterAiProvider = require("./lib/openrouter-ai-provider");
const CustomAiProvider = require("./lib/custom-ai-provider");

class AiToolbox extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "ai-toolbox",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));

		this.timeouts = [];
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {

		if (this.config.bots.length == 0) {
			this.log.warn("No tools set");
			return;
		} else {
			this.log.debug("Found " + this.config.bots.length + " tools");
		}

		for (const bot of this.config.bots) {

			this.log.debug("Initializing objects for tool: " + bot.bot_name);

			await this.setObjectAsync(bot.bot_name, {
				type: "device",
				common: {
					name: bot.bot_name,
				},
				native: bot,
			});

			await this.setObjectAsync(bot.bot_name + ".statistics", {
				type: "device",
				common: {
					name: "Statistics for " + bot.bot_name,
				},
				native: {},
			});


			await this.setObjectNotExistsAsync(bot.bot_name + ".statistics.messages", {
				type: "state",
				common: {
					name: "Previous messages for tool " + bot.bot_name,
					type: "string",
					role: "text",
					read: true,
					write: false,
				},
				native: {},
			});

			await this.setObjectAsync(bot.bot_name + ".statistics.clear_messages", {
				type: "state",
				common: {
					name: "Clear previous message history",
					type: "boolean",
					role: "button",
					read: true,
					write: true,
				},
				native: bot,
			});

			await this.setStateAsync(bot.bot_name + ".statistics.clear_messages", { val: true, ack: true });

			await this.setObjectAsync(bot.bot_name + ".response", {
				type: "device",
				common: {
					name: "Response data for " + bot.bot_name,
				},
				native: {},
			});

			await this.setObjectAsync(bot.bot_name + ".request", {
				type: "device",
				common: {
					name: "Request data for " + bot.bot_name,
				},
				native: {},
			});

			await this.setObjectAsync(bot.bot_name + ".text_request", {
				type: "state",
				common: {
					name: "Start tool request",
					type: "string",
					role: "text",
					read: true,
					write: true,
				},
				native: bot,
			});

			await this.setObjectNotExistsAsync(bot.bot_name + ".text_response", {
				type: "state",
				common: {
					name: "Response from tool",
					type: "string",
					role: "text",
					read: true,
					write: false,
				},
				native: bot,
			});

			await this.setObjectNotExistsAsync(bot.bot_name + ".request.state", {
				type: "state",
				common: {
					name: "State for the running inference request",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
				},
				native: {},
			});

			await this.setObjectNotExistsAsync(bot.bot_name + ".request.body", {
				type: "state",
				common: {
					name: "Sent body for the running inference request",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
				},
				native: {},
			});

			await this.setObjectNotExistsAsync(bot.bot_name + ".response.raw", {
				type: "state",
				common: {
					name: "Raw response from tool",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
				},
				native: {},
			});

			await this.setObjectNotExistsAsync(bot.bot_name + ".response.error", {
				type: "state",
				common: {
					name: "Error response from tool",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
				},
				native: {},
			});

			await this.setObjectNotExistsAsync(bot.bot_name + ".statistics.tokens_input", {
				type: "state",
				common: {
					name: "Used input tokens for tool",
					type: "number",
					role: "indicator",
					read: true,
					write: false,
				},
				native: {},
			});

			await this.setObjectNotExistsAsync(bot.bot_name + ".statistics.tokens_output", {
				type: "state",
				common: {
					name: "Used output tokens for tool",
					type: "number",
					role: "indicator",
					read: true,
					write: false,
				},
				native: {},
			});

			await this.setObjectNotExistsAsync(bot.bot_name + ".statistics.last_request", {
				type: "state",
				common: {
					name: "Last request for tool",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
				},
				native: {},
			});

		}

		this.log.debug("Available models: " + JSON.stringify(this.getAvailableModels()));

		this.subscribeStates("*");

		this.log.info("Adapter ready");
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 *
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			for (const timeout of this.timeouts) {
				clearTimeout(timeout);
			}
			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed state changes
	 *
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	async onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

			if (id.includes(".clear_messages") && state.val) {
				const bot = await this.getObjectAsync(id);
				this.log.debug("Clearing message history for tool " + bot.native.bot_name);
				if (bot) {
					await this.setStateAsync(bot.native.bot_name + ".statistics.messages", { val: "{\"messages\": []}", ack: true });
					await this.setStateAsync(bot.native.bot_name + ".response.raw", { val: null, ack: true });
					await this.setStateAsync(bot.native.bot_name + ".text_response", { val: null, ack: true });
					await this.setStateAsync(bot.native.bot_name + ".response.error", { val: null, ack: true });
					await this.setStateAsync(bot.native.bot_name + ".request.body", { val: null, ack: true });
					await this.setStateAsync(bot.native.bot_name + ".request.state", { val: null, ack: true });
				}
			}
			if (id.includes(".text_request") && state.val) {
				const bot = await this.getObjectAsync(id);
				if (bot) {
					this.startBotRequest(bot.native, state.val);
				}
			}

		}
	}

	/**
     * Starts a request for the specified tool with the given text.
     * Retries the request if it fails, up to the maximum number of retries specified in the configuration.
     *
     * @param {Object} bot - The bot configuration object.
     * @param {string} text - The text to send to the tool.
     * @param {number} [tries=1] - The current number of tries for the request.
     */
	async startBotRequest(bot, text, tries = 1, try_only_once = false) {
		this.log.info("Starting request for tool: " + bot.bot_name + " Text: " + text);
		if (tries == 1) {
			await this.setStateAsync(bot.bot_name + ".request.state", { val: "start", ack: true });
		}
		await this.setStateAsync(bot.bot_name + ".response.error", { val: "", ack: true });
		const provider = this.getModelProvider(bot);
		if (provider) {
			const messages = [];
			let messagePairs = {messages: []};

			if (bot.chat_history > 0) {
				this.log.debug("Chat history is enabled for tool " + bot.bot_name);
				messagePairs = await this.getValidatedMessageHistory(bot);
				this.log.debug("Adding previous message pairs for request: " + JSON.stringify(messagePairs));
			}

			if (bot.bot_example_request &&
				bot.bot_example_request != "" &&
				bot.bot_example_response &&
				bot.bot_example_response != "") {
				messagePairs.messages.unshift({ user: bot.bot_example_request, assistant: bot.bot_example_response });
				this.log.debug("Adding tool example message pair for request: " + JSON.stringify(messagePairs));
			}

			this.log.debug("Converting message pairs to chat format for request to model");
			for (const message of messagePairs.messages) {
				messages.push({ role: "user", content: message.user });
				messages.push({ role: "assistant", content: message.assistant });
			}

			this.log.debug("Adding user message to request array: " + text);
			messages.push({ role: "user", content: text });

			const response = await provider.request(messages);
			const botResponse = await this.handleBotResponse(bot, response);
			if (!botResponse) {
				await this.setStateAsync(bot.bot_name + ".request.state", { val: "retry", ack: true });
				if (tries <= this.config.max_retries && !try_only_once) {
					let retry_delay = this.config.retry_delay * 1000;
					if (tries == this.config.max_retries) {
						retry_delay = 0;
					}
					this.log.debug("Try " + tries + "/" + this.config.max_retries + " of request for tool " + bot.bot_name + " failed Text: " + text);
					tries = tries + 1;
					this.log.debug("Retry request for tool " + bot.bot_name + " in " + this.config.retry_delay + " seconds Text: " + text);
					this.timeouts.push(setTimeout((bot, tries) => {
						this.startBotRequest(bot, text, tries);
					}, retry_delay, bot, tries));
				} else {
					this.log.error("Request for tool " + bot.bot_name + " failed after " + this.config.max_retries + " tries Text: " + text);
					await this.setStateAsync(bot.bot_name + ".request.state", { val: "failed", ack: true });
					return false;
				}
			} else {
				await this.addMessagePairToHistory(bot, text, response.text, response.tokens_input, response.tokens_output, response.model);
				this.log.info("Request for tool " + bot.bot_name + " successful Text: " + text + " Antwort: " + response.text);
				await this.setStateAsync(bot.bot_name + ".request.state", { val: "success", ack: true });
				return response;
			}
		}
	}

	/**
	 * Retrieves the message history for the specified bot.
	 * Validates the message history and returns an array of messages.
	 *
	 * @param {Object} bot - The bot configuration object.
	 * @returns {Array<{user: string, assistant: string, time: string}>} - An array of validated messages.
	 * */
	async getValidatedMessageHistory(bot) {
		this.log.debug("Getting previous message pairs for request");
		const validatedObject = {messages: []};
		const messageObject = await this.getStateAsync(bot.bot_name + ".statistics.messages");

		if (messageObject && messageObject.val != null && messageObject.val != "") {
			this.log.debug("Message history object for " + bot.bot_name + " found data: " + messageObject.val);

			this.log.debug("Trying to decode history json data: " + messageObject.val);
			const messagesData = JSON.parse(messageObject.val);

			if (messagesData.messages.length > 0) {
				for (const message of messagesData.messages) {
					validatedObject.messages.push(message);
				}
			}
			this.log.debug("Validated object: " + JSON.stringify(validatedObject));

			return validatedObject;

		} else {
			this.log.warn("Message history object for " + bot.bot_name + " not found");
			return validatedObject;
		}
	}

	/**
	 * Adds a message pair to the message history for the specified bot.
	 *
	 * @param {Object} bot - The bot configuration object.
	 * @param {string} user - The user message.
	 * @param {string} assistant - The assistant response.
	 * @param {number} tokens_input - The number of input tokens used in the request.
	 * @param {number} tokens_output - The number of output tokens used in the response.
	 * @returns {Promise<boolean>} - Returns true if the message pair was added successfully, otherwise false.
	 * */
	async addMessagePairToHistory(bot, user, assistant, tokens_input, tokens_output, model) {
		if (bot.chat_history > 0) {
			const messagesData = await this.getValidatedMessageHistory(bot);
			this.log.debug("Adding to message object with data: " + JSON.stringify(messagesData));
			messagesData.messages.push({
				user: user,
				assistant: assistant,
				timestamp: Date.now(),
				model: model,
				tokens_input: tokens_input,
				tokens_output: tokens_output
			});
			this.log.debug("New message object: " + JSON.stringify(messagesData));

			while (messagesData.messages.length > bot.chat_history) {
				this.log.debug("Removing message entry because chat history too big");
				messagesData.messages.shift();
			}

			this.log.debug("Final message object: " + JSON.stringify(messagesData));
			await this.setStateAsync(bot.bot_name + ".statistics.messages", { val: JSON.stringify(messagesData), ack: true });
			return true;
		} else {
			this.log.debug("Chat history disabled for tool " + bot.bot_name);
			return false;
		}
	}

	/**
    * Handles the response from the assistant.
    * Updates the state with the response data and statistics.
    *
    * @param {Object} bot - The bot configuration object.
    * @param {Object} response - The response from the assistant.
    * @param {string} response.text - The text response from the assistant.
    * @param {Object} response.raw - The raw response from the assistant.
    * @param {string} [response.error] - The error message if the request failed.
    * @returns {Promise<boolean>} - Returns true if the response was handled successfully, otherwise false.
    */
	async handleBotResponse(bot, response) {
		if (response.error) {
			this.setStateAsync(bot.bot_name + ".response.error", { val: response.error, ack: true });
			return false;
		}

		this.setStateAsync(bot.bot_name + ".text_response", { val: response.text, ack: true });
		this.setStateAsync(bot.bot_name + ".response.raw", { val: JSON.stringify(response.raw), ack: true });
		this.setStateAsync(bot.bot_name + ".statistics.last_request", { val: new Date().toISOString(), ack: true });
		this.setStateAsync(bot.bot_name + ".response.error", { val: null, ack: true });

		this.updateBotStatistics(bot, response);

		return true;
	}


	/**
    * Updates the statistics for the specified bot with the response data.
    *
    * @param {Object} bot - The bot configuration object.
    * @param {Object} response - The response from the assistant.
    * @param {number} response.tokens_input - The number of input tokens used in the request.
    * @param {number} response.tokens_output - The number of output tokens used in the response.
    */
	async updateBotStatistics(bot, response) {
		const input_tokens = await this.getStateAsync(bot.bot_name + ".statistics.tokens_input");
		const output_tokens = await this.getStateAsync(bot.bot_name + ".statistics.tokens_output");
		let input_total = 0;
		let output_total = 0;
		if (!input_tokens || input_tokens.val == null || input_tokens.val == "") {
			input_total = 0 + response.tokens_input;
		} else {
			input_total = input_tokens.val + response.tokens_input;
		}
		if (!output_tokens || output_tokens.val == null || output_tokens.val == "") {
			output_total = 0 + response.tokens_output;
		} else {
			output_total = output_tokens.val + response.tokens_output;
		}
		this.setStateAsync(bot.bot_name + ".statistics.tokens_input", { val: input_total, ack: true });
		this.setStateAsync(bot.bot_name + ".statistics.tokens_output", { val: output_total, ack: true });
	}

	/**
    * Retrieves the available models from the configuration.
    * Combines models from both Anthropic and OpenAI configurations.
    *
    * @returns {Array<{label: string, value: string}>} An array of available models with their labels and values.
    */
	getAvailableModels() {
		const models = [];
		for (const model of this.config.anth_models) {
			models.push({ label: model.model_name, value: model.model_name });
		}
		for (const model of this.config.opai_models) {
			models.push({ label: model.model_name, value: model.model_name });
		}
		for (const model of this.config.custom_models) {
			models.push({ label: model.model_name, value: model.model_name });
		}
		for (const model of this.config.pplx_models) {
			models.push({ label: model.model_name, value: model.model_name });
		}
		for (const model of this.config.oprt_models) {
			models.push({ label: model.model_name, value: model.model_name });
		}
		return models;
	}

	/**
    * Retrieves the model provider for the specified bot.
    * Checks both Anthropic and OpenAI models to find a match for the bot's model.
    * Logs the selected model and API token if found.
    * Returns the appropriate provider instance or null if no valid model is found.
    *
    * @param {Object} bot - The bot configuration object.
    * @param {string} bot.bot_model - The model name of the bot.
    * @param {string} bot.bot_name - The name of the bot.
    * @returns {AnthropicAiProvider|OpenAiProvider|null} - The model provider instance or null if not found.
    */
	getModelProvider(bot) {
		this.log.debug(`Getting provider for ` + bot.bot_name);

		const anth_models = this.config.anth_models;
		this.log.debug(JSON.stringify(anth_models));
		const opai_models = this.config.opai_models;
		this.log.debug(JSON.stringify(opai_models));
		const pplx_models = this.config.pplx_models;
		this.log.debug(JSON.stringify(pplx_models));
		const oprt_models = this.config.oprt_models;
		this.log.debug(JSON.stringify(oprt_models));
		const custom_models = this.config.custom_models;

		for (const model of anth_models) {
			if (model.model_name == bot.bot_model && model.model_active) {
				this.log.debug(`Selected model for tool ` + bot.bot_name + ` found in Anthropic models!`);
				this.log.debug(`Selected model for tool ` + bot.bot_name + ` is ` + bot.bot_model);
				this.log.debug(`Using API Token: ` + this.config.anth_api_token);
				if (this.config.anth_api_token == "" || this.config.anth_api_token == null) {
					this.log.warn(`Anthropic API token not set, can't start tool request!'`);
					return null;
				}
				return new AnthropicAiProvider(this, bot);
			}
		}

		for (const model of opai_models) {
			if (model.model_name == bot.bot_model && model.model_active) {
				this.log.debug(`Selected model for tool ` + bot.bot_name + ` found in OpenAI models!`);
				this.log.debug(`Selected model for tool ` + bot.bot_name + ` is ` + bot.bot_model);
				if (this.config.opai_api_token == "" || this.config.opai_api_token == null) {
					this.log.warn(`OpenAI API token not set, can't start tool request!'`);
					return null;
				}
				return new OpenAiProvider(this, bot);
			}
		}

		for (const model of custom_models) {
			if (model.model_name == bot.bot_model && model.model_active) {
				this.log.debug(`Selected model for tool ` + bot.bot_name + ` found in Custom models!`);
				this.log.debug(`Selected model for tool ` + bot.bot_name + ` is ` + bot.bot_model);
				if (this.config.custom_api_url == "" || this.config.custom_api_url == null) {
					this.log.warn(`Custom API url not set, can't start tool request!'`);
					return null;
				}
				return new CustomAiProvider(this, bot);
			}
		}

		for (const model of pplx_models) {
			if (model.model_name == bot.bot_model && model.model_active) {
				this.log.debug(`Selected model for tool ` + bot.bot_name + ` found in Perplexity models!`);
				this.log.debug(`Selected model for tool ` + bot.bot_name + ` is ` + bot.bot_model);
				if (this.config.pplx_api_token == "" || this.config.pplx_api_token == null) {
					this.log.warn(`Perplexity API token not set, can't start tool request!'`);
					return null;
				}
				return new PerplexityAiProvider(this, bot);
			}
		}

		for (const model of oprt_models) {
			if (model.model_name == bot.bot_model && model.model_active) {
				this.log.debug(`Selected model for tool ` + bot.bot_name + ` found in Openrouter models!`);
				this.log.debug(`Selected model for tool ` + bot.bot_name + ` is ` + bot.bot_model);
				if (this.config.oprt_api_token == "" || this.config.oprt_api_token == null) {
					this.log.warn(`Openrouter API token not set, can't start tool request!'`);
					return null;
				}
				return new OpenRouterAiProvider(this, bot);
			}
		}

		this.log.warn(`Selected model for tool ` + bot.bot_name +` not found in available models!`);
		return null;
	}

	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	async onMessage(obj) {
		this.log.debug("Message received: " + JSON.stringify(obj));
		if (typeof obj === "object" && obj.message) {
			if (obj.command === "send") {
				this.log.debug(JSON.stringify(obj));

				if (!obj.message.tool || !obj.message.text || obj.message.text.trim() == "") {
					this.log.warn("Missing or empty parameters for tool request via sendTo");
					return;
				}

				for (const bot of this.config.bots) {
					if (bot.bot_name == obj.message.tool) {
						this.log.debug("SendTo request for tool: " + bot.bot_name + " with Text: " + obj.message.text);
						const response = await this.startBotRequest(bot, obj.message.text, 1, true);
						if (!response.text || response.text == "") {
							this.log.warn("No response from tool " + bot.bot_name + " for request via sendTo");
							return;
						}
						if (obj.callback) this.sendTo(obj.from, obj.command, response.text, obj.callback);
						return;
					}
				}

				this.log.warn("Tool " + obj.message.tool + " not found for request via sendTo");
				if (obj.callback) this.sendTo(obj.from, obj.command, false, obj.callback);

			}

			if (obj.command === "getAvailableModels") {
				this.log.debug("getAvailableModels command");
				if (obj.callback) this.sendTo(obj.from, obj.command, this.getAvailableModels(), obj.callback);
			}
		}
	}
}



if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new AiToolbox(options);
} else {
	// otherwise start the instance directly
	new AiToolbox();
}
