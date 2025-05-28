import React from 'react';

const StatusPage = () => {
  return (
    <div className="h-screen w-full">
      <iframe
        src="https://status.d.foundation/"
        className="h-full w-full border-0"
        title="Dwarves Foundation Status"
      />
    </div>
  );
};

export default StatusPage;
