/**
 * Plagiarism Detection Utility
 * Uses Levenshtein distance algorithm to calculate string similarity
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;

  // Create a 2D array to store distances
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // Initialize base cases
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  // Fill the dp table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity percentage between two strings
 * Uses Levenshtein distance
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity percentage (0-100)
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 100;

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 100;

  const distance = levenshteinDistance(longer, shorter);
  const similarity = ((longer.length - distance) / longer.length) * 100;

  return Math.round(similarity * 100) / 100;
}

/**
 * Preprocess code to normalize it for comparison
 * Removes comments, whitespace, and normalizes formatting
 * @param {string} code - Raw code
 * @returns {string} - Normalized code
 */
function preprocessCode(code) {
  if (!code) return '';

  let normalized = code;

  // Remove single-line comments
  normalized = normalized.replace(/\/\/.*$/gm, '');
  
  // Remove multi-line comments
  normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove Python comments
  normalized = normalized.replace(/#.*$/gm, '');

  // Remove all whitespace (spaces, tabs, newlines)
  normalized = normalized.replace(/\s+/g, '');

  // Convert to lowercase for case-insensitive comparison
  normalized = normalized.toLowerCase();

  return normalized;
}

/**
 * Compare two code submissions and return similarity
 * @param {string} code1 - First code submission
 * @param {string} code2 - Second code submission
 * @param {boolean} usePreprocessing - Whether to normalize code before comparison
 * @returns {number} - Similarity percentage (0-100)
 */
function compareCodes(code1, code2, usePreprocessing = true) {
  if (usePreprocessing) {
    const normalized1 = preprocessCode(code1);
    const normalized2 = preprocessCode(code2);
    return calculateSimilarity(normalized1, normalized2);
  }
  return calculateSimilarity(code1, code2);
}

/**
 * Detect plagiarism among multiple submissions
 * @param {Array} submissions - Array of submission objects {id, userId, code, language}
 * @param {number} threshold - Similarity threshold percentage (default 80%)
 * @returns {Array} - Array of suspicious pairs
 */
function detectPlagiarism(submissions, threshold = 80) {
  const suspiciousPairs = [];
  const processed = new Set();

  for (let i = 0; i < submissions.length; i++) {
    for (let j = i + 1; j < submissions.length; j++) {
      const pairKey = `${submissions[i].userId}-${submissions[j].userId}`;
      
      // Skip if already processed
      if (processed.has(pairKey)) continue;
      processed.add(pairKey);

      const similarity = compareCodes(
        submissions[i].code,
        submissions[j].code
      );

      if (similarity >= threshold) {
        suspiciousPairs.push({
          submission1: {
            id: submissions[i].id,
            userId: submissions[i].userId,
            userName: submissions[i].userName || submissions[i].userId,
            code: submissions[i].code
          },
          submission2: {
            id: submissions[j].id,
            userId: submissions[j].userId,
            userName: submissions[j].userName || submissions[j].userId,
            code: submissions[j].code
          },
          similarity: similarity,
          threshold: threshold,
          isFlagged: true
        });
      }
    }
  }

  // Sort by similarity (highest first)
  return suspiciousPairs.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Get plagiarism statistics for submissions
 * @param {Array} submissions - Array of submission objects
 * @param {number} threshold - Similarity threshold percentage
 * @returns {Object} - Plagiarism statistics
 */
function getPlagiarismStats(submissions, threshold = 80) {
  const suspiciousPairs = detectPlagiarism(submissions, threshold);
  
  const totalComparisons = (submissions.length * (submissions.length - 1)) / 2;
  const flaggedCount = suspiciousPairs.length;
  const flaggedPercentage = totalComparisons > 0 
    ? Math.round((flaggedCount / totalComparisons) * 100 * 100) / 100 
    : 0;

  // Calculate average similarity
  let totalSimilarity = 0;
  const allSimilarities = [];
  
  for (let i = 0; i < submissions.length; i++) {
    for (let j = i + 1; j < submissions.length; j++) {
      const similarity = compareCodes(submissions[i].code, submissions[j].code);
      totalSimilarity += similarity;
      allSimilarities.push(similarity);
    }
  }

  const avgSimilarity = totalComparisons > 0 
    ? Math.round((totalSimilarity / totalComparisons) * 100) / 100 
    : 0;

  return {
    totalSubmissions: submissions.length,
    totalComparisons,
    suspiciousPairs: flaggedCount,
    flaggedPercentage,
    averageSimilarity: avgSimilarity,
    highestSimilarity: allSimilarities.length > 0 ? Math.max(...allSimilarities) : 0,
    threshold,
    pairs: suspiciousPairs
  };
}

module.exports = {
  levenshteinDistance,
  calculateSimilarity,
  preprocessCode,
  compareCodes,
  detectPlagiarism,
  getPlagiarismStats
};
