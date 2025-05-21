import React from 'react';

const PromptIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      stroke="currentColor"
      fill="none"
      strokeWidth="2"
      viewBox="0 0 24 24"
      strokeLinecap="round"
      strokeLinejoin="round"
      height="1em"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M5 7l5 5l-5 5"></path>
      <path d="M13 17l6 0"></path>
    </svg>
  );
};

export default PromptIcon;
