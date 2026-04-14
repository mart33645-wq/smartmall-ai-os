
export const LoadingSkeleton = ({ count = 3 }: { count?: number }) => {
  return (
    <div className="space-y-4 animate-pulse p-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="glass p-6 rounded-3xl border border-white/5 space-y-3">
          <div className="flex justify-between items-center">
            <div className="h-5 bg-white/10 rounded-md w-1/3"></div>
            <div className="h-5 bg-white/10 rounded-md w-16"></div>
          </div>
          <div className="h-4 bg-white/5 rounded-md w-1/2"></div>
          <div className="h-4 bg-white/5 rounded-md w-full"></div>
        </div>
      ))}
    </div>
  );
};

export const DashboardSkeleton = () => (
  <div className="animate-pulse space-y-8 p-8 max-w-7xl mx-auto">
    <div className="flex justify-between items-center mb-8">
      <div className="h-10 bg-white/10 rounded-xl w-64"></div>
      <div className="h-10 bg-white/10 rounded-xl w-32"></div>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass p-6 rounded-[2rem] h-32 border border-white/5 bg-white/5"></div>
      ))}
    </div>
    
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 h-96 glass rounded-[-2rem] bg-white/5"></div>
      <div className="h-96 glass rounded-[-2rem] bg-white/5"></div>
    </div>
  </div>
);
