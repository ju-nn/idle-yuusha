import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function Card({ title, tone, children }: { title?: string; tone?: string; children: ReactNode }) {
  return <section className={`card ${tone || ''}`}>{title && <h3>{title}</h3>}{children}</section>;
}

export function Modal({ title, description, onClose, wide, children }: { title: string; description: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  return <div className="modalBackdrop"><div className={`modal ${wide ? 'wide' : ''}`}><div className="modalHead"><div><h2>{title}</h2><p>{description}</p></div><button onClick={onClose}><Icon name="x" /> 閉じる</button></div>{children}</div></div>;
}
