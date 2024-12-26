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
		} else {
			this.log.debug("Found " + this.config.bots.length + " tools");
		}

		// Create Models and Tools objects
		await this.setObjectAsync("Models", {
			type: "device",
			common: {
				name: "AI Models",
			},
			native: {},
		});

		await this.setObjectAsync("Tools", {
			type: "device",
			common: {
				name: "Created AI Tools",
			},
			native: {},
		});

		// Create objects for each model
		const models = this.getAvailableModels();

		for (let model of models) {
			const modelName = model.value;
			model = this.stringToAlphaNumeric(model.value);
			this.log.debug("Initializing objects for model: " + model);

			await this.setObjectAsync("Models." + model, {
				type: "device",
				common: {
					name: model,
				},
				native: {},
			});

			await this.setObjectAsync("Models." + model + ".text_request", {
				type: "state",
				common: {
					name: "Start tool request",
					type: "string",
					role: "text",
					read: true,
					write: true,
					def: ""
				},
				native: {
					model: modelName
				}
			});

			await this.setObjectNotExistsAsync("Models." + model + ".text_response", {
				type: "state",
				common: {
					name: "Response from tool",
					type: "string",
					role: "text",
					read: true,
					write: false,
					def: ""
				},
				native: {
					model: modelName
				}
			});

			await this.setObjectAsync("Models." + model + ".statistics", {
				type: "device",
				common: {
					name: "Statistics for " + modelName,
				},
				native: {},
			});

			await this.setObjectAsync("Models." + model + ".response", {
				type: "device",
				common: {
					name: "Response data for " + modelName,
				},
				native: {},
			});

			await this.setObjectAsync("Models." + model + ".request", {
				type: "device",
				common: {
					name: "Request data for " + modelName,
				},
				native: {},
			});


			await this.setObjectNotExistsAsync("Models." + model + ".request.state", {
				type: "state",
				common: {
					name: "State for the running inference request",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
					def: ""
				},
				native: {},
			});

			await this.setObjectNotExistsAsync("Models." + model + ".request.body", {
				type: "state",
				common: {
					name: "Sent body for the running inference request",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
					def: ""
				},
				native: {},
			});

			await this.setObjectNotExistsAsync("Models." + model + ".response.raw", {
				type: "state",
				common: {
					name: "Raw response from model",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
					def: ""
				},
				native: {},
			});

			await this.setObjectNotExistsAsync("Models." + model + ".response.error", {
				type: "state",
				common: {
					name: "Error response from model",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
					def: ""
				},
				native: {},
			});

			await this.setObjectNotExistsAsync("Models." + model + ".statistics.tokens_input", {
				type: "state",
				common: {
					name: "Used input tokens for model",
					type: "number",
					role: "indicator",
					read: true,
					write: false,
					def: 0
				},
				native: {},
			});

			await this.setObjectNotExistsAsync("Models." + model + ".statistics.tokens_output", {
				type: "state",
				common: {
					name: "Used output tokens for model",
					type: "number",
					role: "indicator",
					read: true,
					write: false,
					def: 0
				},
				native: {},
			});

			await this.setObjectNotExistsAsync("Models." + model + ".statistics.requests_count", {
				type: "state",
				common: {
					name: "Count of requests for model",
					type: "number",
					role: "indicator",
					read: true,
					write: false,
					def: 0
				},
				native: {},
			});

			await this.setObjectNotExistsAsync("Models." + model + ".statistics.last_request", {
				type: "state",
				common: {
					name: "Last request for model",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
					def: ""
				},
				native: {},
			});
		}

		// Create objects for each tool
		for (const bot of this.config.bots) {

			bot.bot_name = this.stringToAlphaNumeric(bot.bot_name);

			this.log.debug("Initializing objects for tool: " + bot.bot_name);

			await this.setObjectAsync("Tools." + bot.bot_name, {
				type: "device",
				common: {
					name: bot.bot_name,
				},
				native: bot,
			});

			if (typeof bot.use_vision !== "undefined" && bot.use_vision) {
				await this.setObjectAsync("Tools." + bot.bot_name + ".image_url", {
					type: "state",
					common: {
						name: "Image URL",
						description: "URL of an image to send with the next text request",
						type: "string",
						role: "text",
						read: true,
						write: true,
						def: ""
					},
					native: {}
				});
			}

			await this.setObjectAsync("Tools." + bot.bot_name + ".text_request", {
				type: "state",
				common: {
					name: "Start direct model request",
					type: "string",
					role: "text",
					read: true,
					write: true,
					def: ""
				},
				native: bot,
			});

			await this.setObjectNotExistsAsync("Tools." + bot.bot_name + ".text_response", {
				type: "state",
				common: {
					name: "Response from model",
					type: "string",
					role: "text",
					read: true,
					write: false,
					def: ""
				},
				native: bot,
			});

			await this.setObjectAsync("Tools." + bot.bot_name + ".statistics", {
				type: "device",
				common: {
					name: "Statistics for " + bot.bot_name,
				},
				native: {},
			});

			await this.setObjectAsync("Tools." + bot.bot_name + ".response", {
				type: "device",
				common: {
					name: "Response data for " + bot.bot_name,
				},
				native: {},
			});

			await this.setObjectAsync("Tools." + bot.bot_name + ".request", {
				type: "device",
				common: {
					name: "Request data for " + bot.bot_name,
				},
				native: {},
			});


			await this.setObjectNotExistsAsync("Tools." + bot.bot_name + ".statistics.messages", {
				type: "state",
				common: {
					name: "Previous messages for tool " + bot.bot_name,
					type: "string",
					role: "text",
					read: true,
					write: false,
					def: "{\"messages\": []}"
				},
				native: {},
			});

			await this.setObjectAsync("Tools." + bot.bot_name + ".statistics.clear_messages", {
				type: "state",
				common: {
					name: "Clear previous message history",
					type: "boolean",
					role: "button",
					read: true,
					write: true,
					def: true
				},
				native: bot,
			});

			await this.setObjectNotExistsAsync("Tools." + bot.bot_name + ".request.state", {
				type: "state",
				common: {
					name: "State for the running inference request",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
					def: ""
				},
				native: {},
			});

			await this.setObjectNotExistsAsync("Tools." + bot.bot_name + ".request.body", {
				type: "state",
				common: {
					name: "Sent body for the running inference request",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
					def: ""
				},
				native: {},
			});

			await this.setObjectNotExistsAsync("Tools." + bot.bot_name + ".response.raw", {
				type: "state",
				common: {
					name: "Raw response from tool",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
					def: ""
				},
				native: {},
			});

			await this.setObjectNotExistsAsync("Tools." + bot.bot_name + ".response.error", {
				type: "state",
				common: {
					name: "Error response from tool",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
					def: ""
				},
				native: {},
			});

			await this.setObjectNotExistsAsync("Tools." + bot.bot_name + ".statistics.tokens_input", {
				type: "state",
				common: {
					name: "Used input tokens for tool",
					type: "number",
					role: "indicator",
					read: true,
					write: false,
					def: 0
				},
				native: {},
			});

			await this.setObjectNotExistsAsync("Tools." + bot.bot_name + ".statistics.tokens_output", {
				type: "state",
				common: {
					name: "Used output tokens for tool",
					type: "number",
					role: "indicator",
					read: true,
					write: false,
					def: 0
				},
				native: {},
			});

			await this.setObjectNotExistsAsync("Tools." + bot.bot_name + ".statistics.requests_count", {
				type: "state",
				common: {
					name: "Count of requests for tool",
					type: "number",
					role: "indicator",
					read: true,
					write: false,
					def: 0
				},
				native: {},
			});

			await this.setObjectNotExistsAsync("Tools." + bot.bot_name + ".statistics.last_request", {
				type: "state",
				common: {
					name: "Last request for tool",
					type: "string",
					role: "indicator",
					read: true,
					write: false,
					def: ""
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
				if (bot) {
					bot.native.bot_name = this.stringToAlphaNumeric(bot.native.bot_name);
					this.log.debug("Clearing message history for tool " + bot.native.bot_name);
					await this.setStateAsync("Tools." +bot.native.bot_name + ".statistics.messages", { val: "{\"messages\": []}", ack: true });
					await this.setStateAsync("Tools." +bot.native.bot_name + ".response.raw", { val: null, ack: true });
					await this.setStateAsync("Tools." +bot.native.bot_name + ".text_response", { val: null, ack: true });
					await this.setStateAsync("Tools." +bot.native.bot_name + ".response.error", { val: null, ack: true });
					await this.setStateAsync("Tools." +bot.native.bot_name + ".request.body", { val: null, ack: true });
					await this.setStateAsync("Tools." +bot.native.bot_name + ".request.state", { val: null, ack: true });
				}
			}

			if (id.includes("Tools.") && id.includes(".text_request") && state.val) {
				const bot = await this.getObjectAsync(id);
				if (bot) {
					if (bot.native.use_vision) {
						const imageUrl = await this.getStateAsync("Tools." + bot.native.bot_name + ".image_url");
						if (imageUrl && imageUrl.val && imageUrl.val != "") {
							const imageData = await this.fetchImageAsBase64(imageUrl.val);
							if (imageData.success) {
								await this.setStateAsync("Tools." + bot.native.bot_name + ".image_url", { val: "", ack: true });
								this.startBotRequest(bot.native, state.val, imageData);
							} else {
								this.log.warn("Request stopped, image fetch failed for tool " + bot.native.bot_name + " URL: " + imageUrl.val);
								await this.setStateAsync("Tools." + bot.native.bot_name + ".request.state", { val: "error", ack: true });
								await this.setStateAsync("Tools." + bot.native.bot_name + ".response.error", { val: "fetching image for request failed", ack: true });
								await this.setStateAsync("Tools." + bot.native.bot_name + ".image_url", { val: "", ack: true });
							}
						} else {
							this.startBotRequest(bot.native, state.val, null);
						}
					} else {
						this.startBotRequest(bot.native, state.val, null);
					}
				}
			}

			if (id.includes("Models.") && id.includes(".text_request") && state.val) {
				const obj = await this.getObjectAsync(id);
				if (obj) {
					this.startModelRequest(obj.native.model, [{ role: "user", content: state.val }]);
				}
			}

		}
	}

	/**
	 * Starts a request for the selected tool with the specified text.
	 * Validates the message history and adds the message pair to the history.
	 * Updates the statistics for the tool with the response data.
	 * Starts a new request if the previous request failed.
	 * Logs the request and response data.
	 * Returns the response data if the request was successful, otherwise false.
	 * @param {Object} bot - The bot configuration object.
	 * @param {string} text - The text to send to the bot.
	 * @param {number} tries - The number of tries for the request.
	 * @param {boolean} try_only_once - If true, the request will only be tried once.
	 */
	async startBotRequest(bot, text, image = null, tries = 0, try_only_once = false) {

		bot.bot_name = this.stringToAlphaNumeric(bot.bot_name);

		this.log.info("Starting request for tool: " + bot.bot_name + " Text: " + text);
		if (tries == 0) {
			await this.setStateAsync("Tools." +bot.bot_name + ".request.state", { val: "start", ack: true });
		}
		await this.setStateAsync("Tools." +bot.bot_name + ".response.error", { val: "", ack: true });
		const provider = this.getModelProvider(bot.bot_model);
		if (provider) {

			if (!provider.apiTokenCheck()) {
				this.log.warn("No API token set for provider " + typeof provider + ", cant start request!");
				return false;
			}

			const messages = [];
			let messagePairs = { messages: [] };

			if (bot.bot_example_request &&
				bot.bot_example_request != "" &&
				bot.bot_example_response &&
				bot.bot_example_response != "") {
				messagePairs.messages.unshift({ user: bot.bot_example_request, assistant: bot.bot_example_response });
				this.log.debug("Adding tool example message pair for request: " + JSON.stringify(messagePairs));
			}

			if (bot.chat_history > 0) {
				this.log.debug("Chat history is enabled for tool " + bot.bot_name);
				messagePairs = await this.getValidatedMessageHistory(bot);
				this.log.debug("Adding previous message pairs for request: " + JSON.stringify(messagePairs));
			}

			this.log.debug("Converting message pairs to chat format for request to model");
			for (const message of messagePairs.messages) {
				if (typeof message.image !== "undefined" && message.image != null) {
					this.log.debug("Tool " + bot.bot_name + " image message detected in chat history message, adding image data");
					messages.push({ role: "user", content: message.user, image: message.image});
				} else {
					messages.push({ role: "user", content: message.user });
				}
				messages.push({ role: "assistant", content: message.assistant });
			}

			this.log.debug("Adding user message to request array: " + text);
			if (image) {
				this.log.debug("Tool " + bot.bot_name + " image request detected, adding image data");
				messages.push({ role: "user", content: text, image: image });
			} else {
				messages.push({ role: "user", content: text });
			}

			const modelResponse = await this.startModelRequest(bot.bot_model, messages, bot.bot_system_prompt, bot.max_tokens, bot.temperature);

			let requestCompleted = true;

			if (modelResponse.error) {
				await this.setStateAsync("Tools." + bot.bot_name + ".request.state", { val: "error", ack: true });
				await this.setStateAsync("Tools." + bot.bot_name + ".request.body", { val: JSON.stringify(modelResponse.requestData), ack: true });
				await this.setStateAsync("Tools." + bot.bot_name + ".response.error", { val: modelResponse.error, ack: true });
				await this.setStateAsync("Tools." + bot.bot_name + ".response.raw", { val: JSON.stringify(modelResponse.responseData), ack: true });
				requestCompleted = false;
			} else {
				await this.setStateAsync("Tools." + bot.bot_name + ".request.state", { val: "success", ack: true });
				await this.setStateAsync("Tools." + bot.bot_name + ".request.body", { val: JSON.stringify(modelResponse.requestData), ack: true });
				await this.setStateAsync("Tools." + bot.bot_name + ".response.error", { val: "", ack: true });
				await this.setStateAsync("Tools." + bot.bot_name + ".response.raw", { val: JSON.stringify(modelResponse.responseData), ack: true });
				await this.setStateAsync("Tools." + bot.bot_name + ".text_response", { val: modelResponse.text, ack: true });
				this.updateBotStatistics(bot, modelResponse);
			}

			if (!requestCompleted) {
				if (typeof bot.retry_delay == "undefined") { bot.retry_delay = 15; }
				if (typeof bot.max_retries == "undefined") { bot.max_retries = 3; }
				await this.setStateAsync("Tools." + bot.bot_name + ".request.state", { val: "retry", ack: true });
				if (tries < bot.max_retries && !try_only_once) {
					let retry_delay = bot.retry_delay * 1000;
					if (tries == bot.max_retries) {
						retry_delay = 0;
					}
					this.log.debug("Try " + tries+1 + "/" + bot.max_retries + " of request for tool " + bot.bot_name + " failed Text: " + text);
					tries = tries + 1;
					this.log.debug("Retry request for tool " + bot.bot_name + " in " + bot.retry_delay + " seconds Text: " + text);
					this.timeouts.push(setTimeout((bot, tries) => {
						this.startBotRequest(bot, text, image, tries);
					}, retry_delay, bot, tries));
				} else {
					this.log.error("Request for tool " + bot.bot_name + " failed after " + bot.max_retries + " tries Text: " + text);
					await this.setStateAsync("Tools." + bot.bot_name + ".request.state", { val: "failed", ack: true });
					return false;
				}
			} else {
				this.log.info("Request for tool " + bot.bot_name + " successful Text: " + text + " Response: " + modelResponse.text);
				await this.addMessagePairToHistory(bot, text, image, modelResponse.text, modelResponse.tokens_input, modelResponse.tokens_output, modelResponse.model);
				return modelResponse;
			}
		}
	}

	/**
	 * Starts a request for the specified model with the specified messages.
	 * Validates the request and returns the response data if the request was successful.
	 * Updates the statistics for the model with the response data.
	 * Logs the request and response data.
	 * @param {string} model - The model name.
	 * @param {Array<{role: string, content: string}>} messages - The messages to send to the model.
	 * @param {string} system_prompt - The system prompt for the model.
	 * @param {number} max_tokens - The maximum number of tokens to generate.
	 * @param {number} temperature - The temperature for the model.
	 * @returns {Promise<boolean|{error: string, requestData: Object, responseData: Object, text: string, tokens_input: number, tokens_output: number}>} - Returns the response data if the request was successful, otherwise false.
	 */
	async startModelRequest(model, messages, system_prompt = null, max_tokens = 2000, temperature = 0.6) {
		const modelDatapointName = this.stringToAlphaNumeric(model);

		this.log.info("Starting request for model: " + model + " Messages: " + JSON.stringify(messages));

		const provider = this.getModelProvider(model);
		if (provider) {

			if (!provider.apiTokenCheck()) {
				this.log.warn("No API token set for provider " + typeof provider + ", cant start request!");
				return false;
			}

			await this.setStateAsync("Models." + modelDatapointName + ".request.state", { val: "start", ack: true });
			await this.setStateAsync("Models." + modelDatapointName + ".response.error", { val: "", ack: true });

			const request = {
				model: model,
				messages: messages,
				max_tokens: max_tokens,
				temperature: temperature,
				system_prompt: system_prompt,
				feedback_device: "Model." + modelDatapointName
			};

			if (!this.validateRequest(request)) {
				await this.setStateAsync("Models." + modelDatapointName + ".request.state", { val: "error", ack: true });
				await this.setStateAsync("Models." + modelDatapointName + ".response.error", { val: "Request Validation failed", ack: true });
				this.log.warn("Request for Model " + model + " failed validation, stopping request");
				return;
			}

			const modelResponse = await provider.request(request);
			modelResponse.requestData = provider.requestData;
			modelResponse.responseData = provider.responseData;
			if (modelResponse.error) {
				await this.setStateAsync("Models." + modelDatapointName + ".request.state", { val: "error", ack: true });
				await this.setStateAsync("Models." + modelDatapointName + ".response.error", { val: modelResponse.error, ack: true });
				await this.setStateAsync("Models." + modelDatapointName + ".request.body", { val: JSON.stringify(modelResponse.requestData), ack: true });
				await this.setStateAsync("Models." + modelDatapointName + ".response.raw", { val: JSON.stringify(modelResponse.responseData), ack: true });
			} else {
				await this.setStateAsync("Models." + modelDatapointName + ".request.state", { val: "success", ack: true });
				await this.setStateAsync("Models." + modelDatapointName + ".response.error", { val: "", ack: true });
				await this.setStateAsync("Models." + modelDatapointName + ".request.body", { val: JSON.stringify(modelResponse.requestData), ack: true });
				await this.setStateAsync("Models." + modelDatapointName + ".response.raw", { val: JSON.stringify(modelResponse.responseData), ack: true });
				await this.setStateAsync("Models." + modelDatapointName + ".text_response", { val: modelResponse.text, ack: true });
				this.updateModelStatistics(model, modelResponse);
			}
			return modelResponse;
		}
	}

	/**
	 * Validates the request object and sets default values if necessary.
	 * Logs a warning if the request is invalid.
	 * Returns the validated request object or false if the request is invalid.
	 * @param {Object} requestObj - The request object.
	 * @param {string} requestObj.model - The model name.
	 * @param {Array<{role: string, content: string}>} requestObj.messages - The messages to send to the model.
	 * @param {string} requestObj.feedback_device - The feedback device for the model.
	 * @param {number} requestObj.max_tokens - The maximum number of tokens to generate.
	 * @param {number} requestObj.temperature - The temperature for the model.
	 * @param {string} requestObj.system_prompt - The system prompt for the model.
	 * @returns {Object|boolean} - The validated request object or false if the request is invalid.
	 */
	validateRequest(requestObj) {
		if (!requestObj.model || requestObj.model == "") {
			this.log.warn(`No model provided in request, validation failed`);
			return false;
		}
		if (!requestObj.messages || requestObj.messages.length == 0) {
			this.log.warn(`No messages provided in request, validation failed`);
			return false;
		}
		if (!requestObj.feedback_device || requestObj.feedback_device == "") {
			this.log.debug(`No path for feedback objects provided in request, using Model default`);
			requestObj.feedback_device = "Models." + this.stringToAlphaNumeric(requestObj.model);
		}
		if (!requestObj.max_tokens || requestObj.max_tokens == "") {
			this.log.debug(`No max_tokens provided in request, using default value: 2000`);
			requestObj.max_tokens = 2000;
		}
		if (!requestObj.temperature || requestObj.temperature == "") {
			this.log.debug(`No temperature provided in request, using default value: 0.6`);
			requestObj.temperature = 0.6;
		}
		if (!requestObj.system_prompt || requestObj.system_prompt.trim() == "") {
			this.log.debug(`No system prompt provided in request`);
			requestObj.system_prompt = null;
		}
		return requestObj;
	}

	/**
	 * Retrieves the message history for the specified bot.
	 * Validates the message history and returns an array of messages.
	 *
	 * @param {Object} bot - The bot configuration object.
	 * @returns {Array<{user: string, assistant: string, time: string}>} - An array of validated messages.
	 * */
	async getValidatedMessageHistory(bot) {

		bot.bot_name = this.stringToAlphaNumeric(bot.bot_name);

		this.log.debug("Getting previous message pairs for request");
		const validatedObject = {messages: []};
		const messageObject = await this.getStateAsync("Tools." + bot.bot_name + ".statistics.messages");

		if (messageObject && messageObject.val != null && messageObject.val != "") {
			this.log.debug("Message history object for " + bot.bot_name + " found data: " + messageObject.val);

			this.log.debug("Trying to decode history json data: " + messageObject.val);
			const messagesData = JSON.parse(messageObject.val);

			if (messagesData && messagesData.messages && messagesData.messages.length > 0) {
				for (const message of messagesData.messages) {
					if (typeof bot.include_vision_in_history !== "undefined" && bot.include_vision_in_history) {
						validatedObject.messages.push(message);
					} else {
						if (message.image) {
							delete message.image;
						}
						validatedObject.messages.push(message);
					}
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
	async addMessagePairToHistory(bot, user, image, assistant, tokens_input, tokens_output, model) {
		if (bot.chat_history > 0) {

			bot.bot_name = this.stringToAlphaNumeric(bot.bot_name);

			const messagesData = await this.getValidatedMessageHistory(bot);
			this.log.debug("Adding to message object with data: " + JSON.stringify(messagesData));
			messagesData.messages.push({
				user: user,
				assistant: assistant,
				image: image,
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
			await this.setStateAsync("Tools." +bot.bot_name + ".statistics.messages", { val: JSON.stringify(messagesData), ack: true });
			return true;
		} else {
			this.log.debug("Chat history disabled for tool " + bot.bot_name);
			return false;
		}
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

		bot.bot_name = this.stringToAlphaNumeric(bot.bot_name);

		this.log.debug("Updating statistics for tool " + bot.bot_name + " with response: " + JSON.stringify(response));

		let input_tokens = await this.getStateAsync("Tools." +bot.bot_name + ".statistics.tokens_input");
		let output_tokens = await this.getStateAsync("Tools." + bot.bot_name + ".statistics.tokens_output");
		let requests_count = await this.getStateAsync("Tools." + bot.bot_name + ".statistics.requests_count");

		if (!input_tokens || input_tokens.val == null || input_tokens.val == "") {
			input_tokens = 0 + response.tokens_input;
		} else {
			input_tokens = input_tokens.val + response.tokens_input;
		}

		if (!output_tokens || output_tokens.val == null || output_tokens.val == "") {
			output_tokens = 0 + response.tokens_output;
		} else {
			output_tokens = output_tokens.val + response.tokens_output;
		}

		if (!requests_count || requests_count.val == null || requests_count.val == "") {
			requests_count = 0 + 1;
		} else {
			requests_count = parseInt(requests_count.val) + 1;
		}

		this.setStateAsync("Tools." + bot.bot_name + ".statistics.tokens_input", { val: input_tokens, ack: true });
		this.setStateAsync("Tools." + bot.bot_name + ".statistics.tokens_output", { val: output_tokens, ack: true });
		this.setStateAsync("Tools." + bot.bot_name + ".statistics.requests_count", { val: requests_count, ack: true });
		this.setStateAsync("Tools." + bot.bot_name + ".statistics.last_request", { val: new Date().toISOString(), ack: true });
	}

	/**
	 * Converts a string to alphanumeric characters only.
	 * @param {string} str - The string to convert.
	 * @returns {string} - The converted string.
	 * */
	stringToAlphaNumeric(str) {
		return str.replace(/[^a-zA-Z0-9-_]/g, "");
	}

	/**
	 * Updates the statistics for the specified model with the response data.
	 * @param {string} model - The model name.
	 * @param {Object} response - The response from the model.
	 * @param {number} response.tokens_input - The number of input tokens used in the request.
	 * @param {number} response.tokens_output - The number of output tokens used in the response.
	 */
	async updateModelStatistics(model, response) {
		this.log.debug("Updating model statistics for model " + model + " with response: " + JSON.stringify(response));

		model = this.stringToAlphaNumeric(model);

		let input_tokens = await this.getStateAsync("Models." + model + ".statistics.tokens_input");
		let output_tokens = await this.getStateAsync("Models." + model + ".statistics.tokens_output");
		let requests_count = await this.getStateAsync("Models." + model + ".statistics.requests_count");

		if (!input_tokens || input_tokens.val == null || input_tokens.val == "") {
			input_tokens = 0 + response.tokens_input;
		} else {
			input_tokens = input_tokens.val + response.tokens_input;
		}

		if (!output_tokens || output_tokens.val == null || output_tokens.val == "") {
			output_tokens = 0 + response.tokens_output;
		} else {
			output_tokens = output_tokens.val + response.tokens_output;
		}

		if (!requests_count || requests_count.val == null || requests_count.val == "") {
			requests_count = 0 + 1;
		} else {
			requests_count = parseInt(requests_count.val) + 1;
		}

		this.setStateAsync("Models." + model + ".statistics.tokens_input", { val: input_tokens, ack: true });
		this.setStateAsync("Models." + model + ".statistics.tokens_output", { val: output_tokens, ack: true });
		this.setStateAsync("Models." + model + ".statistics.requests_count", { val: requests_count, ack: true });
		this.setStateAsync("Models." + model + ".statistics.last_request", { val: new Date().toISOString(), ack: true });

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
	getModelProvider(requestedModel) {
		this.log.debug(`Getting provider for Model` + requestedModel);

		const anth_models = this.config.anth_models;
		const opai_models = this.config.opai_models;
		const pplx_models = this.config.pplx_models;
		const oprt_models = this.config.oprt_models;
		const custom_models = this.config.custom_models;

		for (const model of anth_models) {
			if (model.model_name == requestedModel && model.model_active) {
				this.log.debug(`Provider for Model ` + model.model_name + ` is Anthropic`);
				return new AnthropicAiProvider(this);
			}
		}

		for (const model of opai_models) {
			if (model.model_name == requestedModel && model.model_active) {
				this.log.debug(`Provider for Model ` + model.model_name + ` is OpenAI`);
				return new OpenAiProvider(this);
			}
		}

		for (const model of custom_models) {
			if (model.model_name == requestedModel && model.model_active) {
				this.log.debug(`Provider for Model ` + model.model_name + ` is Custom/Selfhosted`);
				return new CustomAiProvider(this);
			}
		}

		for (const model of pplx_models) {
			if (model.model_name == requestedModel && model.model_active) {
				this.log.debug(`Provider for Model ` + model.model_name + ` is Perplexity`);
				return new PerplexityAiProvider(this);
			}
		}

		for (const model of oprt_models) {
			if (model.model_name == requestedModel && model.model_active) {
				this.log.debug(`Provider for Model ` + model.model_name + ` is OpenRouter`);
				return new OpenRouterAiProvider(this);
			}
		}

		this.log.warn(`No provider found for model ` + requestedModel);
		return null;
	}

	/**
	 * Fetches an image from the specified URL and returns it as a base64 string.
	 * @param {string} url - The URL of the image to fetch.
	 * @returns {Promise<{mimeType: string, base64: string, base64withMime: string, success: boolean}>} - The fetched image as a base64 string
	 * */
	async fetchImageAsBase64(url) {
		const responseObject = { mimeType: "", base64: "", base64withMime: "", url: url, success: false };
		if (!url || url.trim() == "") {
			this.log.warn("Empty or invalid URL for image fetch");
			return responseObject;
		}
		const response = await fetch(url);
		if (!response.ok) {
			this.log.warn("Failed to fetch image from " + url + " with status: " + response.status);
			return responseObject;
		}
		const mimeType = response.headers.get("content-type");
		if (!mimeType || !mimeType.includes("image")) {
			this.log.warn("Response from " + url + " is not an image, mimeType: " + mimeType);
			return responseObject;
		}
		const buffer = await response.arrayBuffer();
		if (!buffer) {
			this.log.warn("Failed to fetch image from " + url + " as array buffer");
			return responseObject;
		}
		const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
		if (!base64) {
			this.log.warn("Failed to fetch image from " + url + " as base64");
			return responseObject;
		}
		if (mimeType && base64) {
			this.log.info("Fetched image from " + url + " as base64, mimeType: " + mimeType);
			responseObject.mimeType = mimeType;
			responseObject.base64 = base64;
			responseObject.base64withMime = `data:${mimeType};base64,${base64}`;
			responseObject.success = true;
		}
		return responseObject;
	}


	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	async onMessage(obj) {
		this.log.debug("Message received: " + JSON.stringify(obj));
		if (typeof obj === "object" && obj.message) {

			if (obj.command === "tool_request") {

				this.log.debug("Tool request via message box");

				if (!obj.message.tool || !obj.message.text || obj.message.text.trim() == "") {
					this.log.warn("Missing or empty parameters for tool request via message box");
					return;
				}

				for (const bot of this.config.bots) {
					this.log.debug(obj.message);
					if (bot.bot_name == obj.message.tool || this.stringToAlphaNumeric(bot.bot_name) == obj.message.tool) {
						const botName = this.stringToAlphaNumeric(bot.bot_name);

						this.log.debug("SendTo request for tool: " + botName + " with Text: " + obj.message.text);

						let image = null;
						if (obj.message.image_url && obj.message.image_url.trim() != "") {
							const imageData = await this.fetchImageAsBase64(obj.message.image_url);
							if (imageData.success) {
								image = imageData;
							} else {
								this.log.warn("Request stopped, image fetch failed for tool " + botName + " URL: " + obj.message.image_url);
								if (obj.callback) this.sendTo(obj.from, obj.command, false, obj.callback);
								return;
							}
						}

						const response = await this.startBotRequest(bot, obj.message.text, image, 1, true);

						if (!response.text || response.text.trim() == "") {
							this.log.warn("No response from tool " + bot.bot_name + " for request via sendTo");
							if (obj.callback) this.sendTo(obj.from, obj.command, false, obj.callback);
							return;
						}

						if (obj.callback) this.sendTo(obj.from, obj.command, response.text, obj.callback);
						return;
					}
				}

				if (obj.callback) this.sendTo(obj.from, obj.command, false, obj.callback);
				return;

			}

			if (obj.command === "model_request") {

				this.log.debug("Model request via message box");
				let messages = [];

				if (!obj.message.messages) {

					if (!obj.message.model || !obj.message.text || obj.message.text.trim() == "") {
						this.log.warn("Missing or empty parameters for tool request via message box");
						if (obj.callback) this.sendTo(obj.from, obj.command, false, obj.callback);
						return;
					}

					if (obj.message.image_url && obj.message.image_url.trim() != "") {
						const imageData = await this.fetchImageAsBase64(obj.message.image_url);
						if (!imageData.success) {
							this.log.warn("Request stopped, image fetch failed for URL: " + obj.message.image_url);
							if (obj.callback) this.sendTo(obj.from, obj.command, false, obj.callback);
							return;
						}
						messages = [{ role: "user", content: obj.message.text, image: imageData }];
					} else {
						messages = [{ role: "user", content: obj.message.text }];
					}

				} else {

					if (!obj.message.model) {
						this.log.warn("Missing or empty parameters for tool request via message box");
						if (obj.callback) this.sendTo(obj.from, obj.command, false, obj.callback);
						return;
					}
					messages = obj.message.messages;

				}

				const models = this.getAvailableModels();
				let found = false;
				let foundModel = null;
				for (const model of models) {
					if (model.value == obj.message.model || this.stringToAlphaNumeric(model.value) == obj.message.model) {
						found = true;
						foundModel = model.value;
					}
				}
				if (!found) {
					this.log.warn("Model " + obj.message.model + " not found in available models");
					if (obj.callback) this.sendTo(obj.from, obj.command, false, obj.callback);
					return;
				}

				if (!obj.message.system_prompt || obj.message.system_prompt.trim() == "") {
					this.log.debug("System prompt empty for sendto Model request");
					obj.message.system_prompt = null;
				}

				if (!obj.message.temperature) {
					this.log.debug("Temperature not set for sendto Model request, using default 0.6");
					obj.message.temperature = 0.6;
				}

				if (!obj.message.max_tokens) {
					this.log.debug("Max tokens not set for sendto Model request, using default 2000");
					obj.message.max_tokens = 2000;
				}

				const response = await this.startModelRequest(foundModel, messages, obj.message.system_prompt, obj.message.max_tokens, obj.message.temperature);

				if (!response || !response.text || response.text.trim() == "") {
					this.log.warn("No response from model " + foundModel + " for request via sendTo");
					if (obj.callback) this.sendTo(obj.from, obj.command, false, obj.callback);
					return;
				}

				if (obj.callback) this.sendTo(obj.from, obj.command, response, obj.callback);
				return;
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
