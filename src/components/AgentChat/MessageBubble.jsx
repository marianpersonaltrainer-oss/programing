export default function MessageBubble({ message, isLast }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-evo-accent flex items-center justify-center text-[10px] font-bold text-white mr-2 mt-1 flex-shrink-0 shadow-lg shadow-purple-500/20">
          E
        </div>
      )}

      <div
        className={`
          max-w-[85%] rounded-2xl px-5 py-3.5 shadow-soft border animate-slide-up
          ${isUser
            ? 'bg-evo-accent border-evo-accent/20 text-white rounded-tr-sm shadow-purple-500/10'
            : 'bg-white border-[#6A1F6D]/20 text-[#1A0A1A] rounded-tl-sm'
          }
        `}
      >
        {isUser ? (
          <p className="text-sm font-medium leading-relaxed">{message.content}</p>
        ) : (
          <div className="session-content text-[12px] leading-relaxed text-[#1A0A1A]/95 font-medium">
            {message.content}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 ml-2 mt-1 flex-shrink-0 border border-white shadow-sm">
          M
        </div>
      )}
    </div>
  )
}
