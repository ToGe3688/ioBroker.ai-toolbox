![Logo](admin/ai-toolbox.png)
# ioBroker.ai-toolbox

[![NPM version](https://img.shields.io/npm/v/iobroker.ai-toolbox.svg)](https://www.npmjs.com/package/iobroker.ai-toolbox)
[![Downloads](https://img.shields.io/npm/dm/iobroker.ai-toolbox.svg)](https://www.npmjs.com/package/iobroker.ai-toolbox)
![Number of Installations](https://iobroker.live/badges/ai-toolbox-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/ai-toolbox-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.ai-toolbox.png?downloads=true)](https://nodei.co/npm/iobroker.ai-toolbox/)

**Tests:** ![Test and Release](https://github.com/ToGe3688/ioBroker.ai-toolbox/workflows/Test%20and%20Release/badge.svg)

## Overview

The ioBroker AI Toolbox Adapter integrates customizable AI tools into your smart home. It supports multiple Large Language Model (LLM) providers and provides a flexible framework for automation and interaction. By combining real-time data from smart home devices, with AI capabilities, the ioBroker AI Toolbox Adapter can create highly personalized and useful tools for your household automation tasks.

## Features

- Multiple AI providers and models support.
- Chat history management for context retention.
- Configurable retries for failed requests.
- Token usage and request history statistics.

## Supported Providers

- **Anthropic**: [anthropic.com](https://anthropic.com)  
- **OpenAI**: [openai.com](https://openai.com)  
- **Perplexity**: [perplexity.ai](https://perplexity.ai)  
- **OpenRouter**: [openrouter.ai](https://openrouter.ai) (Free usage models for beginners)  
- **Custom/Self-hosted Models** (e.g., LM Studio, LocalAI)  

---

## Quick Start
1. Install the adapter.
2. Get API Token from openrouter.ai
3. Configure the adapter with the API Token.
4. The Example tools created at installation use the free model meta-llama/llama-3.2-3b-instruct:free for OpenRouter.
5. Send a message to the tool with the .text_request datapoint and check .text_response for the response.

Please note the free models sometimes have a long wait time for the first response, may be overloaded or have other limitations. Models also vary in quality and capabilities, make sure to select the right model for your use case.

---

## Configuration

### General Settings

These settings apply globally to all defined tools:

| **Setting**         | **Description**                     |
|----------------------|-------------------------------------|
| **Retry Delay**      | Delay between retry attempts.       |
| **Maximum Retries**  | Maximum number of retries per request. |

---

### Tools

Define custom AI tools tailored to specific tasks:

| **Setting**           | **Description**                                                                                                                                 |
|-----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| **Name**              | The tool's name.                                                                                                                               |
| **Model**             | Select the LLM model (configured under providers).                                                                                             |
| **System Prompt**     | Provide detailed information describing the tool.                                                                                              |
| **Example Request**   | (Optional) A sample request.                                                                                                                   |
| **Example Response**  | (Required if an example request is provided) The ideal response.                                                                               |
| **Message History**   | Include prior messages (for chatbot-like behavior). Set to 0 for single-use tools to minimize token usage.                                     |
| **Temperature**       | Controls response creativity/consistency.                                                                                                      |
| **Max. Tokens**       | Limits the response token count.                                                                                                               |

---

### LLM Providers

Configure each AI provider individually:

#### Anthropic

| **Setting**     | **Description**                              |
|-----------------|----------------------------------------------|
| **API Token**   | Enter your Anthropic API token.              |
| **Models**      | Specify the models to use.                   |

#### OpenAI

| **Setting**     | **Description**                              |
|-----------------|----------------------------------------------|
| **API Token**   | Enter your OpenAI API token.                 |
| **Models**      | Specify the models to use.                   |

#### Perplexity

| **Setting**     | **Description**                              |
|-----------------|----------------------------------------------|
| **API Token**   | Enter your Perplexity API token.             |
| **Models**      | Specify the models to use.                   |

#### OpenRouter

| **Setting**     | **Description**                              |
|-----------------|----------------------------------------------|
| **API Token**   | Enter your OpenRouter API token.             |
| **Models**      | Specify the models to use.                   |

#### Custom

| **Setting**                        | **Description**                                                                  |
|------------------------------------|----------------------------------------------------------------------------------|
| **Inference Server URL**           | URL of the custom/self-hosted inference server.                                  |
| **API Token for Inference Server** | API token for your inference server.                                             |
| **Models**                         | Specify the models to use.                                                      |
| **Note**                           | Ensure compliance with common AI LLM API standards (e.g., LM Studio API).       |

---

## Using Your Tools

### Object Interaction

Each tool appears in the ioBroker object tree.  
Use `.text_request` to send queries and `.text_response` to retrieve answers.

### Script Integration (`sendTo`)

You can interact programmatically using the `sendTo` function:

```javascript
sendTo('ai-toolbox.0', 'send', {
    'tool': 'YOUR-TOOL-NAME',
    'text': 'The message for the tool to respond to',
}, async (result) => {
    console.info(result); // Outputs the tool's response
});
```

---

## Additional Information

### Statistics

| **Datapoint**               | **Description**                                                             |
|-----------------------------|-----------------------------------------------------------------------------|
| **.statistics.lastRequest** | Timestamp of the last request.                                              |
| **.statistics.messages**    | JSON array of message history (if message history > 0).                     |
| **.statistics.tokens_input**| Total input tokens used.                                                    |
| **.statistics.tokens_output**| Total output tokens used.                                                  |
| **.statistics.clear_messages**| Clear message history button.                                             |

### Request

| **Datapoint**       | **Description**                               |
|---------------------|-----------------------------------------------|
| **.request.body**   | Request body sent to the API.                 |
| **.request.state**  | Current state of the request.                 |

### Response

| **Datapoint**      | **Description**                                  |
|--------------------|--------------------------------------------------|
| **.request.error** | Populated if an error occurs.                    |
| **.request.raw**   | Raw JSON response from the model.                |

---


## Examples

The following examples demonstrate how to configure and use customized AI tools within the ioBroker AI Toolbox Adapter. These examples showcase how the adapter can leverage data to provide intelligent responses and recommendations.

---

### Example 1: Music Suggestion Assistant
**Description:** Recommends music playlists based on the current weather and time of day. Can be used with a smart speaker like Alexa or Google Home.

- **Name:** `music-recommender`
- **System Prompt:**  
  `"You are a music assistant. Based on the current weather and time of day, suggest a playlist or genre that matches the mood. Use concise and creative recommendations. You answer only with your suggestion and nothing else."`
- **Example Request:**  
  `"Current Time 24th December 2024 17:30. Outside Temperature: 10°C."`
- **Example Response:**  
  `"Christmas Music"`
- **Message History:** `7` (We use a value of 7 because we are going to trigger this example tool once a day and dont want it to repeat its answers. With this setting it will see what it suggested in the last 7 responses to our requests.)
- **Temperature:** `0.7` (Balances creativity and relevance)

**Examples for a request and response to this tool could look like this:**

| **Request**      | **Response**                                  |
|--------------------|--------------------------------------------------|
| `Current time 3rd June 2024 16:00. Outside Temperature: 31°C` | `Latin Summer Music`  |
| `Current time 4th February 2024 20:00. Outside Temperature: 5°C` | `Jazz Music`  |
| `Current time 11th November 2024 12:00. Outside Temperature: 15°C` | `Acoustic Guitar Music`  |

Here is an example of a tool that recommends light settings based on the current playing music and outputs JSON with RGB hex values for five different RGB lights:

---

### Example 2: Light Settings Recommender

**Description:** Recommends RGB light settings based on the mood and genre of the currently playing music. The tool analyzes the music's characteristics (e.g., tempo, mood) and suggests appropriate lighting colors for five RGB lights. Outputs JSON with RGB hex values for each light.

- **Name:** `light-setter`

- **System Prompt:**

  `"You are a smart home assistant. Based on the characteristics of the currently playing music, recommend RGB hex color values for five different lights to create an immersive atmosphere. Respond only with a JSON object containing the RGB hex values for each light."`

- **Example Request:**

  ```
  Faithless - Insomnia
  ```

- **Example Response:**

  ```json
  {
    "light1": "#FF4500",
    "light2": "#FFA500",
    "light3": "#FFFF00",
    "light4": "#ADFF2F",
    "light5": "#00FF00"
  }
  ```

- **Message History:** `0` (Single-use tool to minimize token usage.)

- **Temperature:** `0.6` (Balances creativity and consistency.)

---

### Example Requests and Responses

| **Request**                                                                                     | **Response**                                                                                                                                              |
|-------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `The Beatles - Here Comes The Sun`                                                             | `{ "light1": "#FFD700", "light2": "#FFA500", "light3": "#FF8C00", "light4": "#FF4500", "light5": "#FF0000" }`                                             |
| `Beethoven - Symphony No. 9`                                                                   | `{ "light1": "#FF0000", "light2": "#FF4500", "light3": "#FFA500", "light4": "#FFD700", "light5": "#FFFF00" }`                                             |
| `Mozart - Eine kleine Nachtmusik`                                                              | `{ "light1": "#FFD700", "light2": "#FFA500", "light3": "#FF8C00", "light4": "#FF4500", "light5": "#FF0000" }`                                             |

---

### Script Integration Example

To use this tool programmatically in ioBroker, you can integrate it via the `sendTo` function:

```javascript
sendTo('ai-toolbox.0', 'send', {
  tool: 'light-setter',
  text: 'Faithless - Insomnia',
}, async (result) => {
  console.info(result); // Outputs the recommended RGB hex values for the lights
});
```

This tool can be further customized by adjusting parameters such as temperature or system prompts to fine-tune its behavior.

---


## Development

### Debugging

Set the log level to `debug` in the ioBroker admin interface for detailed logs.

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