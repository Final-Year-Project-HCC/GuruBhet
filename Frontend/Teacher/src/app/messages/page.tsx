"use client";
import { useState } from 'react';
import { Search, Send, MoreVertical, Phone, Video, ChevronLeft } from 'lucide-react';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderImage: string;
  text: string;
  timestamp: string;
  isMe: boolean;
}

interface Chat {
  id: string;
  studentId: string;
  studentName: string;
  studentImage: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
}

const TEACHER_CHATS: Chat[] = [
  {
    id: 'ch1',
    studentId: 's1',
    studentName: 'Aayush Sharma',
    studentImage: 'https://picsum.photos/seed/aayush/100/100',
    lastMessage: 'Is the session still on for tomorrow?',
    lastMessageTime: '10:30 AM',
    unreadCount: 2,
    messages: [
      { id: 'm1', senderId: 's1', senderName: 'Aayush Sharma', senderImage: 'https://picsum.photos/seed/aayush/100/100', text: 'Hello Sir!', timestamp: '09:00 AM', isMe: false },
      { id: 'm2', senderId: 't1', senderName: 'James Wilson', senderImage: 'https://picsum.photos/seed/james/100/100', text: 'Hi Aayush, how can I help you?', timestamp: '09:05 AM', isMe: true },
      { id: 'm3', senderId: 's1', senderName: 'Aayush Sharma', senderImage: 'https://picsum.photos/seed/aayush/100/100', text: 'Is the session still on for tomorrow?', timestamp: '10:30 AM', isMe: false },
    ]
  },
  {
    id: 'ch2',
    studentId: 's2',
    studentName: 'Bipul Chhetri',
    studentImage: 'https://picsum.photos/seed/bipul/100/100',
    lastMessage: 'Thank you for the notes.',
    lastMessageTime: 'Yesterday',
    unreadCount: 0,
    messages: [
      { id: 'm4', senderId: 't1', senderName: 'James Wilson', senderImage: 'https://picsum.photos/seed/james/100/100', text: 'I have sent the notes.', timestamp: 'Yesterday', isMe: true },
      { id: 'm5', senderId: 's2', senderName: 'Bipul Chhetri', senderImage: 'https://picsum.photos/seed/bipul/100/100', text: 'Thank you for the notes.', timestamp: 'Yesterday', isMe: false },
    ]
  }
];

const TeacherMessages: React.FC = () => {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(TEACHER_CHATS[0].id);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChats = TEACHER_CHATS.filter(chat => 
    chat.studentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedChat = TEACHER_CHATS.find(c => c.id === selectedChatId);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    // In a real app, we would update the chat messages here
    setMessageText('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 h-[calc(100vh-120px)]">
      <div className="bg-white rounded-2xl border border-border shadow-sm h-full flex overflow-hidden">
        {/* Sidebar */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-border flex flex-col ${selectedChatId && 'hidden md:flex'}`}>
          <div className="p-6 border-b border-border">
            <h2 className="text-xl font-bold mb-4">Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input 
                type="text" 
                placeholder="Search students..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          
          <div className="flex-grow overflow-y-auto">
            {filteredChats.length > 0 ? (
              filteredChats.map((chat) => (
                <button 
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.id)}
                  className={`w-full p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors border-b border-border/50 ${selectedChatId === chat.id ? 'bg-muted/50' : ''}`}
                >
                  <div className="relative">
                    <img 
                      src={chat.studentImage} 
                      alt={chat.studentName} 
                      className="w-12 h-12 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {chat.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-grow text-left overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-bold text-sm truncate">{chat.studentName}</h4>
                      <span className="text-[10px] text-muted-foreground">{chat.lastMessageTime}</span>
                    </div>
                    <p className={`text-xs truncate ${chat.unreadCount > 0 ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                      {chat.lastMessage}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No students found matching {searchQuery}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-grow flex flex-col bg-muted/10 ${!selectedChatId && 'hidden md:flex'}`}>
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 md:p-6 bg-white border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedChatId(null)}
                    className="md:hidden p-2 hover:bg-muted rounded-full"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <img 
                    src={selectedChat.studentImage} 
                    alt={selectedChat.studentName} 
                    className="w-10 h-10 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="font-bold text-sm">{selectedChat.studentName}</h4>
                    <p className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                      Online
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                  <button className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors">
                    <Phone size={20} />
                  </button>
                  <button className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors">
                    <Video size={20} />
                  </button>
                  <button className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors">
                    <MoreVertical size={20} />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-grow overflow-y-auto p-6 space-y-4 flex flex-col">
                {selectedChat.messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] md:max-w-[70%] flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 py-2 rounded-2xl text-sm ${
                        msg.isMe 
                          ? 'bg-primary text-primary-foreground rounded-tr-none' 
                          : 'bg-white border border-border rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 px-1">{msg.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Area */}
              <div className="p-4 md:p-6 bg-white border-t border-border">
                <form onSubmit={handleSendMessage} className="flex items-center gap-4">
                  <input 
                    type="text" 
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type a message..." 
                    className="flex-grow bg-muted/50 border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button 
                    type="submit"
                    className="bg-primary text-primary-foreground p-3 rounded-xl hover:bg-opacity-90 transition-colors shadow-sm"
                  >
                    <Send size={20} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center text-muted-foreground mb-4">
                <Send size={40} />
              </div>
              <h3 className="text-xl font-bold mb-2">Your Messages</h3>
              <p className="text-muted-foreground max-w-xs">Select a student from the sidebar to start chatting.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherMessages;
