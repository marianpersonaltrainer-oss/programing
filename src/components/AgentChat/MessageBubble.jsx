export default function MessageBubble({ message, isLast }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-[#7B2FBE] flex items-center justify-center text-[10px] font-bold text-white mr-2 mt-1 flex-shrink-0">
          E
        </div>
      )}

      <div
        className={`
          max-w-[88%] rounded-2xl px-4 py-3
          ${isUser
            ? 'bg-[#7B2FBE]/20 border border-[#7B2FBE]/30 text-white rounded-tr-sm'
            : 'bg-[#1A1A1A] border border-white/5 text-white rounded-tl-sm'
          }
        `}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="session-content text-[12px] leading-relaxed text-gray-200">
            {message.content}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-6 h-6 rounded-full bg-[#2A2A2A] flex items-center justify-center text-[10px] font-bold text-evo-muted ml-2 mt-1 flex-shrink-0">
          M
        </div>
      )}
    </div>
  )
}
