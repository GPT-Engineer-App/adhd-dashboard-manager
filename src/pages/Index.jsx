import { Container, Text, VStack, Heading, Box, Button, IconButton } from "@chakra-ui/react";
import { FaTasks, FaClock, FaBrain, FaServer } from "react-icons/fa";

const Index = () => {
  return (
    <Container centerContent maxW="container.md" height="100vh" display="flex" flexDirection="column" justifyContent="center" alignItems="center">
      <VStack spacing={8}>
        <Heading as="h1" size="2xl">ADHD Management Dashboard</Heading>
        <Text fontSize="lg">Your one-stop solution for managing ADHD effectively.</Text>
        <Box>
          <VStack spacing={4}>
            <Button leftIcon={<FaClock />} colorScheme="teal" variant="solid" size="lg">
              Time Tracking
            </Button>
            <Button leftIcon={<FaTasks />} colorScheme="teal" variant="solid" size="lg">
              Task Management
            </Button>
            <Button leftIcon={<FaBrain />} colorScheme="teal" variant="solid" size="lg">
              AI Analysis
            </Button>
            <Button leftIcon={<FaServer />} colorScheme="teal" variant="solid" size="lg">
              Serverless Functions
            </Button>
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
};

export default Index;