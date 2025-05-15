import React from 'react';

interface Props {
  condition: boolean;
  children: React.ReactNode;
  render?: (children: React.ReactNode) => React.ReactNode;
}

const If = (props: Props) => {
  const { condition, render } = props;

  if (condition) {
    return render ? render(props.children) : props.children;
  }

  return null;
};

export default If;
