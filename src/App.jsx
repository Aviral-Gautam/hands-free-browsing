// src/App.jsx
import { useState, useEffect } from 'react';
import './App.css';

export default function App() {
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('window');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('gestures');

  const fetchStatus = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_TRACKER_STATUS' }, (res) => {
        if (res) {
          setIsActive(Boolean(res.active));
          setMode(res.mode || 'window');
        }
      });
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleToggleTracking = async () => {
    setLoading(true);
    const action = isActive ? 'STOP_TRACKER' : 'START_TRACKER';
    chrome.runtime.sendMessage({ type: action }, (res) => {
      setLoading(false);
      if (res) {
        setIsActive(!isActive);
      }
    });
  };

  const handleOpenWindow = () => {
    chrome.runtime.sendMessage({ type: 'START_TRACKER' }, () => {
      setIsActive(true);
    });
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <div className="title-row">
          <span className="logo-icon">👁️</span>
          <h1>Hands-Free</h1>
        </div>
        <span className={`status-pill ${isActive ? 'online' : 'offline'}`}>
          {isActive ? 'Tracking' : 'Standby'}
        </span>
      </header>

      <div className="status-card">
        <div className="status-info">
          <div className="status-label">Engine Mode</div>
          <div className="status-val">
            {mode === 'offscreen' ? 'Background Offscreen' : 'Firefox Companion'}
          </div>
        </div>
        <button
          className={`primary-btn ${isActive ? 'stop' : 'start'}`}
          onClick={handleToggleTracking}
          disabled={loading}
        >
          {loading ? 'Please wait...' : isActive ? 'Stop Tracking' : 'Start Tracking'}
        </button>
      </div>

      {!isActive && mode === 'window' && (
        <button className="secondary-btn" onClick={handleOpenWindow}>
          Open Companion Camera Window
        </button>
      )}

      {isActive && mode === 'window' && (
        <button className="secondary-btn" onClick={handleOpenWindow}>
          Focus Camera Window
        </button>
      )}

      {/* Feature Navigation Tabs */}
      <div className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'gestures' ? 'active' : ''}`}
          onClick={() => setActiveTab('gestures')}
        >
          Gestures
        </button>
        <button
          className={`tab-btn ${activeTab === 'media' ? 'active' : ''}`}
          onClick={() => setActiveTab('media')}
        >
          YouTube & Media
        </button>
        <button
          className={`tab-btn ${activeTab === 'voice' ? 'active' : ''}`}
          onClick={() => setActiveTab('voice')}
        >
          Voice & Search
        </button>
      </div>

      {/* Tab 1: Gestures */}
      {activeTab === 'gestures' && (
        <div className="cheatsheet">
          <div className="cheatsheet-title">Tracking & Gestures</div>
          <div className="cheat-item">
            <span className="cheat-icon">🧑</span>
            <span className="cheat-desc"><b>Move Head:</b> Glides cursor & snaps to elements</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">🎯</span>
            <span className="cheat-desc"><b>Dwell (2.0s):</b> Hover 2s to auto-click</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">😉</span>
            <span className="cheat-desc"><b>Wink Left:</b> Immediate click at cursor</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">😉</span>
            <span className="cheat-desc"><b>Wink Right:</b> Smooth scroll up</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">😮</span>
            <span className="cheat-desc"><b>Open Jaw:</b> Smooth scroll down (easy trigger)</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">🤨</span>
            <span className="cheat-desc"><b>Brow Raise:</b> Smooth scroll up</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">😛</span>
            <span className="cheat-desc"><b>Double Blink:</b> Play / Pause media</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">😊</span>
            <span className="cheat-desc"><b>Smile:</b> Toggle Mute</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">⬅️</span>
            <span className="cheat-desc"><b>Left Edge (hold):</b> Go Back</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">➡️</span>
            <span className="cheat-desc"><b>Right Edge (hold):</b> Go Forward</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">😴</span>
            <span className="cheat-desc"><b>Eyes Closed (1.5s):</b> Pause tracking — hold again to resume</span>
          </div>
        </div>
      )}

      {/* Tab 2: Media & YouTube */}
      {activeTab === 'media' && (
        <div className="cheatsheet">
          <div className="cheatsheet-title">YouTube & Video Shortcuts</div>
          <div className="cheat-item">
            <span className="cheat-icon">🚢</span>
            <span className="cheat-desc"><b>Floating Media Dock:</b> Auto-shows on videos</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">⏯️</span>
            <span className="cheat-desc"><b>Play / Pause:</b> Double blink or 'k'</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">⏪</span>
            <span className="cheat-desc"><b>Rewind 10s:</b> Gaze on -10s or 'j'</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">⏩</span>
            <span className="cheat-desc"><b>Forward 10s:</b> Gaze on +10s or 'l'</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">🔇</span>
            <span className="cheat-desc"><b>Mute:</b> Smile or 'm'</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">⛶</span>
            <span className="cheat-desc"><b>Fullscreen:</b> Gaze on ⛶ or 'f'</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">🔍</span>
            <span className="cheat-desc"><b>Search Box:</b> Gaze on Search or '/'</span>
          </div>
        </div>
      )}

      {/* Tab 3: Voice & Search */}
      {activeTab === 'voice' && (
        <div className="cheatsheet">
          <div className="cheatsheet-title">Microphone Commands</div>
          <div className="cheat-item">
            <span className="cheat-icon">🎙️</span>
            <span className="cheat-desc"><b>Voice HUD:</b> Toggle mic with top-right button</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">🔍</span>
            <span className="cheat-desc"><b>"Search [topic]":</b> Types in search & submits</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">✍️</span>
            <span className="cheat-desc"><b>"Type [text]":</b> Dictates into focused input</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">🎬</span>
            <span className="cheat-desc"><b>"Play" / "Pause":</b> Toggles video playback</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">📜</span>
            <span className="cheat-desc"><b>"Scroll down/up":</b> Smooth page scroll</span>
          </div>
          <div className="cheat-item">
            <span className="cheat-icon">🧹</span>
            <span className="cheat-desc"><b>"Clear" / "Enter":</b> Form input controls</span>
          </div>
        </div>
      )}

      <footer className="popup-footer">
        Runs with local MediaPipe WASM in Firefox & Chrome
      </footer>
    </div>
  );
}
