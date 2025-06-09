import React from 'react';
import { GetStaticProps } from 'next';

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {
      seo: {
        title: 'System Status - Dwarves Memo',
        description: 'Current status of Dwarves Foundation systems.',
      },
    }, // Provide default seo props even on error
  };
};

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
