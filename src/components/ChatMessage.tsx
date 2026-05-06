import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { File as FileIcon, Code2 } from 'lucide-react';

interface Attachment {
  name: string;
  type: string;
  url?: string;
}

interface ChatMessageProps {
  role: 'user' | 'model';
  text: string;
  attachments?: Attachment[];
  isProjectChat?: boolean;
}

export function ChatMessage({ role, text, attachments, isProjectChat }: ChatMessageProps) {
  const isUser = role === 'user';

  if (isUser) {
    return (
      <div className="flex w-full justify-end mb-6">
        <div className="flex flex-col items-end gap-2 max-w-[85%] md:max-w-[70%]">
          {attachments && attachments.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2 mb-1">
              {attachments.map((att, i) => (
                att.type.startsWith('image/') && att.url ? (
                  <img key={i} src={att.url} alt={att.name} className="max-w-[200px] max-h-[200px] rounded-xl object-cover border border-[#333]" />
                ) : (
                  <div key={i} className="flex items-center gap-2 bg-[#2f2f2f] px-3 py-2 rounded-xl border border-[#333] text-sm text-gray-300">
                    <FileIcon size={14} className="text-emerald-400" /> 
                    <span className="truncate max-w-[150px]">{att.name}</span>
                  </div>
                )
              ))}
            </div>
          )}
          {text && (
            <div className="bg-[#2f2f2f] text-gray-100 px-5 py-3 rounded-3xl whitespace-pre-wrap text-[15px] leading-relaxed">
              {text}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start mb-8">
      <div className="w-full text-gray-100 text-[15px] leading-relaxed">
        <div className="markdown-body prose prose-invert max-w-none prose-pre:p-0 prose-pre:bg-transparent prose-pre:m-0 prose-p:leading-relaxed prose-a:text-blue-400 hover:prose-a:text-blue-300">
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              code(props) {
                const { children, className, node, ref, ...rest } = props;
                const match = /language-(\w+)/.exec(className || '');
                if (match) {
                  if (isProjectChat) {
                    return (
                      <div className="rounded-xl overflow-hidden my-4 border border-[#333] bg-[#1e1e1e] p-4 flex items-center gap-4">
                        <div className="bg-emerald-500/20 p-2.5 rounded-full flex-shrink-0">
                          <Code2 size={24} className="text-emerald-400" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-200 text-base">Code Successful</div>
                          <div className="text-sm text-gray-400 mt-0.5">Check the Preview or Code tab to view the result.</div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="rounded-xl overflow-hidden my-4 border border-[#333] bg-[#1e1e1e]">
                      <div className="bg-[#2a2a2a] px-4 py-2 text-xs text-gray-400 font-mono border-b border-[#333] flex justify-between items-center">
                        <span>{match[1]}</span>
                        <button className="hover:text-gray-200 transition-colors">Copy</button>
                      </div>
                      <SyntaxHighlighter
                        {...rest}
                        PreTag="div"
                        children={String(children).replace(/\n$/, '')}
                        language={match[1]}
                        style={vscDarkPlus}
                        customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
                      />
                    </div>
                  );
                }
                return (
                  <code {...rest} className="bg-[#2a2a2a] px-1.5 py-0.5 rounded text-sm font-mono text-gray-200 before:content-none after:content-none">
                    {children}
                  </code>
                );
              }
            }}
          >
            {text}
          </Markdown>
        </div>
      </div>
    </div>
  );
}
