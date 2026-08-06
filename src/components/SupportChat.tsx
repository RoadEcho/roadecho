"use client";

import { useState } from "react";

export default function SupportChat() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm your RoadEcho support guide. How can I help you with plate lookups, secure messaging, or your message vault today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });
      const data = await res.json();
      setMessages([...updatedMessages, { role: "assistant", content: data.reply }]);
    } catch (err) {
      console.error(err);
      setMessages([
        ...updatedMessages,
        { role: "assistant", content: "Sorry, I encountered an error connecting to support. Please try again later." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md my-8 text-slate-200">
      <h2 className="text-lg font-bold text-cyan-400 mb-4">RoadEcho AI Support Assistant</h2>

      <div className="h-80 overflow-y-auto space-y-4 mb-4 p-4 bg-slate-950/50 rounded-xl border border-slate-800 text-sm">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] p-3 rounded-xl leading-relaxed ${
                m.role === "user"
                  ? "bg-cyan-600 text-white rounded-br-none"
                  : "bg-slate-800 text-slate-300 rounded-bl-none"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 text-slate-400 p-3 rounded-xl text-xs animate-pulse">
              Searching RoadEcho documentation...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about RoadEcho terms, privacy, or vault..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-5 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
