import { useState, useEffect } from "react";
import { Box, Heading, Text, Input, Button, VStack, Image, Spinner } from "@chakra-ui/react";
import axios from "axios";
import { WebSocket } from 'ws';
import nlp from 'compromise';
import compromiseNER from 'compromise-numbers';

// Helper function to make API requests with retries and logging
const makeRequest = async (url, method = 'GET', headers = {}, data = null, retries = 3) => {
  headers = {
    "Authorization": `Bearer ${process.env.REACT_APP_AIMLAPI_API_KEY}`,
    "Content-Type": "application/json",
    ...headers
  };

  if (!process.env.REACT_APP_AIMLAPI_API_KEY) {
    console.error("API key is not set.");
    return null;
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = method === 'GET' ? await axios.get(url, { headers, data }) : await axios.post(url, data, { headers });
      return response.data;
    } catch (error) {
      console.error(`Request failed on attempt ${attempt + 1}:`, error);
      await new Promise(resolve => setTimeout(resolve, 2 ** attempt * 1000)); // Exponential backoff
      if (attempt === retries - 1) {
        return null;
      }
    }
  }
};

// Memory structures
const shortTermMemory = {};
const longTermMemory = {};

// Save context to local storage
const saveContext = (context) => {
  try {
    localStorage.setItem("context", JSON.stringify(context));
  } catch (e) {
    console.error("Could not save context:", e);
  }
};

// Load context from local storage
const loadContext = () => {
  try {
    const context = localStorage.getItem("context");
    return context ? JSON.parse(context) : {};
  } catch (e) {
    console.error("Could not load context:", e);
    return {};
  }
};

// Create an assistant
const createAssistant = async (name, description) => {
  const url = "https://api.aimlapi.com/v1/assistants";
  const data = { name, description };
  const response = await makeRequest(url, 'POST', {}, data);
  if (!response) {
    console.error("Failed to create assistant.");
    return null;
  }
  return response;
};

// Create a thread
const createThread = async (assistantId, title) => {
  const url = `https://api.aimlapi.com/v1/assistants/${assistantId}/threads`;
  const data = { title };
  const response = await makeRequest(url, 'POST', {}, data);
  if (!response) {
    console.error("Failed to create thread.");
    return null;
  }
  return response;
};

// Create a run
const createRun = async (threadId, inputText) => {
  const url = `https://api.aimlapi.com/v1/threads/${threadId}/runs`;
  const data = { input: inputText, context: shortTermMemory };
  const response = await makeRequest(url, 'POST', {}, data);
  if (!response) {
    console.error("Failed to create run.");
    return null;
  }
  return response;
};

// Sentiment analysis tool
const sentimentAnalysis = async (text) => {
  const url = "https://api.sentimentanalysis.com/analyze";
  const data = { text };
  return await makeRequest(url, 'POST', {}, data);
};

// Execute code in a sandboxed environment
const executeCode = (code) => {
  try {
    // Using eval is dangerous and should be avoided in production
    // This is just for demonstration purposes
    return eval(code);
  } catch (e) {
    return e.toString();
  }
};

const AIAnalysis = () => {
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [textAnalysisResult, setTextAnalysisResult] = useState(null);
  const [imageRecognitionResult, setImageRecognitionResult] = useState(null);
  const [assistantResponse, setAssistantResponse] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [loadingTextAnalysis, setLoadingTextAnalysis] = useState(false);
  const [loadingImageRecognition, setLoadingImageRecognition] = useState(false);
  const [loadingUserInput, setLoadingUserInput] = useState(false);
  const [error, setError] = useState("");
  const [socket, setSocket] = useState(null);
  const [customModel, setCustomModel] = useState(null);
  const [analysisParameters, setAnalysisParameters] = useState({});

  useEffect(() => {
    const ws = new WebSocket('ws://your-websocket-url');
    ws.onopen = () => console.log('WebSocket connection opened');
    ws.onmessage = (event) => handleWebSocketMessage(event);
    ws.onerror = (error) => console.error('WebSocket error:', error);
    ws.onclose = () => console.log('WebSocket connection closed');
    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  const handleWebSocketMessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'textAnalysis') {
      setTextAnalysisResult(data.result);
    } else if (data.type === 'imageRecognition') {
      setImageRecognitionResult(data.result);
    }
  };

  const handleTextAnalysis = () => {
    if (!text) {
      setError("Text input cannot be empty.");
      return;
    }
    setLoadingTextAnalysis(true);
    setError("");
    socket.send(JSON.stringify({ type: 'textAnalysis', text }));
  };

  const handleImageRecognition = () => {
    if (!imageUrl) {
      setError("Image URL cannot be empty.");
      return;
    }
    setLoadingImageRecognition(true);
    setError("");
    socket.send(JSON.stringify({ type: 'imageRecognition', imageUrl }));
  };

  const performAdvancedNLP = (text) => {
    const doc = nlp(text).use(compromiseNER);
    const entities = doc.entities().out('array');
    return entities;
  };

  const handleUserInput = async (userInput) => {
    if (!userInput) {
      setError("User input cannot be empty.");
      return;
    }
    setLoadingUserInput(true);
    setError("");
    if (userInput.startsWith('code:')) {
      const code = userInput.slice(5).trim();
      const executionResult = executeCode(code);
      setAssistantResponse(`Code Execution Result: ${executionResult}`);
      setLoadingUserInput(false);
      return;
    }

    try {
      const sentimentResult = await sentimentAnalysis(userInput);
      setSentiment(sentimentResult);

      const entities = performAdvancedNLP(userInput);
      setTextAnalysisResult({ sentiment: sentimentResult, entities });

      const context = loadContext();
      const threadId = context.threadInfo.id;

      const runResponse = await createRun(threadId, userInput);
      if (!runResponse) {
        console.error("Failed to process input.");
        setError("Failed to process input.");
        return;
      }

      const assistantResponse = runResponse.response;
      setAssistantResponse(assistantResponse);

      // Save the response to context for future use
      shortTermMemory.lastInteraction = { userInput, assistantResponse };
      saveContext(context);
    } catch (error) {
      handleError(error);
    } finally {
      setLoadingUserInput(false);
    }
  };

  const handleCustomModelUpload = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => setCustomModel(e.target.result);
    reader.readAsText(file);
  };

  const handleParameterChange = (param, value) => {
    setAnalysisParameters((prevParams) => ({ ...prevParams, [param]: value }));
  };

  const handleError = (error) => {
    console.error("Error:", error);
    setError(`An error occurred: ${error.message}. Please try again or contact support if the issue persists.`);
  };

  return (
    <Box p={4}>
      <Heading as="h2" size="xl" mb={4}>AI Analysis</Heading>
      <VStack spacing={4} align="stretch">
        <Box>
          <Heading as="h3" size="lg" mb={2}>Text Analysis</Heading>
          <Input
            placeholder="Enter text for analysis"
            value={text}
            onChange={(e) => setText(e.target.value)}
            mb={2}
          />
          <Button onClick={handleTextAnalysis} colorScheme="teal" isLoading={loadingTextAnalysis}>Analyze Text</Button>
          {textAnalysisResult && (
            <Box mt={4}>
              <Heading as="h4" size="md">Analysis Result:</Heading>
              <Text>{JSON.stringify(textAnalysisResult, null, 2)}</Text>
            </Box>
          )}
        </Box>
        <Box>
          <Heading as="h3" size="lg" mb={2}>Image Recognition</Heading>
          <Input
            placeholder="Enter image URL for recognition"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            mb={2}
          />
          <Button onClick={handleImageRecognition} colorScheme="teal" isLoading={loadingImageRecognition}>Recognize Image</Button>
          {imageRecognitionResult && (
            <Box mt={4}>
              <Heading as="h4" size="md">Recognition Result:</Heading>
              <Image src={imageUrl} alt="Analyzed" mb={2} />
              <Text>{JSON.stringify(imageRecognitionResult, null, 2)}</Text>
            </Box>
          )}
        </Box>
        <Box>
          <Heading as="h3" size="lg" mb={2}>Chat with Assistant</Heading>
          <Input
            placeholder="Enter your message"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleUserInput(e.target.value);
                e.target.value = '';
              }
            }}
            mb={2}
          />
          {loadingUserInput && <Spinner />}
          {assistantResponse && (
            <Box mt={4}>
              <Heading as="h4" size="md">Assistant Response:</Heading>
              <Text>{assistantResponse}</Text>
            </Box>
          )}
          {sentiment && (
            <Box mt={4}>
              <Heading as="h4" size="md">Sentiment:</Heading>
              <Text>{JSON.stringify(sentiment, null, 2)}</Text>
            </Box>
          )}
        </Box>
        <Box>
          <Heading as="h3" size="lg" mb={2}>Custom Model Upload</Heading>
          <Input type="file" onChange={handleCustomModelUpload} mb={2} />
          <Heading as="h3" size="lg" mb={2}>Analysis Parameters</Heading>
          <Input placeholder="Parameter 1" onChange={(e) => handleParameterChange('param1', e.target.value)} mb={2} />
          <Input placeholder="Parameter 2" onChange={(e) => handleParameterChange('param2', e.target.value)} mb={2} />
        </Box>
        {error && (
          <Box mt={4}>
            <Text color="red.500">{error}</Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default AIAnalysis;