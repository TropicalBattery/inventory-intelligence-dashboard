"use client";

import { useState } from "react";
import { AiChatButton } from "@/components/ai-chat/ai-chat-button";
import { AiChatSidebar } from "@/components/ai-chat/ai-chat-sidebar";

export function AiChatProvider() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      ) : null}
      <AiChatSidebar isOpen={isOpen} onClose={() => setIsOpen(false)} />
      <AiChatButton
        isOpen={isOpen}
        onToggle={() => setIsOpen((open) => !open)}
      />
    </>
  );
}
