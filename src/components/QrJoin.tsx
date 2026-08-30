import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { joinUrlFor } from '../net/peer';

interface QrJoinProps {
  roomCode: string;
}

export function QrJoin({ roomCode }: QrJoinProps) {
  const [copied, setCopied] = useState(false);
  const url = joinUrlFor(roomCode);

  const share = async (): Promise<void> => {
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    try {
      if (nav.share) {
        await nav.share({ title: 'Traitor', text: 'Join my game of Traitor', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Cancelled share or blocked clipboard; the code below still works.
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="qr-frame">
        <QRCodeSVG value={url} size={188} level="M" bgColor="#f2e8d5" fgColor="#0c0608" />
      </div>

      <div className="text-center">
        <p className="eyebrow">Or type the code</p>
        <p className="display mt-1 text-4xl tracking-[0.4em] text-gold">{roomCode}</p>
      </div>

      <button type="button" className="btn btn-ghost" onClick={() => void share()}>
        {copied ? 'Link copied' : 'Share link'}
      </button>
    </div>
  );
}
