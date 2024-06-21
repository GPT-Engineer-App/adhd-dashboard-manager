import { useState, useEffect } from "react";
import { Box, Heading, Text, Input, Button, VStack, Image } from "@chakra-ui/react";
import axios from "axios";

// Helper function to make API requests with retries and logging
const makeRequest = async (url, method = 'GET', headers = {}, data = null, retries = 3) => {
  headers = {
    "Authorization": `Bearer ${process.env.REACT_APP_AIMLAPI_API_KEY}`,
    "Content-Type": "application/json",
    ...headers
  };

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
  return await makeRequest(url, 'POST', {}, data);
};

// Create a thread
const createThread = async (assistantId, title) => {
  const url = `https://api.aimlapi.com/v1/assistants/${assistantId}/threads`;
  const data = { title };
  return await makeRequest(url, 'POST', {}, data);
};

// Create a run
const createRun = async (threadId, inputText) => {
  const url = `https://api.aimlapi.com/v1/threads/${threadId}/runs`;
  const data = { input: inputText, context: shortTermMemory };
  return await makeRequest(url, 'POST', {}, data);
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

  useEffect(() => {
    const initializeAssistant = async () => {
      const assistantInfo = await createAssistant("BespokeAssistant", "A custom, context-aware assistant.");
      if (!assistantInfo) {
        console.error("Failed to create assistant.");
        return;
      }

      const assistantId = assistantInfo.id;
      if (!assistantId) {
        console.error("Failed to retrieve assistant ID.");
        return;
      }

      let context = loadContext();
      let threadInfo = context.threadInfo;

      if (!threadInfo) {
        threadInfo = await createThread(assistantId, "Persistent Session");
        if (!threadInfo) {
          console.error("Failed to create thread.");
          return;
        }
        context.threadInfo = threadInfo;
        saveContext(context);
      }
    };

    initializeAssistant();
  }, []);

  const handleTextAnalysis = async () => {
    try {
      const response = await axios.post("https://api.aimlapi.com/text-analysis", { text }, {
        headers: {
          "Authorization": `Bearer ${process.env.REACT_APP_AIMLAPI_API_KEY}`
        }
      });
      setTextAnalysisResult(response.data);
    } catch (error) {
      console.error("Error analyzing text:", error);
    }
  };

  const handleImageRecognition = async () => {
    try {
      const response = await axios.post("https://api.aimlapi.com/image-recognition", { imageUrl }, {
        headers: {
          "Authorization": `Bearer ${process.env.REACT_APP_AIMLAPI_API_KEY}`
        }
      });
      setImageRecognitionResult(response.data);
    } catch (error) {
      console.error("Error recognizing image:", error);
    }
  };

  const handleUserInput = async (userInput) => {
    if (userInput.startsWith('code:')) {
      const code = userInput.slice(5).trim();
      const executionResult = executeCode(code);
      setAssistantResponse(`Code Execution Result: ${executionResult}`);
      return;
    }

    const sentimentResult = await sentimentAnalysis(userInput);
    setSentiment(sentimentResult);

    const context = loadContext();
    const threadId = context.threadInfo.id;

    const runResponse = await createRun(threadId, userInput);
    if (!runResponse) {
      console.error("Failed to process input.");
      return;
    }

    const assistantResponse = runResponse.response;
    setAssistantResponse(assistantResponse);

    // Save the response to context for future use
    shortTermMemory.lastInteraction = { userInput, assistantResponse };
    saveContext(context);
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
          <Button onClick={handleTextAnalysis} colorScheme="teal">Analyze Text</Button>
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
          <Button onClick={handleImageRecognition} colorScheme="teal">Recognize Image</Button>
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
      </VStack>
    </Box>
  );
};

export default AIAnalysis;