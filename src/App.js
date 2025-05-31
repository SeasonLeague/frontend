import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import './App.css';

const App = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [semesters, setSemesters] = useState([]);
  const [currentSemester, setCurrentSemester] = useState(null);
  const [showAddSemester, setShowAddSemester] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showAIAdvisor, setShowAIAdvisor] = useState(false);
  const [aiAdvice, setAiAdvice] = useState('');
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);

  // PWA Install Handler
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  // Nigerian University Grading System (Akwa Ibom State University)
  const gradeScale = {
    'A': { min: 70, max: 100, points: 5.0 },
    'B': { min: 60, max: 69, points: 4.0 },
    'C': { min: 50, max: 59, points: 3.0 },
    'D': { min: 45, max: 49, points: 2.0 },
    'E': { min: 40, max: 44, points: 1.0 },
    'F': { min: 0, max: 39, points: 0.0 }
  };

  const getClassification = (cgpa) => {
    if (cgpa >= 4.50) return { class: 'First Class', color: 'text-green-400' };
    if (cgpa >= 3.50) return { class: 'Second Class Upper', color: 'text-blue-400' };
    if (cgpa >= 2.40) return { class: 'Second Class Lower', color: 'text-yellow-400' };
    if (cgpa >= 1.50) return { class: 'Third Class', color: 'text-orange-400' };
    if (cgpa >= 1.00) return { class: 'Pass', color: 'text-purple-400' };
    return { class: 'Fail', color: 'text-red-400' };
  };

  const getGradeFromScore = (score) => {
    for (const [grade, range] of Object.entries(gradeScale)) {
      if (score >= range.min && score <= range.max) {
        return { grade, points: range.points };
      }
    }
    return { grade: 'F', points: 0.0 };
  };

  const calculateGPA = (courses) => {
    if (!courses || courses.length === 0) return 0;
    
    const totalPoints = courses.reduce((sum, course) => {
      const gradeInfo = getGradeFromScore(course.score);
      return sum + (gradeInfo.points * course.creditHours);
    }, 0);
    
    const totalCredits = courses.reduce((sum, course) => sum + course.creditHours, 0);
    
    return totalCredits > 0 ? (totalPoints / totalCredits) : 0;
  };

  const calculateCGPA = () => {
    if (semesters.length === 0) return 0;
    
    let totalPoints = 0;
    let totalCredits = 0;
    
    semesters.forEach(semester => {
      semester.courses.forEach(course => {
        const gradeInfo = getGradeFromScore(course.score);
        totalPoints += gradeInfo.points * course.creditHours;
        totalCredits += course.creditHours;
      });
    });
    
    return totalCredits > 0 ? (totalPoints / totalCredits) : 0;
  };

  // AI Advisor Function
  const generateAIAdvice = async () => {
    setLoadingAdvice(true);
    try {
      const cgpa = calculateCGPA();
      const classification = getClassification(cgpa);
      
      // Analyze performance data
      const totalCourses = semesters.reduce((total, sem) => total + sem.courses.length, 0);
      const totalCredits = semesters.reduce((total, sem) => 
        total + sem.courses.reduce((semTotal, course) => semTotal + course.creditHours, 0), 0);
      
      // Calculate semester GPAs for trend analysis
      const semesterGPAs = semesters.map(sem => ({
        name: sem.name,
        gpa: calculateGPA(sem.courses),
        courses: sem.courses.length
      }));
      
      // Find struggling courses (below 60%)
      const strugglingCourses = [];
      const excellentCourses = [];
      
      semesters.forEach(sem => {
        sem.courses.forEach(course => {
          if (course.score < 60) {
            strugglingCourses.push(course);
          } else if (course.score >= 80) {
            excellentCourses.push(course);
          }
        });
      });

      // Calculate trend (improving, declining, stable)
      let trend = 'stable';
      if (semesterGPAs.length >= 2) {
        const recent = semesterGPAs.slice(-2);
        if (recent[1].gpa > recent[0].gpa + 0.2) trend = 'improving';
        else if (recent[1].gpa < recent[0].gpa - 0.2) trend = 'declining';
      }

      // Create detailed prompt for Gemini
      const prompt = `You are an experienced Nigerian university academic advisor. Analyze this student's academic performance and provide personalized, actionable advice.

STUDENT PERFORMANCE DATA:
- Current CGPA: ${cgpa.toFixed(2)}/5.0
- Classification: ${classification.class}
- Total Semesters: ${semesters.length}
- Total Courses: ${totalCourses}
- Total Credit Hours: ${totalCredits}
- Performance Trend: ${trend}

SEMESTER BREAKDOWN:
${semesterGPAs.map(sem => `- ${sem.name}: GPA ${sem.gpa.toFixed(2)} (${sem.courses} courses)`).join('\n')}

${strugglingCourses.length > 0 ? `
STRUGGLING COURSES (Below 60%):
${strugglingCourses.map(course => `- ${course.name} (${course.code}): ${course.score}% - ${course.creditHours} units`).join('\n')}
` : ''}

${excellentCourses.length > 0 ? `
EXCELLENT PERFORMANCE (80%+):
${excellentCourses.map(course => `- ${course.name} (${course.code}): ${course.score}% - ${course.creditHours} units`).join('\n')}
` : ''}

CONTEXT: Nigerian University System (5.0 scale)
- First Class: 4.50-5.00 (Excellent)
- Second Class Upper: 3.50-4.49 (Very Good)
- Second Class Lower: 2.40-3.49 (Good)
- Third Class: 1.50-2.39 (Fair)
- Pass: 1.00-1.49 (Minimum)

Please provide:
1. Performance Analysis: Brief assessment of current standing
2. Specific Recommendations: 3-4 actionable steps to improve/maintain performance
3. Study Strategies: Practical study techniques for their level
4. Motivation: Encouraging words and realistic goal setting
5. Next Steps: What to focus on for the upcoming semester

Keep the advice practical, encouraging, and specific to the Nigerian university context. Limit response to 300-400 words.`;

      // Check if API key exists
      if (!process.env.REACT_APP_GEMINI_API_KEY) {
        throw new Error('Gemini API key not found');
      }

      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      
      if (!result || !result.response) {
        throw new Error('No response from AI');
      }
      
      const response = result.response;
      const text = response.text();
      
      if (!text || text.trim() === '') {
        throw new Error('Empty response from AI');
      }
      
      setAiAdvice(text);
      setShowAIAdvisor(true);
    } catch (error) {
      console.error('AI Error Details:', error);
      let errorMessage = 'Sorry, I encountered an error while generating advice. ';
      
      if (error.message.includes('API key')) {
        errorMessage += 'Please check your API key configuration.';
      } else if (error.message.includes('quota') || error.message.includes('limit')) {
        errorMessage += 'API quota exceeded. Please try again later.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage += 'Network error. Please check your connection.';
      } else {
        errorMessage += 'Please try again later.';
      }
      
      setAiAdvice(errorMessage);
      setShowAIAdvisor(true);
    }
    setLoadingAdvice(false);
  };

  // Enhanced Statistics
  const getDetailedStats = () => {
    if (semesters.length === 0) return null;
    
    const allCourses = semesters.flatMap(sem => sem.courses);
    const totalCredits = allCourses.reduce((sum, course) => sum + course.creditHours, 0);
    
    const gradeDistribution = {
      A: allCourses.filter(c => c.score >= 70).length,
      B: allCourses.filter(c => c.score >= 60 && c.score < 70).length,
      C: allCourses.filter(c => c.score >= 50 && c.score < 60).length,
      D: allCourses.filter(c => c.score >= 45 && c.score < 50).length,
      E: allCourses.filter(c => c.score >= 40 && c.score < 45).length,
      F: allCourses.filter(c => c.score < 40).length,
    };
    
    const averageScore = allCourses.reduce((sum, course) => sum + course.score, 0) / allCourses.length;
    const semesterGPAs = semesters.map(sem => calculateGPA(sem.courses));
    const bestGPA = Math.max(...semesterGPAs);
    const worstGPA = Math.min(...semesterGPAs);
    
    return {
      totalCourses: allCourses.length,
      totalCredits,
      averageScore: averageScore.toFixed(1),
      gradeDistribution,
      bestGPA: bestGPA.toFixed(2),
      worstGPA: worstGPA.toFixed(2),
      improvement: semesterGPAs.length > 1 ? 
        (semesterGPAs[semesterGPAs.length - 1] - semesterGPAs[0]).toFixed(2) : '0.00'
    };
  };

  // Export Data Functions
  const exportToJSON = () => {
    const data = {
      semesters,
      cgpa: calculateCGPA(),
      classification: getClassification(calculateCGPA()),
      exportDate: new Date().toISOString(),
      stats: getDetailedStats()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cgpa-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    const headers = ['Semester', 'Course Name', 'Course Code', 'Credit Hours', 'Score', 'Grade', 'Points'];
    const rows = [headers];
    
    semesters.forEach(semester => {
      semester.courses.forEach(course => {
        const gradeInfo = getGradeFromScore(course.score);
        rows.push([
          `${semester.name} ${semester.year}`,
          course.name,
          course.code,
          course.creditHours,
          course.score,
          gradeInfo.grade,
          gradeInfo.points
        ]);
      });
    });
    
    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cgpa-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareResults = async () => {
    const cgpa = calculateCGPA();
    const classification = getClassification(cgpa);
    const text = `🎓 My CGPA: ${cgpa.toFixed(2)}/5.0 (${classification.class})\n📚 Calculated with gradeWise\n\nBuilt with ❤️ by Godspower Maurice`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My CGPA Results',
          text: text,
          url: window.location.href
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(text);
      alert('Results copied to clipboard!');
    }
  };

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedSemesters = localStorage.getItem('cgpa-semesters');
    const savedDarkMode = localStorage.getItem('cgpa-darkmode');
    
    if (savedSemesters) {
      setSemesters(JSON.parse(savedSemesters));
    }
    if (savedDarkMode) {
      setDarkMode(JSON.parse(savedDarkMode));
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('cgpa-semesters', JSON.stringify(semesters));
  }, [semesters]);

  useEffect(() => {
    localStorage.setItem('cgpa-darkmode', JSON.stringify(darkMode));
  }, [darkMode]);

  const addSemester = (semesterData) => {
    const newSemester = {
      id: Date.now(),
      name: semesterData.name,
      year: semesterData.year,
      courses: []
    };
    setSemesters(prev => [...prev, newSemester]);
    setShowAddSemester(false);
  };

  const addCourse = (courseData) => {
    setSemesters(prev => prev.map(semester => 
      semester.id === currentSemester.id 
        ? { ...semester, courses: [...semester.courses, { ...courseData, id: Date.now() }] }
        : semester
    ));
    setShowAddCourse(false);
  };

  const deleteCourse = (semesterId, courseId) => {
    setSemesters(prev => prev.map(semester => 
      semester.id === semesterId 
        ? { ...semester, courses: semester.courses.filter(course => course.id !== courseId) }
        : semester
    ));
  };

  const deleteSemester = (semesterId) => {
    setSemesters(prev => prev.filter(semester => semester.id !== semesterId));
    setCurrentSemester(null);
  };

  const cgpa = calculateCGPA();
  const classification = getClassification(cgpa);

  return (
    <div className={`min-h-screen transition-all duration-500 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900' 
        : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'
    }`}>
      {/* Header */}
      <div className={`backdrop-blur-xl border-b ${
        darkMode 
          ? 'bg-gray-800/30 border-gray-700/50' 
          : 'bg-white/30 border-gray-200/50'
      } sticky top-0 z-50`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl ${
                darkMode ? 'bg-gradient-to-r from-blue-500 to-purple-600' : 'bg-gradient-to-r from-blue-600 to-purple-700'
              } flex items-center justify-center`}>
                <span className="text-white font-bold text-lg">📊</span>
              </div>
              <div>
                <h1 className={`text-xl font-bold ${
                  darkMode ? 'text-white' : 'text-gray-800'
                }`}>GradeWise</h1>
                <p className={`text-xs ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>AKSU Accounting CGPA Calculator • AI-Powered</p>
              </div>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-3 rounded-xl transition-all duration-300 ${
                darkMode 
                  ? 'bg-gray-700/50 hover:bg-gray-600/50 text-yellow-400' 
                  : 'bg-white/50 hover:bg-white/70 text-gray-700'
              } backdrop-blur-sm`}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* CGPA Overview */}
        <div className={`p-6 rounded-2xl mb-6 backdrop-blur-xl ${
          darkMode 
            ? 'bg-gradient-to-r from-gray-800/40 to-gray-700/40 border border-gray-600/30' 
            : 'bg-gradient-to-r from-white/60 to-gray-50/60 border border-gray-200/50'
        } shadow-xl`}>
          <div className="text-center">
            <h2 className={`text-lg font-semibold mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>Cumulative GPA</h2>
            <div className={`text-5xl font-bold mb-2 ${
              darkMode ? 'text-white' : 'text-gray-800'
            }`}>
              {cgpa.toFixed(2)}
            </div>
            <div className={`text-lg font-medium ${classification.color}`}>
              {classification.class}
            </div>
            <div className={`text-sm mt-2 ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {semesters.length} Semester{semesters.length !== 1 ? 's' : ''} • {
                semesters.reduce((total, sem) => total + sem.courses.length, 0)
              } Course{semesters.reduce((total, sem) => total + sem.courses.length, 0) !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* PWA Install Prompt */}
        {showInstallPrompt && (
          <div className="fixed top-4 left-4 right-4 z-50">
            <div className={`p-4 rounded-2xl backdrop-blur-xl ${
              darkMode 
                ? 'bg-blue-900/80 border border-blue-700/50' 
                : 'bg-blue-50/90 border border-blue-200/50'
            } shadow-xl animate-pulse`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">📱</div>
                  <div>
                    <h3 className={`font-semibold ${
                      darkMode ? 'text-white' : 'text-gray-800'
                    }`}>Install App</h3>
                    <p className={`text-sm ${
                      darkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>Get the full mobile experience!</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleInstallClick}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors duration-300"
                  >
                    Install
                  </button>
                  <button
                    onClick={() => setShowInstallPrompt(false)}
                    className={`px-3 py-2 rounded-lg text-sm ${
                      darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-800'
                    } transition-colors duration-300`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Action Bar */}
        {semesters.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            <button
              onClick={() => setShowAddSemester(true)}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-300 flex items-center space-x-2 ${
                darkMode 
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white' 
                  : 'bg-gradient-to-r from-blue-700 to-purple-700 hover:from-blue-600 hover:to-purple-600 text-white'
              } shadow-lg hover:shadow-xl transform hover:scale-105`}
            >
              <span>+</span>
              <span>Semester</span>
            </button>
            
            <button
              onClick={generateAIAdvice}
              disabled={loadingAdvice}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-300 flex items-center space-x-2 ${
                darkMode 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white' 
                  : 'bg-gradient-to-r from-purple-700 to-pink-700 hover:from-purple-600 hover:to-pink-600 text-white'
              } shadow-lg hover:shadow-xl transform hover:scale-105 ${loadingAdvice ? 'opacity-75 cursor-not-allowed' : ''}`}
            >
              <span>🤖</span>
              <span>{loadingAdvice ? 'Getting Advice...' : 'AI Advice'}</span>
              {loadingAdvice && <div className="animate-spin">⏳</div>}
            </button>
            
            <button
              onClick={shareResults}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-300 flex items-center space-x-2 ${
                darkMode 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white' 
                  : 'bg-gradient-to-r from-indigo-700 to-purple-700 hover:from-indigo-600 hover:to-purple-600 text-white'
              } shadow-lg hover:shadow-xl transform hover:scale-105`}
            >
              <span>📱</span>
              <span>Share</span>
            </button>
          </div>
        )}

        {/* Simple Add Semester Button for new users */}
        {semesters.length === 0 && (
          <div className="flex justify-center mb-6">
            <button
              onClick={() => setShowAddSemester(true)}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                darkMode 
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white' 
                  : 'bg-gradient-to-r from-blue-700 to-purple-700 hover:from-blue-600 hover:to-purple-600 text-white'
              } shadow-lg hover:shadow-xl transform hover:scale-105`}
            >
              + Add Your First Semester
            </button>
          </div>
        )}

        {/* Semesters List */}
        <div className="space-y-4">
          {semesters.map((semester) => (
            <SemesterCard
              key={semester.id}
              semester={semester}
              darkMode={darkMode}
              onSelectSemester={setCurrentSemester}
              onDeleteSemester={deleteSemester}
              onDeleteCourse={deleteCourse}
              calculateGPA={calculateGPA}
              getGradeFromScore={getGradeFromScore}
              setShowAddCourse={setShowAddCourse}
            />
          ))}
        </div>

        {semesters.length === 0 && (
          <div className={`text-center py-12 ${
            darkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold mb-2">No semesters added yet</h3>
            <p>Add your first semester to start calculating your CGPA</p>
            <p className="text-sm mt-2">Once you have data, you can get personalized AI academic advice! 🤖</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className={`mt-12 py-6 border-t ${
        darkMode ? 'border-gray-700/50' : 'border-gray-200/50'
      }`}>
        <div className="text-center">
          <p className={`text-sm ${
            darkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Built with ❤️ by <span className="font-semibold text-blue-500">Godspower Maurice</span>
          </p>
          <p className={`text-xs mt-1 ${
            darkMode ? 'text-gray-500' : 'text-gray-500'
          }`}>
            AKSU Accounting Dept CGPA Calculator • with AI Academic Advisor
          </p>
        </div>
      </footer>

      {/* Add Semester Modal */}
      {showAddSemester && (
        <AddSemesterModal
          darkMode={darkMode}
          onAdd={addSemester}
          onClose={() => setShowAddSemester(false)}
        />
      )}

      {/* Add Course Modal */}
      {showAddCourse && currentSemester && (
        <AddCourseModal
          darkMode={darkMode}
          onAdd={addCourse}
          onClose={() => setShowAddCourse(false)}
          gradeScale={gradeScale}
        />
      )}

      {/* AI Advisor Modal */}
      {showAIAdvisor && (
        <AIAdvisorModal
          darkMode={darkMode}
          advice={aiAdvice}
          cgpa={cgpa}
          classification={classification}
          onClose={() => setShowAIAdvisor(false)}
        />
      )}
    </div>
  );
};

// AI Advisor Modal Component
const AIAdvisorModal = ({ darkMode, advice, cgpa, classification, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className={`rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto ${
        darkMode 
          ? 'bg-gray-800 border border-gray-600' 
          : 'bg-white border border-gray-200'
      } shadow-2xl`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-xl ${
              darkMode ? 'bg-gradient-to-r from-purple-500 to-pink-600' : 'bg-gradient-to-r from-purple-600 to-pink-700'
            } flex items-center justify-center`}>
              <span className="text-white font-bold text-xl">🤖</span>
            </div>
            <div>
              <h2 className={`text-xl font-bold ${
                darkMode ? 'text-white' : 'text-gray-800'
              }`}>AI Academic Advisor</h2>
              <p className={`text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                CGPA: {cgpa.toFixed(2)} • {classification.class}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${
              darkMode 
                ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            } transition-colors duration-300`}
          >
            ✕
          </button>
        </div>
        
        <div className={`prose max-w-none ${
          darkMode ? 'prose-invert' : ''
        }`}>
          <div className={`whitespace-pre-line text-sm leading-relaxed ${
            darkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            {advice}
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className={`text-xs text-center ${
            darkMode ? 'text-gray-500' : 'text-gray-400'
          }`}>
            💡 This advice is generated by AI based on your academic data. Always consult with your academic advisor for official guidance.
          </div>
        </div>
      </div>
    </div>
  );
};

// Semester Card Component (unchanged from previous version)
const SemesterCard = ({ 
  semester, 
  darkMode, 
  onSelectSemester, 
  onDeleteSemester, 
  onDeleteCourse, 
  calculateGPA, 
  getGradeFromScore,
  setShowAddCourse 
}) => {
  const [expanded, setExpanded] = useState(false);
  const gpa = calculateGPA(semester.courses);

  return (
    <div className={`rounded-2xl overflow-hidden backdrop-blur-xl ${
      darkMode 
        ? 'bg-gray-800/40 border border-gray-600/30' 
        : 'bg-white/60 border border-gray-200/50'
    } shadow-lg`}>
      <div
        className={`p-4 cursor-pointer transition-all duration-300 ${
          darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50/50'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`font-semibold text-lg ${
              darkMode ? 'text-white' : 'text-gray-800'
            }`}>
              {semester.name} - {semester.year}
            </h3>
            <p className={`text-sm ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {semester.courses.length} courses • GPA: {gpa.toFixed(2)}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`text-2xl font-bold ${
              darkMode ? 'text-blue-400' : 'text-blue-600'
            }`}>
              {gpa.toFixed(2)}
            </div>
            <span className={`transform transition-transform duration-300 ${
              expanded ? 'rotate-180' : ''
            } ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              ▼
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className={`border-t ${
          darkMode ? 'border-gray-600/30' : 'border-gray-200/50'
        }`}>
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className={`font-medium ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>Courses</h4>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    onSelectSemester(semester);
                    setShowAddCourse(true);
                  }}
                  className={`px-3 py-1 text-sm rounded-lg ${
                    darkMode 
                      ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                      : 'bg-blue-700 hover:bg-blue-600 text-white'
                  } transition-colors duration-300`}
                >
                  Add Course
                </button>
                <button
                  onClick={() => onDeleteSemester(semester.id)}
                  className={`px-3 py-1 text-sm rounded-lg ${
                    darkMode 
                      ? 'bg-red-600 hover:bg-red-500 text-white' 
                      : 'bg-red-700 hover:bg-red-600 text-white'
                  } transition-colors duration-300`}
                >
                  Delete
                </button>
              </div>
            </div>

            {semester.courses.length === 0 ? (
              <div className={`text-center py-6 ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <p>No courses added yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {semester.courses.map((course) => {
                  const gradeInfo = getGradeFromScore(course.score);
                  return (
                    <div
                      key={course.id}
                      className={`p-3 rounded-lg ${
                        darkMode ? 'bg-gray-700/30' : 'bg-gray-50/50'
                      } flex justify-between items-center`}
                    >
                      <div>
                        <div className={`font-medium ${
                          darkMode ? 'text-white' : 'text-gray-800'
                        }`}>
                          {course.name} ({course.code})
                        </div>
                        <div className={`text-sm ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {course.creditHours} units • {course.score}% • Grade: {gradeInfo.grade}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`font-bold ${
                          gradeInfo.points >= 4.0 ? 'text-green-500' :
                          gradeInfo.points >= 3.0 ? 'text-blue-500' :
                          gradeInfo.points >= 2.0 ? 'text-yellow-500' :
                          gradeInfo.points >= 1.0 ? 'text-orange-500' : 'text-red-500'
                        }`}>
                          {gradeInfo.points.toFixed(1)}
                        </div>
                        <button
                          onClick={() => onDeleteCourse(semester.id, course.id)}
                          className={`text-red-500 hover:text-red-400 transition-colors duration-300`}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Add Semester Modal (unchanged from previous version)
const AddSemesterModal = ({ darkMode, onAdd, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    year: new Date().getFullYear()
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name.trim()) {
      onAdd(formData);
      setFormData({ name: '', year: new Date().getFullYear() });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className={`rounded-2xl p-6 w-full max-w-md ${
        darkMode 
          ? 'bg-gray-800 border border-gray-600' 
          : 'bg-white border border-gray-200'
      } shadow-2xl`}>
        <h2 className={`text-xl font-bold mb-4 ${
          darkMode ? 'text-white' : 'text-gray-800'
        }`}>Add Semester</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Semester Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Fall Semester, 1st Semester"
              className={`w-full p-3 rounded-lg border ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-800 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              required
            />
          </div>
          
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Year
            </label>
            <input
              type="number"
              value={formData.year}
              onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
              min="2000"
              max="2030"
              className={`w-full p-3 rounded-lg border ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-800'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              required
            />
          </div>
          
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-3 rounded-lg border ${
                darkMode 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              } transition-colors duration-300`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all duration-300"
            >
              Add Semester
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add Course Modal (unchanged from previous version)
const AddCourseModal = ({ darkMode, onAdd, onClose, gradeScale }) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    creditHours: 3,
    score: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name.trim() && formData.code.trim() && formData.score !== '') {
      onAdd({
        ...formData,
        score: parseFloat(formData.score),
        creditHours: parseInt(formData.creditHours)
      });
      setFormData({ name: '', code: '', creditHours: 3, score: '' });
    }
  };

  const getPreviewGrade = () => {
    if (!formData.score) return null;
    const score = parseFloat(formData.score);
    for (const [grade, range] of Object.entries(gradeScale)) {
      if (score >= range.min && score <= range.max) {
        return { grade, points: range.points };
      }
    }
    return { grade: 'F', points: 0.0 };
  };

  const previewGrade = getPreviewGrade();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className={`rounded-2xl p-6 w-full max-w-md ${
        darkMode 
          ? 'bg-gray-800 border border-gray-600' 
          : 'bg-white border border-gray-200'
      } shadow-2xl`}>
        <h2 className={`text-xl font-bold mb-4 ${
          darkMode ? 'text-white' : 'text-gray-800'
        }`}>Add Course</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Course Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Mathematics"
              className={`w-full p-3 rounded-lg border ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-800 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              required
            />
          </div>
          
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Course Code
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
              placeholder="e.g., MATH101"
              className={`w-full p-3 rounded-lg border ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-800 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              required
            />
          </div>
          
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Credit Hours/Units
            </label>
            <select
              value={formData.creditHours}
              onChange={(e) => setFormData(prev => ({ ...prev, creditHours: parseInt(e.target.value) }))}
              className={`w-full p-3 rounded-lg border ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-800'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              {[1, 2, 3, 4, 5, 6].map(num => (
                <option key={num} value={num}>{num} Unit{num !== 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
          
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Score (0-100)
            </label>
            <input
              type="number"
              value={formData.score}
              onChange={(e) => setFormData(prev => ({ ...prev, score: e.target.value }))}
              placeholder="e.g., 85"
              min="0"
              max="100"
              step="0.1"
              className={`w-full p-3 rounded-lg border ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-800 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              required
            />
            {previewGrade && (
              <div className={`mt-2 text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Grade: <span className={`font-bold ${
                  previewGrade.points >= 4.0 ? 'text-green-500' :
                  previewGrade.points >= 3.0 ? 'text-blue-500' :
                  previewGrade.points >= 2.0 ? 'text-yellow-500' :
                  previewGrade.points >= 1.0 ? 'text-orange-500' : 'text-red-500'
                }`}>
                  {previewGrade.grade} ({previewGrade.points.toFixed(1)} points)
                </span>
              </div>
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-3 rounded-lg border ${
                darkMode 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              } transition-colors duration-300`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all duration-300"
            >
              Add Course
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default App;
