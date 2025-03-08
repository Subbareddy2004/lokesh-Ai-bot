import { useState, useEffect, useRef } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import styled from 'styled-components'
import { FaPaperPlane, FaRobot, FaUser, FaSpinner, FaHeartbeat, FaAppleAlt, FaRunning, FaWeight, FaClipboardList } from 'react-icons/fa'

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI("AIzaSyAQYqDoLrOFOmQwSkndVD7EFOPftGNMhqU");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Initial questions to ask the user
const initialQuestions = [
  "What's your name?",
  "What are your current health goals?",
  "Do you have any specific fitness routines you follow?",
  "How would you describe your current eating habits?",
  "Are there any specific health metrics you're trying to improve (weight, blood pressure, etc.)?"
];

// Helper function to format message content with improved styling
const formatBotMessage = (text) => {
  // Add formatting for bullet points
  return text
    .replace(/•/g, '◉') // Replace basic bullets with a nicer symbol
    .replace(/\*\*/g, '<b>') // Replace ** with bold tags for processing
    .replace(/\*\//g, '</b>'); // Close bold tags
};

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userProfile, setUserProfile] = useState({});
  const [chatPhase, setChatPhase] = useState('questions'); // 'questions', 'summary', 'followup'
  
  const chatContainerRef = useRef(null);

  // Start the conversation with the first question
  useEffect(() => {
    if (messages.length === 0 && currentQuestionIndex < initialQuestions.length) {
      setMessages([{ 
        text: initialQuestions[currentQuestionIndex], 
        sender: 'bot' 
      }]);
    }
  }, [currentQuestionIndex, messages.length]);

  // Auto-scroll to the bottom of the chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Enhanced generateResponse method with improved formatting request
  const generateResponse = async (userMessage, context = '') => {
    try {
      const systemPrompt = 
        "You are a helpful health assistant named HealthMate that helps users track their health goals. " +
        "Your responses should be focused ONLY on health topics including weight management, fitness routines, " +
        "nutritional intake, and general wellness advice. If asked about non-health topics, gently redirect " +
        "the conversation back to health. Be supportive, motivational, and provide science-backed information. " +
        "Format your responses with clear sections using '**Section Title:**' formatting for headings. " +
        "Use bullet points with '• ' for listing items (always start with this bullet format followed by a space). " +
        "When providing numbered recommendations, use numerical format like '1. ', '2. ' (with the period and space). " +
        "Use emoji appropriately for health topics (🏃‍♂️, 🥗, 💪, ❤️, etc.) to make responses engaging. " +
        "Structure your responses with clear sections, each having a title and content. " +
        "Keep responses conversational, well-organized, and personalized to the user's information.";
      
      const userContext = context ? 
        `USER CONTEXT: ${context}\n\nUser message: ${userMessage}` : 
        userMessage;
        
      const result = await model.generateContent([systemPrompt, userContext]);
      const response = await result.response;
      const text = response.text();
      return text;
    } catch (error) {
      console.error("Error generating response:", error);
      return "I'm having trouble connecting to my health database right now. Could you try again in a moment?";
    }
  };

  // Handle user messages
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage = input;
    setInput('');
    setMessages([...messages, { text: userMessage, sender: 'user' }]);
    setIsLoading(true);

    if (chatPhase === 'questions') {
      // Store user's answer in profile
      const currentQuestion = initialQuestions[currentQuestionIndex];
      setUserProfile(prev => ({
        ...prev,
        [currentQuestion]: userMessage
      }));

      // Move to next question or summary
      if (currentQuestionIndex < initialQuestions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setMessages(prev => [...prev, { 
          text: initialQuestions[currentQuestionIndex + 1], 
          sender: 'bot' 
        }]);
      } else {
        // Generate summary when all questions are answered
        setChatPhase('summary');
        const profile = {...userProfile, [currentQuestion]: userMessage};
        const profileSummary = Object.entries(profile)
          .map(([question, answer]) => `${question} ${answer}`)
          .join('\n');
          
        const summaryPrompt = 
          `Based on the following user information, provide a personalized health summary and recommendations:\n${profileSummary}\n` +
          `Include: 1) A brief summary of their health goals, 2) 2-3 personalized recommendations, and 3) A motivational message. ` +
          `End by asking if they have any specific health questions.`;
          
        const summary = await generateResponse(summaryPrompt);
        setMessages(prev => [...prev, { text: summary, sender: 'bot' }]);
        setChatPhase('followup');
      }
    } else if (chatPhase === 'followup') {
      // Handle follow-up questions based on user profile
      const profileContext = Object.entries(userProfile)
        .map(([question, answer]) => `${question.replace('?', '')}: ${answer}`)
        .join('; ');
        
      const response = await generateResponse(userMessage, profileContext);
      setMessages(prev => [...prev, { text: response, sender: 'bot' }]);
    }
    
    setIsLoading(false);
  };

  // Helper function to format message text with Markdown-like syntax
  const formatMessageText = (text) => {
    // Process bullet points first
    let formattedText = text;
    
    // Replace bullet points with styled elements
    const bulletPointRegex = /• (.*?)(?=\n• |\n\n|$)/gs;
    const bulletMatches = formattedText.match(bulletPointRegex);
    
    if (bulletMatches) {
      bulletMatches.forEach(match => {
        const bulletContent = match.slice(2); // Remove the "• " prefix
        formattedText = formattedText.replace(
          match,
          `<bullet>${bulletContent}</bullet>`
        );
      });
    }
    
    // Replace numbered list items
    const numberedListRegex = /(\d+)\. (.*?)(?=\n\d+\. |\n\n|$)/gs;
    const numberedMatches = formattedText.match(numberedListRegex);
    
    if (numberedMatches) {
      numberedMatches.forEach(match => {
        const number = match.match(/^\d+/)[0];
        const content = match.slice(number.length + 2); // Remove the "X. " prefix
        formattedText = formattedText.replace(
          match,
          `<numbered>${number}. ${content}</numbered>`
        );
      });
    }
    
    // Replace **Text** with bold spans
    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = boldRegex.exec(formattedText)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        const beforeText = formattedText.slice(lastIndex, match.index);
        parts.push(processTextWithTags(beforeText));
      }
      
      // Add the bold text
      parts.push(<BoldText key={`bold-${match.index}`}>{match[1]}</BoldText>);
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add any remaining text
    if (lastIndex < formattedText.length) {
      parts.push(processTextWithTags(formattedText.slice(lastIndex)));
    }
    
    return parts;
  };
  
  // Process text with custom tags
  const processTextWithTags = (text) => {
    // Process bullet points
    const bulletRegex = /<bullet>(.*?)<\/bullet>/gs;
    let processed = text;
    let result = [];
    let lastIndex = 0;
    let match;
    
    while ((match = bulletRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push(<span key={`text-${match.index}`}>{text.slice(lastIndex, match.index)}</span>);
      }
      
      result.push(
        <BulletPoint key={`bullet-${match.index}`}>
          <BulletIcon>●</BulletIcon>
          <span>{match[1]}</span>
        </BulletPoint>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add any remaining text
    if (lastIndex < text.length) {
      // Process numbered lists in the remaining text
      const numberedRegex = /<numbered>(.*?)<\/numbered>/gs;
      const remainingText = text.slice(lastIndex);
      let numberedResult = [];
      let numberedLastIndex = 0;
      
      while ((match = numberedRegex.exec(remainingText)) !== null) {
        if (match.index > numberedLastIndex) {
          numberedResult.push(
            <span key={`text-${lastIndex + match.index}`}>
              {remainingText.slice(numberedLastIndex, match.index)}
            </span>
          );
        }
        
        // Extract number and content
        const [numStr, content] = match[1].split('. ', 2);
        
        numberedResult.push(
          <NumberedItem key={`numbered-${lastIndex + match.index}`}>
            <NumberBadge>{numStr}</NumberBadge>
            <span>{content}</span>
          </NumberedItem>
        );
        
        numberedLastIndex = match.index + match[0].length;
      }
      
      if (numberedLastIndex < remainingText.length) {
        numberedResult.push(
          <span key={`text-${lastIndex + numberedLastIndex}`}>
            {remainingText.slice(numberedLastIndex)}
          </span>
        );
      }
      
      result = [...result, ...numberedResult];
    }
    
    return result.length > 0 ? result : <span>{text}</span>;
  };

  // Helper function to get an appropriate icon for a section
  const getSectionIcon = (sectionTitle) => {
    const title = sectionTitle.toLowerCase();
    if (title.includes('summary')) return <FaClipboardList />;
    if (title.includes('diet') || title.includes('nutrition') || title.includes('food')) return <FaAppleAlt />;
    if (title.includes('cardio') || title.includes('exercise') || title.includes('fitness')) return <FaRunning />;
    if (title.includes('weight')) return <FaWeight />;
    if (title.includes('motivational') || title.includes('remember')) return <FaHeartbeat />;
    return null;
  };

  return (
    <AppContainer>
      <ChatContainer>
        <Header>
          <HeaderLogo>
            <LogoIcon><FaHeartbeat /></LogoIcon>
            <HeaderTitle>HealthMate Assistant</HeaderTitle>
          </HeaderLogo>
          <HeaderSubtitle>Your personal health and wellness guide</HeaderSubtitle>
        </Header>
        
        <MessagesContainer ref={chatContainerRef}>
          {messages.map((message, index) => (
            <MessageWrapper key={index} sender={message.sender} className="fade-in">
              <MessageBubble sender={message.sender}>
                <MessageIcon sender={message.sender}>
                  {message.sender === 'bot' ? <FaRobot /> : <FaUser />}
                </MessageIcon>
                <MessageContent>
                  {message.sender === 'bot' ? (
                    <BotMessageText>
                      {formatMessageText(message.text)}
                    </BotMessageText>
                  ) : (
                    <MessageText>{message.text}</MessageText>
                  )}
                </MessageContent>
              </MessageBubble>
              <MessageTime>{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</MessageTime>
            </MessageWrapper>
          ))}
          {isLoading && (
            <MessageWrapper sender="bot" className="fade-in">
              <MessageBubble sender="bot">
                <MessageIcon sender="bot"><FaRobot /></MessageIcon>
                <MessageText><LoadingSpinner><FaSpinner /></LoadingSpinner> Thinking...</MessageText>
              </MessageBubble>
            </MessageWrapper>
          )}
        </MessagesContainer>
        
        <InputContainer>
          <MessageInput 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your message..."
          />
          <SendButton onClick={handleSendMessage} disabled={isLoading || !input.trim()}>
            <FaPaperPlane />
          </SendButton>
        </InputContainer>
      </ChatContainer>
    </AppContainer>
  )
}

// Styled Components
const AppContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4f1f9 100%);
  padding: 20px;
`;

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 800px;
  height: 90vh;
  background-color: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const Header = styled.div`
  background: linear-gradient(90deg, #43A047 0%, #2E7D32 100%);
  color: white;
  padding: 18px 24px;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: radial-gradient(circle at bottom right, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%);
    pointer-events: none;
  }
`;

const HeaderLogo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 24px;
`;

const LogoIcon = styled.div`
  background-color: white;
  color: #43A047;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
`;

const HeaderTitle = styled.h1`
  margin: 0;
  font-size: 1.6rem;
  font-weight: 600;
  letter-spacing: 0.5px;
`;

const HeaderSubtitle = styled.div`
  font-size: 0.9rem;
  opacity: 0.9;
  margin-top: 4px;
  margin-left: 48px;
  font-weight: 300;
`;

const MessagesContainer = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  background-color: #f9fafc;
`;

const MessageWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: ${props => props.sender === 'user' ? 'flex-end' : 'flex-start'};
  margin-bottom: 2px;
  position: relative;
  max-width: 85%;
  align-self: ${props => props.sender === 'user' ? 'flex-end' : 'flex-start'};
`;

const MessageBubble = styled.div`
  display: flex;
  max-width: 100%;
  padding: 14px 18px;
  border-radius: 18px;
  background-color: ${props => props.sender === 'user' ? '#E8F5E9' : '#ffffff'};
  border: ${props => props.sender === 'bot' ? '1px solid #e0e0e0' : 'none'};
  border-bottom-${props => props.sender === 'user' ? 'right' : 'left'}-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
`;

const MessageIcon = styled.div`
  margin-right: 12px;
  display: flex;
  align-items: flex-start;
  padding-top: 3px;
  color: ${props => props.sender === 'user' ? '#2E7D32' : '#4CAF50'};
  font-size: 16px;
`;

const MessageContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const MessageText = styled.div`
  word-break: break-word;
  line-height: 1.5;
`;

const BotMessageText = styled(MessageText)`
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #37474F;
`;

const BoldText = styled.span`
  font-weight: 600;
  color: #2E7D32;
  display: block;
  margin-top: 12px;
  margin-bottom: 6px;
  letter-spacing: 0.3px;
`;

const MessageTime = styled.div`
  font-size: 11px;
  color: #9e9e9e;
  margin-top: 4px;
  margin-left: 8px;
  margin-right: 8px;
`;

const BulletPoint = styled.div`
  display: flex;
  align-items: flex-start;
  margin: 6px 0;
  padding-left: 5px;
`;

const BulletIcon = styled.span`
  color: #66BB6A;
  margin-right: 10px;
  font-size: 10px;
  padding-top: 6px;
`;

const NumberedItem = styled.div`
  display: flex;
  align-items: flex-start;
  margin: 8px 0;
  padding-left: 5px;
`;

const NumberBadge = styled.span`
  background-color: #66BB6A;
  color: white;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  font-size: 12px;
  font-weight: bold;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const InputContainer = styled.div`
  display: flex;
  padding: 16px 20px;
  border-top: 1px solid #e6e6e6;
  background-color: white;
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: -20px;
    left: 0;
    right: 0;
    height: 20px;
    background: linear-gradient(to bottom, rgba(249, 250, 252, 0), rgba(249, 250, 252, 0.9));
    pointer-events: none;
  }
`;

const MessageInput = styled.input`
  flex: 1;
  padding: 14px 18px;
  border: 1px solid #e0e0e0;
  border-radius: 24px;
  font-size: 1rem;
  outline: none;
  transition: all 0.2s;
  background-color: #f9fafc;
  
  &:focus {
    border-color: #4CAF50;
    box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
    background-color: white;
  }
  
  &::placeholder {
    color: #9e9e9e;
  }
`;

const SendButton = styled.button`
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 50%;
  width: 46px;
  height: 46px;
  margin-left: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(76, 175, 80, 0.3);
  
  &:hover {
    background-color: #3b9c3f;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(76, 175, 80, 0.4);
  }
  
  &:active {
    transform: translateY(1px);
    box-shadow: 0 1px 4px rgba(76, 175, 80, 0.2);
  }
  
  &:disabled {
    background-color: #A5D6A7;
    transform: none;
    box-shadow: none;
    cursor: not-allowed;
  }
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  animation: spin 1s linear infinite;
  margin-right: 8px;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

export default App
