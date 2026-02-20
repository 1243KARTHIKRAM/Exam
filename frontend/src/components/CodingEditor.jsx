import React, { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';

// Language configurations
const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', extension: 'js' },
  { id: 'python', name: 'Python', extension: 'py' },
  { id: 'java', name: 'Java', extension: 'java' },
  { id: 'cpp', name: 'C++', extension: 'cpp' }
];

// Default code templates
const DEFAULT_CODE = {
  javascript: `// Write your JavaScript code here

function solution(input) {
  // Your code here
  return input;
}

// Read input from stdin
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let lines = [];
rl.on('line', (line) => {
  lines.push(line);
});

rl.on('close', () => {
  const result = solution(lines);
  console.log(result);
});`,
  python: `# Write your Python code here

def solution(input_data):
    # Your code here
    return input_data

# Read input from stdin
import sys

if __name__ == "__main__":
    input_data = sys.stdin.read().strip().split('\\n')
    result = solution(input_data)
    print(result)`,
  java: `// Write your Java code here

import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Read input
        String input = sc.nextLine();
        
        // Your code here
        System.out.println(input);
    }
}`,
  cpp: `// Write your C++ code here

#include <iostream>
#include <string>
using namespace std;

int main() {
    string input;
    getline(cin, input);
    
    // Your code here
    cout << input << endl;
    
    return 0;
}`
};

const CodingEditor = ({ 
  question, 
  onRun, 
  onSubmit, 
  isRunning, 
  isSubmitting,
  output,
  testResults,
  examId,
  token,
  onViolation
}) => {
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState(DEFAULT_CODE[language]);
  const [activeTab, setActiveTab] = useState('description');
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [violationCount, setViolationCount] = useState(0);
  const editorRef = useRef(null);
  const lastCodeLength = useRef(0);
  const tabSwitchStart = useRef(null);

  // Show warning popup
  const displayWarning = useCallback((message) => {
    setWarningMessage(message);
    setShowWarning(true);
    setViolationCount(prev => prev + 1);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setShowWarning(false);
    }, 3000);
  }, []);

  // Handle paste event - detect code pasting
  const handlePaste = useCallback((e) => {
    const pastedText = e.clipboardData?.getData('text') || '';
    const pastedLength = pastedText.length;
    
    // Log paste detection
    console.log(`[Security] Paste detected: ${pastedLength} characters`);
    
    // Report violation
    if (onViolation) {
      onViolation('paste', { length: pastedLength });
    }
    
    // Show warning
    displayWarning(`Paste detected! ${pastedLength} characters pasted. This has been logged.`);
  }, [onViolation, displayWarning]);

  // Handle copy event - detect code copying
  const handleCopy = useCallback((e) => {
    const selectedText = window.getSelection()?.toString() || '';
    const copyLength = selectedText.length;
    
    if (copyLength > 10) { // Only log significant copies
      console.log(`[Security] Copy attempt detected: ${copyLength} characters`);
      
      if (onViolation) {
        onViolation('copy_attempt', { length: copyLength });
      }
      
      displayWarning(`Copy attempt detected! ${copyLength} characters. This has been logged.`);
    }
  }, [onViolation, displayWarning]);

  // Handle tab visibility change - detect tab switching
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      // User switched away from tab
      tabSwitchStart.current = Date.now();
      console.log('[Security] Tab switch detected: away');
    } else {
      // User returned to tab
      if (tabSwitchStart.current) {
        const duration = Date.now() - tabSwitchStart.current;
        console.log(`[Security] Tab switch detected: back after ${duration}ms`);
        
        if (onViolation) {
          onViolation('tab_switch', { duration });
        }
        
        displayWarning(`Tab switch detected! You were away for ${duration}ms. This has been logged.`);
        tabSwitchStart.current = null;
      }
    }
  }, [onViolation, displayWarning]);

  // Handle fullscreen change
  const handleFullscreenChange = useCallback(() => {
    if (!document.fullscreenElement) {
      console.log('[Security] Fullscreen exit detected');
      
      if (onViolation) {
        onViolation('fullscreen_exit', {});
      }
      
      displayWarning('Fullscreen mode exited! This has been logged.');
    }
  }, [onViolation, displayWarning]);

  // Setup event listeners
  useEffect(() => {
    // Add paste listener to the document
    document.addEventListener('paste', handlePaste);
    
    // Add copy listener
    document.addEventListener('copy', handleCopy);
    
    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Add fullscreen change listener
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [handlePaste, handleCopy, handleVisibilityChange, handleFullscreenChange]);

  // Handle language change
  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    // If question has default code for this language, use it
    if (question?.defaultCode && question.defaultCode[newLanguage]) {
      setCode(question.defaultCode[newLanguage]);
    } else {
      setCode(DEFAULT_CODE[newLanguage] || '');
    }
  };

  // Handle editor mount
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
  };

  // Get language for Monaco
  const getMonacoLanguage = (lang) => {
    const mapping = {
      javascript: 'javascript',
      python: 'python',
      java: 'java',
      cpp: 'cpp'
    };
    return mapping[lang] || 'javascript';
  };

  // Get status color
  const getStatusColor = (status) => {
    if (status === 'Accepted') return 'text-green-600';
    if (status === 'Wrong Answer') return 'text-red-600';
    if (status === 'Running') return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg relative">
      {/* Warning Popup */}
      {showWarning && (
        <div className="absolute top-4 right-4 z-50 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg max-w-md animate-pulse">
          <div className="flex items-center">
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-bold">Warning!</p>
              <p className="text-sm">{warningMessage}</p>
              <p className="text-xs mt-1">Violations logged: {violationCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header with language selector and buttons */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onRun(code, language)}
            disabled={isRunning}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              isRunning
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isRunning ? 'Running...' : 'Run Code'}
          </button>
          <button
            onClick={() => onSubmit(code, language)}
            disabled={isSubmitting}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Code'}
          </button>
        </div>
      </div>

      {/* Tabs for Description/Output */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('description')}
          className py-2 font={`px-4-medium ${
            activeTab === 'description'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          Problem
        </button>
        <button
          onClick={() => setActiveTab('output')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'output'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          Output
          {testResults && testResults.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded-full">
              {testResults.filter(r => r.status === 'Accepted').length}/{testResults.length}
            </span>
          )}
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Problem Description */}
        {activeTab === 'description' && (
          <div className="w-1/3 p-4 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">
              {question?.title || 'Coding Question'}
            </h3>
            
            <div className="mb-4">
              <h4 className="font-semibold mb-1 text-gray-800 dark:text-gray-200">Description</h4>
              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {question?.description || 'No description available'}
              </p>
            </div>

            {question?.constraints && (
              <div className="mb-4">
                <h4 className="font-semibold mb-1 text-gray-800 dark:text-gray-200">Constraints</h4>
                <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {question.constraints}
                </p>
              </div>
            )}

            {question?.testCases && question.testCases.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">Sample Test Cases</h4>
                {question.testCases.filter(tc => !tc.isHidden).map((tc, index) => (
                  <div key={index} className="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <div className="mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Input:</span>
                      <pre className="mt-1 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{tc.input}</pre>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Output:</span>
                      <pre className="mt-1 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{tc.expectedOutput}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <span className="font-medium text-blue-800 dark:text-blue-300">
                Points: {question?.points || 10}
              </span>
            </div>
          </div>
        )}

        {/* Output Panel */}
        {activeTab === 'output' && (
          <div className="w-1/3 p-4 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            <h4 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">Test Results</h4>
            
            {testResults && testResults.length > 0 ? (
              <div className="space-y-3">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-md ${
                      result.status === 'Accepted'
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : result.status === 'Wrong Answer'
                        ? 'bg-red-50 dark:bg-red-900/20'
                        : 'bg-yellow-50 dark:bg-yellow-900/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Test Case {index + 1}</span>
                      <span className={`font-semibold ${getStatusColor(result.status)}`}>
                        {result.status}
                      </span>
                    </div>
                    
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Input:</span>
                        <pre className="ml-2 text-gray-800 dark:text-gray-200">{result.input}</pre>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Expected:</span>
                        <pre className="ml-2 text-gray-800 dark:text-gray-200">{result.expectedOutput}</pre>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Output:</span>
                        <pre className="ml-2 text-gray-800 dark:text-gray-200">{result.actualOutput || '(no output)'}</pre>
                      </div>
                      {result.executionTime > 0 && (
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Time:</span>
                          <span className="ml-2 text-gray-800 dark:text-gray-200">{result.executionTime.toFixed(2)}ms</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : output ? (
              <div>
                <h5 className="font-medium mb-2 text-gray-800 dark:text-gray-200">Console Output</h5>
                <pre className="p-3 bg-gray-900 text-green-400 rounded-md text-sm overflow-x-auto">
                  {output}
                </pre>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                Run or submit your code to see results here.
              </p>
            )}
          </div>
        )}

        {/* Monaco Editor */}
        <div className="flex-1">
          <Editor
            height="100%"
            language={getMonacoLanguage(language)}
            value={code}
            onChange={(value) => setCode(value || '')}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              padding: { top: 10 }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default CodingEditor;
