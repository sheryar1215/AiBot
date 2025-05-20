import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import URL from './assets/constants';

function App() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const attributionShown = useRef(false);
  const messagesEndRef = useRef(null);
  const [editingChatId, setEditingChatId] = useState(null);
  const [renameText, setRenameText] = useState('');

  // Load all sessions on start
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('allChats')) || [];
    setChatHistory(stored);
    if (stored.length > 0) {
      setCurrentSessionId(stored[0].id);
      setMessages(stored[0].messages);
      attributionShown.current = stored[0].messages.some(m =>
        (Array.isArray(m.text) ? m.text.join(' ') : m.text).includes("developed by Sheryar Khan")
      );
    }
  }, []);

  // Save current session when messages change
  useEffect(() => {
    if (!currentSessionId) return;
    const updatedChats = chatHistory.map(chat =>
      chat.id === currentSessionId ? { ...chat, messages } : chat
    );
    localStorage.setItem('allChats', JSON.stringify(updatedChats));
    setChatHistory(updatedChats);
  }, [messages]);

  // Auto-scroll to bottom when messages or typing status change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Create new chat session
  const createNewSession = () => {
    const newId = Date.now().toString();
    const newSession = { id: newId, name: 'New Chat', pinned: false, messages: [] };
    const updatedHistory = [newSession, ...chatHistory];
    localStorage.setItem('allChats', JSON.stringify(updatedHistory));
    setChatHistory(updatedHistory);
    setMessages([]);
    setCurrentSessionId(newId);
    attributionShown.current = false;
  };

  // Load an existing chat session
  const loadSession = (id) => {
    const session = chatHistory.find(chat => chat.id === id);
    if (session) {
      setCurrentSessionId(id);
      setMessages(session.messages);
      attributionShown.current = session.messages.some(m =>
        (Array.isArray(m.text) ? m.text.join(' ') : m.text).includes("developed by Sheryar Khan")
      );
    }
  };

  // Delete a chat session
  const deleteSession = (id) => {
    const updatedChats = chatHistory.filter(chat => chat.id !== id);
    localStorage.setItem('allChats', JSON.stringify(updatedChats));
    setChatHistory(updatedChats);
    if (id === currentSessionId) {
      if (updatedChats.length > 0) {
        setCurrentSessionId(updatedChats[0].id);
        setMessages(updatedChats[0].messages);
      } else {
        setCurrentSessionId(null);
        setMessages([]);
      }
    }
  };

  // Clear current chat messages but keep session
  const refreshChat = () => {
    setMessages([]);
    attributionShown.current = false;
  };

  // Send question and handle bot reply
  const askQuestion = async () => {
    if (!question.trim()) return;

    const userMessage = { sender: 'user', text: question, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);

    // Update chat name if default or empty
    const currentChat = chatHistory.find(chat => chat.id === currentSessionId);
    if (currentChat && (currentChat.name === '' || currentChat.name === 'New Chat')) {
      const shortName = question.trim().split(' ').slice(0, 6).join(' ');
      const updatedChats = chatHistory.map(chat =>
        chat.id === currentSessionId ? { ...chat, name: shortName } : chat
      );
      setChatHistory(updatedChats);
      localStorage.setItem('allChats', JSON.stringify(updatedChats));
    }

    setIsTyping(true);

    const payLoad = {
      contents: [{ parts: [{ text: question }] }],
    };

    try {
      const response = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payLoad),
      });

      const data = await response.json();
      const rawReply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

      // Split bot response by "* " to create bullet points
      const botLines = rawReply
        .split("* ")
        .map(line => line.trim())
        .filter(line => line.length > 0);

      setMessages(prev => [...prev, { sender: 'bot', text: botLines, timestamp: new Date().toISOString() }]);
    } catch (err) {
      console.error("Fetch error:", err);
      setMessages(prev => [...prev, { sender: 'bot', text: ["Error: Could not fetch response."], timestamp: new Date().toISOString() }]);
    } finally {
      setIsTyping(false);
      setQuestion('');
    }
  };

  // Toggle pin/unpin a chat session
  const togglePinChat = (id) => {
    const updatedChats = chatHistory.map(chat =>
      chat.id === id ? { ...chat, pinned: !chat.pinned } : chat
    );
    // Sort pinned chats first, then by newest
    updatedChats.sort((a, b) => {
      if (a.pinned === b.pinned) return b.id.localeCompare(a.id);
      return b.pinned - a.pinned;
    });
    localStorage.setItem('allChats', JSON.stringify(updatedChats));
    setChatHistory(updatedChats);
  };

  // Start renaming a chat session
  const startRenaming = (id, currentName) => {
    setEditingChatId(id);
    setRenameText(currentName);
  };

  // Save renamed chat name
  const saveRename = (id) => {
    if (!renameText.trim()) return; // prevent empty names
    const updatedChats = chatHistory.map(chat =>
      chat.id === id ? { ...chat, name: renameText.trim() } : chat
    );
    localStorage.setItem('allChats', JSON.stringify(updatedChats));
    setChatHistory(updatedChats);
    setEditingChatId(null);
  };

  // Handle key press in rename input (Enter to save, Escape to cancel)
  const handleRenameKey = (e, id) => {
    if (e.key === 'Enter') {
      saveRename(id);
    } else if (e.key === 'Escape') {
      setEditingChatId(null);
    }
  };

  // Export all chats as JSON file
  const exportChats = () => {
    const dataStr = JSON.stringify(chatHistory, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat_sessions.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import chats JSON and merge avoiding duplicates
  const importChats = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!Array.isArray(imported)) throw new Error("Invalid format");

        // Merge imported with existing chats without duplicate ids
        const merged = [...chatHistory];
        imported.forEach(impChat => {
          if (!merged.find(c => c.id === impChat.id)) {
            merged.push(impChat);
          }
        });

        // Sort pinned first, then by newest id
        merged.sort((a, b) => {
          if (a.pinned === b.pinned) return b.id.localeCompare(a.id);
          return b.pinned - a.pinned;
        });

        localStorage.setItem('allChats', JSON.stringify(merged));
        setChatHistory(merged);
        e.target.value = ''; // reset file input
      } catch (err) {
        alert("Failed to import chats: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Filter chats by search term, case-insensitive
  const filteredChats = chatHistory.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format ISO timestamp to HH:mm
  const formatTimestamp = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="grid grid-cols-5 font-sans">
      {/* Sidebar */}
      <div className="bg-zinc-800 h-screen p-6 text-white shadow-md flex flex-col">
        <h2 className="text-xl font-bold mb-4">Chat Sessions</h2>

        <input
          type="text"
          placeholder="Search chats..."
          className="mb-3 px-3 py-2 rounded w-full text-black text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <button
          onClick={createNewSession}
          className="mb-4 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded text-white"
        >
          + New Chat
        </button>

        <div className="flex space-x-2 mb-4">
          <button
            onClick={exportChats}
            className="flex-1 bg-green-600 hover:bg-green-700 rounded px-3 py-2 text-white text-center text-sm"
            title="Export chats JSON"
          >
            Export
          </button>
          <label
            htmlFor="import-chats"
            className="flex-1 bg-gray-600 hover:bg-gray-700 rounded text-white text-center cursor-pointer text-sm"
            title="Import chats JSON"
          >
            Import
            <input
              type="file"
              id="import-chats"
              accept="application/json"
              onChange={importChats}
              className="hidden"
            />
          </label>
        </div>

        <ul className="space-y-2 overflow-y-auto flex-1">
          {filteredChats.length === 0 && (
            <li className="text-zinc-400 italic text-center">No chats found</li>
          )}
          {filteredChats.map((chat) => (
            <li
              key={chat.id}
              className={`flex justify-between items-center px-3 py-2 rounded cursor-pointer ${
                chat.id === currentSessionId ? 'bg-zinc-700' : 'hover:bg-zinc-700'
              }`}
              onDoubleClick={() => startRenaming(chat.id, chat.name)}
            >
              {/* Pin Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePinChat(chat.id);
                }}
                className={`mr-2 ${chat.pinned ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}`}
                title={chat.pinned ? 'Unpin chat' : 'Pin chat'}
              >
                📌
              </button>

              {/* Chat Name or Rename Input */}
              {editingChatId === chat.id ? (
                <input
                  type="text"
                  value={renameText}
                  autoFocus
                  onChange={(e) => setRenameText(e.target.value)}
                  onBlur={() => saveRename(chat.id)}
                  onKeyDown={(e) => handleRenameKey(e, chat.id)}
                  className="flex-1 bg-zinc-900 text-white px-2 py-1 rounded"
                />
              ) : (
                <span
                  onClick={() => loadSession(chat.id)}
                  className="flex-1 truncate"
                  title="Double click to rename"
                >
                  {chat.name || 'New Chat'}
                </span>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(chat.id);
                }}
                className="ml-2 text-red-500 hover:text-red-700 font-bold"
                title="Delete Chat"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        {currentSessionId && (
          <button
            onClick={refreshChat}
            className="mt-4 px-3 py-2 text-sm bg-yellow-600 hover:bg-yellow-700 rounded text-black"
            title="Clear current chat"
          >
            Refresh Chat
          </button>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="col-span-4 flex flex-col h-screen bg-zinc-950">
        <div className="flex-1 p-6 overflow-auto space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`max-w-xl px-4 py-2 rounded-xl text-white whitespace-pre-wrap relative ${
                msg.sender === 'user'
                  ? 'bg-blue-600 self-end ml-auto'
                  : 'bg-zinc-700 self-start mr-auto'
              }`}
            >
              {Array.isArray(msg.text) ? (
                <ul className="list-disc pl-5 space-y-1">
                  {msg.text.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              ) : (
                msg.text
              )}
              {msg.timestamp && (
                <div className="text-xs text-zinc-400 absolute bottom-1 right-2 select-none">
                  {formatTimestamp(msg.timestamp)}
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="max-w-xl px-4 py-2 rounded-xl bg-zinc-700 text-white self-start mr-auto animate-pulse">
              Bot is typing...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer Input */}
        <footer className="bg-zinc-900 p-4 border-t border-zinc-700">
          <div className="flex flex-col items-center space-y-2">
            <div className="flex items-center bg-zinc-800 text-white h-16 px-4 py-2 rounded-full border border-zinc-600 w-full max-w-2xl">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                type="text"
                className="flex-1 bg-transparent text-white outline-none p-3 placeholder-zinc-400 text-sm"
                placeholder="Ask Me Anything..."
                onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
              />
              <button
                onClick={askQuestion}
                className="ml-3 bg-white text-black font-semibold px-5 py-2 rounded-full hover:bg-zinc-200 transition"
              >
                ASK
              </button>
            </div>
            <p className="text-sm text-zinc-500">
              Developed by <span className="text-white font-semibold">Sheryar Khan</span>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
