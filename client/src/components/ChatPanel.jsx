import { useLayoutEffect, useRef, useState } from 'react';
import { useChat } from '../hooks/useChat';
import { shouldShowHeader } from '../utils/chatUtils';
import { formatFullDateTime, formatMessageTime } from '../utils/dateUtils';

const MAX_LENGTH = 1000;
const NEAR_BOTTOM_PIXELS = 80;

function ChatPanel({ roomId, status, invoke, subscribe, currentUserId }) {
  const chat = useChat({ roomId, status, invoke, subscribe });
  const { messages } = chat;

  const listRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const previousRef = useRef({ first: null, last: null, scrollHeight: 0 });

  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isConnected = status === 'connected';

  // Decides how to scroll after the list changed:
  //   first time messages appear      -> jump to the bottom
  //   older messages added on top     -> keep the same message in view
  //   a new message added at bottom   -> follow it, unless the reader scrolled up
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    const first = messages.length > 0 ? messages[0].id : null;
    const last = messages.length > 0 ? messages[messages.length - 1].id : null;
    const previous = previousRef.current;

    previousRef.current = { first, last, scrollHeight: list.scrollHeight };

    if (last === null || last === previous.last && first === previous.first) {
      return;
    }

    if (previous.last === null) {
      list.scrollTop = list.scrollHeight;
      isAtBottomRef.current = true;
      return;
    }

    if (first !== null && previous.first !== null && first < previous.first) {
      list.scrollTop += list.scrollHeight - previous.scrollHeight;
      return;
    }

    if (last !== previous.last) {
      const newest = messages[messages.length - 1];

      if (isAtBottomRef.current || newest.userId === currentUserId) {
        list.scrollTop = list.scrollHeight;
        isAtBottomRef.current = true;
      } else {
        setUnreadCount((count) => count + 1);
      }
    }
  }, [messages, currentUserId]);

  function handleScroll() {
    const list = listRef.current;
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;

    isAtBottomRef.current = distanceFromBottom < NEAR_BOTTOM_PIXELS;

    if (isAtBottomRef.current && unreadCount > 0) {
      setUnreadCount(0);
    }
  }

  function scrollToBottom() {
    const list = listRef.current;
    list.scrollTop = list.scrollHeight;
    isAtBottomRef.current = true;
    setUnreadCount(0);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const text = draft.trim();
    if (!text || isSending || !isConnected) {
      return;
    }

    setIsSending(true);
    const succeeded = await chat.sendMessage(text);
    setIsSending(false);

    if (succeeded) {
      setDraft('');
    }
  }

  return (
    <div className="card chat-card">
      <h2 style={{ marginBottom: 12 }}>Chat</h2>

      <div className="chat-body">
        <div className="chat-list" ref={listRef} onScroll={handleScroll} role="log" aria-label="Chat messages">
          {chat.hasOlder && (
            <button
              className="button button-secondary button-small chat-load-older"
              type="button"
              onClick={chat.loadOlder}
              disabled={chat.isLoadingOlder}
            >
              {chat.isLoadingOlder ? 'Loading...' : 'Load earlier messages'}
            </button>
          )}

          {chat.isLoading && messages.length === 0 && !chat.loadError && (
            <p className="chat-empty">Loading messages...</p>
          )}

          {!chat.isLoading && messages.length === 0 && !chat.loadError && (
            <p className="chat-empty">No messages yet. Say hello!</p>
          )}

          {messages.map((message, index) => {
            const showHeader = shouldShowHeader(messages[index - 1], message);
            const isOwn = message.userId === currentUserId;

            return (
              <div key={message.id} className={showHeader ? 'chat-message is-first' : 'chat-message'}>
                {showHeader && (
                  <div className="chat-meta">
                    <span className={isOwn ? 'chat-author own' : 'chat-author'}>
                      {message.displayName}
                      {isOwn ? ' (you)' : ''}
                    </span>
                    <span className="chat-time" title={formatFullDateTime(message.sentAt)}>
                      {formatMessageTime(message.sentAt)}
                    </span>
                  </div>
                )}

                {/* Plain text on purpose: React escapes it, so <script> shows up as letters, never runs */}
                <p className="chat-text">{message.text}</p>
              </div>
            );
          })}
        </div>

        {unreadCount > 0 && (
          <button className="button button-small chat-new-messages" type="button" onClick={scrollToBottom}>
            ↓ {unreadCount} new {unreadCount === 1 ? 'message' : 'messages'}
          </button>
        )}
      </div>

      {chat.loadError && (
        <p className="command-error">
          {chat.loadError}{' '}
          <button className="link-button" type="button" onClick={chat.retryLoad}>
            Try again
          </button>
        </p>
      )}

      {!isConnected && (
        <p className="chat-hint">Reconnecting... you can send again when the connection is back.</p>
      )}

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={MAX_LENGTH}
          placeholder={isConnected ? 'Write a message...' : 'Reconnecting...'}
          disabled={!isConnected}
          autoComplete="off"
          aria-label="Message"
        />
        <button className="button" type="submit" disabled={!isConnected || isSending || draft.trim().length === 0}>
          Send
        </button>
      </form>

      {draft.length > 800 && (
        <p className="chat-hint">
          {draft.length}/{MAX_LENGTH}
        </p>
      )}

      {chat.sendError && <p className="command-error">{chat.sendError}</p>}
    </div>
  );
}

export default ChatPanel;