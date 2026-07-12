import { useEffect, useMemo, useState } from 'react';

type HowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

type Slide = {
  title: string;
  body: string;
};

const pieceScoreRows: Array<{ piece: string; label: string; score: number }> = [
  { piece: 'pawn', label: 'Pawn', score: 1 },
  { piece: 'knight', label: 'Knight', score: 3 },
  { piece: 'bishop', label: 'Bishop', score: 3 },
  { piece: 'rook', label: 'Rook', score: 5 },
  { piece: 'queen', label: 'Queen', score: 9 },
  { piece: 'king', label: 'King', score: 15 },
];

export const HowToPlayDialog = ({ open, onClose }: HowToPlayDialogProps) => {
  const slides = useMemo<Slide[]>(() => [
    {
      title: 'Choose Side And Premoves',
      body: 'You start by choosing sides. Once chosen, you are given a starting position and you must make 5 pre-moves.',
    },
    {
      title: 'Cross-Match Against Opposite Color',
      body: 'Your 5 moves are played against everyone who has played for the opposite color.',
    },
    {
      title: 'Capture And Promotion Points',
      body: 'For every capture and promotion, you get points based on the piece value table below.',
    },
    {
      title: 'Negative Points On Losses',
      body: 'If your pieces are captured, you receive negative points using the same piece values.',
    },
    {
      title: 'Illegal Move Rules',
      body: 'If you play an illegal move, you lose 15 points. If you force the opponent into an illegal move, you gain 15 points. Note: En passant is not possible.',
    },
    {
      title: 'Live Scoreboard All Day',
      body: 'Your game is played against every opponent while the game is active. Come back anytime during the day to see updated scores.',
    },
  ], []);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setIndex(0);
    }
  }, [open]);

  if (!open) return null;

  const onPrev = () => setIndex((value) => (value === 0 ? slides.length - 1 : value - 1));
  const onNext = () => setIndex((value) => (value === slides.length - 1 ? 0 : value + 1));
  const slide = slides[index]!;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(760px, 100%)',
          maxHeight: '88vh',
          overflowY: 'auto',
          background: '#FFFDF5',
          border: '4px solid #000000',
          borderRadius: 0,
          padding: '14px',
          color: '#000000',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{ fontSize: '16px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>How To Play</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: '3px solid #000000',
              background: '#FF6B6B',
              color: '#000000',
              padding: '4px 10px',
              fontWeight: 900,
              cursor: 'pointer',
              borderRadius: 0,
            }}
          >
            Close
          </button>
        </div>

        <div style={{ border: '4px solid #000000', background: '#FFFFFF', padding: '12px', minHeight: '220px' }}>
          <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Carousel {index + 1} / {slides.length}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, marginBottom: '8px' }}>{slide.title}</div>
          <div style={{ fontSize: '14px', lineHeight: 1.5 }}>{slide.body}</div>

          {index === 2 && (
            <div style={{ marginTop: '12px', border: '3px solid #000000' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#FFD93D', borderBottom: '3px solid #000' }}>
                <div style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', textAlign: 'center' }}>Piece</div>
                <div style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', textAlign: 'center' }}>Score</div>
              </div>
              {pieceScoreRows.map((row) => (
                <div key={row.piece} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '3px solid #000000' }}>
                  <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <img src={`/pieces/white_${row.piece}.png`} alt={row.label} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                    <span style={{ fontWeight: 800 }}>{row.label}</span>
                  </div>
                  <div style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 900 }}>{row.score}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
          <button
            type="button"
            onClick={onPrev}
            style={{
              border: '3px solid #000000',
              background: '#FFFFFF',
              color: '#000000',
              padding: '6px 10px',
              fontWeight: 900,
              cursor: 'pointer',
              borderRadius: 0,
            }}
          >
            Prev
          </button>

          <div style={{ display: 'flex', gap: '6px' }}>
            {slides.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                onClick={() => setIndex(dotIndex)}
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '999px',
                  border: '2px solid #000000',
                  background: dotIndex === index ? '#FF6B6B' : '#FFFFFF',
                  padding: 0,
                  cursor: 'pointer',
                }}
                aria-label={`Go to carousel ${dotIndex + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={onNext}
            style={{
              border: '3px solid #000000',
              background: '#FFD93D',
              color: '#000000',
              padding: '6px 10px',
              fontWeight: 900,
              cursor: 'pointer',
              borderRadius: 0,
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
