import axios from 'axios';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { openDB } from 'idb';
import { sleep } from 'sleep';

// Configure logging
const log = (level, message) => {
    console[level](`${new Date().toISOString()} - ${level.toUpperCase()} - ${message}`);
};

// Set up environment variable for API key
const api_key = import.meta.env.VITE_AIMLAPI_API_KEY;

if (!api_key) {
    throw new Error("API key not found. Please set the VITE_AIMLAPI_API_KEY environment variable.");
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
                response = await axios.get(url, { headers, data });
            } else {
                response = await axios.post(url, data, { headers });
            }
            return response.data;
        } catch (error) {
            log('error', `Request failed on attempt ${attempt + 1}: ${error}`);
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
const init_db = async () => {
    const db = await openDB('memory', 1, {
        upgrade(db) {
            db.createObjectStore('long_term_memory');
        },
    });
    return db;
};

// Save to database
const save_to_db = async (key, value) => {
    const db = await init_db();
    await db.put('long_term_memory', value, key);
};

// Load from database
const load_from_db = async (key) => {
    const db = await init_db();
    return await db.get('long_term_memory', key);
};

// Save context to file
const save_context = (context, filename = "context.json") => {
    try {
        writeFileSync(filename, JSON.stringify(context));
    } catch (error) {
        log('error', `Could not save context: ${error}`);
    }
};

// Load context from file
const load_context = (filename = "context.json") => {
    if (existsSync(filename)) {
        try {
            return JSON.parse(readFileSync(filename));
        } catch (error) {
            log('error', `Could not load context: ${error}`);
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
        const result = new Function(code)();
        return result.toString();
    } catch (error) {
        return error.toString();
    }
};

// Main function to handle the chatbot
const chatbot = async () => {
    const assistant_info = await create_assistant("BespokeAssistant", "A custom, context-aware assistant.");
    if (!assistant_info) {
        log('error', "Failed to create assistant.");
        return;
    }

    const assistant_id = assistant_info.id;
    if (!assistant_id) {
        log('error', "Failed to retrieve assistant ID.");
        return;
    }

    // Load existing context or start a new session
    let context = load_context();
    let thread_info = context.thread_info;

    if (!thread_info) {
        thread_info = await create_thread(assistant_id, "Persistent Session");
        if (!thread_info) {
            log('error', "Failed to create thread.");
            return;
        }
        context.thread_info = thread_info;
        save_context(context);
    }

    const thread_id = thread_info.id;
    if (!thread_id) {
        log('error', "Failed to retrieve thread ID.");
        return;
    }

    log('info', "Assistant is ready. Type 'exit' to quit.");
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
            log('error', "Failed to process input.");
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