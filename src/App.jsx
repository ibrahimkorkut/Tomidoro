import { useState, useEffect, useRef } from 'react';
import defaultAlarmSound from '/alarm.wav';
import settingsIcon from './assets/settings.png';

const MODES = {
  pomodoro: {
    label: 'Pomodoro',
    time: 25 * 60,
    color: 'var(--color-pomodoro)',
  },
  short: {
    label: 'Short Break',
    time: 5 * 60,
    color: 'var(--color-short)',
  },
  long: {
    label: 'Long Break',
    time: 15 * 60,
    color: 'var(--color-long)',
  },
  custom: {
    label: 'Custom',
    time: 0, // Default start for custom
    color: 'var(--color-custom)',
  },
};

const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

function App() {
  const [mode, setMode] = useState('pomodoro');
  const [timeLeft, setTimeLeft] = useState(MODES.pomodoro.time); // Start at 25:00 instead of 0
  const [customTime, setCustomTime] = useState(MODES.custom.time); // Persist custom time
  const [isActive, setIsActive] = useState(false);
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);

  // Options menu state
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [customAlarms, setCustomAlarms] = useState(() => {
    const saved = localStorage.getItem('customAlarms');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedAlarm, setSelectedAlarm] = useState(() => {
    return localStorage.getItem('selectedAlarm') || 'default';
  });

  const timerRef = useRef(null);
  const endTimeRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(new Audio(defaultAlarmSound));

  const currentMode = MODES[mode];

  // Update body background color - DISABLED for Tomato Theme
  // useEffect(() => {
  //   document.body.style.backgroundColor = `color-mix(in srgb, ${currentMode.color}, #151515 85%)`;
  // }, [mode, currentMode]);

  // Save custom alarms to localStorage
  useEffect(() => {
    localStorage.setItem('customAlarms', JSON.stringify(customAlarms));
  }, [customAlarms]);

  // Save selected alarm to localStorage
  useEffect(() => {
    localStorage.setItem('selectedAlarm', selectedAlarm);
  }, [selectedAlarm]);

  // Update audio source when selected alarm changes
  useEffect(() => {
    if (selectedAlarm === 'default') {
      audioRef.current.src = defaultAlarmSound;
    } else {
      const customAlarm = customAlarms.find(a => a.id === selectedAlarm);
      if (customAlarm) {
        audioRef.current.src = customAlarm.data;
      }
    }
  }, [selectedAlarm, customAlarms]);

  // Configure Audio
  useEffect(() => {
    audioRef.current.loop = true;
    audioRef.current.volume = 0.6;

    return () => {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    };
  }, []);

  // Optimized Timer Logic
  useEffect(() => {
    if (isActive) {
      if (!endTimeRef.current) {
        endTimeRef.current = Date.now() + timeLeft * 1000;
      }

      timerRef.current = setInterval(() => {
        const now = Date.now();
        const diff = endTimeRef.current - now;
        const secondsRemaining = Math.max(0, Math.ceil(diff / 1000));

        // OPTIMIZATION: Update Title directly for background/minimized state
        document.title = 'Tomidoro';

        // OPTIMIZATION: Only trigger React re-render if visible
        // This saves massive CPU on low-end PCs when app is minimized
        if (!document.hidden) {
          setTimeLeft(secondsRemaining);
        }

        if (secondsRemaining <= 0) {
          // Timer Finished
          handleTimerFinished();
        }
      }, 200); // Check more frequently (200ms) for smoother title updates, but render conditional
    } else {
      clearInterval(timerRef.current);
      endTimeRef.current = null;
    }

    return () => clearInterval(timerRef.current);
  }, [isActive, currentMode]);

  // Sync state when becoming visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isActive && endTimeRef.current) {
        const now = Date.now();
        const diff = endTimeRef.current - now;
        const secondsRemaining = Math.max(0, Math.ceil(diff / 1000));
        setTimeLeft(secondsRemaining);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isActive]);

  const handleTimerFinished = () => {
    setIsActive(false);
    clearInterval(timerRef.current);
    setTimeLeft(0);
    setIsAlarmRinging(true);
    audioRef.current.play().catch(e => console.error("Error playing alarm:", e));

    // Explicit title update on finish
    document.title = 'Tomidoro';

    if (Notification.permission === 'granted') {
      new Notification("Timer Finished!", { body: `${currentMode.label} is over.` });
    }
  };

  // Initial Title Set
  useEffect(() => {
    if (!isActive) {
      document.title = 'Tomidoro';
    }
  }, [timeLeft, currentMode, isActive]);

  const switchMode = (newMode) => {
    setMode(newMode);
    stopAlarm();
    setIsActive(false);
    endTimeRef.current = null;

    if (newMode === 'custom') {
      setTimeLeft(customTime);
    } else {
      setTimeLeft(MODES[newMode].time);
    }
  };

  const toggleTimer = () => {
    if (isAlarmRinging) {
      stopAlarm();
    } else {
      if (!isActive && timeLeft === 0) {
        // Auto-start with default/custom time if starting from 00:00
        const duration = mode === 'custom' ? customTime : MODES[mode].time;
        if (duration <= 0) return;
        setTimeLeft(duration);
        endTimeRef.current = Date.now() + duration * 1000;
        setIsActive(true);
      } else {
        setIsActive(!isActive);
        if (!isActive) {
          // Starting: Calculate end time based on CURRENT timeLeft
          endTimeRef.current = Date.now() + timeLeft * 1000;
        } else {
          // Pausing: endTimeRef cleared by effect cleanup/logic, but we keep timeLeft
          endTimeRef.current = null;
        }
      }
    }
  };

  const resetTimer = () => {
    stopAlarm();
    setIsActive(false);
    endTimeRef.current = null;
    if (mode === 'custom') {
      setTimeLeft(customTime);
    } else {
      setTimeLeft(MODES[mode].time);
    }
  };

  const stopAlarm = () => {
    setIsAlarmRinging(false);
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };

  // Logic to adjust time in Custom Mode
  const adjustTime = (amount) => {
    if (mode !== 'custom' || isActive) return;

    const newTime = Math.max(0, customTime + amount); // Minimum 0 seconds
    setCustomTime(newTime);
    setTimeLeft(newTime);
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        alert("File is too large! Please choose a file under 2MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const newAlarm = {
          id: Date.now().toString(),
          name: file.name,
          data: e.target.result
        };
        setCustomAlarms([...customAlarms, newAlarm]);
        setSelectedAlarm(newAlarm.id);
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteAlarm = (id) => {
    setCustomAlarms(customAlarms.filter(a => a.id !== id));
    if (selectedAlarm === id) {
      setSelectedAlarm('default');
    }
  };

  // Inline SVGs
  const SettingsIcon = () => (
    <img src={settingsIcon} alt="Settings" style={{ width: '32px', height: '32px', opacity: 0.9 }} />
  );

  const PlayIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
  );

  const PauseIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
  );

  const ResetIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
  );

  const StopAlarmIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
  );

  const XIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
  );

  const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
  );

  const GithubIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405 1.02 0 2.04.135 3 .405 2.28-1.545 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
  );

  const LinkedinIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
  );

  return (
    <>
      <button
        className="settings-btn"
        onClick={() => setIsOptionsOpen(true)}
        aria-label="Settings"
      >
        <SettingsIcon />
      </button>

      <div className="container" style={{
        '--theme-color': currentMode.color,
        borderTop: `4px solid ${currentMode.color}`
      }}>
        {/* Settings button moved out */}
        <header className="tabs">
          {Object.keys(MODES).map((key) => (
            <button
              key={key}
              onClick={() => switchMode(key)}
              className={`tab-btn ${mode === key ? 'active' : ''}`}
            >
              {MODES[key].label}
            </button>
          ))}
        </header>

        <div className="timer-display">
          <h1>{formatTime(timeLeft)}</h1>
        </div>

        {mode === 'custom' && !isActive && (
          <div className="custom-controls">
            <div className="adj-group">
              <button onClick={() => adjustTime(-3600)}>-1h</button>
              <button onClick={() => adjustTime(3600)}>+1h</button>
            </div>
            <div className="adj-group">
              <button onClick={() => adjustTime(-60)}>-1m</button>
              <button onClick={() => adjustTime(60)}>+1m</button>
            </div>
            <div className="adj-group">
              <button onClick={() => adjustTime(-10)}>-10s</button>
              <button onClick={() => adjustTime(10)}>+10s</button>
            </div>
          </div>
        )}

        <div className="controls">
          {isAlarmRinging ? (
            <button className="control-btn big" onClick={stopAlarm} aria-label="Stop Alarm" style={{ backgroundColor: '#ff4757', animation: 'pulse 1s infinite' }}>
              <StopAlarmIcon />
            </button>
          ) : (
            <button className="control-btn big" onClick={toggleTimer} aria-label={isActive ? "Pause" : "Start"}>
              {isActive ? <PauseIcon /> : <PlayIcon />}
            </button>
          )}

          <button className="control-btn small" onClick={resetTimer} aria-label="Reset">
            <ResetIcon />
          </button>
        </div>

        <style>{`
        @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.7); }
            70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(255, 71, 87, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); }
        }
        .custom-controls {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: center;
            gap: 15px;
            margin-bottom: 10px;
            animation: fadeIn 0.3s ease;
        }
        .adj-group {
            display: flex;
            gap: 10px;
            justify-content: center;
        }
        .adj-group button {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: var(--palette-cream);
            padding: 5px 12px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.8rem;
            transition: all 0.2s;
        }
        .adj-group button:hover {
            background: rgba(255,255,255,0.2);
            transform: translateY(-1px);
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        /* Settings Button */
        .settings-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: rgba(255, 255, 255, 0.6);
            cursor: pointer;
            transition: all 0.2s;
            padding: 8px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1001;
        }
        .settings-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            color: var(--palette-cream);
            transform: rotate(45deg);
        }

        /* Modal Styles */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(5px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: fadeIn 0.2s ease-out;
        }
        
        .modal-content {
            background: #1e1e1e;
            width: 90%;
            max-width: 400px;
            border-radius: 20px;
            padding: 24px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.1);
            color: var(--palette-cream);
            position: relative;
            animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding-bottom: 15px;
        }

        .modal-header h2 {
            font-size: 1.5rem;
            margin: 0;
        }

        .close-btn {
            background: transparent;
            border: none;
            color: rgba(255,255,255,0.5);
            cursor: pointer;
            padding: 5px;
            border-radius: 50%;
            transition: all 0.2s;
            display: flex;
        }
        .close-btn:hover {
            background: rgba(255,255,255,0.1);
            color: white;
        }

        .alarm-section h3 {
            font-size: 1rem;
            margin-bottom: 10px;
            opacity: 0.8;
        }

        .alarm-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: 200px;
            overflow-y: auto;
            margin-bottom: 20px;
            padding-right: 5px;
        }

        .alarm-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(255,255,255,0.05);
            padding: 10px 15px;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid transparent;
        }

        .alarm-item:hover {
            background: rgba(255,255,255,0.1);
        }

        .alarm-item.selected {
            border-color: var(--theme-color);
            background: rgba(255,255,255,0.08);
        }

        .alarm-name {
            font-size: 0.9rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 200px;
        }

        .delete-btn {
            background: transparent;
            border: none;
            color: #ff4757;
            cursor: pointer;
            padding: 5px;
            opacity: 0.6;
            transition: all 0.2s;
            display: flex;
        }
        .delete-btn:hover {
            opacity: 1;
            transform: scale(1.1);
        }

        .upload-btn {
            display: block;
            width: 100%;
            background: rgba(255,255,255,0.1);
            border: 2px dashed rgba(255,255,255,0.2);
            color: rgba(255,255,255,0.7);
            padding: 12px;
            border-radius: 12px;
            cursor: pointer;
            text-align: center;
            transition: all 0.2s;
            font-size: 0.9rem;
        }
        .upload-btn:hover {
            background: rgba(255,255,255,0.15);
            border-color: rgba(255,255,255,0.4);
            color: white;
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        /* Custom scrollbar for alarm list */
        .alarm-list::-webkit-scrollbar {
            width: 6px;
        }
        .alarm-list::-webkit-scrollbar-track {
            background: transparent;
        }
        .alarm-list::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
        }
        .alarm-list::-webkit-scrollbar-thumb:hover {
            background: rgba(255,255,255,0.2);
        }
      `}</style>
      </div>

      {isOptionsOpen && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) setIsOptionsOpen(false);
        }}>
          <div className="modal-content" style={{ '--theme-color': currentMode.color }}>
            <div className="modal-header">
              <h2>Settings</h2>
              <button className="close-btn" onClick={() => setIsOptionsOpen(false)}>
                <XIcon />
              </button>
            </div>

            <div className="alarm-section">
              <h3>Choose Alarm Sound</h3>
              <div className="alarm-list">
                <div
                  className={`alarm-item ${selectedAlarm === 'default' ? 'selected' : ''}`}
                  onClick={() => setSelectedAlarm('default')}
                >
                  <span className="alarm-name">Default Alarm</span>
                </div>

                {customAlarms.map(alarm => (
                  <div
                    key={alarm.id}
                    className={`alarm-item ${selectedAlarm === alarm.id ? 'selected' : ''}`}
                    onClick={() => setSelectedAlarm(alarm.id)}
                  >
                    <span className="alarm-name">{alarm.name}</span>
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAlarm(alarm.id);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>

              <label className="upload-btn">
                + Add Custom Alarm (MP3/WAV)
                <input
                  type="file"
                  accept="audio/*"
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="watermark">
        <div className="social-links">
          <a href="https://github.com/ibrahimkorkut" target="_blank" rel="noopener noreferrer"><GithubIcon /></a>
          <a href="https://www.linkedin.com/in/ibrahim-korkut-21845b335/" target="_blank" rel="noopener noreferrer"><LinkedinIcon /></a>
        </div>
        <div className="author-text">Made By İbrahim Korkut</div>
      </div>
    </>
  );
}

export default App;
