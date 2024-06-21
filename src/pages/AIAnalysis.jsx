import { useState } from "react";
import { Box, Heading, Text, Input, Button, VStack, Image } from "@chakra-ui/react";
import axios from "axios";
import { chatbot } from '../utils/aiAssistant';

const AIAnalysis = () => {
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [textAnalysisResult, setTextAnalysisResult] = useState(null);
  const [imageRecognitionResult, setImageRecognitionResult] = useState(null);

  const handleTextAnalysis = async () => {
    try {
      const response = await axios.post("https://api.aimlapi.com/text-analysis", { text }, {
        headers: {
          "Authorization": "Bearer YOUR_API_KEY"
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
          "Authorization": "Bearer YOUR_API_KEY"
        }
      });
      setImageRecognitionResult(response.data);
    } catch (error) {
      console.error("Error recognizing image:", error);
    }
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
        <Button onClick={chatbot} colorScheme="teal">Start Chatbot</Button>
      </VStack>
    </Box>
  );
};

export default AIAnalysis;