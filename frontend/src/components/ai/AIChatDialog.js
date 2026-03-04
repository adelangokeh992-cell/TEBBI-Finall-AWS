import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, User, Loader2, X } from 'lucide-react';
import { aiAPI } from '../../services/api';
import { toast } from 'sonner';

export default function AIChatDialog({ open, onOpenChange, patientId, patientName, t, language }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(function() {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(function() {
    if (open && messages.length === 0) {
      var welcomeMsg = language === 'ar' 
        ? 'مرحباً! أنا طبي AI، مساعدك الطبي الذكي. كيف يمكنني مساعدتك اليوم؟'
        : 'Hello! I am Tebbi AI, your intelligent medical assistant. How can I help you today?';
      if (patientName) {
        welcomeMsg = language === 'ar'
          ? 'مرحباً! أنا طبي AI. أنا الآن أراجع ملف المريض ' + patientName + '. كيف يمكنني مساعدتك؟'
          : 'Hello! I am Tebbi AI. I am now reviewing ' + patientName + "'s file. How can I help?";
      }
      setMessages([{ role: 'assistant', content: welcomeMsg }]);
    }
  }, [open, patientName, language]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    
    var userMsg = input.trim();
    setInput('');
    setMessages(function(prev) { return prev.concat([{ role: 'user', content: userMsg }]); });
    setLoading(true);

    try {
      var res = await aiAPI.chat({
        patient_id: patientId,
        message: userMsg,
        session_id: sessionId,
        language: language
      });
      setSessionId(res.data.session_id);
      setMessages(function(prev) { return prev.concat([{ role: 'assistant', content: res.data.response }]); });
    } catch (e) {
      var msg = e?.response?.data?.detail || t('فشل الاتصال بالمساعد', 'Failed to connect to assistant');
      toast.error(typeof msg === 'string' ? msg : t('فشل الاتصال بالمساعد', 'Failed to connect to assistant'));
      setMessages(function(prev) { return prev.concat([{ role: 'assistant', content: t('عذراً، حدث خطأ. حاول مرة أخرى.', 'Sorry, an error occurred. Please try again.') }]); });
    }
    setLoading(false);
  }

  function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    setMessages([]);
    setSessionId(null);
  }

  var isRtl = language === 'ar';
  return React.createElement(Dialog, { open: open, onOpenChange: onOpenChange },
    React.createElement(DialogContent, { className: 'max-w-2xl h-[80vh] flex flex-col p-0', dir: isRtl ? 'rtl' : 'ltr' },
      React.createElement(DialogHeader, { className: 'p-4 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg' },
        React.createElement(DialogTitle, { className: 'flex items-center justify-between gap-2' },
          React.createElement('div', { className: 'flex items-center gap-2 flex-1 min-w-0' },
            React.createElement(Bot, { className: 'w-6 h-6 shrink-0' }),
            React.createElement('span', null, t('طبي AI - المساعد الطبي', 'Tebbi AI - Medical Assistant')),
            patientName ? React.createElement('span', { className: 'text-sm opacity-80 truncate' }, '(' + patientName + ')') : null
          ),
          React.createElement(Button, { variant: 'ghost', size: 'sm', onClick: clearChat, className: 'text-white hover:bg-white/20 shrink-0 gap-1', title: t('مسح المحادثة', 'Clear chat') },
            React.createElement(X, { className: 'w-4 h-4' }),
            React.createElement('span', { className: 'text-xs hidden sm:inline' }, t('مسح', 'Clear'))
          )
        )
      ),
      React.createElement('div', { className: 'flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/30' },
        messages.map(function(msg, i) {
          var isUser = msg.role === 'user';
          return React.createElement('div', { key: i, className: 'flex ' + (isUser ? 'justify-end' : 'justify-start') },
            React.createElement('div', { className: 'flex items-start gap-2 max-w-[85%] ' + (isUser ? 'flex-row-reverse' : '') },
              React.createElement('div', { className: 'w-9 h-9 rounded-full flex items-center justify-center shrink-0 ' + (isUser ? 'bg-teal-600' : 'bg-gradient-to-br from-blue-500 to-purple-600') },
                isUser ? React.createElement(User, { className: 'w-4 h-4 text-white' }) : React.createElement(Bot, { className: 'w-4 h-4 text-white' })
              ),
              React.createElement('div', {
                className: 'p-3 rounded-2xl ' + (isUser
                  ? 'bg-teal-600 text-white ' + (isRtl ? 'rounded-tl-sm' : 'rounded-tr-sm')
                  : 'bg-white dark:bg-slate-800 shadow-md border border-slate-200/50 ' + (isRtl ? 'rounded-tr-sm' : 'rounded-tl-sm'))
              },
                React.createElement('p', { className: 'text-sm whitespace-pre-wrap leading-relaxed' }, msg.content)
              )
            )
          );
        }),
        loading ? React.createElement('div', { className: 'flex justify-start' },
          React.createElement('div', { className: 'flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-200/50' },
            React.createElement(Loader2, { className: 'w-4 h-4 animate-spin text-blue-600' }),
            React.createElement('span', { className: 'text-sm text-muted-foreground' }, t('يكتب...', 'Typing...'))
          )
        ) : null,
        React.createElement('div', { ref: messagesEndRef })
      ),
      React.createElement('div', { className: 'p-4 border-t bg-white dark:bg-slate-900' },
        React.createElement('div', { className: 'flex gap-2' },
          React.createElement(Input, {
            value: input,
            onChange: function(e) { setInput(e.target.value); },
            onKeyPress: handleKeyPress,
            placeholder: t('اكتب سؤالك هنا...', 'Type your question here...'),
            disabled: loading,
            className: 'flex-1'
          }),
          React.createElement(Button, {
            onClick: sendMessage,
            disabled: loading || !input.trim(),
            className: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
          },
            loading ? React.createElement(Loader2, { className: 'w-4 h-4 animate-spin' }) : React.createElement(Send, { className: 'w-4 h-4' })
          )
        ),
        React.createElement('p', { className: 'text-xs text-muted-foreground mt-2 text-center' },
          t('⚕️ هذا مساعد استرشادي فقط - استشر الطبيب للتشخيص', '⚕️ Advisory assistant only - consult doctor for diagnosis')
        )
      )
    )
  );
}
