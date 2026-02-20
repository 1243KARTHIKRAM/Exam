import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { getExamById, submitExamAnswers, submitViolation, submitCodingViolation, getCodingQuestions, runCode, submitCode } from '../utils/api';
import CodingEditor from '../components/CodingEditor';

import '@mediapipe/face_detection';
import '@mediapipe/camera_utils';

export default function ExamPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [codingQuestions, setCodingQuestions] = useState([]);
  const [currentCodingQuestion, setCurrentCodingQuestion] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [codeOutput, setCodeOutput] = useState('');
  const [testResults, setTestResults] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);

  const [proctoringEnabled, setProctoringEnabled] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [violationCount, setViolationCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const faceDetectorRef = useRef(null);
  const lastViolationTimeRef = useRef(0);
  const warningDismissTimeRef = useRef(0);
  const isFullscreenRef = useRef(false);

  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');

  const requestFullscreen = useCallback(() => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => {
        console.error('Fullscreen request failed:', err);
      });
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
  }, []);

  const handleFullscreenChange = useCallback(() => {
    const isCurrentlyFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    setIsFullscreen(isCurrentlyFullscreen);
    isFullscreenRef.current = isCurrentlyFullscreen;
    
    if (!isCurrentlyFullscreen && !submitted) {
      handleViolation('fullscreen_exit', 'You exited fullscreen mode! Please remain in fullscreen during the exam.');
    }
  }, [submitted]);

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden && !submitted) {
      handleViolation('tab_switch', 'You switched tabs! Returning to the exam now.');
    }
  }, [submitted]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    return false;
  }, []);

  const handleCopy = useCallback((e) => {
    e.preventDefault();
    handleViolation('copy_attempt', 'Copying content is not allowed during the exam!');
    return false;
  }, [submitted]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    handleViolation('paste_attempt', 'Pasting content is not allowed during the exam!');
    return false;
  }, [submitted]);

  const handleCut = useCallback((e) => {
    e.preventDefault();
    handleViolation('cut_attempt', 'Cutting content is not allowed during the exam!');
    return false;
  }, [submitted]);

  const handleKeyDown = useCallback((e) => {
    if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      return false;
    }
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      return false;
    }
    if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      return false;
    }
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      return false;
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'J') {
      e.preventDefault();
      return false;
    }
  }, []);

  useEffect(() => {
    if (submitted) return;

    requestFullscreen();

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [submitted, requestFullscreen, handleFullscreenChange, handleVisibilityChange, handleContextMenu, handleCopy, handlePaste, handleCut, handleKeyDown]);

  const initializeFaceDetection = useCallback(async () => {
    const { FaceDetection } = await import('@mediapipe/face_detection');
    const faceDetection = new FaceDetection({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
      }
    });
    faceDetection.setOptions({
      model: 'short',
      minDetectionConfidence: 0.5
    });
    faceDetection.onResults(handleFaceDetectionResults);
    faceDetectorRef.current = faceDetection;
  }, []);

  const handleFaceDetectionResults = useCallback(async (results) => {
    if (submitted || !proctoringEnabled) return;

    const now = Date.now();
    if (now - lastViolationTimeRef.current < 3000) return;

    const numFaces = results.detections ? results.detections.length : 0;

    if (numFaces === 0) {
      await handleViolation('no_face', 'No face detected! Please stay in front of the camera.');
    } else if (numFaces > 1) {
      await handleViolation('multiple_faces', `${numFaces} faces detected! Only one person should be in front of the camera.`);
    }
  }, [submitted, proctoringEnabled]);

  const handleViolation = async (type, message) => {
    lastViolationTimeRef.current = Date.now();
    setViolationCount(prev => prev + 1);
    setWarningMessage(message);
    setShowWarning(true);

    const snapshot = captureSnapshot();

    try {
      await submitViolation(id, type, snapshot, token);
    } catch (err) {
      console.error('Failed to submit violation:', err);
    }

    setTimeout(() => {
      warningDismissTimeRef.current = Date.now();
      setShowWarning(false);
    }, 5000);
  };

  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      streamRef.current = stream;
      setWebcamActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      await initializeFaceDetection();
      setProctoringEnabled(true);
    } catch (err) {
      console.error('Error accessing webcam:', err);
      setWarningMessage('Unable to access webcam. Proctoring will be disabled.');
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 5000);
    }
  }, [initializeFaceDetection]);

  const processFrame = useCallback(async () => {
    if (!videoRef.current || !faceDetectorRef.current || !proctoringEnabled || submitted) {
      if (!submitted && proctoringEnabled) {
        requestAnimationFrame(processFrame);
      }
      return;
    }

    try {
      await faceDetectorRef.current.send({ image: videoRef.current });
    } catch (err) {
      console.error('Error processing frame:', err);
    }

    requestAnimationFrame(processFrame);
  }, [proctoringEnabled, submitted]);

  useEffect(() => {
    if (proctoringEnabled && !submitted) {
      processFrame();
    }
  }, [proctoringEnabled, submitted, processFrame]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    loadExam();
    startWebcam();
  }, [id, token, navigate]);

  useEffect(() => {
    if (timeLeft > 0 && !submitted) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !submitted && exam) {
      handleAutoSubmit();
    }
  }, [timeLeft, submitted, exam]);

  const loadExam = async () => {
    try {
      setLoading(true);
      const data = await getExamById(id, token);
      if (data.exam) {
        setExam(data.exam);
        setQuestions(data.questions || []);
        setAllQuestions([...(data.questions || [])]);
        setTimeLeft(data.exam.duration * 60);
        
        // Also load coding questions if any
        const codingData = await getCodingQuestions(id, token);
        if (codingData.success && codingData.questions) {
          setCodingQuestions(codingData.questions);
          setAllQuestions(prev => [...prev, ...codingData.questions]);
        }
      } else {
        setError(data.message || 'Exam not found');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleRunCode = async (code, language) => {
    if (!currentCodingQuestion) return;
    
    try {
      setIsRunning(true);
      setCodeOutput('');
      setTestResults([]);
      
      const result = await runCode(
        {
          questionId: currentCodingQuestion._id,
          code,
          language
        },
        token
      );
      
      if (result.success) {
        setTestResults(result.results || []);
        setCodeOutput(result.results?.[0]?.actualOutput || '');
      } else {
        setCodeOutput(result.message || 'Error running code');
      }
    } catch (err) {
      setCodeOutput('Failed to execute code');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmitCode = async (code, language) => {
    if (!currentCodingQuestion) return;
    
    try {
      setIsSubmittingCode(true);
      setCodeOutput('');
      setTestResults([]);
      
      const result = await submitCode(
        {
          questionId: currentCodingQuestion._id,
          code,
          language
        },
        token
      );
      
      if (result.success) {
        setTestResults(result.results || []);
        // Mark as answered
        setAnswers({ ...answers, [currentCodingQuestion._id]: { submitted: true, score: result.score } });
      } else {
        setCodeOutput(result.message || 'Error submitting code');
      }
    } catch (err) {
      setCodeOutput('Failed to submit code');
    } finally {
      setIsSubmittingCode(false);
    }
  };

  // Handle coding violations (paste, tab switch, fullscreen exit, etc.)
  const handleCodingViolation = async (type, metadata = {}) => {
    if (!currentExam?._id || !token) return;
    
    try {
      await submitCodingViolation(currentExam._id, type, metadata, token);
      console.log(`[Violation] ${type} logged with metadata:`, metadata);
    } catch (err) {
      console.error('Failed to log violation:', err);
    }
  };

  const handleAutoSubmit = async () => {
    await submitToBackend();
  };

  const submitToBackend = async () => {
    try {
      setSubmitted(true);
      
      const answersArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer
      }));

      const result = await submitExamAnswers(id, answersArray, token);
      
      if (result.message) {
        setSubmitResult(result);
        setError(`Exam submitted! Your score: ${result.score}% (${result.correctCount}/${result.totalQuestions} correct)`);
      } else {
        setError(result.message || 'Failed to submit exam');
      }
    } catch (err) {
      let correct = 0;
      questions.forEach((q) => {
        if (answers[q._id] === q.correctAnswer) {
          correct++;
        }
      });
      const score = Math.round((correct / questions.length) * 100);
      setError(`Exam submitted! Your score: ${score}% (${correct}/${questions.length} correct)`);
    }
  };

  const handleSubmitClick = () => {
    setShowSubmitModal(true);
  };

  const confirmSubmit = async () => {
    setShowSubmitModal(false);
    await submitToBackend();
  };

  const cancelSubmit = () => {
    setShowSubmitModal(false);
  };

  const dismissWarning = () => {
    setShowWarning(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const goBack = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    navigate('/student-dashboard');
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < allQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      // Check if it's a coding question
      const question = allQuestions[currentQuestionIndex + 1];
      if (question && question.title) {
        setCurrentCodingQuestion(question);
      } else {
        setCurrentCodingQuestion(null);
      }
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      // Check if it's a coding question
      const question = allQuestions[currentQuestionIndex - 1];
      if (question && question.title) {
        setCurrentCodingQuestion(question);
      } else {
        setCurrentCodingQuestion(null);
      }
    }
  };

  const goToQuestion = (index) => {
    setCurrentQuestionIndex(index);
    // Check if it's a coding question
    const question = allQuestions[index];
    if (question && question.title) {
      setCurrentCodingQuestion(question);
    } else {
      setCurrentCodingQuestion(null);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).length;

  const getTimeColor = () => {
    if (timeLeft < 60) return 'text-red-500';
    if (timeLeft < 300) return 'text-yellow-500';
    return isDark ? 'text-white' : 'text-gray-900';
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col justify-center items-center ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-500 border-t-transparent"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>
        <p className={`mt-4 text-lg ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Loading exam...</p>
      </div>
    );
  }

  if (error && !exam) {
    return (
      <div className={`min-h-screen flex flex-col justify-center items-center ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className={`max-w-md p-8 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} shadow-xl`}>
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-red-100">
              <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <p className={`text-center text-lg mb-6 ${isDark ? 'text-red-400' : 'text-red-700'}`}>{error}</p>
          <button
            onClick={goBack}
            className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-900' : 'bg-gray-100'}`}>
      <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {showWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 animate-slide-in">
          <div className="bg-gradient-to-r from-red-500 to-red-600 text-white py-4 px-4 shadow-lg animate-pulse">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0 mr-4">
                  <svg className="h-8 w-8 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-lg">{warningMessage}</p>
                  <p className="text-sm text-red-100">Violation #{violationCount} recorded</p>
                </div>
              </div>
              <button 
                onClick={dismissWarning}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {!isFullscreen && !submitted && (
        <div className={`fixed bottom-4 right-4 z-40 animate-scale-in ${isDark ? 'bg-yellow-900' : 'bg-yellow-500'} text-white py-4 px-5 rounded-xl shadow-xl max-w-sm`}>
          <div className="flex items-start space-x-3">
            <svg className="h-6 w-6 flex-shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold">Fullscreen Required</p>
              <p className="text-sm text-white/90 mt-1">Please enter fullscreen mode to continue the exam.</p>
            </div>
          </div>
          <button 
            onClick={requestFullscreen}
            className="mt-3 w-full bg-white text-yellow-600 hover:bg-gray-100 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <span>Enter Fullscreen</span>
          </button>
        </div>
      )}

      <div className="flex h-screen">
        <div className={`w-72 flex-shrink-0 border-r ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} flex flex-col`}>
          <div className="p-4 border-b border-slate-700">
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black shadow-lg">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              {webcamActive && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-2 left-2 w-8 h-8 border-l-2 border-t-2 border-green-500"></div>
                  <div className="absolute top-2 right-2 w-8 h-8 border-r-2 border-t-2 border-green-500"></div>
                  <div className="absolute bottom-2 left-2 w-8 h-8 border-l-2 border-b-2 border-green-500"></div>
                  <div className="absolute bottom-2 right-2 w-8 h-8 border-r-2 border-b-2 border-green-500"></div>
                </div>
              )}

              <div className="absolute top-3 right-3 flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${webcamActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-xs text-white bg-black/50 px-2 py-1 rounded">{webcamActive ? 'LIVE' : 'OFF'}</span>
              </div>

              <div className="absolute bottom-3 left-3 flex items-center space-x-2">
                <div className="flex items-center space-x-1 bg-black/50 px-2 py-1 rounded">
                  <svg className="w-4 h-4 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-xs text-white">AI Active</span>
                </div>
              </div>

              {!webcamActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                  <div className="text-center">
                    <svg className="w-12 h-12 text-slate-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-slate-400 text-sm mt-2">Camera initializing...</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className={isDark ? 'text-slate-400' : 'text-gray-600'}>Violations</span>
                <span className={`font-semibold ${violationCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {violationCount}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className={isDark ? 'text-slate-400' : 'text-gray-600'}>Status</span>
                <span className="flex items-center space-x-1">
                  <span className={`w-2 h-2 rounded-full ${proctoringEnabled ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                  <span className={isDark ? 'text-slate-300' : 'text-gray-700'}>
                    {proctoringEnabled ? 'Monitoring' : 'Initializing'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-slate-700">
            <div className={`text-center p-4 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Time Remaining</p>
              <p className={`text-3xl font-bold mt-1 ${getTimeColor()}`}>
                {formatTime(timeLeft)}
              </p>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            <p className={`text-sm font-medium mb-3 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Questions</p>
            <div className="grid grid-cols-4 gap-2">
              {allQuestions.map((q, idx) => {
                const isAnswered = answers[q._id];
                const isCurrent = idx === currentQuestionIndex;
                const isCoding = !!q.title;
                return (
                  <button
                    key={idx}
                    onClick={() => goToQuestion(idx)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                      isCurrent
                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                        : isAnswered
                          ? isDark 
                            ? 'bg-green-900/50 text-green-400 border border-green-700' 
                            : 'bg-green-100 text-green-700 border border-green-200'
                          : isDark 
                            ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className={`mt-4 text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
              <span className="text-green-500">{answeredCount}</span> / {allQuestions.length} answered
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
            <div>
              <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{exam?.title}</h1>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                Question {currentQuestionIndex + 1} of {allQuestions.length}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSubmitClick}
                disabled={submitted}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-green-500/30 disabled:opacity-50"
              >
                Submit Exam
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6">
            {currentQuestion && (
              <div className={`max-w-3xl mx-auto ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl border ${isDark ? 'border-slate-700' : 'border-gray-200'} shadow-xl p-8`}>
                <div className="flex items-start space-x-4 mb-6">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold">
                    {currentQuestionIndex + 1}
                  </div>
                  <h2 className={`text-xl font-semibold flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {currentQuestion.questionText}
                  </h2>
                </div>

                <div className="space-y-3">
                  {currentQuestion.options?.map((option, idx) => {
                    const isSelected = answers[currentQuestion._id] === option;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleAnswerChange(currentQuestion._id, option)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? 'border-primary-500 bg-primary-500/10'
                            : isDark
                              ? 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? 'border-primary-500 bg-primary-500'
                              : isDark ? 'border-slate-500' : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={isDark ? 'text-slate-200' : 'text-gray-700'}>
                            {option}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Render Coding Question */}
            {currentCodingQuestion && (
              <div className="h-full">
                <CodingEditor
                  question={currentCodingQuestion}
                  onRun={handleRunCode}
                  onSubmit={handleSubmitCode}
                  isRunning={isRunning}
                  isSubmitting={isSubmittingCode}
                  output={codeOutput}
                  testResults={testResults}
                  examId={currentExam?._id}
                  token={token}
                  onViolation={handleCodingViolation}
                />
              </div>
            )}
          </div>

          <footer className={`flex items-center justify-between px-6 py-4 border-t ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
            <button
              onClick={goToPreviousQuestion}
              disabled={currentQuestionIndex === 0}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                currentQuestionIndex === 0
                  ? 'opacity-50 cursor-not-allowed'
                  : isDark 
                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Previous</span>
            </button>

            <div className="flex items-center space-x-2">
              {allQuestions.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentQuestionIndex
                      ? 'w-6 bg-primary-500'
                      : answers[allQuestions[idx]?._id]
                        ? 'bg-green-500'
                        : isDark ? 'bg-slate-600' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={goToNextQuestion}
              disabled={currentQuestionIndex === allQuestions.length - 1}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                currentQuestionIndex === questions.length - 1
                  ? 'opacity-50 cursor-not-allowed'
                  : 'bg-primary-500 text-white hover:bg-primary-600'
              }`}
            >
              <span>Next</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </footer>
        </div>
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={cancelSubmit}></div>
          <div className={`relative max-w-md w-full mx-4 p-6 rounded-2xl animate-scale-in ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
          } border shadow-2xl`}>
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Submit Exam?</h3>
              <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                You have answered <span className="font-semibold text-primary-500">{answeredCount}</span> out of <span className="font-semibold">{allQuestions.length}</span> questions.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={cancelSubmit}
                  className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                    isDark 
                      ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Continue Exam
                </button>
                <button
                  onClick={confirmSubmit}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-green-500/30"
                >
                  Submit Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {submitted && error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div className={`relative max-w-lg w-full mx-4 p-8 rounded-2xl animate-scale-in ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
          } border shadow-2xl`}>
            <div className="text-center">
              <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mb-6 shadow-lg shadow-green-500/30">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Exam Submitted!</h2>
              <p className={`text-lg mb-6 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>{error}</p>
              <button
                onClick={goBack}
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary-500/30"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
