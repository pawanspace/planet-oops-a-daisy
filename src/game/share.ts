// "Share card": a square picture of the last level result, with a snapshot of the game.
import type Phaser from 'phaser';

export interface ShareInfo { name: string; stars: number; time: number; chased: number; sock: boolean }

function snapshot(game: Phaser.Game): Promise<HTMLImageElement | null> {
  return new Promise(res => {
    try { game.renderer.snapshot(img => res(img as HTMLImageElement)); } catch { res(null); }
  });
}

export async function shareCard(game: Phaser.Game, info: ShareInfo): Promise<void> {
  const S = 1080, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  const grad = x.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, '#2a1f45');
  grad.addColorStop(1, '#6a4c96');
  x.fillStyle = grad;
  x.fillRect(0, 0, S, S);

  const img = await snapshot(game);
  if (img) {
    const bx = 60, by = 190, bw = S - 120, bh = 560;
    const k = Math.max(bw / img.width, bh / img.height);
    const sw = bw / k, sh = bh / k;
    x.save();
    x.beginPath();
    x.roundRect(bx, by, bw, bh, 36);
    x.clip();
    x.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, bx, by, bw, bh);
    x.restore();
    x.lineWidth = 10;
    x.strokeStyle = '#fff8e8';
    x.beginPath();
    x.roundRect(bx, by, bw, bh, 36);
    x.stroke();
  }

  x.textAlign = 'center';
  x.fillStyle = '#ff6eb4';
  x.font = 'bold 80px "Chalkboard SE", "Comic Sans MS", sans-serif';
  x.fillText('PLANET OOPS-A-DAISY', S / 2, 120);
  x.fillStyle = '#fff8e8';
  x.font = 'bold 56px "Chalkboard SE", "Comic Sans MS", sans-serif';
  x.fillText(info.name, S / 2, 830);
  x.font = '80px sans-serif';
  x.fillText('⭐'.repeat(info.stars) + '☆'.repeat(3 - info.stars), S / 2, 930);
  const t = `${Math.floor(info.time / 60)}:${String(Math.floor(info.time % 60)).padStart(2, '0')}`;
  x.font = 'bold 40px "Chalkboard SE", "Comic Sans MS", sans-serif';
  x.fillStyle = '#ffd23c';
  x.fillText(`⏱ ${t}   ·   ${info.chased === 0 ? '🥷 never chased' : `💕 chased ${info.chased}×`}${info.sock ? '   ·   🧦' : ''}`, S / 2, 1010);

  const blob = await new Promise<Blob | null>(res => c.toBlob(res, 'image/png'));
  if (!blob) return;
  const file = new File([blob], 'oops-a-daisy.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: 'Planet Oops-a-Daisy' }); return; } catch { /* cancelled */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'oops-a-daisy.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
