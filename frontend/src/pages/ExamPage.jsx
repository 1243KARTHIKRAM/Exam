import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getExamById, submitExamAnswers, submitViolation } from '../utils/api';

// MediaPipe imports
import '@mediapipe/face_detection';
import '@mediapipe/camera_utils';

export default function ExamPage() {
  const { id } = useParams();
  const navigate = useNavigate();
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

  // Proctoring state
  const [proctoringEnabled, setProctoringEnabled] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [violationCount, setViolationCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const faceDetectorRef = useRef(null);
  const lastViolationTimeRef = useRef(0);
  const warningDismissTimeRef = useRef(0);
  const isFullscreenRef = useRef(false);

  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');

  // Request fullscreen on mount
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

  // Handle fullscreen change
  const handleFullscreenChange = useCallback(() => {
    const isCurrentlyFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    setIsFullscreen(isCurrentlyFullscreen);
    isFullscreenRef.current = isCurrentlyFullscreen;
    
    if (!isCurrentlyFullscreen && !submitted) {
      handleViolation('fullscreen_exit', 'You exited fullscreen mode! Please remain in fullscreen during the exam.');
    }
  }, [submitted]);

  // Handle visibility change (tab switching)
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden && !submitted) {
      handleViolation('tab_switch', 'You switched tabs! Returning to the exam now.');
    }
  }, [submitted]);

  // Disable right-click
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    return false;
  }, []);

  // Disable copy
  const handleCopy = useCallback((e) => {
    e.preventDefault();
    handleViolation('copy_attempt', 'Copying content is not allowed during the exam!');
    return false;
  }, [submitted]);

  // Disable paste
  const handlePaste = useCallback((e) => {
    e.preventDefault();
    handleViolation('paste_attempt', 'Pasting content is not allowed during the exam!');
    return false;
  }, [submitted]);

  // Disable cut
  const handleCut = useCallback((e) => {
    e.preventDefault();
    handleViolation('cut_attempt', 'Cutting content is not allowed during the exam!');
    return false;
  }, [submitted]);

  // Disable keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    // Prevent Ctrl+P (print)
    if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      return false;
    }
    // Prevent Ctrl+S (save)
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      return false;
    }
    // Prevent Ctrl+U (view source)
    if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      return false;
    }
    // Prevent F12 (developer tools)
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }
    // Prevent Ctrl+Shift+I (developer tools)
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      return false;
    }
    // Prevent Ctrl+Shift+J (developer console)
    if (e.ctrlKey && e.shiftKey && e.key === 'J') {
      e.preventDefault();
      return false;
    }
  }, []);

  // Setup browser monitoring
  useEffect(() => {
    if (submitted) return;

    // Request fullscreen on mount
    requestFullscreen();

    // Add event listeners
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
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

  // Initialize face detection
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

  // Handle face detection results
  const handleFaceDetectionResults = useCallback(async (results) => {
    if (submitted || !proctoringEnabled) return;

    const now = Date.now();
    // Prevent multiple violations within 3 seconds
    if (now - lastViolationTimeRef.current < 3000) return;

    const numFaces = results.detections ? results.detections.length : 0;

    if (numFaces === 0) {
      // No face detected
      await handleViolation('no_face', 'No face detected! Please stay in front of the camera.');
    } else if (numFaces > 1) {
      // Multiple faces detected
      await handleViolation('multiple_faces', `${numFaces} faces detected! Only one person should be in front of the camera.`);
    }
  }, [submitted, proctoringEnabled]);

  // Handle violation
  const handleViolation = async (type, message) => {
    lastViolationTimeRef.current = Date.now();
    setViolationCount(prev => prev + 1);
    setWarningMessage(message);
    setShowWarning(true);

    // Capture snapshot
    const snapshot = captureSnapshot();

    // Send violation to backend
    try {
      await submitViolation(id, type, snapshot, token);
    } catch (err) {
      console.error('Failed to submit violation:', err);
    }

    // Auto-dismiss warning after 5 seconds
    setTimeout(() => {
      warningDismissTimeRef.current = Date.now();
      setShowWarning(false);
    }, 5000);
  };

  // Capture snapshot from video
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

  // Start webcam
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

  // Process video frame
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

  // Start processing when face detection is ready
  useEffect(() => {
    if (proctoringEnabled && !submitted) {
      processFrame();
    }
  }, [proctoringEnabled, submitted, processFrame]);

  // Cleanup on unmount
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

  // Timer effect
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
        setTimeLeft(data.exam.duration * 60);
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
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const goToQuestion = (index) => {
    setCurrentQuestionIndex(index);
  };

  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !exam) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
        <button
          onClick={goBack}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hidden elements for proctoring */}
      <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Non-intrusive Warning Banner */}
      {showWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white py-3 px-4 shadow-lg transform transition-transform duration-300 animate-pulse">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">{warningMessage}</span>
              <span className="ml-4 text-sm bg-red-600 px-2 py-1 rounded">Violation #{violationCount}</span>
            </div>
            <button 
              onClick={dismissWarning}
              className="text-white hover:bg-red-600 p-1 rounded transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Warning Toast */}
      {!isFullscreen && !submitted && (
        <div className="fixed bottom-4 right-4 z-40 bg-yellow-500 text-white py-3 px-4 rounded-lg shadow-lg max-w-md">
          <div className="flex items-center">
            <svg className="h-6 w-6 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <div>
              <p className="font-medium">Fullscreen Required</p>
              <p className="text-sm opacity-90">Please enter fullscreen mode to continue the exam.</p>
            </div>
            <button 
              onClick={requestFullscreen}
              className="ml-4 bg-white text-yellow-600 hover:bg-gray-100 px-3 py-1 rounded text-sm font-medium"
            >
              Enter
            </button>
          </div>
        </div>
      )}

      {/* Full Warning Modal (for serious violations - face detection) */}
      {showWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-bold text-red-600">Warning!</h3>
                <p className="text-sm text-gray-500">Violation #{violationCount}</p>
              </div>
            </div>
            <p className="text-gray-700 text-lg mb-6">{warningMessage}</p>
            <button
              onClick={dismissWarning}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      <header className={`bg-white shadow-sm sticky top-0 z-10 ${showWarning ? 'mt-12' : ''} transition-all duration-300`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900">{exam?.title}</h1>
            <div className="flex items-center space-x-4">
              {/* Violation Counter Badge */}
              {violationCount > 0 && (
                <div className="flex items-center bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
                  <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {violationCount} violation{violationCount > 1 ? 's' : ''}
                </div>
              )}
              {/* Proctoring Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${proctoringEnabled ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">Proctoring {proctoringEnabled ? 'Active' : 'Inactive'}</span>
              </div>
              <div className={`text-lg font-semibold ${timeLeft < 300 ? 'text-red-600' : 'text-gray-700'}`}>
                Time Left: {formatTime(timeLeft)}
              </div>
              {!submitted ? (
                <button
                  onClick={handleSubmitClick}
                  className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Submit Exam
                </button>
              ) : (
                <button
                  onClick={goBack}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Back to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
            <span>{answeredCount} of {questions.length} answered</span>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Webcam Preview */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-24">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Camera Preview</h3>
              <div className="relative rounded-lg overflow-hidden bg-gray-900 aspect-video">
                {proctoringEnabled ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                {/* Face detection overlay indicator */}
                {proctoringEnabled && (
                  <div className="absolute top-2 right-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {proctoringEnabled ? 'Monitoring for suspicious activity' : 'Camera not available'}
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Question Navigator */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
              <div className="flex flex-wrap gap-2">
                {questions.map((q, index) => (
                  <button
                    key={q._id}
                    onClick={() => goToQuestion(index)}
                    className={`w-10 h-10 rounded-lg font-medium text-sm transition-colors duration-200 ${
                      index === currentQuestionIndex
                        ? 'bg-blue-600 text-white'
                        : answers[q._id]
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Content */}
            {submitted && submitResult && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
                <p className="font-semibold">Exam Submitted Successfully!</p>
                <p>Your Score: {submitResult.score}% ({submitResult.correctCount}/{submitResult.totalQuestions} correct)</p>
              </div>
            )}

            {submitted && !submitResult && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg mb-6">
                <p>Exam submitted. Score calculation in progress...</p>
              </div>
            )}

            {currentQuestion && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  <span className="text-blue-600 mr-2">Q{currentQuestionIndex + 1}.</span>
                  {currentQuestion.questionText}
                </h3>
                
                <div className="space-y-3">
                  {currentQuestion.options.map((option, optIndex) => (
                    <label
                      key={optIndex}
                      className={`flex items-center p-4 rounded-lg border cursor-pointer transition-colors duration-200 ${
                        answers[currentQuestion._id] === option
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={currentQuestion._id}
                        value={option}
                        checked={answers[currentQuestion._id] === option}
                        onChange={() => handleAnswerChange(currentQuestion._id, option)}
                        disabled={submitted}
                        className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-3 text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={goToPreviousQuestion}
                disabled={currentQuestionIndex === 0}
                className={`py-3 px-6 rounded-lg font-medium transition-colors duration-200 ${
                  currentQuestionIndex === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Previous
              </button>
              
              {currentQuestionIndex < questions.length - 1 ? (
                <button
                  onClick={goToNextQuestion}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-medium transition-colors duration-200"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmitClick}
                  disabled={submitted}
                  className="bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-medium transition-colors duration-200"
                >
                  Submit Exam
                </button>
              )}
            </div>

            {questions.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <h3 className="text-lg font-medium text-gray-900">No questions available</h3>
                <p className="text-gray-500 mt-2">
                  This exam doesn't have any questions yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Submit Exam?</h3>
            <div className="mb-6">
              <p className="text-gray-600 mb-2">You have answered {answeredCount} out of {questions.length} questions.</p>
              {answeredCount < questions.length && (
                <p className="text-yellow-600 text-sm">
                  You have {questions.length - answeredCount} unanswered question(s).
                </p>
              )}
              <p className="text-gray-500 text-sm mt-2">
                Time remaining: {formatTime(timeLeft)}
              </p>
              {violationCount > 0 && (
                <p className="text-red-600 text-sm mt-2">
                  Note: {violationCount} violation{violationCount > 1 ? 's' : ''} were recorded during this exam.
                </p>
              )}
            </div>
            <div className="flex space-x-4">
              <button
                onClick={cancelSubmit}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Review Answers
              </button>
              <button
                onClick={confirmSubmit}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Submit Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
