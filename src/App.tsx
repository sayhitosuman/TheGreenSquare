import React, { useState, useEffect } from 'react';
import {
  format, addDays, startOfWeek, subWeeks, addWeeks,
  differenceInCalendarWeeks, isSameDay, isSameWeek,
  isBefore, startOfMonth, eachDayOfInterval
} from 'date-fns';
import { Settings, Download, Upload, X, Trash2, ArrowRight, Plus, Info, Edit2, Smartphone } from 'lucide-react';

// --- TYPES ---
type TaskStatus = 'pending' | 'done' | 'partial' | 'undone';
type Task = { id: string; text: string; status: TaskStatus };
type DayTasks = Record<string, Task[]>;

const App = () => {
  // --- STATE ---
  const [showSplash, setShowSplash] = useState(true);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [journeyName, setJourneyName] = useState('My Journey');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(addDays(new Date(), 365));

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<DayTasks>({});

  const [showSettings, setShowSettings] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');

  // Interaction states
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  // --- PERSISTENCE & PWA ---
  useEffect(() => {
    // Splash screen timer
    const splashTimer = setTimeout(() => setShowSplash(false), 2000);

    // Check if welcome was seen
    const welcomeSeen = localStorage.getItem('greenSquareWelcomeSeen');
    if (welcomeSeen === 'true') {
      setHasSeenWelcome(true);
    }

    const saved = localStorage.getItem('greenSquareData_v5');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setJourneyName(data.journeyName);
        setStartDate(new Date(data.startDate));
        setEndDate(new Date(data.endDate));
        setTasks(data.tasks || {});
        setIsSetup(true);
        setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
        setSelectedDay(startOfDay(new Date()));
      } catch (e) {
        console.error('Failed to load data', e);
      }
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      clearTimeout(splashTimer);
    };
  }, []);

  useEffect(() => {
    if (isSetup) {
      localStorage.setItem('greenSquareData_v5', JSON.stringify({
        journeyName,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        tasks
      }));
    }
  }, [journeyName, startDate, endDate, tasks, isSetup]);

  const installApp = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setDeferredPrompt(null);
      } catch (e) {
        console.error("Install prompt error:", e);
      }
    } else {
      // If prompt isn't ready or supported natively via API, alert fallback 
      // but keeping it simple to not confuse the user with browser menus as requested.
      alert("App can only be installed automatically via this button on supported browsers (Chrome/Edge/Android). For iOS or unsupported browsers, you may need to use the Share or Menu button to 'Add to Home Screen'.");
    }
  };

  // --- HELPERS ---
  const getWeekDays = (weekStart: Date) => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const currentWeekDays = getWeekDays(currentWeekStart);
  const isPastDay = (day: Date) => isBefore(startOfDay(day), startOfDay(today));

  const canEditTask = (day: Date) => {
    const diff = today.getTime() - day.getTime();
    return diff <= 7 * 24 * 60 * 60 * 1000;
  };

  // Auto-fail logic: if day is in the past, pending tasks count as undone.
  const getEffectiveStatus = (task: Task, day: Date): TaskStatus => {
    if (task.status === 'pending' && isPastDay(day)) {
      return 'undone';
    }
    return task.status;
  };

  // --- CORE MATH & SCORING ---
  const getDayScore = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const dayTasks = tasks[dateKey] || [];
    if (dayTasks.length === 0) return 0;

    let score = 0;
    dayTasks.forEach(t => {
      const effectiveStatus = getEffectiveStatus(t, day);
      if (effectiveStatus === 'done') score += 1;
      if (effectiveStatus === 'partial') score += 0.5;
      if (effectiveStatus === 'undone') score -= 1; // Negative scoring penalty
    });
    return score / dayTasks.length; // Can return negative values
  };

  const getIntensityColor = (score: number) => {
    if (score < 0) return 'bg-red-400 border-red-400 text-white';
    if (score === 0) return 'bg-white border-stone-200';
    if (score <= 0.25) return 'bg-[#c6e48b] border-[#c6e48b] text-stone-900';
    if (score <= 0.50) return 'bg-[#7bc96f] border-[#7bc96f] text-stone-900';
    if (score <= 0.75) return 'bg-[#239a3b] border-[#239a3b] text-white';
    return 'bg-[#196127] border-[#196127] text-white'; // 100%
  };

  // --- STAT CALCULATIONS (Out of 10) ---
  const getScoreAverage = (days: Date[]) => {
    if (days.length === 0) return 0;
    const total = days.reduce((sum, d) => sum + getDayScore(d), 0);
    return (total / days.length) * 10;
  };

  const todayScore = getDayScore(today) * 10;
  const activeWeekDays = getWeekDays(startOfWeek(today, { weekStartsOn: 1 }));
  const weeklyScore = getScoreAverage(activeWeekDays);
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(today), end: today });
  const monthlyScore = getScoreAverage(daysInMonth);
  const daysSinceStart = eachDayOfInterval({
    start: startDate,
    end: isBefore(today, endDate) ? today : endDate
  });
  const overallScore = getScoreAverage(daysSinceStart);

  // --- ACTIONS ---
  const handleSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (isBefore(endDate, startDate)) {
      alert("End date must be after start date.");
      return;
    }
    setIsSetup(true);
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const dateKey = format(selectedDay, 'yyyy-MM-dd');

    setTasks(prev => ({
      ...prev,
      [dateKey]: [...(prev[dateKey] || []), {
        id: Math.random().toString(36).substr(2, 9),
        text: newTaskText.trim(),
        status: 'pending'
      }]
    }));
    setNewTaskText('');
  };

  const setTaskStatus = (taskId: string, status: TaskStatus) => {
    if (!canEditTask(selectedDay)) return;
    const dateKey = format(selectedDay, 'yyyy-MM-dd');
    setTasks(prev => {
      const currentDayTasks = prev[dateKey] || [];
      const updated = currentDayTasks.map(t => t.id === taskId ? { ...t, status } : t);
      return { ...prev, [dateKey]: updated };
    });
    setActiveTaskId(null);
  };

  const toggleTaskDone = (taskId: string, currentStatus: TaskStatus) => {
    if (!canEditTask(selectedDay)) return;
    setTaskStatus(taskId, currentStatus === 'done' ? 'pending' : 'done');
  };

  const saveEditedTask = (taskId: string) => {
    if (!editingText.trim()) return;
    const dateKey = format(selectedDay, 'yyyy-MM-dd');
    setTasks(prev => {
      const currentDayTasks = prev[dateKey] || [];
      const updated = currentDayTasks.map(t => t.id === taskId ? { ...t, text: editingText.trim() } : t);
      return { ...prev, [dateKey]: updated };
    });
    setEditingTaskId(null);
  };

  const exportData = () => {
    const data = JSON.stringify({ journeyName, startDate, endDate, tasks });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `green_square_backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.startDate && data.endDate) {
          setJourneyName(data.journeyName || 'My Journey');
          setStartDate(new Date(data.startDate));
          setEndDate(new Date(data.endDate));
          setTasks(data.tasks || {});
          setIsSetup(true);
          alert("Backup restored successfully!");
        }
      } catch (err) {
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  };

  // --- JOURNEY MAP DATA ---
  const totalWeeks = Math.max(1, differenceInCalendarWeeks(endDate, startDate, { weekStartsOn: 1 }) + 1);
  const allWeeks = Array.from({ length: totalWeeks }).map((_, i) => addDays(startOfWeek(startDate, { weekStartsOn: 1 }), i * 7));

  const years: Date[][] = [];
  for (let i = 0; i < allWeeks.length; i += 52) {
    years.push(allWeeks.slice(i, i + 52));
  }

  // --- RENDER ---
  if (showSplash) {
    return (
      <div className="min-h-screen bg-[#f6f5f0] flex flex-col items-center justify-center p-4 font-sans selection:bg-stone-200">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-12 h-12 bg-[#196127]"></div>
          <h1 className="text-3xl font-serif text-stone-900">The Green <i className="text-stone-500">Square</i></h1>
        </div>
        <p className="fixed bottom-10 text-[10px] font-mono tracking-widest text-stone-400 uppercase">
          By sayhitosuman
        </p>
      </div>
    );
  }

  if (!hasSeenWelcome) {
    return (
      <div className="min-h-screen bg-[#f6f5f0] text-stone-800 flex items-center justify-center p-4 font-sans selection:bg-stone-200">
        <div className="bg-white border border-stone-300 p-6 w-full max-w-md">
          <div className="flex items-center gap-2 mb-6 border-b border-stone-100 pb-4 justify-center">
            <div className="w-5 h-5 bg-[#196127]"></div>
            <h1 className="text-2xl font-serif">The Green <i className="text-stone-500">Square</i></h1>
          </div>

          <div className="space-y-4 text-xs font-mono text-stone-700 leading-relaxed mb-8">
            <p>
              Hi! I'm an independent creator who made this app. You can find me at <a href="https://sayhitosuman.pages.dev" target="_blank" rel="noopener noreferrer" className="text-[#196127] hover:text-stone-900 underline underline-offset-2">sayhitosuman.pages.dev</a>.
            </p>
            <p>
              <strong>No Terms & Conditions:</strong> This app works entirely locally on your device using your own storage. I care about user data privacy and thats why I made this app very very local and didn't used any cloud server so youve to maintain your own data.
            </p>
            <div className="bg-red-50 text-red-900 p-4 border border-red-200 mt-4 rounded-sm">
              <p className="text-[10px] uppercase font-bold tracking-widest mb-2">Critical Notice</p>
              <p>
                Because this app runs locally, clearing your browser data will delete everything! <br /><br />
                <strong>MAINTAIN A BACKUP EVERY WEEK AND YOU CAN DELETE THE PREVIOUS BACKUP FILES.</strong>
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              localStorage.setItem('greenSquareWelcomeSeen', 'true');
              setHasSeenWelcome(true);
            }}
            className="w-full bg-stone-900 text-white p-3 text-[10px] uppercase tracking-widest hover:bg-stone-800 transition-colors font-mono flex items-center justify-center gap-2"
          >
            I Understand, Let's Begin <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  if (!isSetup) {
    return (
      <div className="min-h-screen bg-[#f6f5f0] text-stone-800 flex items-center justify-center p-4 font-sans selection:bg-stone-200">
        <div className="bg-white border border-stone-300 p-6 w-full max-w-sm">
          <div className="flex items-center gap-2 mb-6 justify-center">
            <div className="w-5 h-5 bg-[#196127]"></div>
            <h1 className="text-2xl font-serif">The Green <i className="text-stone-500">Square</i></h1>
          </div>
          <form onSubmit={handleSetup} className="space-y-5">
            <div>
              <label className="block text-[9px] uppercase tracking-widest text-stone-500 mb-1 font-mono">Journey Name</label>
              <input
                type="text"
                value={journeyName}
                onChange={e => setJourneyName(e.target.value)}
                className="w-full border border-stone-200 p-2.5 text-xs focus:outline-none focus:border-stone-400 font-mono"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] uppercase tracking-widest text-stone-500 mb-1 font-mono">Start Date</label>
                <input
                  type="date"
                  value={format(startDate, 'yyyy-MM-dd')}
                  onChange={e => setStartDate(new Date(e.target.value))}
                  className="w-full border border-stone-200 p-2 text-xs focus:outline-none focus:border-stone-400 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-widest text-stone-500 mb-1 font-mono">Est. End Date</label>
                <input
                  type="date"
                  value={format(endDate, 'yyyy-MM-dd')}
                  onChange={e => setEndDate(new Date(e.target.value))}
                  className="w-full border border-stone-200 p-2 text-xs focus:outline-none focus:border-stone-400 font-mono"
                  required
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-stone-900 text-white p-2.5 text-[10px] uppercase tracking-widest hover:bg-stone-800 transition-colors font-mono flex items-center justify-center gap-2 mt-4">
              Create Tracker <ArrowRight className="w-3 h-3" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  const selectedDateKey = format(selectedDay, 'yyyy-MM-dd');
  const selectedDayTasks = tasks[selectedDateKey] || [];

  return (
    <div className="min-h-screen bg-[#f6f5f0] text-stone-800 py-6 px-4 md:py-10 font-sans selection:bg-stone-200">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* HEADER */}
        <header className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-4 h-4 bg-[#196127]"></div>
              <h1 className="text-xl md:text-2xl font-serif text-stone-900">The Green <i className="text-stone-500">Square</i></h1>
            </div>
            <p className="text-[9px] font-mono uppercase tracking-widest text-stone-500 mt-1">
              {journeyName} &middot; {format(startDate, 'MMM yyyy')} — {format(endDate, 'MMM yyyy')}
            </p>
          </div>
          <button onClick={() => setShowSettings(true)} className="text-stone-400 hover:text-stone-800 p-1">
            <Settings className="w-4 h-4" />
          </button>
        </header>

        {/* STATS TABLE (FLAT 2D) */}
        <div className="grid grid-cols-4 bg-white border border-stone-300 divide-x divide-stone-200">
          {[
            { label: 'TODAY SCORE', value: todayScore },
            { label: 'WEEKLY SCORE', value: weeklyScore },
            { label: 'MONTHLY SCORE', value: monthlyScore },
            { label: 'OVERALL SCORE', value: overallScore }
          ].map((stat, i) => (
            <div key={i} className="p-3 md:p-4 flex flex-col items-center justify-center">
              <div className="text-xl md:text-2xl font-serif text-stone-900 leading-none mb-1">{stat.value.toFixed(1)}</div>
              <div className="text-[8px] md:text-[9px] font-mono uppercase tracking-widest text-stone-400 text-center">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* WEEK NAVIGATOR & TASKS */}
        <div className="bg-white border border-stone-300">
          {/* Week Header */}
          <div className="flex justify-between items-center p-3 border-b border-stone-200 bg-stone-50/50">
            <button onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))} className="text-[9px] font-mono uppercase tracking-widest text-stone-500 hover:text-stone-900">&larr; Prev</button>
            <h2 className="text-[11px] font-mono uppercase tracking-widest text-stone-800">
              Week of {format(currentWeekStart, 'MMM do, yyyy')}
            </h2>
            <button onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))} className="text-[9px] font-mono uppercase tracking-widest text-stone-500 hover:text-stone-900">Next &rarr;</button>
          </div>

          {/* 7 Days Row */}
          <div className="flex border-b border-stone-200 divide-x divide-stone-200">
            {currentWeekDays.map((day, idx) => {
              const dayScore = getDayScore(day);
              const colorClass = getIntensityColor(dayScore);
              const isSelected = isSameDay(day, selectedDay);
              const isToday = isSameDay(day, today);

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(day)}
                  className={`flex-1 flex flex-col items-center justify-center p-2 h-14 transition-colors relative border ${colorClass} ${isSelected ? 'ring-2 ring-inset ring-stone-900 z-10' : 'border-transparent'}`}
                >
                  <span className={`text-[8px] font-mono uppercase tracking-widest ${dayScore > 0 ? 'opacity-80' : dayScore < 0 ? 'text-white' : 'text-stone-500'}`}>
                    {format(day, 'EEE')}
                  </span>
                  <span className={`text-sm font-serif leading-tight mt-0.5 ${isToday ? 'underline underline-offset-4 decoration-2' : ''} ${dayScore > 0 && dayScore <= 0.5 ? 'text-stone-900' : (dayScore > 0.5 || dayScore < 0) ? 'text-white' : 'text-stone-900'}`}>
                    {format(day, 'd')}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Task List for Selected Day */}
          <div className="p-4 md:p-6 min-h-[160px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-stone-800">
                {format(selectedDay, 'EEEE, MMMM do')}
              </h3>
              {isSameDay(selectedDay, today) && (
                <span className="text-[8px] font-mono uppercase tracking-widest bg-stone-100 px-2 py-0.5 text-stone-500">Today</span>
              )}
            </div>

            <div className="space-y-2 mb-4">
              {selectedDayTasks.length === 0 && (
                <div className="text-[10px] font-mono text-stone-400 italic py-2">No tasks recorded for this day.</div>
              )}
              {selectedDayTasks.map(task => {
                const effectiveStatus = getEffectiveStatus(task, selectedDay);
                const isOptionsOpen = activeTaskId === task.id;
                const isEditing = editingTaskId === task.id;

                return (
                  <div key={task.id} className="flex flex-col border border-transparent hover:border-stone-100 transition-colors">
                    <div className="flex items-start gap-3 p-2 group cursor-pointer select-none">

                      {/* Checkbox (Single Click Toggle) */}
                      <div
                        onClick={(e) => { e.stopPropagation(); toggleTaskDone(task.id, task.status); }}
                        className={`mt-0.5 w-3 h-3 border flex-shrink-0 cursor-pointer ${effectiveStatus === 'done' ? 'bg-[#196127] border-[#196127]' :
                          effectiveStatus === 'partial' ? 'bg-[#7bc96f] border-[#7bc96f]' :
                            effectiveStatus === 'undone' ? 'bg-red-400 border-red-400' :
                              'bg-white border-stone-300'
                          }`}
                      />

                      {/* Task Text (Double Tap / Long Press / Edit) */}
                      {isEditing ? (
                        <div className="flex-1 flex gap-2">
                          <input
                            autoFocus
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditedTask(task.id);
                              if (e.key === 'Escape') setEditingTaskId(null);
                            }}
                            className="flex-1 text-xs font-mono border-b border-stone-300 focus:outline-none focus:border-stone-900 bg-transparent"
                          />
                          <button onClick={() => saveEditedTask(task.id)} className="text-[9px] font-mono uppercase tracking-widest text-stone-500 hover:text-stone-900">Save</button>
                        </div>
                      ) : (
                        <div
                          onDoubleClick={(e) => { e.stopPropagation(); setActiveTaskId(isOptionsOpen ? null : task.id); }}
                          onTouchStart={(e) => {
                            const timer = setTimeout(() => setActiveTaskId(isOptionsOpen ? null : task.id), 450);
                            e.currentTarget.dataset.timer = timer.toString();
                          }}
                          onTouchEnd={(e) => clearTimeout(Number(e.currentTarget.dataset.timer))}
                          className={`flex-1 text-xs font-mono ${effectiveStatus === 'done' || effectiveStatus === 'undone' ? 'text-stone-400 line-through' : 'text-stone-700'
                            }`}
                        >
                          {task.text}
                        </div>
                      )}

                      {/* Edit Text Button */}
                      {!isEditing && canEditTask(selectedDay) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingText(task.text);
                            setEditingTaskId(task.id);
                            setActiveTaskId(null);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-stone-800 transition-opacity p-1"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Inline Status Menu (Revealed on Long Press / Double Click) */}
                    {isOptionsOpen && !isEditing && (
                      <div className="ml-8 mb-2 flex flex-wrap gap-2">
                        <button onClick={() => setTaskStatus(task.id, 'done')} className="text-[9px] font-mono uppercase tracking-widest px-2 py-1 bg-stone-100 hover:bg-stone-200 text-[#196127]">Done</button>
                        <button onClick={() => setTaskStatus(task.id, 'partial')} className="text-[9px] font-mono uppercase tracking-widest px-2 py-1 bg-stone-100 hover:bg-stone-200 text-[#239a3b]">Partial</button>
                        <button onClick={() => setTaskStatus(task.id, 'undone')} className="text-[9px] font-mono uppercase tracking-widest px-2 py-1 bg-stone-100 hover:bg-stone-200 text-red-500">Not Done</button>
                        <button onClick={() => setTaskStatus(task.id, 'pending')} className="text-[9px] font-mono uppercase tracking-widest px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-500">Clear Pending</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add Task Input */}
            {!isPastDay(selectedDay) || isSameDay(selectedDay, today) ? (
              <form onSubmit={addTask} className="mt-4 flex items-center gap-2 border-t border-stone-100 pt-4">
                <Plus className="w-3 h-3 text-stone-400" />
                <input
                  type="text"
                  placeholder="Add a new task..."
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  className="w-full text-xs font-mono bg-transparent focus:outline-none placeholder:text-stone-400"
                />
              </form>
            ) : (
              <div className="text-[9px] font-mono text-stone-400 uppercase tracking-widest mt-4 pt-4 border-t border-stone-100">
                Cannot add new tasks to past dates.
              </div>
            )}
          </div>
        </div>

        {/* THE JOURNEY MAP */}
        <div className="bg-white border border-stone-300 p-4 md:p-6">
          <h2 className="font-serif text-lg text-stone-900 mb-6">The Journey Map</h2>

          <div className="space-y-6">
            {years.map((yearWeeks, yearIndex) => (
              <div key={yearIndex}>
                <div className="text-[9px] font-mono tracking-widest text-stone-400 mb-2 uppercase">
                  - Year {yearIndex + 1} &middot; {format(yearWeeks[0], 'yyyy')} -
                </div>
                <div className="flex flex-wrap gap-1">
                  {yearWeeks.map((weekStart, wIndex) => {
                    const weekDays = getWeekDays(weekStart);
                    const weekScore = getScoreAverage(weekDays) / 10;
                    const isCurrent = isSameWeek(weekStart, today, { weekStartsOn: 1 });
                    const isFuture = isBefore(today, weekStart) && !isCurrent;

                    let bgClass = getIntensityColor(weekScore);
                    if (isCurrent) bgClass = 'bg-stone-900 border-stone-900';
                    if (isFuture) bgClass = 'bg-[#f6f5f0] border-[#e5e5e5]';

                    return (
                      <button
                        key={wIndex}
                        onClick={() => {
                          setCurrentWeekStart(weekStart);
                          setSelectedDay(weekStart);
                        }}
                        title={`Week of ${format(weekStart, 'MMM d, yyyy')}`}
                        className={`w-3.5 h-3.5 md:w-[14px] md:h-[14px] border ${bgClass} transition-colors hover:opacity-80`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* LEGEND */}
          <div className="mt-8 pt-6 border-t border-stone-200 flex flex-wrap items-center gap-4 text-[8px] font-mono uppercase tracking-widest text-stone-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-[#f6f5f0] border border-[#e5e5e5]"></div> Future
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              <div className="w-3 h-3 bg-red-400 border border-red-400"></div> Negative
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              <div className="w-3 h-3 bg-white border border-stone-200"></div> 0
            </div>
            <div className="flex gap-0.5 items-center ml-2">
              <div className="w-3 h-3 bg-[#c6e48b] border border-[#c6e48b]"></div>
              <div className="w-3 h-3 bg-[#7bc96f] border border-[#7bc96f]"></div>
              <div className="w-3 h-3 bg-[#239a3b] border border-[#239a3b]"></div>
              <div className="w-3 h-3 bg-[#196127] border border-[#196127]"></div>
            </div>
            <span className="ml-1">Intensity</span>
            <div className="flex items-center gap-1.5 ml-4">
              <div className="w-3 h-3 bg-stone-900 border border-stone-900"></div> Current Week
            </div>
          </div>
        </div>

      </div>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 bg-[#f6f5f0]/90 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-stone-300 p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-6 border-b border-stone-100 pb-4">
              <h2 className="font-serif text-lg text-stone-900">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-stone-400 hover:text-stone-800"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-5">
              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-widest text-stone-500 mb-1">Journey Name</label>
                  <input
                    type="text"
                    value={journeyName}
                    onChange={e => setJourneyName(e.target.value)}
                    className="w-full border border-stone-200 p-2 text-xs focus:outline-none focus:border-stone-400 font-mono text-stone-800"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-widest text-stone-500 mb-1">Extend End Date</label>
                  <input
                    type="date"
                    value={format(endDate, 'yyyy-MM-dd')}
                    onChange={e => setEndDate(new Date(e.target.value))}
                    className="w-full border border-stone-200 p-2 text-xs focus:outline-none focus:border-stone-400 font-mono text-stone-800"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-stone-100 flex gap-2">
                <button
                  onClick={installApp}
                  className="flex-1 flex flex-col items-center justify-center gap-1 bg-stone-50 border border-stone-200 p-2 hover:bg-stone-100 transition-colors"
                >
                  <Smartphone className="w-4 h-4 text-stone-600" />
                  <span className="text-[8px] font-mono uppercase tracking-widest text-stone-600 text-center">Install App</span>
                </button>
                <button
                  onClick={() => setShowInfo(true)}
                  className="flex-1 flex flex-col items-center justify-center gap-1 bg-stone-50 border border-stone-200 p-2 hover:bg-stone-100 transition-colors"
                >
                  <Info className="w-4 h-4 text-stone-600" />
                  <span className="text-[8px] font-mono uppercase tracking-widest text-stone-600 text-center">About & Info</span>
                </button>
              </div>

              <div className="pt-4 border-t border-stone-100">
                <label className="block text-[9px] font-mono uppercase tracking-widest text-stone-500 mb-2">Backups</label>
                <div className="flex gap-2">
                  <button onClick={exportData} className="flex-1 flex items-center justify-center gap-2 border border-stone-200 p-2 text-[9px] font-mono hover:bg-stone-50 uppercase tracking-widest text-stone-700">
                    <Download className="w-3 h-3" /> Export
                  </button>
                  <label className="flex-1 flex items-center justify-center gap-2 border border-stone-200 p-2 text-[9px] font-mono hover:bg-stone-50 uppercase tracking-widest text-stone-700 cursor-pointer">
                    <Upload className="w-3 h-3" /> Import
                    <input type="file" accept=".json" onChange={importData} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-stone-100">
                <button
                  onClick={() => {
                    if (confirm("Are you sure? This deletes ALL data permanently.")) {
                      localStorage.removeItem('greenSquareData_v5');
                      window.location.reload();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-stone-50 text-red-600 border border-stone-200 p-2 text-[9px] font-mono uppercase tracking-widest hover:bg-stone-100 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Erase Everything
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INFO MODAL */}
      {showInfo && (
        <div className="fixed inset-0 bg-[#f6f5f0]/90 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white border border-stone-300 p-6 w-full max-w-sm max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-stone-100 pb-4">
              <h2 className="font-serif text-lg text-stone-900">How It Works</h2>
              <button onClick={() => setShowInfo(false)} className="text-stone-400 hover:text-stone-800"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4 text-xs font-mono text-stone-700 leading-relaxed">
              <p>
                <strong className="text-stone-900 uppercase tracking-widest text-[10px]">Scoring System:</strong><br />
                Every day gets a score based on tasks:<br />
                - <strong>Done:</strong> +1 point<br />
                - <strong>Partial:</strong> +0.5 points<br />
                - <strong>Pending (Today):</strong> 0 points<br />
                - <strong>Not Done / Past Pending:</strong> -1 point (Negative Penalty)
              </p>
              <p>
                <strong className="text-stone-900 uppercase tracking-widest text-[10px]">Auto-Fail & Negative Scoring:</strong><br />
                At the end of a day, any task left marked as "Pending" is automatically treated as "Not Done". Not doing a task now applies a <strong>-1 negative penalty</strong>, actively subtracting from your total score and causing your overall averages to drop into the negatives.
              </p>
              <p>
                <strong className="text-stone-900 uppercase tracking-widest text-[10px]">Calculation Math:</strong><br />
                All top dashboard scores (Today, Weekly, Monthly, Overall) are scaled perfectly out of 10.<br />
                <span className="italic text-stone-500">((Total points / Total tasks) * 10)</span>
              </p>
              <p>
                <strong className="text-stone-900 uppercase tracking-widest text-[10px]">Interactions:</strong><br />
                - <strong>Single Click Box:</strong> Instantly toggle task as Done or Pending.<br />
                - <strong>Double Tap / Long Press Text:</strong> Reveal advanced grading statuses (Partial, Not Done).<br />
                - <strong>Pencil Icon:</strong> Change the text of an existing task.
              </p>
              <p>
                <strong className="text-stone-900 uppercase tracking-widest text-[10px]">The Journey Map:</strong><br />
                The bottom grid tracks your long-term consistency. The green shade deepens purely based on your exact completion percentage for that week.
              </p>
              <div className="pt-4 mt-4 border-t border-stone-100">
                <p>
                  <strong className="text-stone-900 uppercase tracking-widest text-[10px]">Creator & Data Privacy:</strong><br />
                  Created by an independent creator (<a href="https://sayhitosuman.pages.dev" target="_blank" rel="noopener noreferrer" className="text-[#196127] hover:text-stone-900 underline underline-offset-2">sayhitosuman.pages.dev</a>). <br /><br />
                  This app works entirely locally on your device. I care about user data privacy, which is why I made this app fully offline with no cloud servers or tracking. You must maintain your own data. Remember to export backups regularly, as clearing browser data will delete everything forever.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export { App };