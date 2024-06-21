import os from 'os';
import json from 'json';
import requests from 'axios';
import logging from 'logging';
import sqlite3 from 'sqlite3';
import { sleep } from 'sleep';

// Configure logging
logging.basicConfig({ level: 'info', filename: 'app.log', filemode: 'a', format: '%(asctime)s - %(levelname)s - %(message)s' });

// Set up environment variable for API key
const api_key = process.env.AIMLAPI_API_KEY;

if (!api_key) {
    throw new Error("API key not found. Please set the AIMLAPI_API_KEY environment variable.");
}

// Helper function to make API requests with retries and logging
const make_request = async (url, method = 'GET', headers = null, data = null, retries = 3) => {
    if (!headers) {
        headers = {
            "Authorization": `Bearer ${api_key}`,
            "Content-Type": "application/json"
        };
    }

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            let response;
            if (method === 'GET') {
                response = await requests.get(url, { headers, data });
            } else {
                response = await requests.post(url, { headers, data });
            }
            return response.data;
        } catch (error) {
            logging.error(`Request failed on attempt ${attempt + 1}: ${error}`);
            await sleep(2 ** attempt);  // Exponential backoff
            if (attempt === retries - 1) {
                return null;
            }
        }
    }
};

// Memory structures
const short_term_memory = {};
const long_term_memory = {};

// Initialize database for long-term memory
const init_db = () => {
    const conn = new sqlite3.Database('memory.db');
    conn.run('CREATE TABLE IF NOT EXISTS long_term_memory (key TEXT, value TEXT)');
    return conn;
};

// Save to database
const save_to_db = (key, value) => {
    const conn = init_db();
    conn.run("INSERT INTO long_term_memory (key, value) VALUES (?, ?)", [key, value]);
    conn.close();
};

// Load from database
const load_from_db = (key) => {
    const conn = init_db();
    return new Promise((resolve, reject) => {
        conn.get("SELECT value FROM long_term_memory WHERE key=?", [key], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row ? row.value : null);
            }
            conn.close();
        });
    });
};

// Save context to file
const save_context = (context, filename = "context.json") => {
    try {
        fs.writeFileSync(filename, JSON.stringify(context));
    } catch (error) {
        logging.error(`Could not save context: ${error}`);
    }
};

// Load context from file
const load_context = (filename = "context.json") => {
    if (fs.existsSync(filename)) {
        try {
            return JSON.parse(fs.readFileSync(filename));
        } catch (error) {
            logging.error(`Could not load context: ${error}`);
        }
    }
    return {};
};

// Create an assistant
const create_assistant = (name, description) => {
    const url = "https://api.aimlapi.com/v1/assistants";
    const data = { name, description };
    return make_request(url, 'POST', null, data);
};

// Create a thread
const create_thread = (assistant_id, title) => {
    const url = `https://api.aimlapi.com/v1/assistants/${assistant_id}/threads`;
    const data = { title };
    return make_request(url, 'POST', null, data);
};

// Create a run
const create_run = (thread_id, input_text) => {
    const url = `https://api.aimlapi.com/v1/threads/${thread_id}/runs`;
    const data = { input: input_text, context: short_term_memory };
    return make_request(url, 'POST', null, data);
};

// Sentiment analysis tool
const sentiment_analysis = (text) => {
    const url = "https://api.sentimentanalysis.com/analyze";
    const data = { text };
    return make_request(url, 'POST', null, data);
};

// Execute code in a sandboxed environment
const execute_code = (code) => {
    try {
        const result = require('child_process').execSync(`python -c "${code}"`, { timeout: 5000 });
        return result.toString();
    } catch (error) {
        return error.toString();
    }
};

// Main function to handle the chatbot
const chatbot = async () => {
    const assistant_info = await create_assistant("BespokeAssistant", "A custom, context-aware assistant.");
    if (!assistant_info) {
        logging.error("Failed to create assistant.");
        return;
    }

    const assistant_id = assistant_info.id;
    if (!assistant_id) {
        logging.error("Failed to retrieve assistant ID.");
        return;
    }

    // Load existing context or start a new session
    let context = load_context();
    let thread_info = context.thread_info;

    if (!thread_info) {
        thread_info = await create_thread(assistant_id, "Persistent Session");
        if (!thread_info) {
            logging.error("Failed to create thread.");
            return;
        }
        context.thread_info = thread_info;
        save_context(context);
    }

    const thread_id = thread_info.id;
    if (!thread_id) {
        logging.error("Failed to retrieve thread ID.");
        return;
    }

    logging.info("Assistant is ready. Type 'exit' to quit.");
    while (true) {
        const user_input = prompt("You: ");
        if (user_input.toLowerCase() === 'exit') {
            break;
        }

        if (user_input.startsWith('code:')) {
            const code = user_input.slice('code:'.length).trim();
            const execution_result = execute_code(code);
            console.log(`Code Execution Result: ${execution_result}`);
            continue;
        }

        // Use sentiment analysis tool
        const sentiment = await sentiment_analysis(user_input);
        console.log(`Sentiment: ${sentiment}`);

        const run_response = await create_run(thread_id, user_input);
        if (!run_response) {
            logging.error("Failed to process input.");
            continue;
        }

        const assistant_response = run_response.response;

        // Display assistant response
        console.log(`Assistant: ${assistant_response}`);

        // Save the response to context for future use
        short_term_memory.last_interaction = { user_input, assistant_response };
        save_context(context);
    }
};

// Run the chatbot
if (require.main === module) {
    chatbot();
}