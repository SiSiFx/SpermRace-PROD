export function LeaderboardSkeleton() {
  return (
    <div style={{ padding: '20px' }}>
      {/* Header Skeleton */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div style={{
          width: 150,
          height: 24,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
          borderRadius: 6,
        }} />
        <div style={{
          width: 80,
          height: 24,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
          borderRadius: 6,
        }} />
      </div>
      
      {/* Stats Skeleton */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 24,
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            padding: '12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{
              width: '60%',
              height: 20,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              borderRadius: 4,
              marginBottom: 8,
            }} />
            <div style={{
              width: '40%',
              height: 14,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              borderRadius: 4,
            }} />
          </div>
        ))}
      </div>
      
      {/* List Items Skeleton */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          marginBottom: 8,
        }}>
          {/* Rank */}
          <div style={{
            width: 40,
            height: 20,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            borderRadius: 6,
            animationDelay: `${i * 0.05}s`,
          }} />
          
          {/* Player Info */}
          <div style={{ flex: 1 }}>
            <div style={{
              width: '70%',
              height: 16,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              borderRadius: 4,
              marginBottom: 6,
              animationDelay: `${i * 0.05}s`,
            }} />
            <div style={{
              width: '40%',
              height: 12,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              borderRadius: 4,
              animationDelay: `${i * 0.05}s`,
            }} />
          </div>
          
          {/* Value */}
          <div style={{
            width: 60,
            height: 18,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            borderRadius: 4,
            animationDelay: `${i * 0.05}s`,
          }} />
        </div>
      ))}
      
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </div>
  );
}

export default LeaderboardSkeleton;
