"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";

type ViewState = "login" | "search" | "results";

export default function Home() {
  // App State
  const [view, setView] = useState<ViewState>("login");
  
  // Login State
  const [eventCode, setEventCode] = useState("");
  const [checkingEvent, setCheckingEvent] = useState(false);

  // Search State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  
  // Results State
  const [results, setResults] = useState<any[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("eventCode");
    if (code) {
      setEventCode(code);
      validateAndEnter(code);
    }
  }, []);

  useEffect(() => {
    setSelectedPhotos([]);
    setIsSelectAll(false);
  }, [results]);

  // --- Login Handlers ---
  
  const validateAndEnter = async (code: string) => {
    setCheckingEvent(true);
    try {
      await axios.get(`${apiUrl}/events/${code}`);
      setView("search");
    } catch (error) {
      console.error(error);
      // Stay on login page if invalid
    } finally {
      setCheckingEvent(false);
    }
  };

  const handleLogin = async () => {
    if (!eventCode) return alert("Please enter an Event Code");

    setCheckingEvent(true);
    // Validate Event Code against Backend
    try {
      await axios.get(`${apiUrl}/events/${eventCode}`);
      setView("search");
    } catch (error) {
      console.error(error);
      alert("Invalid Event Code. Please check and try again.");
    } finally {
      setCheckingEvent(false);
    }
  };

  const handleSelectPhoto = (photoUrl: string) => {
    setSelectedPhotos(prev => 
      prev.includes(photoUrl) ? prev.filter(p => p !== photoUrl) : [...prev, photoUrl]
    );
  };

  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedPhotos([]);
    } else {
      setSelectedPhotos(results.map(p => `${apiUrl}${p.download_url}`));
    }
    setIsSelectAll(!isSelectAll);
  };

  const handleDownloadSelected = async () => {
    if (selectedPhotos.length === 0) return;

    alert("Downloading selected photos. This may take a moment.");

    // try {
    //   const zip = new JSZip();
    //   const promises = selectedPhotos.map(async (url) => {
    //     const response = await axios.get(url, { responseType: 'blob' });
    //     const filename = url.split('/').pop() || 'photo.jpg';
    //     zip.file(filename, response.data);
    //   });

    //   await Promise.all(promises);

    //   zip.generateAsync({ type: 'blob' }).then(content => {
    //     saveAs(content, `ShareMemories_${new Date().toISOString().slice(0,10)}.zip`);
    //   });

    // } catch (error) {
    //   console.error("Failed to download photos", error);
    //   alert("Failed to download photos. Please try again.");
    // }
  };


  // --- Camera/File Handlers ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSearch = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setResults([]);
    setProgress(0);
    setSearchError(null);
    
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("event_id", eventCode);

    try {
      // Post directly to the backend to bypass the Next.js proxy, which can time out
      // or have issues with file uploads.
      const response = await axios.post(`${apiUrl}/search`, formData, {
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || progressEvent.loaded;
          const percentCompleted = Math.round((progressEvent.loaded * 100) / total);
          setProgress(percentCompleted);
        },
      });
      setResults(response.data.matches);
      setView("results");
    } catch (error: any) {
      console.error("Search failed", error);
      const errorMsg = error.response?.data?.detail || "Search failed. Please try again.";
      setSearchError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Helper to resolve backend drive ID to Google Drive URL
  const getDriveThumbUrl = (id: string) => `https://drive.google.com/thumbnail?id=${id}&sz=w600`;
  const getDriveFullUrl = (id: string) => `https://drive.google.com/uc?id=${id}`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Hero Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex justify-between items-center">
          <h1 className="text-2xl font-serif font-bold text-slate-900">Wedding Memories</h1>
          {view !== "login" && (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-600 hidden sm:block">Event: {eventCode}</span>
              <button 
                onClick={() => { 
                  setView("login"); 
                  window.history.pushState({}, '', '/'); 
                }} 
                className="text-sm text-red-500 hover:bg-red-50 px-3 py-1 rounded-full transition-colors"
               >
                Leave Event
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6">

        {/* VIEW: LOGIN */}
        {view === "login" && (
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 p-8 animate-fade-in">
            <h2 className="text-2xl font-semibold mb-6 text-center">Join Event</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Event Code</label>
                <input 
                  type="text" 
                  value={eventCode} 
                  onChange={(e) => setEventCode(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="e.g. WED2024"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <button 
                onClick={handleLogin}
                disabled={checkingEvent}
                className="w-full bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {checkingEvent ? "Checking..." : "Enter Event"}
              </button>
            </div>
          </div>
        )}

        {/* VIEW: SEARCH / CAPTURE */}
        {view === "search" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center animate-fade-in">
            <h2 className="text-xl font-medium mb-2">Find your photos</h2>
            <p className="text-slate-500 mb-8">Upload a clear selfie to find every photo you appeared in.</p>
            
            <div className="flex flex-col items-center gap-6">
              
              {/* Preview or Webcam Area */}
              <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-2xl overflow-hidden bg-slate-900 shadow-inner">
                {preview ? (
                  <img src={preview} alt="Selfie" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                    <span className="text-sm">No Image Selected</span>
                  </div>
                )}
              </div>
            
              {/* Error Alert */}
              {searchError && (
                <div className="w-full max-w-sm mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3 text-left">
                    <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-semibold mb-0.5">Wait, something's not right</p>
                      <p className="text-xs opacity-90">{searchError}</p>
                    </div>
                    <button onClick={() => setSearchError(null)} className="text-red-400 hover:text-red-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="flex flex-col gap-3 w-full max-w-xs">
                
                {selectedFile ? (
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer bg-white border border-slate-300 text-slate-700 px-4 py-3 rounded-xl hover:bg-slate-50 font-semibold text-center">
                      Change Photo
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                    <button onClick={handleSearch} disabled={loading} className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl hover:bg-indigo-700 font-semibold disabled:opacity-50">
                      {loading ? "Scanning..." : "Search"}
                    </button>
                  </div>
                ) : (
                  <label className="block w-full cursor-pointer bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 font-semibold">
                    Upload a Photo
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  </label>
                )}

                {loading && (
                  <div className="w-full mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-xs text-center text-slate-500 mt-1">{progress < 100 ? `Uploading... ${progress}%` : "Analyzing faces..."}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW: RESULTS */}
        {view === "results" && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Your Memories</h2>
                <p className="text-sm text-slate-500">Found {results.length} photos matching you</p>
              </div>
              <button onClick={() => setView("search")} className="text-sm text-indigo-600 hover:underline">
                Try another selfie
              </button>
            </div>

            {results.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="selectAll"
                        checked={isSelectAll}
                        onChange={handleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="selectAll" className="ml-2 block text-sm text-gray-900">
                        Select All
                      </label>
                    </div>
                    <p className="text-sm text-slate-500">{selectedPhotos.length} photos selected</p>
                </div>
                <button
                  onClick={handleDownloadSelected}
                  disabled={selectedPhotos.length === 0}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-slate-300 transition-colors"
                >
                  Download Selected
                </button>
              </div>
            </div>
            )}
            
            {results.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-400">No matches found. Try a clearer selfie with good lighting.</p>
              </div>
            ) : (
              /* Masonry Grid using CSS columns */
              <div className="columns-2 md:columns-3 gap-4 space-y-4">
                {results.map((photo, idx) => (
                  <div key={idx} className="break-inside-avoid relative group overflow-hidden rounded-xl shadow-md hover:shadow-xl transition-all duration-300">
                    <img
                      src={`${apiUrl}${photo.url}`}
                      alt={`Match ${idx}`}
                      className="w-full h-auto object-cover transform transition duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                    <a 
                      href={`${apiUrl}${photo.download_url}`}
                      target="_blank" 
                      download
                      className="absolute bottom-3 right-3 bg-white/90 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-slate-800 hover:text-indigo-600 shadow-sm"
                      title="Download"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    </a>
                    <div className="absolute top-3 left-3">
                      <input
                        type="checkbox"
                        checked={selectedPhotos.includes(`${apiUrl}${photo.download_url}`)}
                        onChange={() => handleSelectPhoto(`${apiUrl}${photo.download_url}`)}
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
