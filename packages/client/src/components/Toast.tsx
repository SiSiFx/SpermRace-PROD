interface ToastProps {
  message: string | null;
  variant?: 'default' | 'mobile';
}

export function Toast({ message, variant = 'default' }: ToastProps) {
  if (!message) return null;

  const isMobile = variant === 'mobile';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: isMobile ? 16 : 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.72)',
        color: '#fff',
        padding: isMobile ? '8px 12px' : '10px 14px',
        borderRadius: 10,
        zIndex: 10001,
        fontSize: isMobile ? 11 : 12,
        border: '1px solid rgba(255,255,255,0.18)',
        maxWidth: isMobile ? '90vw' : 'auto',
        textAlign: 'center',
      }}
    >
      {message}
    </div>
  );
}

export default Toast;
