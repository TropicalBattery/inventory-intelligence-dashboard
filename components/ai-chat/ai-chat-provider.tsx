"use client";

import { useEffect, useState } from "react";
import { AiChatButton } from "@/components/ai-chat/ai-chat-button";
import { AiChatSidebar } from "@/components/ai-chat/ai-chat-sidebar";
import { panelBus } from "@/lib/ui/panel-bus";

export function AiChatProvider() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    return panelBus.subscribe((panel) => {
      if (panel !== "ai") {
        setIsOpen(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function handleToggle() {
    setIsOpen((open) => {
      const next = !open;
      if (next) {
        panelBus.open("ai");
      }
      return next;
    });
  }

  return (
    <>
      {isOpen ? (
        // Layering: header sticky z-40 → overlays z-40 → panels z-50
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      ) : null}
      <AiChatSidebar isOpen={isOpen} onClose={() => setIsOpen(false)} />
      <AiChatButton isOpen={isOpen} onToggle={handleToggle} />
    </>
  );
}
