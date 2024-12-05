![Logo](admin/ai-toolbox.png)
# ioBroker.ai-toolbox

[![NPM version](https://img.shields.io/npm/v/iobroker.ai-toolbox.svg)](https://www.npmjs.com/package/iobroker.ai-toolbox)
[![Downloads](https://img.shields.io/npm/dm/iobroker.ai-toolbox.svg)](https://www.npmjs.com/package/iobroker.ai-toolbox)
![Number of Installations](https://iobroker.live/badges/ai-toolbox-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/ai-toolbox-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.ai-toolbox.png?downloads=true)](https://nodei.co/npm/iobroker.ai-toolbox/)

**Tests:** ![Test and Release](https://github.com/ToGe3688/ioBroker.ai-toolbox/workflows/Test%20and%20Release/badge.svg)

# AI Toolbox for ioBroker

The ioBroker AI Toolbox Adapter is a powerful integration that enables users to create and manage custom AI tools based on LLMs within their ioBroker smart home environment. This adapter supports multiple providers of Large Language Models (LLMs) and a flexible framework for AI-based automation and interaction.


## Features

- Supports multiple AI providers and models
- Handles chat history for better context in conversations
- Retries failed requests up to a configurable maximum
- Provides statistics on token usage and request history

### AI/LLM Providers

The adapter supports the following AI providers:

- Anthropic (https:/anthropic.com)
- OpenAI (https://openai.com)
- Perplexity  (https://perplexity.ai)
- OpenRouter (https://openrouter.ai) **<- Provides access to free usage models, perfect to get started and playing arround!**
- Custom / Selfhosted Models (e.g. LM Studio / LocalAI) 
# Installation

**After installation, you need to configure the adapter in the ioBroker admin interface. The configuration includes setting up the AI providers and their respective API tokens. For every provider you can define which models should be available to use in your tools.**

# Configuration

## General Settings
**This settings will apply to all your defined tools.**

**Retry Delay**: Delay between tries to fulfill requests.

**Maximum Retries**: Max number of tries to fulfill a request.

## Tools
**A tool is a custom AI you are forming by text input to fulfill your desired action. Tools can be used for a wide range of applications from personalized text reports, formatting random data, chat bots, personal assistants. Your imagination is the limit.**

**Name**: Name for the Tool you want to create
 
**Model**: Which LLM Model should be used for this tool. You can select all models you have setup under the providers.

**System Prompt**: The system prompt which should contain all relevant information that describes the tool. Be as specific as possible.

**Example Request (Optional)**: Example for a request you are going to send to the tool.

**Example Response (Needed if Example Request defined)**: An example for your desired perfect answer to the defined example request.

**Message History**: If greater than 0, previous messages will be included in the request so the tool will stay in context. This can be used to get a chat bot like experience for the tool. For single use tools this should be kept at 0 to reduce token usage.

**Temperature**: Setting for creativity/consistency of the model's response.

**Max. Tokens**: Limit the response of the tool to your desired amount of tokens.

## LLM Providers

### Anthropic

**API Token**: Please enter your Anthropic API Token to start using models like Opus, Haiku, and Sonnet.

**Models**: Specify the models you want to use with Anthropic.

### OpenAI

**API Token**: Please enter your OpenAI API Token to start using models like Gpt4, Gpt4-o1, and Gpt3-5.
 
**Models**: Specify the models you want to use with OpenAI.

### Perplexity

**API Token**: Please enter your Perplexity API Token to start using the models.

**Models**: Specify the models you want to use with Perplexity.

### Openrouter

**API Token**: Please enter your Openrouter API Token to start using the models.

**Models**: Specify the models you want to use with Openrouter.

### Custom

**URL for Inference Server**: URL for your custom or self-hosted inference server.

**API Token for Inference Server**: API Token for your custom or self-hosted inference server.

**Models**: Specify the models you want to use with your custom inference server.

**Custom API has to follow the standards used by common AI LLM interfaces. See for example the documentation of LM Studio API!**


# Using your tools

## Usage with Objects

Once configured, the adapter will create objects for each tool in the ioBroker object tree. 
You can interact with the tool by setting the `.text_request` state. 
The response from the tool will be available in the `.text_response` state.

## Usage with sendTo

You can also use your created tools with sendTo in Adapters like Javascript and retrieve the result of the tool request. You have to define the following parameters in your "send" call:

**tool**: The name of the ai tool you want to use

**text**: The text you want the tool to respond to

Example:
```
sendTo('ai-toolbox.0', 'send', {
        'tool': 'YOUR-TOOL-NAME',
        'text': 'The message for the tool to respond to',
    }, async (result) => {
        // result contains the text response
        console.info(result);
});
```


You will find additional information for your request in the following datapoints:

### Statistics

**.statistics.lastRequest**: Datetime of last request for the tool

**.statistics.messages**: A json object containing an array of the message history. (Will only be set if you defined Message History > 0)

**.statistics.tokens_input**: Total used input/prompt tokens for the tool

**.statistics.tokens_output**: Total used output tokens for the tool

**.statistics.clear_messages**: Use this button to clear the message history

### Request

**.request.body**: Body of the request sent to the API

**.request.state**: State of the request


### Response

**.request.error**: Will be set if an error occurs during the request

**.request.raw**: RAW JSON response of the used model


## Development

### Debugging

To enable debugging, set the log level to `debug` in the ioBroker admin interface.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Changelog
0.0.1 - 2024-01-01 (ToGe3688) initial release


## License
MIT License

Copyright (c) 2024 Tobias Geier <toge3688@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.