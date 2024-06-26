import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx"; // Import the new Navbar component
import Index from "./pages/Index.jsx";
import TimeTracking from "./pages/TimeTracking.jsx";
import TaskManagement from "./pages/TaskManagement.jsx";
import AIAnalysis from "./pages/AIAnalysis.jsx";
import ServerlessFunctions from "./pages/ServerlessFunctions.jsx";

function App() {
  return (
    <Router>
      <Navbar /> {/* Add the Navbar component here */}
    
      <Routes>
        <Route exact path="/" element={<Index />} />
        <Route path="/time-tracking" element={<TimeTracking />} />
        <Route path="/task-management" element={<TaskManagement />} />
        <Route path="/ai-analysis" element={<AIAnalysis />} />
        <Route path="/serverless-functions" element={<ServerlessFunctions />} />
      </Routes>
    </Router>
  );
}

export default App;
