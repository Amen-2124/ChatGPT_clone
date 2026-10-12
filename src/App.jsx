import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar/Sidebar';
import ChatHeader from './components/ChatHeader/ChatHeader';
import MessageList from './components/MessageList/MessageList';
import ChatInput from './components/ChatInput/ChatInput';
import './App.css';

// Express Backend Base API URL
const API_BASE_URL = 'http://localhost:3888/api';

function App() {
  // State to hold the array of chat conversations
  const [conversations, setConversations] = useState([]);
  
  // State to track loading status while waiting for backend response
  const [isLoading, setIsLoading] = useState(false);
  
  // Reference for automatic smooth scrolling to the latest message
  const messagesEndRef = useRef(null);

  // Helper function to scroll to the bottom of the chat view
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch initial chat history on initial component load
  useEffect(() => {
    fetchConversations();
  }, []);

  // Auto scroll down whenever conversations list updates or loading state changes
  useEffect(() => {
    scrollToBottom();
  }, [conversations, isLoading]);

  // Fetch existing conversations from the backend
  const fetchConversations = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/chat/conversations`);
      
      // Safely access data structure and ensure it defaults to an array
      const fetchedData = response.data?.data?.conversations || response.data?.conversations;
      
      if (Array.isArray(fetchedData)) {
        setConversations(fetchedData);
      } else {
        setConversations([]);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
    }
  };

  // Handler function for sending user prompt/question
  const handleSendMessage = async (question) => {
    // Prevent empty or whitespace-only message submission
    if (!question || !question.trim()) return;

    // 1. Optimistically display user message in UI immediately
    const tempUserMessage = {
      id: Date.now(),
      role: 'user',
      content: question,
    };

    setConversations((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      return [...safePrev, tempUserMessage];
    });

    // Set loading indicator
    setIsLoading(true);

    try {
      // POST user prompt to backend API
      const response = await axios.post(`${API_BASE_URL}/chat/conversations`, {
        question,
      });

      // Extract response payload safely
      const resPayload = response.data?.data || response.data;
      const userConv = resPayload?.userConversation;
      const assistantConv = resPayload?.assistantConversation;

      // Replace optimistic state with official response messages from server
      if (userConv && assistantConv) {
        setConversations((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          const filtered = safePrev.filter((msg) => msg.id !== tempUserMessage.id);
          return [...filtered, userConv, assistantConv];
        });
      } else {
        throw new Error('Invalid or unexpected response payload structure from backend.');
      }
    } catch (error) {
      console.error('Error sending message:', error);

      let errorMessage = 'Failed to generate a response. Please try again in a few moments.';

      // 2. Comprehensive error message extraction and handling
      if (error.response) {
        // Server responded with an HTTP error status code (4xx / 5xx)
        const serverData = error.response.data;
        const rawMessage = serverData?.message || serverData?.error;

        if (typeof rawMessage === 'string') {
          try {
            const parsed = JSON.parse(rawMessage);
            errorMessage = parsed?.error?.message || parsed?.message || rawMessage;
          } catch {
            errorMessage = rawMessage;
          }
        } else if (typeof rawMessage === 'object' && rawMessage !== null) {
          errorMessage = rawMessage.message || JSON.stringify(rawMessage);
        }

        // Friendly error message mapping for Gemini API fetch failures
        if (errorMessage.includes('fetch failed')) {
          errorMessage = 'Unable to connect to AI server. Please check your internet connection or server DNS.';
        }
      } else if (error.request) {
        // Backend server is down or unreachable
        errorMessage = 'Unable to connect to Express backend server (http://localhost:3888).';
      } else if (error.message) {
        errorMessage = error.message;
      }

      // 3. Render error message inside chat as an assistant message item
      const errorConversation = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `⚠️ ${errorMessage}`,
        isError: true,
      };

      setConversations((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return [...safePrev, errorConversation];
      });
    } finally {
      // Reset loading state
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      {/* Sidebar navigation component */}
      <Sidebar />

      <main className="chat">
        {/* Chat header area */}
        <ChatHeader />

        {/* Message feed rendering list */}
        <MessageList
          conversations={conversations}
          isLoading={isLoading}
          messagesEndRef={messagesEndRef}
        />

        {/* User input prompt area */}
        <ChatInput
          handleSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
      </main>
    </div>
  );
}

export default App;