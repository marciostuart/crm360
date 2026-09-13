"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global { interface Window { turnstile?: { render: (element: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void; reset: (id: string) => void; }; } }

export default function Turnstile({ siteKey, action, onToken }: { siteKey: string; action: string; onToken: (token: string) => void }) {
  const element = useRef<HTMLDivElement>(null); const widget = useRef<string | null>(null);
  function render() { if (!element.current || !window.turnstile || widget.current) return; widget.current = window.turnstile.render(element.current, { sitekey: siteKey, action, callback: (token: string) => onToken(token), "expired-callback": () => onToken(""), "error-callback": () => onToken("") }); }
  useEffect(() => { render(); return () => { if (widget.current && window.turnstile) window.turnstile.remove(widget.current); }; }, []);
  return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={render} /><div ref={element} className="turnstile-widget" /></>;
}
