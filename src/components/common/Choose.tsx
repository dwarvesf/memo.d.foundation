import React from 'react';
import If from './If';

// Types for the component props
interface ChooseProps {
  children: React.ReactNode;
}

interface WhenProps {
  condition: boolean;
  children: React.ReactNode;
  render?: () => React.ReactNode;
}

interface OtherwiseProps {
  children?: React.ReactNode;
  render?: () => React.ReactNode;
}

const Choose: React.FC<ChooseProps> & {
  When: React.FC<WhenProps>;
  Otherwise: React.FC<OtherwiseProps>;
} = props => {
  let when: React.ReactElement | null = null;
  let otherwise: React.ReactElement | null = null;

  React.Children.forEach(props.children, child => {
    // Type guard to ensure child is a React element with props
    if (React.isValidElement<WhenProps | OtherwiseProps>(child)) {
      // Now TypeScript knows child.props has either WhenProps or OtherwiseProps
      if ('condition' in child.props) {
        // This is a When component
        if (!when && child.props.condition === true) {
          when = child;
        }
      } else {
        // This is an Otherwise component
        otherwise = child;
      }
    }
  });

  return when || otherwise;
};

const Otherwise = ({ render, children }: OtherwiseProps) =>
  render ? render() : <>{children}</>;

// We're using If for When, so assuming it already handles the WhenProps
Choose.When = If as React.FC<WhenProps>;

Choose.Otherwise = Otherwise;

export default Choose;
