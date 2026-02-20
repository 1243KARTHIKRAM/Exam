import { useState, useRef, useEffect } from 'react';
import { logChatbotQuestion, askChatbot } from '../utils/api';

const Chatbot = ({ examId: propExamId = null, userId: propUserId = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "👋 Hello! I'm your Exam Assistant.\n\nI can help you with:\n\n📝 Starting your exam\n📋 Proctoring rules\n⚠️ Violation consequences\n💻 Coding section help\n🔲 Fullscreen requirements\n\nWhat would you like to know?", sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [currentExamId, setCurrentExamId] = useState(propExamId);
  const [currentUserId, setCurrentUserId] = useState(propUserId);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const toggleChat = () => setIsOpen(!isOpen);

  const toggleMinimize = (e) => {
    e.stopPropagation();
    setIsMinimized(!isMinimized);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Detect exam context from URL or props
  useEffect(() => {
    // Priority: props > localStorage > URL
    if (propExamId) {
      setCurrentExamId(propExamId);
    } else if (propUserId) {
      setCurrentUserId(propUserId);
    } else {
      // Check URL for exam ID (e.g., /exam/123)
      const path = window.location.pathname;
      const examMatch = path.match(/\/exam\/([^/]+)/);
      if (examMatch && examMatch[1]) {
        setCurrentExamId(examMatch[1]);
      }
      
      // Check localStorage for user context
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      if (user) {
        try {
          const userData = JSON.parse(user);
          if (userData._id) {
            setCurrentUserId(userData._id);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Check localStorage for current exam
      const currentExam = localStorage.getItem('currentExamId');
      if (currentExam) {
        setCurrentExamId(currentExam);
      }
    }
  }, [propExamId, propUserId]);

  // Initialize Speech Recognition
  useEffect(() => {
    // Check if Speech Recognition is supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      setIsListening(true);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');
      
      setInputValue(transcript);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access to use voice input.');
      }
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    if (!isSupported) {
      alert('Voice input is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setInputValue('');
      recognitionRef.current.start();
    }
  };

  const handleSendMessage = async () => {
    if (inputValue.trim() === '') return;

    const userMessage = {
      id: Date.now(),
      text: inputValue,
      sender: 'user'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Show typing indicator
    const typingMessage = {
      id: Date.now() + 1,
      text: '...',
      sender: 'bot',
      isTyping: true
    };
    setMessages(prev => [...prev, typingMessage]);

    try {
      // Call the OpenAI API
      const response = await askChatbot({
        question: inputValue,
        examId: currentExamId,
        userId: currentUserId
      });

      // Remove typing indicator
      setMessages(prev => prev.filter(msg => !msg.isTyping));

      if (response.success && response.data?.response) {
        const botResponse = {
          id: Date.now() + 2,
          text: response.data.response,
          sender: 'bot'
        };
        setMessages(prev => [...prev, botResponse]);

        // Log the question to backend (non-blocking)
        logChatbotQuestion({
          question: inputValue,
          timestamp: new Date().toISOString(),
          botResponse: response.data.response,
          examId: currentExamId,
          userId: currentUserId
        }).catch(() => {
          console.debug('Chatbot logging failed - continuing without logging');
        });
      } else {
        // Handle API error response - use fallback rule-based response
        const fallbackResponse = getBotResponse(inputValue);
        const errorResponse = {
          id: Date.now() + 2,
          text: fallbackResponse,
          sender: 'bot'
        };
        setMessages(prev => [...prev, errorResponse]);
      }
    } catch (error) {
      // Remove typing indicator
      setMessages(prev => prev.filter(msg => !msg.isTyping));

      console.error('Chatbot error:', error);

      // Use fallback rule-based response when API fails
      const fallbackResponse = getBotResponse(inputValue);
      const errorResponse = {
        id: Date.now() + 2,
        text: fallbackResponse,
        sender: 'bot'
      };
      setMessages(prev => [...prev, errorResponse]);
    }
  };

  // Rule-based responses object mapping keywords to replies
  const responses = {
    greeting: {
      keywords: ['hello', 'hi', 'hey', 'good morning', 'good evening'],
      reply: "Hello! I'm your Exam Assistant. I can help you with:\n\n📝 Exam navigation\n📋 Proctoring rules\n⚠️ Violation information\n💻 Coding section help\n🔲 Fullscreen requirements\n\nHow can I assist you today?"
    },
    help: {
      keywords: ['help', 'what can you do', 'assist'],
      reply: "I can help you with:\n\n📝 How to start your exam\n📋 Proctoring rules & requirements\n⚠️ Understanding violations\n💻 Using the coding section\n🔲 Fullscreen mode\n⏱️ Time management\n✅ Submitting your exam\n\nWhat would you like to know?"
    },
    start_exam: {
      keywords: ['start exam', 'begin exam', 'how to start', 'starting exam'],
      reply: "📝 How to Start Your Exam:\n\n1. Log in to your account\n2. Go to the Dashboard\n3. Find your exam and click on it\n4. Read all instructions carefully\n5. Click 'Start Exam' when ready\n6. Ensure you're in a quiet environment\n7. Make sure your camera is enabled\n\n⚠️ Important: Once started, the timer will begin running!"
    },
    proctoring: {
      keywords: ['proctoring', 'proctor', 'camera', 'webcam', 'monitoring', 'surveillance'],
      reply: "📋 Proctoring Rules:\n\n1. ✅ Camera must be ON and facing you at all times\n2. ✅ Ensure good lighting on your face\n3. ✅ Stay within the camera frame\n4. ✅ No other persons should be in the room\n5. ❌ Do not leave the exam window\n6. ❌ No unauthorized devices or materials\n7. ❌ No headphones or earbuds\n8. ✅ Background should be neutral\n\n🔍 Multiple face detection or suspicious activity will trigger warnings."
    },
    multiple_face: {
      keywords: ['multiple face', 'more than one face', 'two faces', 'another person', 'someone else', 'face detected'],
      reply: "⚠️ Multiple Face Detection Warning:\n\nWe've detected more than one face in the camera frame.\n\n📋 What to do:\n1. Make sure you're alone in the room\n2. Ensure only your face is visible\n3. Check for reflections (mirrors, windows)\n4. Close any other applications using your camera\n\n🔴 Repeated violations may result in:\n- Automatic exam suspension\n- Score cancellation\n- Report to administrator\n\nPlease ensure you're the only person in view!"
    },
    tab_switch: {
      keywords: ['tab switch', 'switch tab', 'change tab', 'leave exam', 'switch window', 'alt tab', 'new tab'],
      reply: "⚠️ Tab Switch Violation Warning:\n\nSwitching tabs or windows during the exam is strictly prohibited!\n\n📋 What happened:\n- You left the exam window\n- This triggers a violation alert\n\n🔴 Consequences:\n1. First violation: Warning notification\n2. Second violation: Score reduction (10%)\n3. Third violation: Automatic submission\n4. Repeated violations: Exam disqualification\n\n💡 Tip: Stay focused on the exam window until submission!"
    },
    violation: {
      keywords: ['violation', 'violations', 'warning', 'warned', 'disqualification', 'cancel'],
      reply: "⚠️ What Happens After Violations:\n\nViolations are recorded and tracked throughout your exam.\n\n📊 Violation Levels:\n\n1️⃣ Warning (Minor)\n   - Tab switches\n   - Brief camera loss\n   - No immediate penalty\n\n2️⃣ Score Penalty (Moderate)\n   - Multiple violations\n   - 10-25% score reduction\n\n3️⃣ Automatic Submit (Severe)\n   - Excessive violations\n   - Exam ends automatically\n\n4️⃣ Disqualification (Extreme)\n   - Serious misconduct\n   - All scores voided\n   - Account review\n\n📧 All violations are reported to administrators."
    },
    coding: {
      keywords: ['coding', 'code', 'programming', 'developer', 'algorithm'],
      reply: "💻 Coding Section Usage:\n\n1. 📝 Read the problem carefully\n2. 💾 Write your code in the editor\n3. 🧪 Test with sample inputs\n4. ▶️ Run your solution\n5. ✅ Check for edge cases\n6. 💾 Save your work regularly\n7. ✅ Submit when complete\n\n⌨️ Features:\n- Syntax highlighting\n- Multiple language support\n- Auto-save enabled\n- Test case validation\n\n💡 Tip: Don't forget to submit your code!"
    },
    fullscreen: {
      keywords: ['fullscreen', 'full screen', 'full screen mode', 'f11'],
      reply: "🔲 Fullscreen Requirement:\n\nEntering fullscreen mode is required for the exam.\n\n📋 How to enter fullscreen:\n\n1. Click the fullscreen button in exam interface\n2. OR press F11 (Windows) / Cmd+Ctrl+F (Mac)\n3. OR right-click → 'Enter Fullscreen'\n\n⚠️ Important:\n- Fullscreen prevents other windows from showing\n- Exit without permission = violation\n- Use ESC carefully (may exit fullscreen)\n\n💡 Close all other apps before starting!"
    },
    exam: {
      keywords: ['exam', 'test', 'assessment', 'quiz'],
      reply: "📝 Exam Information:\n\nTo take your exam:\n1. Start from the Dashboard\n2. Ensure stable internet connection\n3. Enable camera for proctoring\n4. Enter fullscreen mode\n5. Complete all questions\n6. Submit before time runs out\n\n⏱️ Time is displayed at the top\n✅ Answers are auto-saved\n💾 Don't forget to submit!"
    },
    submit: {
      keywords: ['submit', 'submission', 'finish', 'complete exam'],
      reply: "✅ Submitting Your Exam:\n\n1. Review all your answers\n2. Click the 'Submit' button\n3. Confirm your submission\n4. Wait for confirmation message\n\n⚠️ Important Notes:\n- Once submitted, changes cannot be made\n- Unanswered questions = 0 marks\n- Submit even if incomplete!\n- Partial submission is better than none\n\n📧 You'll receive confirmation via email."
    },
    time: {
      keywords: ['time', 'duration', 'timer', 'how long', 'remaining'],
      reply: "⏱️ Time Management:\n\n• Exam duration is shown at the top\n• Timer counts down in real-time\n• Warnings at 30min, 10min, 5min\n\n💡 Tips:\n- Start with easy questions\n- Don't spend too long on one question\n- Leave time for review\n- Auto-submit at deadline\n\n⚠️ Don't wait until the last minute!"
    },
    technical: {
      keywords: ['technical', 'issue', 'problem', 'error', 'not working', 'internet'],
      reply: "🔧 Technical Issues:\n\nIf you're experiencing problems:\n\n1. Internet: Refresh and check connection\n2. Camera: Allow browser camera access\n3. Browser: Use Chrome/Firefox (latest)\n4. JavaScript: Enable in settings\n5. Popups: Allow exam popups\n\n📞 If issues persist:\n- Contact admin immediately\n- Don't refresh repeatedly\n- Screenshot any errors\n\n💡 Best: Use stable wired connection!"
    },
    thank: {
      keywords: ['thank', 'thanks', 'appreciate', 'helpful'],
      reply: "You're welcome! 😊\n\nGood luck with your exam! Remember:\n\n📝 Read questions carefully\n⚠️ Follow proctoring rules\n💾 Save your work\n✅ Submit on time\n\nIs there anything else I can help with?"
    }
  };

  const getBotResponse = (message) => {
    // Convert user input to lowercase before matching
    const lowerMessage = message.toLowerCase();
    
    // Check each response rule for keyword matches
    for (const [key, response] of Object.entries(responses)) {
      for (const keyword of response.keywords) {
        if (lowerMessage.includes(keyword)) {
          return response.reply;
        }
      }
    }
    
    // Fallback message when no keywords match
    return 'I\'m not sure I understand. Could you please rephrase your question?';
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat Toggle Button */}
      <button
        onClick={toggleChat}
        className={`w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 ${isMinimized ? 'w-16 h-16' : ''}`}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen && !isMinimized ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {/* Unread indicator */}
            {isMinimized && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <span className="w-2 h-2 bg-white rounded-full"></span>
              </span>
            )}
          </div>
        )}
      </button>

      {/* Chat Window - Only visible when chat is open */}
      {isOpen && (
      <div 
        className={`absolute bottom-16 right-0 w-80 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          isMinimized 
            ? 'h-0 opacity-0 translate-y-4 pointer-events-none' 
            : 'h-96 opacity-100 translate-y-0'
        }`}
      >
        {/* Chat Header */}
        <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold">Support Assistant</h3>
              <p className="text-xs text-white/70">Online</p>
            </div>
          </div>
          {/* Minimize Button */}
          <button
            onClick={toggleMinimize}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors duration-200"
            aria-label={isMinimized ? 'Maximize chat' : 'Minimize chat'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
        </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.sender === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}
                >
                  {message.isTyping ? (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isListening ? "Listening..." : "Type your message..."}
                className={`flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${isListening ? 'border-red-400 ring-2 ring-red-200' : ''}`}
              />
              {/* Voice Input Button */}
              <button
                onClick={toggleVoiceInput}
                className={`px-3 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center ${isListening 
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                  : isSupported 
                    ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                aria-label={isListening ? "Stop listening" : "Start voice input"}
                disabled={!isSupported}
                title={isSupported ? (isListening ? "Stop recording" : "Voice input") : "Voice input not supported"}
              >
                {isListening ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
              {/* Send Button */}
              <button
                onClick={handleSendMessage}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center"
                aria-label="Send message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatbot;
