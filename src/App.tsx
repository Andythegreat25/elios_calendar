import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { CalendarGrid } from './components/CalendarGrid';
import { EventModal } from './components/EventModal';
import { CalendarEvent, Calendar as CalendarType, Profile } from './types';
import { format, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, LogOut } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Logo } from './components/Logo';

import { db, auth } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, query, getDocFromServer, deleteDoc } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function CalendarApp() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week'>('week');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<CalendarType[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; time: string } | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const [user, setUser] = useState(auth.currentUser);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Test connection
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (error) {
          if(error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration.");
          }
        }

        // Create or update profile
        const profileRef = doc(db, 'profiles', currentUser.uid);
        try {
          await setDoc(profileRef, {
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Utente',
            color: '#10b981' // Default color
          }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'profiles');
        }

        // Create personal calendar if it doesn't exist
        const defaultCalRef = doc(db, 'calendars', currentUser.uid);
        try {
          await setDoc(defaultCalRef, {
            id: currentUser.uid,
            name: currentUser.displayName ? `Calendario di ${currentUser.displayName}` : 'Il mio calendario',
            color: '#10b981',
            type: 'user',
            ownerId: currentUser.uid
          }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'calendars');
        }

        // Create Sala Riunioni if it doesn't exist
        const roomCalRef = doc(db, 'calendars', 'sala-riunioni');
        try {
          await setDoc(roomCalRef, {
            id: 'sala-riunioni',
            name: 'Sala Riunioni',
            color: '#6366f1',
            type: 'room',
            ownerId: currentUser.uid // Just assign to the first user who logs in
          }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'calendars');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const unsubProfiles = onSnapshot(collection(db, 'profiles'), (snapshot) => {
      const loadedProfiles = snapshot.docs.map(doc => doc.data() as Profile);
      setProfiles(loadedProfiles);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'profiles'));

    const unsubCalendars = onSnapshot(collection(db, 'calendars'), (snapshot) => {
      setCalendars(prevCalendars => {
        const prevVisibility = new Map(prevCalendars.map(c => [c.id, c.visible]));
        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: data.id,
            name: data.ownerId === user.uid && data.type === 'user' ? 'Il mio calendario' : data.name,
            color: data.color,
            type: data.type,
            ownerId: data.ownerId,
            visible: prevVisibility.has(data.id) ? prevVisibility.get(data.id) : true
          } as CalendarType;
        });
      });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'calendars'));

    const unsubEvents = onSnapshot(collection(db, 'events'), (snapshot) => {
      const loadedEvents = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          date: new Date(data.date),
          startTime: data.startTime,
          endTime: data.endTime,
          calendarId: data.calendarId,
          description: data.description,
          ownerId: data.ownerId,
          createdAt: data.createdAt
        } as CalendarEvent;
      });
      setEvents(loadedEvents);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'events'));

    return () => {
      unsubProfiles();
      unsubCalendars();
      unsubEvents();
    };
  }, [isAuthReady, user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 flex items-center justify-center mb-6">
            <Logo className="w-12 h-12" />
          </div>
          <p className="text-zinc-400 font-medium tracking-wide text-sm uppercase">Inizializzazione...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] p-4">
        <div className="bg-white p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-zinc-100 max-w-sm w-full text-center">
          <div className="w-16 h-16 flex items-center justify-center mx-auto mb-8">
            <Logo className="w-16 h-16" />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900 mb-3 tracking-tight">Elios Workspace</h1>
          <p className="text-zinc-500 mb-10 text-sm leading-relaxed">Accedi per visualizzare e gestire gli appuntamenti e le risorse del team.</p>
          <button
            onClick={handleLogin}
            className="w-full bg-zinc-900 text-white rounded-xl py-3.5 px-4 font-medium hover:bg-zinc-800 transition-all shadow-sm flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continua con Google
          </button>
        </div>
      </div>
    );
  }

  const handleToggleCalendar = (id: string) => {
    setCalendars(calendars.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const handleColorChange = async (id: string, color: string) => {
    if (!user) return;
    const calRef = doc(db, 'calendars', id);
    try {
      await setDoc(calRef, { color }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'calendars');
    }
  };

  const handlePrev = () => {
    if (view === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subDays(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (view === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleSlotClick = (date: Date, time: string) => {
    setSelectedSlot({ date, time });
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const handleNewEvent = () => {
    setSelectedSlot(null);
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (eventData: Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>) => {
    if (!user) return;
    
    const newEventId = Math.random().toString(36).substr(2, 9);
    const eventRef = doc(db, 'events', newEventId);
    
    try {
      await setDoc(eventRef, {
        title: eventData.title,
        date: format(eventData.date, 'yyyy-MM-dd'),
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        calendarId: eventData.calendarId,
        description: eventData.description || '',
        ownerId: user.uid,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'events');
    }
  };

  const handleUpdateEvent = async (id: string, eventData: Partial<Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>>) => {
    if (!user) return;
    
    const eventRef = doc(db, 'events', id);
    
    try {
      const updateData: any = { ...eventData };
      if (eventData.date) {
        updateData.date = format(eventData.date, 'yyyy-MM-dd');
      }
      await setDoc(eventRef, updateData, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'events');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!user) return;
    
    const eventRef = doc(db, 'events', id);
    
    try {
      await deleteDoc(eventRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'events');
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedSlot(null);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen p-4 sm:p-8 flex items-center justify-center">
      <div className="w-full max-w-[1400px] h-[90vh] min-h-[700px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex border border-white/10">
        <Sidebar
          calendars={calendars}
          events={events}
          onToggleCalendar={handleToggleCalendar}
          onColorChange={handleColorChange}
          onNewEvent={handleNewEvent}
          currentDate={currentDate}
          onDateSelect={setCurrentDate}
          user={user}
          onLogout={handleLogout}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-white">
          <header className="h-24 px-10 flex items-center justify-between border-b border-zinc-100 bg-white flex-shrink-0">
            <div className="flex items-center gap-6">
              <h1 className="text-3xl font-medium text-zinc-900 capitalize tracking-tight">
                {format(currentDate, 'MMMM, yyyy', { locale: it })}
              </h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  className="p-2.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 rounded-full transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleToday}
                  className="px-5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-full transition-all"
                >
                  Oggi
                </button>
                <button
                  onClick={handleNext}
                  className="p-2.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 rounded-full transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex items-center bg-zinc-100/50 p-1 rounded-full border border-zinc-200/50">
              <button
                onClick={() => setView('day')}
                className={`px-6 py-2 text-sm font-medium rounded-full transition-all ${
                  view === 'day' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Giorno
              </button>
              <button
                onClick={() => setView('week')}
                className={`px-6 py-2 text-sm font-medium rounded-full transition-all ${
                  view === 'week' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Settimana
              </button>
            </div>
          </header>

          <div className="flex-1 p-6 overflow-hidden">
            <CalendarGrid
              currentDate={currentDate}
              view={view}
              events={events}
              calendars={calendars}
              onSlotClick={handleSlotClick}
              onEventClick={handleEventClick}
            />
          </div>
        </main>

        <EventModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveEvent}
          onUpdate={handleUpdateEvent}
          onDelete={handleDeleteEvent}
          initialDate={selectedSlot?.date}
          initialTime={selectedSlot?.time}
          calendars={calendars}
          editEvent={editingEvent}
          currentUserId={user?.uid}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CalendarApp />
    </ErrorBoundary>
  );
}
